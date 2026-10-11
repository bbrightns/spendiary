import { useEffect, useMemo, useRef, useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../store/ToastContext'
import { localDateStr, thb } from '../../lib/format'
import { getCategory } from './categories'
import { NOT_TRACKED, PayMethodPicker } from './PayMethodPicker'
import { DEFAULT_MIN_PAYMENT_PERCENT, TAG_RE, cardCycle, minimumPayment } from './logic'
import { useSpend } from './useSpend'
import { TONES } from './tones'

const OPEN_EVENT = 'spendiary:open-pay-bill'

/** Open the "Pay bill" sheet for a credit card from anywhere in the app. */
export function openPayBill(cardId: string) {
  window.dispatchEvent(new CustomEvent<string>(OPEN_EVENT, { detail: cardId }))
}

const short = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
const nextDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return localDateStr(new Date(y, m - 1, d + 1))
}

export function dueText(days: number): string {
  if (days < 0) return `${-days} ${days === -1 ? 'day' : 'days'} overdue`
  if (days === 0) return 'due today'
  if (days === 1) return 'due tomorrow'
  return `due in ${days} days`
}

export function PayBillSheet() {
  const { bills, methods, settings, addTransaction } = useSpend()
  const { showToast } = useToast()
  const [cardId, setCardId] = useState<string | null>(null)
  // full: the closed statement · all: everything owed now, this cycle included (paying early)
  const [mode, setMode] = useState<'full' | 'all' | 'min' | 'custom'>('full')
  const [custom, setCustom] = useState('')
  const [fromId, setFromId] = useState('')
  const [showAll, setShowAll] = useState(false)

  const wallets = useMemo(() => methods.filter((m) => m.kind === 'cash'), [methods])
  const stateRef = useRef({ wallets, settings, bills })
  stateRef.current = { wallets, settings, bills }

  useEffect(() => {
    function onOpen(e: Event) {
      const { wallets: ws, settings: st, bills: bs } = stateRef.current
      const id = (e as CustomEvent<string>).detail
      const def = ws.find((w) => w.id === st.defaultAccountId)?.id
      const fav = ws.find((w) => (st.favoriteAccountIds ?? []).includes(w.id))?.id
      setFromId(def ?? fav ?? ws.find((w) => !w.locked)?.id ?? ws[0]?.id ?? '')
      // Nothing billed yet → start on paying off what's owed so far
      setMode((bs.find((b) => b.card.id === id)?.amountDue ?? 0) > 0 ? 'full' : 'all')
      setCustom('')
      setShowAll(false)
      setCardId(id)
    }
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_EVENT, onOpen)
  }, [])

  const bill = bills.find((b) => b.card.id === cardId)
  const close = () => setCardId(null)
  const customNum = Number(custom.replace(/,/g, ''))
  const minimum = bill ? minimumPayment(bill.amountDue, bill.card.minPaymentPercent) : 0
  const owed = bill ? Math.max(0, Math.round(bill.card.balance * 100) / 100) : 0
  const due = bill?.amountDue ?? 0
  // The cycle still open: from the day after the last statement up to the next statement day
  const next = bill ? cardCycle(bill.card).nextStatement : ''
  const amount = mode === 'full' ? due : mode === 'all' ? owed : mode === 'min' ? minimum : customNum
  // No wallet = paid outside the app: only the card's balance goes down
  const outside = fromId === NOT_TRACKED
  const canPay = !!bill && Number.isFinite(amount) && amount > 0

  const pay = () => {
    if (!bill || !canPay) return
    addTransaction({
      type: 'transfer',
      amount: Math.round(amount * 100) / 100,
      accountId: outside ? undefined : fromId,
      toAccountId: bill.card.id,
      date: localDateStr(),
      note: `Pay ${bill.card.name} ${due > 0 ? 'bill' : 'card'}`,
    })
    showToast(outside ? `Marked ${thb(amount, true)} as paid on ${bill.card.name}` : `Paid ${thb(amount, true)} to ${bill.card.name}`)
    close()
  }

  const statusClass =
    bill?.status === 'overdue' ? 'text-loss' : bill?.status === 'due' ? 'text-warn' : 'text-ink-muted'
  const items = bill ? (showAll ? bill.items : bill.items.slice(0, 5)) : []

  return (
    <Modal
      open={!!bill}
      onClose={close}
      title={bill ? `Pay ${bill.card.name}` : 'Pay bill'}
      description={
        bill
          ? due > 0
            ? `Statement ${short(nextDay(bill.from))} – ${short(bill.to)} · due ${short(bill.dueDate)}`
            : `This cycle ${short(nextDay(bill.to))} – ${short(next)} · closes ${short(next)}`
          : undefined
      }
      size="md"
      footer={
        bill && owed > 0 ? (
          <Button data-modal-submit className="w-full" disabled={!canPay} onClick={pay}>
            {outside ? 'Mark' : 'Pay'} {thb(amount > 0 ? amount : 0, true)}
            {outside ? ' as paid' : ''}
          </Button>
        ) : (
          <Button variant="secondary" className="w-full" onClick={close}>
            Close
          </Button>
        )
      }
    >
      {bill && (
        <div className="space-y-5">
          {/* Amount due */}
          <div className="text-center">
            <p className="text-xs font-medium text-ink-muted">{due > 0 ? 'Amount due' : owed > 0 ? 'Owed so far' : 'Nothing owed'}</p>
            <p className="font-display text-5xl font-extrabold tracking-tight tnum text-ink">{thb(due > 0 ? due : owed, true)}</p>
            {due > 0 ? (
              <p className={`mt-1 text-sm font-semibold ${statusClass}`}>{dueText(bill.daysToDue)}</p>
            ) : (
              owed > 0 && <p className="mt-1 text-sm text-ink-muted">Nothing billed yet · you can pay early</p>
            )}
          </div>

          {/* How it adds up */}
          {due > 0 && (
            <div className="rounded-2xl bg-surface-muted/70 p-4 text-sm">
              <div className="flex justify-between gap-3 py-0.5">
                <span className="text-ink-muted">
                  Statement {bill.items.length > 0 && `(${bill.items.length} ${bill.items.length === 1 ? 'item' : 'items'})`}
                </span>
                <span className="font-semibold text-ink tnum">{thb(bill.statementTotal, true)}</span>
              </div>
              {Math.abs(bill.other) >= 1 && (
                <div className="flex justify-between gap-3 py-0.5">
                  <span className="text-ink-muted">{bill.other > 0 ? 'Carried over / not logged' : 'Adjustments'}</span>
                  <span className="font-semibold text-ink tnum">
                    {bill.other < 0 ? '−' : ''}
                    {thb(Math.abs(bill.other), true)}
                  </span>
                </div>
              )}
              {bill.paidEarly > 0 && (
                <div className="flex justify-between gap-3 py-0.5">
                  <span className="text-ink-muted">Paid before statement</span>
                  <span className="font-semibold text-gain tnum">−{thb(bill.paidEarly, true)}</span>
                </div>
              )}
              {bill.paidSoFar > 0 && (
                <div className="flex justify-between gap-3 py-0.5">
                  <span className="text-ink-muted">Paid since statement</span>
                  <span className="font-semibold text-gain tnum">−{thb(bill.paidSoFar, true)}</span>
                </div>
              )}
              <div className="mt-1.5 flex justify-between gap-3 border-t border-line pt-1.5">
                <span className="font-bold text-ink">Left to pay</span>
                <span className="font-bold text-ink tnum">{thb(bill.amountDue, true)}</span>
              </div>
              {owed > due + 0.005 && (
                <div className="flex justify-between gap-3 py-0.5 text-ink-muted">
                  <span>Spent since, on the next bill</span>
                  <span className="tnum">{thb(owed - due, true)}</span>
                </div>
              )}
            </div>
          )}

          {/* Statement items */}
          {due > 0 && bill.items.length > 0 && (
            <div>
              <p className="mb-1 text-sm font-semibold text-ink-soft">On this statement</p>
              <ul className="divide-y divide-line">
                {items.map((t) => {
                  const cat = getCategory(t.categoryId)
                  const Icon = cat?.icon
                  return (
                    <li key={t.id} className="flex items-center gap-3 py-2">
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${TONES[cat?.tone ?? 'slate'].chip}`}>
                        {Icon && <Icon className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink">{t.note?.replace(TAG_RE, '').replace(/\s+/g, ' ').trim() || cat?.label}</span>
                        <span className="block text-xs text-ink-muted">{short(t.date)}</span>
                      </span>
                      <span className={`shrink-0 text-sm font-bold tnum ${t.type === 'income' ? 'text-gain' : 'text-ink'}`}>
                        {t.type === 'income' ? '−' : ''}
                        {thb(t.amount, true)}
                      </span>
                    </li>
                  )
                })}
              </ul>
              {bill.items.length > 5 && (
                <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-1 text-sm font-semibold text-brand cursor-pointer">
                  {showAll ? 'Show less' : `Show all ${bill.items.length}`}
                </button>
              )}
            </div>
          )}

          {owed > 0 && (
            <>
              {/* How much */}
              <div>
                <p className="mb-2 text-sm font-semibold text-ink-soft">Pay</p>
                <div className="grid grid-cols-2 gap-2">
                  {due > 0 && (
                    <button
                      type="button"
                      aria-pressed={mode === 'full'}
                      onClick={() => setMode('full')}
                      className={`rounded-2xl border px-3 py-2.5 text-left cursor-pointer ${mode === 'full' ? 'border-brand/50 bg-brand-soft ring-2 ring-brand/15' : 'border-line hover:bg-surface-muted/60'}`}
                    >
                      <span className="block text-xs font-semibold text-ink-muted">This bill</span>
                      <span className="block text-sm font-bold text-ink tnum">{thb(due, true)}</span>
                    </button>
                  )}
                  {owed > due + 0.005 && (
                    <button
                      type="button"
                      aria-pressed={mode === 'all'}
                      onClick={() => setMode('all')}
                      className={`rounded-2xl border px-3 py-2.5 text-left cursor-pointer ${mode === 'all' ? 'border-brand/50 bg-brand-soft ring-2 ring-brand/15' : 'border-line hover:bg-surface-muted/60'}`}
                    >
                      <span className="block text-xs font-semibold text-ink-muted">{due > 0 ? 'Everything owed' : 'All owed so far'}</span>
                      <span className="block text-sm font-bold text-ink tnum">{thb(owed, true)}</span>
                    </button>
                  )}
                  {due > 0 && minimum < due && (
                    <button
                      type="button"
                      aria-pressed={mode === 'min'}
                      onClick={() => setMode('min')}
                      className={`rounded-2xl border px-3 py-2.5 text-left cursor-pointer ${mode === 'min' ? 'border-brand/50 bg-brand-soft ring-2 ring-brand/15' : 'border-line hover:bg-surface-muted/60'}`}
                    >
                      <span className="block text-xs font-semibold text-ink-muted">Minimum ({bill.card.minPaymentPercent ?? DEFAULT_MIN_PAYMENT_PERCENT}%)</span>
                      <span className="block text-sm font-bold text-ink tnum">{thb(minimum, true)}</span>
                    </button>
                  )}
                  <label
                    className={`col-span-2 rounded-2xl border px-3 py-2.5 cursor-text ${mode === 'custom' ? 'border-brand/50 bg-brand-soft ring-2 ring-brand/15' : 'border-line hover:bg-surface-muted/60'}`}
                  >
                    <span className="block text-xs font-semibold text-ink-muted">Other amount</span>
                    <span className="flex items-center text-sm font-bold text-ink">
                      ฿
                      <input
                        inputMode="decimal"
                        value={custom}
                        onFocus={() => setMode('custom')}
                        onChange={(e) => {
                          setMode('custom')
                          setCustom(e.target.value.replace(/[^\d.,]/g, ''))
                        }}
                        placeholder="0"
                        aria-label="Other amount"
                        className="ml-1 w-full bg-transparent outline-none tnum placeholder:text-ink-faint"
                      />
                    </span>
                  </label>
                </div>
              </div>

              {mode === 'min' && (
                <p className="-mt-2 text-xs text-ink-muted">Interest is charged on what's left after the due date.</p>
              )}
              <PayMethodPicker
                label="From wallet"
                methods={wallets}
                value={fromId}
                onChange={setFromId}
                allowNone
                favoriteIds={settings.favoriteAccountIds ?? []}
                defaultId={settings.defaultAccountId}
              />
            </>
          )}
        </div>
      )}
    </Modal>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { NumberField } from '../../components/ui/Field'
import { CheckCircleIcon, CheckIcon } from '../../components/icons'
import { useToast } from '../../store/ToastContext'
import { thb } from '../../lib/format'
import { roundMoney } from '../../lib/money'
import type { SpendTransaction } from '../../lib/types'
import { getCategory } from './categories'
import { billDate, chargesMatching, noteTitle } from './logic'
import { useSpend } from './useSpend'
import { SHEET_EVENTS, openQuickAdd } from './sheetEvents'

const OPEN_EVENT = SHEET_EVENTS.matchStatement

const short = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
const net = (t: SpendTransaction) => (t.type === 'income' ? -t.amount : t.amount)

/**
 * Check a card's last bill against the bank's: type the bank's total, and when the app's is higher,
 * move the charges the bank hasn't billed yet to the next bill (the gap is often exactly some charges
 * made just before the cut-off). When the bank's is higher, add the difference as fees on this bill.
 */
export function MatchStatementSheet() {
  const { bills, addTransaction, removeTransaction, setBillStatement } = useSpend()
  const { showToast } = useToast()
  const [cardId, setCardId] = useState<string | null>(null)
  const [bank, setBank] = useState('')
  // Charges ticked by hand; until then the suggested ones are ticked
  const [picked, setPicked] = useState<Set<string> | null>(null)

  useEffect(() => {
    const open = (e: Event) => {
      setBank('')
      setPicked(null)
      setCardId((e as CustomEvent<string>).detail)
    }
    window.addEventListener(OPEN_EVENT, open)
    return () => window.removeEventListener(OPEN_EVENT, open)
  }, [])

  const bill = bills.find((b) => b.card.id === cardId)
  const close = () => setCardId(null)
  const bankNum = Number(bank.replace(/,/g, ''))
  const hasBank = bank.trim() !== '' && Number.isFinite(bankNum)
  // What the app says the statement billed: still due plus what's been paid toward it since
  const appTotal = bill ? roundMoney(bill.amountDue + bill.paidSoFar) : 0
  const gap = hasBank ? roundMoney(appTotal - bankNum) : 0

  // Charges on this bill, the ones made near the cut-off first: those are the likely late posts
  const onBill = useMemo(() => {
    if (!bill) return []
    const near = new Set(bill.nearCutoff.map((t) => t.id))
    return [...bill.items].sort((a, b) => Number(near.has(b.id)) - Number(near.has(a.id)) || b.date.localeCompare(a.date))
  }, [bill])
  const suggested = useMemo(() => {
    if (!bill || gap <= 0) return undefined
    const near = bill.nearCutoff.filter((t) => billDate(t) <= bill.to)
    return chargesMatching(near, gap) ?? chargesMatching(bill.items, gap)
  }, [bill, gap])
  const selected = picked ?? new Set((suggested ?? []).map((t) => t.id))
  const selectedTotal = roundMoney(onBill.filter((t) => selected.has(t.id)).reduce((s, t) => s + net(t), 0))
  const left = roundMoney(gap - selectedTotal)

  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setPicked(next)
  }

  const moveSelected = () => {
    if (!bill || selected.size === 0) return
    const moving = onBill.filter((t) => selected.has(t.id))
    // Undo puts each one back on the statement it had (a charge already moved here keeps that)
    const before = new Map<string | undefined, string[]>()
    for (const t of moving) before.set(t.statement, [...(before.get(t.statement) ?? []), t.id])
    setBillStatement(
      moving.map((t) => t.id),
      bill.nextStatement,
    )
    showToast(`${moving.length} ${moving.length === 1 ? 'charge' : 'charges'} moved to the ${short(bill.nextStatement)} bill`, 'success', {
      label: 'Undo',
      onClick: () => before.forEach((ids, stmt) => setBillStatement(ids, stmt)),
    })
    close()
  }

  const addFees = () => {
    if (!bill || gap >= 0) return
    const amount = roundMoney(-gap)
    const txn = addTransaction({
      type: 'expense',
      amount,
      categoryId: 'bills',
      accountId: bill.card.id,
      // On the statement day, so it lands on this bill
      date: bill.to,
      note: `${bill.card.name} fees and interest`,
    })
    showToast(`Added ${thb(amount, true)} in fees to the ${short(bill.to)} bill`, 'success', {
      label: 'Undo',
      onClick: () => removeTransaction(txn.id),
    })
    close()
  }

  const logMissing = () => {
    if (!bill) return
    close()
    openQuickAdd({ draft: { type: 'expense', accountId: bill.card.id }, hint: `A charge on the ${short(bill.to)} bill you haven't logged` })
  }

  const matched = hasBank && Math.abs(gap) < 0.005

  return (
    <Modal
      open={!!bill}
      onClose={close}
      title="Match with bank statement"
      description={bill ? `${bill.card.name} · bill closing ${short(bill.to)}` : undefined}
      size="md"
    >
      {bill && (
        <div className="space-y-5">
          <NumberField label="Total on the bank's bill" value={bank} onChange={(v) => { setBank(String(v)); setPicked(null) }} prefix="฿" placeholder="0.00" decimals={2} autoFocus />

          <div className="rounded-2xl bg-surface-muted/70 p-4 text-sm">
            <div className="flex justify-between gap-3 py-0.5">
              <span className="text-ink-muted">Logged for this bill</span>
              <span className="font-semibold text-ink tnum">{thb(appTotal, true)}</span>
            </div>
            <div className="flex justify-between gap-3 py-0.5">
              <span className="text-ink-muted">Bank's bill</span>
              <span className="font-semibold text-ink tnum">{hasBank ? thb(bankNum, true) : '—'}</span>
            </div>
            <div className="mt-1.5 flex justify-between gap-3 border-t border-line pt-1.5">
              <span className="font-bold text-ink">Difference</span>
              <span className={`font-bold tnum ${!hasBank ? 'text-ink-muted' : matched ? 'text-gain-ink' : 'text-warn-ink'}`}>
                {!hasBank ? '—' : matched ? thb(0, true) : `${gap > 0 ? '+' : '−'}${thb(Math.abs(gap), true)}`}
              </span>
            </div>
          </div>

          {matched && (
            <div className="flex items-center gap-3 rounded-2xl bg-gain-soft p-4">
              <CheckCircleIcon className="h-6 w-6 shrink-0 text-gain-ink" />
              <span>
                <span className="block text-sm font-bold text-gain-ink">Matches the bank</span>
                <span className="block text-xs text-gain-ink">Nothing to fix on this bill.</span>
              </span>
            </div>
          )}

          {hasBank && gap > 0.005 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-ink">
                {suggested && picked === null
                  ? `${suggested.length === 1 ? 'This charge adds' : `These ${suggested.length} charges add`} up to exactly ${thb(gap, true)}. The bank will bill ${suggested.length === 1 ? 'it' : 'them'} next time.`
                  : 'Tick the charges that aren\'t on the bank\'s bill.'}
              </p>
              <ul className="divide-y divide-line">
                {onBill.map((t) => {
                  const on = selected.has(t.id)
                  const cat = getCategory(t.categoryId)
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        onClick={() => toggle(t.id)}
                        className="flex w-full items-center gap-3 py-2.5 text-left cursor-pointer"
                      >
                        <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${on ? 'border-brand bg-brand text-white' : 'border-line-strong'}`}>
                          {on && <CheckIcon className="h-3.5 w-3.5" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-ink">{noteTitle(t.note) || t.subcategory || cat?.label}</span>
                          <span className="block text-xs text-ink-muted">{short(t.date)}</span>
                        </span>
                        <span className={`shrink-0 text-sm font-bold tnum ${t.type === 'income' ? 'text-gain-ink' : 'text-ink'}`}>
                          {t.type === 'income' ? '−' : ''}
                          {thb(t.amount, true)}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              {selected.size > 0 && Math.abs(left) >= 0.005 && (
                <p className="text-xs text-ink-muted">
                  {thb(Math.abs(left), true)} {left > 0 ? 'still unexplained' : 'more than the difference'} after moving these.
                </p>
              )}
              <Button className="w-full" onClick={moveSelected} disabled={selected.size === 0}>
                {selected.size === 0
                  ? 'Tick the charges to move'
                  : `Move ${selected.size === 1 ? '1 charge' : `${selected.size} charges`} to the ${short(bill.nextStatement)} bill`}
              </Button>
            </div>
          )}

          {hasBank && gap < -0.005 && (
            <div className="space-y-3">
              <p className="text-sm text-ink-soft">
                The bank billed <span className="font-semibold text-ink tnum">{thb(-gap, true)}</span> more. Usually fees, interest, a foreign-exchange
                charge, or something you haven't logged.
              </p>
              <Button className="w-full" onClick={addFees}>
                Add {thb(-gap, true)} as fees on this bill
              </Button>
              <Button variant="secondary" className="w-full" onClick={logMissing}>
                Log a missing charge
              </Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

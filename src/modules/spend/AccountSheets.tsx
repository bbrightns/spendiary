import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { FormActions } from '../../components/forms/FormActions'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { otherUsing, recurringUsing } from './accountRemoval'
import { RecurringImpact } from './RecurringImpact'
import { SwitchVisual } from '../../components/ui/SwitchVisual'
import { useToast } from '../../store/ToastContext'
import { localDateStr, thb } from '../../lib/format'
import type { CashAccount, SpendCard } from '../../lib/types'
import { accountTotals, cardCycle, unbilledOpening } from './logic'
import { CARD_COLORS, CARD_PALETTE, cardFace, inkOn } from './cardColor'
import { useSpend, type PayMethod } from './useSpend'
import { openQuickAdd } from './QuickAddSheet'
import { EditAccountModal } from '../../components/forms/EditCashAccountModal'
import { useData } from '../../store/DataContext'
import { FieldWrap } from '../../components/ui/Field'
import { fieldClass } from '../../components/ui/fieldClasses'

export function StarIcon({ filled, className = 'h-4 w-4' }: { filled?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round">
      <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
    </svg>
  )
}

/** The look of an on/off switch; the parent button carries role="switch". */
/** Favorite + default switches, shared by the card and wallet sheets. */
function QuickAddPrefs({ id }: { id: string }) {
  const { settings, toggleFavorite, setDefaultAccount } = useSpend()
  const fav = (settings.favoriteAccountIds ?? []).includes(id)
  const isDefault = settings.defaultAccountId === id
  const row = 'flex w-full items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3 text-left cursor-pointer hover:bg-surface-muted/50'
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-ink-soft">Quick add</p>
      <button type="button" role="switch" aria-checked={fav} onClick={() => toggleFavorite(id)} className={row}>
        <span>
          <span className="flex items-center gap-1.5 text-sm font-bold text-ink">
            <StarIcon filled={fav} className="h-4 w-4 text-warn-ink" /> Favorite
          </span>
          <span className="block text-xs text-ink-muted">Show as a one-tap choice</span>
        </span>
        <SwitchVisual on={fav} />
      </button>
      <button type="button" role="switch" aria-checked={isDefault} onClick={() => setDefaultAccount(isDefault ? undefined : id)} className={row}>
        <span>
          <span className="block text-sm font-bold text-ink">Default</span>
          <span className="block text-xs text-ink-muted">Preselected when you add an expense</span>
        </span>
        <SwitchVisual on={isDefault} />
      </button>
    </div>
  )
}


const inputClass = `${fieldClass} tnum`

const digits = (v: string) => v.replace(/[^\d.,]/g, '')
const shortDay = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const num = (v: string) => Number(v.replace(/,/g, ''))

const RAINBOW = 'conic-gradient(#ef4444, #f59e0b, #eab308, #22c55e, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #ef4444)'
/** "1d4ed8" or "14d" (no #) → "#1d4ed8"; anything else → undefined */
function parseHex(v: string): string | undefined {
  if (/^[0-9a-f]{6}$/i.test(v)) return `#${v.toLowerCase()}`
  if (/^[0-9a-f]{3}$/i.test(v)) return `#${[...v.toLowerCase()].map((c) => c + c).join('')}`
}

interface CardSheetProps {
  open: boolean
  /** Card to edit; omit to add a new one */
  card?: SpendCard
  onClose: () => void
}

export function CardSheet({ open, card, onClose }: CardSheetProps) {
  const { cards, recurring, upsertCard, removeCard } = useSpend()
  // Asking first: recurring items pay with this card
  const [confirmDelete, setConfirmDelete] = useState(false)
  const uses = card ? recurringUsing(recurring, card.id) : []
  const toPause = uses.filter((u) => !u.rec.paused).length
  const { data } = useData()
  // Loans paid with this card
  const others = card ? otherUsing(data, card.id) : []
  const { showToast } = useToast()
  const [form, setForm] = useState({ name: '', last4: '', limit: '', owed: '', unbilled: '', statementDay: '25', dueDay: '10', minPct: '8', color: CARD_COLORS[0] })
  // Main card whose limit this one shares ('' = its own limit)
  const [shareWith, setShareWith] = useState('')
  const [inNetWorth, setInNetWorth] = useState(true)
  // What's typed in the hex field while editing (null = show the current color)
  const [hexDraft, setHexDraft] = useState<string | null>(null)
  const customColor = !CARD_COLORS.includes(form.color)
  const [lastOpen, setLastOpen] = useState(false)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) setHexDraft(null)
    if (open) setInNetWorth(!card?.excludeFromNetWorth)
    if (open) setShareWith(card?.sharedLimitWith ?? '')
    if (open)
      setForm(
        card
          ? {
              name: card.name,
              last4: card.last4 ?? '',
              limit: String(card.creditLimit),
              owed: String(card.balance),
              // Only while it's still this cycle's; once its statement closed it's just billed
              unbilled: unbilledOpening(card, cardCycle(card).lastStatement) ? String(card.unbilled!.amount) : '',
              statementDay: String(card.statementDay),
              dueDay: String(card.dueDay),
              minPct: String(card.minPaymentPercent ?? 8),
              color: card.color ?? CARD_COLORS[0],
            }
          : { name: '', last4: '', limit: '', owed: '0', unbilled: '', statementDay: '25', dueDay: '10', minPct: '8', color: CARD_COLORS[(Math.random() * CARD_COLORS.length) | 0] },
      )
  }

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }))
  const dayOk = (v: string) => Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 31
  const pctOk = num(form.minPct) > 0 && num(form.minPct) <= 100
  // Only main cards can be shared with, and a card others share can't share someone else's
  const mains = cards.filter((c) => c.id !== card?.id && !c.sharedLimitWith)
  const sharers = card ? cards.filter((c) => c.sharedLimitWith === card.id) : []
  const main = mains.find((c) => c.id === shareWith)
  // Owed now = billed (on the last statement) + not billed yet (this cycle, due after the next one)
  const owedNum = num(form.owed || '0')
  // Hidden (and ignored) while nothing is owed, so a leftover value can't block saving
  const unbilledNum = owedNum > 0 ? num(form.unbilled || '0') : 0
  const unbilledOk = Number.isFinite(unbilledNum) && unbilledNum >= 0 && unbilledNum <= Math.max(0, owedNum)
  const cyc = dayOk(form.statementDay) && dayOk(form.dueDay) ? cardCycle({ statementDay: Number(form.statementDay), dueDay: Number(form.dueDay) }) : null
  const canSave =
    form.name.trim() !== '' &&
    (!!main || num(form.limit) > 0) &&
    Number.isFinite(owedNum) &&
    unbilledOk &&
    dayOk(form.statementDay) &&
    dayOk(form.dueDay) &&
    pctOk
  // What's still missing, shown above a disabled save button
  const saveHint = !form.name.trim()
    ? 'Name the card'
    : !main && !(num(form.limit) > 0)
      ? 'Enter the credit limit'
      : !dayOk(form.statementDay) || !dayOk(form.dueDay)
        ? 'Pick statement and due days from 1 to 31'
        : 'Check the amounts'

  const save = () => {
    upsertCard({
      id: card?.id,
      name: form.name.trim(),
      last4: form.last4.trim() || undefined,
      color: form.color,
      // A shared card keeps a limit of its own for if it's ever unlinked
      creditLimit: num(form.limit) > 0 ? num(form.limit) : main?.creditLimit ?? 0,
      sharedLimitWith: main?.id,
      balance: owedNum,
      unbilled: unbilledNum > 0 && cyc ? { amount: unbilledNum, statement: cyc.nextStatement } : undefined,
      statementDay: Number(form.statementDay),
      excludeFromNetWorth: inNetWorth ? undefined : true,
      dueDay: Number(form.dueDay),
      minPaymentPercent: num(form.minPct) === 8 ? undefined : num(form.minPct),
    })
    showToast(card ? 'Card updated' : 'Card added')
    onClose()
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={card ? 'Edit card' : 'Add credit card'}
        size="md"
        footer={
          <FormActions
            hint={saveHint}
            editing={!!card}
            canSave={canSave}
            onSave={save}
            onDelete={() => {
              if (!card) return
              if (uses.length > 0 || others.length > 0) return setConfirmDelete(true)
              removeCard(card.id)
              showToast('Card removed', 'info')
              onClose()
            }}
          />
        }
      >
        <div className="space-y-4">
          {card && <AccountHistory id={card.id} name={card.name} card />}
          <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-3">
            <FieldWrap label="Card name">
              <input className={inputClass} value={form.name} onChange={(e) => set('name')(e.target.value)} placeholder="KBank Platinum" />
            </FieldWrap>
            <FieldWrap label="Last 4">
              <input
                className={inputClass}
                inputMode="numeric"
                maxLength={4}
                value={form.last4}
                onChange={(e) => set('last4')(e.target.value.replace(/\D/g, ''))}
                placeholder="1234"
              />
            </FieldWrap>
          </div>

          {sharers.length > 0 ? (
            <p className="rounded-xl bg-surface-muted/70 px-3.5 py-2.5 text-xs text-ink-muted">
              {sharers.map((c) => c.name).join(', ')} {sharers.length === 1 ? 'shares' : 'share'} this card's limit.
            </p>
          ) : (
            mains.length > 0 && (
              <FieldWrap label="Credit limit from" hint="วงเงินร่วม">
                <select className={inputClass} value={shareWith} onChange={(e) => setShareWith(e.target.value)}>
                  <option value="">Its own limit</option>
                  {mains.map((c) => (
                    <option key={c.id} value={c.id}>
                      Shared with {c.name}
                    </option>
                  ))}
                </select>
              </FieldWrap>
            )
          )}

          {/* Bottom-aligned: a label whose hint wraps can't push its input out of line */}
          <div className="grid grid-cols-2 items-end gap-3">
            {main ? (
              <FieldWrap label="Credit limit" hint="shared">
                <div className={`${inputClass} flex items-center truncate bg-surface-muted/60 text-ink-muted`}>{thb(main.creditLimit)}</div>
              </FieldWrap>
            ) : (
              <FieldWrap label="Credit limit">
                <input className={inputClass} inputMode="decimal" value={form.limit} onChange={(e) => set('limit')(digits(e.target.value))} placeholder="100,000" />
              </FieldWrap>
            )}
            <FieldWrap label="Owed now">
              <input className={inputClass} inputMode="decimal" value={form.owed} onChange={(e) => set('owed')(digits(e.target.value))} placeholder="0" />
            </FieldWrap>
          </div>

          {/* Split what's owed: the billed part is due on the last statement; the rest waits for the next one */}
          {owedNum > 0 && (
            <div className="rounded-2xl bg-surface-muted p-4">
              <FieldWrap label="Not billed yet" hint="this cycle · ยังไม่ตัดรอบ">
                <input className={inputClass} inputMode="decimal" value={form.unbilled} onChange={(e) => set('unbilled')(digits(e.target.value))} placeholder="0" />
              </FieldWrap>
              {!unbilledOk ? (
                <p className="mt-2 text-xs font-semibold text-loss-ink">Can't be more than what's owed ({thb(owedNum, true)}).</p>
              ) : (
                cyc && (
                  <ul className="mt-2 space-y-0.5 text-xs text-ink-muted tnum">
                    <li>
                      Billed <span className="font-semibold text-ink-soft">{thb(owedNum - unbilledNum, true)}</span> · on the {shortDay(cyc.lastStatement)} statement, due{' '}
                      {shortDay(cyc.lastStatementDue)}
                      {owedNum - unbilledNum > 0 && cyc.lastStatementDue < localDateStr() && <span className="font-semibold text-loss-ink"> · already past, shows as overdue</span>}
                    </li>
                    <li>
                      This cycle <span className="font-semibold text-ink-soft">{thb(unbilledNum, true)}</span> · on the {shortDay(cyc.nextStatement)} statement, due{' '}
                      {shortDay(cyc.nextStatementDue)}
                    </li>
                  </ul>
                )
              )}
            </div>
          )}

          {/* Bottom-aligned: a label whose hint wraps can't push its input out of line */}
          <div className="grid grid-cols-2 items-end gap-3">
            <FieldWrap label="Statement day" hint="วันตัดรอบ">
              <input className={inputClass} inputMode="numeric" maxLength={2} value={form.statementDay} onChange={(e) => set('statementDay')(e.target.value.replace(/\D/g, ''))} />
            </FieldWrap>
            <FieldWrap label="Due day" hint="วันจ่าย">
              <input className={inputClass} inputMode="numeric" maxLength={2} value={form.dueDay} onChange={(e) => set('dueDay')(e.target.value.replace(/\D/g, ''))} />
            </FieldWrap>
          </div>
          {(!dayOk(form.statementDay) || !dayOk(form.dueDay)) && <p className="text-xs font-semibold text-loss-ink">Days go from 1 to 31.</p>}

          <FieldWrap label="Minimum payment" hint="% of the bill · ขั้นต่ำ">
            <div className="relative">
              <input className={`${inputClass} pr-9`} inputMode="decimal" value={form.minPct} onChange={(e) => set('minPct')(digits(e.target.value))} />
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-muted">%</span>
            </div>
          </FieldWrap>

          <div>
            <p className="mb-2 text-sm font-semibold text-ink-soft">Color</p>
            {/* Live preview: the card face as it shows in the stack */}
            <div
              className={`mb-3 flex h-14 items-center gap-3 rounded-xl px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] ${inkOn(form.color).text}`}
              style={{ background: cardFace(form.color) }}
            >
              <span className="min-w-0 flex-1 truncate text-sm font-bold">{form.name.trim() || 'Card name'}</span>
              <span className={`shrink-0 text-xs tnum ${inkOn(form.color).soft}`}>•••• {form.last4 || '0000'}</span>
            </div>
            <div className="space-y-2.5">
              {CARD_PALETTE.map((group) => (
                <div key={group.name} role="group" aria-label={group.name} className="grid w-fit grid-cols-8 gap-2">
                  {group.colors.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      title={c.name}
                      aria-label={c.name}
                      aria-pressed={form.color === c.hex}
                      onClick={() => set('color')(c.hex)}
                      className={`h-8 w-8 rounded-full ring-1 ring-inset ring-black/10 dark:ring-white/20 transition-transform cursor-pointer ${
                        form.color === c.hex ? 'scale-110 ring-2 ring-brand ring-offset-2 ring-offset-surface' : 'hover:scale-105'
                      }`}
                      style={{ background: c.hex }}
                    />
                  ))}
                </div>
              ))}
              {/* Any other color: type a hex code; it applies once it's a full #RGB or #RRGGBB */}
              <div className="flex items-center gap-2.5">
                <span
                  aria-hidden
                  className={`h-8 w-8 shrink-0 rounded-full ring-1 ring-inset ring-black/10 dark:ring-white/20 ${customColor ? 'scale-110 ring-2 ring-brand ring-offset-2 ring-offset-surface' : ''}`}
                  style={{ background: customColor ? form.color : RAINBOW }}
                />
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">#</span>
                  <input
                    value={hexDraft ?? (customColor ? form.color.slice(1).toUpperCase() : '')}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^0-9a-f]/gi, '').slice(0, 6)
                      setHexDraft(v)
                      const hex = parseHex(v)
                      if (hex) set('color')(hex)
                    }}
                    onBlur={() => setHexDraft(null)}
                    placeholder="Custom hex"
                    aria-label="Custom color, hex code"
                    autoComplete="off"
                    spellCheck={false}
                    className="h-9 w-36 rounded-xl border border-line-strong bg-surface-muted focus:bg-surface pl-7 pr-3 font-mono text-base uppercase text-ink outline-none transition-colors placeholder:font-sans placeholder:normal-case placeholder:text-sm placeholder:text-ink-faint focus:border-brand focus:ring-2 focus:ring-brand/15"
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={inNetWorth}
            onClick={() => setInNetWorth((v) => !v)}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3 text-left cursor-pointer hover:bg-surface-muted/50"
          >
            <span>
              <span className="block text-sm font-bold text-ink">Count in net worth</span>
              <span className="block text-xs text-ink-muted">Turn off if this card is already in Debts, so it isn't counted twice</span>
            </span>
            <SwitchVisual on={inNetWorth} />
          </button>

          {card && <QuickAddPrefs id={card.id} />}
        </div>
      </Modal>
      {card && (
        <ConfirmModal
          open={open && confirmDelete}
          title="Delete this card?"
          description={`"${card.name}" will be removed from your cards.`}
          confirmText={toPause > 0 ? `Delete and pause ${toPause}` : 'Delete card'}
          onConfirm={() => {
            setConfirmDelete(false)
            removeCard(card.id)
            showToast(`Card removed${toPause > 0 ? ` · ${toPause} recurring paused` : ''}`, 'info')
            onClose()
          }}
          onClose={() => setConfirmDelete(false)}
        >
          <RecurringImpact uses={uses} others={others} name={card.name} />
        </ConfirmModal>
      )}
    </>
  )
}

export function WalletSheet({ wallet, onClose }: { wallet?: PayMethod; onClose: () => void }) {
  const { data, setCashAccounts } = useData()
  const { showToast } = useToast()
  // Editing happens here, in Spend, with the same form Cash & Liquidity uses
  const [editing, setEditing] = useState<CashAccount | null>(null)
  const account = wallet && (data.cashAccounts ?? []).find((a) => a.id === wallet.id)
  return (
    <>
      <Modal open={!!wallet} onClose={onClose} title={wallet?.name ?? 'Wallet'} description={wallet ? `Balance ${thb(wallet.balance, true)}` : undefined} size="sm">
        {wallet && (
          <div className="space-y-5">
            {/* Log straight from this wallet; the sheet closes and Quick add opens with it picked */}
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { type: 'expense', label: 'Spend' },
                  { type: 'income', label: 'Income' },
                  { type: 'transfer', label: 'Transfer' },
                ] as const
              ).map((a) => (
                <Button
                  key={a.type}
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    onClose()
                    openQuickAdd({ draft: { type: a.type, accountId: wallet.id } })
                  }}
                >
                  {a.label}
                </Button>
              ))}
            </div>
            <AccountHistory id={wallet.id} name={wallet.name} />
            <QuickAddPrefs id={wallet.id} />
            {account && (
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() => {
                  onClose()
                  setEditing(account)
                }}
              >
                Edit wallet
              </Button>
            )}
          </div>
        )}
      </Modal>
      {editing && (
        <EditAccountModal
          open
          initialAccount={editing}
          onClose={() => setEditing(null)}
          onSave={(saved) => {
            setCashAccounts((data.cashAccounts ?? []).map((a) => (a.id === saved.id ? saved : a)))
            setEditing(null)
            showToast(`Saved "${saved.name}"`, 'success')
          }}
        />
      )}
    </>
  )
}

/** All-time totals for one wallet or card, with a jump to its transactions. */
function AccountHistory({ id, name, card }: { id: string; name: string; card?: boolean }) {
  const { transactions } = useSpend()
  const navigate = useNavigate()
  const t = useMemo(() => accountTotals(transactions, id), [transactions, id])
  const since = t.since
    ? new Date(`${t.since}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : undefined
  const tile = 'min-w-0 rounded-xl bg-surface-muted/70 px-2.5 py-2'
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-ink-soft">All history</p>
        <p className="text-xs text-ink-muted tnum">
          {t.count === 0 ? 'Nothing logged yet' : `${t.count} ${t.count === 1 ? 'transaction' : 'transactions'}${since ? ` since ${since}` : ''}`}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className={tile}>
          <p className="text-ink-muted">Spent</p>
          <p className="truncate font-bold text-ink tnum">{thb(t.spent, true)}</p>
        </div>
        <div className={tile}>
          <p className="text-ink-muted">{card ? 'Refunds' : 'Income'}</p>
          <p className="truncate font-bold text-gain-ink tnum">{thb(t.income, true)}</p>
        </div>
        <div className={tile}>
          <p className="text-ink-muted">Net</p>
          <p className={`truncate font-bold tnum ${t.net < 0 ? 'text-loss-ink' : 'text-ink'}`}>
            {t.net < 0 ? '−' : t.net > 0 ? '+' : ''}
            {thb(Math.abs(t.net), true)}
          </p>
        </div>
      </div>
      {t.transferIn + t.transferOut > 0 && (
        <p className="mt-2 text-xs text-ink-muted tnum">
          {card ? 'Bill payments' : 'Transfers'}
          {t.transferIn > 0 && <span className="text-gain-ink"> +{thb(t.transferIn, true)}</span>}
          {t.transferIn > 0 && t.transferOut > 0 && ' ·'}
          {t.transferOut > 0 && <> −{thb(t.transferOut, true)}</>}
        </p>
      )}
      {t.count > 0 && (
        <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={() => navigate(`/spend/txns?q=${encodeURIComponent(name.toLowerCase())}`)}>
          See transactions
        </Button>
      )}
    </div>
  )
}

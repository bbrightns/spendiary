import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { FormActions } from './FormActions'
import { fieldClass } from '../ui/fieldClasses'
import type { CashAccount, CashAccountCategory, CashPayoutSchedule } from '../../lib/types'
import { CASH_CATEGORIES, getCashCategory, inferCashCategory } from '../../lib/calc'
import { ListIcon } from '../icons'
import { SwitchVisual } from '../ui/SwitchVisual'

const THAI_MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

function formatWithCommas(value: string | number): string {
  const s = String(value)
  const clean = s.replace(/[^0-9.]/g, '')
  const parts = clean.split('.')
  if (parts.length > 2) {
    return parts[0] + '.' + parts.slice(1).join('')
  }
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  if (parts.length > 1) {
    return `${integerPart}.${parts[1].slice(0, 2)}`
  }
  return integerPart
}

/** Like formatWithCommas, but keeps a leading minus (a wallet can be overdrawn). */
function formatSigned(value: string): string {
  return (value.trimStart().startsWith('-') ? '-' : '') + formatWithCommas(value)
}

/** "-3,158.52" → -3158.52; blank → 0 */
function parseSigned(value: string): number {
  const n = Number(value.replace(/[^0-9.]/g, '')) || 0
  return value.trimStart().startsWith('-') && n ? -n : n
}

/** Add or edit a cash account; shared by Cash & Liquidity and Spend's wallet sheet. */
interface EditAccountModalProps {
  open: boolean
  initialAccount: CashAccount
  onClose: () => void
  onSave: (acc: CashAccount) => void
  /** Existing accounts only: ask to delete it */
  onDelete?: () => void
  /** THB accounts only: open its transactions in Spend */
  onShowTxns?: () => void
}

const labelCls = 'mb-1.5 block text-sm font-semibold text-ink-soft'
/** The shared field look, minus its padding: several fields here hold a prefix or suffix inside the box */
const fieldCls = fieldClass.replace(' px-3.5', '')

export function EditAccountModal({ open, initialAccount, onClose, onSave, onDelete, onShowTxns }: EditAccountModalProps) {
  const [name, setName] = useState(initialAccount.name)
  const [balance, setBalance] = useState(initialAccount.balance ? String(initialAccount.balance) : '')
  const [currency, setCurrency] = useState<'THB' | 'USD'>(initialAccount.currency ?? 'THB')
  const [category, setCategory] = useState<CashAccountCategory>(initialAccount.category ? getCashCategory(initialAccount) : 'spending')
  const [interestRate, setInterestRate] = useState(initialAccount.interestRate ? String(initialAccount.interestRate) : '')
  const [maxEligibleBalance, setMaxEligibleBalance] = useState(
    initialAccount.maxEligibleBalance ? String(initialAccount.maxEligibleBalance) : ''
  )
  const [payoutSchedule, setPayoutSchedule] = useState<CashPayoutSchedule>(initialAccount.payoutSchedule ?? 'monthly')
  const [payoutMonths, setPayoutMonths] = useState<number[]>(
    initialAccount.payoutMonths && initialAccount.payoutMonths.length > 0
      ? initialAccount.payoutMonths
      : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
  )
  // Most accounts pay nothing, so the interest fields stay folded away until switched on
  const [earnsInterest, setEarnsInterest] = useState(Boolean(initialAccount.interestRate))

  const num = (v: string) => Number(v.replace(/[^0-9.]/g, '')) || 0
  const yearlyInterest = (() => {
    const cap = num(maxEligibleBalance)
    // Nothing earns interest while overdrawn
    const bal = Math.max(0, parseSigned(balance))
    const eligible = cap > 0 ? Math.min(bal, cap) : bal
    return (eligible * num(interestRate)) / 100
  })()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    save()
  }

  const save = () => {
    if (!name.trim()) return

    const balNum = parseSigned(balance)
    const rateClean = interestRate.replace(/[^0-9.]/g, '')
    const rateNum = rateClean !== '' ? Number(rateClean) : undefined
    const capClean = maxEligibleBalance.replace(/[^0-9.]/g, '')
    const capNum = capClean !== '' ? Number(capClean) : undefined

    onSave({
      id: initialAccount.id,
      name: name.trim(),
      balance: balNum,
      currency,
      category,
      // Switched off = no interest at all, whatever was typed before
      interestRate: earnsInterest && rateNum && rateNum > 0 ? rateNum : undefined,
      maxEligibleBalance: earnsInterest && capNum && capNum > 0 ? capNum : undefined,
      payoutSchedule: earnsInterest ? payoutSchedule : undefined,
      payoutMonths: earnsInterest && payoutMonths.length > 0 ? payoutMonths : undefined,
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialAccount.name ? 'Edit account' : 'Add account'}
      size="md"
      footer={
        <FormActions
          editing={Boolean(initialAccount.name)}
          canSave={name.trim() !== ''}
          onSave={save}
          onDelete={onDelete}
          hint="Give the account a name"
        />
      }
    >
      <form id="account-edit-form" onSubmit={handleSubmit} className="space-y-4 pt-1">
        {onShowTxns && (
          <button
            type="button"
            onClick={onShowTxns}
            className="flex w-full items-center gap-2.5 rounded-xl border border-line px-3 py-2.5 text-left text-sm font-semibold text-ink transition-colors cursor-pointer hover:bg-surface-muted/60"
          >
            <ListIcon className="h-4 w-4 text-ink-muted" />
            <span className="flex-1">See transactions in Spend</span>
            <span className="text-ink-muted" aria-hidden>→</span>
          </button>
        )}
        {/* Name */}
        <label className="block">
          <span className={labelCls}>Name</span>
          <input
            type="text"
            required
            placeholder="KBank, Kept, Savings co-op…"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (category === 'spending') {
                setCategory(inferCashCategory(e.target.value))
              }
            }}
            className={`${fieldCls} px-3.5`}
          />
        </label>

        {/* Balance, with the currency as a toggle inside the field */}
        <div>
          <label htmlFor="account-balance" className={labelCls}>
            Balance
          </label>
          <div className={`${fieldCls} flex items-center focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15`}>
            <span className="pl-3.5 text-base font-bold text-ink-muted">{currency === 'USD' ? '$' : '฿'}</span>
            <input
              id="account-balance"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={formatSigned(balance)}
              onChange={(e) => setBalance(e.target.value)}
              className="min-w-0 flex-1 bg-transparent px-2 text-base font-bold tnum text-ink outline-none"
            />
            <div className="mr-1 flex shrink-0 rounded-lg bg-surface-muted p-0.5" role="group" aria-label="Currency">
              {(['THB', 'USD'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={currency === c}
                  onClick={() => setCurrency(c)}
                  className={`h-8 rounded-md px-2.5 text-xs font-bold transition-colors cursor-pointer ${
                    currency === c ? 'bg-surface text-ink shadow-xs' : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Type */}
        <div>
          <span className={labelCls}>Type</span>
          <div className="grid grid-cols-2 gap-2">
            {(['spending', 'locked'] as CashAccountCategory[]).map((catKey) => {
              const meta = CASH_CATEGORIES[catKey]
              const active = category === catKey
              return (
                <button
                  key={catKey}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCategory(catKey)}
                  className={`rounded-xl border px-3 py-2.5 text-left transition-colors cursor-pointer ${
                    active ? 'border-brand bg-brand-soft' : 'border-line hover:bg-surface-muted/60'
                  }`}
                >
                  <span className={`block text-sm font-bold ${active ? 'text-brand-ink' : 'text-ink'}`}>
                    {meta.icon} {meta.labelTh}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-ink-muted">
                    {catKey === 'spending' ? 'Free to spend or invest' : 'Co-op, PVD, fixed deposits'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Interest: off by default, details only when switched on */}
        <div className={`rounded-2xl border transition-colors ${earnsInterest ? 'border-line bg-surface-muted/30' : 'border-line'}`}>
          <button
            type="button"
            role="switch"
            aria-checked={earnsInterest}
            onClick={() => setEarnsInterest((v) => !v)}
            className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left cursor-pointer"
          >
            <span>
              <span className="block text-sm font-bold text-ink">Earns interest</span>
              <span className="block text-xs text-ink-muted tnum">
                {earnsInterest
                  ? yearlyInterest > 0
                    ? `≈ ${currency === 'USD' ? '$' : '฿'}${yearlyInterest.toLocaleString('en-US', { maximumFractionDigits: 0 })} a year`
                    : 'Enter the rate below'
                  : 'Off'}
              </span>
            </span>
            <SwitchVisual on={earnsInterest} />
          </button>

          {earnsInterest && (
            <div className="space-y-3 border-t border-line px-3.5 pb-3.5 pt-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className={labelCls}>Rate</span>
                  <div className={`${fieldCls} flex items-center focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15`}>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="2.22"
                      value={interestRate}
                      onChange={(e) => setInterestRate(e.target.value)}
                      className="min-w-0 flex-1 bg-transparent pl-3.5 text-base font-bold tnum text-ink outline-none"
                    />
                    <span className="pr-3 text-xs font-semibold text-ink-muted">% / yr</span>
                  </div>
                </label>
                <label className="block">
                  <span className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-ink-soft">Up to</span>
                    <span className="text-xs text-ink-muted">optional</span>
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="No cap"
                    value={formatWithCommas(maxEligibleBalance)}
                    onChange={(e) => setMaxEligibleBalance(e.target.value)}
                    title="Interest is only paid on up to this amount"
                    className={`${fieldCls} px-3.5`}
                  />
                </label>
              </div>

              <div>
                <span className={labelCls}>Paid</span>
                <div className="grid grid-cols-4 gap-1 rounded-xl bg-surface-muted p-1 text-xs">
                  {[
                    { key: 'monthly', label: 'Monthly' },
                    { key: 'semi_annual', label: '2× a year' },
                    { key: 'annual', label: 'Yearly' },
                    { key: 'custom', label: 'Custom' },
                  ].map((sch) => (
                    <button
                      key={sch.key}
                      type="button"
                      aria-pressed={payoutSchedule === sch.key}
                      onClick={() => {
                        setPayoutSchedule(sch.key as CashPayoutSchedule)
                        if (sch.key === 'monthly') setPayoutMonths([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
                        if (sch.key === 'semi_annual') setPayoutMonths([6, 12])
                        if (sch.key === 'annual') setPayoutMonths([2])
                      }}
                      className={`h-8 rounded-lg font-semibold transition-colors cursor-pointer ${
                        payoutSchedule === sch.key ? 'bg-surface text-ink shadow-xs' : 'text-ink-muted hover:text-ink'
                      }`}
                    >
                      {sch.label}
                    </button>
                  ))}
                </div>
              </div>

              {payoutSchedule === 'custom' && (
                <div className="space-y-1.5">
                  <span className="block text-xs text-ink-muted">Tap the months it's paid</span>
                  <div className="grid grid-cols-6 gap-1 text-xs">
                    {THAI_MONTHS_SHORT.map((mName, idx) => {
                      const mNum = idx + 1
                      const isSelected = payoutMonths.includes(mNum)
                      return (
                        <button
                          key={mNum}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => {
                            const next = isSelected
                              ? payoutMonths.filter((m) => m !== mNum)
                              : [...payoutMonths, mNum].sort((x, y) => x - y)
                            setPayoutMonths(next)
                          }}
                          className={`h-8 rounded-lg font-bold transition-colors cursor-pointer border ${
                            isSelected ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-surface text-ink-muted border-line'
                          }`}
                        >
                          {mName}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </form>
    </Modal>
  )
}

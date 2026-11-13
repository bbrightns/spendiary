import { SelectField } from '../ui/Field'
import type { CashAccount } from '../../lib/types'
import { money } from '../../lib/format'

interface Props {
  label: string
  accounts: CashAccount[]
  /** Account id, or 'none' */
  value: string
  onChange: (id: string) => void
  /** 'pay': the money leaves the account (buy, add). 'deposit': it goes in (sell). */
  direction: 'pay' | 'deposit'
  /**
   * The trade's amount in the chosen account's currency (see amountInAccountCurrency).
   * 0 while nothing is typed yet; null when a USD account needs a rate that isn't known.
   */
  amount: number | null
  /** Shown under the picker once the form has been submitted with a problem */
  showErrors?: boolean
}

/**
 * Picks the cash account a trade pays from or deposits into, and says what will happen to it
 * in that account's own currency ("−$ 1,000.00 from USD wallet"), so a USD account never gets a THB amount.
 */
export function CashAccountField({ label, accounts, value, onChange, direction, amount, showErrors }: Props) {
  // Closed accounts stay out of the picker, unless one is already selected
  const listed = accounts.filter((c) => !c.archived || c.id === value)
  const options = [
    { value: 'none', label: direction === 'pay' ? 'None · Do not deduct from cash' : 'None · Do not deposit' },
    ...listed.map((c) => ({ value: c.id, label: `${c.name} (${money(c.balance, c.currency ?? 'THB', true)})` })),
  ]
  const account = value !== 'none' ? accounts.find((c) => c.id === value) : undefined
  const currency = account?.currency ?? 'THB'
  const error = account && amount === null && showErrors
    ? 'No USD/THB rate yet, so the amount for this USD account is unknown. Pick a THB account or try again once the rate loads.'
    : undefined

  return (
    <div className="space-y-1.5">
      <SelectField label={label} value={value} onChange={onChange} options={options} error={error} />
      {account && amount !== null && amount > 0 && (
        <p className="text-xs text-ink-muted">
          <span className="font-semibold tnum text-ink">
            {direction === 'pay' ? '−' : '+'}{money(amount, currency, true)}
          </span>
          {` ${direction === 'pay' ? 'from' : 'into'} ${account.name} · balance after `}
          <span className="tnum">{money(account.balance + (direction === 'pay' ? -amount : amount), currency, true)}</span>
        </p>
      )}
      {account && amount === null && !error && (
        <p className="text-xs text-warn">USD/THB rate not loaded yet: this USD account can't be charged until it is.</p>
      )}
    </div>
  )
}

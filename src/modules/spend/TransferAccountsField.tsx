import { SelectField } from '../../components/ui/Field'
import { ArrowDownIcon } from '../../components/icons'
import { money, thbSigned } from '../../lib/format'
import type { PayMethod } from './useSpend'
import { NOT_TRACKED } from './PayMethodPicker'

interface Props {
  /** Where the money can come from (wallets and cards) */
  fromMethods: PayMethod[]
  /** Where it can go (wallets, cards to pay their bill, USD accounts for an exchange) */
  toMethods: PayMethod[]
  from: string
  to: string
  onFromChange: (id: string) => void
  onToChange: (id: string) => void
  /** The amount being moved, for the "after" lines (0 = not typed yet) */
  amount: number
  /** A loan payment: the money goes to the loan, so there is no "to" account */
  toLoan?: boolean
}

const optionLabel = (m: PayMethod) =>
  m.kind === 'card'
    ? `${m.last4 ? `${m.name} •• ${m.last4}` : m.name} · ${thbSigned(m.balance, true)} owed`
    : m.currency === 'USD'
      ? `${m.name} · ${money(m.balance, 'USD', true)}`
      : `${m.name} · ${thbSigned(m.balance, true)}`

const options = (methods: PayMethod[], value: string, excludeId?: string) => [
  ...(value === NOT_TRACKED ? [{ value: NOT_TRACKED, label: 'Choose…' }] : []),
  ...methods.filter((m) => m.id !== excludeId && (!m.archived || m.id === value)).map((m) => ({ value: m.id, label: optionLabel(m) })),
]

/** A wallet's or card's balance after the move: a card's "balance" is what's owed, so paying it lowers it */
function after(m: PayMethod | undefined, delta: number): string | null {
  if (!m || !(Math.abs(delta) > 0)) return null
  if (m.currency === 'USD') return null
  return m.kind === 'card' ? `${thbSigned(m.balance - delta, true)} owed after` : `${thbSigned(m.balance + delta, true)} after`
}

/**
 * A transfer's two accounts as dropdowns, read top to bottom: From in a red tint (money leaves),
 * an arrow, To in a green tint (money arrives). The fields keep the shared look; only the boxes are tinted.
 */
export function TransferAccountsField({ fromMethods, toMethods, from, to, onFromChange, onToChange, amount, toLoan }: Props) {
  const fromM = fromMethods.find((m) => m.id === from)
  const toM = toMethods.find((m) => m.id === to)
  const fromAfter = after(fromM, -amount)
  const toAfter = after(toM, amount)

  return (
    <div className="flex flex-col">
      <div className="rounded-2xl bg-loss-soft p-3">
        <SelectField label="From · money out" value={from} onChange={onFromChange} options={options(fromMethods, from)} />
        {fromAfter && <p className="mt-1.5 text-xs font-semibold tnum text-loss-ink">{fromAfter}</p>}
      </div>

      {/* Sits across the gap between the two boxes, whatever their heights */}
      <div className="pointer-events-none relative z-10 mx-auto -my-2.5 grid h-8 w-8 place-items-center rounded-full border border-line bg-surface shadow-xs" aria-hidden>
        <ArrowDownIcon className="h-4 w-4 text-ink-muted" />
      </div>

      {toLoan ? (
        <div className="rounded-2xl bg-gain-soft p-3 text-xs text-gain-ink">
          Paid toward a loan. Change the loan itself in Loans & installments.
        </div>
      ) : (
        <div className="rounded-2xl bg-gain-soft p-3">
          <SelectField label="To · money in (a card here pays its bill)" value={to} onChange={onToChange} options={options(toMethods, to, from)} />
          {toAfter && <p className="mt-1.5 text-xs font-semibold tnum text-gain-ink">{toAfter}</p>}
        </div>
      )}
    </div>
  )
}

import { useNavigate } from 'react-router-dom'
import type { SpendTransaction } from '../../lib/types'
import { PortfolioIcon } from '../../components/icons'
import { thb } from '../../lib/format'
import { TransferIcon, getCategory } from './categories'
import { isInvested } from './invest'
import { noteTitle } from './logic'
import { openQuickAdd } from './QuickAddSheet'
import { TONES } from './tones'

interface Props {
  txn: SpendTransaction
  /** Wallets and cards, to name the payment method */
  methods: { id: string; name: string }[]
  /** Called when a #tag chip is tapped (e.g. to filter by it) */
  onTagClick?: (tag: string) => void
}

/** "2026-10-13" → "13 Oct" */
const shortDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function TxnRow({ txn, methods, onTagClick }: Props) {
  const navigate = useNavigate()
  const cat = getCategory(txn.categoryId)
  const invested = isInvested(txn)
  const Icon = invested ? PortfolioIcon : txn.type === 'transfer' ? TransferIcon : cat?.icon ?? TransferIcon
  const walletName = (id?: string) => methods.find((m) => m.id === id)?.name
  const from = walletName(txn.accountId)
  const title = noteTitle(txn.note) || (txn.type === 'transfer' ? 'Transfer' : cat?.label ?? 'Other')
  // Invest rows say where the money came from, or that no account was picked
  const paidFrom = from ? `from ${from}` : 'no account set'
  const meta = invested
    ? [txn.source === 'buy' ? 'Buy more' : 'DCA', txn.time, paidFrom].filter(Boolean).join(' · ')
    : txn.source === 'dca'
      ? `Savings DCA · ${from ?? 'no account set'} → ${walletName(txn.toAccountId) ?? '—'}`
      : txn.type === 'transfer'
      ? // A loan payment goes to the loan, not to another wallet
        `${from ?? '—'} → ${txn.liabilityId && !txn.toAccountId ? 'loan payment' : walletName(txn.toAccountId) ?? '—'}${txn.alreadyInBalance ? ' · already in balance' : ''}`
      : [
          cat?.label && txn.subcategory ? `${cat.label} › ${txn.subcategory}` : cat?.label,
          // A bill paid on another day than it was due says when it was due (early, so a long wallet name can't cut it off)
          txn.recurring && txn.recurring.date !== txn.date && `(due ${shortDate(txn.recurring.date)})`,
          txn.time,
          from,
          txn.alreadyInBalance && 'already in balance',
        ]
          .filter(Boolean)
          .join(' · ')

  const sign = txn.type === 'income' ? '+' : txn.type === 'expense' ? '−' : ''
  const amountClass = txn.type === 'income' ? 'text-gain' : txn.type === 'transfer' ? 'text-ink-muted' : 'text-ink'
  // Rows from Invest are edited where they came from: its history
  const sourcePage = txn.source ? '/logs' : null

  return (
    <div className="group py-3">
      <button
        type="button"
        onClick={() => (sourcePage ? navigate(sourcePage) : openQuickAdd({ editId: txn.id }))}
        className="flex w-full min-w-0 items-center gap-3 text-left cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        aria-label={sourcePage ? `${title}, ${sign}${thb(txn.amount, true)}, open in Invest` : `Edit ${title}, ${sign}${thb(txn.amount, true)}`}
      >
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
            invested ? TONES.indigo.chip : txn.type === 'transfer' ? TONES.sky.chip : TONES[cat?.tone ?? 'slate'].chip
          }`}
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-ink">{title}</span>
            {txn.source && (
              <span className={`shrink-0 rounded-full px-1.5 py-px text-2xs font-bold ${TONES.indigo.chip}`}>Invest</span>
            )}
          </span>
          <span className="block truncate text-xs text-ink-muted">{meta}</span>
        </span>
        <span className={`shrink-0 text-sm font-bold tnum ${amountClass}`}>
          {sign}
          {thb(txn.amount, true)}
        </span>
      </button>
      {(txn.tags?.length ?? 0) > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1 pl-[52px]">
          {txn.tags!.map((tag) =>
            onTagClick ? (
              <button
                key={tag}
                type="button"
                onClick={() => onTagClick(tag)}
                className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-ink cursor-pointer"
              >
                #{tag}
              </button>
            ) : (
              <span key={tag} className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-ink">
                #{tag}
              </span>
            ),
          )}
        </div>
      )}
    </div>
  )
}

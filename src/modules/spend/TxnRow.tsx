import type { CashAccount, SpendTransaction } from '../../lib/types'
import { thb } from '../../lib/format'
import { TransferIcon, getCategory } from './categories'
import { openQuickAdd } from './QuickAddSheet'

interface Props {
  txn: SpendTransaction
  wallets: CashAccount[]
  /** Called when a #tag chip is tapped (e.g. to filter by it) */
  onTagClick?: (tag: string) => void
}

/** Note text without its hashtags — the tags render as chips instead. */
function plainNote(note?: string): string {
  return (note ?? '').replace(/#[\p{L}\p{N}\p{M}_]+/gu, '').replace(/\s+/g, ' ').trim()
}

export function TxnRow({ txn, wallets, onTagClick }: Props) {
  const cat = getCategory(txn.categoryId)
  const Icon = txn.type === 'transfer' ? TransferIcon : cat?.icon ?? TransferIcon
  const walletName = (id?: string) => wallets.find((w) => w.id === id)?.name
  const from = walletName(txn.accountId)
  const title = plainNote(txn.note) || (txn.type === 'transfer' ? 'Transfer' : cat?.label ?? 'Other')
  const meta =
    txn.type === 'transfer'
      ? `${from ?? '—'} → ${walletName(txn.toAccountId) ?? '—'}`
      : [cat?.label, from].filter(Boolean).join(' · ')

  const sign = txn.type === 'income' ? '+' : txn.type === 'expense' ? '−' : ''
  const amountClass = txn.type === 'income' ? 'text-gain' : txn.type === 'transfer' ? 'text-ink-muted' : 'text-ink'

  return (
    <div className="group flex items-center gap-3 py-3">
      <button
        type="button"
        onClick={() => openQuickAdd({ editId: txn.id })}
        className="flex min-w-0 flex-1 items-center gap-3 text-left cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        aria-label={`Edit ${title}, ${sign}${thb(txn.amount)}`}
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-muted text-ink-soft">
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">{title}</span>
          <span className="block truncate text-xs text-ink-muted">
            {meta}
            {(txn.tags?.length ?? 0) > 0 && (
              <span className={`text-brand-ink ${onTagClick ? 'sm:hidden' : ''}`}> · {txn.tags!.map((t) => `#${t}`).join(' ')}</span>
            )}
          </span>
        </span>
        <span className={`shrink-0 text-sm font-bold tnum ${amountClass}`}>
          {sign}
          {thb(txn.amount)}
        </span>
      </button>
      {(txn.tags?.length ?? 0) > 0 && onTagClick && (
        <div className="hidden shrink-0 gap-1 sm:flex">
          {txn.tags!.slice(0, 2).map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onTagClick(tag)}
              className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-ink cursor-pointer"
            >
              #{tag}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

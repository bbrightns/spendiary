import { useNavigate } from 'react-router-dom'
import type { SpendTransaction } from '../../lib/types'
import { PortfolioIcon, ScaleIcon, UndoIcon } from '../../components/icons'
import { thb, thbSigned } from '../../lib/format'
import { TransferIcon, getCategory } from './categories'
import { isInvested } from './invest'
import { noteTitle, txnFlow } from './logic'
import { openQuickAdd } from './QuickAddSheet'
import { openAdjustment } from './AdjustmentSheet'
import { TONES } from './tones'
import { useData } from '../../store/DataContext'
import { accountLabel } from './accountRemoval'

interface Props {
  txn: SpendTransaction
  /** Wallets and cards, to name the payment method */
  methods: { id: string; name: string }[]
  /** Called when a #tag chip is tapped (e.g. to filter by it) */
  onTagClick?: (tag: string) => void
  /** Read from one account's side (its statement): transfers get a sign, and the balance after shows under the amount */
  account?: { id: string; card?: boolean; after?: number }
}

/** "2026-10-13" → "13 Oct" */
const shortDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function TxnRow({ txn, methods, onTagClick, account }: Props) {
  const navigate = useNavigate()
  const cat = getCategory(txn.categoryId)
  const invested = isInvested(txn)
  const Icon = invested ? PortfolioIcon : txn.adjustment ? ScaleIcon : txn.type === 'transfer' ? TransferIcon : cat?.icon ?? TransferIcon
  const removed = useData().data.spendSettings?.removedAccounts
  // A deleted wallet or card keeps its name on past rows ("KBank (deleted)")
  const walletName = (id?: string) => accountLabel(id, methods.find((m) => m.id === id)?.name, removed)
  const from = walletName(txn.accountId)
  // No note: the subcategory names it ("Snack"), then the category
  const noteName = noteTitle(txn.note)
  const title = noteName || (txn.type !== 'transfer' && txn.subcategory) || (txn.type === 'transfer' ? 'Transfer' : txn.paidBack ? 'Paid back' : cat?.label ?? 'Other')
  // Invest rows say where the money came from, or that no account was picked
  const paidFrom = from ? `from ${from}` : 'no account set'
  const meta = invested
    ? [txn.source === 'buy' ? 'Buy more' : 'DCA', txn.time, paidFrom].filter(Boolean).join(' · ')
    : txn.adjustment
      ? // A balance typed in on Edit wallet: no other side to name
        ['Typed in', txn.time, walletName(txn.toAccountId ?? txn.accountId)].filter(Boolean).join(' · ')
      : txn.source === 'dca'
      ? `Savings DCA · ${from ?? 'no account set'} → ${walletName(txn.toAccountId) ?? '—'}`
      : txn.type === 'transfer'
      ? // A loan payment goes to the loan, not to another wallet
        `${from ?? '—'} → ${txn.liabilityId && !txn.toAccountId ? 'loan payment' : walletName(txn.toAccountId) ?? '—'}${txn.alreadyInBalance ? ' · already in balance' : ''}`
      : [
          // The title already says the subcategory when there was no note
          cat?.label && txn.subcategory && noteName ? `${cat.label} › ${txn.subcategory}` : cat?.label,
          // Early in the line, so it's never the part a long wallet name cuts off
          txn.outsideBudget && 'outside budget',
          txn.paidBack && 'paid back',
          // A bill paid on another day than it was due says when it was due (early, so a long wallet name can't cut it off)
          txn.recurring && txn.recurring.date !== txn.date && `(due ${shortDate(txn.recurring.date)})`,
          txn.time,
          from,
          txn.alreadyInBalance && 'already in balance',
        ]
          .filter(Boolean)
          .join(' · ')

  // On a statement every row is money in or out of that account, transfers included; an adjustment
  // only has the one wallet, so it always reads from that side
  const side = account?.id ?? (txn.adjustment ? txn.toAccountId ?? txn.accountId : undefined)
  const flow = side ? txnFlow(txn, side) : undefined
  const sign = flow !== undefined ? (flow > 0 ? '+' : flow < 0 ? '−' : '') : txn.type === 'income' ? '+' : txn.type === 'expense' ? '−' : ''
  const amountClass =
    flow !== undefined ? (flow > 0 ? 'text-gain-ink' : 'text-ink') : txn.type === 'income' ? 'text-gain-ink' : txn.type === 'transfer' ? 'text-ink-muted' : 'text-ink'
  // Rows from Invest are edited where they came from: its history
  const sourcePage = txn.source ? '/logs' : null
  // The quick-add form has no one-sided transfer: a typed-in balance opens its undo instead
  const adjustment = !sourcePage && !!txn.adjustment

  return (
    <div className="group py-3">
      <button
        type="button"
        onClick={() => (sourcePage ? navigate(sourcePage) : adjustment ? openAdjustment(txn.id) : openQuickAdd({ editId: txn.id }))}
        className="flex w-full min-w-0 items-center gap-3 text-left cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        aria-label={
          sourcePage
            ? `${title}, ${sign}${thb(txn.amount, true)}, open in Invest`
            : adjustment
              ? `${title}, ${sign}${thb(txn.amount, true)}, undo`
              : `Edit ${title}, ${sign}${thb(txn.amount, true)}`
        }
      >
        <span className="relative shrink-0">
          <span
            className={`grid h-10 w-10 place-items-center rounded-xl ${
              invested ? TONES.indigo.chip : txn.type === 'transfer' ? TONES.sky.chip : TONES[cat?.tone ?? 'slate'].chip
            }`}
          >
            <Icon className="h-[18px] w-[18px]" />
          </span>
          {/* Money paid back gets a return-arrow badge, so it stands apart from the expense it pays back */}
          {txn.paidBack && (
            <span
              aria-hidden
              className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-gain-strong text-white ring-2 ring-surface"
            >
              <UndoIcon className="h-2.5 w-2.5" strokeWidth={3} />
            </span>
          )}
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
        <span className="shrink-0 text-right">
          <span className={`block text-sm font-bold tnum ${amountClass}`}>
            {sign}
            {thb(txn.amount, true)}
          </span>
          {account?.after !== undefined && (
            <span className="block text-xs text-ink-muted tnum">
              {account.card ? 'Owed' : 'Bal.'} {thbSigned(account.after, true)}
            </span>
          )}
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

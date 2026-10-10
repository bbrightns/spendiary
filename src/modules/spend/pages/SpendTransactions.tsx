import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../../components/layout/PageHeader'
import { Card } from '../../../components/ui/Card'
import { AddButton } from '../../../components/ui/AddButton'
import { EmptyState } from '../../../components/ui/EmptyState'
import { FilterChip } from '../../../components/ui/FilterChip'
import { CloseIcon, SearchIcon } from '../../../components/icons'
import { thb } from '../../../lib/format'
import type { SpendTransaction, SpendTxnType } from '../../../lib/types'
import { ListBulletIcon, getCategory } from '../categories'
import { monthKey, topTags } from '../logic'
import { MonthStepper } from '../MonthStepper'
import { openQuickAdd } from '../QuickAddSheet'
import { TxnRow } from '../TxnRow'
import { useSpend } from '../useSpend'

type TypeFilter = 'all' | SpendTxnType

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'expense', label: 'Expenses' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfers' },
]

/** Search terms starting with # must match a tag; anything else matches note, category or wallet. */
function matches(t: SpendTransaction, terms: string[], walletName: (id?: string) => string): boolean {
  if (terms.length === 0) return true
  const cat = getCategory(t.categoryId)
  const haystack = [t.note ?? '', cat?.label ?? '', ...(cat?.keywords ?? []), walletName(t.accountId), walletName(t.toAccountId)]
    .join(' ')
    .toLowerCase()
  return terms.every((term) =>
    term.startsWith('#') ? (t.tags ?? []).some((tag) => tag.startsWith(term.slice(1))) : haystack.includes(term),
  )
}

function dayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const today = new Date()
  const yesterday = new Date(Date.now() - 86_400_000)
  if (dt.toDateString() === today.toDateString()) return 'Today'
  if (dt.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function SpendTransactions() {
  const { transactions, wallets } = useSpend()
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const [month, setMonth] = useState(monthKey())
  const [type, setType] = useState<TypeFilter>('all')

  const setQuery = (q: string) => {
    const next = new URLSearchParams(params)
    if (q) next.set('q', q)
    else next.delete('q')
    setParams(next, { replace: true })
  }

  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  // A search looks across every month; browsing without one stays on the chosen month
  const searching = terms.length > 0

  const filtered = useMemo(() => {
    const walletName = (id?: string) => wallets.find((w) => w.id === id)?.name ?? ''
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    return transactions.filter(
      (t) => (words.length > 0 || t.date.startsWith(month)) && (type === 'all' || t.type === type) && matches(t, words, walletName),
    )
  }, [transactions, wallets, month, type, query])

  const groups = useMemo(() => {
    const map = new Map<string, SpendTransaction[]>()
    for (const t of filtered) map.set(t.date, [...(map.get(t.date) ?? []), t])
    return [...map.entries()]
  }, [filtered])

  const spent = filtered.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const earned = filtered.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const tags = useMemo(() => topTags(transactions, 10), [transactions])

  const toggleTag = (tag: string) => {
    const token = `#${tag}`
    setQuery(terms.includes(token) ? terms.filter((t) => t !== token).join(' ') : [...terms, token].join(' '))
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Spend"
        title="Transactions"
        subtitle={searching ? 'Searching all months' : <MonthStepper value={month} onChange={setMonth} />}
        action={
          // Phones use the + in the bottom bar
          <div className="hidden lg:block">
            <AddButton onClick={() => openQuickAdd()} label="Add" />
          </div>
        }
      />

      <Card className="space-y-3">
        <div className="flex h-11 items-center gap-2 rounded-xl border border-line-strong bg-surface px-3.5 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15">
          <SearchIcon className="h-4 w-4 shrink-0 text-ink-faint" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes, categories or #tags"
            aria-label="Search transactions"
            className="w-full bg-transparent text-base text-ink outline-none placeholder:text-ink-faint [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="text-ink-muted hover:text-ink cursor-pointer">
              <CloseIcon className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {TYPE_FILTERS.map((f) => (
            <FilterChip key={f.value} active={type === f.value} onClick={() => setType(f.value)}>
              {f.label}
            </FilterChip>
          ))}
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => {
              const active = terms.includes(`#${tag}`)
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleTag(tag)}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                    active ? 'bg-brand text-white' : 'bg-brand-soft text-brand-ink hover:bg-brand-soft/70'
                  }`}
                >
                  #{tag}
                </button>
              )
            })}
          </div>
        )}
      </Card>

      {filtered.length > 0 && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 px-1 text-sm text-ink-muted tnum">
          <span>
            {filtered.length} {filtered.length === 1 ? 'transaction' : 'transactions'}
          </span>
          {spent > 0 && (
            <span>
              Spent <b className="font-bold text-ink">{thb(spent)}</b>
            </span>
          )}
          {earned > 0 && (
            <span>
              Earned <b className="font-bold text-gain">{thb(earned)}</b>
            </span>
          )}
        </div>
      )}

      {groups.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ListBulletIcon className="h-7 w-7" />}
            title={searching ? 'No matches' : 'Nothing logged this month'}
            description={searching ? 'Try another word or tag.' : 'Tap + to record what you spend or earn.'}
            action={!searching ? <AddButton onClick={() => openQuickAdd()} label="Add transaction" /> : undefined}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map(([date, txns]) => {
            const dayNet = txns.reduce((s, t) => s + (t.type === 'income' ? t.amount : t.type === 'expense' ? -t.amount : 0), 0)
            return (
              <Card key={date} padded={false} className="px-4 sm:px-5 pt-3 pb-1">
                <div className="flex items-center justify-between border-b border-line pb-2 text-xs font-semibold text-ink-muted">
                  <span>{searching ? `${dayLabel(date)} ${date.slice(0, 4)}` : dayLabel(date)}</span>
                  <span className="tnum">
                    {dayNet > 0 ? '+' : dayNet < 0 ? '−' : ''}
                    {thb(Math.abs(dayNet))}
                  </span>
                </div>
                <div className="divide-y divide-line">
                  {txns.map((t) => (
                    <TxnRow key={t.id} txn={t} wallets={wallets} onTagClick={toggleTag} />
                  ))}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

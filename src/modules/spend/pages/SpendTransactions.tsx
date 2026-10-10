import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../../components/layout/PageHeader'
import { Card } from '../../../components/ui/Card'
import { AddButton } from '../../../components/ui/AddButton'
import { Button } from '../../../components/ui/Button'
import { Modal } from '../../../components/ui/Modal'
import { EmptyState } from '../../../components/ui/EmptyState'
import { FilterChip } from '../../../components/ui/FilterChip'
import { CloseIcon, SearchIcon } from '../../../components/icons'
import { localDateStr, thb } from '../../../lib/format'
import type { SpendTransaction, SpendTxnType } from '../../../lib/types'
import { ListBulletIcon, categoriesFor, getCategory } from '../categories'
import { inPeriod, periodFor } from '../logic'
import { MonthStepper } from '../MonthStepper'
import { openQuickAdd } from '../QuickAddSheet'
import { TxnRow } from '../TxnRow'
import { useSpend } from '../useSpend'
import { TONES } from '../tones'

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
  const { transactions, methods, settings } = useSpend()
  const cycle = settings.cycle
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const [anchor, setAnchor] = useState(localDateStr())
  const period = useMemo(() => periodFor(anchor, cycle), [anchor, cycle])
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
    const walletName = (id?: string) => methods.find((m) => m.id === id)?.name ?? ''
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    return transactions.filter(
      (t) => (words.length > 0 || inPeriod(period, t.date)) && (type === 'all' || t.type === type) && matches(t, words, walletName),
    )
  }, [transactions, methods, period, type, query])

  const groups = useMemo(() => {
    const map = new Map<string, SpendTransaction[]>()
    for (const t of filtered) map.set(t.date, [...(map.get(t.date) ?? []), t])
    return [...map.entries()]
  }, [filtered])

  const spent = filtered.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const earned = filtered.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const [searchOpen, setSearchOpen] = useState(false)

  const toggleTag = (tag: string) => {
    const token = `#${tag}`
    setQuery(terms.includes(token) ? terms.filter((t) => t !== token).join(' ') : [...terms, token].join(' '))
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Spend"
        title="Transactions"
        className="mb-0"
        subtitle={
          searching ? (
            // Active search replaces the month: it looks across every month
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="inline-flex max-w-[16rem] items-center gap-2 rounded-full border border-brand/40 bg-brand-soft px-3.5 py-2 text-sm font-bold text-brand-ink cursor-pointer"
              >
                <SearchIcon className="h-4 w-4 shrink-0" />
                <span className="truncate">{query}</span>
              </button>
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="grid h-9 w-9 place-items-center rounded-full border border-line bg-surface text-ink-muted hover:text-ink cursor-pointer"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <MonthStepper value={period} cycle={cycle} onChange={(p) => setAnchor(p.start)} />
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-label="Search transactions"
                className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface text-ink-muted shadow-xs hover:text-ink cursor-pointer"
              >
                <SearchFilterIcon className="h-[18px] w-[18px]" />
              </button>
            </div>
          )
        }
        action={
          // Phones use the + in the bottom bar
          <div className="hidden lg:block">
            <AddButton onClick={() => openQuickAdd()} label="Add" />
          </div>
        }
      />

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {TYPE_FILTERS.map((f) => (
          <FilterChip key={f.value} active={type === f.value} onClick={() => setType(f.value)}>
            {f.label}
          </FilterChip>
        ))}
      </div>

      <SearchSheet
        open={searchOpen}
        initial={query}
        transactions={transactions}
        methods={methods}
        onClose={() => setSearchOpen(false)}
        onApply={(q) => {
          setQuery(q)
          setSearchOpen(false)
        }}
      />

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
                    <TxnRow key={t.id} txn={t} methods={methods} onTagClick={toggleTag} />
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

/** Magnifier with filter lines, so it reads differently from the header's command search */
function SearchFilterIcon(p: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className={p.className}>
      <circle cx="10" cy="10" r="6" />
      <path d="m19 19-4.2-4.2" />
      <path d="M7.5 8.5h5M8.5 11.5h3" />
    </svg>
  )
}

const RECENT_KEY = 'spendiary.spend_recent_searches'

function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 5) : []
  } catch {
    return []
  }
}

function saveRecent(q: string) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([q, ...readRecent().filter((x) => x !== q)].slice(0, 5)))
  } catch {
    // storage unavailable — recent searches just won't be remembered
  }
}

function SearchSheet({
  open,
  initial,
  transactions,
  methods,
  onClose,
  onApply,
}: {
  open: boolean
  initial: string
  transactions: SpendTransaction[]
  methods: { id: string; name: string }[]
  onClose: () => void
  onApply: (q: string) => void
}) {
  const [q, setQ] = useState('')
  const [recent, setRecent] = useState<string[]>([])
  const [lastOpen, setLastOpen] = useState(false)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setQ(initial)
      setRecent(readRecent())
    }
  }

  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  const last = words[words.length - 1] ?? ''
  const walletName = (id?: string) => methods.find((m) => m.id === id)?.name ?? ''
  const count = words.length ? transactions.filter((t) => matches(t, words, walletName)).length : 0

  // Tags with how often and how much, narrowed by what's being typed
  const tagStats = useMemo(() => {
    const m = new Map<string, { n: number; amount: number }>()
    for (const t of transactions)
      for (const tag of t.tags ?? []) {
        const s = m.get(tag) ?? { n: 0, amount: 0 }
        s.n += 1
        if (t.type === 'expense') s.amount += t.amount
        m.set(tag, s)
      }
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n)
  }, [transactions])
  const tagFilter = last.replace(/^#/, '')
  const shownTags = tagStats.filter(([tag]) => !tagFilter || tag.startsWith(tagFilter)).slice(0, 10)

  const apply = (value: string) => {
    const v = value.trim()
    if (v) saveRecent(v)
    onApply(v)
  }
  const pickTag = (tag: string) => {
    // Replace a half-typed tag, otherwise add it
    const base = last.startsWith('#') ? words.slice(0, -1) : words
    setQ([...base.filter((w) => w !== `#${tag}`), `#${tag}`].join(' ') + ' ')
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Search"
      size="md"
      footer={
        <Button data-modal-submit className="w-full" onClick={() => apply(q)}>
          {words.length ? `Show ${count} ${count === 1 ? 'result' : 'results'}` : 'Show all'}
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="flex h-12 items-center gap-2 rounded-xl border border-line-strong bg-surface px-3.5 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15">
          <SearchIcon className="h-4 w-4 shrink-0 text-ink-faint" />
          <input
            type="text"
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Notes, categories, wallets or #tags"
            aria-label="Search transactions"
            className="w-full bg-transparent text-base text-ink outline-none placeholder:text-ink-faint"
          />
          {q && (
            <button type="button" onClick={() => setQ('')} aria-label="Clear" className="text-ink-muted hover:text-ink cursor-pointer">
              <CloseIcon className="h-4 w-4" />
            </button>
          )}
        </div>

        {recent.length > 0 && !q && (
          <div>
            <p className="mb-2 text-sm font-semibold text-ink-soft">Recent</p>
            <div className="flex flex-wrap gap-1.5">
              {recent.map((r) => (
                <button key={r} type="button" onClick={() => apply(r)} className="rounded-full bg-surface-muted px-3 py-1.5 text-xs font-semibold text-ink-soft hover:text-ink cursor-pointer">
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}

        {shownTags.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-semibold text-ink-soft">Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {shownTags.map(([tag, s]) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => pickTag(tag)}
                  className="rounded-full bg-violet-100 px-3 py-1.5 text-xs font-bold text-violet-700 hover:bg-violet-200 dark:bg-violet-400/15 dark:text-violet-200 cursor-pointer"
                >
                  #{tag}
                  <span className="ml-1.5 font-semibold opacity-70 tnum">
                    {s.n}× {s.amount > 0 ? `· ${thb(s.amount)}` : ''}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {!q && (
          <div>
            <p className="mb-2 text-sm font-semibold text-ink-soft">Categories</p>
            <div className="flex flex-wrap gap-1.5">
              {categoriesFor('expense').map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => apply(c.label.toLowerCase())}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold cursor-pointer ${TONES[c.tone].chip}`}
                >
                  <c.icon className="h-3.5 w-3.5" />
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

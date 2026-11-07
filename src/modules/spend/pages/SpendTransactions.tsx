import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../../components/layout/PageHeader'
import { Card, CardHeader, Inset } from '../../../components/ui/Card'
import { IconButton } from '../../../components/ui/IconButton'
import { AddButton } from '../../../components/ui/AddButton'
import { EmptyState } from '../../../components/ui/EmptyState'
import { FilterChip } from '../../../components/ui/FilterChip'
import { CloseIcon } from '../../../components/icons'
import { localDateStr, thb, thbSigned } from '../../../lib/format'
import { dateRangeLabel } from '../../../lib/paletteSearch'
import type { SpendTransaction, SpendTxnType } from '../../../lib/types'
import { ListBulletIcon, categoriesFor, getCategory } from '../categories'
import { ActiveSearch, EMPTY_TITLE, HistoryRangeBar, HistorySearchSheet, dayLabel, rangePeriod, type Range, type SearchContext } from '../history'
import { accountStatement, balanceOn, inPeriod, shiftDate, spendOf, txnFlow, type AccountStatement, type Period } from '../logic'
import { openQuickAdd } from '../QuickAddSheet'
import { TxnRow } from '../TxnRow'
import { useSpend } from '../useSpend'
import { TAG_CHIP, TONES } from '../tones'
import { STORAGE_KEYS } from '../../../lib/storageKeys'

type TypeFilter = 'all' | SpendTxnType

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'expense', label: 'Expenses' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfers' },
]

/**
 * Search terms starting with # match a tag (or the note text, for non-tags like `#7-11`);
 * anything else matches note, category or wallet.
 */
function matches(t: SpendTransaction, terms: string[], walletName: (id?: string) => string): boolean {
  if (terms.length === 0) return true
  const cat = getCategory(t.categoryId)
  const haystack = [t.note ?? '', cat?.label ?? '', t.subcategory ?? '', ...(cat?.keywords ?? []), walletName(t.accountId), walletName(t.toAccountId)]
    .join(' ')
    .toLowerCase()
  return terms.every((term) =>
    term.startsWith('#')
      ? (t.tags ?? []).some((tag) => tag.startsWith(term.slice(1))) || (t.note ?? '').toLowerCase().includes(term)
      : haystack.includes(term),
  )
}

export function SpendTransactions() {
  const { transactions, methods, accountName, settings } = useSpend()
  const cycle = settings.cycle
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  // One wallet or card: the page reads as its statement, with the balance after each entry
  const accountId = params.get('account')
  const account = accountId ? methods.find((m) => m.id === accountId) : undefined
  const isCard = account?.kind === 'card'
  const statement = useMemo(
    () => (accountId && account ? accountStatement(transactions, accountId, account.balance, isCard) : undefined),
    [transactions, accountId, account, isCard],
  )
  // Days from a search ("food ตุลา" in the search bar opens here with from / to)
  const from = params.get('from')
  const to = params.get('to')
  const days: Period | null = useMemo(() => (from && to ? { start: from, end: to } : null), [from, to])
  const [range, setRange] = useState<Range>('month')
  const [anchor, setAnchor] = useState(localDateStr())
  const period = useMemo(() => rangePeriod(range, anchor, cycle), [range, anchor, cycle])
  const [type, setType] = useState<TypeFilter>('all')

  const setQuery = (q: string) => {
    const next = new URLSearchParams(params)
    if (q) next.set('q', q)
    else next.delete('q')
    setParams(next, { replace: true })
  }
  const clearSearch = () => {
    const next = new URLSearchParams(params)
    for (const k of ['q', 'from', 'to']) next.delete(k)
    setParams(next, { replace: true })
  }
  const clearAccount = () => {
    const next = new URLSearchParams(params)
    next.delete('account')
    setParams(next, { replace: true })
  }

  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  // A search looks across every month; browsing without one stays on the chosen range
  const searching = terms.length > 0 || !!days
  // Without a single day or year in view, day headers carry the year
  const showYear = searching || range === 'all'

  const filtered = useMemo(() => {
    const walletName = (id?: string) => accountName(id) ?? ''
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    return transactions.filter(
      (t) =>
        (days ? inPeriod(days, t.date) : words.length > 0 || !period || inPeriod(period, t.date)) &&
        (type === 'all' || t.type === type) &&
        (!accountId || t.accountId === accountId || t.toAccountId === accountId) &&
        matches(t, words, walletName),
    )
  }, [transactions, accountName, period, days, type, query, accountId])

  const groups = useMemo(() => {
    const map = new Map<string, SpendTransaction[]>()
    for (const t of filtered) map.set(t.date, [...(map.get(t.date) ?? []), t])
    return [...map.entries()]
  }, [filtered])

  // Money paid back comes off what was spent rather than counting as earned
  const spent = Math.max(0, filtered.reduce((s, t) => s + spendOf(t), 0))
  const earned = filtered.filter((t) => t.type === 'income' && !t.paidBack).reduce((s, t) => s + t.amount, 0)
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
            <ActiveSearch
              label={[query, days && dateRangeLabel({ from: days.start, to: days.end })].filter(Boolean).join(' · ')}
              onOpen={() => setSearchOpen(true)}
              onClear={clearSearch}
            />
          ) : (
            <HistoryRangeBar
              range={range}
              period={period}
              cycle={cycle}
              onRangeChange={(r) => {
                setRange(r)
                setAnchor(localDateStr())
              }}
              onAnchorChange={setAnchor}
              onSearch={() => setSearchOpen(true)}
              searchLabel="Search transactions"
            />
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

      <HistorySearchSheet
        open={searchOpen}
        initial={query}
        recentKey={STORAGE_KEYS.spendRecentSearches}
        placeholder="Notes, categories or wallets"
        ariaLabel="Search transactions"
        countFor={(words) => transactions.filter((t) => matches(t, words, (id) => accountName(id) ?? '')).length}
        onClose={() => setSearchOpen(false)}
        onApply={(q) => {
          setQuery(q)
          setSearchOpen(false)
        }}
      >
        {(search) => <SearchSuggestions transactions={transactions} search={search} />}
      </HistorySearchSheet>

      {accountId && (
        <StatementCard
          name={accountName(accountId) ?? 'Account'}
          card={isCard}
          balance={account?.balance}
          statement={statement}
          // A word search looks across every month, so it has no start and end to show
          span={days ?? (terms.length > 0 ? null : period ?? 'all')}
          txns={transactions}
          accountId={accountId}
          count={filtered.length}
          onClear={clearAccount}
        />
      )}

      {filtered.length > 0 && !accountId && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 px-1 text-sm text-ink-muted tnum">
          <span>
            {filtered.length} {filtered.length === 1 ? 'transaction' : 'transactions'}
          </span>
          {spent > 0 && (
            <span>
              Spent <b className="font-bold text-ink">{thb(spent, true)}</b>
            </span>
          )}
          {earned > 0 && (
            <span>
              Earned <b className="font-bold text-gain-ink">{thb(earned, true)}</b>
            </span>
          )}
        </div>
      )}

      {groups.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ListBulletIcon className="h-7 w-7" />}
            title={searching ? 'No matches' : EMPTY_TITLE[range]}
            description={searching ? 'Try another word or tag.' : 'Tap + to record what you spend or earn.'}
            action={!searching ? <AddButton onClick={() => openQuickAdd()} label="Add transaction" /> : undefined}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map(([date, txns]) => {
            const dayNet = txns.reduce((s, t) => s + (t.type === 'income' ? t.amount : t.type === 'expense' ? -t.amount : 0), 0)
            const dayEnd = statement?.dayEnd.get(date)
            return (
              <Card key={date} list className="pt-3 pb-1">
                <div className="flex items-center justify-between border-b border-line pb-2 text-xs font-semibold text-ink-muted">
                  <span>{dayLabel(date, showYear)}</span>
                  {dayEnd !== undefined ? (
                    // A statement closes each day on the balance, like a bank's
                    <span className="tnum">
                      {isCard ? 'Owed' : 'Balance'} <span className="text-ink">{thbSigned(dayEnd, true)}</span>
                    </span>
                  ) : (
                    <span className="tnum">
                      {dayNet > 0 ? '+' : dayNet < 0 ? '−' : ''}
                      {thb(Math.abs(dayNet), true)}
                    </span>
                  )}
                </div>
                <div className="divide-y divide-line">
                  {txns.map((t) => (
                    <TxnRow
                      key={t.id}
                      txn={t}
                      methods={methods}
                      onTagClick={toggleTag}
                      account={accountId ? { id: accountId, card: isCard, after: statement?.after.get(t.id) } : undefined}
                    />
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

/**
 * One account's statement: its balance at the start and end of what's in view, and the money in
 * and out between them. Entries already in the balance are listed but move nothing, so they're
 * left out of in / out and start + in − out always equals the end.
 */
function StatementCard({
  name,
  card,
  balance,
  statement,
  span,
  txns,
  accountId,
  count,
  onClear,
}: {
  name: string
  card: boolean
  /** Today's balance (owed, for a card); unset for a deleted account */
  balance?: number
  statement?: AccountStatement
  /** The days in view; 'all' for everything, null for a word search across every month */
  span: Period | 'all' | null
  txns: SpendTransaction[]
  accountId: string
  count: number
  onClear: () => void
}) {
  const range = statement && span ? (span === 'all' ? { start: statement.opening, end: balance ?? 0 } : { start: balanceOn(statement, shiftDate(span.start, -1)), end: balanceOn(statement, span.end) }) : null
  const moves = useMemo(() => {
    let moneyIn = 0
    let moneyOut = 0
    for (const t of txns) {
      if (t.alreadyInBalance || (span && span !== 'all' && !inPeriod(span, t.date))) continue
      const f = txnFlow(t, accountId)
      if (f > 0) moneyIn += f
      else moneyOut -= f
    }
    return { moneyIn, moneyOut }
  }, [txns, span, accountId])
  const what = card ? 'Owed' : 'Balance'
  return (
    <Card>
      <CardHeader
        title={name}
        description={`${count} ${count === 1 ? 'entry' : 'entries'} · ${card ? 'what you owed' : 'the balance'} after each one`}
        action={<IconButton icon={<CloseIcon className="h-4 w-4" />} label="Show every account" onClick={onClear} />}
      />
      {balance === undefined ? (
        <p className="mt-3 text-sm text-ink-muted">This account was deleted, so there's no balance to follow.</p>
      ) : range ? (
        <Inset className="mt-4 p-3.5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-ink-muted">{span === 'all' ? (card ? 'Owed at first' : 'Starting balance') : `${what} at start`}</p>
              <p className="truncate font-display text-lg font-extrabold text-ink tnum">{thbSigned(range.start, true)}</p>
            </div>
            <span aria-hidden className="pb-1 text-ink-faint">
              →
            </span>
            <div className="min-w-0 text-right">
              <p className="text-xs font-semibold text-ink-muted">{span === 'all' ? `${what} now` : `${what} at end`}</p>
              <p className="truncate font-display text-lg font-extrabold text-ink tnum">{thbSigned(range.end, true)}</p>
            </div>
          </div>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-ink-muted tnum">
            <span>
              In <b className="font-semibold text-gain-ink">+{thb(moves.moneyIn, true)}</b>
            </span>
            <span>
              Out <b className="font-semibold text-ink">−{thb(moves.moneyOut, true)}</b>
            </span>
          </p>
        </Inset>
      ) : (
        <p className="mt-3 text-sm text-ink-muted tnum">
          {what} now <b className="font-bold text-ink">{thbSigned(balance, true)}</b>
        </p>
      )}
    </Card>
  )
}

/** Tags and categories to pick from while searching */
function SearchSuggestions({ transactions, search }: { transactions: SpendTransaction[]; search: SearchContext }) {
  const { words, last, setQ, apply } = search

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

  // Categories: all expense ones when empty; while typing a plain word, any category
  // (expense or income) whose name or a keyword starts with it. A #tag hides them.
  const shownCats = !last
    ? categoriesFor('expense')
    : last.startsWith('#')
      ? []
      : [...categoriesFor('expense'), ...categoriesFor('income')].filter(
          (c) =>
            c.label.toLowerCase().split(/\s+/).some((w) => w.startsWith(last)) ||
            c.keywords.some((k) => k.toLowerCase().startsWith(last)),
        )

  const pickTag = (tag: string) => {
    // Replace a half-typed tag, otherwise add it
    const base = last.startsWith('#') ? words.slice(0, -1) : words
    setQ([...base.filter((w) => w !== `#${tag}`), `#${tag}`].join(' ') + ' ')
  }

  return (
    <>
      {shownTags.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold text-ink-soft">Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {shownTags.map(([tag, s]) => (
              <button
                key={tag}
                type="button"
                onClick={() => pickTag(tag)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold cursor-pointer ${TAG_CHIP.idle}`}
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

      {shownCats.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold text-ink-soft">Categories</p>
          <div className="flex flex-wrap gap-1.5">
            {shownCats.map((c) => (
              <button
                key={c.id}
                type="button"
                // Replace the half-typed word with the category, then search
                onClick={() => apply([...words.slice(0, last ? -1 : undefined), c.label.toLowerCase()].join(' '))}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold cursor-pointer ${TONES[c.tone].chip}`}
              >
                <c.icon className="h-3.5 w-3.5" />
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

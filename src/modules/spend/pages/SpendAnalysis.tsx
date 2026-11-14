import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../../components/layout/PageHeader'
import { Card, CardHeader } from '../../../components/ui/Card'
import { TextLink } from '../../../components/ui/TextLink'
import { SegmentedControl } from '../../../components/ui/SegmentedControl'
import { localDateStr, thb } from '../../../lib/format'
import type { SpendTransaction } from '../../../lib/types'
import { getCategory } from '../categories'
import { ChevronDownIcon, SparkleIcon } from '../../../components/icons'
import { budgetState, countsInBudget, noteTitle, inPeriod, periodFor, shiftDate, shiftPeriod, categoryBreakdown, habits, spendOf, totalsFor, weekOf, analysisInsights, type Insight, type Period } from '../logic'
import { MonthStepper } from '../MonthStepper'
import { ArrangeButton, ReorderSheet } from '../ReorderSheet'
import { cardOrder, isDefaultOrder, moveInOrder } from '../../../lib/cardOrder'
import { SPENT_TONE, TAG_CHIP, TONES } from '../tones'
import { useSpend } from '../useSpend'
import { TrendsCard } from '../TrendsCard'
import { TxnRow } from '../TxnRow'
import { settingsPath } from '../../../lib/settingsSections'

type Range = 'week' | 'month' | 'year'

const ANALYSIS_CARDS = [
  { id: 'summary', label: 'Spent and income' },
  { id: 'perDay', label: 'Spent per day' },
  { id: 'trends', label: 'Trends (month view)' },
  { id: 'categories', label: 'By category' },
  { id: 'habits', label: 'Habits' },
  { id: 'tags', label: 'Top tags' },
] as const
type AnalysisCardId = (typeof ANALYSIS_CARDS)[number]['id']
const ANALYSIS_CARD_IDS: readonly AnalysisCardId[] = ANALYSIS_CARDS.map((c) => c.id)

const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000)

const shortDay = (s: string, year = false) =>
  parse(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) })

function rangeLabel(range: Range, p: Period): string | undefined {
  if (range === 'week') return `${shortDay(p.start)} – ${shortDay(p.end, true)}`
  if (range === 'year') {
    const s = parse(p.start)
    const e = parse(p.end)
    const mon = (d: Date) => d.toLocaleDateString('en-GB', { month: 'short' })
    return `${mon(s)} ${s.getFullYear()} – ${mon(e)} ${e.getFullYear()}`
  }
  return undefined
}

/** The 12 calendar months ending with the month of `date` */
function yearOf(date: string): Period {
  const d = parse(date)
  return { start: localDateStr(new Date(d.getFullYear(), d.getMonth() - 11, 1)), end: localDateStr(new Date(d.getFullYear(), d.getMonth() + 1, 0)) }
}

interface Bucket {
  key: string
  label: string
  spent: number
  future: boolean
}

function buckets(range: Range, p: Period, txns: SpendTransaction[], today: string): Bucket[] {
  const spentOn = new Map<string, number>()
  for (const t of txns) if (spendOf(t) && inPeriod(p, t.date)) {
    const k = range === 'year' ? t.date.slice(0, 7) : t.date
    spentOn.set(k, (spentOn.get(k) ?? 0) + spendOf(t))
  }
  // A pay-back on a day with less spending would draw a bar below zero
  for (const [k, v] of spentOn) if (v < 0) spentOn.set(k, 0)
  if (range === 'year') {
    const s = parse(p.start)
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(s.getFullYear(), s.getMonth() + i, 1)
      const key = localDateStr(d).slice(0, 7)
      return { key, label: String(d.getMonth() + 1), spent: spentOn.get(key) ?? 0, future: key > today.slice(0, 7) }
    })
  }
  const n = daysBetween(p.start, p.end) + 1
  return Array.from({ length: n }, (_, i) => {
    const key = shiftDate(p.start, i)
    const d = parse(key)
    const label = range === 'week' ? d.toLocaleDateString('en-GB', { weekday: 'short' }) : i % 5 === 0 ? String(d.getDate()) : ''
    return { key, label, spent: spentOn.get(key) ?? 0, future: key > today }
  })
}

/** The first and last day a bar covers: one day, or a whole month in the year view */
const bucketSpan = (key: string): Period =>
  key.length === 7 ? { start: `${key}-01`, end: localDateStr(new Date(parse(`${key}-01`).getFullYear(), parse(`${key}-01`).getMonth() + 1, 0)) } : { start: key, end: key }

const bucketName = (key: string) =>
  key.length === 7
    ? parse(`${key}-01`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    : parse(key).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

function Bars({ data, unit, selected, onSelect }: { data: Bucket[]; unit: string; selected: string | null; onSelect: (key: string | null) => void }) {
  const [hover, setHover] = useState<string | null>(null)
  const past = data.filter((b) => !b.future)
  const max = Math.max(1, ...data.map((b) => b.spent))
  const avg = past.length ? past.reduce((s, b) => s + b.spent, 0) / past.length : 0
  const top = past.reduce<Bucket | null>((m, b) => (!m || b.spent > m.spent ? b : m), null)
  const shown = data.find((b) => b.key === (hover ?? selected)) ?? top

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between text-xs">
        <span className="text-ink-muted">
          avg <b className="font-bold text-ink tnum">{thb(avg)}</b> / {unit}
        </span>
        {shown && (shown.spent > 0 || shown.key === selected) && (
          <span className="text-ink-muted tnum">
            {bucketName(shown.key)} <b className="font-bold text-ink">{thb(shown.spent)}</b>
          </span>
        )}
      </div>
      <div className="relative flex h-40 items-end gap-[3px]" onMouseLeave={() => setHover(null)}>
        <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line-strong" style={{ bottom: `${(avg / max) * 100}%` }} />
        {data.map((b) => {
          const isTop = top?.key === b.key && b.spent > 0
          const isSelected = selected === b.key
          return (
            <button
              key={b.key}
              type="button"
              disabled={b.future}
              onMouseEnter={() => setHover(b.key)}
              onFocus={() => setHover(b.key)}
              onBlur={() => setHover(null)}
              // A second tap on the same bar closes its list
              onClick={() => onSelect(isSelected ? null : b.key)}
              aria-label={`${bucketName(b.key)}: ${thb(b.spent)}, show transactions`}
              aria-pressed={isSelected}
              className="flex h-full flex-1 flex-col justify-end cursor-pointer disabled:cursor-default"
            >
              <span
                className={`block w-full rounded-md transition-[height] duration-500 ${
                  b.future
                    ? 'bg-surface-muted/50'
                    : isSelected
                      ? 'bg-brand'
                      : isTop
                        ? SPENT_TONE.bar
                        : hover === b.key
                          ? 'bg-brand/60'
                          : TONES.slate.bar
                }`}
                style={{ height: `${b.future ? 4 : Math.max(3, (b.spent / max) * 100)}%` }}
              />
            </button>
          )
        })}
      </div>
      <div className="mt-1 flex gap-[3px]">
        {data.map((b) => (
          <span key={b.key} className={`flex-1 text-center text-2xs ${selected === b.key ? 'font-bold text-ink' : 'text-ink-muted'}`}>
            {b.label}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Rows shown under a tapped bar or category before "See all" */
const PEEK_LIMIT = 6

/** Expenses in a slice of the period, biggest first, like a card statement; past the limit, History takes over */
function TxnPeek({ caption, rows, methods, seeAll }: { caption: string; rows: SpendTransaction[]; methods: { id: string; name: string }[]; seeAll: string }) {
  const sorted = [...rows].sort((a, b) => spendOf(b) - spendOf(a))
  return (
    <div className="mt-3 border-t border-line pt-3">
      <p className="text-xs font-semibold text-ink-muted tnum">
        {caption} · {sorted.length === 0 ? 'nothing spent' : `${sorted.length} ${sorted.length === 1 ? 'expense' : 'expenses'}, biggest first`}
      </p>
      {sorted.length > 0 && (
        <div className="mt-1 divide-y divide-line">
          {sorted.slice(0, PEEK_LIMIT).map((t) => (
            <TxnRow key={t.id} txn={t} methods={methods} />
          ))}
        </div>
      )}
      {sorted.length > PEEK_LIMIT && (
        <div className="mt-2 border-t border-line pt-3 text-center">
          <TextLink to={seeAll}>See all {sorted.length} in History →</TextLink>
        </div>
      )}
    </div>
  )
}

/** The top findings in a sentence each, under the page title: what to notice before reading the cards. */
function InsightLines({ insights, rangeName, current }: { insights: Insight[]; rangeName: string; current: boolean }) {
  const when = `${current ? 'this' : 'that'} ${rangeName}`
  const b = (s: string, tone = 'text-ink') => <b className={`font-semibold tnum ${tone}`}>{s}</b>
  return (
    <ul className="space-y-0.5">
      {insights.map((i) => (
        <li key={i.kind} className="flex items-start gap-1.5">
          <SparkleIcon className="mt-[3px] h-3.5 w-3.5 shrink-0 text-ink-faint" />
          <span>
            {i.kind === 'pace' ? (
              <>
                On pace for {b(thb(i.projected))} {when}
                {i.budget ? (
                  // The budget doesn't cover what was kept outside it
                  i.projected - (i.outside ?? 0) > i.budget ? (
                    <> · {b(`${thb(i.projected - (i.outside ?? 0) - i.budget)} over`, 'text-loss-ink')} your budget</>
                  ) : (
                    <> · within your {thb(i.budget)} budget</>
                  )
                ) : null}
                {i.outside && i.outside > 0 ? <> · includes {thb(i.outside)} kept outside the budget</> : null}
              </>
            ) : i.kind === 'mover' ? (
              <>
                {b(getCategory(i.categoryId)?.label ?? 'Other')} {b(`${thb(Math.abs(i.diff))} ${i.diff > 0 ? 'more' : 'less'}`, i.diff > 0 ? SPENT_TONE.text : 'text-gain-ink')} than last{' '}
                {rangeName} at this point
              </>
            ) : (
              <>
                {b(i.label)} {i.count}× {when} · {thb(i.amount)}
              </>
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}

export function SpendAnalysis() {
  const { transactions, methods, settings, updateSettings } = useSpend()
  const [arrangeOpen, setArrangeOpen] = useState(false)
  const order = cardOrder(ANALYSIS_CARD_IDS, settings.analysisOrder)
  const saveOrder = (next: AnalysisCardId[]) => updateSettings({ analysisOrder: isDefaultOrder(ANALYSIS_CARD_IDS, next) ? undefined : next })
  // Only ids of cards that still exist count, so a removed card can't keep "Reset" showing
  const hidden = (settings.analysisHidden ?? []).filter((id): id is AnalysisCardId => ANALYSIS_CARD_IDS.includes(id as AnalysisCardId))
  const toggleHidden = (id: AnalysisCardId) => {
    const next = hidden.includes(id) ? hidden.filter((h) => h !== id) : [...hidden, id]
    updateSettings({ analysisHidden: next.length ? next : undefined })
  }
  const today = localDateStr()
  const [range, setRange] = useState<Range>('month')
  const [anchor, setAnchor] = useState(today)
  // The bar tapped in "Spent per day"; keyed by period so moving to another week or month clears it
  const [picked, setPicked] = useState<{ key: string; period: string } | null>(null)
  // The category row opened in "By category", the same way
  const [openCat, setOpenCat] = useState<{ id: string; period: string } | null>(null)

  const period: Period = useMemo(
    () => (range === 'week' ? weekOf(anchor) : range === 'year' ? yearOf(anchor) : periodFor(anchor, settings.cycle)),
    [range, anchor, settings.cycle],
  )
  const inRange = useMemo(() => transactions.filter((t) => inPeriod(period, t.date)), [transactions, period])
  const totals = useMemo(() => totalsFor(inRange), [inRange])
  const data = useMemo(() => buckets(range, period, transactions, today), [range, period, transactions, today])
  const periodKey = `${range}:${period.start}`
  const selectedBar = picked?.period === periodKey ? picked.key : null
  const openCatId = openCat?.period === periodKey ? openCat.id : null

  // Same point in the previous period: e.g. the first 12 days of last month vs the first 12 of this one
  const isCurrent = inPeriod(period, today)
  const prevSoFar = useMemo(() => {
    if (range === 'year') return undefined
    const prev = range === 'week' ? weekOf(shiftDate(period.start, -1)) : shiftPeriod(period, -1, settings.cycle)
    const elapsed = isCurrent ? daysBetween(period.start, today) : daysBetween(period.start, period.end)
    const prevUpTo = { start: prev.start, end: shiftDate(prev.start, Math.min(elapsed, daysBetween(prev.start, prev.end))) }
    return transactions.filter((t) => inPeriod(prevUpTo, t.date))
  }, [range, period, isCurrent, today, transactions, settings.cycle])
  const compare = useMemo(() => {
    if (!prevSoFar) return null
    const spentPrev = prevSoFar.reduce((s, t) => s + spendOf(t), 0)
    return spentPrev > 0 ? totals.expense - spentPrev : null
  }, [prevSoFar, totals.expense])

  const elapsedDays = Math.max(1, daysBetween(period.start, isCurrent ? today : period.end) + 1)
  const insights = useMemo(
    () =>
      analysisInsights({
        inRange,
        prevSoFar,
        elapsedDays,
        totalDays: daysBetween(period.start, period.end) + 1,
        // The year view is a rolling 12 months, so there is no year end to be on pace for
        current: isCurrent && range !== 'year',
        budget: range === 'month' ? settings.monthlyBudget : undefined,
      }),
    [inRange, prevSoFar, elapsedDays, period, isCurrent, range, settings.monthlyBudget],
  )
  const biggest = inRange.filter((t) => t.type === 'expense').sort((a, b) => b.amount - a.amount)[0]
  const spentPct = totals.income > 0 ? Math.max(0, (totals.expense / totals.income) * 100) : 0
  const over = totals.income > 0 && totals.net < 0
  const tagTotals = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of inRange) if (spendOf(t)) for (const tag of t.tags ?? []) m.set(tag, (m.get(tag) ?? 0) + spendOf(t))
    return [...m.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [inRange])

  // The pace counts from when logging began, so a few weeks of history in a 12-month view isn't spread over the year
  const habitRows = useMemo(() => {
    const first = transactions.reduce<string | undefined>((m, t) => (!m || t.date < m ? t.date : m), undefined)
    const from = first && first > period.start ? first : period.start
    return habits(inRange, daysBetween(from, isCurrent ? today : period.end) + 1)
  }, [transactions, inRange, period, isCurrent, today])

  // A deleted category's budget waits until it's restored
  // A category's limit is measured without the one-offs kept outside the budget, like the monthly budget
  const inBudgetByCat = useMemo(() => new Map(totalsFor(inRange.filter(countsInBudget)).byCategory.map((c) => [c.categoryId, c.amount])), [inRange])
  const catBudgets = range === 'month' ? Object.fromEntries(Object.entries(settings.categoryBudgets ?? {}).filter(([id]) => !getCategory(id)?.hidden)) : {}
  const rangeName = range === 'week' ? 'week' : range === 'year' ? 'year' : 'month'

  const cards: Record<AnalysisCardId, ReactNode> = {
    summary: (
      <Card className="animate-rise">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink-muted">{isCurrent ? `Spent this ${rangeName}` : `Spent that ${rangeName}`}</p>
            <p className="mt-1 font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-ink tnum truncate">{thb(totals.expense)}</p>
            {compare !== null && (
              <p className={`mt-1 text-xs font-semibold tnum ${compare <= 0 ? 'text-gain-ink' : SPENT_TONE.text}`}>
                {compare <= 0 ? `${thb(-compare)} less` : `${thb(compare)} more`}
                <span className="font-normal text-ink-muted"> than last {rangeName} at this point</span>
              </p>
            )}
          </div>
          <div className="sm:text-right">
            <p className="text-sm font-medium text-ink-muted">Income</p>
            <p className="mt-1 font-display text-xl sm:text-2xl font-extrabold text-ink tnum">{thb(totals.income)}</p>
            {totals.income === 0 && <p className="mt-0.5 text-xs text-ink-muted">None logged this {rangeName}</p>}
          </div>
        </div>
        {biggest && (
          <p className="mt-3 flex min-w-0 items-baseline gap-1.5 text-xs text-ink-muted">
            <span className="shrink-0">Biggest expense</span>
            <b className="shrink-0 font-bold text-ink tnum">{thb(biggest.amount)}</b>
            <span className="truncate">· {noteTitle(biggest.note, biggest.subcategory) || getCategory(biggest.categoryId)?.label}</span>
          </p>
        )}

        {/* Where the income went: spent vs. left; past 100% the whole bar turns red */}
        {totals.income > 0 && (
          <>
            <div className="mt-5 flex h-2.5 w-full gap-1 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
              {spentPct > 0 && <div className={`rounded-full ${over ? 'bg-loss' : SPENT_TONE.bar}`} style={{ width: `${Math.min(100, spentPct)}%` }} />}
              {!over && totals.net > 0 && <div className="rounded-full bg-gain" style={{ width: `${100 - spentPct}%` }} />}
            </div>
            <div className="mt-2 flex items-start justify-between gap-3">
              <p className="min-w-0">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${over ? 'bg-loss' : SPENT_TONE.bar}`} />
                  Spent
                </span>
                <span className="mt-1 block text-base sm:text-lg font-display font-extrabold text-ink tnum">
                  {Math.round(spentPct)}% <span className="text-xs font-semibold text-ink-muted">of income</span>
                </span>
              </p>
              <p className="min-w-0 text-right">
                <span className="flex items-center justify-end gap-1.5 text-xs font-semibold text-ink-soft">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${over ? 'bg-loss' : 'bg-gain'}`} />
                  {over ? 'Over by' : 'Left'}
                </span>
                <span className={`mt-1 block truncate font-display text-base sm:text-lg font-extrabold tnum ${over ? 'text-loss-ink' : 'text-ink'}`}>
                  {thb(Math.abs(totals.net))}
                </span>
              </p>
            </div>
          </>
        )}
      </Card>
    ),
    perDay: (
      <Card>
        <h2 className="mb-3 font-display text-lg font-extrabold text-ink">Spent per {range === 'year' ? 'month' : 'day'}</h2>
        <Bars
          data={data}
          unit={range === 'year' ? 'month' : 'day'}
          selected={selectedBar}
          onSelect={(key) => setPicked(key ? { key, period: periodKey } : null)}
        />
        {selectedBar ? (
          <TxnPeek
            caption={bucketName(selectedBar)}
            rows={inRange.filter((t) => spendOf(t) !== 0 && inPeriod(bucketSpan(selectedBar), t.date))}
            methods={methods}
            seeAll={`/spend/txns?from=${bucketSpan(selectedBar).start}&to=${bucketSpan(selectedBar).end}`}
          />
        ) : (
          <p className="mt-3 text-xs text-ink-muted">Tap a bar to see what you bought.</p>
        )}
      </Card>
    ),
    // Month on month only makes sense for a month
    trends: range === 'month' ? <TrendsCard end={period} txns={transactions} cycle={settings.cycle} /> : null,
    categories: (
      <Card>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-extrabold text-ink">By category</h2>
          {range === 'month' && (
            <Link to={settingsPath('category-budgets')} className="text-sm font-semibold text-link hover:underline">
              Budgets
            </Link>
          )}
        </div>
        {totals.byCategory.length === 0 && Object.keys(catBudgets).length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">No spending in this {rangeName}.</p>
        ) : (
          <ul className="mt-4 space-y-3.5">
            {[
              ...Object.entries(catBudgets)
                // Budgeted categories show even before anything is spent
                .filter(([id, b]) => b > 0 && !totals.byCategory.some((c) => c.categoryId === id))
                .map(([categoryId]) => ({ categoryId, amount: 0 })),
              ...totals.byCategory,
            ]
              .sort((a, b) => b.amount - a.amount)
              .map(({ categoryId, amount }) => {
                const cat = getCategory(categoryId)
                const tone = cat?.tone ?? 'slate'
                const Icon = cat?.icon
                const b = catBudgets[categoryId] > 0 ? catBudgets[categoryId] : undefined
                // With a limit, the row shows what the limit covers and says what was kept outside it
                const used = b ? inBudgetByCat.get(categoryId) ?? 0 : amount
                const outside = b ? Math.max(0, Math.round(amount - used)) : 0
                const state = b ? budgetState(used, b) : 'ok'
                const share = totals.expense > 0 ? (amount / totals.expense) * 100 : 0
                const width = b ? Math.min(100, (used / b) * 100) : share
                const subs = categoryBreakdown(b ? inRange.filter(countsInBudget) : inRange, categoryId)
                const isOpen = openCatId === categoryId
                return (
                  <li key={categoryId}>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpenCat(isOpen ? null : { id: categoryId, period: periodKey })}
                      className="block w-full rounded-xl text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                      >
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex min-w-0 items-center gap-2 font-semibold text-ink">
                          {Icon && (
                            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${TONES[tone].chip}`}>
                              <Icon className="h-4 w-4" />
                            </span>
                          )}
                          <span className="truncate">{cat?.label ?? 'Other'}</span>
                        </span>
                        <span className="shrink-0 tnum font-bold text-ink">
                          {thb(used)}
                          <span className="ml-1 text-xs font-semibold text-ink-muted">{b ? `/ ${thb(b)}` : `${Math.round(share)}%`}</span>
                          <ChevronDownIcon className={`ml-1 inline h-3.5 w-3.5 align-[-2px] text-ink-faint transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                        <div
                          className={`h-full rounded-full ${state === 'over' ? 'bg-loss' : state === 'near' ? 'bg-warn' : TONES[tone].bar}`}
                          style={{ width: `${width}%` }}
                        />
                      </div>
                      {subs.length > 0 && (
                        <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-muted">
                          {subs.map((s) => (
                            <span key={s.label} className="tnum">
                              {s.label} <span className="font-semibold text-ink-soft">{thb(s.amount)}</span>
                            </span>
                          ))}
                        </p>
                      )}
                      {b && (
                        <p className={`mt-1 text-xs tnum ${state === 'over' ? 'font-semibold text-loss-ink' : state === 'near' ? 'font-semibold text-warn-ink' : 'text-ink-muted'}`}>
                          {state === 'over' ? `Over by ${thb(used - b)}` : `${thb(b - used)} left`}
                        </p>
                      )}
                      {outside > 0 && <p className="mt-1 text-xs text-ink-muted tnum">Plus {thb(outside)} kept outside the budget</p>}
                    </button>
                    {isOpen && (
                      <TxnPeek
                        caption={cat?.label ?? 'Other'}
                        rows={inRange.filter((t) => spendOf(t) !== 0 && (t.categoryId ?? 'other') === categoryId)}
                        methods={methods}
                        seeAll={`/spend/txns?q=${encodeURIComponent((cat?.label ?? 'other').toLowerCase())}&from=${period.start}&to=${period.end}`}
                      />
                    )}
                  </li>
                )
              })}
          </ul>
        )}
      </Card>
    ),
    // Things bought again and again, and what they come to over a year at this pace
    habits: habitRows.length > 0 ? (
      <Card>
        <CardHeader title="Habits" description={`Bought 3 times or more ${isCurrent ? 'this' : 'that'} ${rangeName}`} />
        <ul className="mt-3 divide-y divide-line">
          {habitRows.map((h) => {
            const cat = getCategory(h.categoryId)
            const Icon = cat?.icon
            return (
              <li key={`${h.categoryId}-${h.subcategory}`} className="flex items-center gap-3 py-2.5">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${TONES[cat?.tone ?? 'slate'].chip}`}>
                  {Icon && <Icon className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{h.subcategory}</span>
                  <span className="block truncate text-xs text-ink-muted tnum">
                    {h.count}× · {thb(h.avg)} each{range !== 'month' && ` · ${h.perMonth}×/month`}
                  </span>
                </span>
                {h.perYear !== undefined && (
                  <span className="shrink-0 text-right">
                    <span className={`block text-sm font-bold tnum ${SPENT_TONE.text}`}>≈ {thb(h.perYear)}</span>
                    <span className="block text-xs text-ink-muted">a year</span>
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </Card>
    ) : null,
    // Only for notes that use #tags; the app no longer asks for them
    tags: tagTotals.length > 0 ? (
      <Card>
        <h2 className="font-display text-lg font-extrabold text-ink">Top tags</h2>
        <ul className="mt-3 divide-y divide-line">
          {tagTotals.map(([tag, amount]) => (
            <li key={tag} className="flex items-center justify-between py-2.5">
              <Link to={`/spend/txns?q=${encodeURIComponent(`#${tag}`)}`} className={`rounded-full px-2.5 py-1 text-xs font-bold ${TAG_CHIP.idle}`}>
                #{tag}
              </Link>
              <span className="text-sm font-bold text-ink tnum">{thb(amount)}</span>
            </li>
          ))}
        </ul>
      </Card>
    ) : null,
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Spend"
        title="Analysis"
        subtitle={insights.length > 0 ? <InsightLines insights={insights.slice(0, 2)} rangeName={rangeName} current={isCurrent} /> : undefined}
        action={<ArrangeButton label="Arrange cards" onClick={() => setArrangeOpen(true)} />}
      />

      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          ariaLabel="Range"
          fullWidth={false}
          value={range}
          onChange={(r) => {
            setRange(r)
            setAnchor(today)
          }}
          options={[
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
            { value: 'year', label: 'Year' },
          ]}
        />
        {range === 'month' ? (
          <MonthStepper value={period} cycle={settings.cycle} onChange={(p) => setAnchor(p.start)} />
        ) : (
          <MonthStepper
            value={period}
            label={rangeLabel(range, period)}
            // Anchor on the period's end so the year view keeps ending on the chosen month
            step={(p, delta) => (range === 'week' ? weekOf(shiftDate(p.start, 7 * delta)) : yearOf(localDateStr(new Date(parse(p.end).getFullYear() + delta, parse(p.end).getMonth(), 1))))}
            onChange={(p) => setAnchor(p.end > today ? today : p.end)}
          />
        )}
      </div>

      {/* Cards in your order; on wide screens they flow down two columns */}
      <div className="flex flex-col gap-5 lg:block lg:columns-2 lg:gap-5">
        {order
          .filter((id) => cards[id] && !hidden.includes(id))
          .map((id) => (
            <div key={id} className="break-inside-avoid lg:mb-5">
              {cards[id]}
            </div>
          ))}
      </div>

      <ReorderSheet
        open={arrangeOpen}
        onClose={() => setArrangeOpen(false)}
        title="Arrange cards"
        description="Choose which cards show on Analysis and in what order. On a wide screen they fill two columns, top to bottom."
        items={order.map((id) => ({ id, label: ANALYSIS_CARDS.find((c) => c.id === id)?.label ?? id }))}
        onMove={(id, delta) => saveOrder(moveInOrder(order, id as AnalysisCardId, delta))}
        hidden={hidden}
        onToggle={(id) => toggleHidden(id as AnalysisCardId)}
        canReset={!isDefaultOrder(ANALYSIS_CARD_IDS, order) || hidden.length > 0}
        onReset={() => updateSettings({ analysisOrder: undefined, analysisHidden: undefined })}
      />
    </div>
  )
}

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../../components/layout/PageHeader'
import { Card } from '../../../components/ui/Card'
import { SegmentedControl } from '../../../components/ui/SegmentedControl'
import { localDateStr, thb, thbCompact } from '../../../lib/format'
import type { SpendTransaction } from '../../../lib/types'
import { getCategory } from '../categories'
import { budgetState, noteTitle, inPeriod, periodFor, shiftDate, shiftPeriod, totalsFor, type Period } from '../logic'
import { MonthStepper } from '../MonthStepper'
import { TONES } from '../tones'
import { useSpend } from '../useSpend'
import { TrendsCard } from '../TrendsCard'

type Range = 'week' | 'month' | 'year'

const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000)

/** Sunday-to-Saturday week containing `date` */
function weekOf(date: string): Period {
  const start = shiftDate(date, -parse(date).getDay())
  return { start, end: shiftDate(start, 6) }
}

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
  for (const t of txns) if (t.type === 'expense' && inPeriod(p, t.date)) {
    const k = range === 'year' ? t.date.slice(0, 7) : t.date
    spentOn.set(k, (spentOn.get(k) ?? 0) + t.amount)
  }
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

function Bars({ data, unit }: { data: Bucket[]; unit: string }) {
  const [hover, setHover] = useState<string | null>(null)
  const past = data.filter((b) => !b.future)
  const max = Math.max(1, ...data.map((b) => b.spent))
  const avg = past.length ? past.reduce((s, b) => s + b.spent, 0) / past.length : 0
  const top = past.reduce<Bucket | null>((m, b) => (!m || b.spent > m.spent ? b : m), null)
  const shown = data.find((b) => b.key === hover) ?? top

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between text-xs">
        <span className="text-ink-muted">
          avg <b className="font-bold text-ink tnum">{thb(avg)}</b> / {unit}
        </span>
        {shown && shown.spent > 0 && (
          <span className="text-ink-muted tnum">
            {shown.key.length === 7
              ? parse(`${shown.key}-01`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
              : parse(shown.key).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}{' '}
            <b className="font-bold text-ink">{thb(shown.spent)}</b>
          </span>
        )}
      </div>
      <div className="relative flex h-40 items-end gap-[3px]" onMouseLeave={() => setHover(null)}>
        <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line-strong" style={{ bottom: `${(avg / max) * 100}%` }} />
        {data.map((b) => {
          const isTop = top?.key === b.key && b.spent > 0
          return (
            <button
              key={b.key}
              type="button"
              onMouseEnter={() => setHover(b.key)}
              onFocus={() => setHover(b.key)}
              onClick={() => setHover(b.key)}
              aria-label={`${b.key}: ${thb(b.spent)}`}
              className="flex h-full flex-1 flex-col justify-end cursor-pointer"
            >
              <span
                className={`block w-full rounded-md transition-[height] duration-500 ${
                  b.future
                    ? 'bg-surface-muted/50'
                    : isTop
                      ? 'bg-orange-400 dark:bg-orange-400/80'
                      : hover === b.key
                        ? 'bg-brand/60'
                        : 'bg-slate-300 dark:bg-slate-500'
                }`}
                style={{ height: `${b.future ? 4 : Math.max(3, (b.spent / max) * 100)}%` }}
              />
            </button>
          )
        })}
      </div>
      <div className="mt-1 flex gap-[3px]">
        {data.map((b) => (
          <span key={b.key} className="flex-1 text-center text-[11px] text-ink-muted">
            {b.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export function SpendAnalysis() {
  const { transactions, settings } = useSpend()
  const today = localDateStr()
  const [range, setRange] = useState<Range>('month')
  const [anchor, setAnchor] = useState(today)

  const period: Period = useMemo(
    () => (range === 'week' ? weekOf(anchor) : range === 'year' ? yearOf(anchor) : periodFor(anchor, settings.cycle)),
    [range, anchor, settings.cycle],
  )
  const inRange = useMemo(() => transactions.filter((t) => inPeriod(period, t.date)), [transactions, period])
  const totals = useMemo(() => totalsFor(inRange), [inRange])
  const data = useMemo(() => buckets(range, period, transactions, today), [range, period, transactions, today])

  // Same point in the previous period: e.g. the first 12 days of last month vs the first 12 of this one
  const isCurrent = inPeriod(period, today)
  const compare = useMemo(() => {
    if (range === 'year') return null
    const prev = range === 'week' ? weekOf(shiftDate(period.start, -1)) : shiftPeriod(period, -1, settings.cycle)
    const elapsed = isCurrent ? daysBetween(period.start, today) : daysBetween(period.start, period.end)
    const prevUpTo = { start: prev.start, end: shiftDate(prev.start, Math.min(elapsed, daysBetween(prev.start, prev.end))) }
    const spentPrev = transactions.filter((t) => t.type === 'expense' && inPeriod(prevUpTo, t.date)).reduce((s, t) => s + t.amount, 0)
    return spentPrev > 0 ? totals.expense - spentPrev : null
  }, [range, period, isCurrent, today, transactions, totals.expense, settings.cycle])

  const elapsedDays = Math.max(1, daysBetween(period.start, isCurrent ? today : period.end) + 1)
  const biggest = inRange.filter((t) => t.type === 'expense').sort((a, b) => b.amount - a.amount)[0]
  const topCat = totals.byCategory[0]
  const savingsRate = totals.income > 0 ? (totals.net / totals.income) * 100 : null
  const spentPct = totals.income > 0 ? Math.max(0, (totals.expense / totals.income) * 100) : 0
  const over = totals.income > 0 && totals.net < 0
  // DCA buys from Invest: not spending, but worth seeing next to what you kept
  const invested = inRange.filter((t) => t.source === 'dca').reduce((s, t) => s + t.amount, 0)
  const tagTotals = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of inRange) if (t.type === 'expense') for (const tag of t.tags ?? []) m.set(tag, (m.get(tag) ?? 0) + t.amount)
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
  }, [inRange])

  const catBudgets = range === 'month' ? settings.categoryBudgets ?? {} : {}
  const rangeName = range === 'week' ? 'week' : range === 'year' ? 'year' : 'month'

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Spend" title="Analysis" />

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

      {/* ── Summary: what went out, against what came in, and how this compares to last time ── */}
      <Card className="p-4 sm:p-6 animate-rise" padded={false}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink-muted">{isCurrent ? `Spent this ${rangeName}` : `Spent that ${rangeName}`}</p>
            <p className="mt-1 font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-ink tnum truncate">{thb(totals.expense)}</p>
            {compare !== null && (
              <p className={`mt-1 text-xs font-semibold tnum ${compare <= 0 ? 'text-gain' : 'text-orange-600 dark:text-orange-300'}`}>
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

        {/* Where the income went: spent vs. kept; past 100% the whole bar turns red */}
        {totals.income > 0 && (
          <>
            <div className="mt-5 flex h-2.5 w-full gap-1 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
              {spentPct > 0 && <div className={`rounded-full ${over ? 'bg-loss' : 'bg-orange-400'}`} style={{ width: `${Math.min(100, spentPct)}%` }} />}
              {!over && totals.net > 0 && <div className="rounded-full bg-emerald-500" style={{ width: `${100 - spentPct}%` }} />}
            </div>
            <div className="mt-2 flex items-start justify-between gap-3">
              <p className="min-w-0">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${over ? 'bg-loss' : 'bg-orange-400'}`} />
                  Spent
                </span>
                <span className="mt-1 block text-base sm:text-lg font-display font-extrabold text-ink tnum">
                  {Math.round(spentPct)}% <span className="text-xs font-semibold text-ink-muted">of income</span>
                </span>
              </p>
              <p className="min-w-0 text-right">
                <span className="flex items-center justify-end gap-1.5 text-xs font-semibold text-ink-soft">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${over ? 'bg-loss' : 'bg-emerald-500'}`} />
                  {over ? 'Over by' : 'Kept'}
                </span>
                <span className={`mt-1 block truncate font-display text-base sm:text-lg font-extrabold tnum ${over ? 'text-loss' : 'text-ink'}`}>
                  {thb(Math.abs(totals.net))}
                  {invested > 0 && <span className="text-xs font-semibold text-ink-muted"> · {thb(invested)} invested</span>}
                </span>
              </p>
            </div>
          </>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 font-display text-lg font-extrabold text-ink">Spent per {range === 'year' ? 'month' : 'day'}</h2>
        <Bars data={data} unit={range === 'year' ? 'month' : 'day'} />
      </Card>

      {range === 'month' && <TrendsCard end={period} txns={transactions} cycle={settings.cycle} />}

      {/* ── Quick stats ── */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
        <Card className="p-3 sm:p-4" padded={false}>
          <p className="text-xs text-ink-muted">Daily average</p>
          <p className="mt-1 font-display text-lg font-extrabold tnum text-ink">{thb(totals.expense / elapsedDays)}</p>
        </Card>
        <Card className="p-3 sm:p-4" padded={false}>
          <p className="text-xs text-ink-muted">Top category</p>
          <p className="mt-1 truncate font-display text-lg font-extrabold text-orange-600 dark:text-orange-300">
            {topCat ? getCategory(topCat.categoryId)?.label ?? 'Other' : '—'}
          </p>
          {topCat && <p className="text-xs text-ink-muted tnum">{thb(topCat.amount)}</p>}
        </Card>
        <Card className="p-3 sm:p-4" padded={false}>
          <p className="text-xs text-ink-muted">Biggest expense</p>
          <p className="mt-1 font-display text-lg font-extrabold tnum text-ink">{biggest ? thbCompact(biggest.amount) : '—'}</p>
          {biggest && <p className="truncate text-xs text-ink-muted">{noteTitle(biggest.note) || getCategory(biggest.categoryId)?.label}</p>}
        </Card>
        <Card className="p-3 sm:p-4" padded={false}>
          <p className="text-xs text-ink-muted">Saved of income</p>
          <p className="mt-1 font-display text-lg font-extrabold tnum text-ink">{savingsRate === null ? '—' : `${Math.round(savingsRate)}%`}</p>
          {invested > 0 && <p className="text-xs text-ink-muted tnum">{thb(invested)} invested</p>}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* ── By category ── */}
        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-extrabold text-ink">By category</h2>
            {range === 'month' && (
              <Link to="/spend/settings#category-budgets" className="text-sm font-semibold text-brand hover:underline">
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
                  const state = b ? budgetState(amount, b) : 'ok'
                  const share = totals.expense > 0 ? (amount / totals.expense) * 100 : 0
                  const width = b ? Math.min(100, (amount / b) * 100) : share
                  return (
                    <li key={categoryId}>
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
                          {thb(amount)}
                          <span className="ml-1 text-xs font-semibold text-ink-muted">{b ? `/ ${thb(b)}` : `${Math.round(share)}%`}</span>
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                        <div
                          className={`h-full rounded-full ${state === 'over' ? 'bg-loss' : state === 'near' ? 'bg-warn' : TONES[tone].bar}`}
                          style={{ width: `${width}%` }}
                        />
                      </div>
                      {b && (
                        <p className={`mt-1 text-xs tnum ${state === 'over' ? 'font-semibold text-loss' : state === 'near' ? 'font-semibold text-warn' : 'text-ink-muted'}`}>
                          {state === 'over' ? `Over by ${thb(amount - b)}` : `${thb(b - amount)} left`}
                        </p>
                      )}
                    </li>
                  )
                })}
            </ul>
          )}
        </Card>

        {/* ── Top tags ── */}
        <Card>
          <h2 className="font-display text-lg font-extrabold text-ink">Top tags</h2>
          {tagTotals.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">Add #tags to notes to see where they add up.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {tagTotals.map(([tag, amount]) => (
                <li key={tag} className="flex items-center justify-between py-2.5">
                  <Link to={`/spend/txns?q=${encodeURIComponent(`#${tag}`)}`} className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-700 dark:bg-violet-400/15 dark:text-violet-200">
                    #{tag}
                  </Link>
                  <span className="text-sm font-bold text-ink tnum">{thb(amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

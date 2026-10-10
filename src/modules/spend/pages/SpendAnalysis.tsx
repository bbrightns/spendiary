import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../../components/layout/PageHeader'
import { Card } from '../../../components/ui/Card'
import { SegmentedControl } from '../../../components/ui/SegmentedControl'
import { localDateStr, thb, thbCompact } from '../../../lib/format'
import type { SpendTransaction } from '../../../lib/types'
import { getCategory } from '../categories'
import { budgetState, inPeriod, periodFor, shiftDate, shiftPeriod, totalsFor, type Period } from '../logic'
import { MonthStepper } from '../MonthStepper'
import { TONES } from '../tones'
import { useSpend } from '../useSpend'

type Range = 'week' | 'month' | 'year'

const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000)

/** Monday-to-Sunday week containing `date` */
function weekOf(date: string): Period {
  const offset = (parse(date).getDay() + 6) % 7
  const start = shiftDate(date, -offset)
  return { start, end: shiftDate(start, 6) }
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
      return { key, label: d.toLocaleDateString('en-GB', { month: 'narrow' }), spent: spentOn.get(key) ?? 0, future: key > today.slice(0, 7) }
    })
  }
  const n = daysBetween(p.start, p.end) + 1
  return Array.from({ length: n }, (_, i) => {
    const key = shiftDate(p.start, i)
    const d = parse(key)
    const label = range === 'week' ? d.toLocaleDateString('en-GB', { weekday: 'narrow' }) : i % 5 === 0 ? String(d.getDate()) : ''
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
        {range === 'month' && <MonthStepper value={period} cycle={settings.cycle} onChange={(p) => setAnchor(p.start)} />}
      </div>

      {/* ── Totals ── */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        {[
          { label: 'Income', value: totals.income, cls: totals.income > 0 ? 'text-gain' : 'text-ink' },
          { label: 'Spent', value: totals.expense, cls: 'text-ink' },
          { label: 'Left', value: totals.net, cls: totals.net < 0 ? 'text-loss' : 'text-ink' },
        ].map((s) => (
          <Card key={s.label} className="p-3 sm:p-5 animate-rise" padded={false}>
            <p className="text-xs font-medium text-ink-muted">{s.label}</p>
            <p className={`mt-1 font-display text-base sm:text-2xl font-extrabold tnum truncate ${s.cls}`}>
              {s.label === 'Left' && s.value < 0 ? '−' : ''}
              {thb(Math.abs(s.value))}
            </p>
          </Card>
        ))}
      </div>

      {compare !== null && (
        <p
          className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
            compare <= 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300' : 'bg-orange-50 text-orange-700 dark:bg-orange-400/10 dark:text-orange-300'
          }`}
        >
          {compare <= 0
            ? `${thb(-compare)} less than last ${rangeName} at this point 👏`
            : `${thb(compare)} more than last ${rangeName} at this point`}
        </p>
      )}

      <Card>
        <h2 className="mb-3 font-display text-lg font-extrabold text-ink">Spent per {range === 'year' ? 'month' : 'day'}</h2>
        <Bars data={data} unit={range === 'year' ? 'month' : 'day'} />
      </Card>

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
          {biggest && <p className="truncate text-xs text-ink-muted">{biggest.note?.replace(/#\S+/g, '').trim() || getCategory(biggest.categoryId)?.label}</p>}
        </Card>
        <Card className="p-3 sm:p-4" padded={false}>
          <p className="text-xs text-ink-muted">Saved of income</p>
          <p className="mt-1 font-display text-lg font-extrabold tnum text-ink">{savingsRate === null ? '—' : `${Math.round(savingsRate)}%`}</p>
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

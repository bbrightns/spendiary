import { useMemo, useState } from 'react'
import { Card } from '../../components/ui/Card'
import { thb } from '../../lib/format'
import type { PayCycle, SpendTransaction } from '../../lib/types'
import { getCategory } from './categories'
import { inPeriod, shiftPeriod, totalsFor, type Period } from './logic'
import { TONES } from './tones'

// Two series, checked for color-blind separation and contrast on both themes' surfaces
const INCOME = '#059669'
const SPENT = '#ea580c'
const MONTHS = 6

interface Month {
  period: Period
  label: string
  income: number
  expense: number
  byCategory: Map<string, number>
}

/** Short axis numbers: 0, 50K, 1.2M */
const axisLabel = (v: number) =>
  v >= 1_000_000 ? `${+(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${+(v / 1000).toFixed(1)}K` : String(Math.round(v))

const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Six spending months ending with `end`: income vs spending, and how the top categories moved. */
export function TrendsCard({ end, txns, cycle }: { end: Period; txns: SpendTransaction[]; cycle?: PayCycle }) {
  const [hover, setHover] = useState<number | null>(null)

  const months = useMemo<Month[]>(() => {
    const out: Month[] = []
    let p = end
    for (let i = 0; i < MONTHS; i++) {
      const period = p
      const t = totalsFor(txns.filter((x) => inPeriod(period, x.date)))
      // Label by the month most of the period falls in (pay cycles start late in the month before)
      const mid = parse(period.end)
      out.unshift({
        period,
        label: mid.toLocaleDateString('en-GB', { month: 'short' }),
        income: t.income,
        expense: t.expense,
        byCategory: new Map(t.byCategory.map((c) => [c.categoryId, c.amount])),
      })
      p = shiftPeriod(p, -1, cycle)
    }
    return out
  }, [end, txns, cycle])

  const max = Math.max(1, ...months.flatMap((m) => [m.income, m.expense]))
  // A round-ish top so the gridlines land on readable numbers
  const step = 10 ** Math.floor(Math.log10(max))
  const top = Math.ceil(max / step) * step
  const x = (i: number) => (i / (MONTHS - 1)) * 100
  const y = (v: number) => 100 - (v / top) * 100
  const path = (key: 'income' | 'expense') => months.map((m, i) => `${i ? 'L' : 'M'}${x(i)},${y(m[key])}`).join(' ')

  const shown = months[hover ?? MONTHS - 1]

  // This month's top categories, biggest first, each against its average over the earlier months
  const cats = useMemo(() => {
    return [...months[MONTHS - 1].byCategory.entries()]
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => {
        const series = months.map((m) => m.byCategory.get(id) ?? 0)
        // Average over earlier months with anything logged, so months before tracking began don't count as ฿0
        const earlier = series.slice(0, -1).filter((_, i) => months[i].income + months[i].expense > 0)
        const avg = earlier.length >= 2 ? earlier.reduce((s, v) => s + v, 0) / earlier.length : 0
        const now = series[MONTHS - 1]
        return { id, series, now, change: avg > 0 ? ((now - avg) / avg) * 100 : null }
      })
  }, [months])

  if (months.every((m) => m.income === 0 && m.expense === 0)) return null

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-display text-lg font-extrabold text-ink">Last 6 months</h2>
        {/* Legend, with the hovered (or latest) month's values */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted tnum" aria-live="polite">
          <span className="font-semibold text-ink">{shown.label}</span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded-full" style={{ background: INCOME }} />
            Income <b className="font-bold text-ink">{thb(shown.income)}</b>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded-full" style={{ background: SPENT }} />
            Spent <b className="font-bold text-ink">{thb(shown.expense)}</b>
          </span>
        </div>
      </div>

      {/* Chart: one axis, gridlines with labels, a crosshair on hover */}
      <div className="mt-4 grid gap-x-2" style={{ gridTemplateColumns: '2.5rem minmax(0, 1fr)' }}>
        <div className="relative h-40 text-right text-[11px] text-ink-muted tnum" aria-hidden="true">
          {[1, 0.5, 0].map((f) => (
            <span key={f} className="absolute right-0 -translate-y-1/2" style={{ top: `${(1 - f) * 100}%` }}>
              {axisLabel(top * f)}
            </span>
          ))}
        </div>
        <div className="relative h-40" onMouseLeave={() => setHover(null)}>
          {[0, 50, 100].map((t) => (
            <div key={t} className="pointer-events-none absolute inset-x-0 border-t border-line" style={{ top: `${t}%` }} />
          ))}
          {hover !== null && (
            <div className="pointer-events-none absolute inset-y-0 border-l border-line-strong" style={{ left: `${x(hover)}%` }} />
          )}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
            <path d={path('income')} fill="none" stroke={INCOME} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
            <path d={path('expense')} fill="none" stroke={SPENT} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          {/* Point markers as HTML so they stay round on a stretched chart */}
          {months.map((m, i) =>
            (['income', 'expense'] as const).map((k) => (
              <span
                key={`${i}-${k}`}
                className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface ${hover === i || (hover === null && i === MONTHS - 1) ? 'h-2.5 w-2.5' : 'h-2 w-2'}`}
                style={{ left: `${x(i)}%`, top: `${y(m[k])}%`, background: k === 'income' ? INCOME : SPENT }}
              />
            )),
          )}
          {/* Hit areas, wider than the marks */}
          {/* Clipped so the edge columns don't widen the page */}
          <div className="absolute inset-0 overflow-hidden">
            {months.map((m, i) => (
              <button
                key={m.period.start}
                type="button"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onClick={() => setHover(i)}
                aria-label={`${m.label}: income ${thb(m.income)}, spent ${thb(m.expense)}`}
                className="absolute inset-y-0 -translate-x-1/2 cursor-pointer focus-visible:outline-none"
                style={{ left: `${x(i)}%`, width: `${100 / (MONTHS - 1)}%` }}
              />
            ))}
          </div>
        </div>
        <span />
        <div className="relative mt-1 h-4 text-[11px] text-ink-muted" aria-hidden="true">
          {months.map((m, i) => (
            <span
              key={m.period.start}
              className={`absolute -translate-x-1/2 ${hover === i ? 'font-semibold text-ink' : ''}`}
              style={{ left: `${x(i)}%` }}
            >
              {m.label}
            </span>
          ))}
        </div>
      </div>

      {/* Table view for screen readers */}
      <table className="sr-only">
        <caption>Income and spending, last 6 months</caption>
        <thead>
          <tr>
            <th>Month</th>
            <th>Income</th>
            <th>Spent</th>
          </tr>
        </thead>
        <tbody>
          {months.map((m) => (
            <tr key={m.period.start}>
              <td>{m.label}</td>
              <td>{thb(m.income)}</td>
              <td>{thb(m.expense)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {cats.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-sm font-semibold text-ink-soft">Top categories</p>
          <ul className="divide-y divide-line">
            {cats.map((c) => {
              const cat = getCategory(c.id)
              const tone = TONES[cat?.tone ?? 'slate']
              const peak = Math.max(1, ...c.series)
              const Icon = cat?.icon
              return (
                <li key={c.id} className="flex items-center gap-3 py-2.5">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tone.chip}`}>{Icon && <Icon className="h-4 w-4" />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{cat?.label ?? 'Other'}</span>
                    <span className="block text-xs text-ink-muted tnum">
                      {thb(c.now)} this month
                      {c.change !== null && Math.abs(c.change) >= 1 && (
                        <>
                          {' · '}
                          <span className={c.change > 15 ? 'font-semibold text-warn' : ''}>
                            {c.change > 0 ? '↑' : '↓'} {Math.abs(Math.round(c.change))}% vs avg
                          </span>
                        </>
                      )}
                    </span>
                  </span>
                  {/* Six small bars, this month last */}
                  <span className="flex h-8 w-24 shrink-0 items-end gap-[2px]" aria-label={`${cat?.label ?? 'Other'} by month: ${c.series.map((v, i) => `${months[i].label} ${thb(v)}`).join(', ')}`} role="img">
                    {c.series.map((v, i) => (
                      <span
                        key={i}
                        className={`flex-1 rounded-t-[3px] ${i === MONTHS - 1 ? tone.bar : 'bg-slate-300 dark:bg-slate-600'}`}
                        style={{ height: `${Math.max(6, (v / peak) * 100)}%` }}
                      />
                    ))}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </Card>
  )
}

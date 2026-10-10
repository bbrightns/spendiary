import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../components/ui/Card'
import { WalletIcon } from '../../components/icons'
import { localDateStr, thb, thbCompact } from '../../lib/format'
import { dayAllowance, inPeriod, periodFor, periodLabel, totalsFor } from './logic'
import { useSpend } from './useSpend'

/** Dashboard card: this spending month at a glance, linking into Spend. */
export function SpendSnapshotCard() {
  const { transactions, settings } = useSpend()
  const today = localDateStr()
  const period = useMemo(() => periodFor(today, settings.cycle), [today, settings.cycle])
  const totals = useMemo(() => totalsFor(transactions.filter((t) => inPeriod(period, t.date))), [transactions, period])
  const budget = settings.monthlyBudget ?? 0
  const day = useMemo(() => dayAllowance(budget, period, transactions, today), [budget, period, transactions, today])

  if (transactions.length === 0 && budget === 0) {
    return (
      <Link to="/spend" className="block">
        <Card className="flex items-center justify-between gap-3 py-3.5 hover:shadow-[var(--shadow-lift)] transition-shadow">
          <span className="flex items-center gap-2.5 text-sm font-semibold text-ink">
            <WalletIcon className="h-5 w-5 text-brand" />
            Track day-to-day spending in Spend
          </span>
          <span className="text-sm font-semibold text-brand">Open →</span>
        </Card>
      </Link>
    )
  }

  const stats = [
    { label: 'In', value: thbCompact(totals.income), cls: totals.income > 0 ? 'text-gain' : 'text-ink' },
    { label: 'Out', value: thbCompact(totals.expense), cls: 'text-ink' },
    { label: 'Left', value: `${totals.net < 0 ? '−' : ''}${thbCompact(Math.abs(totals.net))}`, cls: totals.net < 0 ? 'text-loss' : 'text-ink' },
  ]

  return (
    <Link to="/spend" className="block" aria-label="Open Spend">
      <Card className="@container hover:shadow-[var(--shadow-lift)] transition-shadow">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Spend · cash flow</p>
            <p className="mt-0.5 truncate text-sm text-ink-muted">{periodLabel(period, settings.cycle)}</p>
          </div>
          <span className="shrink-0 text-sm font-semibold text-brand">Open Spend →</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 @min-[34rem]:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl bg-surface-muted/60 px-2.5 py-2">
              <p className="text-xs text-ink-muted">{s.label}</p>
              <p className={`font-display text-base @min-[26rem]:text-lg font-extrabold tnum truncate ${s.cls}`}>{s.value}</p>
            </div>
          ))}
          {budget > 0 && (
            <div className="col-span-3 rounded-xl bg-surface-muted/60 px-2.5 py-2 @min-[34rem]:col-span-1">
              <p className="text-xs text-ink-muted">Left today</p>
              <p className={`font-display text-base @min-[26rem]:text-lg font-extrabold tnum truncate ${day.leftToday < 0 ? 'text-loss' : 'text-ink'}`}>
                {day.leftToday < 0 ? '−' : ''}
                {thb(Math.abs(day.leftToday))}
              </p>
            </div>
          )}
        </div>
      </Card>
    </Link>
  )
}

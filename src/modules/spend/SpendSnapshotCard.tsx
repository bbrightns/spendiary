import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../components/ui/Card'
import { WalletIcon } from '../../components/icons'
import { localDateStr, thb, thbCompact } from '../../lib/format'
import { dayAllowance, inPeriod, periodFor, periodLabel, totalsFor, type DayStatus } from './logic'
import { useSpend } from './useSpend'

const STATUS: Record<DayStatus, { label: string; chip: string }> = {
  ok: { label: 'On track', chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300' },
  careful: { label: 'Careful', chip: 'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300' },
  over: { label: 'Over today', chip: 'bg-rose-100 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300' },
}

const signed = (n: number, fmt: (v: number) => string) => `${n < 0 ? '−' : ''}${fmt(Math.abs(n))}`

/** Dashboard card: today's allowance and this spending cycle at a glance, linking into Spend. */
export function SpendSnapshotCard() {
  const { transactions, settings } = useSpend()
  const today = localDateStr()
  const period = useMemo(() => periodFor(today, settings.cycle), [today, settings.cycle])
  const totals = useMemo(() => totalsFor(transactions.filter((t) => inPeriod(period, t.date))), [transactions, period])
  const budget = settings.monthlyBudget ?? 0
  const day = useMemo(() => dayAllowance(budget, period, transactions, today), [budget, period, transactions, today])

  if (transactions.length === 0 && budget === 0) {
    return (
      <Link to="/" className="block">
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

  const hasBudget = budget > 0
  const status = STATUS[day.status]
  // Share of this cycle's income already spent; with no income yet, any spending fills the bar
  const spentPct = totals.income > 0 ? Math.min(1, totals.expense / totals.income) : totals.expense > 0 ? 1 : 0
  const overspent = totals.net < 0
  const barCls = overspent ? 'bg-loss' : spentPct > 0.85 ? 'bg-warn' : 'bg-brand'

  return (
    <Link to="/" className="group block" aria-label="Open Spend">
      <Card className="@container hover:shadow-[var(--shadow-lift)] transition-shadow">
        {/* Same title row as the hub cards below (Port Allocation, Cash & Liquidity, Liabilities) */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
              <WalletIcon className="h-4 w-4" />
            </div>
            <h2 className="shrink-0 font-display text-base font-bold text-ink">Spending</h2>
            <span className="truncate text-xs font-medium text-ink-muted">· {periodLabel(period, settings.cycle)}</span>
          </div>
          <span className="shrink-0 text-xs font-semibold text-brand group-hover:underline">Spend →</span>
        </div>

        <div className={`mt-4 grid gap-4 ${hasBudget ? '@min-[34rem]:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] @min-[34rem]:gap-6' : ''}`}>
          {hasBudget && (
            <div className="min-w-0 @min-[34rem]:border-r @min-[34rem]:border-line @min-[34rem]:pr-6">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-ink-muted">You can spend today</p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-2xs font-semibold ${status.chip}`}>{status.label}</span>
              </div>
              <p className={`mt-1 font-display text-3xl font-extrabold tnum truncate ${day.leftToday < 0 ? 'text-loss' : 'text-ink'}`}>
                {signed(day.leftToday, thb)}
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">
                of {thb(day.allowance)} for today · {day.daysLeft} {day.daysLeft === 1 ? 'day' : 'days'} left
              </p>
            </div>
          )}

          <div className={`min-w-0 ${hasBudget ? 'border-t border-line pt-4 @min-[34rem]:border-t-0 @min-[34rem]:pt-0' : ''}`}>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-xs font-medium text-ink-muted">Left from this cycle's income</p>
              <p className={`font-display text-lg font-extrabold tnum ${overspent ? 'text-loss' : 'text-ink'}`}>{signed(totals.net, thbCompact)}</p>
            </div>
            <div
              className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface-muted"
              role="img"
              aria-label={`Spent ${Math.round(spentPct * 100)}% of income this cycle`}
            >
              <div className={`h-full rounded-full ${barCls}`} style={{ width: `${spentPct * 100}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-ink-muted">
                <span className={`h-2 w-2 rounded-full ${barCls}`} />
                Spent <span className="font-semibold text-ink tnum">{thbCompact(totals.expense)}</span>
              </span>
              <span className="flex items-center gap-1.5 text-ink-muted">
                Received <span className="font-semibold text-gain tnum">{thbCompact(totals.income)}</span>
              </span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  )
}

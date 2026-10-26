import { useMemo, useState } from 'react'
import { useData } from '../store/DataContext'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { FilterChip } from '../components/ui/FilterChip'
import { PnLText } from '../components/ui/PnL'
import { GuideTour } from '../components/guide/GuideTour'
import { usePageGuide } from '../hooks/usePageGuide'
import { ASSET_META } from '../lib/calc'
import { pct, signedThb, thb } from '../lib/format'
import {
  ALL_TIME_PERIOD,
  MONTH_LABELS,
  availablePeriods,
  describePeriod,
  excludeDeletedHoldings,
  isAllTime,
  portfolioValueChange,
  resolvePeriodRange,
  summarizeActivity,
  type LogPeriod,
} from '../lib/activitySummary'
import { ClockIcon, PieChartIcon } from '../components/icons'

const SELECT_CLASS =
  'h-9 rounded-xl border border-line-strong bg-surface-muted focus:bg-surface px-2.5 text-xs font-semibold text-ink outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/15 cursor-pointer'

/** Small labelled figure used in the money-flow strip. */
function Stat({ label, value, tone = 'neutral', hint }: {
  label: string
  value: string
  tone?: 'neutral' | 'gain' | 'loss'
  hint?: string
}) {
  const toneClass = tone === 'gain' ? 'text-gain-ink' : tone === 'loss' ? 'text-loss-ink' : 'text-ink'
  return (
    <div className="rounded-2xl bg-surface-muted px-3.5 py-3">
      <p className="text-xs font-semibold text-ink-muted">{label}</p>
      <p className={`mt-1 font-display text-lg font-bold tnum leading-tight ${toneClass}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-faint leading-snug">{hint}</p>}
    </div>
  )
}

export function ActivitySummary() {
  const { data, usdThb } = useData()
  const {
    steps,
    isRunning,
    currentStepIndex,
    startTour,
    endTour,
    finishTour,
    nextStep,
    prevStep,
  } = usePageGuide('summary')

  const logs = useMemo(
    () => excludeDeletedHoldings(data.holdingLogs ?? [], new Set(data.holdings.map((h) => h.id))),
    [data.holdingLogs, data.holdings],
  )
  const periods = useMemo(() => availablePeriods(logs), [logs])

  // Start on the current month when it has activity, otherwise show everything
  const [period, setPeriod] = useState<LogPeriod>(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    if (periods.monthsByYear[year]?.includes(month)) return { year, month }
    return ALL_TIME_PERIOD
  })

  const summary = useMemo(
    () => summarizeActivity(logs, period, usdThb),
    [logs, period, usdThb],
  )
  const valueChange = useMemo(
    () => portfolioValueChange(data.portfolioHistory, period),
    [data.portfolioHistory, period],
  )

  // Thai month names, Gregorian year to match the year dropdown
  const TH_DATE = 'en-GB'
  const range = resolvePeriodRange(period)
  const rangeCaption = range
    ? `${range.start.toLocaleDateString(TH_DATE, { day: 'numeric', month: 'short', year: 'numeric' })} – ${range.end.toLocaleDateString(TH_DATE, { day: 'numeric', month: 'short', year: 'numeric' })}`
    : summary.firstLogAt && summary.lastLogAt
      ? `${new Date(summary.firstLogAt).toLocaleDateString(TH_DATE, { day: 'numeric', month: 'short', year: 'numeric' })} – ${new Date(summary.lastLogAt).toLocaleDateString(TH_DATE, { day: 'numeric', month: 'short', year: 'numeric' })}`
      : 'No history yet'

  const now = new Date()
  const isThisMonth =
    period.year === now.getFullYear() && period.month === now.getMonth() + 1
  const isThisYear = period.year === now.getFullYear() && period.month === 'all'

  const goToThisMonth = () => setPeriod({ year: now.getFullYear(), month: now.getMonth() + 1 })
  const goToThisYear = () => setPeriod({ year: now.getFullYear(), month: 'all' })
  const goToAllTime = () => setPeriod(ALL_TIME_PERIOD)

  const selectYear = (value: string) => {
    if (value === 'all') {
      setPeriod(ALL_TIME_PERIOD)
      return
    }
    const year = Number(value)
    const months = periods.monthsByYear[year] ?? []
    const keepMonth =
      period.month !== 'all' && months.includes(period.month) ? period.month : 'all'
    setPeriod({ year, month: keepMonth })
  }

  const selectMonth = (value: string) => {
    if (period.year === 'all') return
    setPeriod({ year: period.year, month: value === 'all' ? 'all' : Number(value) })
  }

  const selectableMonths = period.year === 'all' ? [] : periods.monthsByYear[period.year] ?? []

  const netProfit = summary.netProfit
  const maxMonthAbs = Math.max(1, ...summary.months.map((m) => Math.abs(m.net)))
  const showMonthly = summary.months.length > 1

  return (
    <>
      <PageHeader
        eyebrow="Records"
        title="Profit & loss summary"
        subtitle="Money you have actually made or lost in the selected period (from sales and dividends received)"
        onStartGuide={startTour}
      />

      {/* ── Period selector ── */}
      <Card id="guide-summary-period" className="mb-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1.5 -my-1.5">
            <FilterChip active={isThisMonth} onClick={goToThisMonth} aria-label="Show this month">
              This month
            </FilterChip>
            <FilterChip active={isThisYear} onClick={goToThisYear} aria-label="Show this year">
              This year
            </FilterChip>
            <FilterChip active={isAllTime(period)} onClick={goToAllTime} aria-label="Show all time">
              All time
            </FilterChip>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <label htmlFor="summary-year" className="text-xs font-semibold text-ink-muted">
              Period
            </label>
            <select
              id="summary-year"
              className={SELECT_CLASS}
              value={period.year === 'all' ? 'all' : String(period.year)}
              onChange={(e) => selectYear(e.target.value)}
              aria-label="Select year"
            >
              <option value="all">All years</option>
              {periods.years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <select
              id="summary-month"
              className={`${SELECT_CLASS} disabled:cursor-not-allowed disabled:opacity-50`}
              value={period.month === 'all' ? 'all' : String(period.month)}
              onChange={(e) => selectMonth(e.target.value)}
              disabled={period.year === 'all'}
              aria-label="Select month"
            >
              <option value="all">All months</option>
              {selectableMonths.map((month) => (
                <option key={month} value={month}>
                  {MONTH_LABELS[month - 1]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="mt-3 text-xs text-ink-muted">
          <span className="font-semibold text-ink-soft">{describePeriod(period)}</span>
          <span className="text-ink-faint"> · {rangeCaption} · {summary.transactionCount} transactions</span>
        </p>
      </Card>

      {summary.transactionCount === 0 ? (
        <Card>
          <EmptyState
            icon={<ClockIcon className="h-7 w-7" />}
            title={`No investment activity in ${describePeriod(period)}`}
            description="Buys, sales and dividends you record in your portfolio are summed up here. Try another period to see older activity."
            accent="var(--color-brand)"
            action={
              <Button variant="secondary" size="sm" onClick={goToAllTime} className="cursor-pointer">
                View all
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          {/* ── Headline: what was actually made ── */}
          <Card id="guide-summary-hero" className="mb-4">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-ink-muted">
                  Net profit · {describePeriod(period)}
                </p>
                <p
                  className={`mt-1.5 font-display text-4xl font-extrabold tnum leading-none ${
                    netProfit > 0 ? 'text-gain-ink' : netProfit < 0 ? 'text-loss-ink' : 'text-ink'
                  }`}
                >
                  {signedThb(netProfit)}
                </p>
                <p className="mt-2.5 max-w-md text-sm text-ink-muted leading-relaxed">
                  Profit from things you sold, plus dividends you received. Price changes on things you still hold are not counted here.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:w-[380px] shrink-0">
                <Stat
                  label="Profit from sales"
                  value={signedThb(summary.realizedPnL)}
                  tone={summary.realizedPnL > 0 ? 'gain' : summary.realizedPnL < 0 ? 'loss' : 'neutral'}
                  hint={
                    summary.costBasisSold > 0
                      ? `${summary.sellCount} ${summary.sellCount === 1 ? 'sale' : 'sales'} · ${pct(summary.realizedPnLPercent)} on a cost of ${thb(summary.costBasisSold)}`
                      : 'No sales in this period'
                  }
                />
                <Stat
                  label="Dividends received"
                  value={signedThb(summary.dividendsNet)}
                  tone={summary.dividendsNet > 0 ? 'gain' : 'neutral'}
                  hint={
                    summary.withholdingTax > 0
                      ? `After ${thb(summary.withholdingTax)} tax · ${thb(summary.dividendsGross)} before tax`
                      : summary.dividendCount > 0
                        ? 'No tax withheld'
                        : 'No dividends in this period'
                  }
                />
              </div>
            </div>

            {/* Money flow */}
            <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3 border-t border-line/60 pt-4">
              <Stat label="Money put in" value={thb(summary.netDeposits)} hint={`${summary.buyCount} ${summary.buyCount === 1 ? 'buy' : 'buys'} · sale money not included`} />
              <Stat label="Money from sales" value={thb(summary.proceeds)} hint={`${summary.sellCount} ${summary.sellCount === 1 ? 'sale' : 'sales'}`} />
              <Stat label="All transactions" value={String(summary.transactionCount)} hint={`${summary.buyCount} buys · ${summary.sellCount} sales · ${summary.dividendCount} dividends`} />
              <Stat label="Edits" value={String(summary.editCount)} hint="Price and detail updates" tone="neutral" />
            </div>
          </Card>

          {/* ── Month by month ── */}
          {showMonthly && (
            <Card className="mb-4">
              <h2 className="font-display text-lg font-extrabold text-ink">By month</h2>
              <p className="mt-0.5 text-xs text-ink-muted">
                Sales profit and dividends for each month — green means a profit month
              </p>
              <ul className="mt-4 flex flex-col gap-2.5">
                {summary.months.map((month) => {
                  const hasProfit = month.net !== 0
                  const width = hasProfit
                    ? Math.max(3, Math.round((Math.abs(month.net) / maxMonthAbs) * 100))
                    : 3
                  return (
                    <li key={month.key} className="flex items-center gap-3">
                      <span className="w-14 shrink-0 text-xs font-semibold text-ink-muted tnum">
                        {month.label}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span
                          className={`block h-2.5 rounded-full ${
                            !hasProfit ? 'bg-line-strong' : month.net > 0 ? 'bg-gain' : 'bg-loss'
                          }`}
                          style={{ width: `${width}%`, opacity: 0.85 }}
                          aria-hidden
                        />
                      </span>
                      <span className="w-28 shrink-0 text-right text-xs font-bold tnum">
                        {hasProfit ? (
                          <PnLText value={month.net} className="text-xs" />
                        ) : (
                          <span className="text-ink-faint" title="No sales profit this month">
                            —
                          </span>
                        )}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </Card>
          )}

          {/* ── Per-asset breakdown ── */}
          <Card id="guide-summary-assets" padded={false} className="mb-4 overflow-hidden">
            <div className="px-5 pt-5 pb-3">
              <h2 className="font-display text-lg font-extrabold text-ink">Where the profit came from</h2>
              <p className="mt-0.5 text-xs text-ink-muted">
                Only showing assets with activity in {describePeriod(period)}
              </p>
            </div>
            <div className="overflow-x-auto">
              {/* Narrow screens show Asset · Net only, so nothing gets clipped off-screen */}
              <table className="w-full text-left text-sm border-collapse min-w-[320px] sm:min-w-[680px]">
                <thead>
                  <tr className="border-y border-line bg-surface-muted/60 text-xs font-bold text-ink-muted">
                    <th className="py-2.5 px-4 sm:px-5">Asset</th>
                    <th className="py-2.5 px-3 text-right hidden sm:table-cell">Trades</th>
                    <th className="py-2.5 px-3 text-right hidden md:table-cell">Invested</th>
                    <th className="py-2.5 px-3 text-right hidden md:table-cell">Sold for</th>
                    <th className="py-2.5 px-3 text-right hidden sm:table-cell">Sales profit</th>
                    <th className="py-2.5 px-3 text-right hidden sm:table-cell">Dividends</th>
                    <th className="py-2.5 px-4 sm:px-5 text-right">Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {summary.rows.map((row) => {
                    const meta = ASSET_META[row.assetClass]
                    return (
                      <tr key={row.key} className="hover:bg-surface-muted/40 transition-colors">
                        <td className="py-3 px-4 sm:px-5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-bold"
                              style={{
                                color: meta?.color ?? 'var(--color-brand)',
                                background: `color-mix(in srgb, ${meta?.color ?? '#6366f1'} 14%, transparent)`,
                              }}
                              aria-hidden
                            >
                              {(row.ticker || row.name).slice(0, 2).toUpperCase()}
                            </span>
                            {/* Constrained on narrow screens so the money columns stay on screen */}
                            <span className="min-w-0 max-w-[170px] sm:max-w-none">
                              <span className="block truncate font-semibold text-ink leading-tight">
                                {row.name}
                              </span>
                              <span className="block truncate text-xs text-ink-muted leading-tight">
                                {row.ticker || meta?.label}
                              </span>
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right text-ink-muted tnum hidden sm:table-cell">{row.trades}</td>
                        <td className="py-3 px-3 text-right text-ink-muted tnum hidden md:table-cell">
                          {row.invested > 0 ? thb(row.invested) : '—'}
                        </td>
                        <td className="py-3 px-3 text-right text-ink-muted tnum hidden md:table-cell">
                          {row.proceeds > 0 ? thb(row.proceeds) : '—'}
                        </td>
                        <td className="py-3 px-3 text-right tnum whitespace-nowrap hidden sm:table-cell">
                          {row.realizedPnL !== 0 ? <PnLText value={row.realizedPnL} /> : <span className="text-ink-faint">—</span>}
                        </td>
                        <td className="py-3 px-3 text-right tnum hidden sm:table-cell">
                          {row.dividendsNet !== 0 ? (
                            <PnLText value={row.dividendsNet} />
                          ) : (
                            <span className="text-ink-faint">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 sm:px-5 text-right font-bold tnum whitespace-nowrap">
                          {row.net !== 0 ? <PnLText value={row.net} /> : <span className="text-ink-faint">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* ── Portfolio value change (snapshot based) ── */}
          <Card className="mb-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h2 className="font-display text-lg font-extrabold text-ink">How much your portfolio value changed</h2>
                <p className="mt-0.5 text-xs text-ink-muted leading-relaxed max-w-xl">
                  Compares your total portfolio value at the start and end of the period. It includes market moves and money added or withdrawn, so it can differ from the net profit above.
                </p>
              </div>
              <div className="shrink-0 sm:text-right">
                {valueChange ? (
                  <>
                    <p className="font-display text-xl font-bold tnum">
                      <PnLText value={valueChange.change} />
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted tnum">
                      {thb(valueChange.startValue)} → {thb(valueChange.endValue)}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-faint">
                      {new Date(valueChange.startDate).toLocaleDateString(TH_DATE, { day: 'numeric', month: 'short', year: 'numeric' })}
                      {' – '}
                      {new Date(valueChange.endDate).toLocaleDateString(TH_DATE, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-display text-xl font-bold text-ink-faint">—</p>
                    <p className="mt-0.5 text-xs text-ink-muted max-w-[220px] sm:ml-auto">
                      No daily portfolio value data covers this period yet (we keep the last 365 days).
                    </p>
                  </>
                )}
              </div>
            </div>
          </Card>

          {/* ── How this is calculated ── */}
          <div className="flex items-start gap-3 rounded-2xl bg-surface-muted px-4 py-3.5">
            <PieChartIcon className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />
            <p className="text-xs text-ink-muted leading-relaxed">
              <span className="font-semibold text-ink-soft">Net profit = profit from sales + dividends received</span>{' '}
              Sales profit is counted on the day you sell (sale money minus what you paid). Dividends are counted after tax.
              Cash moving in and out of your accounts and fixed costs are not counted, and things you still hold are not re-priced on this page.
            </p>
          </div>
        </>
      )}

      <GuideTour
        isOpen={isRunning}
        steps={steps}
        currentStepIndex={currentStepIndex}
        onNext={nextStep}
        onPrev={prevStep}
        onClose={endTour}
        onFinish={finishTour}
      />
    </>
  )
}

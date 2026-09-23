import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useData } from '../store/DataContext'
import { useToast } from '../store/ToastContext'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { DonutChart } from '../components/charts/DonutChart'
import { InteractiveNetWorthChart } from '../components/charts/InteractiveNetWorthChart'
import { PnLPill, PnLText } from '../components/ui/PnL'
import { LiabilitiesModal } from '../components/forms/LiabilitiesModal'
import { AiImportModal } from '../components/forms/AiImportModal'
import { GuideTour } from '../components/guide/GuideTour'
import { usePageGuide } from '../hooks/usePageGuide'
import {
  ArrowUpRightIcon,
  CheckIcon,
  DebtIcon,
  HelpCircleIcon,
  PortfolioIcon,
  SparkleIcon,
  WalletIcon,
} from '../components/icons'
import {
  ASSET_META,
  DEBT_CATEGORIES,
  allocations,
  calculateAnnualCashInterest,
  detectBankPreset,
  getLiabilityDueStatus,
  isLiabilityActionableThisMonth,
  netWorth,
  portfolioSummary,
  shouldConfirmBuy,
  totalCash,
  totalLiabilities,
  totalMonthlyDebtPayment,
} from '../lib/calc'
import { getRandomGreeting, moneyCompact, thb, thbCompact } from '../lib/format'

// Distinct colors for cash account segments — cycles if >8 accounts
const CASH_COLORS = [
  'var(--color-cash)', // emerald
  'var(--color-brand)', // indigo
  'var(--color-crypto)', // amber
  'var(--color-stocks)', // sky
  'var(--color-funds)', // violet
  'var(--color-real-estate)', // teal
  '#f97316', // orange
  '#64748b', // slate
]

export function Dashboard() {
  const { data, recordNetWorthSnapshot, usdThb, payLiabilityInstallment, undoLiabilityPayment } = useData()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [liabilitiesOpen, setLiabilitiesOpen] = useState(false)
  const [selectedLiabilityId, setSelectedLiabilityId] = useState<string | null>(null)
  const [aiImportOpen, setAiImportOpen] = useState(false)
  const {
    steps,
    isRunning,
    currentStepIndex,
    startTour,
    endTour,
    finishTour,
    nextStep,
    prevStep,
  } = usePageGuide('dashboard')

  const hasAnything =
    data.holdings.length > 0 ||
    data.dcaPlans.length > 0 ||
    data.cashAccounts.length > 0 ||
    (data.liabilities?.length ?? 0) > 0

  const portfolio = useMemo(() => portfolioSummary(data.holdings), [data.holdings])
  const alloc = useMemo(() => allocations(data.holdings), [data.holdings])
  const allocSegments = useMemo(
    () =>
      alloc.map((a) => ({
        label: ASSET_META[a.assetClass].plural,
        value: a.value,
        color: ASSET_META[a.assetClass].color,
      })),
    [alloc],
  )
  const cash = useMemo(() => totalCash(data, usdThb), [data.cashAccounts, usdThb])
  const debts = useMemo(() => totalLiabilities(data), [data.liabilities])
  const monthlyDebt = useMemo(() => totalMonthlyDebtPayment(data), [data.liabilities])
  const grossAssets = portfolio.value + cash
  const debtRatio = grossAssets > 0 ? (debts / grossAssets) * 100 : (debts > 0 ? 100 : 0)
  const nw = useMemo(() => netWorth(data, usdThb), [data.cashAccounts, data.holdings, data.liabilities, usdThb])
  const cashInterest = useMemo(
    () => calculateAnnualCashInterest(data.cashAccounts, usdThb),
    [data.cashAccounts, usdThb],
  )
  const cashYieldRate = useMemo(
    () => (cash > 0 && cashInterest > 0 ? (cashInterest / cash) * 100 : 0),
    [cash, cashInterest],
  )

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  // Randomized time-aware greeting
  const greeting = useMemo(() => getRandomGreeting(), [])

  // Record today's net worth snapshot whenever nw updates
  useEffect(() => {
    if (nw > 0) recordNetWorthSnapshot(nw)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nw])

  const dcaActions = useMemo(
    () => data.dcaPlans.filter((p) => shouldConfirmBuy(p)),
    [data.dcaPlans],
  )

  const debtActions = useMemo(() => {
    return (data.liabilities ?? []).filter((l) => isLiabilityActionableThisMonth(l))
  }, [data.liabilities])

  const hasOverdueDebts = useMemo(() => {
    return debtActions.some((l) => getLiabilityDueStatus(l).status === 'overdue')
  }, [debtActions])

  if (!hasAnything) {
    return (
      <>
        <PageHeader eyebrow="Overview" title="Dashboard" />
        <Card>
          <EmptyState
            icon={<SparkleIcon className="h-7 w-7" />}
            title="Welcome to Spendiary"
            description="Your private cockpit for investments, DCA plans, and transfer schedules, all in Thai Baht."
            action={
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button variant="primary" onClick={() => setAiImportOpen(true)}>
                  <SparkleIcon className="h-4 w-4 mr-1.5" />
                  Import Portfolio & Cash (AI)
                </Button>
                <Button variant="secondary" onClick={() => navigate('/portfolio')}>
                  Go to Portfolio
                </Button>
              </div>
            }
          />
        </Card>
        <AiImportModal open={aiImportOpen} onClose={() => setAiImportOpen(false)} />
      </>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Header Row with Greetings & Quick Action Badges */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between mb-4">
        <div>
          {today && (
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand">
              {today}
            </p>
          )}
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold leading-none tracking-tight text-ink [text-wrap:balance]">
              {`${greeting}${data.userName ? `, ${data.userName}` : ''}`}
            </h1>
            <button
              type="button"
              onClick={startTour}
              title="Page Guide"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-brand bg-brand/10 hover:bg-brand/20 dark:bg-brand/20 dark:text-brand-ink dark:border-brand/40 active:scale-95 transition-all border border-brand/20 cursor-pointer shadow-xs"
            >
              <HelpCircleIcon className="w-3.5 h-3.5" />
              <span>Guide</span>
            </button>
          </div>
          <p className="mt-1.5 text-sm text-ink-muted">
            Here's where your wealth and cash flow stand.
          </p>
        </div>

        {/* Global actionable badges & Quick Import (aligned top-right on wide screen, new line left-aligned on narrow) */}
        <div className="flex flex-wrap items-center justify-start lg:justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setAiImportOpen(true)}
            title="Import Portfolio & Cash with AI"
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface hover:bg-surface-muted text-ink dark:border-white/10 px-3.5 py-1.5 text-xs font-medium transition-all active:scale-95 cursor-pointer shadow-xs"
          >
            <SparkleIcon className="h-3.5 w-3.5 text-brand" />
            <span>Import (AI/JSON)</span>
          </button>

          {debtActions.length > 0 && (
            <div id="guide-dashboard-debt-alert">
              <button
                type="button"
                onClick={() => navigate('/debts')}
                aria-label={`View ${debtActions.length} debts due for payment`}
                className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all active:scale-95 cursor-pointer shadow-xs ${
                  hasOverdueDebts
                    ? 'border-rose-500/30 bg-rose-500/15 text-rose-700 dark:text-rose-300 hover:bg-rose-500 hover:text-white dark:hover:bg-rose-600'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 hover:bg-amber-500 hover:text-white dark:hover:bg-amber-600'
                }`}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full text-xs font-bold text-white ${
                    hasOverdueDebts ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'
                  }`}
                >
                  {debtActions.length}
                </span>
                <span>
                  {hasOverdueDebts
                    ? `${debtActions.length} Overdue ${debtActions.length === 1 ? 'Debt' : 'Debts'}`
                    : `${debtActions.length} ${debtActions.length === 1 ? 'Debt' : 'Debts'} Due`}
                </span>
              </button>
            </div>
          )}

          {dcaActions.length > 0 && (
            <div id="guide-dashboard-dca">
              <button
                type="button"
                onClick={() => navigate('/dca')}
                aria-label={`View ${dcaActions.length} DCA ${dcaActions.length === 1 ? 'buy' : 'buys'} ready to confirm`}
                className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand-soft/70 px-3.5 py-1.5 text-xs font-medium text-brand-ink transition-all hover:bg-brand hover:text-white dark:hover:bg-brand active:scale-95 cursor-pointer shadow-xs"
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                  {dcaActions.length}
                </span>
                <span>{dcaActions.length} DCA Ready</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── ROW 1: Net Worth Master Hero (Full Width Bento) ── */}
      <div id="guide-dashboard-networth">
        <Card
          padded={false}
          className="relative overflow-hidden bg-gradient-to-br from-white via-white to-brand-soft/40 dark:from-canvas dark:via-canvas dark:to-surface-muted/50 border border-line dark:border-white/10 shadow-[var(--shadow-soft)] animate-rise h-full flex flex-col justify-between"
        >
          {/* Ambient subtle glow inside card */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand/5 dark:bg-brand/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-emerald-500/5 dark:bg-emerald-500/10 blur-3xl" />

          {/* Top Main Stats Area */}
          <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-start p-6 sm:p-7">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-ink-muted dark:text-white/70">
                <WalletIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-semibold uppercase tracking-wider">Total Net Worth</span>
              </div>
              <p className="font-display text-4xl sm:text-5xl font-extrabold leading-tight tracking-tight tnum text-ink dark:text-white">
                {thb(nw)}
              </p>

              <div className="pt-1 flex flex-wrap items-center gap-2.5">
                <PnLPill value={portfolio.pnl} size="md" />
                <span className="text-xs text-ink-muted dark:text-white/70 font-medium">unrealised</span>
                {debts > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLiabilityId(null)
                      setLiabilitiesOpen(true)
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted dark:bg-white/12 px-3 py-1 text-xs font-semibold text-ink-soft dark:text-white/90 shadow-xs border border-line dark:border-white/10 transition-colors hover:bg-line/70 dark:hover:bg-white/20 hover:text-ink dark:hover:text-white cursor-pointer whitespace-nowrap"
                    aria-label="Manage liabilities"
                  >
                    📉 {debtRatio.toFixed(1)}% Debt Ratio ({thbCompact(-debts)})
                  </button>
                )}
                {data.retirement?.monthlySpend && data.retirement.monthlySpend > 0 ? (
                  <Link
                    to="/retirement"
                    className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted dark:bg-white/12 px-3 py-1 text-xs font-semibold text-ink-soft dark:text-white/90 shadow-xs border border-line dark:border-white/10 transition-colors hover:bg-line/70 dark:hover:bg-white/20 hover:text-ink dark:hover:text-white"
                    aria-label="View wealth runway details on retirement page"
                  >
                    ⏳ {Math.max(0, nw / (data.retirement.monthlySpend * 12)).toFixed(1)}y runway
                  </Link>
                ) : (
                  <Link
                    to="/retirement"
                    className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted/60 dark:bg-white/10 px-3 py-1 text-xs font-semibold text-ink-faint dark:text-white/60 transition-colors hover:bg-surface-muted dark:hover:bg-white/20 hover:text-ink dark:hover:text-white"
                    aria-label="Set up retirement spend to see runway"
                  >
                    ⏳ Set runway target
                  </Link>
                )}
              </div>
            </div>

            {/* Quick ratio box */}
            <div className={`rounded-2xl bg-surface-muted/80 dark:bg-white/10 p-3 sm:p-3.5 px-3.5 sm:px-4.5 border border-line/80 dark:border-white/15 backdrop-blur-md ${debts > 0 ? 'sm:min-w-[270px]' : 'sm:min-w-[210px]'}`}>
              <div className={`grid ${debts > 0 ? 'grid-cols-3 gap-2 sm:gap-3' : 'grid-cols-2 gap-3.5'}`}>
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-brand whitespace-nowrap">
                    <span className="h-2 w-2 rounded-full bg-brand shrink-0" />
                    <span>Invested</span>
                  </div>
                  <p className="mt-1 font-display text-base sm:text-lg font-extrabold tnum text-ink dark:text-white whitespace-nowrap">
                    {thbCompact(portfolio.value)}
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-brand/80 tnum whitespace-nowrap">
                    {grossAssets > 0 ? `${((portfolio.value / grossAssets) * 100).toFixed(1)}%` : '0%'}
                  </p>
                </div>

                <div className="pl-2.5 sm:pl-3 border-l border-line dark:border-white/10">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gain whitespace-nowrap">
                    <span className="h-2 w-2 rounded-full bg-gain shrink-0" />
                    <span>Cash</span>
                  </div>
                  <p className="mt-1 font-display text-base sm:text-lg font-extrabold tnum text-ink dark:text-white whitespace-nowrap">
                    {thbCompact(cash)}
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-gain/80 tnum whitespace-nowrap">
                    {grossAssets > 0 ? `${((cash / grossAssets) * 100).toFixed(1)}%` : '0%'}
                  </p>
                </div>

                {debts > 0 && (
                  <div className="pl-2.5 sm:pl-3 border-l border-line dark:border-white/10 text-left">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-rose-500 whitespace-nowrap">
                      <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
                      <span>Debts</span>
                    </div>
                    <p className="mt-1 font-display text-base sm:text-lg font-extrabold tnum text-ink dark:text-white whitespace-nowrap">
                      {thbCompact(-debts)}
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-rose-500/80 tnum whitespace-nowrap">
                      {grossAssets > 0 ? `${debtRatio.toFixed(1)}%` : '0%'}
                    </p>
                  </div>
                )}
              </div>

              {/* Mini ratio split bar */}
              {(grossAssets > 0 || debts > 0) && (
                <div className="mt-2.5 flex h-1.5 w-full overflow-hidden rounded-full bg-line dark:bg-white/10">
                  <div
                    className="bg-brand transition-all duration-500"
                    style={{
                      width: `${debts > 0
                        ? (nw > 0 && grossAssets > 0 ? (portfolio.value / grossAssets) * (nw / grossAssets) * 100 : 0)
                        : (grossAssets > 0 ? (portfolio.value / grossAssets) * 100 : 0)}%`,
                    }}
                    title={`Invested: ${thb(portfolio.value)} (${grossAssets > 0 ? ((portfolio.value / grossAssets) * 100).toFixed(1) : 0}% of assets)`}
                  />
                  <div
                    className="bg-gain transition-all duration-500"
                    style={{
                      width: `${debts > 0
                        ? (nw > 0 && grossAssets > 0 ? (cash / grossAssets) * (nw / grossAssets) * 100 : 0)
                        : (grossAssets > 0 ? (cash / grossAssets) * 100 : 0)}%`,
                    }}
                    title={`Cash: ${thb(cash)} (${grossAssets > 0 ? ((cash / grossAssets) * 100).toFixed(1) : 0}% of assets)`}
                  />
                  {debts > 0 && (
                    <div
                      className="bg-rose-500 transition-all duration-500"
                      style={{
                        width: `${grossAssets > 0 ? Math.min(100, (debts / grossAssets) * 100) : 100}%`,
                      }}
                      title={`Debts: -${thb(debts)} (${debtRatio.toFixed(1)}% Debt Ratio)`}
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Asset Distribution Bar & Legend */}
          {grossAssets > 0 && (
            <div className="relative mt-auto px-6 sm:px-7 pb-5 pt-3.5 border-t border-line dark:border-white/10 space-y-2.5">
              <div className="flex h-2 overflow-hidden rounded-full bg-surface-muted dark:bg-white/10 border border-line/40 dark:border-transparent">
                {alloc.map((a) => (
                  <div
                    key={a.assetClass}
                    style={{
                      width: `${(a.value / grossAssets) * 100}%`,
                      background: ASSET_META[a.assetClass].cssVar,
                    }}
                    title={`${ASSET_META[a.assetClass].label}: ${thb(a.value)}`}
                  />
                ))}
                {cash > 0 && (
                  <div
                    style={{
                      width: `${(cash / grossAssets) * 100}%`,
                      background: 'var(--color-cash)',
                    }}
                    title={`Cash: ${thb(cash)}`}
                  />
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {alloc.map((a) => (
                  <span
                    key={a.assetClass}
                    className="flex items-center gap-1.5 text-xs text-ink-soft dark:text-white/85 font-semibold"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: ASSET_META[a.assetClass].cssVar }}
                    />
                    {ASSET_META[a.assetClass].label} {Math.round((a.value / grossAssets) * 100)}%
                  </span>
                ))}
                {cash > 0 && (
                  <span className="flex items-center gap-1.5 text-xs text-ink-soft dark:text-white/85 font-semibold">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: 'var(--color-cash)' }} />
                    Cash {Math.round((cash / grossAssets) * 100)}%
                  </span>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ── ROW 2: Holdings Donut Breakdown & Cash Hub & Liabilities Hub ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 items-stretch">
        {/* Portfolio asset breakdown card */}
        <div id="guide-dashboard-alloc" className="lg:col-span-5 xl:col-span-4">
          <Card className="animate-rise h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-500/10 text-indigo-500">
                    <PortfolioIcon className="h-4 w-4" />
                  </div>
                  <h2 className="font-display text-base font-bold text-ink">Port Allocation</h2>
                </div>
                <Link
                  to="/portfolio"
                  className="text-xs font-semibold text-brand hover:underline"
                  aria-label="View portfolio details"
                >
                  Portfolio →
                </Link>
              </div>

              {/* Value & PnL Hero Summary */}
              <div id="guide-portfolio-summary" className="mt-3.5 p-3.5 rounded-2xl bg-surface-muted/60 border border-line/60">
                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                  {/* Row 1: Labels */}
                  <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">Portfolio Value</span>
                  <span className="text-xs font-bold uppercase tracking-wider text-ink-muted text-right">All-Time PnL</span>

                  {/* Row 2: Values */}
                  <div className="flex items-baseline min-w-0">
                    <p
                      title={thb(portfolio.value)}
                      className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight tnum text-ink leading-tight truncate cursor-default"
                    >
                      {portfolio.value >= 1_000_000 ? thbCompact(portfolio.value) : thb(portfolio.value)}
                    </p>
                  </div>
                  <div className="flex items-baseline justify-end min-w-0">
                    <PnLText
                      value={portfolio.pnl}
                      compact
                      className="font-display text-3xl sm:text-4xl !font-extrabold tracking-tight leading-tight truncate"
                    />
                  </div>

                  {/* Row 3: Subtext / Details */}
                  <div className="flex items-center min-w-0 h-6">
                    <p className="text-xs text-ink-muted font-medium truncate" title={thb(portfolio.cost)}>
                      Cost: <span className="font-semibold tnum text-ink-soft">{portfolio.cost >= 1_000_000 ? thbCompact(portfolio.cost) : thb(portfolio.cost)}</span>
                    </p>
                  </div>
                  <div className="flex items-center justify-end gap-1.5 min-w-0 h-6">
                    <PnLPill value={portfolio.pnlPct} asPct size="sm" />
                    <span className="text-xs text-ink-muted font-medium whitespace-nowrap">all-time</span>
                  </div>
                </div>
              </div>

              {/* Donut Chart & Breakdown */}
              <div className="mt-4 flex flex-col items-center gap-4">
                <DonutChart
                  segments={allocSegments}
                  size={155}
                  thickness={17}
                  ariaLabel={`Holdings asset allocation, total value ${thb(portfolio.value)}`}
                  centerLabel="Total"
                  centerValue={thbCompact(portfolio.value)}
                />

                <div className="w-full space-y-2 pt-2 border-t border-line">
                  {alloc.map((a) => {
                    const pctVal = portfolio.value > 0 ? (a.value / portfolio.value) * 100 : 0
                    return (
                      <div key={a.assetClass} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 font-medium text-ink">
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ background: ASSET_META[a.assetClass].color }}
                          />
                          {ASSET_META[a.assetClass].plural}
                        </span>
                        <span className="font-bold tnum text-ink">
                          {thb(a.value)}{' '}
                          <span className="font-normal text-ink-muted text-xs">
                            ({pctVal.toFixed(1)}%)
                          </span>
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Cash & Liquidity Hub */}
        <div id="guide-dashboard-cash" className="lg:col-span-7 xl:col-span-4">
          <Card className="animate-rise h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <WalletIcon className="h-4 w-4" />
                  </div>
                  <h2 className="font-display text-base font-bold text-ink">Cash & Liquidity Hub</h2>
                </div>

                <Link
                  to="/cash"
                  aria-label="Open Cash & Liquidity Hub"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline cursor-pointer"
                >
                  <span>Open Hub</span>
                  <ArrowUpRightIcon className="h-3.5 w-3.5" />
                </Link>
              </div>

              {/* Cash & Liquidity Hero Summary */}
              <div id="guide-cash-summary" className="mt-3.5 p-3.5 rounded-2xl bg-surface-muted/60 border border-line/60">
                <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                  {/* Row 1: Labels */}
                  <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">Available Cash</span>
                  <span className="text-xs font-bold uppercase tracking-wider text-ink-muted text-right">Est. Yield</span>

                  {/* Row 2: Values */}
                  <div className="flex items-baseline min-w-0">
                    <p
                      title={thb(cash)}
                      className="font-display text-lg sm:text-xl font-extrabold tracking-tight tnum text-ink leading-tight truncate cursor-default"
                    >
                      {cash >= 1_000_000 ? thbCompact(cash) : thb(cash)}
                    </p>
                  </div>
                  <div className="flex items-baseline justify-end min-w-0">
                    {cashInterest > 0 ? (
                      <span
                        title={`~${thb(cashInterest)}/yr`}
                        className="font-display text-lg sm:text-xl font-extrabold tracking-tight tnum text-emerald-600 dark:text-emerald-400 leading-tight truncate cursor-default"
                      >
                        ~{thbCompact(cashInterest)}<span className="text-xs font-semibold text-ink-muted">/yr</span>
                      </span>
                    ) : (
                      <span className="text-sm text-ink-muted font-medium self-center">No yield</span>
                    )}
                  </div>

                  {/* Row 3: Subtext / Details */}
                  <div className="flex items-center min-w-0 h-6">
                    <p className="text-xs text-ink-muted font-medium truncate">
                      {cashYieldRate > 0 ? (
                        <>
                          Avg Yield: <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">~{cashYieldRate.toFixed(2)}%</strong>
                        </>
                      ) : (
                        <span>Liquid Reserves</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center justify-end gap-1.5 min-w-0 h-6">
                    <span className="text-xs font-bold text-ink-muted bg-surface px-2 py-0.5 rounded-md border border-line/60">
                      {data.cashAccounts.length} {data.cashAccounts.length === 1 ? 'Account' : 'Accounts'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Cash accounts visual bar & account pills */}
              {data.cashAccounts.length > 0 ? (
                <div className="mt-4 space-y-3">
                  <div className="flex h-2 overflow-hidden rounded-full bg-surface-muted">
                    {data.cashAccounts.map((a, i) => {
                      const rate = usdThb && usdThb > 0 ? usdThb : 35
                      const thbVal = a.currency === 'USD' ? a.balance * rate : a.balance
                      const preset = detectBankPreset(a.name)
                      const color = preset?.color ?? CASH_COLORS[i % CASH_COLORS.length]
                      return (
                        <div
                          key={a.id}
                          onClick={() => navigate('/cash')}
                          style={{
                            width: `${cash > 0 ? (thbVal / cash) * 100 : 0}%`,
                            background: color,
                          }}
                          title={`${a.name}: ${moneyCompact(a.balance, a.currency)} (Go to Cash Hub)`}
                          className="cursor-pointer hover:opacity-80 transition-opacity"
                        />
                      )
                    })}
                  </div>

                  {/* Cash accounts list grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                    {data.cashAccounts.map((a, i) => {
                      const preset = detectBankPreset(a.name)
                      const color = preset?.color ?? CASH_COLORS[i % CASH_COLORS.length]
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => navigate('/cash')}
                          aria-label={`View ${a.name} in Cash Hub`}
                          className="flex flex-col text-left p-2.5 rounded-xl bg-surface-muted/50 border border-line/40 hover:bg-surface-muted hover:border-brand/40 hover:shadow-xs group transition-all cursor-pointer active:scale-[0.98]"
                          title={`View in Cash Hub: ${a.name}`}
                        >
                          <span className="flex items-center justify-between gap-1.5 text-xs font-medium text-ink-muted truncate w-full">
                            <span className="flex items-center gap-1.5 truncate">
                              <span
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{ background: color }}
                              />
                              <span className="truncate group-hover:text-ink transition-colors">{a.name}</span>
                            </span>
                            {a.interestRate !== undefined && a.interestRate > 0 && (
                              <span className="shrink-0 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded font-mono">
                                {a.interestRate}%
                              </span>
                            )}
                          </span>
                          <span className="mt-1 font-display font-bold tnum text-sm text-ink">
                            {moneyCompact(a.balance, a.currency)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center">
                  <p className="text-xs text-ink-muted">No cash accounts added yet.</p>
                  <Link
                    to="/cash"
                    className="inline-block mt-2 text-xs font-semibold text-brand hover:underline cursor-pointer"
                  >
                    + Open Cash Hub to add accounts
                  </Link>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Liabilities & Debts Hub */}
        <div id="guide-dashboard-debts" className="lg:col-span-12 xl:col-span-4">
          <Card className="animate-rise h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="grid h-7 w-7 place-items-center rounded-lg bg-surface-muted dark:bg-white/10 text-ink-muted dark:text-white/80">
                    <DebtIcon className="h-4 w-4" />
                  </div>
                  <h2 className="font-display text-base font-bold text-ink">Liabilities & Debts</h2>
                </div>

                <Link
                  to="/debts"
                  aria-label="Open Debts & Installments Hub"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline cursor-pointer"
                >
                  <span>Open Hub</span>
                  <ArrowUpRightIcon className="h-3.5 w-3.5" />
                </Link>
              </div>

              {/* Liabilities & Debts Hero Summary */}
              <div id="guide-debt-summary" className="mt-3.5 p-3.5 rounded-2xl bg-surface-muted/60 border border-line/60">
                <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                  {/* Row 1: Labels */}
                  <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">Total Outstanding</span>
                  <span className="text-xs font-bold uppercase tracking-wider text-ink-muted text-right">Monthly Payment</span>

                  {/* Row 2: Values */}
                  <div className="flex items-baseline min-w-0">
                    <p
                      className="font-display text-lg sm:text-xl font-extrabold tracking-tight tnum leading-tight truncate cursor-default text-ink dark:text-white"
                      title={debts > 0 ? `-${thb(debts)}` : '฿0'}
                    >
                      {debts > 0 ? (debts >= 1_000_000 ? `-${thbCompact(debts)}` : `-${thb(debts)}`) : '฿0'}
                    </p>
                  </div>
                  <div className="flex items-baseline justify-end min-w-0">
                    {monthlyDebt > 0 ? (
                      <span
                        title={`~${thb(monthlyDebt)}/mo`}
                        className="font-display text-lg sm:text-xl font-extrabold tracking-tight tnum text-ink dark:text-white leading-tight truncate cursor-default"
                      >
                        ~{thbCompact(monthlyDebt)}<span className="text-xs font-semibold text-ink-muted">/mo</span>
                      </span>
                    ) : (
                      <span className="text-sm text-emerald-600 dark:text-emerald-400 font-semibold self-center">฿0/mo</span>
                    )}
                  </div>

                  {/* Row 3: Subtext / Details */}
                  <div className="flex items-center min-w-0 h-6">
                    <p className="text-xs text-ink-muted font-medium truncate">
                      {debts > 0 ? (
                        <>
                          D/A Ratio: <strong className="text-ink font-semibold">{debtRatio.toFixed(1)}%</strong>
                        </>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">🎉 100% Solvency</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center justify-end gap-1.5 min-w-0 h-6">
                    <span className="text-xs font-bold text-ink-muted bg-surface px-2 py-0.5 rounded-md border border-line/60">
                      {(data.liabilities?.length ?? 0) === 0
                        ? 'Debt Free'
                        : `${data.liabilities?.length} ${(data.liabilities?.length ?? 0) === 1 ? 'Debt' : 'Debts'}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Debt distribution bar & items */}
              {(data.liabilities?.length ?? 0) > 0 ? (
                <div className="mt-4 space-y-3">
                  <div className="flex h-2 overflow-hidden rounded-full bg-surface-muted">
                    {data.liabilities!.map((l) => {
                      const meta = DEBT_CATEGORIES[l.category] ?? DEBT_CATEGORIES.other
                      return (
                        <div
                          key={l.id}
                          onClick={() => {
                            setSelectedLiabilityId(l.id)
                            setLiabilitiesOpen(true)
                          }}
                          style={{
                            width: `${debts > 0 ? (l.balance / debts) * 100 : 0}%`,
                            background: meta.color,
                          }}
                          title={`${l.name}: ${thb(l.balance)} (Click to edit)`}
                          className="cursor-pointer hover:opacity-80 transition-opacity"
                        />
                      )
                    })}
                  </div>

                  {/* Liabilities list compact rows */}
                  <div className="space-y-2 pt-1">
                    {data.liabilities!.map((l) => {
                      const meta = DEBT_CATEGORIES[l.category] ?? DEBT_CATEGORIES.other
                      const isInst = l.isInstallment || l.category === 'installment'
                      const totalInst = l.totalInstallments ?? 0
                      const paidInst = l.paidInstallments ?? 0
                      const percent = totalInst > 0 ? Math.min(100, Math.round((paidInst / totalInst) * 100)) : 0
                      const remainingInst = Math.max(0, totalInst - paidInst)
                      const dueInfo = getLiabilityDueStatus(l)

                      return (
                        <div
                          key={l.id}
                          onClick={() => {
                            setSelectedLiabilityId(l.id)
                            setLiabilitiesOpen(true)
                          }}
                          className="p-3 rounded-2xl bg-surface-muted/50 border border-line/40 hover:bg-surface-muted/90 hover:border-brand/40 hover:shadow-xs group transition-all cursor-pointer relative"
                        >
                          {/* Row 1: Left (Color dot + Name + Interest rate) | Right (Balance) */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <span
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{ background: meta.color }}
                              />
                              <span className="truncate font-semibold text-sm text-ink group-hover:text-brand transition-colors">
                                {l.name}
                              </span>
                              {l.interestRate !== undefined && l.interestRate > 0 && (
                                <span className="shrink-0 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded font-mono">
                                  {l.interestRate}%
                                </span>
                              )}
                            </div>

                            <div className="shrink-0 text-right">
                              <span className={`font-display font-extrabold tnum text-sm ${l.balance > 0 ? 'text-ink dark:text-white' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                {l.balance > 0 ? `-${thb(l.balance)}` : '฿0 (Paid Off)'}
                              </span>
                            </div>
                          </div>

                          {/* Row 2: Left (Due badge, Monthly/Installment info) | Right (Quick Action or Status) */}
                          <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${dueInfo.badgeClass}`}>
                                {dueInfo.label}
                              </span>
                              {l.monthlyPayment && l.monthlyPayment > 0 && l.balance > 0 && (
                                <span className="text-ink-muted font-medium shrink-0">
                                  ~{thb(l.monthlyPayment)}/mo
                                </span>
                              )}
                              {isInst && totalInst > 0 && (
                                <span className="text-xs font-semibold text-ink-muted dark:text-white/70 bg-surface dark:bg-white/10 border border-line dark:border-white/10 px-1.5 py-0.5 rounded shrink-0">
                                  {paidInst}/{totalInst} terms
                                </span>
                              )}
                            </div>

                            {/* Quick Action / Status */}
                            {(l.monthlyPayment || isInst) && (
                              <div className="shrink-0">
                                {dueInfo.status === 'completed' ? (
                                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                                    🎉 Paid Off
                                  </span>
                                ) : dueInfo.status === 'paid' ? (
                                  <div className="flex items-center gap-1.5 text-xs">
                                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                                      <CheckIcon className="h-3 w-3" strokeWidth={2.5} />
                                      <span>Paid this period</span>
                                    </span>
                                     <button
                                       type="button"
                                       onClick={(e) => {
                                         e.stopPropagation()
                                         undoLiabilityPayment(l.id)
                                       }}
                                       aria-label={`Undo payment for ${l.name}`}
                                       className="relative inline-flex items-center px-2 py-1 min-h-[36px] sm:min-h-0 sm:py-0.5 after:absolute after:-inset-2 after:content-[''] font-semibold text-ink-faint hover:text-rose-600 hover:underline cursor-pointer"
                                       title="Undo payment for this period"
                                     >
                                       Undo
                                     </button>
                                   </div>
                                 ) : (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        payLiabilityInstallment(l.id)
                                        showToast(`Recorded payment for "${l.name}"`, 'success', {
                                          label: 'Undo',
                                          onClick: () => undoLiabilityPayment(l.id),
                                        })
                                      }}
                                      aria-label={`Pay installment for ${l.name}`}
                                      className="relative inline-flex items-center gap-1.5 rounded-lg bg-ink text-white hover:bg-ink-hover dark:bg-brand dark:hover:bg-brand-ink px-3 py-1.5 sm:px-2.5 sm:py-1 min-h-[36px] sm:min-h-0 text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer after:absolute after:-inset-1 after:content-[''] sm:after:hidden"
                                    >
                                      <CheckIcon className="h-3 w-3" strokeWidth={2.5} />
                                      <span>Pay Term</span>
                                    </button>
                                 )}
                              </div>
                            )}
                          </div>

                          {/* Progress bar for installment plans */}
                          {isInst && totalInst > 0 && (
                            <div className="mt-2 pt-1.5 border-t border-line/30 dark:border-white/5">
                              <div className="flex items-center justify-between text-xs font-semibold text-ink-faint mb-1">
                                <span>Progress ({percent}%)</span>
                                <span>{remainingInst === 0 ? 'Completed 🎉' : `${remainingInst} ${remainingInst === 1 ? 'term' : 'terms'} left`}</span>
                              </div>
                              <div
                                role="progressbar"
                                aria-valuenow={percent}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-label={`Repayment progress: ${percent}%`}
                                className="w-full h-1.5 rounded-full bg-surface-muted dark:bg-white/10 overflow-hidden"
                              >
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    percent >= 100 ? 'bg-emerald-500' : 'bg-brand'
                                  }`}
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center">
                  <p className="text-xs text-ink-muted">No debts recorded or completely debt-free.</p>
                  <Link
                    to="/debts"
                    className="inline-block mt-2 text-xs font-semibold text-brand hover:underline cursor-pointer"
                  >
                    + Open Debts Hub to manage liabilities
                  </Link>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* ── ROW 3: Net Worth Performance Graph (Full Width at Bottom) ── */}
      <div id="guide-dashboard-chart">
        <Card className="animate-rise overflow-hidden" padded={false}>
          {(data.netWorthHistory?.length ?? 0) >= 2 ? (
            <InteractiveNetWorthChart history={data.netWorthHistory!} />
          ) : (
            <div className="p-8 text-center">
              <SparkleIcon className="h-6 w-6 mx-auto text-brand mb-2" />
              <h3 className="font-display font-bold text-ink">Net Worth Performance Chart</h3>
              <p className="text-sm text-ink-muted mt-1 max-w-md mx-auto">
                Snapshot history will record daily as your balances and holdings update.
              </p>
            </div>
          )}
        </Card>
      </div>

      <LiabilitiesModal
        open={liabilitiesOpen}
        onClose={() => {
          setLiabilitiesOpen(false)
          setSelectedLiabilityId(null)
        }}
        initialLiabilityId={selectedLiabilityId}
      />

      <AiImportModal
        open={aiImportOpen}
        onClose={() => setAiImportOpen(false)}
      />

      <GuideTour
        isOpen={isRunning}
        steps={steps}
        currentStepIndex={currentStepIndex}
        onNext={nextStep}
        onPrev={prevStep}
        onClose={endTour}
        onFinish={finishTour}
      />
    </div>
  )
}




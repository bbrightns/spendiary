import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useData } from '../store/DataContext'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { DonutChart } from '../components/charts/DonutChart'
import { InteractiveNetWorthChart } from '../components/charts/InteractiveNetWorthChart'
import { PnLPill, PnLText } from '../components/ui/PnL'
import { CashAccountsForm } from '../components/forms/CashAccountsForm'
import { LiabilitiesModal } from '../components/forms/LiabilitiesModal'
import { AiImportModal } from '../components/forms/AiImportModal'
import { GuideTour } from '../components/guide/GuideTour'
import { usePageGuide } from '../hooks/usePageGuide'
import {
  DebtIcon,
  PencilIcon,
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
  getCashLiquidityBreakdown,
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
  '#f43f5e', // rose
  '#06b6d4', // cyan
  '#84cc16', // lime
]

export function Dashboard() {
  const { data, recordNetWorthSnapshot, usdThb } = useData()
  const navigate = useNavigate()
  const [cashOpen, setCashOpen] = useState(false)
  const [selectedCashAccountId, setSelectedCashAccountId] = useState<string | null>(null)
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
  const cashBreakdown = useMemo(
    () => getCashLiquidityBreakdown(data.cashAccounts, usdThb),
    [data.cashAccounts, usdThb],
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          eyebrow={today}
          title={`${greeting}${data.userName ? `, ${data.userName}` : ''}`}
          subtitle="Here's where your wealth and cash flow stand."
          onStartGuide={startTour}
        />

        {/* Global actionable badges & Quick Import */}
        <div className="flex flex-wrap items-center gap-2 pt-1 sm:pt-0">
          <button
            type="button"
            onClick={() => setAiImportOpen(true)}
            title="Import Portfolio & Cash with AI"
            className="inline-flex items-center gap-1.5 rounded-full border border-brand/25 bg-brand-soft/80 hover:bg-brand hover:text-white dark:bg-brand/20 dark:hover:bg-brand px-3.5 py-1.5 text-[12.5px] font-semibold text-brand-ink dark:text-white transition-all active:scale-95 cursor-pointer shadow-xs"
          >
            <SparkleIcon className="h-3.5 w-3.5" />
            <span>Import (AI/JSON)</span>
          </button>

          {dcaActions.length > 0 && (
            <div id="guide-dashboard-dca">
              <button
                type="button"
                onClick={() => navigate('/dca')}
                aria-label={`View ${dcaActions.length} DCA ${dcaActions.length === 1 ? 'buy' : 'buys'} ready to confirm`}
                className="inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand-soft px-3.5 py-1.5 text-[12.5px] font-semibold text-brand-ink transition-all hover:bg-brand hover:text-white dark:hover:bg-[#4f46e5] active:scale-95 cursor-pointer"
              >
                <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-brand dark:bg-[#4f46e5] text-[10.5px] font-bold text-white">
                  {dcaActions.length}
                </span>
                <span>DCA {dcaActions.length === 1 ? 'buy ready' : 'buys ready'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── ROW 1: Net Worth Master Hero (Full Width Bento) ── */}
      <div id="guide-dashboard-networth">
        <Card
          padded={false}
          className="relative overflow-hidden bg-gradient-to-br from-white via-white to-brand-soft/40 dark:from-[#0b0d14] dark:via-[#10131e] dark:to-[#151928] border border-line dark:border-white/10 shadow-[var(--shadow-soft)] animate-rise h-full flex flex-col justify-between"
        >
          {/* Ambient subtle glow inside card */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand/5 dark:bg-brand/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-emerald-500/5 dark:bg-emerald-500/10 blur-3xl" />

          {/* Top Main Stats Area */}
          <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-start p-6 sm:p-7">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-ink-muted dark:text-white/70">
                <WalletIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-[13.5px] font-semibold uppercase tracking-wider">Total Net Worth</span>
              </div>
              <p className="font-display text-[36px] sm:text-[44px] xl:text-[48px] font-extrabold leading-tight tracking-tight tnum text-ink dark:text-white">
                {thb(nw)}
              </p>

              <div className="pt-1 flex flex-wrap items-center gap-2.5">
                <PnLPill value={portfolio.pnl} size="md" />
                <span className="text-[12.5px] text-ink-muted dark:text-white/70 font-medium">unrealised</span>
                {debts > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLiabilityId(null)
                      setLiabilitiesOpen(true)
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-3 py-1 text-[12px] font-semibold text-rose-600 dark:text-rose-400 border border-rose-500/20 transition-colors hover:bg-rose-500/20 cursor-pointer whitespace-nowrap"
                    aria-label="Manage liabilities"
                  >
                    📉 {debtRatio.toFixed(1)}% Debt Ratio ({thbCompact(-debts)})
                  </button>
                )}
                {data.retirement?.monthlySpend && data.retirement.monthlySpend > 0 ? (
                  <Link
                    to="/retirement"
                    className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted dark:bg-white/12 px-3 py-1 text-[12px] font-semibold text-ink-soft dark:text-white/90 shadow-xs border border-line dark:border-white/10 transition-colors hover:bg-line/70 dark:hover:bg-white/20 hover:text-ink dark:hover:text-white"
                    aria-label="View wealth runway details on retirement page"
                  >
                    ⏳ {Math.max(0, nw / (data.retirement.monthlySpend * 12)).toFixed(1)}y runway
                  </Link>
                ) : (
                  <Link
                    to="/retirement"
                    className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted/60 dark:bg-white/10 px-3 py-1 text-[11.5px] font-semibold text-ink-faint dark:text-white/60 transition-colors hover:bg-surface-muted dark:hover:bg-white/20 hover:text-ink dark:hover:text-white"
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
                  <div className="flex items-center gap-1.5 text-[11px] sm:text-[11.5px] font-bold text-brand whitespace-nowrap">
                    <span className="h-2 w-2 rounded-full bg-brand shrink-0" />
                    <span>Invested</span>
                  </div>
                  <p className="mt-1 font-display text-[15px] sm:text-[18px] font-extrabold tnum text-ink dark:text-white whitespace-nowrap">
                    {thbCompact(portfolio.value)}
                  </p>
                  <p className="mt-0.5 text-[11px] sm:text-[11.5px] font-semibold text-brand/80 tnum whitespace-nowrap">
                    {grossAssets > 0 ? `${((portfolio.value / grossAssets) * 100).toFixed(1)}%` : '0%'}
                  </p>
                </div>

                <div className="pl-2.5 sm:pl-3 border-l border-line dark:border-white/10">
                  <div className="flex items-center gap-1.5 text-[11px] sm:text-[11.5px] font-bold text-gain whitespace-nowrap">
                    <span className="h-2 w-2 rounded-full bg-gain shrink-0" />
                    <span>Cash</span>
                  </div>
                  <p className="mt-1 font-display text-[15px] sm:text-[18px] font-extrabold tnum text-ink dark:text-white whitespace-nowrap">
                    {thbCompact(cash)}
                  </p>
                  <p className="mt-0.5 text-[11px] sm:text-[11.5px] font-semibold text-gain/80 tnum whitespace-nowrap">
                    {grossAssets > 0 ? `${((cash / grossAssets) * 100).toFixed(1)}%` : '0%'}
                  </p>
                </div>

                {debts > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLiabilityId(null)
                      setLiabilitiesOpen(true)
                    }}
                    className="pl-2.5 sm:pl-3 border-l border-line dark:border-white/10 text-left cursor-pointer group"
                    title="Click to manage liabilities"
                  >
                    <div className="flex items-center gap-1.5 text-[11px] sm:text-[11.5px] font-bold text-rose-500 whitespace-nowrap">
                      <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
                      <span className="group-hover:underline">Debts</span>
                    </div>
                    <p className="mt-1 font-display text-[15px] sm:text-[18px] font-extrabold tnum text-rose-600 dark:text-rose-400 whitespace-nowrap">
                      {thbCompact(-debts)}
                    </p>
                    <p className="mt-0.5 text-[11px] sm:text-[11.5px] font-semibold text-rose-500/80 tnum whitespace-nowrap">
                      {grossAssets > 0 ? `${debtRatio.toFixed(1)}%` : '0%'}
                    </p>
                  </button>
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
                    className="flex items-center gap-1.5 text-[12px] text-ink-soft dark:text-white/85 font-semibold"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: ASSET_META[a.assetClass].cssVar }}
                    />
                    {ASSET_META[a.assetClass].label} {Math.round((a.value / grossAssets) * 100)}%
                  </span>
                ))}
                {cash > 0 && (
                  <span className="flex items-center gap-1.5 text-[12px] text-ink-soft dark:text-white/85 font-semibold">
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
                  <h2 className="font-display text-[16px] font-bold text-ink">Port Allocation</h2>
                </div>
                <Link
                  to="/portfolio"
                  className="text-[12.5px] font-semibold text-brand hover:underline"
                  aria-label="View portfolio details"
                >
                  Portfolio →
                </Link>
              </div>

              {/* Value & PnL Hero Summary */}
              <div id="guide-portfolio-summary" className="mt-3.5 p-3.5 rounded-2xl bg-surface-muted/60 border border-line/60">
                <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                  {/* Row 1: Labels */}
                  <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Portfolio Value</span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted text-right">All-Time PnL</span>

                  {/* Row 2: Values */}
                  <div className="flex items-baseline min-w-0">
                    <p className="font-display text-[21px] sm:text-[24px] font-extrabold tracking-tight tnum text-ink leading-tight truncate">
                      {thb(portfolio.value)}
                    </p>
                  </div>
                  <div className="flex items-baseline justify-end min-w-0">
                    <PnLText
                      value={portfolio.pnl}
                      className="font-display text-[21px] sm:text-[24px] !font-extrabold tracking-tight leading-tight truncate"
                    />
                  </div>

                  {/* Row 3: Subtext / Details */}
                  <div className="flex items-center min-w-0 h-6">
                    <p className="text-[11.5px] text-ink-muted font-medium truncate">
                      Cost: <span className="font-semibold tnum text-ink-soft">{thb(portfolio.cost)}</span>
                    </p>
                  </div>
                  <div className="flex items-center justify-end gap-1.5 min-w-0 h-6">
                    <PnLPill value={portfolio.pnlPct} asPct size="sm" />
                    <span className="text-[11px] text-ink-muted font-medium whitespace-nowrap">all-time</span>
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
                      <div key={a.assetClass} className="flex items-center justify-between text-[12.5px]">
                        <span className="flex items-center gap-2 font-medium text-ink">
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ background: ASSET_META[a.assetClass].color }}
                          />
                          {ASSET_META[a.assetClass].plural}
                        </span>
                        <span className="font-bold tnum text-ink">
                          {thb(a.value)}{' '}
                          <span className="font-normal text-ink-muted text-[11px]">
                            ({pctVal.toFixed(1)}%)
                          </span>
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-[11.5px]">
              <span className="text-ink-muted">{data.holdings.length} holding positions</span>
              <Link
                to="/rebalance"
                className="inline-flex items-center gap-1 font-bold text-brand hover:underline cursor-pointer"
              >
                <span>Rebalance Portfolio</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </Card>
        </div>

        {/* Cash & Liquidity Hub */}
        <div id="guide-dashboard-cash" className="lg:col-span-7 xl:col-span-4">
          <Card className="animate-rise h-full flex flex-col justify-between">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-line">
                <div className="flex items-center gap-2">
                  <div className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <WalletIcon className="h-4 w-4" />
                  </div>
                  <h2 className="font-display text-[16px] font-bold text-ink">Cash & Liquidity Hub</h2>
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                  {cashInterest > 0 && (
                    <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      💰 ~{thbCompact(cashInterest)}/yr
                    </span>
                  )}
                  <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-[11px] font-bold text-ink-muted border border-line/50">
                    {data.cashAccounts.length} {data.cashAccounts.length === 1 ? 'Account' : 'Accounts'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCashAccountId(null)
                      setCashOpen(true)
                    }}
                    aria-label="Manage cash accounts"
                    className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand hover:underline cursor-pointer"
                  >
                    <span>Manage</span>
                    <PencilIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                <div>
                  <span className="text-[11.5px] font-medium text-ink-muted">Available Cash</span>
                  <p className="font-display text-[24px] font-extrabold tnum text-ink leading-tight">
                    {thb(cash)}
                  </p>
                </div>
                <div className="text-[12px] text-ink-muted sm:text-right">
                  {cashBreakdown.locked > 0 ? (
                    <span>
                      Instant: <strong className="text-ink">{thb(cashBreakdown.spending + cashBreakdown.emergency + cashBreakdown.invest)}</strong> • Locked: <strong className="text-ink">{thb(cashBreakdown.locked)}</strong>
                    </span>
                  ) : (
                    <span>Instant liquidity</span>
                  )}
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
                          onClick={() => {
                            setSelectedCashAccountId(a.id)
                            setCashOpen(true)
                          }}
                          style={{
                            width: `${cash > 0 ? (thbVal / cash) * 100 : 0}%`,
                            background: color,
                          }}
                          title={`${a.name}: ${moneyCompact(a.balance, a.currency)} (Click to edit)`}
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
                          onClick={() => {
                            setSelectedCashAccountId(a.id)
                            setCashOpen(true)
                          }}
                          aria-label={`Edit ${a.name}, balance ${moneyCompact(a.balance, a.currency)}`}
                          className="flex flex-col text-left p-2.5 rounded-xl bg-surface-muted/50 border border-line/40 hover:bg-surface-muted hover:border-brand/40 hover:shadow-xs group transition-all cursor-pointer active:scale-[0.98]"
                          title={`Click to edit ${a.name}`}
                        >
                          <span className="flex items-center justify-between gap-1.5 text-[11px] font-medium text-ink-muted truncate w-full">
                            <span className="flex items-center gap-1.5 truncate">
                              <span
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{ background: color }}
                              />
                              <span className="truncate group-hover:text-ink transition-colors">{a.name}</span>
                            </span>
                            {a.interestRate !== undefined && a.interestRate > 0 && (
                              <span className="shrink-0 text-[9.5px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded font-mono">
                                {a.interestRate}%
                              </span>
                            )}
                          </span>
                          <span className="mt-1 font-display font-bold tnum text-[13.5px] text-ink">
                            {moneyCompact(a.balance, a.currency)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center">
                  <p className="text-[12.5px] text-ink-muted">No cash accounts added yet.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCashAccountId(null)
                      setCashOpen(true)
                    }}
                    aria-label="Add first cash account"
                    className="mt-1 text-[12px] font-semibold text-brand hover:underline cursor-pointer"
                  >
                    + Add first account
                  </button>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-[11.5px] text-ink-muted">
              <span>Emergency cash reserve</span>
              <button
                type="button"
                onClick={() => {
                  setSelectedCashAccountId(null)
                  setCashOpen(true)
                }}
                aria-label="Add new cash account"
                className="font-semibold text-brand hover:underline cursor-pointer"
              >
                + Add Account
              </button>
            </div>
          </Card>
        </div>

        {/* Liabilities & Debts Hub */}
        <div id="guide-dashboard-debts" className="lg:col-span-12 xl:col-span-4">
          <Card className="animate-rise h-full flex flex-col justify-between">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-line">
                <div className="flex items-center gap-2">
                  <div className="grid h-7 w-7 place-items-center rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
                    <DebtIcon className="h-4 w-4" />
                  </div>
                  <h2 className="font-display text-[16px] font-bold text-ink">Liabilities & Debts</h2>
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                  {monthlyDebt > 0 && (
                    <span className="rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-bold text-rose-600 dark:text-rose-400 border border-rose-500/20">
                      💳 ~{thbCompact(monthlyDebt)}/mo
                    </span>
                  )}
                  <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-[11px] font-bold text-ink-muted border border-line/50">
                    {(data.liabilities?.length ?? 0) === 0
                      ? 'Debt Free'
                      : `${data.liabilities?.length} ${(data.liabilities?.length ?? 0) === 1 ? 'Debt' : 'Debts'}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLiabilityId(null)
                      setLiabilitiesOpen(true)
                    }}
                    aria-label="Manage liabilities and debts"
                    className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand hover:underline cursor-pointer"
                  >
                    <span>Manage</span>
                    <PencilIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                <div>
                  <span className="text-[11.5px] font-medium text-ink-muted">Total Outstanding Debt</span>
                  <p className={`font-display text-[24px] font-extrabold tnum leading-tight ${debts > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-ink dark:text-white'}`}>
                    {debts > 0 ? `-${thb(debts)}` : '฿0'}
                  </p>
                </div>
                <div className="text-[12px] text-ink-muted sm:text-right">
                  {debts > 0 ? (
                    <span>
                      D/A Ratio: <strong className="text-ink">{debtRatio.toFixed(1)}%</strong>
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      🎉 100% Solvency
                    </span>
                  )}
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

                  {/* Liabilities list grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {data.liabilities!.map((l) => {
                      const meta = DEBT_CATEGORIES[l.category] ?? DEBT_CATEGORIES.other
                      return (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => {
                            setSelectedLiabilityId(l.id)
                            setLiabilitiesOpen(true)
                          }}
                          aria-label={`Edit ${l.name}, balance ${thb(l.balance)}`}
                          className="flex flex-col text-left p-2.5 rounded-xl bg-surface-muted/50 border border-line/40 hover:bg-surface-muted hover:border-brand/40 hover:shadow-xs group transition-all cursor-pointer active:scale-[0.98]"
                          title={`Click to edit ${l.name}`}
                        >
                          <span className="flex items-center justify-between gap-1.5 text-[11px] font-medium text-ink-muted truncate w-full">
                            <span className="flex items-center gap-1.5 truncate">
                              <span
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{ background: meta.color }}
                              />
                              <span className="truncate group-hover:text-ink transition-colors">{l.name}</span>
                            </span>
                            {l.interestRate !== undefined && l.interestRate > 0 && (
                              <span className="shrink-0 text-[9.5px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1 py-0.5 rounded font-mono">
                                {l.interestRate}%
                              </span>
                            )}
                          </span>
                          <span className="mt-1 font-display font-bold tnum text-[13.5px] text-rose-600 dark:text-rose-400">
                            -{thb(l.balance)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center">
                  <p className="text-[12.5px] text-ink-muted">ปลอดหนี้สิน หรือยังไม่ได้เพิ่มรายการ</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLiabilityId(null)
                      setLiabilitiesOpen(true)
                    }}
                    aria-label="Add first liability"
                    className="mt-1 text-[12px] font-semibold text-brand hover:underline cursor-pointer"
                  >
                    + บันทึกหนี้สิน
                  </button>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-[11.5px] text-ink-muted">
              <span>{debts > 0 ? 'ผ่อนชำระตรงเวลาเพื่อลดภาระดอกเบี้ย' : 'ความมั่งคั่งสุทธิ = ทรัพย์สิน 100%'}</span>
              <button
                type="button"
                onClick={() => {
                  setSelectedLiabilityId(null)
                  setLiabilitiesOpen(true)
                }}
                aria-label="Add new liability"
                className="font-semibold text-brand hover:underline cursor-pointer"
              >
                + Add Debt
              </button>
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
              <p className="text-[13px] text-ink-muted mt-1 max-w-md mx-auto">
                Snapshot history will record daily as your balances and holdings update.
              </p>
            </div>
          )}
        </Card>
      </div>

      <CashAccountsForm
        open={cashOpen}
        onClose={() => {
          setCashOpen(false)
          setSelectedCashAccountId(null)
        }}
        initialAccountId={selectedCashAccountId}
      />

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




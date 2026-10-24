import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useData } from '../store/DataContext'
import { openPayLoan, useUndoLoanPayment } from '../modules/spend/PayLoanSheet'
import { PageHeader } from '../components/layout/PageHeader'
import { Card, CardHeader, Inset } from '../components/ui/Card'
import { TextLink } from '../components/ui/TextLink'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { DonutChart } from '../components/charts/DonutChart'
import { InteractiveNetWorthChart } from '../components/charts/InteractiveNetWorthChart'
import { PnLPill, PnLText, UnpricedNote } from '../components/ui/PnL'
import { LoanSheet } from '../modules/spend/LoanSheet'
import { SpendSnapshotCard } from '../modules/spend/SpendSnapshotCard'
import { AiImportModal } from '../components/forms/AiImportModal'
import { TodayLink } from '../modules/spend/TodayStack'
import { GuideTour } from '../components/guide/GuideTour'
import { usePageGuide } from '../hooks/usePageGuide'
import { CheckIcon, ClockIcon, SparkleIcon } from '../components/icons'
import {
  ASSET_META,
  DEBT_CATEGORIES,
  allocations,
  calculateAnnualCashInterest,
  detectBankPreset,
  getLiabilityDueStatus,
  netWorth,
  portfolioSummary,
  totalCash,
  totalLiabilities,
  totalMonthlyDebtPayment,
} from '../lib/calc'
import { moneyCompact, thb, thbCompact } from '../lib/format'
import { rateOrZero } from '../lib/fx'

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

/** A small link chip under the net worth (debt ratio, runway) */
const CHIP =
  'inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-ink-soft transition-colors hover:text-ink whitespace-nowrap'
/** A dashed "set this up" row inside a card */
const PROMPT =
  'flex items-center gap-3 rounded-2xl border border-dashed border-line-strong p-3 transition-colors hover:bg-surface-muted/60'

/** A cash account's colour: its bank's, else one from the cycle */
const cashColor = (name: string, i: number) => detectBankPreset(name)?.color ?? CASH_COLORS[i % CASH_COLORS.length]

export function Dashboard() {
  const { data, recordNetWorthSnapshot, usdThb } = useData()
  const undoLoanPayment = useUndoLoanPayment()
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
  const debts = useMemo(() => totalLiabilities(data), [data.liabilities, data.spendCards])
  // Spend credit cards counted in the total (those not already tracked in Debts)
  const countedCards = useMemo(() => (data.spendCards ?? []).filter((c) => !c.excludeFromNetWorth && c.balance > 0), [data.spendCards])
  const cardsOwed = countedCards.reduce((s, c) => s + c.balance, 0)
  const monthlyDebt = useMemo(() => totalMonthlyDebtPayment(data), [data.liabilities])
  const grossAssets = portfolio.value + cash
  const debtRatio = grossAssets > 0 ? (debts / grossAssets) * 100 : (debts > 0 ? 100 : 0)
  const nw = useMemo(() => netWorth(data, usdThb), [data.cashAccounts, data.holdings, data.liabilities, data.spendCards, usdThb])
  const cashInterest = useMemo(
    () => calculateAnnualCashInterest(data.cashAccounts, usdThb),
    [data.cashAccounts, usdThb],
  )
  const cashYieldRate = useMemo(
    () => (cash > 0 && cashInterest > 0 ? (cashInterest / cash) * 100 : 0),
    [cash, cashInterest],
  )

  // Record today's net worth snapshot whenever nw updates
  useEffect(() => {
    if (nw > 0) recordNetWorthSnapshot(nw)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nw])

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
                  Import portfolio & cash (AI)
                </Button>
                <Button variant="secondary" onClick={() => navigate('/portfolio')}>
                  Go to portfolio
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
      {/* The greeting lives on Spend Home, where the app opens */}
      <PageHeader eyebrow="Invest" title="Overview" subtitle="Your wealth at a glance." onStartGuide={startTour} className="mb-4" />

      {/* ── Today: DCA buys and dividends open the DCA page; bills and loans open Spend Home ── */}
      <TodayLink id="guide-dashboard-dca" />

      {/* ── Net worth: the one big number, then what it's made of ── */}
      <div id="guide-dashboard-networth">
        <Card padded={false} className="animate-rise">
          <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
            <div className="min-w-0">
              <p className="text-sm text-ink-muted">Total net worth</p>
              <p className="mt-1 font-display text-4xl font-extrabold leading-none tracking-tight tnum text-ink sm:text-5xl">{thb(nw)}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <PnLPill value={portfolio.pnl} size="md" />
                <span className="text-xs text-ink-muted">unrealised</span>
                {debts > 0 && (
                  <Link to="/spend/loans" className={CHIP} aria-label="Manage debts">
                    Debt ratio <span className="tnum">{debtRatio.toFixed(1)}%</span>
                  </Link>
                )}
                {data.retirement?.monthlySpend && data.retirement.monthlySpend > 0 ? (
                  <Link to="/retirement" className={CHIP} aria-label="View runway on the retirement page">
                    <ClockIcon className="h-3.5 w-3.5" />
                    <span className="tnum">{Math.max(0, nw / (data.retirement.monthlySpend * 12)).toFixed(1)}</span> years of runway
                  </Link>
                ) : (
                  <Link to="/retirement" className={CHIP}>
                    <ClockIcon className="h-3.5 w-3.5" />
                    Set a runway target
                  </Link>
                )}
              </div>
            </div>

            {/* What the net worth is made of */}
            <Inset className={`shrink-0 ${debts > 0 ? 'sm:min-w-[270px]' : 'sm:min-w-[210px]'}`}>
              <div className={`grid ${debts > 0 ? 'grid-cols-3' : 'grid-cols-2'} gap-3`}>
                {[
                  { label: 'Invested', value: portfolio.value, pct: grossAssets > 0 ? (portfolio.value / grossAssets) * 100 : 0, dot: 'bg-invest' },
                  { label: 'Cash', value: cash, pct: grossAssets > 0 ? (cash / grossAssets) * 100 : 0, dot: 'bg-cash' },
                  ...(debts > 0 ? [{ label: 'Debts', value: -debts, pct: debtRatio, dot: 'bg-debt' }] : []),
                ].map((part) => (
                  <div key={part.label} className="min-w-0">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${part.dot}`} />
                      {part.label}
                    </p>
                    <p className="mt-1 whitespace-nowrap font-display text-lg font-extrabold tnum text-ink">{thbCompact(part.value)}</p>
                    <p className="text-xs text-ink-muted tnum">{part.pct.toFixed(1)}%</p>
                  </div>
                ))}
              </div>
            </Inset>
          </div>

          {/* Asset mix bar and legend */}
          {grossAssets > 0 && (
            <div className="space-y-2.5 border-t border-line px-5 pb-5 pt-4 sm:px-6">
              <div className="flex h-2 overflow-hidden rounded-full bg-surface-muted">
                {alloc.map((a) => (
                  <div
                    key={a.assetClass}
                    style={{ width: `${(a.value / grossAssets) * 100}%`, background: ASSET_META[a.assetClass].cssVar }}
                    title={`${ASSET_META[a.assetClass].label}: ${thb(a.value)}`}
                  />
                ))}
                {cash > 0 && <div style={{ width: `${(cash / grossAssets) * 100}%`, background: 'var(--color-cash)' }} title={`Cash: ${thb(cash)}`} />}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {alloc.map((a) => (
                  <span key={a.assetClass} className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: ASSET_META[a.assetClass].cssVar }} />
                    {ASSET_META[a.assetClass].label} <span className="tnum">{Math.round((a.value / grossAssets) * 100)}%</span>
                  </span>
                ))}
                {cash > 0 && (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: 'var(--color-cash)' }} />
                    Cash <span className="tnum">{Math.round((cash / grossAssets) * 100)}%</span>
                  </span>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ── Spend cash flow (this spending month) ── */}
      <SpendSnapshotCard />

      {/* ── Allocation, cash and debts ── */}
      <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12">
        {/* Allocation */}
        <div id="guide-dashboard-alloc" className="lg:col-span-5 xl:col-span-4">
          <Card className="h-full animate-rise">
            <CardHeader title="Allocation" action={<TextLink to="/portfolio">Portfolio →</TextLink>} />

            <Inset id="guide-portfolio-summary" className="@container mt-3">
              {/* Stacks when the card is narrow, sits side by side once there is room */}
              <div className="flex flex-col gap-3 @min-[17rem]:flex-row @min-[17rem]:items-start @min-[17rem]:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-ink-muted">Portfolio value</p>
                  <p title={thb(portfolio.value)} className="mt-1 font-display text-2xl font-extrabold tracking-tight tnum text-ink">
                    {thbCompact(portfolio.value)}
                  </p>
                  <p className="text-xs text-ink-muted" title={thb(portfolio.cost)}>
                    Cost <span className="font-semibold tnum text-ink-soft">{thbCompact(portfolio.cost)}</span>
                  </p>
                </div>
                <div className="min-w-0 @min-[17rem]:text-right">
                  <p className="text-xs font-semibold text-ink-muted">All-time profit</p>
                  <PnLText value={portfolio.pnl} compact className="mt-1 block font-display text-2xl !font-extrabold tracking-tight" />
                  <div className="mt-0.5 flex items-center gap-1.5 @min-[17rem]:justify-end">
                    <PnLPill value={portfolio.pnlPct} asPct size="sm" />
                  </div>
                  <UnpricedNote count={portfolio.unpricedCount} />
                </div>
              </div>
            </Inset>

            <div className="mt-4 flex flex-col items-center gap-4">
              <DonutChart
                segments={allocSegments}
                size={155}
                thickness={17}
                ariaLabel={`Holdings asset allocation, total value ${thb(portfolio.value)}`}
                centerLabel="Total"
                centerValue={thbCompact(portfolio.value)}
              />
              <div className="w-full divide-y divide-line border-t border-line">
                {alloc.map((a) => {
                  const pctVal = portfolio.value > 0 ? (a.value / portfolio.value) * 100 : 0
                  return (
                    <div key={a.assetClass} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2 text-ink">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: ASSET_META[a.assetClass].color }} />
                        <span className="truncate">{ASSET_META[a.assetClass].plural}</span>
                      </span>
                      <span className="shrink-0 font-semibold tnum text-ink">
                        {thb(a.value)} <span className="text-xs font-normal text-ink-muted">{pctVal.toFixed(1)}%</span>
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </Card>
        </div>

        {/* Cash */}
        <div id="guide-dashboard-cash" className="lg:col-span-7 xl:col-span-4">
          <Card className="h-full animate-rise">
            <CardHeader title="Cash" action={<TextLink to="/cash">Manage</TextLink>} />

            <Inset id="guide-cash-summary" className="mt-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-ink-muted">Available</p>
                  <p title={thb(cash)} className="mt-1 truncate font-display text-2xl font-extrabold tracking-tight tnum text-ink">{thbCompact(cash)}</p>
                  <p className="text-xs text-ink-muted tnum">
                    {data.cashAccounts.length} {data.cashAccounts.length === 1 ? 'account' : 'accounts'}
                  </p>
                </div>
                <div className="min-w-0 text-right">
                  <p className="text-xs font-semibold text-ink-muted">Interest a year</p>
                  <p
                    title={cashInterest > 0 ? `~${thb(cashInterest)} a year` : undefined}
                    className={`mt-1 truncate font-display text-2xl font-extrabold tracking-tight tnum ${cashInterest > 0 ? 'text-gain' : 'text-ink-muted'}`}
                  >
                    {cashInterest > 0 ? `~${thbCompact(cashInterest)}` : '฿0'}
                  </p>
                  <p className="text-xs text-ink-muted tnum">{cashYieldRate > 0 ? `~${cashYieldRate.toFixed(2)}% average` : 'No interest set'}</p>
                </div>
              </div>
            </Inset>

            {data.cashAccounts.length > 0 ? (
              <>
                <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-surface-muted">
                  {data.cashAccounts.map((a, i) => {
                    // Without a real rate a USD account has no THB width (the Layout notice explains)
                    const thbVal = a.currency === 'USD' ? a.balance * rateOrZero(usdThb) : a.balance
                    return (
                      <div
                        key={a.id}
                        style={{ width: `${cash > 0 ? (thbVal / cash) * 100 : 0}%`, background: cashColor(a.name, i) }}
                        title={`${a.name}: ${moneyCompact(a.balance, a.currency)}`}
                      />
                    )
                  })}
                </div>
                <div className="mt-2 divide-y divide-line">
                  {data.cashAccounts.map((a, i) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => navigate('/cash')}
                      aria-label={`View ${a.name} in Cash`}
                      className="flex w-full items-center gap-2.5 py-2.5 text-left text-sm cursor-pointer"
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: cashColor(a.name, i) }} />
                      <span className="min-w-0 flex-1 truncate text-ink">{a.name}</span>
                      {a.interestRate !== undefined && a.interestRate > 0 && (
                        <span className="shrink-0 text-xs font-semibold text-gain tnum">{a.interestRate}%</span>
                      )}
                      <span className="shrink-0 font-semibold tnum text-ink">{moneyCompact(a.balance, a.currency)}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <Link to="/cash" className={`mt-3 ${PROMPT}`}>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-ink">Add your cash accounts</span>
                  <span className="block text-xs text-ink-muted">Bank accounts, savings and wallets, with the interest they earn.</span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-link">Add →</span>
              </Link>
            )}
          </Card>
        </div>

        {/* Debts */}
        <div id="guide-dashboard-debts" className="lg:col-span-12 xl:col-span-4">
          <Card className="h-full animate-rise">
            <CardHeader title="Debts" action={<TextLink to="/spend/loans">Manage</TextLink>} />

            <Inset id="guide-debt-summary" className="mt-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-ink-muted">Owed</p>
                  <p title={debts > 0 ? `-${thb(debts)}` : '฿0'} className="mt-1 truncate font-display text-2xl font-extrabold tracking-tight tnum text-ink">
                    {debts > 0 ? `-${thbCompact(debts)}` : '฿0'}
                  </p>
                  <p className="text-xs text-ink-muted tnum">{debts > 0 ? `${debtRatio.toFixed(1)}% of assets` : 'Debt free'}</p>
                </div>
                <div className="min-w-0 text-right">
                  <p className="text-xs font-semibold text-ink-muted">Paid a month</p>
                  <p title={`~${thb(monthlyDebt)} a month`} className="mt-1 truncate font-display text-2xl font-extrabold tracking-tight tnum text-ink">
                    {monthlyDebt > 0 ? `~${thbCompact(monthlyDebt)}` : '฿0'}
                  </p>
                  <p className="text-xs text-ink-muted tnum">
                    {[
                      (data.liabilities?.length ?? 0) > 0 && `${data.liabilities?.length} ${data.liabilities?.length === 1 ? 'loan' : 'loans'}`,
                      countedCards.length > 0 && `${countedCards.length} ${countedCards.length === 1 ? 'card' : 'cards'}`,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Nothing owed'}
                  </p>
                </div>
              </div>
              {cardsOwed > 0 && (
                <Link to="/spend/accounts" className="mt-2 block truncate text-xs text-ink-muted hover:text-ink">
                  Includes <b className="font-semibold text-ink tnum">{thb(cardsOwed)}</b> on Spend credit cards →
                </Link>
              )}
            </Inset>

            {(data.liabilities?.length ?? 0) > 0 ? (
              <>
                <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-surface-muted">
                  {data.liabilities!.map((l) => (
                    <div
                      key={l.id}
                      style={{ width: `${debts > 0 ? (l.balance / debts) * 100 : 0}%`, background: (DEBT_CATEGORIES[l.category] ?? DEBT_CATEGORIES.other).color }}
                      title={`${l.name}: ${thb(l.balance)}`}
                    />
                  ))}
                </div>
                <div className="mt-1 divide-y divide-line">
                  {data.liabilities!.map((l) => {
                    const meta = DEBT_CATEGORIES[l.category] ?? DEBT_CATEGORIES.other
                    const isInst = l.isInstallment || l.category === 'installment'
                    const totalInst = l.totalInstallments ?? 0
                    const paidInst = l.paidInstallments ?? 0
                    const percent = totalInst > 0 ? Math.min(100, Math.round((paidInst / totalInst) * 100)) : 0
                    const dueInfo = getLiabilityDueStatus(l)
                    const openLoan = () => {
                      setSelectedLiabilityId(l.id)
                      setLiabilitiesOpen(true)
                    }

                    return (
                      <div key={l.id} className="py-3">
                        <button type="button" onClick={openLoan} className="flex w-full items-center gap-2 text-left cursor-pointer">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: meta.color }} />
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{l.name}</span>
                          {l.interestRate !== undefined && l.interestRate > 0 && (
                            <span className="shrink-0 text-xs font-semibold text-ink-muted tnum">{l.interestRate}%</span>
                          )}
                          <span className="shrink-0 text-sm font-bold tnum text-ink">{l.balance > 0 ? `-${thb(l.balance)}` : '฿0'}</span>
                        </button>

                        <div className="mt-1.5 flex items-center justify-between gap-2 pl-4">
                          <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-ink-muted">
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${dueInfo.badgeClass}`}>{dueInfo.label}</span>
                            {l.monthlyPayment && l.monthlyPayment > 0 && l.balance > 0 && <span className="tnum">~{thb(l.monthlyPayment)}/mo</span>}
                            {isInst && totalInst > 0 && <span className="tnum">{paidInst}/{totalInst} terms</span>}
                          </div>

                          {(l.monthlyPayment || isInst) && (
                            <div className="shrink-0">
                              {dueInfo.status === 'completed' ? (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-gain">
                                  <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
                                  Paid off
                                </span>
                              ) : dueInfo.status === 'paid' ? (
                                <span className="inline-flex items-center gap-2 text-xs">
                                  <span className="inline-flex items-center gap-1 font-semibold text-gain">
                                    <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
                                    Paid
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => undoLoanPayment(l.id)}
                                    aria-label={`Undo payment for ${l.name}`}
                                    className="relative font-semibold text-ink-muted hover:text-ink hover:underline cursor-pointer after:absolute after:-inset-2 after:content-['']"
                                  >
                                    Undo
                                  </button>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openPayLoan(l.id)}
                                  aria-label={`Pay ${l.name}`}
                                  className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-hover cursor-pointer"
                                >
                                  <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.6} />
                                  Pay
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {isInst && totalInst > 0 && (
                          <div
                            role="progressbar"
                            aria-valuenow={percent}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`${l.name}: ${percent}% repaid`}
                            className="ml-4 mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted"
                          >
                            <div className={`h-full rounded-full ${percent >= 100 ? 'bg-gain' : 'bg-brand'}`} style={{ width: `${percent}%` }} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <Link to="/spend/loans" className={`mt-3 ${PROMPT}`}>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-ink">No loans recorded</span>
                  <span className="block text-xs text-ink-muted">Add a loan or installment to see what's left to pay.</span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-link">Add →</span>
              </Link>
            )}
          </Card>
        </div>
      </div>

      {/* ── Net worth over time (full width) ── */}
      <div id="guide-dashboard-chart">
        <Card className="animate-rise overflow-hidden" padded={false}>
          {(data.netWorthHistory?.length ?? 0) >= 2 ? (
            <InteractiveNetWorthChart history={data.netWorthHistory!} />
          ) : (
            <div className="p-8 text-center">
              <SparkleIcon className="h-6 w-6 mx-auto text-link mb-2" />
              <h3 className="font-display text-lg font-extrabold text-ink">Net worth over time</h3>
              <p className="text-sm text-ink-muted mt-1 max-w-md mx-auto">
                Snapshot history will record daily as your balances and holdings update.
              </p>
            </div>
          )}
        </Card>
      </div>

      <LoanSheet
        open={liabilitiesOpen}
        onClose={() => {
          setLiabilitiesOpen(false)
          setSelectedLiabilityId(null)
        }}
        loanId={selectedLiabilityId}
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




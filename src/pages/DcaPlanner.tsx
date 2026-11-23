import React, { useRef, useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useData } from '../store/DataContext'
import { useToast } from '../store/ToastContext'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { DcaForm } from '../components/forms/DcaForm'
import { ConfirmDcaBuyForm } from '../components/forms/ConfirmDcaBuyForm'
import { BuyTrendSheet } from '../components/charts/BuyTrendSheet'
import { IconButton } from '../components/ui/IconButton'
import { ConfirmDividendModal } from '../components/forms/ConfirmDividendModal'
import { GuideTour } from '../components/guide/GuideTour'
import { usePageGuide } from '../hooks/usePageGuide'
import { useLivePrices } from '../hooks/useLivePrices'
import { BuyTrendIcon, CheckCircleIcon, CheckIcon, DcaIcon, PencilIcon, PlusIcon } from '../components/icons'
import { AssetLogo } from '../components/ui/AssetLogo'
import { fixedCostRecurring, inPeriod, perMonth, periodFor, periodLabel } from '../modules/spend/logic'
import { flowVerdict, livingAverage, livingPace, livingSpend, monthlyFlow } from '../modules/spend/monthlyFlow'
import { settingsPath } from '../lib/settingsSections'
import { MonthlyFlowCard } from './dca/MonthlyFlowCard'
import { cardOrder, isDefaultOrder, moveInOrder } from '../lib/cardOrder'
import { ArrangeButton, ReorderSheet } from '../modules/spend/ReorderSheet'
import { useSpend } from '../modules/spend/useSpend'
import {
  ASSET_META, buyDateThisPeriod, totalCash, dcaThisMonth, getHoldingDpsForMonth, isBuyDayOverdue, isBuyDayToday, isConfirmedForPeriod, isDividendReceivedThisMonth, isSkippedForPeriod,
  nextBuyDate, shouldConfirmBuy, sortDcaPlans,
} from '../lib/calc'
import type { DcaPlan, Holding } from '../lib/types'
import { daysUntil, localDateStr, money, ordinal, thb } from '../lib/format'
import { dividendInUsd, dividendThb } from '../lib/dividendSchedule'
import { TextLink } from '../components/ui/TextLink'

// ─── Chevron icon ─────────────────────────────────────────────────────────────

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`h-4 w-4 text-ink-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  )
}

// ─── Salary amount (Salary row of the monthly flow) ───────────────────────────

function SalaryAmount({ value, editing, draft, inputRef, onOpen, onDraftChange, onCommit, onCancel }: {
  value: string; editing: boolean; draft: string
  inputRef: React.RefObject<HTMLInputElement>
  onOpen: () => void; onDraftChange: (v: string) => void
  onCommit: () => void; onCancel: () => void
}) {
  if (editing) {
    return (
      <span className="flex items-center gap-1">
        <span className="text-sm font-semibold text-ink-muted">฿</span>
        <input
          ref={inputRef} type="number" min="0" value={draft}
          aria-label="Monthly salary"
          onChange={(e) => onDraftChange(e.target.value)}
          onBlur={onCommit}
          onKeyDown={(e) => { if (e.key === 'Enter') onCommit(); if (e.key === 'Escape') onCancel() }}
          className="w-28 rounded-lg border border-brand bg-surface px-2 py-1 text-right text-base font-bold tnum text-ink outline-none focus:ring-2 focus:ring-brand/30"
        />
      </span>
    )
  }
  return (
    <button
      onClick={onOpen}
      aria-label="Edit monthly salary"
      className="group -my-1 -mr-1 flex min-h-[32px] items-center gap-1.5 rounded-lg px-1 transition-colors hover:bg-surface-muted cursor-pointer"
    >
      <PencilIcon className="h-3.5 w-3.5 text-ink-muted opacity-60 transition-opacity group-hover:opacity-100" />
      <span className="font-display text-sm font-extrabold tnum text-ink">{value}</span>
    </button>
  )
}


// ─── Section header with toggle ───────────────────────────────────────────────

function SectionHeader({ label, total, open, onToggle, action }: {
  label: string; total: number; open: boolean; onToggle: () => void; action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between">
      <button
        onClick={onToggle}
        aria-label={`Toggle ${label} section, total ${thb(total)}`}
        aria-expanded={open}
        className="flex items-center gap-2 group cursor-pointer"
      >
        <div className="text-left">
          <p className="whitespace-nowrap text-xs font-semibold text-ink-faint">{label}</p>
          <p className="mt-0.5 font-display text-xl font-extrabold tnum text-ink leading-none">
            {thb(total)}
          </p>
        </div>
        <ChevronIcon open={open} />
      </button>
      {action}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function DcaPlanner() {
  const {
    steps,
    isRunning,
    currentStepIndex,
    startTour,
    endTour,
    finishTour,
    nextStep,
    prevStep,
  } = usePageGuide('dca')
  const {
    data, setMonthlyIncome,
    setData, skipDcaBuy, unskipDcaBuy,
  } = useData()
  const { showToast } = useToast()

  // Salary edit
  const [editingSalary, setEditingSalary] = useState(false)
  const [salaryDraft, setSalaryDraft] = useState('')
  const salaryRef = useRef<HTMLInputElement>(null)

  // Section expand state — default collapsed
  const [savingsOpen, setSavingsOpen] = useState(true)

  // DCA form
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<DcaPlan | null>(null)

  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setEditing(null)
      setFormOpen(true)
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('action')
      setSearchParams(newParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  // Buy trend of one plan
  const [trendPlan, setTrendPlan] = useState<DcaPlan | null>(null)

  // Log buy form
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirming, setConfirming] = useState<DcaPlan | null>(null)

  // Dividend modal state
  const [dividendModalOpen, setDividendModalOpen] = useState(false)
  const [selectedDividendHolding, setSelectedDividendHolding] = useState<Holding | null>(null)

  // Card order, and the sheet that changes it
  const [arrangeOpen, setArrangeOpen] = useState(false)

  // Fixed costs live in Spend as recurring bills; weekly / yearly ones count at their monthly rate
  const fixedTotal = fixedCostRecurring(data.spendRecurring ?? []).reduce((s, x) => s + perMonth(x), 0)
  const dcaMonth   = dcaThisMonth(data.dcaPlans)
  // Salary comes from Spend's recurring income in the Salary category when there is one;
  // the number typed here is the fallback
  const spend = useSpend()
  const navigate = useNavigate()
  const recurringSalary = spend.recurring
    .filter((r) => r.type === 'income' && r.categoryId === 'salary' && !r.paused)
    .reduce((s, r) => s + perMonth(r), 0)
  const salaryFromSpend = recurringSalary > 0
  const salary = salaryFromSpend ? recurringSalary : data.monthlyIncome

  // Living: day-to-day spending outside fixed bills, from what Spend actually logged over the last
  // finished months. Spend's budget may or may not include bills, so it only stands in with no history
  const spendPeriod = periodFor(localDateStr(), spend.settings.cycle)
  const spendMonthTxns = spend.transactions.filter((t) => inPeriod(spendPeriod, t.date))
  const spendBudget = spend.settings.monthlyBudget ?? 0
  const livingAvg = livingAverage(spend.transactions, spend.recurring, spend.settings.cycle)
  const usualLiving = livingAvg.months > 0 ? livingAvg.average : spendBudget
  // This month spending faster than usual raises what it needs; slower never lowers it (the month isn't over)
  const livingSoFar = livingSpend(spendMonthTxns, spend.recurring)
  const pace = livingPace(livingSoFar, spendPeriod)
  const aheadOfUsual = pace !== null && usualLiving > 0 && pace > usualLiving * 1.05
  const living = aheadOfUsual ? pace : usualLiving
  const budgetLink = <Link to={settingsPath('monthly-budget')} className="font-semibold text-link hover:underline">{spendBudget > 0 ? `Budget ${thb(spendBudget)}` : 'Set a budget'}</Link>
  const livingNote = aheadOfUsual ? (
    <span className="text-warn-ink">On pace for this month, above your usual {thb(usualLiving)}</span>
  ) : livingAvg.months > 0 ? (
    <>Average of the last {livingAvg.months === 1 ? 'month' : `${livingAvg.months} months`} in Spend · {budgetLink}</>
  ) : spendBudget > 0 ? (
    <>Your Spend budget, until there is a month of history · {budgetLink}</>
  ) : (
    <>Log spending in Spend to see this · {budgetLink}</>
  )

  const plans = sortDcaPlans(data.dcaPlans)
  // Sum of the plans' monthly amounts, for each plan's share
  const currentTotalDcaAmount = plans.reduce((s, p) => s + p.monthlyAmount, 0)
  // What the plans buy this month (weekly and daily plans counted by their buys this month)
  const savingsTotal = dcaMonth.total
  // The plan list is already in buy order (sortDcaPlans), so each group is one run of rows
  const hasGroups = new Set(plans.map(whenGroup)).size > 1

  // ── Salary handlers ──
  function openSalaryEdit() {
    if (salaryFromSpend) {
      navigate('/spend/recurring')
      return
    }
    setSalaryDraft(salary > 0 ? String(salary) : '')
    setEditingSalary(true)
    setTimeout(() => salaryRef.current?.select(), 0)
  }
  function commitSalary() {
    const v = parseFloat(salaryDraft.replace(/,/g, ''))
    if (!isNaN(v) && v >= 0) setMonthlyIncome(v)
    setEditingSalary(false)
  }

  const { usdThb } = useLivePrices()
  const effectiveUsdThb = usdThb && usdThb > 0 ? usdThb : null

  // Expected dividends for the current month, in baht: US stocks pay in USD, counted only at a real rate
  const currentMonth = new Date().getMonth() + 1
  const scheduledDividends = (data.holdings ?? []).filter(
    (h) => h.paysDividend && (h.dividendMonths ?? []).includes(currentMonth),
  )
  const estDividendNet = (h: Holding) => (h.units ?? h.totalUnits ?? 0) * getHoldingDpsForMonth(h, currentMonth) * 0.90
  const totalEstDividendNet = scheduledDividends.reduce((sum, h) => sum + (dividendThb(h, estDividendNet(h), effectiveUsdThb) ?? 0), 0)
  /** A holding's dividend in baht when it can be, else in its dollars */
  const dividendShown = (h: Holding, amount: number) => {
    const inThb = dividendThb(h, amount, effectiveUsdThb)
    return inThb === null ? money(amount, 'USD', true) : thb(inThb)
  }
  // Only money you can top up from: accounts marked locked (a provident fund) don't count
  const cash = totalCash({ ...data, cashAccounts: data.cashAccounts.filter((a) => a.category !== 'locked') }, effectiveUsdThb)
  const flow = monthlyFlow({ salary, fixed: fixedTotal, living, invest: savingsTotal, cash })
  const verdict = flowVerdict(flow, cash)

  const openAdd = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (p: DcaPlan) => { setEditing(p); setFormOpen(true) }

  const order = cardOrder(DCA_CARD_IDS, data.dcaCardOrder)
  const saveOrder = (next: DcaCardId[]) =>
    setData((prev) => ({ ...prev, dcaCardOrder: isDefaultOrder(DCA_CARD_IDS, next) ? undefined : next }))

  const cards: Record<DcaCardId, React.ReactNode> = {
    flow: (
      <>
          {/* ── Monthly flow: salary → bills → living → invest ── */}
          <div id="guide-dca-summary">
            <MonthlyFlowCard
              flow={flow}
              verdict={verdict}
              cash={cash}
              livingNote={livingNote}
              livingThisMonth={spendMonthTxns.length > 0 ? livingSoFar : null}
              periodName={periodLabel(spendPeriod, spend.settings.cycle)}
              salaryNote={salaryFromSpend ? 'Recurring Salary in Spend' : undefined}
              onAddSalary={openSalaryEdit}
              salaryAmount={
                <SalaryAmount
                  value={salary > 0 ? thb(salary) : '฿0'}
                  editing={editingSalary}
                  draft={salaryDraft}
                  inputRef={salaryRef}
                  onOpen={openSalaryEdit}
                  onDraftChange={setSalaryDraft}
                  onCommit={commitSalary}
                  onCancel={() => setEditingSalary(false)}
                />
              }
            />
          </div>
      </>
    ),
    plans: (
      <>
        <div id="guide-dca-plans">
        <Card className="card-bleed-mobile animate-rise overflow-hidden" padded={false}>
            <div className="p-5">
              <SectionHeader
                label="Savings & Invest"
                total={savingsTotal}
                open={savingsOpen}
                onToggle={() => setSavingsOpen((v) => !v)}
                action={
                  <Button variant="secondary" size="sm" onClick={openAdd} className="shrink-0 gap-1.5 whitespace-nowrap">
                    <PlusIcon className="h-4 w-4" strokeWidth={2.2} />
                    Add plan
                  </Button>
                }
              />
            </div>

            {savingsOpen && (
              <div className="border-t border-line">
                  {plans.length === 0 ? (
                    <div className="p-5">
                      <EmptyState
                        icon={<DcaIcon className="h-6 w-6" />}
                        title="No invest plans yet"
                        description="Add recurring buys to track your dollar-cost averaging."
                        accent="var(--color-brand)"
                        action={
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={openAdd}
                            className="cursor-pointer gap-1.5 h-9"
                          >
                            <PlusIcon className="h-4 w-4" strokeWidth={2.2} />
                            <span>Add plan</span>
                          </Button>
                        }
                      />
                    </div>
                  ) : (
                    <ul className="divide-y divide-line">
                      {plans.map((p, i) => {
                        const group = whenGroup(p)
                        const showGroup = hasGroups && (i === 0 || whenGroup(plans[i - 1]) !== group)
                        const meta = ASSET_META[p.assetClass]
                        const confirmed = isConfirmedForPeriod(p)
                        const skipped = isSkippedForPeriod(p)
                        const isOverdue = isBuyDayOverdue(p) && !confirmed && !skipped
                        const isToday = isBuyDayToday(p) && !confirmed && !skipped
                        const needsAction = shouldConfirmBuy(p)
                        const next = nextBuyDate(p)
                        const days = daysUntil(localDateStr(next))

                        const isRecent = (dates: string[] | undefined) => {
                          if (!dates || dates.length === 0) return false
                          const latestStr = dates[0]
                          let latestMs = 0
                          if (latestStr.includes('T') || latestStr.includes(':')) {
                            latestMs = new Date(latestStr).getTime()
                          } else {
                            const [y, m, d] = latestStr.split('-').map(Number)
                            latestMs = new Date(y, m - 1, d).getTime()
                          }
                          const diffMs = Date.now() - latestMs
                          return diffMs > 0 && diffMs <= 3600000
                        }
                        const showConfirmed = confirmed && isRecent(p.confirmedDates)
                        // Percentage relative to the total of the DCA plans themselves
                        const planPct = currentTotalDcaAmount > 0
                          ? (p.monthlyAmount / currentTotalDcaAmount) * 100
                          : 0

                        return (
                          <React.Fragment key={p.id}>
                          {showGroup && (
                            <li className="bg-surface-muted/50 px-5 pb-1.5 pt-3 text-xs font-semibold text-ink-muted">{group}</li>
                          )}
                          <li>
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => openEdit(p)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  openEdit(p)
                                }
                              }}
                              aria-label={`Edit ${p.name}`}
                              className="flex cursor-pointer items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-muted/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:gap-3.5 sm:py-4"
                            >
                              <AssetLogo
                                ticker={p.ticker}
                                name={p.name}
                                assetClass={p.assetClass}
                                size="md"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="truncate text-sm font-semibold text-ink">{p.name}</p>
                                  <p className="shrink-0 font-display text-base font-extrabold tnum text-ink">
                                    {thb(p.monthlyAmount)}
                                  </p>
                                </div>
                                  <div className="mt-0.5 flex items-center justify-between gap-2 text-xs sm:mt-1">
                                    <span className="min-w-0 truncate text-ink-muted">
                                      {meta.label}
                                      <span className="sm:hidden"> · {freqLabelShort(p)}</span>
                                      <span className="hidden sm:inline"> · {freqLabel(p)}</span>
                                      <span className="tnum"> · {planPct.toFixed(1)}%</span>
                                    </span>
                                  {showConfirmed && !skipped ? (
                                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gain-soft px-2 py-0.5 text-xs font-semibold text-gain-ink">
                                      <CheckIcon className="h-3 w-3" strokeWidth={2.4} /> Logged
                                    </span>
                                  ) : isOverdue ? (
                                    // A missed buy costs nothing, so it's a reminder, not red like an overdue bill
                                    <span className="inline-block shrink-0 text-xs font-bold text-warn-ink">
                                      Missed {buyDateThisPeriod(p).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                    </span>
                                  ) : isToday || days <= 0 ? (
                                    <span className="inline-block shrink-0 text-xs font-bold text-warn-ink">Today</span>
                                  ) : days < 3 ? (
                                    <span className="inline-block shrink-0 text-xs font-semibold text-warn-ink">
                                      {days === 1 ? 'Tomorrow' : `in ${days} days`}
                                    </span>
                                  ) : (
                                    <span className="inline-block shrink-0 text-xs font-semibold text-stocks">in {days} days</span>
                                  )}
                                  </div>
                                  {needsAction && (
                                    <div id="guide-dca-confirm" className="mt-1.5 flex items-center gap-2 sm:mt-2">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setConfirming(p); setConfirmOpen(true) }}
                                        aria-label={`Log DCA buy for ${p.name}`}
                                        className="inline-flex items-center gap-1.5 rounded-full bg-gain-strong hover:bg-gain-strong-hover text-white px-3.5 py-1.5 text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer min-h-[34px]"
                                      >
                                        <CheckCircleIcon className="h-3.5 w-3.5" strokeWidth={2.4} />
                                        <span>{p.assetClass === 'cash' ? 'Log deposit' : 'Log buy'}</span>
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          const date = localDateStr()
                                          skipDcaBuy(p.id, date)
                                          showToast(`Skipped ${p.name} this time`, 'info', { label: 'Undo', onClick: () => unskipDcaBuy(p.id, date) })
                                        }}
                                        aria-label={`Skip DCA buy for ${p.name} this period`}
                                        className="inline-flex items-center rounded-full border border-line-strong bg-surface hover:bg-surface-muted text-ink-muted hover:text-ink px-3.5 py-1.5 text-xs font-semibold active:scale-95 transition-all cursor-pointer min-h-[34px]"
                                      >
                                        Skip
                                      </button>
                                    </div>
                                  )}
                              </div>
                              {p.assetClass !== 'cash' && !p.cashAccountId && (
                                <IconButton
                                  size="sm"
                                  icon={<BuyTrendIcon className="h-4 w-4" />}
                                  label={`Buy trend of ${p.name}`}
                                  onClick={(e) => { e.stopPropagation(); setTrendPlan(p) }}
                                  onKeyDown={(e) => e.stopPropagation()}
                                  className="shrink-0"
                                />
                              )}
                            </div>
                          </li>
                          </React.Fragment>
                        )
                      })}
                    </ul>
                  )}

                  {/* Footer */}
                  {plans.length > 0 && (
                    <div className="flex items-center justify-between border-t border-line py-4 px-5 bg-surface-muted/30">
                      <div>
                        <p className="text-xs text-ink-muted">Invest rate</p>
                        <p className="font-display text-lg font-extrabold tnum leading-tight mt-0.5">
                          {salary > 0 ? (
                            <>
                              <span className="text-gain-ink">{Math.round((savingsTotal / salary) * 100)}%</span>
                              <span className="ml-1.5 text-sm font-medium text-ink">of salary</span>
                            </>
                          ) : (
                            <span className="text-sm text-ink-muted font-normal">Set your salary to see this</span>
                          )}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-xs text-ink-muted">Plans</p>
                        <p className="font-display text-lg font-extrabold tnum leading-tight mt-0.5 text-ink">{plans.length}</p>
                      </div>
                    </div>
                  )}
                </div>
            )}
          </Card>

        </div>
      </>
    ),
    dividends: (
      <>
            <Card className="card-bleed-mobile animate-rise overflow-hidden" padded={false}>
              <div className="p-5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-ink-faint">
                      Dividend income
                    </p>
                    <span className="rounded-full bg-gain/15 text-gain-ink px-2 py-0.5 text-xs font-bold">
                      {MONTH_NAMES[currentMonth - 1]}
                    </span>
                  </div>
                  <p className="mt-0.5 font-display text-xl font-extrabold tnum text-ink leading-none">
                    {totalEstDividendNet > 0 ? `~${thb(totalEstDividendNet)}` : '฿0'}
                  </p>
                </div>
                <TextLink to="/dividends">Dividends →</TextLink>
              </div>

              <div className="border-t border-line">
                {scheduledDividends.length === 0 ? (
                  <div className="p-5 text-center">
                    <p className="text-sm text-ink-muted">
                      No holdings scheduled for dividend payout in {MONTH_NAMES[currentMonth - 1]}.
                    </p>
                    <TextLink to="/dividends" className="mt-1.5 inline-block">
                      Dividends →
                    </TextLink>
                  </div>
                ) : (
                  <ul className="divide-y divide-line max-h-[380px] overflow-y-auto">
                    {scheduledDividends.map((h) => {
                      const units = h.units ?? h.totalUnits ?? 0
                      const dps = getHoldingDpsForMonth(h, currentMonth)
                      const estNet = estDividendNet(h)
                      const isReceived = isDividendReceivedThisMonth(h.id, data.dividendRecords)
                      const sym = dividendInUsd(h) ? '$' : '฿'

                      return (
                        <li key={h.id} className="p-4 sm:p-5 hover:bg-surface-muted/30 transition-colors">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <AssetLogo ticker={h.ticker} name={h.name} assetClass={h.assetClass} size="md" />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-display font-bold text-base text-ink">{h.ticker}</span>
                                  <span className="text-xs text-ink-muted truncate max-w-[140px] sm:max-w-xs">{h.name}</span>
                                </div>
                                <p className="text-xs text-ink-muted mt-0.5">
                                  {units.toLocaleString()} shares · Est. DPS: {dps > 0 ? `${sym}${dps.toLocaleString()}` : '-'}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              {estNet > 0 && (
                                <div className="text-right hidden sm:block">
                                  <span className="font-display text-sm font-bold text-gain-ink tnum">
                                    ~{dividendShown(h, estNet)}
                                  </span>
                                  <p className="text-xs text-ink-muted">Est. Net</p>
                                </div>
                              )}

                              {isReceived ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-gain-soft px-3 py-1.5 text-xs font-semibold text-gain-ink">
                                  <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.4} /> Confirmed
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedDividendHolding(h)
                                    setDividendModalOpen(true)
                                  }}
                                  aria-label={`Confirm Dividend for ${h.ticker}`}
                                  className="inline-flex items-center gap-1.5 rounded-full bg-gain-strong hover:bg-gain-strong-hover text-white px-3.5 py-1.5 text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer min-h-[34px]"
                                >
                                  <CheckCircleIcon className="h-3.5 w-3.5" strokeWidth={2.4} />
                                  <span>Confirm dividend</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </Card>
      </>
    ),
  }

  return (
    <>
      <PageHeader
        eyebrow="Invest"
        title="DCA plans"
        subtitle="Monthly salary allocation & recurring investments."
        onStartGuide={startTour}
        action={
          <ArrangeButton label="Arrange cards" onClick={() => setArrangeOpen(true)} />
        }
      />

      {/* Cards in your order; on wide screens they flow down two columns */}
      <div className="flex flex-col gap-6 lg:block lg:columns-2 lg:gap-6">
        {order.map((id) => (
          <div key={id} className="break-inside-avoid empty:hidden lg:mb-6">
            {cards[id]}
          </div>
        ))}
      </div>

        <DcaForm open={formOpen} editing={editing} onClose={() => setFormOpen(false)} />
        <ReorderSheet
          open={arrangeOpen}
          onClose={() => setArrangeOpen(false)}
          title="Arrange cards"
          description="Choose the order of the cards on DCA plans. On a wide screen they fill two columns, top to bottom."
          items={order.map((id) => ({ id, label: DCA_CARDS.find((c) => c.id === id)?.label ?? id }))}
          onMove={(id, delta) => saveOrder(moveInOrder(order, id as DcaCardId, delta))}
          canReset={!isDefaultOrder(DCA_CARD_IDS, order)}
          onReset={() => saveOrder([...DCA_CARD_IDS])}
        />
        <BuyTrendSheet open={trendPlan !== null} plan={trendPlan} onClose={() => setTrendPlan(null)} />
        <ConfirmDcaBuyForm
          open={confirmOpen}
          plan={confirming}
          onClose={() => setConfirmOpen(false)}
        />
        <ConfirmDividendModal
          open={dividendModalOpen}
          holding={selectedDividendHolding}
          initialDps={selectedDividendHolding ? getHoldingDpsForMonth(selectedDividendHolding, currentMonth) : undefined}
          onClose={() => {
            setDividendModalOpen(false)
            setSelectedDividendHolding(null)
          }}
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
      </>
    )
  }

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Cards on DCA plans that can be reordered, in their default order */
const DCA_CARDS = [
  { id: 'flow', label: 'This month' },
  { id: 'plans', label: 'Savings & Invest' },
  { id: 'dividends', label: 'Dividend income' },
] as const
type DcaCardId = (typeof DCA_CARDS)[number]['id']
const DCA_CARD_IDS: readonly DcaCardId[] = DCA_CARDS.map((c) => c.id)

function whenGroup(p: DcaPlan): string {
  if (shouldConfirmBuy(p)) return 'Due now'
  return daysUntil(localDateStr(nextBuyDate(p))) <= 7 ? 'Next 7 days' : 'Later'
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const WEEKDAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const WEEKDAY_SHORT = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Compact frequency label for the mobile 2-line row: "1st", "Mon", "Daily", "Last day". */
function freqLabelShort(p: { frequency?: string; dayOfMonth: number }): string {
  const freq = p.frequency ?? 'monthly'
  if (freq === 'daily') return 'Daily'
  if (freq === 'weekly') return WEEKDAY_SHORT[p.dayOfMonth] ?? 'Weekly'
  if (p.dayOfMonth === 31) return 'Last day'
  return ordinal(p.dayOfMonth)
}

function freqLabel(p: { frequency?: string; dayOfMonth: number }): string {
  const freq = p.frequency ?? 'monthly'
  if (freq === 'daily')  return 'Every day'
  if (freq === 'weekly') return `Every ${WEEKDAY_NAMES[p.dayOfMonth] ?? 'week'}`
  if (p.dayOfMonth === 31) return 'Buys on the last day of month'
  return `Buys on the ${ordinal(p.dayOfMonth)}`
}


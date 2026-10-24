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
import { ConfirmDividendModal } from '../components/forms/ConfirmDividendModal'
import { GuideTour } from '../components/guide/GuideTour'
import { usePageGuide } from '../hooks/usePageGuide'
import { useLivePrices } from '../hooks/useLivePrices'
import { isValidPrice } from '../lib/priceCache'
import { AlertIcon, CheckCircleIcon, CheckIcon, CopyIcon, DcaIcon, LightbulbIcon, PencilIcon, PlusIcon } from '../components/icons'
import { AssetLogo } from '../components/ui/AssetLogo'
import { fixedCostRecurring, inPeriod, perMonth, periodFor, periodLabel, totalsFor } from '../modules/spend/logic'
import { useSpend } from '../modules/spend/useSpend'
import {
  ASSET_META, buyDateThisPeriod, dcaThisMonth, getHoldingDpsForMonth, isBuyDayOverdue, isBuyDayToday, isConfirmedForPeriod, isDividendReceivedThisMonth, isSkippedForPeriod,
  hasRealPrice, nextBuyDate, shouldConfirmBuy, sortDcaPlans,
} from '../lib/calc'
import { generatePortfolioMarkdown } from '../lib/portfolioMarkdown'
import type { DcaPlan, Holding, SpendRecurring } from '../lib/types'
import { daysUntil, localDateStr, ordinal, thb } from '../lib/format'
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

// ─── Budget Bar ──────────────────────────────────────────────────────────────

interface BudgetSegment {
  pct: number
  amount: number
  label: string
  textColor: string
  bg: string
  barColor: string
  isStriped?: boolean
}

function BudgetBar({ salary, fixed, savings }: { salary: number; fixed: number; savings: number }) {
  if (salary <= 0) return null

  const totalAllocated = fixed + savings
  const isOverflow = totalAllocated > salary
  const cashDrawdown = isOverflow ? totalAllocated - salary : 0

  // Dual-Source Bar:
  // If isOverflow: total bar scale = totalAllocated (100% of planned deployment)
  // If not: total bar scale = salary
  const barScale = isOverflow ? totalAllocated : salary
  const salaryPct = Math.min(100, (salary / barScale) * 100)

  // Breakdowns from salary
  const fixedFromSalary = Math.min(fixed, salary)
  const savingsFromSalary = Math.max(0, Math.min(savings, salary - fixedFromSalary))
  const remainingSalary = Math.max(0, salary - fixedFromSalary - savingsFromSalary)

  // Striped pattern for cash reserve injection (high contrast in both light & dark mode)
  const cashBarColor =
    'repeating-linear-gradient(-45deg, var(--color-brand) 0px, var(--color-brand) 6px, color-mix(in srgb, var(--color-brand) 35%, white) 6px, color-mix(in srgb, var(--color-brand) 35%, white) 12px)'

  const segments: BudgetSegment[] = isOverflow
    ? [
        {
          pct: (fixed / totalAllocated) * 100,
          amount: fixed,
          label: 'Fixed',
          textColor: 'var(--color-loss)',
          bg: 'var(--color-loss-soft)',
          barColor: 'var(--color-loss)',
        },
        {
          pct: (savingsFromSalary / totalAllocated) * 100,
          amount: savingsFromSalary,
          label: 'Savings (salary)',
          textColor: 'var(--color-gain)',
          bg: 'var(--color-gain-soft)',
          barColor: 'var(--color-cash)',
        },
        {
          pct: (cashDrawdown / totalAllocated) * 100,
          amount: cashDrawdown,
          label: 'Cash',
          textColor: 'var(--color-brand-ink)',
          bg: 'var(--color-brand-soft)',
          barColor: cashBarColor,
          isStriped: true,
        },
      ].filter((s) => s.pct > 0)
    : [
        {
          pct: (fixed / salary) * 100,
          amount: fixed,
          label: 'Fixed',
          textColor: 'var(--color-loss)',
          bg: 'var(--color-loss-soft)',
          barColor: 'var(--color-loss)',
        },
        {
          pct: (savings / salary) * 100,
          amount: savings,
          label: 'Savings',
          textColor: 'var(--color-gain)',
          bg: 'var(--color-gain-soft)',
          barColor: 'var(--color-cash)',
        },
        {
          pct: (remainingSalary / salary) * 100,
          amount: remainingSalary,
          label: 'Free',
          textColor: 'var(--color-ink-faint)',
          bg: 'var(--color-surface-muted)',
          barColor: 'var(--color-ink-faint)',
        },
      ].filter((s) => s.pct > 0)

  return (
    <div className="@container mt-4">
      {/* Labels: a wrapping row when the card is narrow; once wide, each label spans its bar segment */}
      <div className="mb-2 flex flex-wrap gap-1.5 @min-[26rem]:flex-nowrap @min-[26rem]:gap-0">
        {segments.map((seg) => (
          <div
            key={seg.label}
            style={{ '--seg-w': `${seg.pct}%` } as React.CSSProperties}
            className="flex min-w-0 justify-center @min-[26rem]:w-[var(--seg-w)]"
          >
            <div
              className="rounded-xl px-2 py-1.5 text-center min-h-[46px] flex flex-col justify-center max-w-full overflow-hidden"
              style={{ background: seg.bg }}
            >
              <p className="text-xs font-semibold leading-none truncate" style={{ color: seg.textColor }}>
                {seg.label}
              </p>
              <p className="mt-1 font-display text-sm font-extrabold tnum leading-none" style={{ color: seg.textColor }}>
                {seg.isStriped ? `+${thb(seg.amount)}` : thb(seg.amount)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Bar */}
      <div className="flex h-4 overflow-hidden rounded-full bg-surface-muted gap-0.5" role="img" aria-label={`Budget allocation: ${segments.map(s => `${s.label} ${Math.round(s.pct)}%`).join(', ')}`}>
        {segments.map((seg) => (
          <div
            key={seg.label}
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${seg.pct}%`,
              background: seg.barColor,
            }}
          />
        ))}
      </div>

      {/* Salary boundary bracket (Idea 1: Monthly Salary span) */}
      {isOverflow && (
        <div className="mt-2 text-xs text-ink-muted">
          <div
            style={{ width: `${salaryPct}%` }}
            className="border-b border-l border-r border-line-strong rounded-b-md pt-1 pb-0.5 text-center transition-all duration-500"
          >
            <span className="block truncate px-1 font-semibold text-ink-soft">Monthly Salary ({thb(salary)})</span>
          </div>
        </div>
      )}

      {/* Explanatory summary note */}
      {isOverflow && (
        <div className="mt-3 rounded-xl bg-surface-muted px-3 py-2.5 text-xs text-ink-muted">
          <div className="flex items-center gap-2">
            <LightbulbIcon className="h-4 w-4 shrink-0 text-ink-muted" />
            <span className="font-semibold text-ink">Total planned: {thb(totalAllocated)}</span>
          </div>
          <div className="ml-6 mt-1 flex flex-col gap-0.5">
            <span>From salary: <span className="font-semibold text-gain">{thb(savingsFromSalary)}</span></span>
            <span>From cash reserve: <span className="font-semibold text-brand dark:text-brand-ink">+{thb(cashDrawdown)}</span></span>
          </div>
        </div>
      )}
    </div>
  )
}


// ─── Inline edit stat (salary) ────────────────────────────────────────────────

function InlineEditStat({ label, value, editing, draft, inputRef, onOpen, onDraftChange, onCommit, onCancel, hint }: {
  label: string; value: string; editing: boolean; draft: string
  inputRef: React.RefObject<HTMLInputElement>
  onOpen: () => void; onDraftChange: (v: string) => void
  onCommit: () => void; onCancel: () => void; hint?: string
}) {
  return (
    <div>
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      {editing ? (
        <div className="mt-1 flex items-center gap-1.5">
          <span className="text-sm font-semibold text-ink-muted">฿</span>
          <input
            ref={inputRef} type="number" min="0" value={draft}
            aria-label={label}
            onChange={(e) => onDraftChange(e.target.value)}
            onBlur={onCommit}
            onKeyDown={(e) => { if (e.key === 'Enter') onCommit(); if (e.key === 'Escape') onCancel() }}
            className="w-36 rounded-lg border border-brand bg-surface px-2.5 py-1 text-base font-bold tnum text-ink outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>
      ) : (
        <button
          onClick={onOpen}
          aria-label={`Edit ${label}`}
          className="group -mx-1 mt-1 flex items-center gap-1.5 rounded-lg px-1 py-1 transition-colors hover:bg-surface-muted min-h-[40px]"
        >
          <span className="font-display text-xl font-extrabold tnum text-ink leading-none">{value}</span>
          <PencilIcon className="h-3.5 w-3.5 text-ink-muted opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
      )}
      {hint && !editing && <p className="mt-0.5 text-xs text-ink-faint">{hint}</p>}
    </div>
  )
}


// ─── Fixed cost item row ──────────────────────────────────────────────────────

/** Read-only: fixed costs are edited as recurring bills in Spend. */
function FixedCostRow({ item }: { item: SpendRecurring }) {
  const monthly = perMonth(item)
  return (
    <Link
      to="/spend/recurring"
      className="flex items-center gap-3 py-2 -mx-2 px-2 rounded-lg hover:bg-surface-muted/60 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{item.name}</span>
        {item.frequency !== 'monthly' && (
          <span className="block text-xs text-ink-muted tnum">
            {thb(item.amount)} {item.frequency === 'yearly' ? 'a year' : 'a week'}
          </span>
        )}
      </div>
      <span className="font-display text-sm font-bold tnum text-ink">{thb(monthly)}</span>
    </Link>
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
          <p className="text-xs font-semibold text-ink-faint">{label}</p>
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
    upsertPlan, skipDcaBuy, unskipDcaBuy,
  } = useData()
  const { showToast } = useToast()

  // Salary edit
  const [editingSalary, setEditingSalary] = useState(false)
  const [salaryDraft, setSalaryDraft] = useState('')
  const salaryRef = useRef<HTMLInputElement>(null)

  // Section expand state — default collapsed
  const [fixedOpen, setFixedOpen] = useState(false)
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

  // Log buy form
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirming, setConfirming] = useState<DcaPlan | null>(null)

  // Dividend modal state
  const [dividendModalOpen, setDividendModalOpen] = useState(false)
  const [selectedDividendHolding, setSelectedDividendHolding] = useState<Holding | null>(null)

  // Edit plans mode (Save / Cancel / Add Plan)
  const [isEditingPlansMode, setIsEditingPlansMode] = useState(false)
  const [draftPlanAmounts, setDraftPlanAmounts] = useState<Record<string, number>>({})

  // Fixed costs live in Spend as recurring bills; weekly / yearly ones count at their monthly rate
  const fixedItems = fixedCostRecurring(data.spendRecurring ?? []).sort((a, b) => perMonth(b) - perMonth(a))
  const fixedTotal = fixedItems.reduce((s, x) => s + perMonth(x), 0)
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

  // This spending month from Spend: what actually came in and went out
  const spendPeriod = periodFor(localDateStr(), spend.settings.cycle)
  const spendMonthTxns = spend.transactions.filter((t) => inPeriod(spendPeriod, t.date))
  const spendMonth = totalsFor(spendMonthTxns)

  // Effective plans considering in-progress draft adjustments
  const rawPlans = sortDcaPlans(data.dcaPlans)
  const plans = rawPlans.map((p) => ({
    ...p,
    monthlyAmount: isEditingPlansMode && draftPlanAmounts[p.id] !== undefined
      ? draftPlanAmounts[p.id]
      : p.monthlyAmount,
  }))

  // Sum of all DCA plans' monthly amounts (total investment among DCA assets)
  const currentTotalDcaAmount = plans.reduce((s, p) => s + p.monthlyAmount, 0)
  // Overall savings total (using draft DCA total when editing)
  const savingsTotal = isEditingPlansMode ? currentTotalDcaAmount : dcaMonth.total

  // Available salary after fixed expenses
  const availableSalary = Math.max(0, salary - fixedTotal)
  // Required cash injection if planned DCA exceeds available salary
  const requiredCashInjection = Math.max(0, savingsTotal - availableSalary)

  // Enter edit mode
  const startEditingPlans = () => {
    const initialDrafts: Record<string, number> = {}
    data.dcaPlans.forEach((p) => {
      initialDrafts[p.id] = p.monthlyAmount
    })
    setDraftPlanAmounts(initialDrafts)
    setIsEditingPlansMode(true)
  }

  // Cancel edit mode
  const cancelEditingPlans = () => {
    setDraftPlanAmounts({})
    setIsEditingPlansMode(false)
  }

  // Save all draft amounts to store/logs
  const saveEditingPlans = () => {
    plans.forEach((p) => {
      if (draftPlanAmounts[p.id] !== undefined && draftPlanAmounts[p.id] !== p.monthlyAmount) {
        upsertPlan({
          ...p,
          monthlyAmount: draftPlanAmounts[p.id],
        })
      }
    })
    showToast('Saved all DCA plan adjustments successfully', 'success')
    setIsEditingPlansMode(false)
    setDraftPlanAmounts({})
  }

  // Slider change handler (adjusts THB by step of 100 in range 100 - 50,000)
  const handleSliderThb = (planId: string, newThb: number) => {
    setDraftPlanAmounts((prev) => ({
      ...prev,
      [planId]: newThb,
    }))
  }

  // Calculate sum of percentages across all DCA plans (percent relative to DCA plans total)
  const totalPercentSum = currentTotalDcaAmount > 0
    ? plans.reduce((sum, p) => sum + (p.monthlyAmount / currentTotalDcaAmount) * 100, 0)
    : 0
  const isPercentNot100 = plans.length > 0 && Math.abs(totalPercentSum - 100) > 0.5

  // Expected dividends for the current month
  const currentMonth = new Date().getMonth() + 1
  const scheduledDividends = (data.holdings ?? []).filter(
    (h) => h.paysDividend && (h.dividendMonths ?? []).includes(currentMonth),
  )
  const totalEstDividendNet = scheduledDividends.reduce((sum, h) => {
    const units = h.units ?? h.totalUnits ?? 0
    const dps = getHoldingDpsForMonth(h, currentMonth)
    return sum + (units * dps * 0.90)
  }, 0)

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

  const { usdThb, goldThbPerGram } = useLivePrices()
  const goldHolding = data.holdings?.find((h) => h.assetClass === 'gold' && isValidPrice(h.price) && hasRealPrice(h))
  const effectiveGoldThbPerGram = goldThbPerGram ?? goldHolding?.price ?? null
  const effectiveUsdThb = usdThb && usdThb > 0 ? usdThb : null
  const [copied, setCopied] = useState(false)

  const handleCopyMarkdown = async () => {
    try {
      const md = generatePortfolioMarkdown(data, effectiveUsdThb ?? usdThb, effectiveGoldThbPerGram)
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(md)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = md
        textarea.style.position = 'fixed'
        textarea.style.left = '-9999px'
        textarea.style.top = '-9999px'
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      setCopied(true)
      showToast('Portfolio copied as Markdown', 'success')
      setTimeout(() => setCopied(false), 2500)
    } catch {
      showToast('Could not copy Markdown', 'error')
    }
  }

  const openAdd = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (p: DcaPlan) => { setEditing(p); setFormOpen(true) }

  return (
    <>
      <PageHeader
        eyebrow="Plan"
        title="DCA plans"
        subtitle="Monthly salary allocation & recurring investments."
        onStartGuide={startTour}
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopyMarkdown}
            aria-label="Copy portfolio markdown"
            title="Copy portfolio as Markdown"
            className="cursor-pointer shrink-0 h-9 text-xs sm:text-sm whitespace-nowrap"
          >
            {copied ? (
              <>
                <CheckIcon className="h-4 w-4 text-gain shrink-0" strokeWidth={2.2} />
                <span className="text-gain">Copied MD!</span>
              </>
            ) : (
              <>
                <CopyIcon className="h-4 w-4 text-ink-muted shrink-0" />
                <span>Copy portfolio MD</span>
              </>
            )}
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (5 cols): Salary Budget & Fixed Costs */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6">
          {/* ── Income + Budget Bar ── */}
          <div id="guide-dca-summary">
            <Card className="animate-rise @container">
              <div className="flex flex-col items-start gap-3 @min-[19rem]:flex-row @min-[19rem]:justify-between @min-[19rem]:gap-4">
                <InlineEditStat
                  label="Monthly salary"
                  value={salary > 0 ? thb(salary) : '-'}
                  editing={editingSalary}
                  draft={salaryDraft}
                  inputRef={salaryRef}
                  onOpen={openSalaryEdit}
                  onDraftChange={setSalaryDraft}
                  onCommit={commitSalary}
                  onCancel={() => setEditingSalary(false)}
                  hint={salaryFromSpend ? 'From your recurring Salary in Spend' : salary <= 0 ? 'Tap to set your salary' : undefined}
                />
                {salary > 0 && fixedTotal + savingsTotal > salary && (
                  <div className="@min-[19rem]:text-right">
                    <p className="text-xs font-medium text-ink-muted">Total planned</p>
                    {/* Same 40px row as the salary value so both numbers share a baseline */}
                    <p className="mt-1 flex min-h-[40px] items-center font-display text-xl font-extrabold tnum text-ink leading-none @min-[19rem]:justify-end">
                      {thb(fixedTotal + savingsTotal)}
                    </p>
                    <div className="flex flex-col items-start gap-0.5 @min-[19rem]:items-end">
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-bold text-brand dark:text-brand-ink">
                        +{thb(requiredCashInjection)} from Cash
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {salary > 0 && <BudgetBar salary={salary} fixed={fixedTotal} savings={savingsTotal} />}
              {spendMonthTxns.length > 0 && (
                <Link
                  to="/spend/analysis"
                  className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-surface-muted/60 px-3 py-2.5 transition-colors hover:bg-surface-muted"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-xs text-ink-muted">Spend · {periodLabel(spendPeriod, spend.settings.cycle)}</span>
                    <span className={`block font-display text-base font-extrabold tnum ${spendMonth.net < 0 ? 'text-loss' : 'text-ink'}`}>
                      {spendMonth.net < 0 ? '−' : ''}
                      {thb(Math.abs(spendMonth.net))} left
                    </span>
                    <span className="block truncate text-xs text-ink-muted tnum">
                      In <span className="text-gain">{thb(spendMonth.income)}</span> · out {thb(spendMonth.expense)}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-brand-ink">Details →</span>
                </Link>
              )}
              {salary <= 0 && (
                <button onClick={openSalaryEdit} className="mt-4 text-sm font-semibold text-brand hover:underline cursor-pointer">
                  + Add monthly salary to see breakdown
                </button>
              )}
            </Card>
          </div>

          {/* ── Fixed Costs ── */}
          <div id="guide-dca-transfers">
            <Card className="animate-rise">
            <SectionHeader
              label="Fixed costs"
              total={fixedTotal}
              open={fixedOpen}
              onToggle={() => setFixedOpen((v) => !v)}
              action={
                fixedOpen ? (
                  <Link
                    to="/spend/recurring"
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 text-xs font-semibold text-ink shadow-2xs hover:bg-surface-muted transition-colors active:scale-95"
                  >
                    Manage in Spend
                  </Link>
                ) : null
              }
            />

            {fixedOpen && (
              <div className="mt-4">
                {fixedItems.length === 0 ? (
                  <p className="text-sm text-ink-muted">
                    No fixed costs yet. Add rent, bills or family support as{' '}
                    <Link to="/spend/recurring" className="font-semibold text-brand hover:underline">
                      recurring bills in Spend
                    </Link>
                    .
                  </p>
                ) : (
                  <div className="divide-y divide-line">
                    {fixedItems.map((item) => (
                      <FixedCostRow key={item.id} item={item} />
                    ))}
                  </div>
                )}

                {fixedItems.length > 0 && (
                  <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                    <span className="text-xs font-semibold text-ink-muted">Total fixed</span>
                    <span className="font-display text-base font-extrabold tnum text-ink">{thb(fixedTotal)}</span>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Right Column (7 cols): Savings & Invest / DCA Plans */}
      <div id="guide-dca-plans" className="lg:col-span-7 xl:col-span-8 space-y-6">
        {/* ── Savings & Invest ── */}
        <Card className={`animate-rise overflow-hidden transition-all duration-200 ${isEditingPlansMode ? 'ring-2 ring-brand/40 shadow-sm' : ''}`} padded={false}>
            <div className="p-5">
              <SectionHeader
                label="Savings & Invest"
                total={savingsTotal}
                open={savingsOpen}
                onToggle={() => setSavingsOpen((v) => !v)}
                action={
                  savingsOpen ? (
                    <div className="flex items-center gap-2">
                      {!isEditingPlansMode ? (
                        <button
                          onClick={startEditingPlans}
                          aria-label="Edit DCA plans"
                          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 text-xs font-semibold text-ink shadow-2xs hover:bg-surface-muted transition-colors active:scale-95 cursor-pointer"
                        >
                          <PencilIcon className="h-3.5 w-3.5" />
                          <span>Edit plan</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={openAdd}
                            aria-label="Add new DCA plan"
                            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 text-xs font-semibold text-ink shadow-2xs hover:bg-surface-muted transition-colors active:scale-95 cursor-pointer"
                          >
                            <PlusIcon className="h-3.5 w-3.5" strokeWidth={2.2} />
                            <span>Add plan</span>
                          </button>
                          <button
                            onClick={saveEditingPlans}
                            aria-label="Save DCA plans changes"
                            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-brand hover:bg-brand/90 text-white px-3.5 text-xs font-bold shadow-xs transition-colors active:scale-95 cursor-pointer"
                          >
                            <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.4} />
                            <span>Save</span>
                          </button>
                          <button
                            onClick={cancelEditingPlans}
                            aria-label="Cancel DCA plans changes"
                            className="inline-flex h-8 items-center px-2.5 text-xs font-semibold text-ink-muted hover:text-ink transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  ) : null
                }
              />
            </div>

            {/* Notice when sum of plan percentages does not equal 100% */}
            {savingsOpen && isPercentNot100 && (
              <div className="border-t border-line bg-warn-soft/40 px-5 py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-warn font-medium">
                  <AlertIcon className="h-4 w-4 shrink-0" />
                  <span>
                    Total planned weight is <strong>{totalPercentSum.toFixed(1)}%</strong> (difference of{' '}
                    <strong>{Math.abs(100 - totalPercentSum).toFixed(1)}%</strong> {totalPercentSum > 100 ? 'over' : 'under'} 100%).
                  </span>
                </div>
              </div>
            )}

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
                      {plans.map((p) => {
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
                          <li key={p.id}>
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                if (!isEditingPlansMode) openEdit(p)
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  if (!isEditingPlansMode) {
                                    e.preventDefault()
                                    openEdit(p)
                                  }
                                }
                              }}
                              aria-label={`Edit ${p.name}`}
                              className={`flex items-center gap-3 px-5 py-3 sm:gap-3.5 sm:py-4 transition-colors ${
                                isEditingPlansMode
                                  ? 'bg-surface hover:bg-surface'
                                  : 'cursor-pointer hover:bg-surface-muted/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'
                              }`}
                            >
                              <AssetLogo
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
                                {isEditingPlansMode && (
                                  <div className="mt-2 flex items-center" onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="range"
                                      min="100"
                                      max="50000"
                                      step="100"
                                      value={p.monthlyAmount}
                                      onChange={(e) => handleSliderThb(p.id, Number(e.target.value))}
                                      aria-label={`Adjust monthly amount for ${p.name}`}
                                      className="h-1.5 w-full appearance-none rounded-lg bg-surface-muted accent-brand cursor-pointer focus:outline-none"
                                    />
                                  </div>
                                )}
                                  <div className="mt-0.5 flex items-center justify-between gap-2 text-xs sm:mt-1">
                                    <span className="min-w-0 truncate text-ink-muted">
                                      {meta.label}
                                      <span className="sm:hidden"> · {freqLabelShort(p)}</span>
                                      <span className="hidden sm:inline"> · {freqLabel(p)}</span>
                                      <span className="tnum"> · {planPct.toFixed(1)}%</span>
                                    </span>
                                  {showConfirmed && !skipped ? (
                                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gain-soft px-2 py-0.5 text-xs font-semibold text-gain">
                                      <CheckIcon className="h-3 w-3" strokeWidth={2.4} /> Logged
                                    </span>
                                  ) : isOverdue ? (
                                    // A missed buy costs nothing, so it's a reminder, not red like an overdue bill
                                    <span className="inline-block shrink-0 text-xs font-bold text-warn">
                                      Missed {buyDateThisPeriod(p).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                    </span>
                                  ) : isToday || days <= 0 ? (
                                    <span className="inline-block shrink-0 text-xs font-bold text-warn">Today</span>
                                  ) : days < 3 ? (
                                    <span className="inline-block shrink-0 text-xs font-semibold text-warn">
                                      {days === 1 ? 'Tomorrow' : `in ${days} days`}
                                    </span>
                                  ) : (
                                    <span className="inline-block shrink-0 text-xs font-semibold text-stocks">in {days} days</span>
                                  )}
                                  </div>
                                  {needsAction && !isEditingPlansMode && (
                                    <div id="guide-dca-confirm" className="mt-1.5 flex items-center gap-2 sm:mt-2">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setConfirming(p); setConfirmOpen(true) }}
                                        aria-label={`Log DCA buy for ${p.name}`}
                                        className="inline-flex items-center gap-1.5 rounded-full bg-[#00de9b] hover:bg-[#00c58a] text-[#052e21] px-3.5 py-1.5 text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer min-h-[34px]"
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
                            </div>
                          </li>
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
                              <span className="text-gain">{Math.round((savingsTotal / salary) * 100)}%</span>
                              <span className="text-sm font-medium text-ink dark:text-white ml-1.5">
                                of Monthly Income
                              </span>
                            </>
                          ) : (
                            <span className="text-sm text-ink-muted font-normal">
                              Set monthly income above to see invest rate
                            </span>
                          )}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-xs text-ink-muted">Total DCA allocation</p>
                        <p className={`font-display text-base font-extrabold tnum mt-0.5 ${isPercentNot100 ? 'text-warn' : 'text-gain'}`}>
                          {totalPercentSum.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  )}
                </div>
            )}
          </Card>

            {/* ── Expected Dividends (Dividend Income) ── */}
            <Card className="animate-rise overflow-hidden" padded={false}>
              <div className="p-5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-ink-faint">
                      Dividend income
                    </p>
                    <span className="rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-xs font-bold">
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
                      const estNet = units * dps * 0.90
                      const isReceived = isDividendReceivedThisMonth(h.id, data.dividendRecords)
                      const sym = h.assetClass === 'stock' ? '$' : '฿'

                      return (
                        <li key={h.id} className="p-4 sm:p-5 hover:bg-surface-muted/30 transition-colors">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <AssetLogo name={h.name} assetClass={h.assetClass} size="md" />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-display font-bold text-base text-ink">{h.ticker}</span>
                                  <span className="text-xs text-ink-muted truncate max-w-[140px] sm:max-w-xs">{h.name}</span>
                                </div>
                                <p className="text-xs text-ink-muted mt-0.5">
                                  {units.toLocaleString()} shares · Est. DPS: {dps > 0 ? `${sym}${dps}` : '-'}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              {estNet > 0 && (
                                <div className="text-right hidden sm:block">
                                  <span className="font-display text-sm font-bold text-gain tnum">
                                    ~{thb(estNet)}
                                  </span>
                                  <p className="text-xs text-ink-muted">Est. Net</p>
                                </div>
                              )}

                              {isReceived ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-gain-soft px-3 py-1.5 text-xs font-semibold text-gain">
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
                                  className="inline-flex items-center gap-1.5 rounded-full bg-[#00de9b] hover:bg-[#00c58a] text-[#052e21] px-3.5 py-1.5 text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer min-h-[34px]"
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
          </div>
        </div>

        <DcaForm open={formOpen} editing={editing} onClose={() => setFormOpen(false)} />
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


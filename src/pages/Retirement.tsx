import React, { useMemo, useState, useEffect } from 'react'
import { useData } from '../store/DataContext'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { NumberField, TextField } from '../components/ui/Field'
import { dcaPerMonth, portfolioSummary } from '../lib/calc'
import { thbCompact } from '../lib/format'

const C_INVEST  = 'var(--color-crypto)'
const C_SAVINGS = 'var(--color-stocks)'
const C_TARGET  = 'var(--color-funds)'

// ── Math helpers ──────────────────────────────────────────────────────────────

function ageFromBirth(birthDate: string): number {
  const dob = new Date(birthDate)
  const now = new Date()
  let age = now.getFullYear() - dob.getFullYear()
  const m = now.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--
  return age
}

function yearsUntilAge(currentAge: number, targetAge: number): number {
  return Math.max(targetAge - currentAge, 0)
}


function compoundGrowWithAnnualIncrease(
  principal: number,
  monthly: number,
  annualRate: number,
  years: number,
  annualIncreaseRate: number,
): number[] {
  const r = annualRate / 12
  const points: number[] = []
  let val = principal
  let currentMonthly = monthly
  for (let y = 0; y <= years; y++) {
    points.push(val)
    for (let m = 0; m < 12; m++) {
      val = val * (1 + r) + currentMonthly
    }
    // annualIncreaseRate is a relative growth (e.g. 0.05 = +5% per year)
    currentMonthly *= 1 + annualIncreaseRate
  }
  return points
}



function linearGrowWithAnnualIncrease(monthly: number, years: number, annualIncreaseRate: number): number[] {
  const pts: number[] = []
  let currentMonthly = monthly
  let total = 0
  for (let y = 0; y <= years; y++) {
    pts.push(total)
    total += currentMonthly * 12
    currentMonthly *= 1 + annualIncreaseRate
  }
  return pts
}

/** Minimum annual return rate to reach target — binary search. */
function solveMinRate(pv: number, monthly: number, years: number, target: number, annualIncreaseRate: number): number | null {
  if (target <= 0 || years <= 0) return null
  if (compoundGrowWithAnnualIncrease(pv, monthly, 5.0, years, annualIncreaseRate)[years] < target) return null
  let lo = 0, hi = 5.0
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2
    if (compoundGrowWithAnnualIncrease(pv, monthly, mid, years, annualIncreaseRate)[years] < target) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

function calculateCorpusNeeded(
  monthlySpend: number,
  yearsLeft: number,
  retirementYears: number,
  inflation: number,
  annualRate: number,
  strategy: 'lump_sum' | 'drawdown'
): number {
  const futureMonthlySpend = monthlySpend * Math.pow(1 + inflation, yearsLeft)
  if (strategy === 'lump_sum') {
    return futureMonthlySpend * 12 * retirementYears
  } else {
    const r = annualRate / 12
    const g = inflation / 12          // monthly inflation during retirement
    const totalMonths = retirementYears * 12
    if (totalMonths <= 0) return 0
    // When return ≈ inflation, each discounted term equals futureMonthlySpend
    if (Math.abs(r - g) < 1e-10) return futureMonthlySpend * totalMonths
    let pv = 0
    for (let m = 0; m < totalMonths; m++) {
      // Spending grows with inflation each month; discount back at nominal return
      pv += futureMonthlySpend * Math.pow(1 + g, m) / Math.pow(1 + r, m)
    }
    return pv
  }
}

/**
 * The absolute earliest age (currentAge+1 … planUntilAge-1) at which the plan
 * becomes genuinely viable. Completely independent of the user's chosen retireAge
 * so that "Could retire at" never changes just because the slider moves.
 *
 * To filter degenerate near-death crossovers (where corpus shrinks to near-zero
 * as retirement years approach 0), we require that the candidate age leaves at
 * least max(5, ⌈totalHorizon/3⌉) years of retirement remaining.
 * This correctly returns "Never" for low-savings + return<inflation plans, while
 * still finding the genuine early-retirement age when savings are large enough.
 */
function solveEarliestViableRetireAge(
  pv: number, monthly: number, annualRate: number, inflation: number,
  currentAge: number, planUntilAge: number,
  monthlySpendToday: number,
  strategy: 'lump_sum' | 'drawdown',
  annualIncreaseRate: number,
): number | null {
  // At least 1/3 of the total plan horizon must remain as retirement (floor of 5 yrs)
  const minRetYrs = Math.max(5, Math.ceil((planUntilAge - currentAge) / 3))
  const maxAge    = planUntilAge - minRetYrs

  for (let age = currentAge + 1; age <= maxAge; age++) {
    const yrs    = age - currentAge
    const retYrs = Math.max(planUntilAge - age, 0)
    const corpus    = calculateCorpusNeeded(monthlySpendToday, yrs, retYrs, inflation, annualRate, strategy)
    const projected = compoundGrowWithAnnualIncrease(pv, monthly, annualRate, yrs, annualIncreaseRate)[yrs]
    if (projected >= corpus) return age
  }
  return null
}

/** How much MORE monthly investment closes the shortfall — binary search. */
function solveMonthlyGap(
  pv: number, currentMonthly: number, annualRate: number, years: number, target: number, annualIncreaseRate: number
): number | null {
  if (target <= 0 || years <= 0) return null
  const maxMonthly = target / Math.max(years * 12, 1)
  if (compoundGrowWithAnnualIncrease(pv, currentMonthly + maxMonthly * 10, annualRate, years, annualIncreaseRate)[years] < target) return null
  let lo = 0, hi = maxMonthly * 10
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2
    if (compoundGrowWithAnnualIncrease(pv, currentMonthly + mid, annualRate, years, annualIncreaseRate)[years] < target) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

// ── Sub-components ────────────────────────────────────────────────────────────

function HeroStat({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color?: 'gain' | 'loss' | 'neutral'
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium text-ink-muted truncate">{label}</p>
      <p className={`mt-0.5 font-display text-[15px] font-extrabold tnum leading-none truncate ${
        color === 'gain' ? 'text-gain' : color === 'loss' ? 'text-loss' : 'text-ink'
      }`}>{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-ink-faint truncate">{sub}</p>}
    </div>
  )
}

function MobileProjection({ projectedInvestment, projectedSavings, corpusNeeded, maxY }: {
  projectedInvestment: number; projectedSavings: number; corpusNeeded: number; maxY: number
}) {
  const investPct  = Math.min((projectedInvestment / maxY) * 100, 100)
  const savingsPct = Math.min((projectedSavings    / maxY) * 100, 100)
  const targetPct  = corpusNeeded > 0 ? Math.min((corpusNeeded / maxY) * 100, 100) : null
  return (
    <div className="space-y-4 py-1">
      <BarRow color={C_INVEST}  label="With returns"       value={thbCompact(projectedInvestment)} pct={investPct}  targetPct={targetPct} />
      <BarRow color={C_SAVINGS} label="Contributions only" value={thbCompact(projectedSavings)}    pct={savingsPct} targetPct={targetPct} />
      {corpusNeeded > 0 && (
        <div className="flex items-center justify-between text-[12px] pt-1 border-t border-line">
          <span className="flex items-center gap-1.5 text-ink-muted">
            <svg aria-hidden="true" width={16} height={2}><line x1={0} y1={1} x2={16} y2={1} stroke={C_TARGET} strokeWidth={1.5} strokeDasharray="3 2" /></svg>
            Target corpus
          </span>
          <span className="tnum font-semibold text-ink-soft">{thbCompact(corpusNeeded)}</span>
        </div>
      )}
    </div>
  )
}

function BarRow({ color, label, value, pct, targetPct }: {
  color: string; label: string; value: string; pct: number; targetPct: number | null
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[12px] mb-1.5">
        <span className="flex items-center gap-1.5 text-ink-muted">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: color }} />
          {label}
        </span>
        <span className="tnum font-semibold text-ink">{value}</span>
      </div>
      <div className="relative h-2 rounded-full bg-surface-muted overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color, opacity: 0.85 }} />
        {targetPct !== null && targetPct <= 100 && (
          <div className="absolute top-0 bottom-0 w-px" style={{ left: `${targetPct}%`, background: C_TARGET, opacity: 0.7 }} />
        )}
      </div>
    </div>
  )
}

function Row({ label, value, bold, highlight, hint }: {
  label: React.ReactNode; value: string; bold?: boolean
  highlight?: 'gain' | 'loss'; hint?: string
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-[13px]">
      <span className="text-ink-muted shrink-0 leading-none">{label}</span>
      <div className="text-right min-w-0">
        <span className={`tnum font-semibold ${
          highlight === 'gain' ? 'text-gain' :
          highlight === 'loss' ? 'text-loss' :
          bold ? 'font-bold text-ink' : 'text-ink-soft'
        } leading-none`}>{value}</span>
        {hint && <p className="mt-0.5 text-[11px] text-ink-faint">{hint}</p>}
      </div>
    </div>
  )
}

function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-[12px] text-ink-muted">
      <svg width={20} height={10} aria-hidden="true">
        <line x1={0} y1={5} x2={20} y2={5} stroke={color} strokeWidth={dashed ? 1.5 : 2.5} strokeDasharray={dashed ? '4 3' : undefined} />
      </svg>
      {label}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const DEFAULT_BIRTH = '1996-10-16'

export function Retirement() {
  const { data, setRetirement, syncStatus } = useData()
  const saved = data.retirement

  const [isInitialized, setIsInitialized] = useState(false)

  const [birthDate,      setBirthDate]      = useState(saved?.birthDate      ?? DEFAULT_BIRTH)
  const [monthlySpend,   setMonthlySpend]   = useState<number | ''>(saved?.monthlySpend   ?? '')
  const [retireAge,      setRetireAge]      = useState<number | ''>(saved?.retireAge      ?? 40)
  const [planUntilAge,   setPlanUntilAge]   = useState<number | ''>(saved?.deadAge        ?? 85)
  const [expectedReturn, setExpectedReturn] = useState<number | ''>((saved?.expectedReturn ?? 0.08) * 100)
  const [inflationRate,  setInflationRate]  = useState<number | ''>((saved?.inflationRate  ?? 0.03) * 100)
  const [annualSavingsGrowth, setAnnualSavingsGrowth] = useState<number | ''>((saved?.annualSavingsGrowth ?? 0) * 100)
  const [withdrawalStrategy, setWithdrawalStrategy] = useState<'lump_sum' | 'drawdown'>(saved?.withdrawalStrategy ?? 'lump_sum')
  const [mobileView,     setMobileView]     = useState<'chart' | 'bars'>('chart')

  const summary          = useMemo(() => portfolioSummary(data.holdings), [data.holdings])
  const dcaMonthly       = useMemo(() => dcaPerMonth(data.dcaPlans),      [data.dcaPlans])
  const [monthlyInvestField, setMonthlyInvestField] = useState<number | ''>(saved?.monthlyInvest ?? '')

  // Load saved settings from data/cloud once they become available
  useEffect(() => {
    if (syncStatus === 'synced' && !isInitialized) {
      if (saved) {
        if (saved.birthDate) setBirthDate(saved.birthDate)
        if (saved.monthlySpend) setMonthlySpend(saved.monthlySpend)
        if (saved.retireAge) setRetireAge(saved.retireAge)
        if (saved.deadAge) setPlanUntilAge(saved.deadAge)
        if (saved.expectedReturn !== undefined) setExpectedReturn(saved.expectedReturn * 100)
        if (saved.inflationRate !== undefined) setInflationRate(saved.inflationRate * 100)
        if (saved.annualSavingsGrowth !== undefined) setAnnualSavingsGrowth(saved.annualSavingsGrowth * 100)
        if (saved.withdrawalStrategy) setWithdrawalStrategy(saved.withdrawalStrategy)
        if (saved.monthlyInvest !== undefined) setMonthlyInvestField(saved.monthlyInvest)
      }
      setIsInitialized(true)
    }
  }, [syncStatus, saved, isInitialized])

  // Use the field value if set, otherwise fall back to live DCA total
  const investMonthly = Number(monthlyInvestField) > 0 ? Number(monthlyInvestField) : dcaMonthly
  const annualSavingsGrowthRate = (Number(annualSavingsGrowth) || 0) / 100

  // Sync field when dcaPlans change and user hasn't overridden
  useEffect(() => {
    if (isInitialized && !saved?.monthlyInvest) {
      setMonthlyInvestField(dcaMonthly > 0 ? dcaMonthly : '')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dcaMonthly, isInitialized])

  // ── Core derived values ──
  const currentAge      = ageFromBirth(birthDate)
  const inflation        = inflationRate === '' ? 0.03 : Number(inflationRate) / 100
  const annualRate       = expectedReturn === '' ? 0.08 : Number(expectedReturn) / 100
  const realReturn       = annualRate - inflation

  const plannedAge = Number(retireAge) || 40
  const plannedYearsLeft = yearsUntilAge(currentAge, plannedAge)
  const plannedRetirementYears = Math.max((Number(planUntilAge) || 85) - plannedAge, 0)
  const plannedFutureMonthlySpend = (Number(monthlySpend) || 0) * Math.pow(1 + inflation, plannedYearsLeft)
  const plannedCorpusNeeded = calculateCorpusNeeded(
    Number(monthlySpend) || 0,
    plannedYearsLeft,
    plannedRetirementYears,
    inflation,
    annualRate,
    withdrawalStrategy
  )

  // The earliest age at which the plan is viable — independent of plannedAge
  const earliestViableAge = useMemo(
    () => solveEarliestViableRetireAge(
          summary.value, investMonthly, annualRate, inflation,
          currentAge, Number(planUntilAge) || 85,
          Number(monthlySpend) || 0,
          withdrawalStrategy,
          annualSavingsGrowthRate
        ),
    [summary.value, investMonthly, annualRate, inflation, currentAge, planUntilAge, monthlySpend, withdrawalStrategy, annualSavingsGrowthRate],
  )

  const couldRetireAge = useMemo(() => {
    if (earliestViableAge !== null) {
      return {
        label: 'Could retire at',
        value: String(earliestViableAge),
        // Green if achievable on or before the planned date, red if needs to be later
        highlight: earliestViableAge <= plannedAge ? 'gain' as const : 'loss' as const,
      }
    }
    return { label: 'Could retire at', value: 'Never', highlight: 'loss' as const }
  }, [earliestViableAge, plannedAge])

  const yearsLeft = plannedYearsLeft
  const retirementYears = plannedRetirementYears
  const futureMonthlySpend = plannedFutureMonthlySpend
  const corpusNeeded = plannedCorpusNeeded

  const investLine  = useMemo(
    () => compoundGrowWithAnnualIncrease(summary.value, investMonthly, annualRate, yearsLeft, annualSavingsGrowthRate),
    [summary.value, investMonthly, annualRate, yearsLeft, annualSavingsGrowthRate]
  )
  const savingsLine = useMemo(
    () => linearGrowWithAnnualIncrease(investMonthly, yearsLeft, annualSavingsGrowthRate),
    [investMonthly, yearsLeft, annualSavingsGrowthRate]
  )

  const projectedInvestment = investLine[investLine.length - 1] ?? 0
  const projectedSavings    = savingsLine[savingsLine.length - 1] ?? 0
  const gap                 = projectedInvestment - corpusNeeded
  const onTrack             = gap >= 0

  const totalCashVal = useMemo(() => data.cashAccounts.reduce((sum, a) => sum + a.balance, 0), [data.cashAccounts])
  const currentNetWorth = summary.value + totalCashVal
  const monthlySpendVal = Number(monthlySpend) || 0
  const runwayYears = monthlySpendVal > 0 ? (currentNetWorth / (monthlySpendVal * 12)) : null

  const coastFiTarget = useMemo(() => {
    if (corpusNeeded > 0 && yearsLeft > 0 && realReturn > -1) {
      return corpusNeeded / Math.pow(1 + realReturn, yearsLeft)
    }
    return corpusNeeded
  }, [corpusNeeded, yearsLeft, realReturn])

  const milestoneList = useMemo(() => [
    {
      id: 'runway_1y',
      name: 'Foundational Runway',
      desc: '1 year of planned retirement expenses covered.',
      valueLabel: thbCompact(monthlySpendVal * 12),
      completed: monthlySpendVal > 0 && currentNetWorth >= (monthlySpendVal * 12),
      progress: monthlySpendVal > 0 ? (currentNetWorth / (monthlySpendVal * 12)) * 100 : 0,
    },
    {
      id: 'coast_fi',
      name: 'Coast FI',
      desc: 'Enough saved today to compound to your target by retirement age.',
      valueLabel: thbCompact(coastFiTarget),
      completed: corpusNeeded > 0 && currentNetWorth >= coastFiTarget,
      progress: coastFiTarget > 0 ? (currentNetWorth / coastFiTarget) * 100 : 0,
    },
    {
      id: 'lean_fi',
      name: 'Lean FI',
      desc: '75% of your target retirement corpus covered.',
      valueLabel: thbCompact(corpusNeeded * 0.75),
      completed: corpusNeeded > 0 && currentNetWorth >= (corpusNeeded * 0.75),
      progress: corpusNeeded > 0 ? (currentNetWorth / (corpusNeeded * 0.75)) * 100 : 0,
    },
    {
      id: 'fi',
      name: 'Financial Independence (FI)',
      desc: '100% of your target retirement corpus covered.',
      valueLabel: thbCompact(corpusNeeded),
      completed: corpusNeeded > 0 && currentNetWorth >= corpusNeeded,
      progress: corpusNeeded > 0 ? (currentNetWorth / corpusNeeded) * 100 : 0,
    },
  ], [monthlySpendVal, currentNetWorth, coastFiTarget, corpusNeeded])

  const minRate = useMemo(
    () => plannedCorpusNeeded > 0 && plannedYearsLeft > 0 ? solveMinRate(summary.value, investMonthly, plannedYearsLeft, plannedCorpusNeeded, annualSavingsGrowthRate) : null,
    [summary.value, investMonthly, plannedYearsLeft, plannedCorpusNeeded, annualSavingsGrowthRate],
  )
  const rateGap = minRate !== null ? annualRate - minRate : null

  const monthlyGap = useMemo(
    () => !onTrack && plannedCorpusNeeded > 0 && plannedYearsLeft > 0
      ? solveMonthlyGap(summary.value, investMonthly, annualRate, plannedYearsLeft, plannedCorpusNeeded, annualSavingsGrowthRate)
      : null,
    [onTrack, summary.value, investMonthly, annualRate, plannedYearsLeft, plannedCorpusNeeded, annualSavingsGrowthRate],
  )

  // ── Persist settings ──
  useEffect(() => {
    if (isInitialized && monthlySpend !== '' && retireAge !== '' && planUntilAge !== '') {
      setRetirement({
        monthlySpend:   Number(monthlySpend),
        retireAge:      Number(retireAge),
        deadAge:        Number(planUntilAge),
        inflationRate:  inflation,
        expectedReturn: annualRate,
        birthDate,
        monthlyInvest:  Number(monthlyInvestField) > 0 ? Number(monthlyInvestField) : undefined,
        annualSavingsGrowth: Number(annualSavingsGrowth) > 0 ? Number(annualSavingsGrowth) / 100 : undefined,
        withdrawalStrategy,
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthlySpend, retireAge, planUntilAge, inflationRate, expectedReturn, birthDate, monthlyInvestField, withdrawalStrategy, isInitialized])

  // ── SVG chart ──
  const maxY  = Math.max(corpusNeeded * 1.1, projectedInvestment * 1.05, projectedSavings * 1.05, 1)
  const chartH = 220, chartW = 560
  const padL = 60, padR = 16, padT = 16, padB = 36
  const innerW = chartW - padL - padR
  const innerH = chartH - padT - padB

  const toX = (i: number, total: number) => padL + (i / Math.max(total - 1, 1)) * innerW
  const toY = (v: number) => padT + innerH - (v / maxY) * innerH
  function makePath(pts: number[]) {
    return pts.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i, pts.length).toFixed(1)} ${toY(v).toFixed(1)}`).join(' ')
  }
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((r) => ({ v: maxY * r, y: toY(maxY * r) }))

  return (
    <>
      <PageHeader
        eyebrow="Planning"
        title="Retirement"
        subtitle={`Age ${currentAge} · ${yearsLeft} year${yearsLeft !== 1 ? 's' : ''} to retirement`}
      />

      <div className="grid grid-cols-1 gap-4 ">

        {/* ── Left: Inputs ── */}
        <Card className="animate-rise">
          <h2 className="font-display text-[17px] font-bold text-ink mb-5">Your Plan</h2>
          <div className="space-y-4">
            <TextField
              label="Date of birth"
              type="date"
              value={birthDate}
              onChange={setBirthDate}
            />
            <NumberField
              label="Monthly spend in retirement"
              prefix="฿"
              hint="In today's money"
              value={monthlySpend}
              onChange={setMonthlySpend}
              placeholder="50,000"
            />
            <div>
              <span className="text-[13px] font-semibold text-ink-soft block mb-1.5">
                Payout Strategy
              </span>
              <div className="grid grid-cols-2 gap-1 p-1 bg-surface-muted rounded-xl border border-line-strong">
                <button
                  type="button"
                  onClick={() => setWithdrawalStrategy('lump_sum')}
                  className={`py-2 px-3 rounded-lg text-[13.5px] font-semibold transition-all duration-200 cursor-pointer ${
                    withdrawalStrategy === 'lump_sum'
                      ? 'bg-surface text-ink shadow-sm'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  Lump Sum
                </button>
                <button
                  type="button"
                  onClick={() => setWithdrawalStrategy('drawdown')}
                  className={`py-2 px-3 rounded-lg text-[13.5px] font-semibold transition-all duration-200 cursor-pointer ${
                    withdrawalStrategy === 'drawdown'
                      ? 'bg-surface text-ink shadow-sm'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  Drawdown
                </button>
              </div>
              <p className="mt-1 text-[11px] text-ink-muted leading-relaxed">
                {withdrawalStrategy === 'lump_sum'
                  ? 'Withdraw full amount at retirement; no reinvestment.'
                  : 'Withdraw annual budget; keep the rest invested.'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label="Retire at age"
                value={retireAge}
                onChange={setRetireAge}
                placeholder="40"
                min={currentAge + 1}
              />
              <NumberField
                label="Plan until age"
                value={planUntilAge}
                onChange={setPlanUntilAge}
                placeholder="85"
                min={Number(retireAge) + 1}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label="Monthly investment"
                prefix="฿"
                value={monthlyInvestField}
                onChange={setMonthlyInvestField}
                placeholder={dcaMonthly > 0 ? String(dcaMonthly) : '0'}
              />
              <NumberField
                label="Savings increase/year"
                suffix="%"
                value={annualSavingsGrowth}
                onChange={setAnnualSavingsGrowth}
                placeholder="0"
                min={0}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label="Expected return"
                suffix="%"
                value={expectedReturn}
                onChange={setExpectedReturn}
                placeholder="8"
                min={0}
              />
              <NumberField
                label="Inflation"
                suffix="%"
                value={inflationRate}
                onChange={setInflationRate}
                placeholder="3"
                min={0}
              />
            </div>
          </div>

          {/* Summary: simplified per user request */}
          <div className="mt-5 rounded-2xl bg-surface-muted px-4 py-3 space-y-2">
            <Row label="Years to retirement"  value={`${yearsLeft} yr${yearsLeft !== 1 ? 's' : ''}`} />
            <Row label={couldRetireAge.label} value={couldRetireAge.value} highlight={couldRetireAge.highlight} />
            <Row label="Years in retirement"  value={`${retirementYears} yr${retirementYears !== 1 ? 's' : ''}`} />
            {Number(monthlySpend) > 0 && (
              <Row
                label="Spend at retirement"
                value={`${thbCompact(futureMonthlySpend)}/mo`}
              />
            )}
          </div>
        </Card>

        {/* ── Wealth Runway & Milestones ── */}
        <Card className="animate-rise">
          <h2 className="font-display text-[17px] font-bold text-ink mb-1">Wealth Runway & Milestones</h2>
          <p className="text-[13px] text-ink-muted mb-4">
            How long your money lasts and your progress toward financial independence.
          </p>

          {/* Runway Large display */}
          <div className="rounded-2xl bg-surface-muted px-4 py-4 mb-4 flex items-center justify-between">
            <div>
              <p className="text-[12.5px] font-medium text-ink-muted">Current Wealth Runway</p>
              <p className="mt-1 font-display text-[28px] font-extrabold tnum text-ink leading-none">
                {runwayYears !== null ? `${runwayYears.toFixed(1)} years` : '-'}
              </p>
              <p className="mt-1 text-[11px] text-ink-muted">
                {runwayYears !== null
                  ? `Covering ฿${(monthlySpendVal * 12).toLocaleString()}/yr of expenses`
                  : 'Enter monthly spend to calculate'}
              </p>
            </div>
            <div className="h-12 w-12 shrink-0 rounded-full bg-brand-soft text-brand flex items-center justify-center font-bold text-[18px]">
              ⏳
            </div>
          </div>

          {/* Milestones list */}
          <div className="space-y-3.5">
            <h3 className="text-[13.5px] font-bold text-ink">Financial Milestones</h3>
            <div className="space-y-2">
              {milestoneList.map((m) => (
                <div key={m.id} className="flex items-start gap-3 rounded-xl border border-line bg-surface p-3 transition-shadow hover:shadow-[var(--shadow-soft)]">
                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    m.completed ? 'bg-gain text-white' : 'bg-surface-muted text-ink-faint border border-line-strong'
                  }`}>
                    {m.completed ? '✓' : '•'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-semibold text-ink">{m.name}</p>
                      <span className="tnum text-[12px] font-bold text-ink-soft">{m.valueLabel}</span>
                    </div>
                    <p className="text-[11.5px] text-ink-muted mt-0.5">{m.desc}</p>
                    
                    {/* Progress bar for this milestone if not completed */}
                    {!m.completed && m.progress > 0 && (
                      <div className="mt-2 h-1.5 w-full rounded-full bg-surface-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-brand"
                          style={{ width: `${Math.min(100, m.progress)}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* ── Right: Chart ── */}
        <Card className=" animate-rise">

          {/* Hero stats row */}
          <div className="mb-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-[12px] font-medium text-ink-muted">Projected at retirement</p>
                <p className="mt-0.5 font-display text-[32px] font-extrabold tnum text-ink leading-none">
                  {thbCompact(projectedInvestment)}
                </p>
              </div>
              <div
                role="status"
                aria-live="polite"
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-bold flex items-center gap-1.5 shrink-0 ${
                  onTrack ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss'
                }`}
              >
                {onTrack ? (
                  <>
                    <svg aria-hidden="true" width={12} height={12} viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    On Track
                  </>
                ) : (
                  <>
                    <svg aria-hidden="true" width={12} height={12} viewBox="0 0 12 12" fill="none">
                      <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
                    </svg>
                    Shortfall
                  </>
                )}
              </div>
            </div>

            {/* Secondary hero stats */}
            {corpusNeeded > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-surface-muted px-3 py-3">
                <HeroStat
                  label={onTrack ? 'Surplus' : 'Shortfall'}
                  value={thbCompact(Math.abs(gap))}
                  color={onTrack ? 'gain' : 'loss'}
                />
                <HeroStat
                  label="Real return"
                  value={`${(realReturn * 100).toFixed(1)}%`}
                  sub="after inflation"
                  color={realReturn >= 0 ? 'gain' : 'loss'}
                />
                {minRate !== null ? (
                  <HeroStat
                    label="Min. return"
                    value={`${(minRate * 100).toFixed(1)}%`}
                    sub={rateGap !== null ? `${rateGap >= 0 ? '+' : ''}${(rateGap * 100).toFixed(1)}% buffer` : undefined}
                    color={rateGap !== null ? (rateGap >= 0 ? 'gain' : 'loss') : 'neutral'}
                  />
                ) : (
                  <HeroStat label="Min. return" value="Unreachable" color="loss" />
                )}
              </div>
            )}

            {/* Shortfall callout — two paths to close the gap */}
            {!onTrack && (monthlyGap !== null || (earliestViableAge !== null && earliestViableAge > plannedAge)) && (
              <div className="mt-3 rounded-2xl border border-loss/20 bg-loss-soft px-4 py-4 space-y-1">
                {/* Header */}
                <div className="flex items-center gap-2 mb-3">
                  <svg className="h-4 w-4 shrink-0 text-loss" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <path d="M8 6v3M8 11.5v.5" strokeLinecap="round" />
                    <circle cx={8} cy={8} r={6.5} />
                  </svg>
                  <p className="text-[13px] font-bold text-loss">To close the gap, pick a path:</p>
                </div>
                {/* Path items */}
                <div className="space-y-3">
                  {monthlyGap !== null && monthlyGap > 0 && (
                    <div className="flex items-start gap-3">
                      <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-loss/20 text-[10px] font-bold text-loss">1</span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-loss leading-snug">
                          Invest <span className="font-bold">{thbCompact(monthlyGap)}</span> more / month
                        </p>
                        <p className="text-[11.5px] text-loss/60 mt-0.5">Total: {thbCompact(investMonthly + monthlyGap)}/mo</p>
                      </div>
                    </div>
                  )}
                  {earliestViableAge !== null && earliestViableAge > plannedAge ? (
                    <div className="flex items-start gap-3">
                      <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-loss/20 text-[10px] font-bold text-loss">2</span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-loss leading-snug">
                          Retire at age <span className="font-bold">{earliestViableAge}</span> instead of {Number(retireAge) || 40}
                        </p>
                        <p className="text-[11.5px] text-loss/60 mt-0.5">
                          {earliestViableAge - (Number(retireAge) || 40)} more year{earliestViableAge - (Number(retireAge) || 40) !== 1 ? 's' : ''} of compounding
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-loss/10 text-[10px] font-bold text-loss/40">2</span>
                      <p className="text-[12px] text-loss/50 leading-snug">Retiring later won't close the gap within the plan horizon.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>

          {/* Mobile view toggle */}
          <div className=" flex gap-1 mb-4">
            {(['chart', 'bars'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setMobileView(v)}
                className={`px-3 py-1 rounded-full text-[12px] font-semibold transition-colors ${
                  mobileView === v ? 'bg-ink text-surface' : 'bg-surface-muted text-ink-soft'
                }`}
              >
                {v === 'chart' ? 'Line chart' : 'Bars'}
              </button>
            ))}
          </div>

          {/* Mobile bars */}
          {mobileView === 'bars' && (
            <div className=" mb-3">
              <MobileProjection
                projectedInvestment={projectedInvestment}
                projectedSavings={projectedSavings}
                corpusNeeded={corpusNeeded}
                maxY={maxY}
              />
            </div>
          )}

          {/* SVG line chart */}
          <div className={`overflow-x-auto ${mobileView === 'bars' ? 'hidden ' : ''}`}>
            <svg
              style={{ minWidth: 320 }}
              role="img"
              aria-label="Retirement growth projection chart"
              viewBox={`0 0 ${chartW} ${chartH}`}
              className="w-full"
            >
              <title>Retirement growth projection</title>
              {yTicks.map(({ v, y }) => (
                <g key={v}>
                  <line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke="var(--color-line)" strokeWidth={1} />
                  <text x={padL - 8} y={y + 4} textAnchor="end" fontSize={14} fill="var(--color-ink-muted)">
                    {thbCompact(v)}
                  </text>
                </g>
              ))}
              {investLine.map((_, i) => {
                if (i % Math.max(Math.floor(yearsLeft / 5), 1) !== 0 && i !== yearsLeft) return null
                return (
                  <text key={i} x={toX(i, investLine.length)} y={chartH - padB + 18}
                    textAnchor="middle" fontSize={15} fill="var(--color-ink-muted)">
                    {currentAge + i}
                  </text>
                )
              })}
              <line x1={toX(investLine.length - 1, investLine.length)} x2={toX(investLine.length - 1, investLine.length)}
                y1={padT} y2={chartH - padB} stroke="var(--color-line)" strokeWidth={1} strokeDasharray="4 3" opacity={0.45} />
              <text x={(padL + chartW - padR) / 2} y={chartH - 4} textAnchor="middle" fontSize={14} fill="var(--color-ink-muted">
                Age
              </text>
              {corpusNeeded > 0 && corpusNeeded <= maxY && (
                <>
                  <line x1={padL} y1={toY(corpusNeeded)} x2={chartW - padR} y2={toY(corpusNeeded)}
                    stroke={C_TARGET} strokeWidth={1.5} strokeDasharray="5 4" opacity={0.6} />
                  <text x={chartW - padR - 2} y={toY(corpusNeeded) - 4}
                    textAnchor="end" fontSize={12} fill={C_TARGET} opacity={0.8}>
                    Target {thbCompact(corpusNeeded)}
                  </text>
                </>
              )}
              <path d={makePath(savingsLine)} fill="none" stroke={C_SAVINGS} strokeWidth={2}   strokeLinejoin="round" />
              <path d={makePath(investLine)}  fill="none" stroke={C_INVEST}  strokeWidth={2.5} strokeLinejoin="round" />
              <circle cx={toX(investLine.length  - 1, investLine.length)}  cy={toY(projectedInvestment)} r={4} fill={C_INVEST}  />
              <circle cx={toX(savingsLine.length - 1, savingsLine.length)} cy={toY(projectedSavings)}    r={4} fill={C_SAVINGS} />
            </svg>
          </div>

          {/* Legend */}
          <div className={`mt-3 flex flex-wrap gap-4 ${mobileView === 'bars' ? 'hidden ' : ''}`}>
            <LegendItem color={C_INVEST}  label={`With returns (${thbCompact(projectedInvestment)} projected)`} />
            <LegendItem color={C_SAVINGS} label={`Contributions only (${thbCompact(projectedSavings)} projected)`} />
            {corpusNeeded > 0 && <LegendItem color={C_TARGET} label={`Target corpus (${thbCompact(corpusNeeded)})`} dashed />}
          </div>
        </Card>
      </div>
    </>
  )
}


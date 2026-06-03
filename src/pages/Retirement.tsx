import React, { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../store/DataContext'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { NumberField } from '../components/ui/Field'
import { portfolioSummary, dcaPerMonth } from '../lib/calc'
import { thbCompact } from '../lib/format'

// CSS var strings work in SVG stroke/fill attributes and inline style={{ background }}
// in all modern browsers (SVG 2.0). Using token vars keeps these in sync with
// the design system; if a token changes in index.css it propagates here automatically.
const C_INVEST = 'var(--color-crypto)'
const C_SAVINGS = 'var(--color-stocks)'
const C_TARGET = 'var(--color-funds)'

const DOB = new Date('1996-10-16')
const TODAY = new Date()

function ageNow(): number {
  let age = TODAY.getFullYear() - DOB.getFullYear()
  const m = TODAY.getMonth() - DOB.getMonth()
  if (m < 0 || (m === 0 && TODAY.getDate() < DOB.getDate())) age--
  return age
}

function yearsUntilAge(targetAge: number): number {
  return Math.max(targetAge - ageNow(), 0)
}

function compoundGrow(principal: number, monthly: number, annualRate: number, years: number): number[] {
  const monthlyRate = annualRate / 12
  const points: number[] = []
  let val = principal
  for (let y = 0; y <= years; y++) {
    points.push(val)
    for (let m = 0; m < 12; m++) {
      val = val * (1 + monthlyRate) + monthly
    }
  }
  return points
}

function linearGrow(monthly: number, years: number): number[] {
  const points: number[] = []
  for (let y = 0; y <= years; y++) {
    points.push(monthly * 12 * y)
  }
  return points
}

/** Binary-search for the minimum annual return rate needed to reach `target`. Returns null if unreachable even at 500%. */
function solveMinRate(pv: number, monthly: number, years: number, target: number): number | null {
  if (target <= 0 || years <= 0) return null
  if (compoundGrow(pv, monthly, 5.0, years)[years] < target) return null
  let lo = 0, hi = 5.0
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2
    if (compoundGrow(pv, monthly, mid, years)[years] < target) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

// ── Mobile bar visualization ───────────────────────────────────────────────
function MobileProjection({ projectedInvestment, projectedSavings, corpusNeeded, maxY }: {
  projectedInvestment: number
  projectedSavings: number
  corpusNeeded: number
  maxY: number
}) {
  const investPct = Math.min((projectedInvestment / maxY) * 100, 100)
  const savingsPct = Math.min((projectedSavings / maxY) * 100, 100)
  const targetPct = corpusNeeded > 0 ? Math.min((corpusNeeded / maxY) * 100, 100) : null
  return (
    <div className="space-y-4 py-1">
      <BarRow color={C_INVEST} label="With returns" value={thbCompact(projectedInvestment)} pct={investPct} targetPct={targetPct} />
      <BarRow color={C_SAVINGS} label="Contributions only" value={thbCompact(projectedSavings)} pct={savingsPct} targetPct={targetPct} />
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
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: color }} aria-hidden="true" />
          {label}
        </span>
        <span className="tnum font-semibold text-ink">{value}</span>
      </div>
      <div className="relative h-2 rounded-full bg-surface-muted overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color, opacity: 0.85 }} />
        {targetPct !== null && targetPct <= 100 && (
          <div className="absolute top-0 bottom-0 w-px" style={{ left: `${targetPct}%`, background: C_TARGET, opacity: 0.7 }} aria-hidden="true" />
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────
export function Retirement() {
  const { data, setRetirement } = useData()
  const saved = data.retirement

  const [monthlySpend, setMonthlySpend] = useState<number | ''>(saved?.monthlySpend ?? '')
  const [retireAge, setRetireAge] = useState<number | ''>(saved?.retireAge ?? 40)
  const [planUntilAge, setPlanUntilAge] = useState<number | ''>(saved?.deadAge ?? 85)
  const [mobileView, setMobileView] = useState<'chart' | 'bars'>('chart')

  const summary = useMemo(() => portfolioSummary(data.holdings), [data.holdings])
  const investMonthly = useMemo(() => dcaPerMonth(data.dcaPlans), [data.dcaPlans])

  const annualRate = useMemo(() => {
    const ret = summary.cost > 0 ? summary.pnl / summary.cost : 0.12
    return ret > 0 ? Math.min(ret, 0.5) : 0.12
  }, [summary.cost, summary.pnl])

  const currentAge = ageNow()
  const yearsLeft = yearsUntilAge(Number(retireAge) || 40)
  const retirementYears = Math.max((Number(planUntilAge) || 85) - (Number(retireAge) || 40), 0)
  const corpusNeeded = (Number(monthlySpend) || 0) * 12 * retirementYears

  const investLine = useMemo(
    () => compoundGrow(summary.value, investMonthly, annualRate, yearsLeft),
    [summary.value, investMonthly, annualRate, yearsLeft],
  )
  const savingsLine = useMemo(
    () => linearGrow(investMonthly, yearsLeft),
    [investMonthly, yearsLeft],
  )

  const projectedInvestment = investLine[investLine.length - 1] ?? 0
  const projectedSavings = savingsLine[savingsLine.length - 1] ?? 0
  const onTrack = projectedInvestment >= corpusNeeded

  const minRate = useMemo(
    () => corpusNeeded > 0 && yearsLeft > 0
      ? solveMinRate(summary.value, investMonthly, yearsLeft, corpusNeeded)
      : null,
    [summary.value, investMonthly, yearsLeft, corpusNeeded],
  )
  const rateGap = minRate !== null ? annualRate - minRate : null

  useEffect(() => {
    if (monthlySpend !== '' && retireAge !== '' && planUntilAge !== '') {
      setRetirement({
        monthlySpend: Number(monthlySpend),
        retireAge: Number(retireAge),
        deadAge: Number(planUntilAge),
      })
    }
  // setRetirement is intentionally omitted: it is defined inside useMemo([data])
  // in DataContext and gets a new identity on every data write, which would cause
  // an infinite loop. The three user-input deps are the correct trigger boundary.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthlySpend, retireAge, planUntilAge])

  const maxY = Math.max(corpusNeeded * 1.1, projectedInvestment * 1.05, projectedSavings * 1.05, 1)

  // SVG chart geometry — only used on sm+
  const chartH = 220
  const chartW = 560
  const padL = 60
  const padR = 16
  const padT = 16
  const padB = 36
  const innerW = chartW - padL - padR
  const innerH = chartH - padT - padB

  function toX(i: number, total: number) {
    return padL + (i / Math.max(total - 1, 1)) * innerW
  }
  function toY(v: number) {
    return padT + innerH - (v / maxY) * innerH
  }
  function makePath(points: number[]) {
    return points
      .map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i, points.length).toFixed(1)} ${toY(v).toFixed(1)}`)
      .join(' ')
  }

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((r) => ({ v: maxY * r, y: toY(maxY * r) }))

  const srSummary = corpusNeeded > 0
    ? `Projected portfolio at retirement: ${thbCompact(projectedInvestment)}. Target corpus: ${thbCompact(corpusNeeded)}. Status: ${onTrack ? 'On Track' : 'Shortfall'}.`
    : `Projected portfolio at retirement: ${thbCompact(projectedInvestment)}.`

  return (
    <>
      <PageHeader
        eyebrow="Planning"
        title="Retirement"
        subtitle={`Age ${currentAge} · ${yearsLeft} year${yearsLeft !== 1 ? 's' : ''} to retirement`}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Inputs */}
        <Card className="animate-rise">
          <h2 className="font-display text-[17px] font-bold text-ink mb-5 [text-wrap:balance]">Your Plan</h2>
          <div className="space-y-4">
            <NumberField
              label="Monthly spend after retirement (THB)"
              prefix="฿"
              value={monthlySpend}
              onChange={setMonthlySpend}
              placeholder="e.g. 50000"
            />
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

          <div className="mt-5 rounded-2xl bg-surface-muted px-4 py-3 space-y-1.5">
            <Row label="Years to retirement" value={`${yearsLeft} year${yearsLeft !== 1 ? 's' : ''}`} />
            <Row label="Years in retirement" value={`${retirementYears} year${retirementYears !== 1 ? 's' : ''}`} />
            <Row label="Total corpus needed" value={thbCompact(corpusNeeded)} bold />
            <Row
              label={
                <span className="flex items-center gap-1">
                  Monthly DCA
                  <Link to="/dca" className="text-brand underline text-[11px]" aria-label="Edit in DCA planner">
                    Edit
                  </Link>
                </span>
              }
              value={thbCompact(investMonthly)}
            />
            <Row label="Portfolio return" value={`${(annualRate * 100).toFixed(1)}% p.a.`} />
            {minRate !== null && (
              <Row
                label="Min. return to meet target"
                value={`${(minRate * 100).toFixed(1)}% p.a.`}
                highlight={rateGap !== null ? (rateGap >= 0 ? 'gain' : 'loss') : undefined}
              />
            )}
            {minRate === null && corpusNeeded > 0 && (
              <Row label="Min. return to meet target" value="Unreachable" highlight="loss" />
            )}
          </div>
        </Card>

        {/* Chart + status */}
        <Card className="lg:col-span-2 animate-rise">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h2 className="font-display text-[17px] font-bold text-ink [text-wrap:balance]">Growth Projection</h2>
              <p className="text-[13px] text-ink-muted mt-0.5">From today to retire age {Number(retireAge) || 40}</p>
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

          {/* Screen-reader summary (all viewports) */}
          <p className="sr-only">{srSummary}</p>

          {/* Mobile view toggle — hidden on sm+ */}
          <div className="sm:hidden flex gap-1 mb-4">
            {(['chart', 'bars'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setMobileView(v)}
                className={`px-3 py-1 rounded-full text-[12px] font-semibold transition-colors ${
                  mobileView === v
                    ? 'bg-ink text-surface'
                    : 'bg-surface-muted text-ink-soft'
                }`}
              >
                {v === 'chart' ? 'Line chart' : 'Bars'}
              </button>
            ))}
          </div>

          {/* Mobile: bar view */}
          {mobileView === 'bars' && (
            <div className="sm:hidden mb-3">
              <MobileProjection
                projectedInvestment={projectedInvestment}
                projectedSavings={projectedSavings}
                corpusNeeded={corpusNeeded}
                maxY={maxY}
              />
            </div>
          )}

          {/* SVG line chart — always on sm+, conditionally on mobile */}
          <div className={`overflow-x-auto ${mobileView === 'bars' ? 'hidden sm:block' : ''}`}>
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
                  <text x={padL - 6} y={y + 4} textAnchor="end" fontSize={11} fill="var(--color-ink-muted)">
                    {thbCompact(v)}
                  </text>
                </g>
              ))}

              {investLine.map((_, i) => {
                if (i % Math.max(Math.floor(yearsLeft / 5), 1) !== 0 && i !== yearsLeft) return null
                return (
                  <text
                    key={i}
                    x={toX(i, investLine.length)}
                    y={chartH - padB + 16}
                    textAnchor="middle"
                    fontSize={11}
                    fill="var(--color-ink-muted)"
                  >
                    {currentAge + i}
                  </text>
                )
              })}

              {corpusNeeded > 0 && corpusNeeded <= maxY && (
                <>
                  <line
                    x1={padL} y1={toY(corpusNeeded)}
                    x2={chartW - padR} y2={toY(corpusNeeded)}
                    stroke={C_TARGET} strokeWidth={1.5} strokeDasharray="5 4" opacity={0.6}
                  />
                  <text
                    x={chartW - padR - 2} y={toY(corpusNeeded) - 4}
                    textAnchor="end" fontSize={11} fill={C_TARGET} opacity={0.8}
                  >
                    Target {thbCompact(corpusNeeded)}
                  </text>
                </>
              )}

              <path d={makePath(savingsLine)} fill="none" stroke={C_SAVINGS} strokeWidth={2} strokeLinejoin="round" />
              <path d={makePath(investLine)} fill="none" stroke={C_INVEST} strokeWidth={2.5} strokeLinejoin="round" />

              <circle cx={toX(investLine.length - 1, investLine.length)} cy={toY(projectedInvestment)} r={4} fill={C_INVEST} />
              <circle cx={toX(savingsLine.length - 1, savingsLine.length)} cy={toY(projectedSavings)} r={4} fill={C_SAVINGS} />
            </svg>
          </div>

          {/* Legend — hide on mobile when showing bars (bars have inline labels) */}
          <div className={`mt-3 flex flex-wrap gap-4 ${mobileView === 'bars' ? 'hidden sm:flex' : ''}`}>
            <LegendItem color={C_INVEST} label={`With returns (${thbCompact(projectedInvestment)} projected)`} />
            <LegendItem color={C_SAVINGS} label={`Contributions only (${thbCompact(projectedSavings)} projected)`} />
            <LegendItem color={C_TARGET} label={`Target corpus (${thbCompact(corpusNeeded)})`} dashed />
          </div>

          {/* Gap summary */}
          {corpusNeeded > 0 && (
            <div className="mt-4 rounded-2xl bg-surface-muted px-4 py-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <p className="text-[12px] text-ink-muted">Projected (with returns)</p>
                <p className="font-display text-[18px] font-extrabold tnum text-ink">{thbCompact(projectedInvestment)}</p>
              </div>
              <div>
                <p className="text-[12px] text-ink-muted">{onTrack ? 'Surplus' : 'Shortfall'}</p>
                <p className={`font-display text-[18px] font-extrabold tnum ${onTrack ? 'text-gain' : 'text-loss'}`}>
                  {thbCompact(Math.abs(projectedInvestment - corpusNeeded))}
                </p>
              </div>
              {minRate !== null && (
                <div>
                  <p className="text-[12px] text-ink-muted">Min. return needed</p>
                  <p className={`font-display text-[18px] font-extrabold tnum ${rateGap !== null && rateGap >= 0 ? 'text-gain' : 'text-loss'}`}>
                    {(minRate * 100).toFixed(1)}% p.a.
                  </p>
                  <p className="text-[11px] mt-0.5 text-ink-muted">
                    Current: {(annualRate * 100).toFixed(1)}% p.a.
                    {rateGap !== null && (
                      <span className={rateGap >= 0 ? 'text-gain' : 'text-loss'}>
                        {' '}({rateGap >= 0 ? '+' : ''}{(rateGap * 100).toFixed(1)}% buffer)
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </>
  )
}

function Row({
  label, value, bold, highlight,
}: {
  label: React.ReactNode
  value: string
  bold?: boolean
  highlight?: 'gain' | 'loss'
}) {
  return (
    <div className="flex items-center justify-between text-[13px]">
      <span className="text-ink-muted">{label}</span>
      <span className={`tnum font-semibold ${
        highlight === 'gain' ? 'text-gain' :
        highlight === 'loss' ? 'text-loss' :
        bold ? 'font-bold text-ink' : 'text-ink-soft'
      }`}>{value}</span>
    </div>
  )
}

function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-[12px] text-ink-muted">
      <svg width={20} height={10} aria-hidden="true">
        <line
          x1={0} y1={5} x2={20} y2={5}
          stroke={color}
          strokeWidth={dashed ? 1.5 : 2.5}
          strokeDasharray={dashed ? '4 3' : undefined}
        />
      </svg>
      {label}
    </div>
  )
}

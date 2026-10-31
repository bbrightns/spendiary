import type { PayCycle, SpendRecurring, SpendTransaction } from './types'
import { countsInBudget, fixedCostRecurring, inPeriod, periodFor, shiftPeriod, spendOf } from '../modules/spend/logic'
import { localDateStr } from './format'

/** Day-to-day spending: what counts in Spend's budget, less the bills logged from fixed-cost recurring items */
export function livingSpend(txns: SpendTransaction[], recurring: SpendRecurring[]): number {
  const fixedIds = new Set(fixedCostRecurring(recurring).map((r) => r.id))
  let sum = 0
  for (const t of txns) {
    if (!countsInBudget(t)) continue
    if (t.recurring && fixedIds.has(t.recurring.id)) continue
    sum += spendOf(t)
  }
  return Math.max(0, sum)
}

export interface LivingAverage {
  /** Average living spend per spending month; 0 when no month has data */
  average: number
  /** How many past months the average is over (months with no transactions at all are left out) */
  months: number
}

/** Average living spend over the last `count` finished spending months */
export function livingAverage(
  txns: SpendTransaction[],
  recurring: SpendRecurring[],
  cycle?: PayCycle,
  today = localDateStr(),
  count = 3,
): LivingAverage {
  const current = periodFor(today, cycle)
  let total = 0
  let months = 0
  for (let k = 1; k <= count; k++) {
    const p = shiftPeriod(current, -k, cycle)
    const inP = txns.filter((t) => inPeriod(p, t.date))
    // A month before the user started logging would drag the average down to nothing
    if (inP.length === 0) continue
    total += livingSpend(inP, recurring)
    months++
  }
  return { average: months > 0 ? total / months : 0, months }
}

export interface MonthlyFlow {
  salary: number
  fixed: number
  living: number
  invest: number
  /** fixed + living + invest */
  out: number
  /** salary − out: left over when positive, taken from cash when negative */
  net: number
  /** Months the cash on hand covers the shortfall; null when there is no shortfall */
  runwayMonths: number | null
}

export function monthlyFlow({ salary, fixed, living, invest, cash }: {
  salary: number; fixed: number; living: number; invest: number; cash: number
}): MonthlyFlow {
  const out = fixed + living + invest
  const net = salary - out
  const runwayMonths = net < 0 ? Math.max(0, cash) / -net : null
  return { salary, fixed, living, invest, out, net, runwayMonths }
}

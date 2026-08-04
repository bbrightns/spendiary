import type { AssetClass, DcaPlan, Holding, SpendiaryData, Transfer } from './types'
import { localDateStr } from './format'

export interface HoldingMetrics extends Holding {
  marketValue: number
  costBasis: number
  pnl: number
  pnlPct: number
}

/**
 * Apply a "buy more" purchase to a holding: units grow and the average cost
 * becomes the weighted average of the old basis and the new lot. The purchase
 * price also becomes the latest filled price.
 */
export function applyBuy(
  h: Holding,
  unitsBought: number,
  pricePerUnit: number,
  on = new Date(),
): Pick<Holding, 'units' | 'avgCost' | 'price' | 'updatedAt'> {
  const newUnits = h.units + unitsBought
  const newBasis = h.units * h.avgCost + unitsBought * pricePerUnit
  return {
    units: newUnits,
    avgCost: newUnits > 0 ? newBasis / newUnits : pricePerUnit,
    price: pricePerUnit,
    updatedAt: localDateStr(on),
  }
}

export function holdingMetrics(h: Holding): HoldingMetrics {
  const marketValue = h.units * h.price
  const costBasis = h.totalThbInvested ?? (h.units * h.avgCost)
  const pnl = marketValue - costBasis
  const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0
  return { ...h, marketValue, costBasis, pnl, pnlPct }
}

export const ASSET_META: Record<
  AssetClass,
  { label: string; plural: string; color: string; cssVar: string }
> = {
  fund: { label: 'Mutual Fund', plural: 'Mutual Funds', color: '#6366f1', cssVar: 'var(--color-funds)' },
  stock: { label: 'US Stock', plural: 'US Stocks', color: '#0ea5e9', cssVar: 'var(--color-stocks)' },
  crypto: { label: 'Bitcoin', plural: 'Bitcoin', color: '#f59e0b', cssVar: 'var(--color-crypto)' },
  gold: { label: 'Gold', plural: 'Gold', color: '#ca8a04', cssVar: 'var(--color-gold)' },
  cash: { label: 'Cash', plural: 'Cash', color: '#10b981', cssVar: 'var(--color-cash)' },
}

export interface Allocation {
  assetClass: AssetClass
  value: number
  pct: number
}

export function portfolioValue(holdings: Holding[]): number {
  return holdings.reduce((sum, h) => sum + h.units * h.price, 0)
}

export function portfolioCost(holdings: Holding[]): number {
  return holdings.reduce((sum, h) => sum + (h.totalThbInvested ?? (h.units * h.avgCost)), 0)
}

export function allocations(holdings: Holding[]): Allocation[] {
  const total = portfolioValue(holdings)
  const byClass: Record<string, number> = {}
  for (const h of holdings) {
    byClass[h.assetClass] = (byClass[h.assetClass] ?? 0) + h.units * h.price
  }
  return (Object.keys(byClass) as AssetClass[])
    .map((assetClass) => ({
      assetClass,
      value: byClass[assetClass],
      pct: total > 0 ? (byClass[assetClass] / total) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value)
}

export interface PortfolioSummary {
  value: number
  cost: number
  pnl: number
  pnlPct: number
}

export function portfolioSummary(holdings: Holding[]): PortfolioSummary {
  const value = portfolioValue(holdings)
  const cost = portfolioCost(holdings)
  const pnl = value - cost
  return { value, cost, pnl, pnlPct: cost > 0 ? (pnl / cost) * 100 : 0 }
}

/* ----------------------------- DCA ----------------------------- */

/** Normalise a plan's per-period amount to a monthly equivalent for summary stats. */
export function planMonthlyEquivalent(plan: DcaPlan, now = new Date()): number {
  const freq = plan.frequency ?? 'monthly'
  if (freq === 'monthly') return plan.monthlyAmount
  if (freq === 'daily') {
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    return plan.monthlyAmount * daysInMonth
  }
  // weekly — ~4.33 weeks per month
  return plan.monthlyAmount * 4.33
}

/** Total monthly-equivalent DCA across all plans. */
export function dcaPerMonth(plans: DcaPlan[], now = new Date()): number {
  return plans.reduce((s, p) => s + planMonthlyEquivalent(p, now), 0)
}

/** How many times this plan has executed so far this calendar month. */
export function planExecutionsThisMonth(plan: DcaPlan, now = new Date()): number {
  const freq = plan.frequency ?? 'monthly'
  const today = now.getDate()

  if (freq === 'daily') return today  // once per day

  if (freq === 'weekly') {
    // dayOfMonth stores 1=Mon…7=Sun; count occurrences in month so far
    const targetDow = plan.dayOfMonth % 7  // convert to JS 0=Sun…6=Sat (7→0)
    let count = 0
    for (let d = 1; d <= today; d++) {
      const dow = new Date(now.getFullYear(), now.getMonth(), d).getDay()
      if (dow === targetDow) count++
    }
    return count
  }

  // monthly — 1 if buy day has passed
  return plan.dayOfMonth <= today ? 1 : 0
}

/** Total executions planned for the full calendar month. */
export function planTotalExecutionsInMonth(plan: DcaPlan, now = new Date()): number {
  const freq = plan.frequency ?? 'monthly'
  if (freq === 'daily') {
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  }
  if (freq === 'weekly') {
    const targetDow = plan.dayOfMonth % 7
    const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    let count = 0
    for (let d = 1; d <= days; d++) {
      if (new Date(now.getFullYear(), now.getMonth(), d).getDay() === targetDow) count++
    }
    return count
  }
  return 1
}

/** Has the user already confirmed OR skipped a buy for the current period? */
export function isConfirmedForPeriod(plan: DcaPlan, now = new Date()): boolean {
  const allDates = [...(plan.confirmedDates ?? []), ...(plan.skippedDates ?? [])]
  if (allDates.length === 0) return false
  const freq = plan.frequency ?? 'monthly'
  if (freq === 'daily') {
    const todayStr = localDateStr(now)
    return allDates.some((d) => (d.includes('T') ? d.slice(0, 10) : d) === todayStr)
  }
  if (freq === 'weekly') {
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7))
    weekStart.setHours(0, 0, 0, 0)
    return allDates.some((d) => new Date(d) >= weekStart)
  }
  // monthly
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return allDates.some((d) => (d.includes('T') ? d.slice(0, 10) : d).startsWith(ym))
}

/** Was this period explicitly skipped (not confirmed)? */
export function isSkippedForPeriod(plan: DcaPlan, now = new Date()): boolean {
  const dates = plan.skippedDates ?? []
  if (dates.length === 0) return false
  const freq = plan.frequency ?? 'monthly'
  if (freq === 'daily') {
    const todayStr = localDateStr(now)
    return dates.some((d) => (d.includes('T') ? d.slice(0, 10) : d) === todayStr)
  }
  if (freq === 'weekly') {
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7))
    weekStart.setHours(0, 0, 0, 0)
    return dates.some((d) => new Date(d) >= weekStart)
  }
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return dates.some((d) => (d.includes('T') ? d.slice(0, 10) : d).startsWith(ym))
}

/**
 * Has the current period's buy day actually arrived yet?
 * - daily:   always true
 * - weekly:  today's DOW >= target DOW within the current Mon–Sun week
 * - monthly: today's date >= dayOfMonth
 */
export function buyDayPassedThisPeriod(plan: DcaPlan, now = new Date()): boolean {
  const freq = plan.frequency ?? 'monthly'
  if (freq === 'daily') return true
  if (freq === 'weekly') {
    const targetDow = plan.dayOfMonth % 7   // 0=Sun … 6=Sat (JS convention)
    const todayDow  = now.getDay()
    // Convert both to Mon=0 scale so Mon<Tue<…<Sun
    const toMonScale = (d: number) => (d + 6) % 7
    return toMonScale(todayDow) >= toMonScale(targetDow)
  }
  return plan.dayOfMonth <= now.getDate()
}

/** Should the "Confirm buy" button be shown? Buy day passed THIS period + not yet confirmed/skipped. */
export function shouldConfirmBuy(plan: DcaPlan, now = new Date()): boolean {
  return buyDayPassedThisPeriod(plan, now) && !isConfirmedForPeriod(plan, now)
}

/** @deprecated use planExecutionsThisMonth — kept for compatibility */
export function planBoughtThisMonth(plan: DcaPlan, now = new Date()): boolean {
  return planExecutionsThisMonth(plan, now) > 0
}

/** Next date this plan will execute. */
export function nextBuyDate(plan: DcaPlan, now = new Date()): Date {
  const freq = plan.frequency ?? 'monthly'
  if (freq === 'daily') {
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow
  }
  if (freq === 'weekly') {
    const targetDow = plan.dayOfMonth % 7
    const d = new Date(now)
    d.setDate(d.getDate() + 1)
    while (d.getDay() !== targetDow) d.setDate(d.getDate() + 1)
    return d
  }
  // monthly
  const day = Math.min(Math.max(plan.dayOfMonth, 1), 28)
  const next = new Date(now.getFullYear(), now.getMonth(), day)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (next.getTime() <= today.getTime()) next.setMonth(next.getMonth() + 1)
  return next
}

export interface DcaMonth {
  total: number
  /** Amount whose buy day has already passed this month */
  invested: number
  /** Amount still scheduled to buy later this month */
  upcoming: number
  pct: number
  count: number
}

/** Date-aware view of the current month's DCA progress. */
export function dcaThisMonth(plans: DcaPlan[], now = new Date()): DcaMonth {
  let total = 0, invested = 0
  for (const p of plans) {
    const execTotal = planTotalExecutionsInMonth(p, now)
    const execDone  = planExecutionsThisMonth(p, now)
    total    += p.monthlyAmount * execTotal
    invested += p.monthlyAmount * execDone
  }
  return {
    total,
    invested,
    upcoming: Math.max(total - invested, 0),
    pct: total > 0 ? (invested / total) * 100 : 0,
    count: plans.length,
  }
}

/* --------------------------- Transfers -------------------------- */

export function remainingTransfers(t: Transfer): number {
  return Math.max(t.total - t.completed, 0)
}

export function transferProgress(t: Transfer): number {
  return t.total > 0 ? (t.completed / t.total) * 100 : 0
}

export const FREQUENCY_LABEL: Record<Transfer['frequency'], string> = {
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
}

/* ----------------------------- Cash ---------------------------- */

export function totalCash(data: SpendiaryData, usdThb?: number | null): number {
  const rate = usdThb && usdThb > 0 ? usdThb : 35
  return data.cashAccounts.reduce((sum, a) => {
    const isUsd = a.currency === 'USD'
    const thbVal = isUsd ? a.balance * rate : a.balance
    return sum + thbVal
  }, 0)
}

/* --------------------------- Net worth -------------------------- */

/** Net worth is always derived — cash on hand plus the live portfolio value. */
export function netWorth(data: SpendiaryData, usdThb?: number | null): number {
  return totalCash(data, usdThb) + portfolioValue(data.holdings)
}

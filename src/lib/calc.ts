import type { AssetClass, DcaPlan, Holding, SpendiaryData, Transfer } from './types'

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
    updatedAt: on.toISOString().slice(0, 10),
  }
}

export function holdingMetrics(h: Holding): HoldingMetrics {
  const marketValue = h.units * h.price
  const costBasis = h.units * h.avgCost
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
  return holdings.reduce((sum, h) => sum + h.units * h.avgCost, 0)
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

/** Total amount you DCA every month, across all plans. */
export function dcaPerMonth(plans: DcaPlan[]): number {
  return plans.reduce((s, p) => s + p.monthlyAmount, 0)
}

/** Has this plan's buy day already passed this calendar month? */
export function planBoughtThisMonth(plan: DcaPlan, now = new Date()): boolean {
  return plan.dayOfMonth <= now.getDate()
}

/** The next date this plan will execute, given today. */
export function nextBuyDate(plan: DcaPlan, now = new Date()): Date {
  const day = Math.min(Math.max(plan.dayOfMonth, 1), 28)
  const next = new Date(now.getFullYear(), now.getMonth(), day)
  if (next.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) {
    next.setMonth(next.getMonth() + 1)
  }
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
  const total = dcaPerMonth(plans)
  const invested = plans.reduce(
    (s, p) => s + (planBoughtThisMonth(p, now) ? p.monthlyAmount : 0),
    0,
  )
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

export function totalCash(data: SpendiaryData): number {
  return data.cashAccounts.reduce((sum, a) => sum + a.balance, 0)
}

/* --------------------------- Net worth -------------------------- */

/** Net worth is always derived — cash on hand plus the live portfolio value. */
export function netWorth(data: SpendiaryData): number {
  return totalCash(data) + portfolioValue(data.holdings)
}

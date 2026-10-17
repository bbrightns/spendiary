import type { DcaPlan, SpendiaryData } from '../lib/types'
import { importFixedCosts } from '../modules/spend/migrate'

export const emptyData: SpendiaryData = {
  cashAccounts: [],
  monthlyIncome: 0,
  holdings: [],
  dcaPlans: [],
  transfers: [],
  dividendRecords: [],
  liabilities: [],
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

type LegacyPlan = DcaPlan & { monthlyTarget?: number; contributed?: number }

/** Migrate older saved shapes into the current model. */
export function migrate(raw: SpendiaryData & { cash?: number }): SpendiaryData {
  const merged = { ...emptyData, ...raw }
  if (typeof merged.monthlyIncome !== 'number') merged.monthlyIncome = 0
  if (!Array.isArray(merged.cashAccounts)) merged.cashAccounts = []
  if (merged.rebalanceMode !== 'class' && merged.rebalanceMode !== 'holding') merged.rebalanceMode = 'class'
  if (!Array.isArray(merged.plannedAssets)) merged.plannedAssets = []
  if (typeof merged.rebalanceHoldingTargets !== 'object' || merged.rebalanceHoldingTargets === null || Array.isArray(merged.rebalanceHoldingTargets)) {
    merged.rebalanceHoldingTargets = {}
  }
  // Old single-cash field → a default account.
  if (merged.cashAccounts.length === 0 && typeof raw.cash === 'number' && raw.cash > 0) {
    merged.cashAccounts = [{ id: newId(), name: 'Cash', balance: raw.cash }]
  }
  // Old DCA plans used `monthlyTarget` + `contributed`.
  // Spread first to preserve ALL fields (frequency, holdingId, confirmedDates, skippedDates, etc.)
  merged.dcaPlans = (merged.dcaPlans ?? []).map((p) => {
    const lp = p as LegacyPlan
    return {
      ...lp,
      id: lp.id ?? newId(),
      monthlyAmount: lp.monthlyAmount ?? lp.monthlyTarget ?? 0,
      dayOfMonth: lp.dayOfMonth ?? 1,
    }
  })
  // Migrate legacy single monthlyFixedCost → fixedCostItems array
  if (!Array.isArray(merged.fixedCostItems) || merged.fixedCostItems.length === 0) {
    if (typeof merged.monthlyFixedCost === 'number' && merged.monthlyFixedCost > 0) {
      merged.fixedCostItems = [{ id: newId(), name: 'Fixed Cost', amount: merged.monthlyFixedCost }]
    } else {
      merged.fixedCostItems = []
    }
  }
  // Migrate holdings to strictly track totalThbInvested and totalUnits + fix USD stock price bugs
  merged.holdings = (merged.holdings ?? []).map((h) => {
    const units = h.units ?? h.totalUnits ?? 0
    let totalThb = h.totalThbInvested
    if (typeof totalThb !== 'number') {
      if (h.assetClass === 'crypto' && h.btcLocations && h.btcLocations.length > 0) {
        totalThb = h.btcLocations.reduce((s, l) => s + l.thbSpent, 0)
      } else if (h.assetClass === 'gold' && h.goldLocations && h.goldLocations.length > 0) {
        totalThb = h.goldLocations.reduce((s, l) => s + l.thbSpent, 0)
      } else {
        totalThb = units * (h.avgCostThb ?? h.avgCost ?? 0)
      }
    }

    let price = h.price
    // Heal US stock holding if price was saved in USD ($100-$1000) while avgCostThb is in THB (฿2000+)
    if (h.assetClass === 'stock' && typeof price === 'number' && price > 0 && price < 1000 && (h.avgCostThb ?? h.avgCost ?? 0) > 2000) {
      const estimatedFx = (h.avgCostUsd && h.avgCostUsd > 0) ? ((h.avgCostThb ?? h.avgCost) / h.avgCostUsd) : 34
      price = price * estimatedFx
    }

    return {
      ...h,
      totalUnits: units,
      units,
      totalThbInvested: totalThb,
      avgCostThb: h.avgCostThb ?? h.avgCost,
      price: typeof price === 'number' && price > 0 ? price : (h.avgCostThb ?? h.avgCost ?? 0),
    }
  })
  delete (merged as { cash?: number }).cash
  merged.liabilities = Array.isArray(merged.liabilities) ? merged.liabilities : []
  // Fixed costs moved to Spend (recurring bills); copy the old list over once
  return importFixedCosts(merged)
}

/** True when this migrate() call just moved the old fixed costs into Spend, so the result must be saved back once */
export function justImportedFixedCosts(before: Partial<SpendiaryData> | null | undefined, after: SpendiaryData): boolean {
  return !before?.spendSettings?.fixedCostsImported && !!after.spendSettings?.fixedCostsImported
}

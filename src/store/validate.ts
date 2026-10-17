import type { SpendiaryData } from '../lib/types'

export function parseCleanNumber(val: unknown, fallback = 0): number {
  if (typeof val === 'number' && !Number.isNaN(val)) return val
  if (typeof val === 'string') {
    const cleaned = val.replace(/,/g, '').trim()
    const n = parseFloat(cleaned)
    if (!Number.isNaN(n)) return n
  }
  return fallback
}

/** Strict runtime validation of an incoming JSON object as SpendiaryData. */
export function validateSpendiaryData(obj: unknown): obj is SpendiaryData {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return false
  const d = obj as Record<string, unknown>
  // Required top-level keys
  if (!Array.isArray(d.cashAccounts)) return false
  if (!Array.isArray(d.holdings)) return false
  if (!Array.isArray(d.dcaPlans)) return false
  if (!Array.isArray(d.transfers)) return false
  if (typeof d.monthlyIncome !== 'number') return false
  // Validate each holding shape
  for (const h of d.holdings as unknown[]) {
    if (typeof h !== 'object' || h === null) return false
    const hh = h as Record<string, unknown>
    if (typeof hh.id !== 'string') return false
    if (typeof hh.name !== 'string') return false
    if (typeof hh.units !== 'number') return false
    if (typeof hh.avgCost !== 'number') return false
    if (typeof hh.price !== 'number') return false
    if (!['fund', 'stock', 'crypto', 'gold', 'real_estate', 'cash'].includes(hh.assetClass as string)) return false
  }
  for (const key of ['holdingLogs', 'dividendRecords', 'netWorthHistory', 'portfolioHistory', 'fixedCostItems', 'liabilities', 'spendTransactions', 'spendCards', 'spendRecurring', 'spendGoals'] as const) {
    if (d[key] !== undefined && !Array.isArray(d[key])) return false
  }
  // Validate each DCA plan shape
  for (const p of d.dcaPlans as unknown[]) {
    if (typeof p !== 'object' || p === null) return false
    const pp = p as Record<string, unknown>
    if (typeof pp.id !== 'string') return false
    if (typeof pp.monthlyAmount !== 'number') return false
  }
  // Validate each transfer shape
  for (const t of d.transfers as unknown[]) {
    if (typeof t !== 'object' || t === null) return false
    const tt = t as Record<string, unknown>
    if (typeof tt.id !== 'string') return false
    if (typeof tt.amount !== 'number') return false
    if (typeof tt.completed !== 'number') return false
    if (typeof tt.total !== 'number') return false
  }
  // Validate each cash account
  for (const a of d.cashAccounts as unknown[]) {
    if (typeof a !== 'object' || a === null) return false
    const aa = a as Record<string, unknown>
    if (typeof aa.id !== 'string') return false
    if (typeof aa.balance !== 'number') return false
  }
  if (d.rebalanceTargets !== undefined) {
    if (typeof d.rebalanceTargets !== 'object' || d.rebalanceTargets === null || Array.isArray(d.rebalanceTargets)) return false
    const rt = d.rebalanceTargets as Record<string, unknown>
    for (const k of Object.keys(rt)) {
      if (typeof rt[k] !== 'number') return false
    }
  }
  if (d.rebalanceMode !== undefined && !['class', 'holding'].includes(d.rebalanceMode as string)) {
    return false
  }
  if (d.rebalanceHoldingTargets !== undefined) {
    if (typeof d.rebalanceHoldingTargets !== 'object' || d.rebalanceHoldingTargets === null || Array.isArray(d.rebalanceHoldingTargets)) return false
    const rht = d.rebalanceHoldingTargets as Record<string, unknown>
    for (const k of Object.keys(rht)) {
      if (typeof rht[k] !== 'number') return false
    }
  }
  if (d.plannedAssets !== undefined) {
    if (!Array.isArray(d.plannedAssets)) return false
    for (const pa of d.plannedAssets as unknown[]) {
      if (typeof pa !== 'object' || pa === null) return false
      const paa = pa as Record<string, unknown>
      if (typeof paa.id !== 'string' || typeof paa.name !== 'string' || typeof paa.ticker !== 'string') return false
      if (!['fund', 'stock', 'crypto', 'gold', 'real_estate'].includes(paa.assetClass as string)) return false
    }
  }
  if (d.liabilities !== undefined) {
    if (!Array.isArray(d.liabilities)) return false
    for (const l of d.liabilities as unknown[]) {
      if (typeof l !== 'object' || l === null) return false
      const ll = l as Record<string, unknown>
      if (typeof ll.id !== 'string' || typeof ll.name !== 'string') return false
      if (typeof ll.balance !== 'number') return false
    }
  }
  return true
}

import type { CashAccount, Holding, HoldingFigures, HoldingLog } from './types'

/**
 * A log entry's holding and cash accounts before and after it, for the trade history and Spend.
 * Older entries saved whole snapshots; newer add / buy / sell entries keep only their delta with
 * a few figures, from which a small holding is rebuilt here. Read logs through these, not the snapshot fields.
 */

function fromFigures(log: HoldingLog, f: HoldingFigures): Holding {
  const avg = f.units > 0 ? f.thb / f.units : 0
  return {
    id: log.holdingId ?? log.id,
    name: log.holdingName,
    ticker: log.ticker,
    assetClass: log.assetClass,
    units: f.units,
    totalUnits: f.units,
    totalThbInvested: f.thb,
    avgCost: avg,
    avgCostThb: avg,
    ...(f.usd !== undefined ? { totalUsdInvested: f.usd, avgCostUsd: f.units > 0 ? f.usd / f.units : 0 } : {}),
    price: f.price,
  }
}

/** The holding before and after this entry (undefined where it didn't exist or isn't known) */
export function logHoldingStates(log: HoldingLog): { prev?: Holding; curr?: Holding } {
  const d = log.delta
  return {
    prev: log.previousHoldingState ?? (d?.before ? fromFigures(log, d.before) : undefined),
    curr: log.afterHoldingState ?? (d?.after ? fromFigures(log, d.after) : undefined),
  }
}

/** The cash accounts this entry touched, before and after (only those it touched, for newer entries) */
export function logCashStates(log: HoldingLog): { prev: CashAccount[]; curr: CashAccount[] } {
  if (log.previousCashAccountsState || log.afterCashAccountsState) {
    return { prev: log.previousCashAccountsState ?? [], curr: log.afterCashAccountsState ?? [] }
  }
  const moves = (log.delta?.cash ?? []).filter((c) => c.balanceAfter !== undefined)
  const acc = (c: (typeof moves)[number], balance: number): CashAccount => ({
    id: c.accountId,
    name: c.name ?? 'Account',
    balance,
    ...(c.currency ? { currency: c.currency } : {}),
  })
  return {
    prev: moves.map((c) => acc(c, c.balanceAfter! - c.amount)),
    curr: moves.map((c) => acc(c, c.balanceAfter!)),
  }
}

/** Balance of one account in a list, if it's there */
export const balanceIn = (list: CashAccount[], id?: string) => list.find((a) => a.id === id)?.balance

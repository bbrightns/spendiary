import type { SpendiaryData, Holding, HoldingLog } from '../../lib/types'
import type { DataContextValue } from '../DataContext'
import { newId } from '../migrate'
import { upsert } from '../dataHelpers'

/**
 * Holdings and their wallet / storage locations.
 * Each action takes the current data plus the arguments useData() exposes and returns the next data.
 */
export function upsertHolding(prev: SpendiaryData, ...[holding]: Parameters<DataContextValue['upsertHolding']>): SpendiaryData {
  return { ...prev, holdings: upsert(prev.holdings, holding) }
}

export function removeHolding(prev: SpendiaryData, ...[id]: Parameters<DataContextValue['removeHolding']>): SpendiaryData {
  const target = prev.holdings.find((h) => h.id === id)
  if (target?.isLocked) return prev // Guard against deleting safe-haven locked holding
  const { [id]: _, ...restTargets } = prev.rebalanceHoldingTargets ?? {}
  return {
    ...prev,
    holdings: prev.holdings.filter((h) => h.id !== id),
    rebalanceHoldingTargets: restTargets,
  }
}

export function toggleHoldingLock(prev: SpendiaryData, ...[id]: Parameters<DataContextValue['toggleHoldingLock']>): SpendiaryData {
  return {
    ...prev,
    holdings: prev.holdings.map((h) =>
      h.id === id ? { ...h, isLocked: !h.isLocked } : h
    ),
  }
}

export function transferLocation(prev: SpendiaryData, ...[{ holdingId, fromLocationId, toLocationId, newLocationName, amount, fee = 0, timestamp }]: Parameters<DataContextValue['transferLocation']>): SpendiaryData {
  const holding = prev.holdings.find((h) => h.id === holdingId)
  if (!holding) return prev
  const isBtc = holding.assetClass === 'crypto' && (holding.btcLocations?.length ?? 0) > 0
  const isGold = holding.assetClass === 'gold' && (holding.goldLocations?.length ?? 0) > 0
  if (!isBtc && !isGold) return prev

  type Loc = { id: string; name: string; qty: number; thbSpent: number; isLocked?: boolean }
  const rawLocs: Loc[] = isBtc
    ? (holding.btcLocations ?? []).map((l) => ({ id: l.id, name: l.name, qty: l.satoshi, thbSpent: l.thbSpent, isLocked: l.isLocked }))
    : (holding.goldLocations ?? []).map((l) => ({ id: l.id, name: l.name, qty: l.grams, thbSpent: l.thbSpent, isLocked: l.isLocked }))

  const round = (n: number) => (isBtc ? Math.round(n) : parseFloat(n.toFixed(4)))
  const from = rawLocs.find((l) => l.id === fromLocationId)
  if (!from || from.isLocked) return prev

  const moveAmount = round(amount)
  const feeAmount = round(fee)
  const eps = isBtc ? 0 : 0.00005
  if (!(moveAmount > 0) || moveAmount > from.qty + eps || feeAmount < 0 || feeAmount >= moveAmount) return prev

  const received = round(moveAmount - feeAmount)
  const movesAll = moveAmount >= from.qty - eps
  // Cost basis travels with the coins; moving everything moves the exact remaining cost
  const costMoved = movesAll ? from.thbSpent : parseFloat(((from.thbSpent * moveAmount) / from.qty).toFixed(2))

  // Destination: an existing location, or a (possibly same-named) one
  const typedName = (newLocationName ?? '').trim()
  let dest: Loc | undefined = toLocationId ? rawLocs.find((l) => l.id === toLocationId) : undefined
  if (!dest && typedName) dest = rawLocs.find((l) => l.name.toLowerCase() === typedName.toLowerCase())
  if (dest && dest.id === from.id) return prev
  if (!dest && !typedName) return prev
  const destCreated = !dest
  const destId = dest ? dest.id : newId()
  const destName = dest ? dest.name : typedName

  const nextLocs: Loc[] = rawLocs.map((l) => {
    if (l.id === from.id) {
      const qty = movesAll ? 0 : round(l.qty - moveAmount)
      return { ...l, qty, thbSpent: movesAll ? 0 : parseFloat((l.thbSpent - costMoved).toFixed(2)) }
    }
    if (dest && l.id === dest.id) {
      return { ...l, qty: round(l.qty + received), thbSpent: parseFloat((l.thbSpent + costMoved).toFixed(2)) }
    }
    return l
  })
  if (destCreated) nextLocs.push({ id: destId, name: destName, qty: received, thbSpent: costMoved })

  const toBtc = (l: Loc) => ({ id: l.id, name: l.name, satoshi: l.qty, thbSpent: l.thbSpent, ...(l.isLocked ? { isLocked: true } : {}) })
  const toGold = (l: Loc) => ({ id: l.id, name: l.name, grams: l.qty, thbSpent: l.thbSpent, ...(l.isLocked ? { isLocked: true } : {}) })

  // Holding totals: the fee shrinks the coins, the money put in stays → average cost rises slightly
  const prevUnits = holding.units ?? holding.totalUnits ?? 0
  const feeUnits = isBtc ? feeAmount / 100_000_000 : feeAmount
  const newUnits = Math.max(0, prevUnits - feeUnits)
  const totalThb = holding.totalThbInvested ?? 0
  const newAvg = newUnits > 0 ? totalThb / newUnits : holding.avgCost

  const afterHolding: Holding = {
    ...holding,
    units: newUnits,
    totalUnits: newUnits,
    avgCost: newAvg,
    avgCostThb: newAvg,
    ...(isBtc ? { btcLocations: nextLocs.map(toBtc) } : { goldLocations: nextLocs.map(toGold) }),
  }

  const unitLabel = isBtc ? 'sats' : 'g'
  const fmtQty = (n: number) => (isBtc ? n.toLocaleString() : n.toFixed(4))
  const note = `Moved ${fmtQty(moveAmount)} ${unitLabel} from ${from.name} to ${destName}${
    feeAmount > 0 ? ` · network fee ${fmtQty(feeAmount)} ${unitLabel}` : ''
  }`

  const logEntry: HoldingLog = {
    id: newId(),
    timestamp: timestamp ?? new Date().toISOString(),
    action: 'transfer',
    holdingName: holding.name,
    ticker: holding.ticker,
    assetClass: holding.assetClass,
    note,
    holdingId: holding.id,
    previousHoldingState: JSON.parse(JSON.stringify(holding)),
    afterHoldingState: afterHolding,
    transfer: {
      fromLocationId: from.id,
      fromName: from.name,
      toLocationId: destId,
      toName: destName,
      destCreated,
      unit: isBtc ? 'sats' : 'grams',
      amount: moveAmount,
      fee: feeAmount,
      received,
      costMoved,
    },
  }

  return {
    ...prev,
    holdings: prev.holdings.map((h) => (h.id === holding.id ? afterHolding : h)),
    holdingLogs: [logEntry, ...(prev.holdingLogs ?? [])],
  }
}

export function toggleLocationLock(prev: SpendiaryData, ...[holdingId, locationId, isBtc]: Parameters<DataContextValue['toggleLocationLock']>): SpendiaryData {
  return {
    ...prev,
    holdings: prev.holdings.map((h) => {
      if (h.id !== holdingId) return h
      if (isBtc) {
        return {
          ...h,
          btcLocations: (h.btcLocations ?? []).map((l) =>
            l.id === locationId ? { ...l, isLocked: !l.isLocked } : l
          ),
        }
      }
      return {
        ...h,
        goldLocations: (h.goldLocations ?? []).map((l) =>
          l.id === locationId ? { ...l, isLocked: !l.isLocked } : l
        ),
      }
    }),
  }
}

export function reorderHoldings(prev: SpendiaryData, ...[ids]: Parameters<DataContextValue['reorderHoldings']>): SpendiaryData {
  return {
    ...prev,
    holdings: ids.map((id) => prev.holdings.find((h) => h.id === id)!).filter(Boolean),
  }
}

export function sellHolding(prev: SpendiaryData, ...[params]: Parameters<DataContextValue['sellHolding']>): SpendiaryData {
  const holding = prev.holdings.find((h) => h.id === params.holdingId)
  if (!holding) return prev

  const previousHoldingState = JSON.parse(JSON.stringify(holding))
  const previousCashAccountsState = prev.cashAccounts ? JSON.parse(JSON.stringify(prev.cashAccounts)) : []

  let updatedHoldings: Holding[]
  let restTargets = prev.rebalanceHoldingTargets ?? {}

  if (params.remainingHolding && params.remainingHolding.units > 0) {
    updatedHoldings = prev.holdings.map((h) =>
      h.id === params.holdingId ? params.remainingHolding! : h
    )
  } else {
    // 100% sold: remove holding
    updatedHoldings = prev.holdings.filter((h) => h.id !== params.holdingId)
    const { [params.holdingId]: _, ...cleanedTargets } = restTargets
    restTargets = cleanedTargets
  }

  let updatedCashAccounts = prev.cashAccounts ? [...prev.cashAccounts] : []
  if (params.cashAccountId && params.cashDepositAmount && params.cashDepositAmount > 0) {
    updatedCashAccounts = updatedCashAccounts.map((c) =>
      c.id === params.cashAccountId
        ? { ...c, balance: Number((c.balance + params.cashDepositAmount!).toFixed(2)) }
        : c
    )
  }

  const logEntry: HoldingLog = {
    id: newId(),
    timestamp: params.timestamp ?? new Date().toISOString(),
    action: 'sell',
    holdingId: holding.id,
    holdingName: holding.name,
    ticker: holding.ticker,
    assetClass: holding.assetClass,
    note: params.note,
    soldUnits: params.soldUnits,
    soldPrice: params.soldPrice,
    proceeds: params.proceeds,
    realizedPnL: params.realizedPnL,
    realizedPnLPercent: params.realizedPnLPercent,
    fee: params.fee,
    cashAccountId: params.cashAccountId,
    previousHoldingState,
    afterHoldingState: params.remainingHolding && params.remainingHolding.units > 0 ? params.remainingHolding : undefined,
    previousCashAccountsState: params.cashAccountId ? previousCashAccountsState : undefined,
    afterCashAccountsState: params.cashAccountId ? updatedCashAccounts : undefined,
  }

  return {
    ...prev,
    holdings: updatedHoldings,
    rebalanceHoldingTargets: restTargets,
    cashAccounts: updatedCashAccounts,
    holdingLogs: [logEntry, ...(prev.holdingLogs ?? [])],
  }
}

export function buyMoreHolding(prev: SpendiaryData, ...[params]: Parameters<DataContextValue['buyMoreHolding']>): SpendiaryData {
  const holding = prev.holdings.find((h) => h.id === params.updatedHolding.id)
  const previousHoldingState = holding ? JSON.parse(JSON.stringify(holding)) : undefined
  const previousCashAccountsState = prev.cashAccounts ? JSON.parse(JSON.stringify(prev.cashAccounts)) : []

  const updatedHoldings = prev.holdings.map((h) =>
    h.id === params.updatedHolding.id ? params.updatedHolding : h
  )

  let updatedCashAccounts = prev.cashAccounts ? [...prev.cashAccounts] : []
  if (params.cashAccountId && params.cashDeductAmount && params.cashDeductAmount > 0) {
    updatedCashAccounts = updatedCashAccounts.map((c) =>
      c.id === params.cashAccountId
        ? { ...c, balance: Number((c.balance - params.cashDeductAmount!).toFixed(2)) }
        : c
    )
  }

  const logEntry: HoldingLog = {
    id: newId(),
    timestamp: params.timestamp ?? new Date().toISOString(),
    action: 'buy_more',
    holdingId: params.updatedHolding.id,
    holdingName: params.updatedHolding.name,
    ticker: params.updatedHolding.ticker,
    assetClass: params.updatedHolding.assetClass,
    note: params.note,
    previousHoldingState,
    afterHoldingState: params.updatedHolding,
    previousCashAccountsState: params.cashAccountId ? previousCashAccountsState : undefined,
    afterCashAccountsState: params.cashAccountId ? updatedCashAccounts : undefined,
    cashAccountId: params.cashAccountId,
    source: params.source,
    receivedFrom: params.receivedFrom,
  }

  return {
    ...prev,
    holdings: updatedHoldings,
    cashAccounts: updatedCashAccounts,
    holdingLogs: [logEntry, ...(prev.holdingLogs ?? [])],
  }
}

export function upsertBtcLocation(prev: SpendiaryData, ...[holdingId, loc]: Parameters<DataContextValue['upsertBtcLocation']>): SpendiaryData {
  return {
    ...prev,
    holdings: prev.holdings.map((h) => {
      if (h.id !== holdingId) return h
      const locations = upsert(h.btcLocations ?? [], loc)
      const totalSats = locations.reduce((s, l) => s + l.satoshi, 0)
      const totalThb = locations.reduce((s, l) => s + l.thbSpent, 0)
      const units = totalSats / 100_000_000
      const avgCost = units > 0 ? totalThb / units : h.avgCost
      return { ...h, btcLocations: locations, units, totalUnits: units, avgCost, totalThbInvested: totalThb, avgCostThb: avgCost }
    }),
  }
}

export function removeBtcLocation(prev: SpendiaryData, ...[holdingId, locId]: Parameters<DataContextValue['removeBtcLocation']>): SpendiaryData {
  return {
    ...prev,
    holdings: prev.holdings.map((h) => {
      if (h.id !== holdingId) return h
      const targetLoc = (h.btcLocations ?? []).find((l) => l.id === locId)
      if (targetLoc?.isLocked) return h // Guard against deleting locked pocket
      const locations = (h.btcLocations ?? []).filter((l) => l.id !== locId)
      const totalSats = locations.reduce((s, l) => s + l.satoshi, 0)
      const totalThb = locations.reduce((s, l) => s + l.thbSpent, 0)
      const units = totalSats / 100_000_000
      const avgCost = units > 0 ? totalThb / units : h.avgCost
      return { ...h, btcLocations: locations, units, totalUnits: units, avgCost, totalThbInvested: totalThb, avgCostThb: avgCost }
    }),
  }
}

export function upsertGoldLocation(prev: SpendiaryData, ...[holdingId, loc]: Parameters<DataContextValue['upsertGoldLocation']>): SpendiaryData {
  return {
    ...prev,
    holdings: prev.holdings.map((h) => {
      if (h.id !== holdingId) return h
      const locations = upsert(h.goldLocations ?? [], loc)
      const totalGrams = locations.reduce((s, l) => s + l.grams, 0)
      const totalThb = locations.reduce((s, l) => s + l.thbSpent, 0)
      const avgCost = totalGrams > 0 ? totalThb / totalGrams : h.avgCost
      return { ...h, goldLocations: locations, units: totalGrams, totalUnits: totalGrams, avgCost, totalThbInvested: totalThb, avgCostThb: avgCost }
    }),
  }
}

export function removeGoldLocation(prev: SpendiaryData, ...[holdingId, locId]: Parameters<DataContextValue['removeGoldLocation']>): SpendiaryData {
  return {
    ...prev,
    holdings: prev.holdings.map((h) => {
      if (h.id !== holdingId) return h
      const targetLoc = (h.goldLocations ?? []).find((l) => l.id === locId)
      if (targetLoc?.isLocked) return h // Guard against deleting locked pocket
      const locations = (h.goldLocations ?? []).filter((l) => l.id !== locId)
      const totalGrams = locations.reduce((s, l) => s + l.grams, 0)
      const totalThb = locations.reduce((s, l) => s + l.thbSpent, 0)
      const avgCost = totalGrams > 0 ? totalThb / totalGrams : h.avgCost
      return { ...h, goldLocations: locations, units: totalGrams, totalUnits: totalGrams, avgCost, totalThbInvested: totalThb, avgCostThb: avgCost }
    }),
  }
}

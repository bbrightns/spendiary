import type { SpendiaryData, Holding, HoldingLog } from '../../lib/types'
import { addToLocation, findLocation, formatLocationQty, fromInputQty, hasLocations, roundQty, takeFromLocation, toInputQty, withLocations } from '../../lib/locations'
import type { DataContextValue } from '../DataContext'
import { newId } from '../migrate'
import { upsert } from '../dataHelpers'
import { roundMoney } from '../../lib/money'

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
  if (!holding || !hasLocations(holding)) return prev
  const ac = holding.assetClass
  const locs = holding.locations ?? []
  const from = locs.find((l) => l.id === fromLocationId)
  if (!from || from.isLocked) return prev

  // Amounts come in as typed (sats for BTC); the maths runs in the holding's own unit
  const moveQty = fromInputQty(ac, amount)
  const feeQty = fromInputQty(ac, fee)
  if (!(moveQty > 0) || feeQty < 0 || feeQty >= moveQty) return prev

  // Destination: an existing location, or a (possibly same-named) one
  const typedName = (newLocationName ?? '').trim()
  let dest = toLocationId ? locs.find((l) => l.id === toLocationId) : undefined
  if (!dest && typedName) dest = findLocation(locs, { name: typedName })
  if (dest && dest.id === from.id) return prev
  if (!dest && !typedName) return prev

  // Cost basis travels with the coins; moving everything moves the exact remaining cost
  const taken = takeFromLocation(ac, locs, from.id, moveQty)
  if (!taken) return prev
  const receivedQty = roundQty(ac, moveQty - feeQty)
  const hasUsd = from.usdSpent !== undefined
  const added = addToLocation(ac, taken.locations, dest ? { id: dest.id, name: dest.name } : { name: typedName }, receivedQty, taken.costThb, hasUsd ? taken.costUsd : undefined)
  const destCreated = !dest
  const destName = dest ? dest.name : typedName

  // Holding totals: the fee shrinks the units, the money put in stays → average cost rises slightly
  const afterHolding = withLocations(holding, added.locations)

  const unit = ac === 'crypto' ? 'sats' : ac === 'gold' ? 'grams' : 'shares'
  const fmt = (q: number) => formatLocationQty(ac, q)
  const note = `Moved ${fmt(moveQty)} from ${from.name} to ${destName}${feeQty > 0 ? ` · ${ac === 'crypto' ? 'network ' : ''}fee ${fmt(feeQty)}` : ''}`

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
      toLocationId: added.locationId,
      toName: destName,
      destCreated,
      unit,
      amount: toInputQty(ac, moveQty),
      fee: toInputQty(ac, feeQty),
      received: toInputQty(ac, receivedQty),
      costMoved: taken.costThb,
      ...(hasUsd ? { costMovedUsd: taken.costUsd } : {}),
    },
  }

  return {
    ...prev,
    holdings: prev.holdings.map((h) => (h.id === holding.id ? afterHolding : h)),
    holdingLogs: [logEntry, ...(prev.holdingLogs ?? [])],
  }
}

export function toggleLocationLock(prev: SpendiaryData, ...[holdingId, locationId]: Parameters<DataContextValue['toggleLocationLock']>): SpendiaryData {
  return {
    ...prev,
    holdings: prev.holdings.map((h) =>
      h.id !== holdingId
        ? h
        : { ...h, locations: (h.locations ?? []).map((l) => (l.id === locationId ? { ...l, isLocked: !l.isLocked } : l)) },
    ),
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
        ? { ...c, balance: roundMoney(c.balance + params.cashDepositAmount!) }
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
        ? { ...c, balance: roundMoney(c.balance - params.cashDeductAmount!) }
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

/** Adds or edits one location; the holding's units and cost follow from all its locations */
export function upsertLocation(prev: SpendiaryData, ...[holdingId, loc]: Parameters<DataContextValue['upsertLocation']>): SpendiaryData {
  return {
    ...prev,
    holdings: prev.holdings.map((h) => {
      if (h.id !== holdingId) return h
      const clean = { ...loc, qty: roundQty(h.assetClass, loc.qty), thbSpent: roundMoney(loc.thbSpent) }
      return withLocations(h, upsert(h.locations ?? [], clean))
    }),
  }
}

export function removeLocation(prev: SpendiaryData, ...[holdingId, locId]: Parameters<DataContextValue['removeLocation']>): SpendiaryData {
  return {
    ...prev,
    holdings: prev.holdings.map((h) => {
      if (h.id !== holdingId) return h
      const target = (h.locations ?? []).find((l) => l.id === locId)
      if (!target || target.isLocked) return h // Guard against deleting a locked pocket
      return withLocations(h, (h.locations ?? []).filter((l) => l.id !== locId))
    }),
  }
}

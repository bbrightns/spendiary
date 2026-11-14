import type { Holding, HoldingLog, SpendiaryData } from '../../lib/types'
import { buyInto, findLocation } from '../../lib/locations'
import type { DataContextValue } from '../DataContext'
import { newId } from '../migrate'
import { payFromAccount, upsert } from '../dataHelpers'
import { findMatchingHolding, SATS_PER_BTC } from '../../lib/calc'
import { roundMoney } from '../../lib/money'
import { undoHoldingLog } from './holdingLogs'
import { holdingDelta, withAccountDetails } from './undoDelta'

/**
 * DCA plans and confirming or skipping their buys.
 * Each action takes the current data plus the arguments useData() exposes and returns the next data.
 */
export function upsertPlan(prev: SpendiaryData, ...[plan]: Parameters<DataContextValue['upsertPlan']>): SpendiaryData {
  const isEdit = plan.id && prev.dcaPlans.some((p) => p.id === plan.id)
  const updatedPlans = upsert(prev.dcaPlans, plan)
  const savedPlan = updatedPlans.find((p) => p.id === plan.id) || updatedPlans[updatedPlans.length - 1]

  const logEntry: import('../../lib/types').HoldingLog = {
    id: newId(),
    timestamp: new Date().toISOString(),
    action: isEdit ? 'edit' : 'add',
    holdingName: `DCA Plan: ${savedPlan.name}`,
    ticker: 'DCA',
    assetClass: savedPlan.assetClass,
    note: `${isEdit ? 'Updated' : 'Created'} DCA plan of ฿${savedPlan.monthlyAmount.toLocaleString()}/month`,
  }

  return {
    ...prev,
    dcaPlans: updatedPlans,
    holdingLogs: [logEntry, ...(prev.holdingLogs ?? [])],
  }
}

export function removePlan(prev: SpendiaryData, ...[id]: Parameters<DataContextValue['removePlan']>): SpendiaryData {
  const plan = prev.dcaPlans.find((p) => p.id === id)
  if (!plan) return prev
  const updatedPlans = prev.dcaPlans.filter((p) => p.id !== id)

  const logEntry: import('../../lib/types').HoldingLog = {
    id: newId(),
    timestamp: new Date().toISOString(),
    action: 'edit',
    holdingName: `DCA Plan: ${plan.name}`,
    ticker: 'DCA',
    assetClass: plan.assetClass,
    note: `Deleted DCA plan of ฿${plan.monthlyAmount.toLocaleString()}/month`,
  }

  return {
    ...prev,
    dcaPlans: updatedPlans,
    holdingLogs: [logEntry, ...(prev.holdingLogs ?? [])],
  }
}

export function skipDcaBuy(prev: SpendiaryData, ...[planId, date]: Parameters<DataContextValue['skipDcaBuy']>): SpendiaryData {
  const plan = prev.dcaPlans.find((p) => p.id === planId)
  if (!plan) return prev

  const updatedPlans = prev.dcaPlans.map((p) =>
    p.id !== planId ? p : {
      ...p,
      skippedDates: [date, ...(p.skippedDates ?? [])],
    }
  )

  const logEntry: import('../../lib/types').HoldingLog = {
    id: newId(),
    timestamp: new Date().toISOString(),
    action: 'edit',
    holdingName: `DCA Plan: ${plan.name}`,
    ticker: 'DCA',
    assetClass: plan.assetClass,
    note: `Skipped DCA buy of ฿${plan.monthlyAmount.toLocaleString()} for this period`,
    dcaPlanId: plan.id,
    dcaDate: date,
  }

  return {
    ...prev,
    dcaPlans: updatedPlans,
    holdingLogs: [logEntry, ...(prev.holdingLogs ?? [])],
  }
}

export function unskipDcaBuy(prev: SpendiaryData, ...[planId, date]: Parameters<DataContextValue['unskipDcaBuy']>): SpendiaryData {
  const plan = prev.dcaPlans.find((p) => p.id === planId)
  if (!plan || !(plan.skippedDates ?? []).includes(date)) return prev
  return {
    ...prev,
    dcaPlans: prev.dcaPlans.map((p) =>
      p.id !== planId ? p : { ...p, skippedDates: (p.skippedDates ?? []).filter((d) => d !== date) },
    ),
    // The skip's own entry: a skip changes no holding, so it has no state to restore
    holdingLogs: (prev.holdingLogs ?? []).filter(
      (l) => !(l.dcaPlanId === planId && l.dcaDate === date && l.ticker === 'DCA' && l.note?.startsWith('Skipped')),
    ),
  }
}

export function undoDcaBuy(prev: SpendiaryData, ...[planId, date]: Parameters<DataContextValue['undoDcaBuy']>): SpendiaryData {
  // Newest first, so this is the buy just logged; a skip is undone with unskipDcaBuy instead
  const log = (prev.holdingLogs ?? []).find(
    (l) => l.dcaPlanId === planId && l.dcaDate === date && (l.action === 'buy_more' || l.action === 'add'),
  )
  return log ? undoHoldingLog(prev, log.id) : prev
}

export function confirmDcaBuy(
  prev: SpendiaryData,
  ...[
    planId, pricePerUnit, date, overrideUnits, overrideAvgCost, overridePrice, location,
    stockUpdate, fundUpdate, targetHoldingId, btcUpdate, goldUpdate, payment,
  ]: Parameters<DataContextValue['confirmDcaBuy']>
): SpendiaryData {
  const plan = prev.dcaPlans.find((p) => p.id === planId)
  if (!plan) return prev

  // Paid from a cash account: its balance goes down, and the log keeps both
  // snapshots so Undo gives the money back
  const paid = payment && payment.amount > 0 && (prev.cashAccounts ?? []).some((a) => a.id === payment.accountId) ? payment : undefined
  // The log keeps only which account paid and how much; its delta says how to give it back
  const paidLog = paid ? { paidFromAccountId: paid.accountId, paidAmount: paid.amount } : {}
  const paidCash = paid ? [{ accountId: paid.accountId, amount: -paid.amount }] : []
  const paidAccounts = paid ? { cashAccounts: payFromAccount(prev.cashAccounts ?? [], paid) } : {}

  // If this is a Cash Account DCA plan, deposit directly into cash account balance
  if (plan.assetClass === 'cash' || plan.cashAccountId) {
    const oldAccounts = prev.cashAccounts ?? []
    const depositAmount =
      (fundUpdate as { amountSpentThb?: number } | undefined)?.amountSpentThb ||
      (stockUpdate as { amountSpentThb?: number } | undefined)?.amountSpentThb ||
      (pricePerUnit > 0 ? pricePerUnit : plan.monthlyAmount)
    const targetAcc = plan.cashAccountId
      ? oldAccounts.find((a) => a.id === plan.cashAccountId)
      : oldAccounts.find((a) => a.name.toLowerCase() === plan.name.toLowerCase())

    const updatedCashAccounts = payFromAccount(
      targetAcc
        ? oldAccounts.map((a) =>
            a.id === targetAcc.id ? { ...a, balance: roundMoney(a.balance + depositAmount) } : a,
          )
        : oldAccounts,
      paid,
    )

    const updatedPlans = prev.dcaPlans.map((p) =>
      p.id !== planId
        ? p
        : {
            ...p,
            cashAccountId: targetAcc ? targetAcc.id : p.cashAccountId,
            confirmedDates: [date, ...(p.confirmedDates ?? [])],
          },
    )

    const logEntry: HoldingLog = {
      id: newId(),
      timestamp: new Date().toISOString(),
      action: 'buy_more',
      holdingName: targetAcc ? targetAcc.name : plan.name,
      ticker: 'CASH',
      assetClass: 'cash',
      note: `Deposited ฿${depositAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} via DCA into ${targetAcc ? targetAcc.name : plan.name}`,
      dcaPlanId: plan.id,
      dcaDate: date,
      ...paidLog,
      // Exactly what moved, for undo and the trade history: the deposit in, and the payment out
      delta: {
        units: 0,
        thb: 0,
        cash: withAccountDetails([
          ...(targetAcc ? [{ accountId: targetAcc.id, amount: depositAmount }] : []),
          ...paidCash,
        ], updatedCashAccounts),
      },
    }

    return {
      ...prev,
      cashAccounts: updatedCashAccounts,
      dcaPlans: updatedPlans,
      holdingLogs: [logEntry, ...(prev.holdingLogs ?? [])],
    }
  }

  // Check if holding already existed before this transaction (via targetHoldingId or findMatchingHolding)
  const existingHolding = targetHoldingId
    ? prev.holdings.find((h) => h.id === targetHoldingId)
    : findMatchingHolding(prev.holdings, plan)

  const isNewHolding = !existingHolding
  let holding = existingHolding
  let holdingsList = prev.holdings

  // Auto-create holding if needed when location or buy detail is provided
  if (!holding && (stockUpdate || fundUpdate || btcUpdate || goldUpdate || (pricePerUnit > 0 && (plan.assetClass === 'gold' || plan.assetClass === 'crypto' || plan.assetClass === 'stock' || plan.assetClass === 'fund')))) {
    const createdHolding: Holding = {
      id: newId(),
      name: plan.name,
      ticker: plan.ticker || plan.name.toUpperCase().slice(0, 6),
      assetClass: plan.assetClass,
      units: 0,
      totalUnits: 0,
      totalThbInvested: 0,
      totalUsdInvested: 0,
      avgCostUsd: 0,
      avgCostThb: 0,
      avgCost: pricePerUnit,
      price: pricePerUnit,
      updatedAt: date,
    }
    holding = createdHolding
    holdingsList = [...prev.holdings, createdHolding]
  }

  // Mark date as confirmed on the plan + link holdingId to prevent future binding bugs
  const updatedPlans = prev.dcaPlans.map((p) =>
    p.id !== planId
      ? p
      : {
          ...p,
          holdingId: holding ? holding.id : p.holdingId,
          confirmedDates: [date, ...(p.confirmedDates ?? [])],
        },
  )

  if (!holding) {
    // Log simple plan confirmation (no holding update)
    const logEntry: HoldingLog = {
      id: newId(),
      timestamp: new Date().toISOString(),
      action: 'buy_more',
      holdingName: `DCA Plan: ${plan.name}`,
      ticker: 'DCA',
      assetClass: plan.assetClass,
      note: `Confirmed DCA buy of ฿${plan.monthlyAmount.toLocaleString()} (No linked holding)`,
      dcaPlanId: plan.id,
      dcaDate: date,
      ...paidLog,
      delta: { units: 0, thb: 0, ...(paid ? { cash: withAccountDetails(paidCash, payFromAccount(prev.cashAccounts ?? [], paid)) } : {}) },
    }
    return {
      ...prev,
      ...paidAccounts,
      dcaPlans: updatedPlans,
      holdingLogs: [logEntry, ...(prev.holdingLogs ?? [])],
    }
  }

  // Capture previous state (for undo) BEFORE applying updates (if holding existed)
  const previousHoldingState = !isNewHolding ? JSON.parse(JSON.stringify(holding)) : undefined

  let calculatedUnits = pricePerUnit > 0 ? plan.monthlyAmount / pricePerUnit : 0
  if (!isFinite(calculatedUnits) || isNaN(calculatedUnits)) calculatedUnits = 0

  let newUnits = overrideUnits !== undefined ? overrideUnits : holding.units + calculatedUnits
  let newAvgCost =
    overrideAvgCost !== undefined
      ? overrideAvgCost
      : newUnits > 0
      ? (holding.units * holding.avgCost + calculatedUnits * pricePerUnit) / newUnits
      : holding.avgCost
  if (!isFinite(newAvgCost) || isNaN(newAvgCost)) newAvgCost = holding.avgCost
  const finalPrice = overridePrice !== undefined ? overridePrice : pricePerUnit

  let updatedFields: Partial<Holding> = {}
  let logNote = ''

  if (stockUpdate) {
    const { unitsBought, amountSpentThb, fxRate } = stockUpdate
    const usdSpentThisTx = fxRate > 0 ? amountSpentThb / fxRate : 0
    const pricePerShareUsd = unitsBought > 0 ? usdSpentThisTx / unitsBought : 0
    const pricePerShareThb = pricePerShareUsd > 0 ? pricePerShareUsd * fxRate : holding.price

    const currentUnits = holding.units ?? holding.totalUnits ?? 0
    const currentThbInvested = holding.totalThbInvested ?? currentUnits * (holding.avgCostThb ?? holding.avgCost ?? 0)
    const currentUsdInvested = holding.totalUsdInvested ?? currentUnits * (holding.avgCostUsd ?? (fxRate > 0 ? (holding.avgCost ?? 0) / fxRate : 0))

    // Totals before this buy, with the USD cost filled in for holdings saved without it
    const base: Holding = { ...holding, units: currentUnits, totalThbInvested: currentThbInvested, totalUsdInvested: currentUsdInvested }
    const bought = buyInto(base, location, unitsBought, amountSpentThb, usdSpentThisTx).holding

    newUnits = bought.units
    newAvgCost = bought.avgCost
    calculatedUnits = unitsBought

    updatedFields = {
      units: bought.units,
      totalUnits: bought.units,
      totalThbInvested: bought.totalThbInvested,
      totalUsdInvested: bought.totalUsdInvested,
      avgCostUsd: bought.avgCostUsd,
      avgCostThb: bought.avgCostThb,
      avgCost: bought.avgCost,
      price: pricePerShareThb > 0 ? pricePerShareThb : holding.price,
      ...(bought.locations ? { locations: bought.locations } : {}),
    }

    const brokerName = bought.locations ? findLocation(bought.locations, location ?? {})?.name : undefined
    logNote = `DCA Buy: ${unitsBought} shares @ $${pricePerShareUsd.toFixed(2)}/share (+฿${amountSpentThb.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})${brokerName ? ` · ${brokerName}` : ''}`
  } else if (fundUpdate) {
    const { unitsBought, amountSpentThb, nav } = fundUpdate
    const currentUnits = holding.units ?? holding.totalUnits ?? 0
    const currentThbInvested = holding.totalThbInvested ?? (currentUnits * (holding.avgCostThb ?? holding.avgCost ?? 0))

    const newTotalUnits = currentUnits + unitsBought
    const newTotalThbInvested = roundMoney(currentThbInvested + amountSpentThb)
    const newAvgCostThb = newTotalUnits > 0 ? newTotalThbInvested / newTotalUnits : (holding.avgCostThb ?? holding.avgCost ?? 0)

    newUnits = newTotalUnits
    newAvgCost = newAvgCostThb
    calculatedUnits = unitsBought

    updatedFields = {
      units: newTotalUnits,
      totalUnits: newTotalUnits,
      totalThbInvested: newTotalThbInvested,
      avgCostThb: newAvgCostThb,
      avgCost: newAvgCostThb,
      price: nav > 0 ? nav : (holding.price > 0 ? holding.price : newAvgCostThb),
    }

    logNote = `DCA Buy: ${unitsBought} units @ ฿${nav.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}/unit (+฿${amountSpentThb.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
  } else if (holding.assetClass === 'crypto' && btcUpdate && btcUpdate.satsBought > 0) {
    const { satsBought, amountSpentThb: amountSpent } = btcUpdate
    const bought = buyInto(holding, location, satsBought / SATS_PER_BTC, amountSpent)
    newUnits = bought.holding.units
    newAvgCost = bought.holding.avgCost
    calculatedUnits = satsBought / SATS_PER_BTC

    const impliedBtcPrice = (amountSpent / satsBought) * SATS_PER_BTC

    updatedFields = {
      totalThbInvested: bought.holding.totalThbInvested,
      totalUnits: newUnits,
      units: newUnits,
      avgCostThb: newAvgCost,
      avgCost: newAvgCost,
      price: impliedBtcPrice > 0 ? impliedBtcPrice : holding.price,
      ...(bought.holding.locations ? { locations: bought.holding.locations } : {}),
    }

    const btcLocName = bought.locationId ? bought.holding.locations?.find((l) => l.id === bought.locationId)?.name : undefined
    logNote = `DCA Buy: ${satsBought.toLocaleString()} sats @ ฿${Math.round(impliedBtcPrice).toLocaleString()}/BTC (+฿${amountSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})${btcLocName ? ` · ${btcLocName}` : ''}`
  } else if (holding.assetClass === 'gold' && goldUpdate && goldUpdate.gramsBought > 0) {
    const { gramsBought, amountSpentThb: amountSpent } = goldUpdate
    const bought = buyInto(holding, location, gramsBought, amountSpent)
    newUnits = bought.holding.units
    newAvgCost = bought.holding.avgCost
    calculatedUnits = gramsBought

    const impliedPricePerGram = amountSpent / gramsBought

    updatedFields = {
      totalThbInvested: bought.holding.totalThbInvested,
      totalUnits: newUnits,
      units: newUnits,
      avgCostThb: newAvgCost,
      avgCost: newAvgCost,
      price: impliedPricePerGram > 0 ? impliedPricePerGram : holding.price,
      ...(bought.holding.locations ? { locations: bought.holding.locations } : {}),
    }

    const goldLocName = bought.locationId ? bought.holding.locations?.find((l) => l.id === bought.locationId)?.name : undefined
    logNote = `DCA Buy: ${gramsBought.toFixed(4)} g @ ฿${impliedPricePerGram.toFixed(2)}/g (+฿${amountSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})${goldLocName ? ` · ${goldLocName}` : ''}`
  } else if (holding.assetClass === 'fund') {
    const currentUnits = holding.units ?? holding.totalUnits ?? 0
    const currentThbInvested = holding.totalThbInvested ?? (currentUnits * (holding.avgCostThb ?? holding.avgCost ?? 0))
    const spentThb = plan.monthlyAmount
    const newTotalUnits = overrideUnits !== undefined ? overrideUnits : (currentUnits + calculatedUnits)
    const newTotalThb = roundMoney(currentThbInvested + spentThb)
    const newAvgCostThb = newTotalUnits > 0 ? newTotalThb / newTotalUnits : holding.avgCost
    updatedFields = {
      totalThbInvested: newTotalThb,
      totalUnits: newTotalUnits,
      units: newTotalUnits,
      avgCostThb: newAvgCostThb,
      avgCost: newAvgCostThb,
    }
    logNote = `DCA Buy: ${calculatedUnits.toFixed(4)} units @ ฿${pricePerUnit.toFixed(2)}/unit (+฿${spentThb.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
  } else if (holding.assetClass === 'crypto') {
    const currentUnits = holding.units ?? holding.totalUnits ?? 0
    const spentThb = calculatedUnits * pricePerUnit
    const newTotalUnits = currentUnits + calculatedUnits
    const currentThbInvested = holding.totalThbInvested ?? (currentUnits * (holding.avgCostThb ?? holding.avgCost ?? 0))
    const newTotalThb = roundMoney(currentThbInvested + spentThb)
    const newAvgCostThb = newTotalUnits > 0 ? newTotalThb / newTotalUnits : holding.avgCost
    newUnits = newTotalUnits
    newAvgCost = newAvgCostThb
    updatedFields = {
      totalThbInvested: newTotalThb,
      totalUnits: newTotalUnits,
      units: newTotalUnits,
      avgCostThb: newAvgCostThb,
      avgCost: newAvgCostThb,
      price: pricePerUnit > 0 ? pricePerUnit : holding.price,
    }
    logNote = `DCA Buy: ${calculatedUnits.toFixed(8)} units @ ฿${pricePerUnit.toFixed(8)}/unit (+฿${spentThb.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
  }

  const resultingHolding: Holding = {
    ...holding,
    units: newUnits,
    totalUnits: newUnits,
    avgCost: newAvgCost,
    price: finalPrice,
    updatedAt: date,
    ...updatedFields,
  }

  const resolvedHoldingId = holding.id
  const updatedHoldings = holdingsList.map((h) =>
    h.id !== resolvedHoldingId ? h : resultingHolding
  )

  // 3. Add to holding log
  const logEntry: HoldingLog = {
    id: newId(),
    timestamp: new Date().toISOString(),
    action: isNewHolding ? 'add' : 'buy_more',
    holdingName: holding.name,
    ticker: holding.ticker,
    assetClass: holding.assetClass,
    note: logNote || `DCA Buy: ${calculatedUnits.toFixed(4)} units @ ฿${pricePerUnit.toLocaleString()} (+฿${plan.monthlyAmount.toLocaleString()})`,
    holdingId: holding.id,
    dcaPlanId: plan.id,
    dcaDate: date,
    ...paidLog,
    // Exactly what this buy did, for undo and the trade history (a new holding counts as created)
    delta: holdingDelta(
      isNewHolding ? undefined : previousHoldingState,
      resultingHolding,
      paidCash,
      paid ? payFromAccount(prev.cashAccounts ?? [], paid) : undefined,
    ),
  }

  return {
    ...prev,
    ...paidAccounts,
    dcaPlans: updatedPlans,
    holdings: updatedHoldings,
    holdingLogs: [logEntry, ...(prev.holdingLogs ?? [])],
  }
}

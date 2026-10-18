import type { BtcLocation, GoldLocation, Holding, HoldingLog, SpendiaryData } from '../../lib/types'
import type { DataContextValue } from '../DataContext'
import { newId } from '../migrate'
import { payFromAccount, upsert } from '../dataHelpers'
import { findMatchingHolding } from '../../lib/calc'
import { roundMoney } from '../../lib/money'

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

export function confirmDcaBuy(
  prev: SpendiaryData,
  ...[
    planId, pricePerUnit, date, overrideUnits, overrideAvgCost, overridePrice, btcLocationUpdate, goldLocationUpdate,
    stockUpdate, fundUpdate, targetHoldingId, btcUpdate, goldUpdate, payment,
  ]: Parameters<DataContextValue['confirmDcaBuy']>
): SpendiaryData {
  const plan = prev.dcaPlans.find((p) => p.id === planId)
  if (!plan) return prev

  // Paid from a cash account: its balance goes down, and the log keeps both
  // snapshots so Undo gives the money back
  const paid = payment && payment.amount > 0 && (prev.cashAccounts ?? []).some((a) => a.id === payment.accountId) ? payment : undefined
  const paidLog = paid
    ? {
        paidFromAccountId: paid.accountId,
        paidAmount: paid.amount,
        previousCashAccountsState: prev.cashAccounts ?? [],
        afterCashAccountsState: payFromAccount(prev.cashAccounts ?? [], paid),
      }
    : {}
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
            a.id === targetAcc.id ? { ...a, balance: a.balance + depositAmount } : a,
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
      ...(paid ? { paidFromAccountId: paid.accountId, paidAmount: paid.amount } : {}),
      previousCashAccountsState: oldAccounts,
      afterCashAccountsState: updatedCashAccounts,
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
  if (!holding && (stockUpdate || fundUpdate || btcLocationUpdate || goldLocationUpdate || (pricePerUnit > 0 && (plan.assetClass === 'gold' || plan.assetClass === 'crypto' || plan.assetClass === 'stock' || plan.assetClass === 'fund')))) {
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
      btcLocations: [],
      goldLocations: [],
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

  let finalBtcLocations = holding.btcLocations
  let finalGoldLocations = holding.goldLocations
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

    const newTotalUnits = currentUnits + unitsBought
    const newTotalThbInvested = roundMoney(currentThbInvested + amountSpentThb)
    const newTotalUsdInvested = currentUsdInvested + usdSpentThisTx

    const newAvgCostUsd = newTotalUnits > 0 ? newTotalUsdInvested / newTotalUnits : (holding.avgCostUsd ?? 0)
    const newAvgCostThb = newTotalUnits > 0 ? newTotalThbInvested / newTotalUnits : (holding.avgCostThb ?? holding.avgCost ?? 0)

    newUnits = newTotalUnits
    newAvgCost = newAvgCostThb
    calculatedUnits = unitsBought

    updatedFields = {
      units: newTotalUnits,
      totalUnits: newTotalUnits,
      totalThbInvested: newTotalThbInvested,
      totalUsdInvested: newTotalUsdInvested,
      avgCostUsd: newAvgCostUsd,
      avgCostThb: newAvgCostThb,
      avgCost: newAvgCostThb,
      price: pricePerShareThb > 0 ? pricePerShareThb : holding.price,
    }

    logNote = `DCA Buy: ${unitsBought} shares @ $${pricePerShareUsd.toFixed(2)}/share (+฿${amountSpentThb.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
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
  } else if (holding.assetClass === 'crypto' && btcLocationUpdate) {
    finalBtcLocations = upsert(holding.btcLocations ?? [], btcLocationUpdate)
    const totalSats = finalBtcLocations.reduce((s: number, l: BtcLocation) => s + l.satoshi, 0)
    const totalThb = roundMoney(finalBtcLocations.reduce((s: number, l: BtcLocation) => s + l.thbSpent, 0))
    newUnits = totalSats / 100_000_000
    newAvgCost = newUnits > 0 ? totalThb / newUnits : holding.avgCost
    if (!isFinite(newAvgCost) || isNaN(newAvgCost)) newAvgCost = holding.avgCost

    const existingLoc = btcLocationUpdate.id ? holding.btcLocations?.find((l) => l.id === btcLocationUpdate.id) : undefined
    const satsBought = (btcUpdate && typeof btcUpdate.satsBought === 'number' && btcUpdate.satsBought > 0)
      ? btcUpdate.satsBought
      : (existingLoc ? btcLocationUpdate.satoshi - existingLoc.satoshi : btcLocationUpdate.satoshi)
    const amountSpent = (btcUpdate && typeof btcUpdate.amountSpentThb === 'number' && btcUpdate.amountSpentThb > 0)
      ? btcUpdate.amountSpentThb
      : (existingLoc ? btcLocationUpdate.thbSpent - existingLoc.thbSpent : btcLocationUpdate.thbSpent)
    calculatedUnits = satsBought / 100_000_000

    const impliedBtcPrice = satsBought > 0 ? (amountSpent / satsBought) * 100_000_000 : (pricePerUnit > 0 ? pricePerUnit : holding.price)

    updatedFields = {
      totalThbInvested: totalThb,
      totalUnits: newUnits,
      units: newUnits,
      avgCostThb: newAvgCost,
      avgCost: newAvgCost,
      price: impliedBtcPrice > 0 ? impliedBtcPrice : holding.price,
    }

    const btcLocName = btcLocationUpdate.name || existingLoc?.name
    logNote = `DCA Buy: ${satsBought.toLocaleString()} sats @ ฿${Math.round(impliedBtcPrice).toLocaleString()}/BTC (+฿${amountSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})${btcLocName ? ` · ${btcLocName}` : ''}`
  } else if (holding.assetClass === 'gold' && goldLocationUpdate) {
    finalGoldLocations = upsert(holding.goldLocations ?? [], goldLocationUpdate)
    const totalGrams = finalGoldLocations.reduce((s: number, l: GoldLocation) => s + l.grams, 0)
    const totalThb = roundMoney(finalGoldLocations.reduce((s: number, l: GoldLocation) => s + l.thbSpent, 0))
    newUnits = totalGrams
    newAvgCost = newUnits > 0 ? totalThb / newUnits : holding.avgCost
    if (!isFinite(newAvgCost) || isNaN(newAvgCost)) newAvgCost = holding.avgCost

    const existingLoc = goldLocationUpdate.id ? holding.goldLocations?.find((l) => l.id === goldLocationUpdate.id) : undefined
    const gramsBought = goldUpdate?.gramsBought ?? (existingLoc ? goldLocationUpdate.grams - existingLoc.grams : goldLocationUpdate.grams)
    const amountSpent = goldUpdate?.amountSpentThb ?? (existingLoc ? goldLocationUpdate.thbSpent - existingLoc.thbSpent : goldLocationUpdate.thbSpent)
    calculatedUnits = gramsBought

    const impliedPricePerGram = gramsBought > 0 ? amountSpent / gramsBought : pricePerUnit

    updatedFields = {
      totalThbInvested: totalThb,
      totalUnits: newUnits,
      units: newUnits,
      avgCostThb: newAvgCost,
      avgCost: newAvgCost,
      price: impliedPricePerGram > 0 ? impliedPricePerGram : holding.price,
    }

    const goldLocName = goldLocationUpdate.name || existingLoc?.name
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

  const isBtcWithLocations = holding.assetClass === 'crypto' && (finalBtcLocations?.length ?? 0) > 0
  const isGoldWithLocations = holding.assetClass === 'gold' && (finalGoldLocations?.length ?? 0) > 0

  const resultingHolding: Holding = {
    ...holding,
    units: newUnits,
    totalUnits: newUnits,
    avgCost: newAvgCost,
    price: finalPrice,
    updatedAt: date,
    ...updatedFields,
    ...(isBtcWithLocations ? { btcLocations: finalBtcLocations } : {}),
    ...(isGoldWithLocations ? { goldLocations: finalGoldLocations } : {}),
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
    previousHoldingState,
    afterHoldingState: resultingHolding,
    dcaPlanId: plan.id,
    dcaDate: date,
    ...paidLog,
  }

  return {
    ...prev,
    ...paidAccounts,
    dcaPlans: updatedPlans,
    holdings: updatedHoldings,
    holdingLogs: [logEntry, ...(prev.holdingLogs ?? [])],
  }
}

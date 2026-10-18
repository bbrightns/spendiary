import type { SpendiaryData, Holding } from '../../lib/types'
import type { DataContextValue } from '../DataContext'
import { newId } from '../migrate'
import { revertCashAccountsChange } from '../dataHelpers'
import { roundMoney } from '../../lib/money'

/**
 * The activity log of holding changes, including undoing a logged change.
 * Each action takes the current data plus the arguments useData() exposes and returns the next data.
 */
export function addHoldingLog(prev: SpendiaryData, ...[log]: Parameters<DataContextValue['addHoldingLog']>): SpendiaryData {
  const holding = log.holdingId
    ? prev.holdings.find((h) => h.id === log.holdingId)
    : prev.holdings.find((h) => h.ticker === log.ticker)
  const previousHoldingState =
    log.previousHoldingState ??
    (log.action !== 'add' && log.action !== 'note' && holding
      ? JSON.parse(JSON.stringify(holding))
      : undefined)

  return {
    ...prev,
    holdingLogs: [
      {
        ...log,
        id: log.id ?? newId(),
        timestamp: log.timestamp ?? new Date().toISOString(),
        holdingId: log.holdingId ?? holding?.id,
        previousHoldingState,
      },
      ...(prev.holdingLogs ?? []),
    ],
  }
}

export function removeHoldingLog(prev: SpendiaryData, ...[logId]: Parameters<DataContextValue['removeHoldingLog']>): SpendiaryData {
  return {
    ...prev,
    holdingLogs: (prev.holdingLogs ?? []).filter((log) => log.id !== logId),
  }
}

export function removeHoldingLogs(prev: SpendiaryData, ...[logIds]: Parameters<DataContextValue['removeHoldingLogs']>): SpendiaryData {
  const ids = new Set(logIds)
  return {
    ...prev,
    holdingLogs: (prev.holdingLogs ?? []).filter((log) => !ids.has(log.id)),
  }
}

export function updateHoldingLogTimestamp(prev: SpendiaryData, ...[logId, timestamp]: Parameters<DataContextValue['updateHoldingLogTimestamp']>): SpendiaryData {
  const logs = prev.holdingLogs ?? []
  const updatedLogs = logs.map((l) => (l.id === logId ? { ...l, timestamp } : l))
  return {
    ...prev,
    holdingLogs: updatedLogs,
  }
}

export function updateHoldingLog(prev: SpendiaryData, ...[logId, patch]: Parameters<DataContextValue['updateHoldingLog']>): SpendiaryData {
  return {
    ...prev,
    holdingLogs: (prev.holdingLogs ?? []).map((l) => (l.id === logId ? { ...l, ...patch } : l)),
  }
}

export function undoHoldingLog(prev: SpendiaryData, ...[logId]: Parameters<DataContextValue['undoHoldingLog']>): SpendiaryData {
  const logs = prev.holdingLogs ?? []
  const log = logs.find((l) => l.id === logId)
  if (!log) return prev

  let updatedHoldings = [...prev.holdings]
  let updatedPlans = [...prev.dcaPlans]
  let updatedCashAccounts = prev.cashAccounts ? [...prev.cashAccounts] : []

  // ── 1. Revert Cash Account Changes (Delta-based) ──
  if (log.dcaPlanId && !log.cashAccountId && log.previousCashAccountsState && log.afterCashAccountsState) {
    // A confirmed DCA buy: the payment goes back to the account it came from, and a
    // savings deposit comes back out of the account it went into
    updatedCashAccounts = revertCashAccountsChange(updatedCashAccounts, log.previousCashAccountsState, log.afterCashAccountsState)
  } else if (log.action === 'sell') {
    // When selling, proceeds were deposited into log.cashAccountId
    if (log.cashAccountId && log.proceeds && log.proceeds > 0) {
      updatedCashAccounts = updatedCashAccounts.map((c) =>
        c.id === log.cashAccountId
          ? { ...c, balance: roundMoney(Math.max(0, c.balance - log.proceeds!)) }
          : c
      )
    }
  } else if (log.action === 'buy_more') {
    // When buying, cash was deducted from log.cashAccountId
    if (log.cashAccountId) {
      let deductAmount = 0
      if (log.previousCashAccountsState && log.afterCashAccountsState) {
        const pAcc = log.previousCashAccountsState.find((c) => c.id === log.cashAccountId)
        const aAcc = log.afterCashAccountsState.find((c) => c.id === log.cashAccountId)
        if (pAcc && aAcc && pAcc.balance > aAcc.balance) {
          deductAmount = pAcc.balance - aAcc.balance
        }
      }
      if (deductAmount === 0 && log.afterHoldingState && log.previousHoldingState) {
        deductAmount = Math.max(
          0,
          (log.afterHoldingState.totalThbInvested ?? 0) - (log.previousHoldingState.totalThbInvested ?? 0)
        )
      }
      if (deductAmount === 0 && log.note) {
        const m = log.note.match(/฿([0-9,.]+)\s*spent/)
        if (m) deductAmount = parseFloat(m[1].replace(/,/g, ''))
      }
      if (deductAmount > 0) {
        updatedCashAccounts = updatedCashAccounts.map((c) =>
          c.id === log.cashAccountId
            ? { ...c, balance: roundMoney(c.balance + deductAmount) }
            : c
        )
      }
    }
  } else if (log.action === 'dividend') {
    // When receiving dividend, netDividend was deposited into log.cashAccountId
    if (log.cashAccountId && log.netDividend && log.netDividend > 0) {
      updatedCashAccounts = updatedCashAccounts.map((c) =>
        c.id === log.cashAccountId
          ? { ...c, balance: roundMoney(Math.max(0, c.balance - log.netDividend!)) }
          : c
      )
    }
  } else if (log.assetClass === 'cash' || log.holdingName === 'Cash Accounts') {
    // For direct cash account management logs, undo just this log's changes so later
    // balance moves (e.g. Spend transactions) survive; old logs without an "after"
    // snapshot fall back to restoring the previous state
    if (log.previousCashAccountsState) {
      updatedCashAccounts = log.afterCashAccountsState
        ? revertCashAccountsChange(updatedCashAccounts, log.previousCashAccountsState, log.afterCashAccountsState)
        : log.previousCashAccountsState
    }
  }

  // ── 2. Revert Holding Changes (Delta-based) ──
  if (log.holdingId) {
    const hIndex = updatedHoldings.findIndex((h) => h.id === log.holdingId)

    if (log.action === 'sell') {
      // Calculate units and cost basis sold in this specific transaction
      let soldUnits = log.soldUnits ?? 0
      if (soldUnits <= 0 && log.previousHoldingState) {
        const prevU = log.previousHoldingState.units ?? log.previousHoldingState.totalUnits ?? 0
        const afterU = log.afterHoldingState ? (log.afterHoldingState.units ?? log.afterHoldingState.totalUnits ?? 0) : 0
        soldUnits = Math.max(0, prevU - afterU)
      }
      if (soldUnits <= 0 && log.note) {
        const m = log.note.match(/Sold\s+([0-9,.]+)\s*(?:g|shares|units|sats)/i)
        if (m) {
          const raw = parseFloat(m[1].replace(/,/g, ''))
          soldUnits = log.assetClass === 'crypto' ? raw / 100_000_000 : raw
        }
      }

      let costBasisSold = 0
      if (log.proceeds !== undefined && log.realizedPnL !== undefined) {
        costBasisSold = Math.max(0, log.proceeds - log.realizedPnL)
      } else if (log.previousHoldingState) {
        const prevCost = log.previousHoldingState.totalThbInvested ?? 0
        const afterCost = log.afterHoldingState?.totalThbInvested ?? 0
        costBasisSold = Math.max(0, prevCost - afterCost)
      }

      if (hIndex >= 0) {
        // Holding currently exists in portfolio -> add back sold units and cost basis
        const current = updatedHoldings[hIndex]
        const newUnits = (current.units ?? current.totalUnits ?? 0) + soldUnits
        const newTotalThb = roundMoney((current.totalThbInvested ?? 0) + costBasisSold)
        const newAvgCost = newUnits > 0 ? newTotalThb / newUnits : current.avgCost

        // Restore gold location if applicable
        let updatedGoldLocs = current.goldLocations ? [...current.goldLocations] : undefined
        if (current.assetClass === 'gold' && log.previousHoldingState?.goldLocations) {
          const prevLocs = log.previousHoldingState.goldLocations
          const afterLocs = log.afterHoldingState?.goldLocations ?? []
          const candidate = prevLocs.find((pl) => {
            const al = afterLocs.find((a) => a.id === pl.id)
            return !al || pl.grams > al.grams
          }) ?? prevLocs[0]

          if (candidate) {
            const locId = candidate.id
            const locName = candidate.name
            const existingLoc = updatedGoldLocs?.find((l) => l.id === locId || l.name === locName)
            if (existingLoc) {
              updatedGoldLocs = (updatedGoldLocs ?? []).map((l) =>
                l.id === existingLoc.id
                  ? { ...l, grams: l.grams + soldUnits, thbSpent: roundMoney(l.thbSpent + costBasisSold) }
                  : l
              )
            } else {
              updatedGoldLocs = [
                ...(updatedGoldLocs ?? []),
                { id: locId || newId(), name: locName, grams: soldUnits, thbSpent: costBasisSold, isLocked: candidate.isLocked },
              ]
            }
          }
        }

        // Restore BTC location if applicable
        let updatedBtcLocs = current.btcLocations ? [...current.btcLocations] : undefined
        if (current.assetClass === 'crypto' && log.previousHoldingState?.btcLocations) {
          const soldSats = Math.round(soldUnits * 100_000_000)
          const prevLocs = log.previousHoldingState.btcLocations
          const afterLocs = log.afterHoldingState?.btcLocations ?? []
          const candidate = prevLocs.find((pl) => {
            const al = afterLocs.find((a) => a.id === pl.id)
            return !al || pl.satoshi > al.satoshi
          }) ?? prevLocs[0]

          if (candidate) {
            const locId = candidate.id
            const locName = candidate.name
            const existingLoc = updatedBtcLocs?.find((l) => l.id === locId || l.name === locName)
            if (existingLoc) {
              updatedBtcLocs = (updatedBtcLocs ?? []).map((l) =>
                l.id === existingLoc.id
                  ? { ...l, satoshi: l.satoshi + soldSats, thbSpent: roundMoney(l.thbSpent + costBasisSold) }
                  : l
              )
            } else {
              updatedBtcLocs = [
                ...(updatedBtcLocs ?? []),
                { id: locId || newId(), name: locName, satoshi: soldSats, thbSpent: costBasisSold, isLocked: candidate.isLocked },
              ]
            }
          }
        }

        updatedHoldings[hIndex] = {
          ...current,
          units: newUnits,
          totalUnits: newUnits,
          totalThbInvested: newTotalThb,
          avgCost: newAvgCost,
          avgCostThb: newAvgCost,
          ...(updatedGoldLocs ? { goldLocations: updatedGoldLocs } : {}),
          ...(updatedBtcLocs ? { btcLocations: updatedBtcLocs } : {}),
        }
      } else {
        // Holding was completely removed (e.g. 100% sold) -> restore holding
        if (log.previousHoldingState) {
          const isFinalFullSell = !log.afterHoldingState || (log.afterHoldingState.units ?? 0) <= 0
          if (isFinalFullSell) {
            updatedHoldings.push(log.previousHoldingState)
          } else {
            const restored: Holding = {
              ...log.previousHoldingState,
              units: soldUnits,
              totalUnits: soldUnits,
              totalThbInvested: costBasisSold,
              avgCost: soldUnits > 0 ? costBasisSold / soldUnits : log.previousHoldingState.avgCost,
              avgCostThb: soldUnits > 0 ? costBasisSold / soldUnits : log.previousHoldingState.avgCostThb,
            }
            updatedHoldings.push(restored)
          }
        }
      }
    } else if (log.action === 'buy_more') {
      // Reverse buy_more: subtract the units and cost basis that were added in this buy
      if (hIndex >= 0) {
        const current = updatedHoldings[hIndex]
        const prevU = log.previousHoldingState ? (log.previousHoldingState.units ?? log.previousHoldingState.totalUnits ?? 0) : 0
        const afterU = log.afterHoldingState ? (log.afterHoldingState.units ?? log.afterHoldingState.totalUnits ?? 0) : 0
        const boughtUnits = Math.max(0, afterU - prevU)

        const prevCost = log.previousHoldingState?.totalThbInvested ?? 0
        const afterCost = log.afterHoldingState?.totalThbInvested ?? 0
        const addedCost = Math.max(0, afterCost - prevCost)

        const newUnits = Math.max(0, (current.units ?? current.totalUnits ?? 0) - boughtUnits)
        const newTotalThb = Math.max(0, roundMoney((current.totalThbInvested ?? 0) - addedCost))
        const newAvgCost = newUnits > 0 ? newTotalThb / newUnits : current.avgCost

        // Adjust gold location if applicable
        let updatedGoldLocs = current.goldLocations ? [...current.goldLocations] : undefined
        if (current.assetClass === 'gold' && updatedGoldLocs && log.afterHoldingState?.goldLocations) {
          const afterLocs = log.afterHoldingState.goldLocations
          const prevLocs = log.previousHoldingState?.goldLocations ?? []
          const targetLoc = afterLocs.find((al) => {
            const pl = prevLocs.find((p) => p.id === al.id)
            return !pl || al.grams > pl.grams
          })
          if (targetLoc) {
            updatedGoldLocs = updatedGoldLocs.map((l) => {
              if (l.id !== targetLoc.id && l.name !== targetLoc.name) return l
              const remG = Math.max(0, l.grams - boughtUnits)
              const remS = Math.max(0, roundMoney(l.thbSpent - addedCost))
              return { ...l, grams: remG, thbSpent: remS }
            }).filter((l) => l.grams > 0.0001)
          }
        }

        // Adjust btc location if applicable
        let updatedBtcLocs = current.btcLocations ? [...current.btcLocations] : undefined
        if (current.assetClass === 'crypto' && updatedBtcLocs && log.afterHoldingState?.btcLocations) {
          const boughtSats = Math.round(boughtUnits * 100_000_000)
          const afterLocs = log.afterHoldingState.btcLocations
          const prevLocs = log.previousHoldingState?.btcLocations ?? []
          const targetLoc = afterLocs.find((al) => {
            const pl = prevLocs.find((p) => p.id === al.id)
            return !pl || al.satoshi > pl.satoshi
          })
          if (targetLoc) {
            updatedBtcLocs = updatedBtcLocs.map((l) => {
              if (l.id !== targetLoc.id && l.name !== targetLoc.name) return l
              const remSats = Math.max(0, l.satoshi - boughtSats)
              const remSpent = Math.max(0, roundMoney(l.thbSpent - addedCost))
              return { ...l, satoshi: remSats, thbSpent: remSpent }
            }).filter((l) => l.satoshi > 0)
          }
        }

        updatedHoldings[hIndex] = {
          ...current,
          units: newUnits,
          totalUnits: newUnits,
          totalThbInvested: newTotalThb,
          avgCost: newAvgCost,
          avgCostThb: newAvgCost,
          ...(updatedGoldLocs ? { goldLocations: updatedGoldLocs } : {}),
          ...(updatedBtcLocs ? { btcLocations: updatedBtcLocs } : {}),
        }
      }
    } else if (log.action === 'transfer') {
      // Revert a location transfer: coins and their cost go back to the source location
      const t = log.transfer
      if (t && hIndex >= 0) {
        const current = updatedHoldings[hIndex]
        const adjust = <T extends { id: string; thbSpent: number }>(locs: T[], key: 'satoshi' | 'grams'): T[] =>
          locs
            .map((l) => {
              const qty = l as unknown as Record<string, number>
              if (l.id === t.fromLocationId) {
                return { ...l, [key]: qty[key] + t.amount, thbSpent: roundMoney(l.thbSpent + t.costMoved) }
              }
              if (l.id === t.toLocationId) {
                return {
                  ...l,
                  [key]: Math.max(0, qty[key] - t.received),
                  thbSpent: Math.max(0, roundMoney(l.thbSpent - t.costMoved)),
                }
              }
              return l
            })
            // A location that only existed because of this transfer goes away with it
            .filter((l) => !(t.destCreated && l.id === t.toLocationId && (l as unknown as Record<string, number>)[key] <= 0))

        const feeUnits = t.unit === 'sats' ? t.fee / 100_000_000 : t.fee
        const newUnits = (current.units ?? current.totalUnits ?? 0) + feeUnits
        const totalThb = current.totalThbInvested ?? 0
        const newAvg = newUnits > 0 ? totalThb / newUnits : current.avgCost
        updatedHoldings[hIndex] = {
          ...current,
          units: newUnits,
          totalUnits: newUnits,
          avgCost: newAvg,
          avgCostThb: newAvg,
          ...(current.btcLocations && t.unit === 'sats' ? { btcLocations: adjust(current.btcLocations, 'satoshi') } : {}),
          ...(current.goldLocations && t.unit === 'grams' ? { goldLocations: adjust(current.goldLocations, 'grams') } : {}),
        }
      }
    } else if (log.action === 'add') {
      // Revert add: remove the holding that was added
      if (log.ticker !== 'FIXED' && log.ticker !== 'DCA') {
        updatedHoldings = updatedHoldings.filter((h) => h.id !== log.holdingId)
      }
    } else if (log.action === 'edit') {
      // Revert edit: restore previous holding state
      if (log.previousHoldingState && hIndex >= 0) {
        updatedHoldings[hIndex] = log.previousHoldingState
      }
    }
  }

  // ── 3. Revert DCA plan confirmations if linked ──
  if (log.dcaPlanId && log.dcaDate) {
    updatedPlans = updatedPlans.map((p) => {
      if (p.id !== log.dcaPlanId) return p
      return {
        ...p,
        confirmedDates: (p.confirmedDates ?? []).filter((d) => d !== log.dcaDate),
        skippedDates: (p.skippedDates ?? []).filter((d) => d !== log.dcaDate),
      }
    })
  }

  // ── 4. Remove this log entry ──
  const updatedLogs = logs.filter((l) => l.id !== logId)
  let updatedDividendRecords = prev.dividendRecords ?? []
  if (log.action === 'dividend' && log.dividendRecordId) {
    updatedDividendRecords = updatedDividendRecords.filter((r) => r.id !== log.dividendRecordId)
  }

  return {
    ...prev,
    holdings: updatedHoldings,
    dcaPlans: updatedPlans,
    cashAccounts: updatedCashAccounts,
    dividendRecords: updatedDividendRecords,
    holdingLogs: updatedLogs,
  }
}

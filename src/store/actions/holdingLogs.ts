import type { SpendiaryData, SpendTransaction, Holding, HoldingLocation, HoldingLog } from '../../lib/types'
import { qtyEpsilon, roundQty } from '../../lib/locations'
import { SATS_PER_BTC } from '../../lib/calc'
import type { DataContextValue } from '../DataContext'
import { newId } from '../migrate'
import { revertCashAccountsChange } from '../dataHelpers'
import { diffHolding, planEditUndo } from './undoEdit'
import { holdingDelta, undoHoldingDelta, type UndoResult } from './undoDelta'
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

  // An edit keeps exactly which fields it changed, so undo can revert those alone
  const changes = log.action === 'edit' && !log.changes && previousHoldingState && log.afterHoldingState
    ? diffHolding(previousHoldingState, log.afterHoldingState)
    : undefined

  // An add keeps exactly what it put in: a new holding, or units merged into an existing one
  const delta = log.action === 'add' && !log.delta && log.afterHoldingState
    ? holdingDelta(previousHoldingState, log.afterHoldingState)
    : undefined

  return {
    ...prev,
    holdingLogs: [
      {
        ...log,
        id: log.id ?? newId(),
        timestamp: log.timestamp ?? new Date().toISOString(),
        holdingId: log.holdingId ?? holding?.id,
        // An add carries its delta instead of whole snapshots
        ...(delta ? { previousHoldingState: undefined, afterHoldingState: undefined, delta } : { previousHoldingState }),
        ...(changes ? { changes } : {}),
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

/** A new date for an entry; `savedAt` keeps when it was really saved, to find its Spend twin */
const redated = (l: HoldingLog, timestamp: string): HoldingLog =>
  timestamp === l.timestamp ? l : { ...l, timestamp, savedAt: l.savedAt ?? l.timestamp }

export function updateHoldingLogTimestamp(prev: SpendiaryData, ...[logId, timestamp]: Parameters<DataContextValue['updateHoldingLogTimestamp']>): SpendiaryData {
  const logs = prev.holdingLogs ?? []
  const updatedLogs = logs.map((l) => (l.id === logId ? redated(l, timestamp) : l))
  return {
    ...prev,
    holdingLogs: updatedLogs,
  }
}

export function updateHoldingLog(prev: SpendiaryData, ...[logId, patch]: Parameters<DataContextValue['updateHoldingLog']>): SpendiaryData {
  return {
    ...prev,
    holdingLogs: (prev.holdingLogs ?? []).map((l) => (l.id === logId ? { ...(patch.timestamp ? redated(l, patch.timestamp) : l), ...patch } : l)),
  }
}

export function undoHoldingLog(prev: SpendiaryData, ...[logId]: Parameters<DataContextValue['undoHoldingLog']>): SpendiaryData {
  const r = undoHoldingLogChecked(prev, logId)
  return r.ok ? r.data : prev
}

/**
 * A balance typed in on a wallet leaves two records of one change: this Cash Accounts log and a
 * "Balance adjusted" entry in Spend (saved together). Undoing either must remove the other, or
 * the other's undo would move the money a second time.
 */
export function isSameBalanceEdit(log: HoldingLog, txn: SpendTransaction): boolean {
  const before = log.previousCashAccountsState
  const after = log.afterCashAccountsState
  if (!txn.adjustment || log.action !== 'edit' || log.assetClass !== 'cash' || log.dcaPlanId || !before || !after) return false
  if (Math.abs(new Date(txn.createdAt).getTime() - new Date(log.savedAt ?? log.timestamp).getTime()) > 60_000) return false
  return after.some((a) => {
    const was = before.find((b) => b.id === a.id)
    const diff = was ? roundMoney(a.balance - was.balance) : 0
    return diff !== 0 && Math.abs(diff) === txn.amount && (diff > 0 ? txn.toAccountId : txn.accountId) === a.id
  })
}

/** Typed-in balances have left a Spend entry since this release */
const BALANCE_ENTRIES_FROM = Date.parse('2026-11-01T11:56:08Z')

/** A THB balance typed in since then: one that must have a Spend entry (USD accounts never do) */
function typedInThb(log: HoldingLog): boolean {
  const before = log.previousCashAccountsState
  const after = log.afterCashAccountsState
  if (log.action !== 'edit' || log.assetClass !== 'cash' || log.dcaPlanId || !before || !after) return false
  if (new Date(log.savedAt ?? log.timestamp).getTime() < BALANCE_ENTRIES_FROM) return false
  return after.some((a) => {
    const was = before.find((b) => b.id === a.id)
    return !!was && (a.currency ?? 'THB') === 'THB' && (was.currency ?? 'THB') === 'THB' && roundMoney(a.balance - was.balance) !== 0
  })
}

const unitsOf = (h: Holding | undefined) => h?.units ?? h?.totalUnits ?? 0

/**
 * Whether an entry saved anything to put back. A DCA plan change, an AI import, a debt entry or a
 * note only records what happened: "undoing" one would hide the record and change nothing.
 */
export function canUndoLog(log: HoldingLog): boolean {
  const planDate = Boolean(log.dcaPlanId && log.dcaDate)
  // Older confirmed DCA buys were saved as notes
  if (log.action === 'note') return planDate
  return Boolean(log.delta || log.holdingId || log.cashAccountId || log.previousCashAccountsState || log.dividendRecordId || planDate)
}

/** Why undoing this entry would lose or invent something, checked before anything changes */
function undoBlockedReason(prev: SpendiaryData, log: HoldingLog): string | null {
  if (!canUndoLog(log)) return 'This entry only records what happened, so there is nothing to put back.'

  // Holdings would change while the money stays put
  const moved = log.delta?.cash ?? (log.cashAccountId && ['sell', 'buy_more', 'dividend'].includes(log.action) ? [{ accountId: log.cashAccountId, name: undefined }] : [])
  const gone = moved.find((c) => !prev.cashAccounts?.some((a) => a.id === c.accountId))
  if (gone) return `${gone.name ?? 'The account it used'} was deleted, so the money can't go back. Undo that deletion first.`

  // Entries with a delta say the rest themselves (undoHoldingDelta)
  if (log.delta) return null

  const holding = log.holdingId ? prev.holdings.find((h) => h.id === log.holdingId) : undefined
  if (log.holdingId && !holding && (log.action === 'buy_more' || log.action === 'transfer')) {
    return `"${log.holdingName}" is no longer in your portfolio, so this can't be undone.`
  }

  // Older trades put back only what their snapshots saved: without them the cash would move and the units wouldn't
  if (log.action === 'sell' && !holding && !log.previousHoldingState) {
    return `"${log.holdingName}" is gone and this older entry saved no details, so the sale can't be undone.`
  }
  if (log.action === 'buy_more' && holding) {
    if (!log.afterHoldingState) return 'This older entry saved no details of what it bought, so it can\'t be undone.'
    const bought = unitsOf(log.afterHoldingState) - unitsOf(log.previousHoldingState)
    if (unitsOf(holding) < bought - qtyEpsilon(holding.assetClass)) {
      return `Undoing this would leave ${log.holdingName} below zero, because some of it was sold or moved since.`
    }
  }

  // A move: the coins must still be where they went, and the place they came from must still exist
  if (log.action === 'transfer' && log.transfer && holding?.locations) {
    const t = log.transfer
    const toQty = (n: number) => (t.unit === 'sats' ? n / SATS_PER_BTC : n)
    if (!holding.locations.some((l) => l.id === t.fromLocationId)) {
      return `${t.fromName} was removed since, so there is nowhere to move this back to.`
    }
    const dest = holding.locations.find((l) => l.id === t.toLocationId)
    if (!dest || dest.qty < toQty(t.received) - qtyEpsilon(holding.assetClass)) {
      return `Some of what moved to ${t.toName} was sold or moved on since, so this move can't be undone.`
    }
  }

  // Older adds saved no delta, so undoing one removes the whole holding, later trades included
  if (log.action === 'add' && holding) {
    const added = new Date(log.timestamp).getTime()
    const tradedSince = (prev.holdingLogs ?? []).some(
      (l) =>
        l.id !== log.id &&
        l.holdingId === log.holdingId &&
        (l.action === 'buy_more' || l.action === 'sell' || l.action === 'transfer') &&
        new Date(l.timestamp).getTime() >= added,
    )
    if (tradedSince) return `"${log.holdingName}" was traded after it was added. Undo those trades first.`
  }

  // Undoing a new account removes it: not once its balance moved or Spend entries point at it
  const before = log.previousCashAccountsState
  const after = log.afterCashAccountsState
  if (!log.dcaPlanId && log.assetClass === 'cash' && before && after) {
    for (const added of after.filter((a) => !before.some((b) => b.id === a.id))) {
      const now = prev.cashAccounts?.find((c) => c.id === added.id)
      if (!now) continue
      const used = now.balance !== added.balance || (prev.spendTransactions ?? []).some((t) => t.accountId === added.id || t.toAccountId === added.id)
      if (used) return `"${now.name}" has been used since it was added, so it can't be removed this way.`
    }
  }

  // Undone in Spend before the two were linked: its entry is gone but this one stayed
  if (typedInThb(log) && !(prev.spendTransactions ?? []).some((t) => isSameBalanceEdit(log, t))) {
    return 'This balance change was already undone in Spend, so undoing it here would move the money twice. Delete this entry instead.'
  }

  return null
}

/** Undo one log entry, or say why it can't be undone (then nothing changes and the entry stays) */
export function undoHoldingLogChecked(prev: SpendiaryData, logId: string): UndoResult {
  const logs = prev.holdingLogs ?? []
  const log = logs.find((l) => l.id === logId)
  if (!log) return { ok: false, reason: 'This entry no longer exists.' }
  const blocked = undoBlockedReason(prev, log)
  if (blocked) return { ok: false, reason: blocked }

  // ── 1–2. Holdings and cash: newer entries reverse their saved delta; older ones work it out from snapshots ──
  const reverted = log.delta ? undoHoldingDelta(prev, log) : undoFromSnapshots(prev, log)
  if (!reverted.ok) return reverted
  const updatedHoldings = reverted.data.holdings
  const updatedCashAccounts = reverted.data.cashAccounts ?? []
  let updatedPlans = [...prev.dcaPlans]

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
    ok: true,
    data: {
      ...prev,
      holdings: updatedHoldings,
      dcaPlans: updatedPlans,
      cashAccounts: updatedCashAccounts,
      dividendRecords: updatedDividendRecords,
      holdingLogs: updatedLogs,
      // The balance is already back, so its Spend entry just goes
      ...(prev.spendTransactions ? { spendTransactions: prev.spendTransactions.filter((t) => !isSameBalanceEdit(log, t)) } : {}),
    },
  }
}

/** Older entries without a saved delta: holdings and cash worked out from their before/after snapshots */
function undoFromSnapshots(prev: SpendiaryData, log: HoldingLog): UndoResult {
  let updatedHoldings = [...prev.holdings]
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
          ? { ...c, balance: roundMoney(c.balance - log.proceeds!) }
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
          ? { ...c, balance: roundMoney(c.balance - log.netDividend!) }
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

        // Put the units and cost back into the location they were sold from
        const updatedLocs = current.locations && log.previousHoldingState?.locations
          ? restoreSoldLocation(current, log.previousHoldingState.locations, log.afterHoldingState?.locations ?? [], soldUnits, costBasisSold)
          : undefined

        updatedHoldings[hIndex] = {
          ...current,
          units: newUnits,
          totalUnits: newUnits,
          totalThbInvested: newTotalThb,
          avgCost: newAvgCost,
          avgCostThb: newAvgCost,
          ...(updatedLocs ? { locations: updatedLocs } : {}),
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

        // Take the units and cost back out of the location the buy went into
        const updatedLocs = current.locations && log.afterHoldingState?.locations
          ? reverseBoughtLocation(current, log.previousHoldingState?.locations ?? [], log.afterHoldingState.locations, boughtUnits, addedCost)
          : undefined

        updatedHoldings[hIndex] = {
          ...current,
          units: newUnits,
          totalUnits: newUnits,
          totalThbInvested: newTotalThb,
          avgCost: newAvgCost,
          avgCostThb: newAvgCost,
          ...(updatedLocs ? { locations: updatedLocs } : {}),
        }
      }
    } else if (log.action === 'transfer') {
      // Revert a location transfer: coins and their cost go back to the source location
      const t = log.transfer
      if (t && hIndex >= 0) {
        const current = updatedHoldings[hIndex]
        // Logged amounts are sats for BTC; locations keep the holding's own unit
        const toQty = (n: number) => (t.unit === 'sats' ? n / SATS_PER_BTC : n)
        const ac = current.assetClass
        const locs = (current.locations ?? [])
          .map((l) => {
            if (l.id === t.fromLocationId) {
              return {
                ...l,
                qty: roundQty(ac, l.qty + toQty(t.amount)),
                thbSpent: roundMoney(l.thbSpent + t.costMoved),
                ...(l.usdSpent !== undefined && t.costMovedUsd !== undefined ? { usdSpent: l.usdSpent + t.costMovedUsd } : {}),
              }
            }
            if (l.id === t.toLocationId) {
              return {
                ...l,
                qty: Math.max(0, roundQty(ac, l.qty - toQty(t.received))),
                thbSpent: Math.max(0, roundMoney(l.thbSpent - t.costMoved)),
                ...(l.usdSpent !== undefined && t.costMovedUsd !== undefined ? { usdSpent: Math.max(0, l.usdSpent - t.costMovedUsd) } : {}),
              }
            }
            return l
          })
          // A location that only existed because of this transfer goes away with it
          .filter((l) => !(t.destCreated && l.id === t.toLocationId && l.qty <= qtyEpsilon(ac)))

        const feeUnits = toQty(t.fee)
        const newUnits = (current.units ?? current.totalUnits ?? 0) + feeUnits
        const totalThb = current.totalThbInvested ?? 0
        const newAvg = newUnits > 0 ? totalThb / newUnits : current.avgCost
        updatedHoldings[hIndex] = {
          ...current,
          units: newUnits,
          totalUnits: newUnits,
          avgCost: newAvg,
          avgCostThb: newAvg,
          ...(current.locations ? { locations: locs } : {}),
        }
      }
    } else if (log.action === 'add') {
      // Revert add: remove the holding that was added
      if (log.ticker !== 'FIXED' && log.ticker !== 'DCA') {
        updatedHoldings = updatedHoldings.filter((h) => h.id !== log.holdingId)
      }
    } else if (log.action === 'edit') {
      // Revert only what the edit changed, so buys, sells and edits made after it survive
      const plan = planEditUndo(hIndex >= 0 ? updatedHoldings[hIndex] : undefined, log)
      if (!plan.ok) return { ok: false, reason: plan.reason }
      updatedHoldings[hIndex] = plan.holding
    }
  }

  return { ok: true, data: { ...prev, holdings: updatedHoldings, cashAccounts: updatedCashAccounts } }
}

/** Undo of a sale: the location that shrank in the logged sale gets the units and cost back */
function restoreSoldLocation(
  current: Holding,
  prevLocs: HoldingLocation[],
  afterLocs: HoldingLocation[],
  soldUnits: number,
  costBasisSold: number,
): HoldingLocation[] {
  const ac = current.assetClass
  const candidate = prevLocs.find((pl) => {
    const al = afterLocs.find((a) => a.id === pl.id)
    return !al || pl.qty > al.qty
  }) ?? prevLocs[0]
  const locs = current.locations ?? []
  if (!candidate) return locs
  const after = afterLocs.find((a) => a.id === candidate.id)
  const usdBack = candidate.usdSpent !== undefined ? candidate.usdSpent - (after?.usdSpent ?? 0) : undefined
  const existing = locs.find((l) => l.id === candidate.id || l.name === candidate.name)
  if (existing) {
    return locs.map((l) =>
      l.id !== existing.id
        ? l
        : {
            ...l,
            qty: roundQty(ac, l.qty + soldUnits),
            thbSpent: roundMoney(l.thbSpent + costBasisSold),
            ...(usdBack !== undefined ? { usdSpent: (l.usdSpent ?? 0) + usdBack } : {}),
          },
    )
  }
  return [
    ...locs,
    {
      id: candidate.id,
      name: candidate.name,
      qty: roundQty(ac, soldUnits),
      thbSpent: roundMoney(costBasisSold),
      ...(usdBack !== undefined ? { usdSpent: usdBack } : {}),
      ...(candidate.isLocked ? { isLocked: true } : {}),
    },
  ]
}

/** Undo of a buy: the location that grew in the logged buy gives the units and cost back; one the buy created goes away */
function reverseBoughtLocation(
  current: Holding,
  prevLocs: HoldingLocation[],
  afterLocs: HoldingLocation[],
  boughtUnits: number,
  addedCost: number,
): HoldingLocation[] {
  const ac = current.assetClass
  const locs = current.locations ?? []
  const target = afterLocs.find((al) => {
    const pl = prevLocs.find((p) => p.id === al.id)
    return !pl || al.qty > pl.qty
  })
  if (!target) return locs
  const before = prevLocs.find((p) => p.id === target.id)
  const usdAdded = target.usdSpent !== undefined ? target.usdSpent - (before?.usdSpent ?? 0) : undefined
  return locs
    .map((l) => {
      if (l.id !== target.id && l.name !== target.name) return l
      return {
        ...l,
        qty: Math.max(0, roundQty(ac, l.qty - boughtUnits)),
        thbSpent: Math.max(0, roundMoney(l.thbSpent - addedCost)),
        ...(usdAdded !== undefined && l.usdSpent !== undefined ? { usdSpent: Math.max(0, l.usdSpent - usdAdded) } : {}),
      }
    })
    .filter((l) => !(!before && (l.id === target.id || l.name === target.name) && l.qty <= qtyEpsilon(ac)))
}

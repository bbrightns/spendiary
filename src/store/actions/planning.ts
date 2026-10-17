import type { SpendiaryData, NetWorthSnapshot } from '../../lib/types'
import type { DataContextValue } from '../DataContext'
import { upsert } from '../dataHelpers'
import { localDateStr } from '../../lib/format'

/**
 * Transfers, retirement, rebalancing targets, planned assets and history snapshots.
 * Each action takes the current data plus the arguments useData() exposes and returns the next data.
 */
export function upsertTransfer(prev: SpendiaryData, ...[transfer]: Parameters<DataContextValue['upsertTransfer']>): SpendiaryData {
  return { ...prev, transfers: upsert(prev.transfers, transfer) }
}

export function removeTransfer(prev: SpendiaryData, ...[id]: Parameters<DataContextValue['removeTransfer']>): SpendiaryData {
  return { ...prev, transfers: prev.transfers.filter((t) => t.id !== id) }
}

export function setRetirement(prev: SpendiaryData, ...[retirement]: Parameters<DataContextValue['setRetirement']>): SpendiaryData {
  return { ...prev, retirement }
}

export function setRebalanceMode(prev: SpendiaryData, ...[rebalanceMode]: Parameters<DataContextValue['setRebalanceMode']>): SpendiaryData {
  return { ...prev, rebalanceMode }
}

export function setRebalanceTargets(prev: SpendiaryData, ...[rebalanceTargets]: Parameters<DataContextValue['setRebalanceTargets']>): SpendiaryData {
  return { ...prev, rebalanceTargets }
}

export function setRebalanceHoldingTargets(prev: SpendiaryData, ...[rebalanceHoldingTargets]: Parameters<DataContextValue['setRebalanceHoldingTargets']>): SpendiaryData {
  return { ...prev, rebalanceHoldingTargets }
}

export function upsertPlannedAsset(prev: SpendiaryData, ...[asset]: Parameters<DataContextValue['upsertPlannedAsset']>): SpendiaryData {
  return { ...prev, plannedAssets: upsert(prev.plannedAssets ?? [], asset) }
}

export function removePlannedAsset(prev: SpendiaryData, ...[id]: Parameters<DataContextValue['removePlannedAsset']>): SpendiaryData {
  const { [id]: _, ...restTargets } = prev.rebalanceHoldingTargets ?? {}
  return {
    ...prev,
    plannedAssets: (prev.plannedAssets ?? []).filter((a) => a.id !== id),
    rebalanceHoldingTargets: restTargets,
  }
}

export function recordNetWorthSnapshot(prev: SpendiaryData, ...[value]: Parameters<DataContextValue['recordNetWorthSnapshot']>): SpendiaryData {
  if (value <= 0) return prev
  const today = localDateStr()
  const existing = prev.netWorthHistory ?? []
  // Replace today's entry (prices may have updated) and keep last 365
  const updated = [...existing.filter((s: NetWorthSnapshot) => s.date !== today), { date: today, value }]
    .sort((a: NetWorthSnapshot, b: NetWorthSnapshot) => a.date.localeCompare(b.date))
    .slice(-365)
  return { ...prev, netWorthHistory: updated }
}

export function recordPortfolioSnapshot(prev: SpendiaryData, ...[value]: Parameters<DataContextValue['recordPortfolioSnapshot']>): SpendiaryData {
  if (value <= 0) return prev
  const today = localDateStr()
  const existing = prev.portfolioHistory ?? []
  const updated = [...existing.filter((s: NetWorthSnapshot) => s.date !== today), { date: today, value }]
    .sort((a: NetWorthSnapshot, b: NetWorthSnapshot) => a.date.localeCompare(b.date))
    .slice(-365)
  return { ...prev, portfolioHistory: updated }
}

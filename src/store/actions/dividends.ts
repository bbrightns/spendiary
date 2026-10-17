import type { SpendiaryData } from '../../lib/types'
import type { DataContextValue } from '../DataContext'

/**
 * Dividend records (recording one still lives in DataContext).
 * Each action takes the current data plus the arguments useData() exposes and returns the next data.
 */
export function removeDividendRecord(prev: SpendiaryData, ...[recordId]: Parameters<DataContextValue['removeDividendRecord']>): SpendiaryData {
  const records = prev.dividendRecords ?? []
  const target = records.find((r) => r.id === recordId)
  if (!target) return prev

  // Revert cash balance if deposited
  const oldAccounts = prev.cashAccounts ?? []
  const updatedCashAccounts = target.cashAccountId
    ? oldAccounts.map((a) =>
        a.id === target.cashAccountId
          ? { ...a, balance: Math.max(0, a.balance - target.netAmount) }
          : a,
      )
    : oldAccounts

  const updatedRecords = records.filter((r) => r.id !== recordId)
  const updatedLogs = (prev.holdingLogs ?? []).filter(
    (l) => l.dividendRecordId !== recordId,
  )

  return {
    ...prev,
    cashAccounts: updatedCashAccounts,
    dividendRecords: updatedRecords,
    holdingLogs: updatedLogs,
  }
}

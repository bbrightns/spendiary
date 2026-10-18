import type { DividendRecord, HoldingLog, SpendiaryData } from '../../lib/types'
import type { DataContextValue } from '../DataContext'
import { newId } from '../migrate'

/**
 * Dividend records: recording a payout and removing one.
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

/** Record a payout under the given id (made by the caller, so it can hand the id back for undo). */
export function recordDividend(
  prev: SpendiaryData,
  record: Parameters<DataContextValue['recordDividend']>[0],
  id: string,
): SpendiaryData {
  const now = new Date().toISOString()
  const oldAccounts = prev.cashAccounts ?? []
  const cashAcc = record.cashAccountId
    ? oldAccounts.find((a) => a.id === record.cashAccountId)
    : undefined

  // 1. Credit cash account if specified
  const updatedCashAccounts = cashAcc
    ? oldAccounts.map((a) =>
        a.id === cashAcc.id
          ? { ...a, balance: a.balance + record.netAmount }
          : a,
      )
    : oldAccounts

  // 2. Create DividendRecord
  const newRecord: DividendRecord = {
    ...record,
    id,
    cashAccountName: cashAcc ? cashAcc.name : record.cashAccountName,
    createdAt: now,
  }

  // 3. Create Activity HoldingLog
  const logEntry: HoldingLog = {
    id: newId(),
    timestamp: now,
    action: 'dividend',
    holdingId: record.holdingId,
    holdingName: record.holdingName,
    ticker: record.ticker,
    assetClass: record.assetClass,
    note: `Received dividend ฿${record.netAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (DPS: ฿${record.dps.toLocaleString()}, Tax 10%: -฿${record.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) into ${cashAcc ? cashAcc.name : 'Cash'}`,
    previousCashAccountsState: oldAccounts,
    afterCashAccountsState: updatedCashAccounts,
    cashAccountId: record.cashAccountId,
    dividendPerShare: record.dps,
    grossDividend: record.grossAmount,
    withholdingTax: record.taxAmount,
    netDividend: record.netAmount,
    dividendRecordId: id,
  }

  return {
    ...prev,
    cashAccounts: updatedCashAccounts,
    dividendRecords: [newRecord, ...(prev.dividendRecords ?? [])],
    holdingLogs: [logEntry, ...(prev.holdingLogs ?? [])],
  }
}

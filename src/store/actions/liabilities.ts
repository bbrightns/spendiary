import type { SpendiaryData, HoldingLog } from '../../lib/types'
import type { DataContextValue } from '../DataContext'
import { newId } from '../migrate'
import { upsert } from '../dataHelpers'
import { localDateStr } from '../../lib/format'

/**
 * Debts and loans: add, remove, pay an installment, undo a payment.
 * Each action takes the current data plus the arguments useData() exposes and returns the next data.
 */
export function upsertLiability(prev: SpendiaryData, ...[item]: Parameters<DataContextValue['upsertLiability']>): SpendiaryData {
  const isEdit = item.id && (prev.liabilities ?? []).some((x) => x.id === item.id)
  const updatedItems = upsert(prev.liabilities ?? [], {
    ...item,
    updatedAt: localDateStr(),
  })
  const logEntry: HoldingLog = {
    id: newId(),
    timestamp: new Date().toISOString(),
    action: isEdit ? 'edit' : 'add',
    holdingName: `Liability: ${item.name}`,
    ticker: 'DEBT',
    assetClass: 'cash',
    note: isEdit
      ? `Updated liability "${item.name}" balance to ฿${item.balance.toLocaleString()}`
      : `Added liability "${item.name}" with balance ฿${item.balance.toLocaleString()}`,
  }
  return {
    ...prev,
    liabilities: updatedItems,
    holdingLogs: [logEntry, ...(prev.holdingLogs ?? [])],
  }
}

export function removeLiability(prev: SpendiaryData, ...[id]: Parameters<DataContextValue['removeLiability']>): SpendiaryData {
  const item = (prev.liabilities ?? []).find((x) => x.id === id)
  if (!item) return prev
  const updatedItems = (prev.liabilities ?? []).filter((x) => x.id !== id)
  const logEntry: HoldingLog = {
    id: newId(),
    timestamp: new Date().toISOString(),
    action: 'sell',
    holdingName: `Liability: ${item.name}`,
    ticker: 'DEBT',
    assetClass: 'cash',
    note: `Paid off / removed liability "${item.name}" (฿${item.balance.toLocaleString()})`,
  }
  return {
    ...prev,
    liabilities: updatedItems,
    holdingLogs: [logEntry, ...(prev.holdingLogs ?? [])],
  }
}

export function setLiabilities(prev: SpendiaryData, ...[liabilities]: Parameters<DataContextValue['setLiabilities']>): SpendiaryData {
  return { ...prev, liabilities }
}

export function payLiabilityInstallment(prev: SpendiaryData, ...[id, amount]: Parameters<DataContextValue['payLiabilityInstallment']>): SpendiaryData {
  const item = (prev.liabilities ?? []).find((x) => x.id === id)
  if (!item) return prev

  const currentPaid = item.paidInstallments ?? 0
  const totalInst = item.totalInstallments
  const nextPaid = currentPaid + 1
  
  // Determine installment payment amount
  let paymentAmount = amount && amount > 0 ? amount : item.monthlyPayment ?? 0
  if (paymentAmount <= 0) {
    const remainingInst = Math.max(1, (totalInst ?? 1) - currentPaid)
    paymentAmount = Math.round(item.balance / remainingInst)
  }

  const newBalance = Math.max(0, item.balance - paymentAmount)
  // Local date: toISOString() is UTC, which in Thailand is still yesterday before 7am
  const todayStr = localDateStr()

  const updatedItems = (prev.liabilities ?? []).map((x) =>
    x.id === id
      ? {
          ...x,
          balance: newBalance,
          paidInstallments: nextPaid,
          lastPaidDate: todayStr,
          // What actually came off (the balance can't go below 0)
          lastPaidAmount: item.balance - newBalance,
          updatedAt: todayStr,
        }
      : x,
  )

  const logEntry: HoldingLog = {
    id: newId(),
    timestamp: new Date().toISOString(),
    action: 'edit',
    holdingName: `Liability: ${item.name}`,
    ticker: 'DEBT',
    assetClass: 'cash',
    note: `Paid installment ${nextPaid}${totalInst ? `/${totalInst}` : ''} for "${item.name}" (฿${paymentAmount.toLocaleString()})`,
  }

  return {
    ...prev,
    liabilities: updatedItems,
    holdingLogs: [logEntry, ...(prev.holdingLogs ?? [])],
  }
}

export function undoLiabilityPayment(prev: SpendiaryData, ...[id]: Parameters<DataContextValue['undoLiabilityPayment']>): SpendiaryData {
  const item = (prev.liabilities ?? []).find((x) => x.id === id)
  if (!item || (item.paidInstallments ?? 0) <= 0) return prev

  const prevPaid = Math.max(0, (item.paidInstallments ?? 1) - 1)
  // Put back what the payment took off; older records without it fall back to the monthly amount
  const paymentAmount = item.lastPaidAmount ?? item.monthlyPayment ?? 0
  const restoredBalance = item.originalBalance
    ? Math.min(item.originalBalance, item.balance + paymentAmount)
    : item.balance + paymentAmount

  const todayStr = localDateStr()

  const updatedItems = (prev.liabilities ?? []).map((x) =>
    x.id === id
      ? {
          ...x,
          balance: restoredBalance,
          paidInstallments: prevPaid,
          lastPaidDate: undefined,
          lastPaidAmount: undefined,
          updatedAt: todayStr,
        }
      : x,
  )

  const logEntry: HoldingLog = {
    id: newId(),
    timestamp: new Date().toISOString(),
    action: 'edit',
    holdingName: `Liability: ${item.name}`,
    ticker: 'DEBT',
    assetClass: 'cash',
    note: `Undid installment payment for "${item.name}" (reverted to ${prevPaid} paid, balance ฿${restoredBalance.toLocaleString()})`,
  }

  return {
    ...prev,
    liabilities: updatedItems,
    holdingLogs: [logEntry, ...(prev.holdingLogs ?? [])],
  }
}

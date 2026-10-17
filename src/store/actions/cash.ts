import type { SpendiaryData, HoldingLog } from '../../lib/types'
import type { DataContextValue } from '../DataContext'
import { newId } from '../migrate'

/**
 * Cash accounts, income and the profile name.
 * Each action takes the current data plus the arguments useData() exposes and returns the next data.
 */
export function setCashAccounts(prev: SpendiaryData, ...[cashAccounts]: Parameters<DataContextValue['setCashAccounts']>): SpendiaryData {
  const changes: string[] = []
  const oldAccounts = prev.cashAccounts ?? []
  
  for (const oldAcc of oldAccounts) {
    const newAcc = cashAccounts.find((a) => a.id === oldAcc.id)
    if (!newAcc) {
      const oldSymbol = (oldAcc.currency ?? 'THB') === 'USD' ? '$' : '฿'
      changes.push(`Removed "${oldAcc.name}" (${oldSymbol}${oldAcc.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })})`)
    } else {
      const oldCurr = oldAcc.currency ?? 'THB'
      const newCurr = newAcc.currency ?? 'THB'
      const symbol = newCurr === 'USD' ? '$' : '฿'
      const nameChanged = newAcc.name !== oldAcc.name
      const balanceChanged = newAcc.balance !== oldAcc.balance
      const currChanged = newCurr !== oldCurr

      if (nameChanged || balanceChanged || currChanged) {
        const diff = newAcc.balance - oldAcc.balance
        const diffSign = diff > 0 ? '+' : '-'
        const diffFormatted = `${diffSign}${symbol}${Math.abs(diff).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
        const diffSuffix = balanceChanged && !currChanged ? ` (${diffFormatted})` : ''

        if (nameChanged && balanceChanged) {
          changes.push(`Renamed "${oldAcc.name}" to "${newAcc.name}" and set balance to ${symbol}${newAcc.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}${diffSuffix}`)
        } else if (currChanged && balanceChanged) {
          changes.push(`Changed "${oldAcc.name}" currency to ${newCurr} and set balance to ${symbol}${newAcc.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}`)
        } else if (nameChanged) {
          changes.push(`Renamed "${oldAcc.name}" to "${newAcc.name}"`)
        } else if (currChanged) {
          changes.push(`Changed "${oldAcc.name}" currency to ${newCurr}`)
        } else if (balanceChanged) {
          changes.push(`Updated "${oldAcc.name}" balance to ${symbol}${newAcc.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}${diffSuffix}`)
        }
      }
    }
  }
  
  for (const newAcc of cashAccounts) {
    if (!oldAccounts.some((a) => a.id === newAcc.id)) {
      const symbol = (newAcc.currency ?? 'THB') === 'USD' ? '$' : '฿'
      changes.push(`Added "${newAcc.name}" with balance ${symbol}${newAcc.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}`)
    }
  }
  
  if (changes.length === 0) {
    return { ...prev, cashAccounts }
  }
  
  const isOnlyAdd = changes.length > 0 && changes.every((c) => c.startsWith('Added "'))

  const logEntry: HoldingLog = {
    id: newId(),
    timestamp: new Date().toISOString(),
    action: isOnlyAdd ? 'add' : 'edit',
    holdingName: 'Cash Accounts',
    ticker: 'CASH',
    assetClass: 'cash',
    note: changes.join(', '),
    previousCashAccountsState: oldAccounts,
    afterCashAccountsState: cashAccounts,
  }
  
  return {
    ...prev,
    cashAccounts,
    holdingLogs: [logEntry, ...(prev.holdingLogs ?? [])],
  }
}

export function setMonthlyIncome(prev: SpendiaryData, ...[monthlyIncome]: Parameters<DataContextValue['setMonthlyIncome']>): SpendiaryData {
  return { ...prev, monthlyIncome }
}

export function setUserName(prev: SpendiaryData, ...[userName]: Parameters<DataContextValue['setUserName']>): SpendiaryData {
  return { ...prev, userName }
}

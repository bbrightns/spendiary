import { describe, expect, it } from 'vitest'
import type { CashAccount, SpendiaryData } from '../../lib/types'
import { emptyData } from '../migrate'
import { setCashAccounts, setMonthlyIncome, setUserName } from './cash'
import { undoHoldingLog } from './holdingLogs'

const bank: CashAccount = { id: 'bank', name: 'Bank', balance: 1000 }
const state = (over: Partial<SpendiaryData> = {}): SpendiaryData => ({ ...emptyData, cashAccounts: [bank], ...over })

describe('setCashAccounts', () => {
  it('saves without a log when nothing changed', () => {
    const out = setCashAccounts(state(), [{ ...bank }])
    expect(out.cashAccounts).toEqual([bank])
    expect(out.holdingLogs).toBeUndefined()
  })

  it('logs an added account as an add', () => {
    const out = setCashAccounts(state(), [bank, { id: 'usd', name: 'Dime', balance: 50, currency: 'USD' }])
    expect(out.holdingLogs?.[0]).toMatchObject({ action: 'add', ticker: 'CASH', assetClass: 'cash' })
    expect(out.holdingLogs?.[0].note).toContain('Added "Dime" with balance $50')
  })

  it('logs edits and removals with the before and after lists', () => {
    const out = setCashAccounts(state({ cashAccounts: [bank, { id: 'old', name: 'Old', balance: 5 }] }), [{ ...bank, balance: 1500 }])
    const log = out.holdingLogs?.[0]
    expect(log?.action).toBe('edit')
    expect(log?.note).toContain('Updated "Bank" balance to ฿1,500 (+฿500)')
    expect(log?.note).toContain('Removed "Old"')
    expect(log?.previousCashAccountsState).toHaveLength(2)
    expect(log?.afterCashAccountsState).toEqual([{ ...bank, balance: 1500 }])
  })

  it('describes a rename and a currency change', () => {
    const renamed = setCashAccounts(state(), [{ ...bank, name: 'KBank' }]).holdingLogs?.[0].note
    expect(renamed).toBe('Renamed "Bank" to "KBank"')
    const usd = setCashAccounts(state(), [{ ...bank, currency: 'USD' }]).holdingLogs?.[0].note
    expect(usd).toBe('Changed "Bank" currency to USD')
  })

  it('undoes only its own change, keeping later balance moves', () => {
    const edited = setCashAccounts(state(), [{ ...bank, balance: 1500 }])
    // A Spend expense moves the balance after the edit
    const later = { ...edited, cashAccounts: [{ ...bank, balance: 1400 }] }
    const undone = undoHoldingLog(later, edited.holdingLogs![0].id)
    expect(undone.cashAccounts).toEqual([{ ...bank, balance: 900 }])
    expect(undone.holdingLogs).toEqual([])
  })
})

describe('setMonthlyIncome / setUserName', () => {
  it('sets the value and keeps the rest', () => {
    expect(setMonthlyIncome(state(), 50_000)).toMatchObject({ monthlyIncome: 50_000, cashAccounts: [bank] })
    expect(setUserName(state(), 'Bright').userName).toBe('Bright')
  })
})

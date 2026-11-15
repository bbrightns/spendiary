import { describe, expect, it } from 'vitest'
import type { SpendiaryData } from '../../lib/types'
import { emptyData } from '../migrate'
import { recordDividend, removeDividendRecord } from './dividends'

const record = (netAmount: number) => ({
  holdingId: 'h1',
  holdingName: 'PTT',
  ticker: 'PTT',
  assetClass: 'fund' as const,
  paymentDate: '2026-11-10',
  dps: 1,
  shares: 1,
  grossAmount: netAmount,
  taxRate: 0,
  taxAmount: 0,
  netAmount,
  cashAccountId: 'bank',
})
const state = (balance: number): SpendiaryData => ({ ...emptyData, cashAccounts: [{ id: 'bank', name: 'Bank', balance }] })

describe('dividends keep the cash balance in whole satang', () => {
  it('receiving a dividend adds without float noise', () => {
    // 0.1 + 0.2 is 0.30000000000000004 in floating point
    expect(recordDividend(state(0.1), record(0.2), 'd1').cashAccounts[0].balance).toBe(0.3)
    expect(recordDividend(state(1000.1), record(89.91), 'd1').cashAccounts[0].balance).toBe(1090.01)
  })

  it('removing the record takes exactly the same amount back', () => {
    const paid = recordDividend(state(0.1), record(0.2), 'd1')
    expect(removeDividendRecord(paid, 'd1').cashAccounts[0].balance).toBe(0.1)
  })
})

// Current behaviour, kept on purpose until it's decided (docs/overnight-report-2026-11-15.md, "Needs decision")
describe('removing a dividend whose money was already spent', () => {
  it('stops the account at 0 instead of going negative', () => {
    const paid = recordDividend(state(0), record(100), 'd1')
    const spent = { ...paid, cashAccounts: [{ ...paid.cashAccounts[0], balance: 20 }] }
    expect(removeDividendRecord(spent, 'd1').cashAccounts[0].balance).toBe(0)
  })
})


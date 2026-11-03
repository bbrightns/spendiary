import { describe, expect, it } from 'vitest'
import type { CashAccount, Holding, SpendiaryData } from './types'
import { emptyData } from '../store/migrate'
import { buyMoreHolding, sellHolding } from '../store/actions/holdings'
import { logCashStates, logHoldingStates } from './logStates'
import { getLogTransactionDetails } from './activitySummary'

const fund = { id: 'f1', name: 'S&P 500', ticker: 'SPX', assetClass: 'fund', units: 100, totalUnits: 100, avgCost: 10, avgCostThb: 10, price: 12, totalThbInvested: 1000 } as Holding
const bank: CashAccount = { id: 'bank', name: 'Bank', balance: 10_000 }
const state = (over: Partial<SpendiaryData> = {}): SpendiaryData => ({ ...emptyData, holdings: [fund], cashAccounts: [bank], holdingLogs: [], ...over })

describe('trade history from entries without snapshots', () => {
  it('rebuilds the holding before and after a buy from its delta', () => {
    const out = buyMoreHolding(state(), { updatedHolding: { ...fund, units: 110, totalUnits: 110, totalThbInvested: 1120, avgCost: 1120 / 110 }, cashAccountId: 'bank', cashDeductAmount: 120, note: '+10' })
    const log = out.holdingLogs![0]
    const { prev, curr } = logHoldingStates(log)
    expect(prev).toMatchObject({ units: 100, totalThbInvested: 1000, avgCost: 10, name: 'S&P 500' })
    expect(curr).toMatchObject({ units: 110, totalThbInvested: 1120 })
    expect(logCashStates(log)).toEqual({
      prev: [{ id: 'bank', name: 'Bank', balance: 10_000, currency: 'THB' }],
      curr: [{ id: 'bank', name: 'Bank', balance: 9880, currency: 'THB' }],
    })
  })

  it('still shows units and amount of a sale in the trade table', () => {
    const out = sellHolding(state(), {
      holdingId: 'f1', soldUnits: 40, soldPrice: 12, proceeds: 480, realizedPnL: 80, realizedPnLPercent: 20, note: 'Sold 40 units',
      remainingHolding: { ...fund, units: 60, totalUnits: 60, totalThbInvested: 600 },
    })
    const tx = getLogTransactionDetails(out.holdingLogs![0], null)
    expect(tx.sharesDisplay).toContain('40')
    expect(tx.amountThbValue).toBe(480)
  })
})

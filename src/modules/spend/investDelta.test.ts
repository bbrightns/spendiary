import { describe, expect, it } from 'vitest'
import type { CashAccount, DcaPlan, Holding, SpendiaryData } from '../../lib/types'
import { emptyData } from '../../store/migrate'
import { confirmDcaBuy } from '../../store/actions/dca'
import { investTransactions } from './invest'

const fund = { id: 'f1', name: 'S&P 500', ticker: 'SPX', assetClass: 'fund', units: 100, totalUnits: 100, avgCost: 10, avgCostThb: 10, price: 12, totalThbInvested: 1000 } as Holding
const bank: CashAccount = { id: 'bank', name: 'Bank', balance: 10_000 }
const state = (over: Partial<SpendiaryData> = {}): SpendiaryData => ({ ...emptyData, holdings: [fund], cashAccounts: [bank], holdingLogs: [], ...over })

describe('Spend from trade entries without snapshots', () => {
  it('counts a DCA buy and a savings DCA in Spend from the delta', () => {
    const buyPlan = { id: 'p1', name: 'Monthly S&P', assetClass: 'fund', monthlyAmount: 5000, dayOfMonth: 1, holdingId: 'f1' } as DcaPlan
    const savePlan = { id: 'p2', name: 'Savings', assetClass: 'cash', monthlyAmount: 1000, dayOfMonth: 1, cashAccountId: 'save' } as DcaPlan
    let s = state({ dcaPlans: [buyPlan, savePlan], cashAccounts: [bank, { id: 'save', name: 'Savings', balance: 0 }] })
    s = confirmDcaBuy(s, 'p1', 25, '2026-11-01', undefined, undefined, undefined, undefined, undefined, { unitsBought: 200, amountSpentThb: 5000, nav: 25 })
    s = confirmDcaBuy(s, 'p2', 1000, '2026-11-01', undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, { accountId: 'bank', amount: 1000 })
    expect(s.holdingLogs!.every((l) => !l.previousHoldingState && !l.afterCashAccountsState)).toBe(true)
    const rows = investTransactions(s, null)
    expect(rows.find((r) => r.note === 'Monthly S&P')).toMatchObject({ amount: 5000 })
    expect(rows.find((r) => r.note === 'Savings')).toMatchObject({ amount: 1000, accountId: 'bank', toAccountId: 'save' })
  })
})

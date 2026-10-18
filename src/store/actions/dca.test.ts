import { describe, expect, it } from 'vitest'
import type { CashAccount, DcaPlan, Holding, SpendiaryData } from '../../lib/types'
import { emptyData } from '../migrate'
import { confirmDcaBuy, skipDcaBuy, undoDcaBuy, unskipDcaBuy } from './dca'

const plan = { id: 'p1', name: 'Bitcoin', assetClass: 'crypto', monthlyAmount: 300, dayOfMonth: 1 } as DcaPlan
const state = (): SpendiaryData => ({ ...emptyData, dcaPlans: [plan], holdingLogs: [] })

describe('unskipDcaBuy', () => {
  it('undoes a skip: the date and its log entry are gone', () => {
    const skipped = skipDcaBuy(state(), 'p1', '2026-10-18')
    expect(skipped.dcaPlans[0].skippedDates).toEqual(['2026-10-18'])
    expect(skipped.holdingLogs).toHaveLength(1)

    const back = unskipDcaBuy(skipped, 'p1', '2026-10-18')
    expect(back.dcaPlans[0].skippedDates).toEqual([])
    expect(back.holdingLogs).toEqual([])
  })

  it('leaves other days and other plans alone', () => {
    let s = skipDcaBuy(state(), 'p1', '2026-10-17')
    s = skipDcaBuy(s, 'p1', '2026-10-18')
    const back = unskipDcaBuy(s, 'p1', '2026-10-18')
    expect(back.dcaPlans[0].skippedDates).toEqual(['2026-10-17'])
    expect(back.holdingLogs).toHaveLength(1)
    expect(back.holdingLogs?.[0].dcaDate).toBe('2026-10-17')
  })

  it('does nothing when that day was not skipped', () => {
    const s = state()
    expect(unskipDcaBuy(s, 'p1', '2026-10-18')).toBe(s)
  })
})

describe('undoDcaBuy', () => {
  const fund = { id: 'h1', name: 'S&P 500', ticker: 'SPX', assetClass: 'fund', units: 100, totalUnits: 100, totalThbInvested: 10000, avgCost: 100, avgCostThb: 100, price: 110 } as Holding
  const bank: CashAccount = { id: 'bank', name: 'Bank', balance: 5000 }
  const fundPlan = { id: 'p2', name: 'S&P 500', ticker: 'SPX', assetClass: 'fund', monthlyAmount: 1000, dayOfMonth: 1, holdingId: 'h1' } as DcaPlan
  const start = (): SpendiaryData => ({ ...emptyData, dcaPlans: [fundPlan], holdings: [fund], cashAccounts: [bank], holdingLogs: [] })
  const buy = (s: SpendiaryData) =>
    confirmDcaBuy(s, 'p2', 100, '2026-10-18', undefined, undefined, 100, undefined, undefined, undefined,
      { unitsBought: 10, amountSpentThb: 1000, nav: 100 }, 'h1', undefined, undefined, { accountId: 'bank', amount: 1000 })

  it('puts the holding, the cash and the plan back', () => {
    const bought = buy(start())
    expect(bought.holdings[0].units).toBe(110)
    expect(bought.cashAccounts[0].balance).toBe(4000)

    const back = undoDcaBuy(bought, 'p2', '2026-10-18')
    expect(back.holdings[0].units).toBe(100)
    expect(back.holdings[0].totalThbInvested).toBe(10000)
    expect(back.cashAccounts[0].balance).toBe(5000)
    expect(back.dcaPlans[0].confirmedDates).toEqual([])
    expect(back.holdingLogs).toEqual([])
  })

  it('does nothing when no buy was logged that day', () => {
    const s = start()
    expect(undoDcaBuy(s, 'p2', '2026-10-18')).toBe(s)
  })
})

import { describe, expect, it } from 'vitest'
import type { CashAccount, DcaPlan, Holding, SpendiaryData } from '../../lib/types'
import { emptyData } from '../migrate'
import { confirmDcaBuy } from './dca'
import { undoHoldingLog } from './holdingLogs'

const fundPlan: DcaPlan = { id: 'p1', name: 'SCB S&P 500', assetClass: 'fund', monthlyAmount: 5000, dayOfMonth: 10, holdingId: 'f1' }
const fund = { id: 'f1', name: 'SCB S&P 500', ticker: 'SCBS&P500', assetClass: 'fund', units: 100, avgCost: 20, price: 22, totalThbInvested: 2000 } as Holding
const bank: CashAccount = { id: 'bank', name: 'Bank', balance: 50_000 }

const state = (over: Partial<SpendiaryData> = {}): SpendiaryData => ({
  ...emptyData, dcaPlans: [fundPlan], holdings: [fund], cashAccounts: [bank], ...over,
})
const confirm = (prev: SpendiaryData, ...rest: Parameters<typeof confirmDcaBuy> extends [SpendiaryData, ...infer R] ? R : never) =>
  confirmDcaBuy(prev, ...rest)

describe('confirmDcaBuy', () => {
  it('changes nothing for an unknown plan', () => {
    const before = state()
    expect(confirm(before, 'nope', 25, '2026-10-10')).toBe(before)
  })

  it('adds a fund buy from the units and NAV entered, and confirms the date', () => {
    const out = confirm(state(), 'p1', 25, '2026-10-10', undefined, undefined, undefined, undefined, undefined, undefined, { unitsBought: 200, amountSpentThb: 5000, nav: 25 })
    expect(out.holdings[0]).toMatchObject({ units: 300, totalThbInvested: 7000, avgCost: 7000 / 300, price: 25, updatedAt: '2026-10-10' })
    expect(out.dcaPlans[0].confirmedDates).toEqual(['2026-10-10'])
    expect(out.holdingLogs?.[0]).toMatchObject({ action: 'buy_more', holdingId: 'f1', dcaPlanId: 'p1', dcaDate: '2026-10-10' })
    expect(out.holdingLogs?.[0].previousHoldingState).toEqual(fund)
  })

  it('adds a US stock buy, keeping the THB and USD cost', () => {
    const aapl = { id: 's1', name: 'Apple', ticker: 'AAPL', assetClass: 'stock', units: 10, avgCost: 6000, avgCostUsd: 200, price: 7000, totalThbInvested: 60_000, totalUsdInvested: 2000 } as Holding
    const plan: DcaPlan = { id: 'p2', name: 'Apple', assetClass: 'stock', monthlyAmount: 7000, dayOfMonth: 1, holdingId: 's1' }
    const out = confirm(state({ holdings: [aapl], dcaPlans: [plan] }), 'p2', 0, '2026-10-01', undefined, undefined, undefined, undefined, undefined, { unitsBought: 1, amountSpentThb: 7000, fxRate: 35 })
    expect(out.holdings[0]).toMatchObject({ units: 11, totalThbInvested: 67_000, totalUsdInvested: 2200, avgCostUsd: 200, price: 7000 })
  })

  it('adds sats to a BTC location and works out the price paid', () => {
    const btc = { id: 'b1', name: 'Bitcoin', ticker: 'BTC', assetClass: 'crypto', units: 0.01, avgCost: 2_000_000, price: 3_000_000, totalThbInvested: 20_000, btcLocations: [{ id: 'ex', name: 'Exchange', satoshi: 1_000_000, thbSpent: 20_000 }] } as Holding
    const plan: DcaPlan = { id: 'p3', name: 'Bitcoin', assetClass: 'crypto', monthlyAmount: 3000, dayOfMonth: 1, holdingId: 'b1' }
    const out = confirm(state({ holdings: [btc], dcaPlans: [plan] }), 'p3', 0, '2026-10-01', undefined, undefined, undefined,
      { id: 'ex', name: 'Exchange', satoshi: 1_100_000, thbSpent: 23_000 }, undefined, undefined, undefined, undefined, { satsBought: 100_000, amountSpentThb: 3000 })
    expect(out.holdings[0]).toMatchObject({ units: 0.011, totalThbInvested: 23_000, price: 3_000_000 })
    expect(out.holdings[0].btcLocations).toEqual([{ id: 'ex', name: 'Exchange', satoshi: 1_100_000, thbSpent: 23_000 }])
  })

  it('creates the holding when the plan has none yet, and logs it as an add', () => {
    const out = confirm(state({ holdings: [], dcaPlans: [{ ...fundPlan, holdingId: undefined }] }), 'p1', 25, '2026-10-10', undefined, undefined, undefined, undefined, undefined, undefined, { unitsBought: 200, amountSpentThb: 5000, nav: 25 })
    expect(out.holdings).toHaveLength(1)
    expect(out.holdings[0]).toMatchObject({ name: 'SCB S&P 500', units: 200, totalThbInvested: 5000 })
    expect(out.dcaPlans[0].holdingId).toBe(out.holdings[0].id)
    expect(out.holdingLogs?.[0].action).toBe('add')
  })

  it('only confirms the date when there is no holding and nothing to buy', () => {
    const out = confirm(state({ holdings: [], dcaPlans: [{ ...fundPlan, holdingId: undefined }] }), 'p1', 0, '2026-10-10')
    expect(out.holdings).toEqual([])
    expect(out.holdingLogs?.[0]).toMatchObject({ ticker: 'DCA', note: 'Confirmed DCA buy of ฿5,000 (No linked holding)' })
  })

  it('deposits into the linked account for a savings plan', () => {
    const plan: DcaPlan = { id: 'p4', name: 'Savings', assetClass: 'cash', monthlyAmount: 2000, dayOfMonth: 1, cashAccountId: 'save' }
    const out = confirm(state({ dcaPlans: [plan], cashAccounts: [bank, { id: 'save', name: 'Savings', balance: 100 }] }), 'p4', 0, '2026-10-01')
    expect(out.cashAccounts.find((a) => a.id === 'save')?.balance).toBe(2100)
    expect(out.holdingLogs?.[0]).toMatchObject({ ticker: 'CASH', assetClass: 'cash' })
  })

  it('takes the payment out of the chosen account, and Undo gives everything back', () => {
    const before = state()
    const out = confirm(before, 'p1', 25, '2026-10-10', undefined, undefined, undefined, undefined, undefined, undefined, { unitsBought: 200, amountSpentThb: 5000, nav: 25 }, undefined, undefined, undefined, { accountId: 'bank', amount: 5000 })
    expect(out.cashAccounts[0].balance).toBe(45_000)
    expect(out.holdingLogs?.[0]).toMatchObject({ paidFromAccountId: 'bank', paidAmount: 5000 })
    const undone = undoHoldingLog(out, out.holdingLogs![0].id)
    expect(undone.cashAccounts[0].balance).toBe(50_000)
    expect(undone.holdings[0]).toMatchObject({ units: 100, totalThbInvested: 2000 })
    expect(undone.dcaPlans[0].confirmedDates).toEqual([])
  })

  it('ignores a payment from an account that does not exist', () => {
    const out = confirm(state(), 'p1', 25, '2026-10-10', undefined, undefined, undefined, undefined, undefined, undefined, { unitsBought: 200, amountSpentThb: 5000, nav: 25 }, undefined, undefined, undefined, { accountId: 'gone', amount: 5000 })
    expect(out.cashAccounts).toEqual([bank])
    expect(out.holdingLogs?.[0].paidFromAccountId).toBeUndefined()
  })
})

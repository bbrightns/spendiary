import { describe, expect, it } from 'vitest'
import type { CashAccount, HoldingLog } from './types'
import { ALL_TIME_PERIOD, summarizeActivity } from './activitySummary'

const usdWallet: CashAccount = { id: 'usd', name: 'Dime FCD', balance: 100, currency: 'USD' }
const bank: CashAccount = { id: 'bank', name: 'KBank', balance: 100 }

const dividend = (over: Partial<HoldingLog>): HoldingLog => ({
  id: 'd1', timestamp: '2026-11-10T03:00:00.000Z', action: 'dividend', holdingId: 's1', holdingName: 'Apple', ticker: 'AAPL', assetClass: 'stock',
  note: '', grossDividend: 100, withholdingTax: 15, netDividend: 85, ...over,
})
const paidInto = (acc: CashAccount) => ({ cashAccountId: acc.id, previousCashAccountsState: [acc], afterCashAccountsState: [{ ...acc, balance: acc.balance + 85 }] })
const sale: HoldingLog = {
  id: 's', timestamp: '2026-11-12T03:00:00.000Z', action: 'sell', holdingId: 's1', holdingName: 'Apple', ticker: 'AAPL', assetClass: 'stock',
  note: '', proceeds: 7_000, realizedPnL: 1_000, realizedPnLPercent: 16.67,
}

describe('summarizeActivity: dividends paid in dollars', () => {
  it('counts a US dividend paid into a USD account in baht, not as if dollars were baht', () => {
    const s = summarizeActivity([dividend(paidInto(usdWallet)), sale], ALL_TIME_PERIOD, 35)
    expect(s.dividendsGross).toBe(3_500)
    expect(s.withholdingTax).toBe(525)
    expect(s.dividendsNet).toBe(2_975)
    // 1,000 baht of profit on the sale + 85 dollars of dividend
    expect(s.netProfit).toBe(3_975)
    expect(s.rows[0]).toMatchObject({ dividendsNet: 2_975, net: 3_975 })
    expect(s.months[0]).toMatchObject({ dividendsNet: 2_975, net: 3_975 })
  })

  it('counts a US dividend with no account as dollars too', () => {
    expect(summarizeActivity([dividend({})], ALL_TIME_PERIOD, 35).dividendsNet).toBe(2_975)
  })

  it('takes the amount as baht when it went into a baht account (the amount is in the account\'s currency)', () => {
    expect(summarizeActivity([dividend(paidInto(bank))], ALL_TIME_PERIOD, 35).dividendsNet).toBe(85)
  })

  it('leaves a Thai fund dividend as it is', () => {
    const s = summarizeActivity([dividend({ assetClass: 'fund', ticker: 'PTT', ...paidInto(bank) })], ALL_TIME_PERIOD, 35)
    expect([s.dividendsGross, s.withholdingTax, s.dividendsNet]).toEqual([100, 15, 85])
  })

  it('leaves dollar dividends out of the baht totals while no rate has loaded, like dollar buys', () => {
    const s = summarizeActivity([dividend(paidInto(usdWallet)), sale], ALL_TIME_PERIOD, null)
    expect(s.dividendsNet).toBe(0)
    expect(s.netProfit).toBe(1_000)
    expect(s.dividendCount).toBe(1)
  })
})

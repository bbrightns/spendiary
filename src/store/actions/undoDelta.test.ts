import { describe, expect, it } from 'vitest'
import type { CashAccount, DcaPlan, Holding, SpendiaryData } from '../../lib/types'
import { buyInto, withLocations } from '../../lib/locations'
import { emptyData } from '../migrate'
import { addHoldingLog, undoHoldingLog, undoHoldingLogChecked } from './holdingLogs'
import { buyMoreHolding, removeLocation, sellHolding, upsertHolding } from './holdings'
import { confirmDcaBuy } from './dca'

const fund = (over: Partial<Holding> = {}): Holding =>
  ({ id: 'f1', name: 'S&P 500', ticker: 'SPX', assetClass: 'fund', units: 100, totalUnits: 100, avgCost: 10, avgCostThb: 10, price: 12, totalThbInvested: 1000, ...over }) as Holding
const bank: CashAccount = { id: 'bank', name: 'Bank', balance: 10_000 }
const state = (over: Partial<SpendiaryData> = {}): SpendiaryData => ({ ...emptyData, holdings: [fund()], cashAccounts: [bank], holdingLogs: [], ...over })

/** Adds a holding the way the holding form does */
const add = (s: SpendiaryData, h: Holding, before?: Holding) =>
  addHoldingLog(upsertHolding(s, h), {
    action: 'add', holdingId: h.id, holdingName: h.name, ticker: h.ticker, assetClass: h.assetClass, note: 'Added',
    afterHoldingState: h, ...(before ? { previousHoldingState: before } : {}),
  })
const buy = (s: SpendiaryData, id: string, units: number, thb: number, pay = false) => {
  const h = s.holdings.find((x) => x.id === id)!
  return buyMoreHolding(s, { updatedHolding: buyInto(h, undefined, units, thb).holding, note: 'buy', ...(pay ? { cashAccountId: 'bank', cashDeductAmount: thb } : {}) })
}
const sell = (s: SpendiaryData, id: string, units: number, deposit = 0) => {
  const h = s.holdings.find((x) => x.id === id)!
  const left = h.units - units
  const cost = (h.totalThbInvested ?? 0) * (units / h.units)
  return sellHolding(s, {
    holdingId: id, soldUnits: units, soldPrice: 12, proceeds: units * 12, realizedPnL: 0, realizedPnLPercent: 0, note: 'sold',
    remainingHolding: left > 0 ? { ...h, units: left, totalUnits: left, totalThbInvested: (h.totalThbInvested ?? 0) - cost } : null,
    ...(deposit ? { cashAccountId: 'bank', cashDepositAmount: deposit } : {}),
  })
}
const logOf = (s: SpendiaryData, action: string) => s.holdingLogs!.find((l) => l.action === action)!

describe('undo with a saved delta', () => {
  it('saves exactly what a buy did, cash included', () => {
    const out = buy(state(), 'f1', 10, 120, true)
    expect(logOf(out, 'buy_more').delta).toEqual({
      units: 10,
      thb: 120,
      before: { units: 100, thb: 1000, price: 12 },
      after: { units: 110, thb: 1120, price: 12 },
      cash: [{ accountId: 'bank', amount: -120, name: 'Bank', currency: 'THB', balanceAfter: 9880 }],
    })
  })

  it('undoes a buy and gives the exact money back, with no note to read', () => {
    const bought = buy(state(), 'f1', 10, 120, true)
    const noNote = { ...bought, holdingLogs: bought.holdingLogs!.map((l) => ({ ...l, note: '' })) }
    const back = undoHoldingLog(noNote, logOf(noNote, 'buy_more').id)
    expect(back.holdings[0]).toMatchObject({ units: 100, totalThbInvested: 1000 })
    expect(back.cashAccounts[0].balance).toBe(10_000)
  })

  it('keeps a later buy when an earlier one is undone', () => {
    const first = buy(state(), 'f1', 10, 120)
    const second = buy(first, 'f1', 5, 70)
    const firstLog = second.holdingLogs![1]
    expect(undoHoldingLog(second, firstLog.id).holdings[0]).toMatchObject({ units: 105, totalThbInvested: 1070 })
  })

  it('refuses to undo a buy whose units were sold since, and changes nothing', () => {
    const bought = buy(state({ holdings: [fund({ units: 0, totalUnits: 0, totalThbInvested: 0 })] }), 'f1', 10, 120)
    const sold = sell(bought, 'f1', 8)
    const r = undoHoldingLogChecked(sold, logOf(sold, 'buy_more').id)
    expect(r.ok).toBe(false)
    expect(undoHoldingLog(sold, logOf(sold, 'buy_more').id)).toBe(sold)
  })

  describe('add', () => {
    const spy = fund({ id: 'n1', name: 'Nasdaq', ticker: 'NDX', units: 50, totalUnits: 50, totalThbInvested: 500 })

    it('removes a holding it created when nothing was bought since', () => {
      const added = add(state(), spy)
      expect(logOf(added, 'add').delta).toMatchObject({ units: 50, thb: 500, holdingCreated: true })
      expect(undoHoldingLog(added, logOf(added, 'add').id).holdings.map((h) => h.id)).toEqual(['f1'])
    })

    it('keeps the holding and later buys, taking out only what the add put in', () => {
      const bought = buy(add(state(), spy), 'n1', 20, 220)
      const back = undoHoldingLog(bought, logOf(bought, 'add').id)
      expect(back.holdings.find((h) => h.id === 'n1')).toMatchObject({ units: 20, totalThbInvested: 220 })
    })

    it('takes a wallet merged into an existing BTC holding back out, keeping the rest', () => {
      const btc = withLocations({ id: 'b1', name: 'Bitcoin', ticker: 'BTC', assetClass: 'crypto', units: 0, avgCost: 0, price: 3_000_000 } as Holding,
        [{ id: 'cold', name: 'Ledger', qty: 0.3, thbSpent: 600_000 }])
      const merged = buyInto(btc, { name: 'Binance' }, 0.1, 250_000).holding
      const s = add(state({ holdings: [btc] }), merged, btc)
      const back = undoHoldingLog(s, logOf(s, 'add').id).holdings[0]
      expect(back.locations).toEqual([{ id: 'cold', name: 'Ledger', qty: 0.3, thbSpent: 600_000 }])
      expect(back).toMatchObject({ units: 0.3, totalThbInvested: 600_000 })
    })
  })

  describe('sell', () => {
    it('puts a partial sale back, with the money that came in', () => {
      const sold = sell(state(), 'f1', 40, 480)
      const back = undoHoldingLog(sold, logOf(sold, 'sell').id)
      expect(back.holdings[0]).toMatchObject({ units: 100, totalThbInvested: 1000 })
      expect(back.cashAccounts[0].balance).toBe(10_000)
    })

    it('brings back a holding the sale removed', () => {
      const sold = sell(state(), 'f1', 100, 1200)
      expect(sold.holdings).toEqual([])
      const back = undoHoldingLog(sold, logOf(sold, 'sell').id)
      expect(back.holdings).toHaveLength(1)
      expect(back.holdings[0]).toMatchObject({ id: 'f1', units: 100, totalThbInvested: 1000 })
    })

    it('merges into a holding of the same ticker added again since, instead of making a second one', () => {
      const sold = sell(state(), 'f1', 100)
      const readded = add(sold, fund({ id: 'f2', units: 30, totalUnits: 30, totalThbInvested: 330 }))
      const back = undoHoldingLog(readded, logOf(readded, 'sell').id)
      expect(back.holdings).toHaveLength(1)
      expect(back.holdings[0]).toMatchObject({ id: 'f2', units: 130, totalThbInvested: 1330 })
    })

    it('refuses when the broker it sold from was removed since', () => {
      const aapl = withLocations({ id: 's1', name: 'Apple', ticker: 'AAPL', assetClass: 'stock', units: 0, avgCost: 0, price: 7000 } as Holding, [
        { id: 'w', name: 'Webull', qty: 10, thbSpent: 60_000, usdSpent: 1700 },
        { id: 'd', name: 'Dime', qty: 5, thbSpent: 30_000, usdSpent: 850 },
      ])
      const s = state({ holdings: [aapl] })
      const left = withLocations(aapl, [{ id: 'w', name: 'Webull', qty: 6, thbSpent: 36_000, usdSpent: 1020 }, aapl.locations![1]])
      const sold = sellHolding(s, { holdingId: 's1', soldUnits: 4, soldPrice: 7000, proceeds: 28_000, realizedPnL: 4000, realizedPnLPercent: 16, note: 'sold', remainingHolding: left })
      expect(logOf(sold, 'sell').delta?.location).toEqual({ id: 'w', name: 'Webull', qty: -4, thb: -24_000, usd: -680 })
      expect(undoHoldingLog(sold, logOf(sold, 'sell').id).holdings[0].locations?.[0]).toMatchObject({ qty: 10, thbSpent: 60_000, usdSpent: 1700 })
      const gone = removeLocation(sold, 's1', 'w')
      expect(undoHoldingLogChecked(gone, logOf(gone, 'sell').id)).toMatchObject({ ok: false })
    })
  })

  it('undoes a savings DCA deposit and its payment exactly', () => {
    const plan = { id: 'p1', name: 'Savings', assetClass: 'cash', monthlyAmount: 1000, dayOfMonth: 1, cashAccountId: 'save' } as DcaPlan
    const s = state({ dcaPlans: [plan], cashAccounts: [bank, { id: 'save', name: 'Savings', balance: 0 }] })
    const done = confirmDcaBuy(s, 'p1', 1000, '2026-11-01', undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, { accountId: 'bank', amount: 1000 })
    expect(done.cashAccounts.map((a) => a.balance)).toEqual([9000, 1000])
    const back = undoHoldingLog(done, done.holdingLogs![0].id)
    expect(back.cashAccounts.map((a) => a.balance)).toEqual([10_000, 0])
    expect(back.dcaPlans[0].confirmedDates).toEqual([])
  })
})

describe('an add paid from a cash account', () => {
  const wallet: CashAccount = { id: 'usd', name: 'USD wallet', balance: 5_000, currency: 'USD' }
  const aapl = { id: 's1', name: 'Apple', ticker: 'AAPL', assetClass: 'stock', units: 10, totalUnits: 10, avgCost: 3_500, avgCostThb: 3_500, price: 3_500, totalThbInvested: 35_000, totalUsdInvested: 1_000 } as Holding
  const paidAdd = (s: SpendiaryData, accountId: string, amount: number) =>
    addHoldingLog(upsertHolding(s, aapl), {
      action: 'add', holdingId: aapl.id, holdingName: 'Apple', ticker: 'AAPL', assetClass: 'stock', note: 'Added',
      afterHoldingState: aapl, payment: { accountId, amount },
    })

  it('takes the amount out of the account and records it in the delta', () => {
    const out = paidAdd(state({ cashAccounts: [bank, wallet] }), 'usd', 1_000)
    expect(out.cashAccounts.find((c) => c.id === 'usd')!.balance).toBe(4_000)
    expect(out.cashAccounts.find((c) => c.id === 'bank')!.balance).toBe(10_000)
    const log = logOf(out, 'add')
    expect(log.cashAccountId).toBe('usd')
    expect(log.delta!.cash).toEqual([{ accountId: 'usd', amount: -1_000, name: 'USD wallet', currency: 'USD', balanceAfter: 4_000 }])
    expect(log).not.toHaveProperty('payment')
  })

  it('puts the money back on undo', () => {
    const out = paidAdd(state({ cashAccounts: [bank, wallet] }), 'usd', 1_000)
    const back = undoHoldingLog(out, logOf(out, 'add').id)
    expect(back.holdings.find((h) => h.id === 's1')).toBeUndefined()
    expect(back.cashAccounts.find((c) => c.id === 'usd')!.balance).toBe(5_000)
  })

  it('ignores a payment from an account that does not exist', () => {
    const out = paidAdd(state(), 'gone', 1_000)
    expect(out.cashAccounts).toEqual([bank])
    expect(logOf(out, 'add').delta!.cash).toBeUndefined()
    expect(logOf(out, 'add').cashAccountId).toBeUndefined()
  })
})

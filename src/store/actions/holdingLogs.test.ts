import { describe, expect, it } from 'vitest'
import type { CashAccount, DividendRecord, Holding, HoldingLog, SpendTransaction, SpendiaryData } from '../../lib/types'
import { emptyData } from '../migrate'
import { buyMoreHolding, sellHolding, transferLocation } from './holdings'
import {
  addHoldingLog,
  canUndoLog,
  removeHoldingLog,
  removeHoldingLogs,
  undoHoldingLog,
  undoHoldingLogChecked,
  updateHoldingLog,
  updateHoldingLogTimestamp,
} from './holdingLogs'

const apple = (over: Partial<Holding> = {}): Holding =>
  ({ id: 'h1', name: 'Apple', ticker: 'AAPL', assetClass: 'stock', units: 10, avgCost: 5000, price: 6000, totalThbInvested: 50_000, ...over }) as Holding

const bank: CashAccount = { id: 'bank', name: 'Bank', balance: 20_000 }

const state = (over: Partial<SpendiaryData> = {}): SpendiaryData => ({ ...emptyData, holdings: [apple()], cashAccounts: [bank], ...over })

const log = (over: Partial<HoldingLog>): HoldingLog =>
  ({ id: 'l1', timestamp: '2026-10-01T09:00:00.000Z', action: 'note', holdingName: 'Apple', ticker: 'AAPL', assetClass: 'stock', note: '', ...over }) as HoldingLog

const undoLatest = (d: SpendiaryData) => undoHoldingLog(d, d.holdingLogs![0].id)

describe('addHoldingLog', () => {
  it('fills in the id, time and holding, and snapshots the holding before a change', () => {
    const out = addHoldingLog(state(), { action: 'edit', holdingName: 'Apple', ticker: 'AAPL', assetClass: 'stock', note: 'Edited' })
    const entry = out.holdingLogs![0]
    expect(entry.id).toBeTruthy()
    expect(entry.timestamp).toBeTruthy()
    expect(entry.holdingId).toBe('h1')
    expect(entry.previousHoldingState).toEqual(apple())
  })

  it('takes no snapshot for an add or a note', () => {
    const out = addHoldingLog(state(), { action: 'note', holdingName: 'Apple', ticker: 'AAPL', assetClass: 'stock', note: 'Hi' })
    expect(out.holdingLogs![0].previousHoldingState).toBeUndefined()
  })

  it('keeps an id and time it was given, newest first', () => {
    const out = addHoldingLog(state({ holdingLogs: [log({ id: 'old' })] }), { id: 'new', timestamp: 'T', action: 'note', holdingName: 'A', ticker: 'A', assetClass: 'stock', note: '' })
    expect(out.holdingLogs!.map((l) => [l.id, l.timestamp])).toEqual([['new', 'T'], ['old', '2026-10-01T09:00:00.000Z']])
  })
})

describe('editing and removing logs', () => {
  const withLogs = state({ holdingLogs: [log({ id: 'a' }), log({ id: 'b' }), log({ id: 'c' })] })

  it('removes one or several', () => {
    expect(removeHoldingLog(withLogs, 'b').holdingLogs!.map((l) => l.id)).toEqual(['a', 'c'])
    expect(removeHoldingLogs(withLogs, ['a', 'c']).holdingLogs!.map((l) => l.id)).toEqual(['b'])
  })

  it('changes the time or the record of one log only', () => {
    expect(updateHoldingLogTimestamp(withLogs, 'b', 'X').holdingLogs!.map((l) => l.timestamp)).toEqual(['2026-10-01T09:00:00.000Z', 'X', '2026-10-01T09:00:00.000Z'])
    expect(updateHoldingLog(withLogs, 'c', { note: 'gift', source: 'received' }).holdingLogs![2]).toMatchObject({ id: 'c', note: 'gift', source: 'received' })
  })
})

describe('undoHoldingLog', () => {
  it('changes nothing for an unknown log', () => {
    const before = state()
    expect(undoHoldingLog(before, 'nope')).toBe(before)
  })

  it('undoes a partial sale: units, cost and the proceeds', () => {
    const sold = sellHolding(state(), {
      holdingId: 'h1', soldUnits: 4, soldPrice: 6000, proceeds: 24_000, realizedPnL: 4000, realizedPnLPercent: 20, note: 'Sold 4 shares',
      remainingHolding: apple({ units: 6, totalThbInvested: 30_000 }), cashAccountId: 'bank', cashDepositAmount: 24_000,
    })
    expect(sold.cashAccounts[0].balance).toBe(44_000)
    const undone = undoLatest(sold)
    expect(undone.holdings[0]).toMatchObject({ units: 10, totalThbInvested: 50_000, avgCost: 5000 })
    expect(undone.cashAccounts[0].balance).toBe(20_000)
    expect(undone.holdingLogs).toEqual([])
  })

  it('brings back a holding that was sold in full', () => {
    const sold = sellHolding(state(), { holdingId: 'h1', soldUnits: 10, soldPrice: 6000, proceeds: 60_000, realizedPnL: 10_000, realizedPnLPercent: 20, note: '' })
    expect(sold.holdings).toEqual([])
    expect(undoLatest(sold).holdings).toEqual([apple()])
  })

  it('undoes a buy: units, cost and the money paid', () => {
    const bought = buyMoreHolding(state(), {
      updatedHolding: apple({ units: 12, totalThbInvested: 62_000, avgCost: 62_000 / 12 }), cashAccountId: 'bank', cashDeductAmount: 12_000, note: '',
    })
    const undone = undoLatest(bought)
    expect(undone.holdings[0]).toMatchObject({ units: 10, totalThbInvested: 50_000, avgCost: 5000 })
    expect(undone.cashAccounts[0].balance).toBe(20_000)
  })

  it('removes a holding that the log added', () => {
    const added = state({ holdingLogs: [log({ action: 'add', holdingId: 'h1' })] })
    expect(undoLatest(added).holdings).toEqual([])
  })

  it('restores the holding as it was before an edit', () => {
    const edited = state({ holdings: [apple({ name: 'Apple Inc.' })], holdingLogs: [log({ action: 'edit', holdingId: 'h1', previousHoldingState: apple() })] })
    expect(undoLatest(edited).holdings).toEqual([apple()])
  })

  it('takes a dividend back out of the account and drops its record', () => {
    const paid = state({
      cashAccounts: [{ ...bank, balance: 20_090 }],
      dividendRecords: [{ id: 'r1' } as DividendRecord],
      holdingLogs: [log({ action: 'dividend', cashAccountId: 'bank', netDividend: 90, dividendRecordId: 'r1' })],
    })
    const undone = undoLatest(paid)
    expect(undone.cashAccounts[0].balance).toBe(20_000)
    expect(undone.dividendRecords).toEqual([])
  })

  it('undoes a confirmed DCA buy: the payment and the confirmation', () => {
    const confirmed = state({
      cashAccounts: [{ ...bank, balance: 15_000 }],
      dcaPlans: [{ id: 'p1', name: 'Apple', assetClass: 'stock', monthlyAmount: 5000, dayOfMonth: 10, confirmedDates: ['2026-10-10', '2026-09-10'] }],
      holdingLogs: [log({
        action: 'note', dcaPlanId: 'p1', dcaDate: '2026-10-10',
        previousCashAccountsState: [bank], afterCashAccountsState: [{ ...bank, balance: 15_000 }],
      })],
    })
    const undone = undoLatest(confirmed)
    expect(undone.cashAccounts[0].balance).toBe(20_000)
    expect(undone.dcaPlans[0].confirmedDates).toEqual(['2026-09-10'])
  })

  it('undoes a move between storage locations, removing the location it created', () => {
    const btc = {
      id: 'b1', name: 'Bitcoin', ticker: 'BTC', assetClass: 'crypto', units: 0.01, avgCost: 2_000_000, price: 3_000_000, totalThbInvested: 20_000,
      locations: [{ id: 'ex', name: 'Exchange', qty: 0.01, thbSpent: 20_000 }],
    } as Holding
    const moved = transferLocation(state({ holdings: [btc] }), { holdingId: 'b1', fromLocationId: 'ex', newLocationName: 'Ledger', amount: 400_000, fee: 1000 })
    const undone = undoLatest(moved).holdings[0]
    expect(undone.locations).toEqual([{ id: 'ex', name: 'Exchange', qty: 0.01, thbSpent: 20_000 }])
    expect(undone.units).toBeCloseTo(0.01)
  })

  it('undoes a sale from one broker, giving that broker its shares and cost back', () => {
    const locs = [
      { id: 'w', name: 'Webull', qty: 6, thbSpent: 30_000, usdSpent: 900 },
      { id: 'd', name: 'Dime', qty: 4, thbSpent: 20_000, usdSpent: 600 },
    ]
    const start = state({ holdings: [apple({ locations: locs, totalUsdInvested: 1500 })] })
    const after = { ...apple(), units: 4, totalUnits: 4, totalThbInvested: 20_000, locations: [{ ...locs[0], qty: 0, thbSpent: 0, usdSpent: 0 }, locs[1]] } as Holding
    const sold = sellHolding(start, { holdingId: 'h1', remainingHolding: after, soldUnits: 6, soldPrice: 6000, proceeds: 36_000, realizedPnL: 6_000, realizedPnLPercent: 20, note: 'Sold 6 shares from Webull' })
    const undone = undoLatest(sold).holdings[0]
    expect(undone.units).toBe(10)
    expect(undone.locations).toEqual(locs)
  })

  it('undoes a buy into a new broker, removing the broker it created', () => {
    const locs = [{ id: 'w', name: 'Webull', qty: 10, thbSpent: 50_000, usdSpent: 1500 }]
    const start = state({ holdings: [apple({ locations: locs })] })
    const bought = { ...apple(), units: 12, totalUnits: 12, totalThbInvested: 62_000, locations: [...locs, { id: 'd', name: 'Dime', qty: 2, thbSpent: 12_000, usdSpent: 350 }] } as Holding
    const out = buyMoreHolding(start, { updatedHolding: bought, note: '+2 shares · Dime' })
    expect(undoLatest(out).holdings[0].locations).toEqual(locs)
  })
})

describe('entries undo must refuse', () => {
  const refused = (d: SpendiaryData, id = d.holdingLogs![0].id) => {
    const r = undoHoldingLogChecked(d, id)
    return r.ok ? null : r.reason
  }

  it.each([
    ['a DCA plan change', { action: 'edit', holdingName: 'DCA Plan: Apple', ticker: 'DCA' }],
    ['an AI import', { action: 'add', holdingName: 'AI Import (2 holdings)', ticker: 'IMPORT' }],
    ['a debt payment', { action: 'edit', holdingName: 'Liability: Car', ticker: 'DEBT', assetClass: 'cash' }],
    ['a note', { action: 'note', holdingId: 'h1' }],
  ] as [string, Partial<HoldingLog>][])('keeps %s: it has nothing to put back', (_, over) => {
    const entry = log(over)
    expect(canUndoLog(entry)).toBe(false)
    expect(refused(state({ holdingLogs: [entry] }))).toMatch(/nothing to put back/)
  })

  it('still undoes a skipped DCA buy, which only names a plan and a date', () => {
    const skip = log({ action: 'edit', ticker: 'DCA', dcaPlanId: 'p1', dcaDate: '2026-10-10' })
    const d = state({
      dcaPlans: [{ id: 'p1', name: 'Apple', assetClass: 'stock', monthlyAmount: 5000, dayOfMonth: 10, skippedDates: ['2026-10-10'] }],
      holdingLogs: [skip],
    })
    expect(canUndoLog(skip)).toBe(true)
    expect(undoLatest(d).dcaPlans[0].skippedDates).toEqual([])
  })

  it('keeps a move when the coins have left where they went', () => {
    const btc = {
      id: 'b1', name: 'Bitcoin', ticker: 'BTC', assetClass: 'crypto', units: 0.01, avgCost: 2_000_000, price: 3_000_000, totalThbInvested: 20_000,
      locations: [{ id: 'ex', name: 'Exchange', qty: 0.01, thbSpent: 20_000 }],
    } as Holding
    const moved = transferLocation(state({ holdings: [btc] }), { holdingId: 'b1', fromLocationId: 'ex', newLocationName: 'Ledger', amount: 400_000, fee: 0 })
    const ledger = moved.holdings[0].locations!.find((l) => l.name === 'Ledger')!
    const spent = { ...moved, holdings: [{ ...moved.holdings[0], locations: moved.holdings[0].locations!.map((l) => (l.id === ledger.id ? { ...l, qty: 0.001 } : l)) }] }
    expect(refused(spent)).toMatch(/moved to Ledger/)
    expect(undoLatest(spent)).toBe(spent)
  })

  it('keeps an old add once the holding was traded after it', () => {
    const d = state({
      holdingLogs: [
        log({ id: 'buy', action: 'buy_more', holdingId: 'h1', timestamp: '2026-10-02T09:00:00.000Z' }),
        log({ id: 'add', action: 'add', holdingId: 'h1' }),
      ],
    })
    expect(refused(d, 'add')).toMatch(/traded after/)
  })

  it('keeps a new account once Spend entries use it', () => {
    const added: CashAccount = { id: 'new', name: 'New', balance: 100 }
    const entry = log({
      action: 'add', holdingName: 'Cash Accounts', ticker: 'CASH', assetClass: 'cash',
      previousCashAccountsState: [bank], afterCashAccountsState: [bank, added],
    })
    const unused = state({ cashAccounts: [bank, added], holdingLogs: [entry] })
    expect(undoLatest(unused).cashAccounts).toEqual([bank])
    const used = { ...unused, spendTransactions: [{ id: 't', accountId: 'new' } as SpendTransaction] }
    expect(refused(used)).toMatch(/used since/)
  })
})

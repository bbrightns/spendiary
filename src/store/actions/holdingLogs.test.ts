import { describe, expect, it } from 'vitest'
import type { CashAccount, DividendRecord, Holding, HoldingLog, SpendiaryData } from '../../lib/types'
import { emptyData } from '../migrate'
import { buyMoreHolding, sellHolding, transferLocation } from './holdings'
import {
  addHoldingLog,
  removeHoldingLog,
  removeHoldingLogs,
  undoHoldingLog,
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
      btcLocations: [{ id: 'ex', name: 'Exchange', satoshi: 1_000_000, thbSpent: 20_000 }],
    } as Holding
    const moved = transferLocation(state({ holdings: [btc] }), { holdingId: 'b1', fromLocationId: 'ex', newLocationName: 'Ledger', amount: 400_000, fee: 1000 })
    const undone = undoLatest(moved).holdings[0]
    expect(undone.btcLocations).toEqual([{ id: 'ex', name: 'Exchange', satoshi: 1_000_000, thbSpent: 20_000 }])
    expect(undone.units).toBeCloseTo(0.01)
  })
})

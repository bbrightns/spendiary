import { describe, expect, it } from 'vitest'
import type { CashAccount, Holding, SpendiaryData } from '../../lib/types'
import { emptyData } from '../migrate'
import {
  buyMoreHolding,
  removeBtcLocation,
  removeGoldLocation,
  removeHolding,
  reorderHoldings,
  sellHolding,
  toggleHoldingLock,
  toggleLocationLock,
  transferLocation,
  upsertBtcLocation,
  upsertGoldLocation,
  upsertHolding,
} from './holdings'

const holding = (over: Partial<Holding> = {}): Holding =>
  ({ id: 'h1', name: 'Apple', ticker: 'AAPL', assetClass: 'stock', units: 10, avgCost: 5000, price: 6000, ...over }) as Holding

const bank: CashAccount = { id: 'bank', name: 'Bank', balance: 1000 }

const state = (over: Partial<SpendiaryData> = {}): SpendiaryData => ({
  ...emptyData,
  holdings: [holding()],
  cashAccounts: [bank],
  rebalanceHoldingTargets: { h1: 40 },
  ...over,
})

const sale = {
  holdingId: 'h1',
  soldUnits: 4,
  soldPrice: 6000,
  proceeds: 24000,
  realizedPnL: 4000,
  realizedPnLPercent: 20,
  note: 'Sold some',
}

describe('sellHolding', () => {
  it('keeps the remaining units and pays the proceeds into the chosen account', () => {
    const remaining = holding({ units: 6 })
    const out = sellHolding(state(), { ...sale, remainingHolding: remaining, cashAccountId: 'bank', cashDepositAmount: 24000.004 })
    expect(out.holdings).toEqual([remaining])
    expect(out.cashAccounts[0].balance).toBe(25000)
    expect(out.rebalanceHoldingTargets).toEqual({ h1: 40 })
  })

  it('removes the holding and its rebalance target when everything is sold', () => {
    const out = sellHolding(state(), { ...sale, soldUnits: 10, remainingHolding: null })
    expect(out.holdings).toEqual([])
    expect(out.rebalanceHoldingTargets).toEqual({})
  })

  it('logs the sale with the before and after states so it can be undone', () => {
    const remaining = holding({ units: 6 })
    const log = sellHolding(state(), { ...sale, remainingHolding: remaining, cashAccountId: 'bank', cashDepositAmount: 100 }).holdingLogs?.[0]
    expect(log).toMatchObject({ action: 'sell', holdingId: 'h1', soldUnits: 4, proceeds: 24000, realizedPnL: 4000, note: 'Sold some' })
    expect(log?.previousHoldingState).toEqual(holding())
    expect(log?.afterHoldingState).toEqual(remaining)
    expect(log?.previousCashAccountsState).toEqual([bank])
    expect(log?.afterCashAccountsState?.[0].balance).toBe(1100)
  })

  it('leaves cash alone and logs no cash states when no account was chosen', () => {
    const out = sellHolding(state(), { ...sale, remainingHolding: holding({ units: 6 }) })
    expect(out.cashAccounts).toEqual([bank])
    expect(out.holdingLogs?.[0].previousCashAccountsState).toBeUndefined()
  })

  it('changes nothing for an unknown holding', () => {
    const before = state()
    expect(sellHolding(before, { ...sale, holdingId: 'nope' })).toBe(before)
  })

  it('does not change the data it was given', () => {
    const before = state()
    const snapshot = JSON.stringify(before)
    sellHolding(before, { ...sale, remainingHolding: holding({ units: 6 }), cashAccountId: 'bank', cashDepositAmount: 50 })
    expect(JSON.stringify(before)).toBe(snapshot)
  })
})

describe('buyMoreHolding', () => {
  it('replaces the holding, takes the cost out of the account and logs the buy', () => {
    const updated = holding({ units: 12 })
    const out = buyMoreHolding(state(), { updatedHolding: updated, cashAccountId: 'bank', cashDeductAmount: 250.5, note: 'Top up', source: 'received', receivedFrom: 'Mum' })
    expect(out.holdings).toEqual([updated])
    expect(out.cashAccounts[0].balance).toBe(749.5)
    expect(out.holdingLogs?.[0]).toMatchObject({ action: 'buy_more', holdingId: 'h1', source: 'received', receivedFrom: 'Mum' })
    expect(out.holdingLogs?.[0].previousHoldingState).toEqual(holding())
  })

  it('leaves cash alone when no account was chosen', () => {
    expect(buyMoreHolding(state(), { updatedHolding: holding({ units: 12 }), note: '' }).cashAccounts).toEqual([bank])
  })
})

describe('removeHolding', () => {
  it('removes the holding and its rebalance target', () => {
    const out = removeHolding(state(), 'h1')
    expect(out.holdings).toEqual([])
    expect(out.rebalanceHoldingTargets).toEqual({})
  })

  it('refuses to remove a locked holding', () => {
    const before = state({ holdings: [holding({ isLocked: true })] })
    expect(removeHolding(before, 'h1')).toBe(before)
  })
})

describe('upsertHolding / toggleHoldingLock / reorderHoldings', () => {
  it('adds a holding with a new id, or merges into the one with the same id', () => {
    const { id: _, ...nvidia } = holding({ name: 'NVIDIA' })
    const added = upsertHolding(state(), nvidia)
    expect(added.holdings).toHaveLength(2)
    expect(added.holdings[1].id).not.toBe('h1')
    expect(upsertHolding(state(), holding({ price: 7000 })).holdings[0]).toMatchObject({ name: 'Apple', price: 7000 })
  })

  it('locks and unlocks', () => {
    const locked = toggleHoldingLock(state(), 'h1')
    expect(locked.holdings[0].isLocked).toBe(true)
    expect(toggleHoldingLock(locked, 'h1').holdings[0].isLocked).toBe(false)
  })

  it('puts holdings in the given order and drops unknown ids', () => {
    const two = state({ holdings: [holding(), holding({ id: 'h2' })] })
    expect(reorderHoldings(two, ['h2', 'nope', 'h1']).holdings.map((h) => h.id)).toEqual(['h2', 'h1'])
  })
})

describe('storage locations', () => {
  const btc = (locs: Holding['btcLocations']) =>
    holding({ id: 'b1', assetClass: 'crypto', units: 0, avgCost: 1, totalThbInvested: 0, btcLocations: locs })
  const gold = (locs: Holding['goldLocations']) =>
    holding({ id: 'g1', assetClass: 'gold', units: 0, avgCost: 1, totalThbInvested: 0, goldLocations: locs })

  it('recomputes BTC units and average cost from its locations', () => {
    const start = state({ holdings: [btc([{ id: 'a', name: 'A', satoshi: 50_000_000, thbSpent: 1_000_000 }])] })
    const out = upsertBtcLocation(start, 'b1', { name: 'B', satoshi: 50_000_000, thbSpent: 2_000_000 })
    expect(out.holdings[0]).toMatchObject({ units: 1, totalUnits: 1, avgCost: 3_000_000, totalThbInvested: 3_000_000 })
    expect(removeBtcLocation(out, 'b1', 'a').holdings[0]).toMatchObject({ units: 0.5, avgCost: 4_000_000 })
  })

  it('recomputes gold grams and average cost, and keeps locked locations', () => {
    const start = state({ holdings: [gold([{ id: 'a', name: 'Safe', grams: 15.244, thbSpent: 40_000, isLocked: true }])] })
    const out = upsertGoldLocation(start, 'g1', { name: 'Shop', grams: 15.244, thbSpent: 44_000 })
    expect(out.holdings[0].units).toBeCloseTo(30.488)
    expect(out.holdings[0].avgCost).toBeCloseTo(84_000 / 30.488)
    expect(removeGoldLocation(out, 'g1', 'a').holdings[0].goldLocations).toHaveLength(2)
  })

  it('toggles a location lock', () => {
    const start = state({ holdings: [btc([{ id: 'a', name: 'A', satoshi: 1, thbSpent: 1 }])] })
    expect(toggleLocationLock(start, 'b1', 'a', true).holdings[0].btcLocations?.[0].isLocked).toBe(true)
  })
})

describe('transferLocation', () => {
  const btc = holding({
    id: 'b1', name: 'Bitcoin', assetClass: 'crypto', units: 0.01, avgCost: 2_000_000, totalThbInvested: 20_000,
    btcLocations: [
      { id: 'ex', name: 'Exchange', satoshi: 1_000_000, thbSpent: 20_000 },
      { id: 'cold', name: 'Ledger', satoshi: 0, thbSpent: 0, isLocked: true },
    ],
  })
  const start = state({ holdings: [btc] })
  const move = (over: Partial<Parameters<typeof transferLocation>[1]>) =>
    transferLocation(start, { holdingId: 'b1', fromLocationId: 'ex', amount: 400_000, ...over })

  it('moves coins and their share of the cost; the fee lowers the units', () => {
    const out = move({ toLocationId: 'cold', fee: 1000 })
    const h = out.holdings[0]
    expect(h.btcLocations).toEqual([
      { id: 'ex', name: 'Exchange', satoshi: 600_000, thbSpent: 12_000 },
      { id: 'cold', name: 'Ledger', satoshi: 399_000, thbSpent: 8000, isLocked: true },
    ])
    expect(h.units).toBeCloseTo(0.00999)
    expect(h.avgCost).toBeCloseTo(20_000 / 0.00999)
    expect(out.holdingLogs?.[0].transfer).toMatchObject({ amount: 400_000, fee: 1000, received: 399_000, costMoved: 8000, destCreated: false })
  })

  it('finds an existing location by name, ignoring case', () => {
    const out = move({ newLocationName: 'ledger' })
    expect(out.holdings[0].btcLocations).toHaveLength(2)
    expect(out.holdingLogs?.[0].transfer?.toLocationId).toBe('cold')
  })

  it('creates a new location when the name is new', () => {
    const out = move({ newLocationName: 'Trezor' })
    expect(out.holdings[0].btcLocations?.[2]).toMatchObject({ name: 'Trezor', satoshi: 400_000, thbSpent: 8000 })
    expect(out.holdingLogs?.[0].transfer?.destCreated).toBe(true)
  })

  it('moves the exact remaining cost when everything moves', () => {
    const out = move({ amount: 1_000_000, toLocationId: 'cold' })
    expect(out.holdings[0].btcLocations?.[0]).toMatchObject({ satoshi: 0, thbSpent: 0 })
    expect(out.holdings[0].btcLocations?.[1]).toMatchObject({ satoshi: 1_000_000, thbSpent: 20_000 })
  })

  it('refuses impossible moves', () => {
    expect(move({ amount: 2_000_000, toLocationId: 'cold' })).toBe(start) // more than is there
    expect(move({ fee: 400_000, toLocationId: 'cold' })).toBe(start) // fee eats it all
    expect(move({ toLocationId: 'ex' })).toBe(start) // to itself
    expect(move({})).toBe(start) // nowhere to go
    expect(move({ fromLocationId: 'cold', toLocationId: 'ex' })).toBe(start) // locked source
    const plain = state()
    expect(transferLocation(plain, { holdingId: 'h1', fromLocationId: 'ex', toLocationId: 'cold', amount: 1 })).toBe(plain) // no locations
  })
})

import { describe, expect, it } from 'vitest'
import type { CashAccount, Holding, SpendiaryData } from '../../lib/types'
import { emptyData } from '../migrate'
import { buyMoreHolding, removeHolding, sellHolding } from './holdings'

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

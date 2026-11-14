import { describe, expect, it } from 'vitest'
import type { CashAccount, SpendiaryData } from '../lib/types'
import { emptyData } from './migrate'
import { moveUsd, syncUsdCosts, walletRate } from './usdCost'

const wallet = (over: Partial<CashAccount> = {}): CashAccount => ({ id: 'usd', name: 'Dime FCD', balance: 1_000, currency: 'USD', thbCost: 34_000, ...over })
const data = (accounts: CashAccount[]): SpendiaryData => ({ ...emptyData, cashAccounts: accounts })

describe('walletRate', () => {
  it('is the cost over the balance', () => {
    expect(walletRate(wallet())).toBe(34)
  })

  it('is null for unknown cost, an empty wallet or a THB account', () => {
    expect(walletRate(wallet({ thbCost: undefined }))).toBeNull()
    expect(walletRate(wallet({ balance: 0, thbCost: 0 }))).toBeNull()
    expect(walletRate({ balance: 100, thbCost: 3_400 })).toBeNull()
    expect(walletRate(undefined)).toBeNull()
  })
})

describe('moveUsd', () => {
  it('takes money out at the average rate', () => {
    const a = moveUsd(wallet(), -250)
    expect([a.balance, a.thbCost, walletRate(a)]).toEqual([750, 25_500, 34])
  })

  it('adds an exchange at what it cost, moving the average', () => {
    const a = moveUsd(wallet(), 1_000, 36_000)
    expect([a.balance, a.thbCost, walletRate(a)]).toEqual([2_000, 70_000, 35])
  })

  it('brings money in at the average rate when its cost is not given', () => {
    expect(moveUsd(wallet(), 100).thbCost).toBe(37_400)
  })

  it('zeroes the cost when the wallet is emptied', () => {
    expect(moveUsd(wallet(), -1_000).thbCost).toBe(0)
  })

  it('leaves an unknown cost unknown', () => {
    const a = moveUsd(wallet({ thbCost: undefined }), 500, 17_000)
    expect([a.balance, a.thbCost]).toEqual([1_500, undefined])
  })

  it('starts an empty wallet at the cost of what comes in', () => {
    expect(walletRate(moveUsd(wallet({ balance: 0, thbCost: 0 }), 100, 3_350))).toBe(33.5)
  })
})

describe('syncUsdCosts', () => {
  it('keeps the rate when only the balance changed (a buy paid from the wallet)', () => {
    const out = syncUsdCosts(data([wallet()]), data([wallet({ balance: 849.97 })]))
    expect(out.cashAccounts[0].thbCost).toBe(28_898.98)
  })

  it('leaves a cost the change set itself', () => {
    const next = data([wallet({ balance: 2_000, thbCost: 70_000 })])
    expect(syncUsdCosts(data([wallet()]), next)).toBe(next)
  })

  it('leaves THB accounts, new accounts and unknown costs alone', () => {
    const thbBefore: CashAccount = { id: 'k', name: 'KBank', balance: 100 }
    const next = data([{ ...thbBefore, balance: 50 }, wallet({ id: 'new' }), wallet({ id: 'u2', thbCost: undefined, balance: 5 })])
    expect(syncUsdCosts(data([thbBefore, wallet({ id: 'u2', thbCost: undefined })]), next)).toBe(next)
  })
})

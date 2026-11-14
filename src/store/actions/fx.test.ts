import { describe, expect, it } from 'vitest'
import type { CashAccount, SpendiaryData } from '../../lib/types'
import { emptyData } from '../migrate'
import { syncUsdCosts, walletRate } from '../usdCost'
import { exchangeToUsd, undoFxExchange } from './fx'
import { buyMoreHolding, sellHolding } from './holdings'

const kbank: CashAccount = { id: 'kbank', name: 'KBank', balance: 100_000 }
const fcd = (over: Partial<CashAccount> = {}): CashAccount => ({ id: 'fcd', name: 'Dime FCD', balance: 0, currency: 'USD', ...over })
const state = (over: Partial<CashAccount> = {}): SpendiaryData => ({ ...emptyData, cashAccounts: [kbank, fcd(over)] })
const acc = (s: SpendiaryData, id: string) => s.cashAccounts.find((a) => a.id === id)!
/** Runs an action the way useData does, with the USD cost sync */
const run = (s: SpendiaryData, f: (s: SpendiaryData) => SpendiaryData) => syncUsdCosts(s, f(s))

describe('exchangeToUsd', () => {
  it('moves the baht and gives the wallet its cost', () => {
    const out = exchangeToUsd(state(), { fromAccountId: 'kbank', toAccountId: 'fcd', thb: 34_000, usd: 1_000, date: '2026-11-14' })
    expect(acc(out, 'kbank').balance).toBe(66_000)
    expect([acc(out, 'fcd').balance, acc(out, 'fcd').thbCost]).toEqual([1_000, 34_000])
    expect(out.fxExchanges).toEqual([expect.objectContaining({ fromAccountId: 'kbank', toAccountId: 'fcd', thb: 34_000, usd: 1_000, date: '2026-11-14' })])
  })

  it('averages two exchanges', () => {
    let s = exchangeToUsd(state(), { fromAccountId: 'kbank', toAccountId: 'fcd', thb: 34_000, usd: 1_000, date: 'd' })
    s = exchangeToUsd(s, { toAccountId: 'fcd', thb: 36_000, usd: 1_000, date: 'd' })
    expect(walletRate(acc(s, 'fcd'))).toBe(35)
    expect(acc(s, 'kbank').balance).toBe(66_000)
  })

  it('uses the typed cost of dollars already there', () => {
    const out = exchangeToUsd(state({ balance: 421.06 }), { toAccountId: 'fcd', thb: 3_400, usd: 100, openingThbCost: 14_200, date: 'd' })
    expect(acc(out, 'fcd').thbCost).toBe(17_600)
  })

  it('keeps the cost unknown when dollars were there and no cost was given', () => {
    const out = exchangeToUsd(state({ balance: 421.06 }), { toAccountId: 'fcd', thb: 3_400, usd: 100, date: 'd' })
    expect([acc(out, 'fcd').balance, acc(out, 'fcd').thbCost]).toEqual([521.06, undefined])
  })

  it('refuses a THB destination or empty amounts', () => {
    const s = state()
    expect(exchangeToUsd(s, { toAccountId: 'kbank', thb: 1, usd: 1, date: 'd' })).toBe(s)
    expect(exchangeToUsd(s, { toAccountId: 'fcd', thb: 0, usd: 1, date: 'd' })).toBe(s)
  })
})

describe('undoFxExchange', () => {
  it('puts everything back', () => {
    const s = exchangeToUsd(state(), { fromAccountId: 'kbank', toAccountId: 'fcd', thb: 34_000, usd: 1_000, date: 'd' })
    const back = undoFxExchange(s, s.fxExchanges![0].id)
    expect(acc(back, 'kbank').balance).toBe(100_000)
    expect([acc(back, 'fcd').balance, acc(back, 'fcd').thbCost]).toEqual([0, 0])
    expect(back.fxExchanges).toEqual([])
  })
})

describe('the wallet cost through trades', () => {
  const h = { id: 'a', name: 'Apple', ticker: 'AAPL', assetClass: 'stock', units: 1, totalUnits: 1, avgCost: 3_500, price: 3_500, totalThbInvested: 3_500, totalUsdInvested: 100 } as const

  it('a buy paid from the wallet takes cost out at the average rate', () => {
    const s0: SpendiaryData = { ...state({ balance: 1_000, thbCost: 34_000 }), holdings: [{ ...h }] }
    const out = run(s0, (s) => buyMoreHolding(s, { updatedHolding: { ...h, units: 2 }, cashAccountId: 'fcd', cashDeductAmount: 150.03, note: 'b' }))
    expect(acc(out, 'fcd').balance).toBe(849.97)
    expect(walletRate(acc(out, 'fcd'))).toBeCloseTo(34, 6)
  })

  it('a sale into the wallet adds the proceeds at the sale\'s baht value', () => {
    const s0: SpendiaryData = { ...state({ balance: 1_000, thbCost: 34_000 }), holdings: [{ ...h }] }
    const out = run(s0, (s) => sellHolding(s, {
      holdingId: 'a', soldUnits: 1, soldPrice: 4_200, proceeds: 4_200, realizedPnL: 700, realizedPnLPercent: 20,
      remainingHolding: null, cashAccountId: 'fcd', cashDepositAmount: 120, note: 's',
    }))
    expect([acc(out, 'fcd').balance, acc(out, 'fcd').thbCost]).toEqual([1_120, 38_200])
  })
})

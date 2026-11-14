import { describe, expect, it } from 'vitest'
import { fxLooksOff, resolveUsdTrade, type UsdTradeInput } from './usdTrade'

const base: UsdTradeInput = { currency: 'USD', shares: 0, priceUsd: 0, amountThb: 0, fx: 0, liveFx: 35 }

describe('resolveUsdTrade: USD', () => {
  it('takes USD from shares x price and THB at today\'s rate', () => {
    expect(resolveUsdTrade({ ...base, shares: 10, priceUsd: 100 })).toEqual({
      shares: 10, priceUsd: 100, usd: 1_000, thb: 35_000, fx: 35, sharesEstimated: false, fxFromAmounts: false,
    })
  })

  it('uses a typed rate over today\'s', () => {
    expect(resolveUsdTrade({ ...base, shares: 10, priceUsd: 100, fx: 32.5 })!.thb).toBe(32_500)
  })

  it('ignores a THB amount', () => {
    expect(resolveUsdTrade({ ...base, shares: 2, priceUsd: 50, amountThb: 999 })!.thb).toBe(3_500)
  })

  it('is null without shares, price or any rate', () => {
    expect(resolveUsdTrade({ ...base, priceUsd: 100 })).toBeNull()
    expect(resolveUsdTrade({ ...base, shares: 10 })).toBeNull()
    expect(resolveUsdTrade({ ...base, shares: 10, priceUsd: 100, liveFx: 0 })).toBeNull()
  })
})

describe('resolveUsdTrade: THB', () => {
  const thb: UsdTradeInput = { ...base, currency: 'THB' }

  it('works the rate out of the baht amount when shares are typed', () => {
    expect(resolveUsdTrade({ ...thb, amountThb: 34_500, shares: 10, priceUsd: 100 })).toEqual({
      shares: 10, priceUsd: 100, usd: 1_000, thb: 34_500, fx: 34.5, sharesEstimated: false, fxFromAmounts: true,
    })
  })

  it('estimates shares at today\'s rate when they are left empty', () => {
    expect(resolveUsdTrade({ ...thb, amountThb: 3_500, priceUsd: 100 })).toEqual({
      shares: 1, priceUsd: 100, usd: 100, thb: 3_500, fx: 35, sharesEstimated: true, fxFromAmounts: false,
    })
  })

  it('estimates fractional shares to 4 places', () => {
    expect(resolveUsdTrade({ ...thb, amountThb: 1_000, priceUsd: 187.25 })!.shares).toBe(0.1526)
  })

  it('is null without an amount or price, or with no rate to estimate shares', () => {
    expect(resolveUsdTrade({ ...thb, shares: 10, priceUsd: 100 })).toBeNull()
    expect(resolveUsdTrade({ ...thb, amountThb: 3_500 })).toBeNull()
    expect(resolveUsdTrade({ ...thb, amountThb: 3_500, priceUsd: 100, liveFx: 0 })).toBeNull()
  })
})

describe('fxLooksOff', () => {
  it('flags a rate more than 5% from today\'s', () => {
    expect(fxLooksOff(35, 35)).toBe(false)
    expect(fxLooksOff(36.7, 35)).toBe(false)
    expect(fxLooksOff(37, 35)).toBe(true)
    expect(fxLooksOff(3.5, 35)).toBe(true)
  })

  it('says nothing when either rate is unknown', () => {
    expect(fxLooksOff(0, 35)).toBe(false)
    expect(fxLooksOff(35, 0)).toBe(false)
  })
})

describe('fieldNumber', () => {
  it('reads typed values', async () => {
    const { fieldNumber } = await import('./usdTrade')
    expect(fieldNumber('')).toBe(0)
    expect(fieldNumber('1,234.5')).toBe(1_234.5)
    expect(fieldNumber(7)).toBe(7)
    expect(fieldNumber('abc')).toBe(0)
  })
})

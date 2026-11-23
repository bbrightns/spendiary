import { describe, expect, it } from 'vitest'
import { canPayDividend, dividendFields, dividendInUsd, dividendThb, dpsMapFromHolding } from './dividendSchedule'
import type { Holding } from './types'

const h = (over: Partial<Holding> = {}): Holding =>
  ({ id: 'h1', name: 'Apple', ticker: 'AAPL', assetClass: 'stock', units: 10, avgCost: 5000, price: 6000, ...over }) as Holding

describe('dividend schedule', () => {
  it('only funds and stocks can pay', () => {
    expect(canPayDividend(h())).toBe(true)
    expect(canPayDividend(h({ assetClass: 'fund' }))).toBe(true)
    expect(canPayDividend(h({ assetClass: 'gold' }))).toBe(false)
  })

  it('reads per-month payouts, then the older single DPS', () => {
    expect(dpsMapFromHolding(h({ dividendPayouts: [{ month: 3, dps: 0.2 }, { month: 9, dps: 0.3 }] }))).toEqual({ 3: 0.2, 9: 0.3 })
    expect(dpsMapFromHolding(h({ dividendMonths: [2, 8], expectedDps: 0.5 }))).toEqual({ 2: 0.5, 8: 0.5 })
    expect(dpsMapFromHolding(h({ expectedDps: 1 }))).toEqual({ 1: 1 })
    expect(dpsMapFromHolding(h())).toEqual({})
  })

  it('saves sorted payouts with an average DPS', () => {
    expect(dividendFields([9, 3], { 3: '0.2', 9: 0.4 }, 'bank')).toEqual({
      paysDividend: true,
      dividendMonths: [3, 9],
      dividendPayouts: [{ month: 3, dps: 0.2 }, { month: 9, dps: 0.4 }],
      expectedDps: 0.3,
      defaultCashAccountId: 'bank',
    })
  })

  it('turns tracking off when no month is picked, and treats blank or negative DPS as 0', () => {
    expect(dividendFields([], { 3: 1 }, 'bank').paysDividend).toBe(false)
    const f = dividendFields([5], { 5: '' }, '')
    expect(f.dividendPayouts).toEqual([{ month: 5, dps: 0 }])
    expect(f.expectedDps).toBeUndefined()
    expect(f.defaultCashAccountId).toBeUndefined()
    expect(dividendFields([5], { 5: -2 }, '').dividendPayouts).toEqual([{ month: 5, dps: 0 }])
  })
})

describe('dividendThb', () => {
  it('keeps a fund dividend in baht', () => {
    expect(dividendThb({ assetClass: 'fund' }, 3_024, null)).toBe(3_024)
  })

  it('converts a US stock dividend at the real rate', () => {
    expect(dividendThb({ assetClass: 'stock' }, 287, 35)).toBe(10_045)
  })

  it('gives null for a US stock dividend when no rate is known, never a dollar amount as baht', () => {
    expect(dividendThb({ assetClass: 'stock' }, 287, null)).toBeNull()
    expect(dividendThb({ assetClass: 'stock' }, 287, 0)).toBeNull()
    expect(dividendThb({ assetClass: 'stock' }, 287, Number.NaN)).toBeNull()
  })

  it('marks only stocks as paying in USD', () => {
    expect(dividendInUsd({ assetClass: 'stock' })).toBe(true)
    expect(dividendInUsd({ assetClass: 'fund' })).toBe(false)
  })
})

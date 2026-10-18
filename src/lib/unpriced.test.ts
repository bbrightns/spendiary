import { describe, expect, it } from 'vitest'
import { assetGroupAllocations, hasRealPrice, holdingMetrics, portfolioSummary } from './calc'
import type { Holding } from './types'

const holding = (over: Partial<Holding>): Holding =>
  ({ id: 'h', name: 'H', ticker: 'H', assetClass: 'fund', units: 10, avgCost: 100, price: 100, ...over }) as Holding

// Priced: cost ฿1,000, worth ฿1,200. Unpriced: cost ฿500, price is only the cost stand-in.
const priced = holding({ id: 'a', price: 120, totalThbInvested: 1000 })
const unpriced = holding({ id: 'b', units: 5, price: 100, placeholderPrice: 100, totalThbInvested: 500 })

describe('hasRealPrice', () => {
  it('is false while the price is still the cost stand-in', () => {
    expect(hasRealPrice(unpriced)).toBe(false)
  })

  it('is true once a real price replaces it, or when there never was one', () => {
    expect(hasRealPrice({ ...unpriced, price: 101.5 })).toBe(true)
    expect(hasRealPrice(priced)).toBe(true)
  })
})

describe('holdingMetrics without a real price', () => {
  it('counts the value at cost but reports no P/L', () => {
    const m = holdingMetrics(unpriced)
    expect(m.marketValue).toBe(500)
    expect(m.priced).toBe(false)
    expect(m.pnl).toBe(0)
    expect(m.pnlPct).toBe(0)
  })
})

describe('portfolioSummary', () => {
  it('counts every holding in the value, but only priced ones in the P/L', () => {
    const s = portfolioSummary([priced, unpriced])
    expect(s.value).toBe(1700)
    expect(s.cost).toBe(1500)
    expect(s.pnl).toBe(200)
    expect(s.pnlPct).toBeCloseTo(20) // 200 on the ฿1,000 that has a price, not 13.3% on ฿1,500
    expect(s.unpricedCount).toBe(1)
  })

  it('is unchanged when every holding has a price', () => {
    const s = portfolioSummary([priced, holding({ id: 'c', price: 90, totalThbInvested: 1000 })])
    expect(s.pnl).toBe(100)
    expect(s.pnlPct).toBeCloseTo(5)
    expect(s.unpricedCount).toBe(0)
  })
})

describe('assetGroupAllocations', () => {
  it('counts unpriced holdings per group and leaves them out of its P/L', () => {
    const [g] = assetGroupAllocations([priced, unpriced])
    expect(g.value).toBe(1700)
    expect(g.pnl).toBe(200)
    expect(g.unpricedCount).toBe(1)
  })
})

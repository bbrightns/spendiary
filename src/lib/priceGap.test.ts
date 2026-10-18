import { describe, expect, it } from 'vitest'
import { priceGap } from './calc'

describe('priceGap', () => {
  it('is null within 20% of the market', () => {
    expect(priceGap(110, 100)).toBeNull()
    expect(priceGap(85, 100)).toBeNull()
  })

  it('gives the gap as a fraction when far off', () => {
    expect(priceGap(10, 100)).toBeCloseTo(-0.9)
    expect(priceGap(150, 100)).toBeCloseTo(0.5)
  })

  it('is null when either price is unknown', () => {
    expect(priceGap(0, 100)).toBeNull()
    expect(priceGap(100, 0)).toBeNull()
    expect(priceGap(100, null)).toBeNull()
    expect(priceGap(Infinity, 100)).toBeNull()
  })
})

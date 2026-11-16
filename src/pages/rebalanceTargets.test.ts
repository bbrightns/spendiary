import { describe, expect, it } from 'vitest'
import { roundPct, targetsTotal } from './rebalanceTargets'

describe('targetsTotal', () => {
  it('is exactly 100 for targets that add up to 100 on paper', () => {
    // Plain addition gives 100.00000000000001 and 99.99999999999999 for these
    expect(targetsTotal([16.6, 16.6, 16.7, 16.7, 16.7, 16.7])).toBe(100)
    expect(targetsTotal([14.2, 14.3, 14.3, 14.3, 14.3, 14.3, 14.3])).toBe(100)
    expect(targetsTotal([50, 30, 15, 5, 0])).toBe(100)
    expect(targetsTotal([33.33, 33.33, 33.34])).toBe(100)
  })

  it('still tells a real shortfall or excess apart', () => {
    expect(targetsTotal([50, 30, 15, 4.99, 0])).toBe(99.99)
    expect(targetsTotal([50, 30, 15, 5.01])).toBe(100.01)
    expect(targetsTotal([33.3, 33.3, 33.3])).toBe(99.9)
    expect(targetsTotal([])).toBe(0)
  })

  it('reads a record of targets too, and skips what is not a number', () => {
    expect(targetsTotal({ a: 60.1, b: 39.9 })).toBe(100)
    expect(targetsTotal({ a: 60, b: Number.NaN, c: 40 } as Record<string, number>)).toBe(100)
  })

  it('gives a clean "what is left" for the fill button', () => {
    // 100 - 99.9 is 0.09999999999999432
    expect(roundPct(100 - targetsTotal([33.3, 33.3, 33.3]))).toBe(0.1)
    expect(roundPct(50 + roundPct(100 - 99.9))).toBe(50.1)
  })
})

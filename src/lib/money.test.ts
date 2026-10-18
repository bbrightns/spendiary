import { describe, expect, it } from 'vitest'
import { roundMoney } from './money'

describe('roundMoney', () => {
  it('rounds to two decimals', () => {
    expect(roundMoney(45.505)).toBe(45.51)
    expect(roundMoney(0.1 + 0.2)).toBe(0.3)
    expect(roundMoney(1000)).toBe(1000)
    expect(roundMoney(-12.344)).toBe(-12.34)
  })
})

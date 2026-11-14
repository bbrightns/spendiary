import { describe, expect, it } from 'vitest'
import { resolveExchange } from './fxExchange'

describe('resolveExchange', () => {
  it('works the rate out of baht paid and dollars received', () => {
    expect(resolveExchange(33_880, 1_000, 0)).toEqual({ thb: 33_880, usd: 1_000, rate: 33.88, derived: 'rate' })
  })

  it('works the dollars out of baht paid and the rate', () => {
    expect(resolveExchange(5_000, 0, 33.88)).toEqual({ thb: 5_000, usd: 147.58, rate: 33.88, derived: 'usd' })
  })

  it('works the baht out of dollars received and the rate', () => {
    expect(resolveExchange(0, 150, 33.88)).toEqual({ thb: 5_082, usd: 150, rate: 33.88, derived: 'thb' })
  })

  it('keeps the amounts when all three are typed', () => {
    expect(resolveExchange(34_000, 1_000, 33)).toMatchObject({ rate: 34, derived: 'rate' })
  })

  it('is null with fewer than two', () => {
    expect(resolveExchange(5_000, 0, 0)).toBeNull()
    expect(resolveExchange(0, 0, 33)).toBeNull()
  })
})

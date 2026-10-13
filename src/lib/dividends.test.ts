import { describe, expect, it } from 'vitest'
import { nextPayoutMonth } from './calc'

describe('nextPayoutMonth', () => {
  it('is the next paying month this year', () => {
    expect(nextPayoutMonth([4, 10], '2026-04-20')).toBe('October')
  })

  it('wraps to next year, with the year', () => {
    expect(nextPayoutMonth([10, 4], '2026-10-14')).toBe('April 2027')
  })

  it('is the same month next year for a yearly payer', () => {
    expect(nextPayoutMonth([5], '2026-05-08')).toBe('May 2027')
  })

  it('is undefined without paying months', () => {
    expect(nextPayoutMonth([], '2026-05-08')).toBeUndefined()
  })
})

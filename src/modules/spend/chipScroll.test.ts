import { describe, expect, it } from 'vitest'
import { revealScroll } from './chipScroll'

describe('revealScroll', () => {
  const base = { view: 200, width: 60, pad: 20 }
  it('leaves a chip already in view alone', () => {
    expect(revealScroll({ ...base, scroll: 0, left: 50 })).toBeUndefined()
  })
  it('scrolls right to a chip past the end, with room for the fade', () => {
    expect(revealScroll({ ...base, scroll: 0, left: 300 })).toBe(180)
  })
  it('scrolls back to a chip before the start, never below 0', () => {
    expect(revealScroll({ ...base, scroll: 300, left: 100 })).toBe(80)
    expect(revealScroll({ ...base, scroll: 300, left: 10 })).toBe(0)
  })
})

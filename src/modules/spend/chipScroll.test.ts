import { describe, expect, it } from 'vitest'
import { revealScroll, rowSplit } from './chipScroll'

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

describe('rowSplit', () => {
  it('keeps one row while the chips fit', () => {
    expect(rowSplit([70, 90, 60], 240)).toBeUndefined()
    expect(rowSplit([300], 200)).toBeUndefined()
    expect(rowSplit([], 200)).toBeUndefined()
  })

  it('fills the top row first, in order', () => {
    // 74 + 93 + 65 (+ gaps) = 244 fits in 344; Subscription (106) goes below: 3 + 1, not 2 + 2
    expect(rowSplit([74, 93, 65, 106], 344)).toBe(3)
  })

  it('splits long lists about in half so both rows scroll evenly', () => {
    const widths = Array(20).fill(94) // 20 chips, 100 px each with the gap
    expect(rowSplit(widths, 300)).toBe(10)
  })

  it('always leaves at least one chip in each row', () => {
    expect(rowSplit([400, 50], 300)).toBe(1)
  })
})

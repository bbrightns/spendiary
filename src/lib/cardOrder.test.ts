import { describe, expect, it } from 'vitest'
import { cardOrder, isDefaultOrder, moveInOrder } from './cardOrder'

const DEFAULTS = ['a', 'b', 'c'] as const

describe('cardOrder', () => {
  it('falls back to the defaults', () => {
    expect(cardOrder(DEFAULTS)).toEqual(['a', 'b', 'c'])
  })
  it('keeps the saved order, drops unknown and repeated ids, adds new cards at the end', () => {
    expect(cardOrder(DEFAULTS, ['c', 'x', 'c', 'a'])).toEqual(['c', 'a', 'b'])
  })
})

describe('moveInOrder', () => {
  it('swaps with the neighbour', () => {
    expect(moveInOrder(['a', 'b', 'c'], 'a', 1)).toEqual(['b', 'a', 'c'])
    expect(moveInOrder(['a', 'b', 'c'], 'c', -1)).toEqual(['a', 'c', 'b'])
  })
  it('does nothing past the ends', () => {
    expect(moveInOrder(['a', 'b'], 'a', -1)).toEqual(['a', 'b'])
    expect(moveInOrder(['a', 'b'], 'b', 1)).toEqual(['a', 'b'])
  })
})

describe('isDefaultOrder', () => {
  it('compares position by position', () => {
    expect(isDefaultOrder(DEFAULTS, ['a', 'b', 'c'])).toBe(true)
    expect(isDefaultOrder(DEFAULTS, ['b', 'a', 'c'])).toBe(false)
  })
})

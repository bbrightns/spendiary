import { describe, expect, it } from 'vitest'
import type { SpendCard } from '../../lib/types'
import { filterCards, isFiltering } from './cardFilter'

const card = (id: string, balance: number) => ({ id, name: id, balance }) as unknown as SpendCard
const cards = [card('a', 0), card('b', 500), card('c', -20), card('d', 0)]

describe('filterCards', () => {
  it('shows everything by default', () => {
    expect(filterCards(cards, { mode: 'all', hideZero: false }, []).length).toBe(4)
  })
  it('keeps only starred cards', () => {
    expect(filterCards(cards, { mode: 'starred', hideZero: false }, ['b', 'd']).map((c) => c.id)).toEqual(['b', 'd'])
  })
  it('has-balance keeps overpaid cards but drops zero', () => {
    expect(filterCards(cards, { mode: 'balance', hideZero: false }, []).map((c) => c.id)).toEqual(['b', 'c'])
  })
  it('hide-zero stacks on the starred chip', () => {
    expect(filterCards(cards, { mode: 'starred', hideZero: true }, ['b', 'd']).map((c) => c.id)).toEqual(['b'])
  })
  it('knows when a filter is active', () => {
    expect(isFiltering({ mode: 'all', hideZero: false })).toBe(false)
    expect(isFiltering({ mode: 'all', hideZero: true })).toBe(true)
  })
})

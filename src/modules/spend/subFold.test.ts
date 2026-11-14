import { describe, expect, it } from 'vitest'
import type { SpendTransaction } from '../../lib/types'
import { foldChips, sortSubsByUse, toggleTag, wrapRows } from './logic'

const txn = (categoryId: string, subcategory?: string) => ({ categoryId, subcategory }) as SpendTransaction

describe('sortSubsByUse', () => {
  it('puts the most used first and keeps the added order on ties', () => {
    const txns = [txn('food', 'Sushi'), txn('food', 'Sushi'), txn('food', 'Buffet'), txn('drinks', 'Snack'), txn('drinks', 'Snack'), txn('drinks', 'Snack')]
    expect(sortSubsByUse(['Snack', 'Sushi', 'Buffet', 'Lunch'], 'food', txns)).toEqual(['Sushi', 'Buffet', 'Snack', 'Lunch'])
  })
})

describe('wrapRows', () => {
  it('wraps like flex-wrap', () => {
    expect(wrapRows([], 100, 6)).toBe(0)
    expect(wrapRows([47, 47], 100, 6)).toBe(1)
    expect(wrapRows([47, 48], 100, 6)).toBe(2)
    expect(wrapRows([120], 100, 6)).toBe(1)
  })
})

describe('foldChips', () => {
  const base = { width: 100, gap: 0, rows: 2, trailing: 20 }
  it('folds nothing when everything fits', () => {
    expect(foldChips({ ...base, widths: [40, 40, 50] })).toBeUndefined()
  })
  it('keeps the first chips and leaves room for the trailing one', () => {
    expect(foldChips({ ...base, widths: [50, 50, 50, 50, 50] })).toEqual([0, 1, 2])
  })
  it('swaps the picked chip into the last slot', () => {
    expect(foldChips({ ...base, widths: [50, 50, 50, 50, 50], keep: 4 })).toEqual([0, 1, 4])
  })
  it('leaves the picked chip alone when it is already in view', () => {
    expect(foldChips({ ...base, widths: [50, 50, 50, 50, 50], keep: 1 })).toEqual([0, 1, 2])
  })
  it('folds to one row with the trailing chip', () => {
    expect(foldChips({ ...base, rows: 1, widths: [30, 30, 30, 30] })).toEqual([0, 1])
    expect(foldChips({ ...base, rows: 1, widths: [30, 30, 30, 30], keep: 3 })).toEqual([0, 3])
  })
})

describe('toggleTag', () => {
  it('appends a tag with one space', () => {
    expect(toggleTag('', 'lunch')).toBe('#lunch ')
    expect(toggleTag('Rice  ', 'lunch')).toBe('Rice #lunch ')
  })
  it('takes a tag out, any spelling, and tidies spaces', () => {
    expect(toggleTag('Rice #Lunch with team', 'lunch')).toBe('Rice with team')
    expect(toggleTag('#lunch ', 'lunch')).toBe('')
    expect(toggleTag('Rice #lunchbox', 'lunch')).toBe('Rice #lunchbox #lunch ')
  })
})

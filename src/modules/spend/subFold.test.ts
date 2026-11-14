import { describe, expect, it } from 'vitest'
import type { SpendTransaction } from '../../lib/types'
import { sortSubsByUse, toggleTag } from './logic'

const txn = (categoryId: string, subcategory?: string) => ({ categoryId, subcategory }) as SpendTransaction

describe('sortSubsByUse', () => {
  it('puts the most used first and keeps the added order on ties', () => {
    const txns = [txn('food', 'Sushi'), txn('food', 'Sushi'), txn('food', 'Buffet'), txn('drinks', 'Snack'), txn('drinks', 'Snack'), txn('drinks', 'Snack')]
    expect(sortSubsByUse(['Snack', 'Sushi', 'Buffet', 'Lunch'], 'food', txns)).toEqual(['Sushi', 'Buffet', 'Snack', 'Lunch'])
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

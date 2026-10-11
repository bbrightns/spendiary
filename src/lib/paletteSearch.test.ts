import { describe, expect, it } from 'vitest'
import { amountMatches, editDistance, parseAmountFilter, parseQuickAdd, parseVerb, queryTerms, scoreItem, termScore, usageBoost } from './paletteSearch'

describe('termScore', () => {
  it('ranks exact > prefix > substring > in-order letters > typo', () => {
    const exact = termScore('dca', 'DCA Planner')
    const prefix = termScore('plan', 'DCA Planner')
    const sub = termScore('anner', 'DCA Planner')
    const seq = termScore('pnr', 'DCA Planner')
    const typo = termScore('portfolo', 'Portfolio')
    expect(exact).toBeGreaterThan(prefix)
    expect(prefix).toBeGreaterThan(sub)
    expect(sub).toBeGreaterThan(seq)
    expect(typo).toBeGreaterThan(0)
    expect(termScore('xyz', 'Portfolio')).toBe(0)
  })
  it('matches Thai inside a Thai word', () => {
    expect(termScore('ชานม', 'ชานมไข่มุก')).toBeGreaterThan(0)
  })
  it('keeps numbers and long text strict', () => {
    expect(termScore('1000', '฿ 52,000.00')).toBe(0)
    expect(termScore('nosetea', 'REAL_ESTATE · The Base Sukhumvit (Rental Condo)')).toBe(0)
    expect(termScore('dcap', 'DCA Planner')).toBeGreaterThan(0)
  })
  it('tolerates a typo while typing a longer word', () => {
    expect(termScore('trnas', 'Transactions')).toBeGreaterThan(0)
  })
})

describe('scoreItem', () => {
  it('needs every word to match somewhere', () => {
    const item = { title: 'KTC Visa Platinum', subtitle: 'Credit card', keywords: ['card'] }
    expect(scoreItem(queryTerms('ktc card'), item)).toBeGreaterThan(0)
    expect(scoreItem(queryTerms('ktc salary'), item)).toBe(0)
  })
  it('weights the title above keywords', () => {
    const a = scoreItem(['food'], { title: 'Food' })
    const b = scoreItem(['food'], { title: 'Eating', keywords: ['food'] })
    expect(a).toBeGreaterThan(b)
  })
})

describe('editDistance', () => {
  it('counts swaps as one edit', () => {
    expect(editDistance('fodo', 'food')).toBe(1)
    expect(editDistance('abc', 'xyz', 1)).toBe(2)
  })
})

describe('amounts', () => {
  it('parses filters', () => {
    expect(parseAmountFilter('65')).toEqual({ exact: 65 })
    expect(parseAmountFilter('>1,000')).toEqual({ min: 1000.005 })
    expect(parseAmountFilter('100-500')).toEqual({ min: 100, max: 500 })
    expect(parseAmountFilter('coffee')).toBeUndefined()
  })
  it('matches amounts', () => {
    expect(amountMatches({ exact: 65 }, 65.5)).toBe(true)
    expect(amountMatches({ min: 1000.005 }, 1000)).toBe(false)
    expect(amountMatches({ min: 100, max: 500 }, 250)).toBe(true)
  })
})

describe('commands', () => {
  it('reads a quick add with the amount first or last', () => {
    expect(parseQuickAdd('65 ชานม #nosetea')).toEqual({ type: 'expense', amount: 65, note: 'ชานม #nosetea' })
    expect(parseQuickAdd('lunch 120.50')).toEqual({ type: 'expense', amount: 120.5, note: 'lunch' })
    expect(parseQuickAdd('+500 bonus')).toEqual({ type: 'income', amount: 500, note: 'bonus' })
    expect(parseQuickAdd('65')).toBeUndefined()
    expect(parseQuickAdd('pay 500')).toBeUndefined()
  })
  it('reads verbs', () => {
    expect(parseVerb('pay ktc', ['pay'])).toBe('ktc')
    expect(parseVerb('Budget food', ['budget'])).toBe('food')
    expect(parseVerb('food', ['budget'])).toBeUndefined()
  })
  it('boosts recent, frequent picks', () => {
    const now = Date.now()
    expect(usageBoost(undefined)).toBe(0)
    expect(usageBoost({ n: 10, last: now }, now)).toBeGreaterThan(usageBoost({ n: 1, last: now - 30 * 86_400_000 }, now))
  })
})

import { describe, expect, it } from 'vitest'
import { amountMatches, dateRangeLabel, editDistance, extractDateRange, parseAmountFilter, parseQuickAdd, parseVerb, queryTerms, scoreItem, termScore, usageBoost } from './paletteSearch'

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

describe('extractDateRange', () => {
  // Wednesday 14 Oct 2026
  const today = '2026-10-14'
  const at = (q: string, opts = {}) => extractDateRange(q, { today, ...opts })

  it('reads Thai and English month names, and leaves the rest of the query', () => {
    expect(at('กาแฟ ตุลา')).toEqual({ range: { from: '2026-10-01', to: '2026-10-31' }, rest: 'กาแฟ' })
    expect(at('>500 กันยา')).toEqual({ range: { from: '2026-09-01', to: '2026-09-30' }, rest: '>500' })
    expect(at('food Oct').range).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(at('ต.ค. grab').rest).toBe('grab')
    expect(at('เดือนตุลา').range?.from).toBe('2026-10-01')
  })

  it('a month on its own is the latest one, never one still to come', () => {
    expect(at('ธันวา').range).toEqual({ from: '2025-12-01', to: '2025-12-31' })
    expect(at('feb').range?.from).toBe('2026-02-01')
  })

  it('takes a year after the month, Buddhist era too', () => {
    expect(at('ธันวา 2026').range?.from).toBe('2026-12-01')
    expect(at('มีนา 2568 ค่าไฟ')).toEqual({ range: { from: '2025-03-01', to: '2025-03-31' }, rest: 'ค่าไฟ' })
    expect(at('2026-09').range).toEqual({ from: '2026-09-01', to: '2026-09-30' })
  })

  it('reads days, weeks (Sunday to Saturday) and years', () => {
    expect(at('เมื่อวาน').range).toEqual({ from: '2026-10-13', to: '2026-10-13' })
    expect(at('today coffee')).toEqual({ range: { from: '2026-10-14', to: '2026-10-14' }, rest: 'coffee' })
    expect(at('this week').range).toEqual({ from: '2026-10-11', to: '2026-10-17' })
    expect(at('grab last week')).toEqual({ range: { from: '2026-10-04', to: '2026-10-10' }, rest: 'grab' })
    expect(at('อาทิตย์ที่แล้ว').range?.from).toBe('2026-10-04')
    expect(at('ปีที่แล้ว').range).toEqual({ from: '2025-01-01', to: '2025-12-31' })
  })

  it('this / last month follow the spending month when there is one', () => {
    expect(at('this month').range).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    // Paid on the 29th: 29 Sep – 28 Oct
    const spendingMonth = (date: string) =>
      date >= '2026-09-29' ? { from: '2026-09-29', to: '2026-10-28' } : { from: '2026-08-29', to: '2026-09-28' }
    expect(at('เดือนนี้', { spendingMonth }).range).toEqual({ from: '2026-09-29', to: '2026-10-28' })
    expect(at('last month', { spendingMonth }).range).toEqual({ from: '2026-08-29', to: '2026-09-28' })
  })

  it('no date: the query comes back as it was', () => {
    expect(at('กาแฟ >100')).toEqual({ rest: 'กาแฟ >100' })
  })
})

describe('dateRangeLabel', () => {
  it('says the days it covers', () => {
    expect(dateRangeLabel({ from: '2026-10-01', to: '2026-10-31' })).toBe('1 – 31 Oct 2026')
    expect(dateRangeLabel({ from: '2026-09-29', to: '2026-10-28' })).toBe('29 Sept – 28 Oct 2026')
    expect(dateRangeLabel({ from: '2026-10-13', to: '2026-10-13' })).toBe('13 Oct 2026')
    expect(dateRangeLabel({ from: '2025-12-28', to: '2026-01-03' })).toBe('28 Dec 2025 – 3 Jan 2026')
  })
})

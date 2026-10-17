import { describe, expect, it } from 'vitest'
import { parseCleanNumber, validateSpendiaryData } from './validate'

const valid = () => ({
  cashAccounts: [{ id: 'a1', name: 'Bank', balance: 100 }],
  monthlyIncome: 50000,
  holdings: [{ id: 'h1', name: 'Fund', ticker: 'F', units: 1, avgCost: 10, price: 12, assetClass: 'fund' }],
  dcaPlans: [{ id: 'p1', monthlyAmount: 1000 }],
  transfers: [{ id: 't1', amount: 500, completed: 1, total: 3 }],
})

describe('validateSpendiaryData', () => {
  it('accepts a well-formed backup', () => {
    expect(validateSpendiaryData(valid())).toBe(true)
  })

  it.each([
    ['null', null],
    ['an array', []],
    ['a string', 'data'],
  ])('rejects %s', (_label, input) => {
    expect(validateSpendiaryData(input)).toBe(false)
  })

  it('rejects a backup without holdings', () => {
    const { holdings: _holdings, ...rest } = valid()
    expect(validateSpendiaryData(rest)).toBe(false)
  })

  it('rejects a holding whose units are text', () => {
    const d = valid()
    d.holdings[0].units = '1' as unknown as number
    expect(validateSpendiaryData(d)).toBe(false)
  })

  it('rejects an unknown asset class', () => {
    const d = valid()
    d.holdings[0].assetClass = 'bond'
    expect(validateSpendiaryData(d)).toBe(false)
  })

  it('rejects an optional list that is not a list', () => {
    expect(validateSpendiaryData({ ...valid(), spendTransactions: {} })).toBe(false)
  })

  it('rejects an unknown rebalance mode', () => {
    expect(validateSpendiaryData({ ...valid(), rebalanceMode: 'random' })).toBe(false)
  })

  it('rejects a cash account without a numeric balance', () => {
    expect(validateSpendiaryData({ ...valid(), cashAccounts: [{ id: 'a1', balance: '100' }] })).toBe(false)
  })
})

describe('parseCleanNumber', () => {
  it('reads numbers with thousands separators', () => {
    expect(parseCleanNumber('1,234.50')).toBe(1234.5)
  })

  it('passes real numbers through', () => {
    expect(parseCleanNumber(42)).toBe(42)
  })

  it.each([['text', 'abc'], ['NaN', Number.NaN], ['undefined', undefined], ['an object', {}]])('falls back for %s', (_label, input) => {
    expect(parseCleanNumber(input, 7)).toBe(7)
  })
})

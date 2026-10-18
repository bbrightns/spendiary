import { describe, expect, it } from 'vitest'
import { inferAssetClass } from './assetClass'

// In Spendiary, 'fund' holds Thai assets (stocks, funds, DRs) in THB and 'stock' holds US assets in USD
describe('inferAssetClass', () => {
  it.each([
    ['BTC', 'Bitcoin', 'crypto'],
    ['GOLD', 'Gold 96.5%', 'gold'],
    ['XYZ', 'ทองคำแท่ง', 'fund'],
    ['PTT', 'PTT Public Company', 'fund'],
    ['PTT.BK', 'PTT', 'fund'],
    ['AAPL80X', 'Apple DR', 'fund'],
    ['K-USA-A', 'K US Equity Fund', 'fund'],
    ['กองทุนไทย', '', 'fund'],
    ['AAPL', 'Apple', 'stock'],
    ['VOO', 'Vanguard S&P 500', 'stock'],
  ])('%s (%s) is %s', (ticker, name, expected) => {
    expect(inferAssetClass(ticker, name)).toBe(expected)
  })

  it('lets an explicit class decide', () => {
    expect(inferAssetClass('ABC', '', 'crypto')).toBe('crypto')
    expect(inferAssetClass('ABC', '', 'Thai Stock')).toBe('fund')
    expect(inferAssetClass('ABC', '', 'US ETF')).toBe('stock')
  })

  it('uses the currency for unknown tickers', () => {
    expect(inferAssetClass('ZZZZZZ', '', undefined, 'THB')).toBe('fund')
    expect(inferAssetClass('ZZZZZZ', '', undefined, 'USD')).toBe('stock')
  })

  it("doesn't guess when nothing says what an unknown ticker is", () => {
    expect(inferAssetClass('ABCD', '')).toBeNull()
    expect(inferAssetClass('ABCDEFG', '')).toBeNull()
    expect(inferAssetClass('ABC', '', 'bond')).toBeNull()
  })

  it('keeps an explicit real estate class', () => {
    expect(inferAssetClass('CONDO', 'My condo', 'real_estate')).toBe('real_estate')
  })
})

import { describe, expect, it } from 'vitest'
import { holdingMetrics } from '../../lib/calc'
import type { Holding } from '../../lib/types'
import { PORTFOLIO_CSV_HEADER, portfolioCsvRows, unitLabel } from './portfolioCsv'

describe('unitLabel', () => {
  it('names the unit of each asset class', () => {
    expect(unitLabel('fund')).toBe('units')
    expect(unitLabel('stock')).toBe('shares')
    expect(unitLabel('crypto')).toBe('BTC')
    expect(unitLabel('gold')).toBe('g')
    expect(unitLabel('real_estate')).toBe('units')
    expect(unitLabel('cash')).toBe('THB')
  })
})

describe('portfolioCsvRows', () => {
  it('writes "units", not "BTC", for a property', () => {
    const condo = { id: 'c', name: 'Condo', ticker: 'CONDO', assetClass: 'real_estate', units: 1, avgCost: 2_600_000, price: 2_850_000 } as Holding
    const [row] = portfolioCsvRows([holdingMetrics(condo)], 2_850_000, 35)
    expect(row[PORTFOLIO_CSV_HEADER.indexOf('Unit')]).toBe('units')
  })
})

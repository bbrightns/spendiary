import { describe, expect, it } from 'vitest'
import type { SpendiaryData } from '../../lib/types'
import { emptyData } from '../migrate'
import { applyImport, prepareImport } from './importPortfolio'

const prepared = (payload: Parameters<typeof prepareImport>[0], mode: 'merge' | 'replace' = 'merge', usdThb: number | null = 35) => {
  const result = prepareImport(payload, mode, usdThb)
  if (!result.ok) throw new Error(result.error)
  return result.prepared
}

describe('prepareImport', () => {
  it('refuses an empty paste', () => {
    expect(prepareImport({}, 'merge', 35)).toEqual({ ok: false, error: 'No holdings or cash accounts found in the provided data.' })
  })

  it('refuses to guess what kind of asset something is', () => {
    const r = prepareImport({ holdings: [{ name: 'Mystery', units: 1 }] }, 'merge', 35)
    expect(r.ok).toBe(false)
  })

  it('refuses USD holdings while no exchange rate has loaded', () => {
    const r = prepareImport({ holdings: [{ ticker: 'AAPL', assetClass: 'stock', units: 1, avgCost: 200 }] }, 'merge', null)
    expect(r).toMatchObject({ ok: false })
  })

  it('cleans tickers and converts USD costs with the rate', () => {
    const p = prepared({ holdings: [
      { ticker: 'PTT.BK', name: 'PTT', assetClass: 'fund', units: '1,000', avgCost: 33, price: 35 },
      { ticker: 'AAPL', assetClass: 'stock', currency: 'USD', units: 2, avgCost: 200 },
    ] })
    expect(p.sanitizedHoldings[0]).toMatchObject({ ticker: 'PTT', units: 1000, avgCost: 33, totalThbInvested: 33_000, price: 35 })
    expect(p.sanitizedHoldings[0].placeholderPrice).toBeUndefined()
    // No price in the file: counted at cost and marked as having no real price
    expect(p.sanitizedHoldings[1]).toMatchObject({ avgCostUsd: 200, avgCostThb: 7000, totalThbInvested: 14_000, price: 7000, placeholderPrice: 7000 })
  })

  it('cleans cash accounts and debts', () => {
    const p = prepared({
      cashAccounts: [{ name: 'KBank', balance: '12,500.50' }, { name: '' }],
      liabilities: [{ name: 'Car', balance: 300_000, category: 'auto_loan' }, { name: 'Odd', balance: 5, category: 'weird' }],
    })
    expect(p.sanitizedCash).toHaveLength(1)
    expect(p.sanitizedCash[0]).toMatchObject({ name: 'KBank', balance: 12_500.5, currency: 'THB', bankPreset: 'kbank', category: 'spending' })
    expect(p.sanitizedLiabilities.map((l) => l.category)).toEqual(['auto_loan', 'other'])
    expect(p.logEntry.holdingName).toBe('AI Import (1 cash accounts, 2 liabilities)')
  })
})

describe('applyImport', () => {
  const prev: SpendiaryData = {
    ...emptyData,
    holdings: [{ id: 'keep', name: 'PTT', ticker: 'PTT', assetClass: 'fund', units: 1, avgCost: 30, price: 30 }],
    cashAccounts: [{ id: 'kb', name: 'kbank', balance: 1 }],
    liabilities: [{ id: 'old', name: 'Phone', category: 'installment', balance: 9 }],
  }
  const p = prepared({
    holdings: [{ ticker: 'PTT', assetClass: 'fund', units: 5, avgCost: 33, price: 35 }, { ticker: 'SCB', assetClass: 'fund', units: 2, avgCost: 10, price: 10 }],
    cashAccounts: [{ name: 'KBank', balance: 100 }],
  })

  it('merges by ticker and account name, keeping the existing ids', () => {
    const out = applyImport(prev, p, 'merge')
    expect(out.holdings.map((h) => [h.id === 'keep', h.ticker, h.units])).toEqual([[true, 'PTT', 5], [false, 'SCB', 2]])
    expect(out.cashAccounts).toEqual([expect.objectContaining({ id: 'kb', name: 'KBank', balance: 100 })])
    expect(out.liabilities).toEqual(prev.liabilities) // none imported: left alone
    expect(out.holdingLogs?.[0].ticker).toBe('IMPORT')
  })

  it('replaces everything in replace mode', () => {
    const out = applyImport(prev, p, 'replace')
    expect(out.holdings.map((h) => h.ticker)).toEqual(['PTT', 'SCB'])
    expect(out.holdings[0].id).not.toBe('keep')
    expect(out.liabilities).toEqual([])
  })
})

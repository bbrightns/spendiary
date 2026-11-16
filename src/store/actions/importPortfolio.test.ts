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

  it('merges the same US stock held at two brokers into one holding with one location each', () => {
    const p = prepared({ holdings: [
      { ticker: 'AAPL', assetClass: 'stock', currency: 'USD', units: 6, avgCost: 200, broker: 'Webull' },
      { ticker: 'AAPL', assetClass: 'stock', currency: 'USD', units: 4, avgCost: 250, broker: 'Dime' },
    ] })
    expect(p.sanitizedHoldings).toHaveLength(1)
    const h = p.sanitizedHoldings[0]
    expect(h.locations?.map((l) => [l.name, l.qty, l.usdSpent])).toEqual([['Webull', 6, 1200], ['Dime', 4, 1000]])
    expect(h).toMatchObject({ units: 10, totalUsdInvested: 2200, totalThbInvested: 77_000 })
  })

  it('keeps a locations list only when it adds up to the units', () => {
    const ok = prepared({ holdings: [{ ticker: 'AAPL', assetClass: 'stock', currency: 'USD', units: 10, avgCost: 220,
      locations: [{ name: 'Webull', qty: 6, usdSpent: 1320 }, { name: 'Dime', qty: 4, usdSpent: 880 }] }] })
    expect(ok.sanitizedHoldings[0].locations).toHaveLength(2)
    const off = prepared({ holdings: [{ ticker: 'AAPL', assetClass: 'stock', currency: 'USD', units: 10, avgCost: 220,
      locations: [{ name: 'Webull', qty: 6 }] }] })
    expect(off.sanitizedHoldings[0].locations).toBeUndefined()
  })

  it('reads the old BTC wallet fields from an import', () => {
    const p = prepared({ holdings: [{ ticker: 'BTC', assetClass: 'crypto', units: 0.5, avgCost: 2_000_000,
      btcLocations: [{ id: 'a', name: 'Ledger', satoshi: 50_000_000, thbSpent: 1_000_000 }] }] })
    expect(p.sanitizedHoldings[0].locations).toEqual([{ id: 'a', name: 'Ledger', qty: 0.5, thbSpent: 1_000_000 }])
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

  describe('merging onto what is already there', () => {
    const mine: SpendiaryData = {
      ...emptyData,
      cashAccounts: [
        { id: 'usd', name: 'Dime FCD', balance: 1_000, currency: 'USD', thbCost: 36_500, category: 'locked', bankPreset: 'dime' },
        { id: 'ef', name: 'Emergency fund', balance: 50_000, category: 'locked', bankPreset: 'scb', archived: true },
      ],
      liabilities: [
        { id: 'car', name: 'Car', category: 'auto_loan', balance: 300_000, interestRate: 2.79, monthlyPayment: 8_500, lender: 'Toyota Leasing', dueDay: 5, note: 'ends 2029', isInstallment: true, totalInstallments: 60, paidInstallments: 24, createdAt: '2024-11-05', updatedAt: '2026-10-05' },
      ],
    }

    it('updates a balance without wiping what the row did not mention', () => {
      const out = applyImport(mine, prepared({ cashAccounts: [{ name: 'dime fcd', balance: 1_200 }, { name: 'Emergency Fund', balance: 60_000 }], liabilities: [{ name: 'car', balance: 291_500 }] }), 'merge')
      // Still dollars: a row without a currency must not turn 1,200 USD into 1,200 baht
      expect(out.cashAccounts[0]).toMatchObject({ id: 'usd', balance: 1_200, currency: 'USD', thbCost: 36_500, category: 'locked', bankPreset: 'dime' })
      expect(out.cashAccounts[1]).toMatchObject({ id: 'ef', balance: 60_000, category: 'locked', bankPreset: 'scb', archived: true })
      expect(out.liabilities?.[0]).toMatchObject({
        id: 'car', balance: 291_500, category: 'auto_loan', interestRate: 2.79, monthlyPayment: 8_500, lender: 'Toyota Leasing', dueDay: 5, note: 'ends 2029',
        isInstallment: true, totalInstallments: 60, paidInstallments: 24, createdAt: '2024-11-05',
      })
    })

    it('takes over what the row does state', () => {
      const out = applyImport(
        mine,
        prepared({
          cashAccounts: [{ name: 'Dime FCD', balance: 5, currency: 'THB', category: 'spending' }],
          liabilities: [{ name: 'Car', balance: 1, category: 'personal_loan', interestRate: 3, dueDay: 9, paidInstallments: 25, isInstallment: false }],
        }),
        'merge',
      )
      expect(out.cashAccounts[0]).toMatchObject({ balance: 5, currency: 'THB', category: 'spending' })
      expect(out.liabilities?.[0]).toMatchObject({ balance: 1, category: 'personal_loan', interestRate: 3, dueDay: 9, paidInstallments: 25, isInstallment: false, lender: 'Toyota Leasing' })
    })

    it('still fills in the defaults for an account or debt that is new', () => {
      const out = applyImport(mine, prepared({ cashAccounts: [{ name: 'KBank', balance: 10 }], liabilities: [{ name: 'Phone', balance: 9_000, category: 'installment' }] }), 'merge')
      expect(out.cashAccounts[2]).toMatchObject({ name: 'KBank', balance: 10, currency: 'THB', category: 'spending', bankPreset: 'kbank' })
      expect(out.liabilities?.[1]).toMatchObject({ name: 'Phone', balance: 9_000, category: 'installment', isInstallment: true })
    })
  })

  it('never imports a balance that is not a real number, and rounds to the satang', () => {
    // JSON.parse reads 1e999 as Infinity, which would be saved as null
    const pasted = JSON.parse('{"cashAccounts":[{"name":"A","balance":1e999},{"name":"B","balance":"Infinity"},{"name":"C","balance":100.10000000000001}],"liabilities":[{"name":"L","balance":-1e999},{"name":"M","balance":0.30000000000000004}]}')
    expect(pasted.cashAccounts[0].balance).toBe(Number.POSITIVE_INFINITY)
    const p2 = prepared(pasted)
    expect(p2.sanitizedCash.map((c) => c.balance)).toEqual([0, 0, 100.1])
    expect(p2.sanitizedLiabilities.map((l) => l.balance)).toEqual([0, 0.3])
  })
})

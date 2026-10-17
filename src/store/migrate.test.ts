import { describe, expect, it } from 'vitest'
import type { Holding, SpendiaryData } from '../lib/types'
import { justImportedFixedCosts, migrate } from './migrate'

/** Old saved data can be missing almost anything, so tests feed migrate() loose shapes */
const legacy = (raw: Record<string, unknown>) => raw as unknown as SpendiaryData & { cash?: number }

const holding = (over: Partial<Holding>): Holding =>
  ({ id: 'h1', name: 'Test', ticker: 'TEST', assetClass: 'fund', units: 10, avgCost: 100, price: 120, ...over }) as Holding

describe('migrate', () => {
  it('fills every missing field with a safe default', () => {
    const out = migrate(legacy({}))
    expect(out.monthlyIncome).toBe(0)
    expect(out.cashAccounts).toEqual([])
    expect(out.holdings).toEqual([])
    expect(out.dcaPlans).toEqual([])
    expect(out.liabilities).toEqual([])
    expect(out.plannedAssets).toEqual([])
    expect(out.rebalanceMode).toBe('class')
    expect(out.rebalanceHoldingTargets).toEqual({})
    expect(out.spendSettings?.fixedCostsImported).toBe(true)
  })

  it('turns the old single cash number into a Cash account and drops the old field', () => {
    const out = migrate(legacy({ cash: 500 }))
    expect(out.cashAccounts).toHaveLength(1)
    expect(out.cashAccounts[0]).toMatchObject({ name: 'Cash', balance: 500 })
    expect('cash' in out).toBe(false)
  })

  it('ignores the old cash number when accounts already exist', () => {
    const accounts = [{ id: 'a1', name: 'Bank', balance: 10 }]
    expect(migrate(legacy({ cash: 500, cashAccounts: accounts })).cashAccounts).toEqual(accounts)
  })

  it('renames old DCA fields and keeps everything else on the plan', () => {
    const out = migrate(legacy({ dcaPlans: [{ id: 'p1', monthlyTarget: 2000, frequency: 'weekly', holdingId: 'h1' }] }))
    expect(out.dcaPlans[0]).toMatchObject({ id: 'p1', monthlyAmount: 2000, dayOfMonth: 1, frequency: 'weekly', holdingId: 'h1' })
  })

  it('moves the old monthly fixed cost into a Spend recurring bill', () => {
    const out = migrate(legacy({ monthlyFixedCost: 3000 }))
    expect(out.spendRecurring).toHaveLength(1)
    expect(out.spendRecurring?.[0]).toMatchObject({ amount: 3000, type: 'expense', frequency: 'monthly', fixedCost: true })
  })

  it('fills in units, invested total and THB cost on a holding', () => {
    const out = migrate(legacy({ holdings: [holding({ units: undefined, totalUnits: 4, avgCost: 250 })] }))
    expect(out.holdings[0]).toMatchObject({ units: 4, totalUnits: 4, totalThbInvested: 1000, avgCostThb: 250 })
  })

  it('totals a crypto holding from its wallet locations', () => {
    const btc = holding({ assetClass: 'crypto', btcLocations: [{ id: 'l1', thbSpent: 300 }, { id: 'l2', thbSpent: 700 }] as Holding['btcLocations'] })
    expect(migrate(legacy({ holdings: [btc] })).holdings[0].totalThbInvested).toBe(1000)
  })

  it('keeps an invested total that is already there', () => {
    expect(migrate(legacy({ holdings: [holding({ totalThbInvested: 999 })] })).holdings[0].totalThbInvested).toBe(999)
  })

  it('falls back to the cost when a holding has no price', () => {
    expect(migrate(legacy({ holdings: [holding({ price: 0, avgCost: 80 })] })).holdings[0].price).toBe(80)
  })

  it('leaves a stock price as saved, even when it fell a lot', () => {
    // Bought at ฿5,000 and now worth ฿900: a real drop, not a price in dollars
    const fell = holding({ assetClass: 'stock', price: 900, avgCost: 5000, avgCostThb: 5000, avgCostUsd: 150 })
    expect(migrate(legacy({ holdings: [fell] })).holdings[0].price).toBe(900)
    const noUsdCost = holding({ assetClass: 'stock', price: 100, avgCost: 3400, avgCostThb: 3400 })
    expect(migrate(legacy({ holdings: [noUsdCost] })).holdings[0].price).toBe(100)
  })

  it('does not change the object it was given', () => {
    const raw = legacy({ cash: 500, holdings: [holding({})] })
    const before = JSON.stringify(raw)
    migrate(raw)
    expect(JSON.stringify(raw)).toBe(before)
  })

  it('gives the same result when run twice', () => {
    const once = migrate(legacy({ monthlyIncome: 50000, holdings: [holding({})], dcaPlans: [{ id: 'p1', monthlyTarget: 1000 }] }))
    expect(migrate(once)).toEqual(once)
  })
})

describe('justImportedFixedCosts', () => {
  it('is true only on the run that moved the fixed costs', () => {
    const before = legacy({})
    const after = migrate(before)
    expect(justImportedFixedCosts(before, after)).toBe(true)
    expect(justImportedFixedCosts(after, migrate(after))).toBe(false)
  })
})

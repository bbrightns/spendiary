import { describe, expect, it, vi } from 'vitest'
import type { Holding, SpendiaryData } from '../lib/types'
import { DATA_SCHEMA, isFromNewerApp, justImportedFixedCosts, migrate } from './migrate'

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

  it('pauses recurring items whose wallet was deleted before the app paused them on delete', () => {
    const base = { name: 'x', amount: 1, categoryId: 'bills', frequency: 'monthly', day: 1, startDate: '2026-01-01' }
    const out = migrate(
      legacy({
        cashAccounts: [{ id: 'kbank', name: 'KBank', balance: 1 }],
        spendRecurring: [
          { ...base, id: 'ok', type: 'expense', accountId: 'kbank' },
          { ...base, id: 'gone', type: 'expense', accountId: 'deleted' },
          { ...base, id: 'none', type: 'income' },
        ],
      }),
    )
    expect(out.spendRecurring?.map((r) => [r.id, !!r.paused])).toEqual([
      ['ok', false],
      ['gone', true],
      ['none', false],
    ])
    expect(out.spendRecurring?.[1].pausedReason).toBe('accountRemoved')
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
    const btc = holding({ assetClass: 'crypto', locations: [{ id: 'l1', thbSpent: 300 }, { id: 'l2', thbSpent: 700 }] as Holding['locations'] })
    expect(migrate(legacy({ holdings: [btc] })).holdings[0].totalThbInvested).toBe(1000)
  })

  it('keeps an invested total that is already there', () => {
    expect(migrate(legacy({ holdings: [holding({ totalThbInvested: 999 })] })).holdings[0].totalThbInvested).toBe(999)
  })

  it('falls back to the cost when a holding has no price, and marks it as having none', () => {
    const h = migrate(legacy({ holdings: [holding({ price: 0, avgCost: 80 })] })).holdings[0]
    expect(h.price).toBe(80)
    expect(h.placeholderPrice).toBe(80)
    expect(migrate(legacy({ holdings: [holding({ price: 120 })] })).holdings[0].placeholderPrice).toBeUndefined()
  })

  it('leaves a stock price as saved, even when it fell a lot', () => {
    // Bought at ฿5,000 and now worth ฿900: a real drop, not a price in dollars
    const fell = holding({ assetClass: 'stock', price: 900, avgCost: 5000, avgCostThb: 5000, avgCostUsd: 150 })
    expect(migrate(legacy({ holdings: [fell] })).holdings[0].price).toBe(900)
    const noUsdCost = holding({ assetClass: 'stock', price: 100, avgCost: 3400, avgCostThb: 3400 })
    expect(migrate(legacy({ holdings: [noUsdCost] })).holdings[0].price).toBe(100)
  })

  it('clears the float noise an older version left on loan balances', () => {
    // Paying 1000 in three parts used to leave 1.1e-13, so the loan never counted as paid off
    const out = migrate(
      legacy({
        liabilities: [
          { id: 'l1', name: 'Phone', category: 'installment', balance: 1.1368683772161603e-13, lastPaidAmount: 333.3400000000001 },
          { id: 'l2', name: 'Car', category: 'auto_loan', balance: 666.6700000000001 },
          { id: 'l3', name: 'Home', category: 'mortgage', balance: 1_250_000.5 },
        ],
      }),
    )
    expect(out.liabilities?.map((l) => l.balance)).toEqual([0, 666.67, 1_250_000.5])
    expect(out.liabilities?.[0].lastPaidAmount).toBe(333.34)
    expect(migrate(out)).toEqual(out)
  })

  it('keeps a loan as it is when its numbers are already whole satang', () => {
    const liabilities = [{ id: 'l1', name: 'Phone', category: 'installment', balance: 2000, monthlyPayment: 1000 }]
    expect(migrate(legacy({ liabilities })).liabilities).toEqual(liabilities)
  })

  it('replaces a list that was saved as null with an empty one', () => {
    const out = migrate(legacy({ transfers: null, dividendRecords: null }))
    expect(out.transfers).toEqual([])
    expect(out.dividendRecords).toEqual([])
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

describe('migrate: damaged lists', () => {
  /** Silences the "dropped" warnings and returns what was logged */
  const quiet = () => vi.spyOn(console, 'warn').mockImplementation(() => {})

  it('drops a null entry from every top-level list instead of throwing', () => {
    const warn = quiet()
    const lists = ['cashAccounts', 'holdings', 'holdingLogs', 'dcaPlans', 'transfers', 'plannedAssets', 'dividendRecords', 'liabilities', 'spendTransactions', 'spendCards', 'spendRecurring', 'spendGoals', 'fxExchanges', 'netWorthHistory', 'portfolioHistory', 'fixedCostItems']
    for (const key of lists) {
      const out = migrate(legacy({ [key]: [null] })) as unknown as Record<string, unknown>
      // fixedCostItems is a legacy list that migrate removes once imported
      if (key !== 'fixedCostItems') expect(out[key], key).toEqual([])
    }
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('keeps the valid entries around the dropped ones, in order', () => {
    const warn = quiet()
    const out = migrate(
      legacy({
        holdings: [null, holding({ id: 'a' }), 'oops', holding({ id: 'b' }), 7, [holding({ id: 'nested' })]],
        cashAccounts: [{ id: 'k', name: 'KBank', balance: 10 }, null, { id: 's', name: 'SCB', balance: 20 }],
        dcaPlans: [null, { id: 'p1', monthlyAmount: 500, dayOfMonth: 5 }],
      }),
    )
    expect(out.holdings.map((h) => h.id)).toEqual(['a', 'b'])
    expect(out.cashAccounts.map((a) => a.id)).toEqual(['k', 's'])
    expect(out.dcaPlans.map((p) => p.id)).toEqual(['p1'])
    expect(warn.mock.calls.flat().join(' ')).toContain('holdings')
    warn.mockRestore()
  })

  it('drops null entries from lists nested inside entries', () => {
    const warn = quiet()
    const out = migrate(
      legacy({
        holdings: [holding({ assetClass: 'crypto', locations: [null, { id: 'l1', name: 'Ledger', qty: 1, thbSpent: 300 }] as unknown as Holding['locations'], dividendMonths: [3, null, 9] as unknown as number[] })],
        dcaPlans: [{ id: 'p1', monthlyAmount: 500, dayOfMonth: 5, confirmedDates: ['2026-01-05', null] }],
        spendSettings: { fixedCostsImported: true, cardOrder: [null, 'c1'], subcategories: { food: ['Lunch', null] } },
        holdingLogs: [{ id: 'g1', previousCashAccountsState: [null, { id: 'k', name: 'KBank', balance: 1 }] }],
      }),
    )
    expect(out.holdings[0].locations).toEqual([{ id: 'l1', name: 'Ledger', qty: 1, thbSpent: 300 }])
    expect(out.holdings[0].dividendMonths).toEqual([3, 9])
    expect(out.dcaPlans[0].confirmedDates).toEqual(['2026-01-05'])
    expect(out.spendSettings?.cardOrder).toEqual(['c1'])
    expect(out.spendSettings?.subcategories).toEqual({ food: ['Lunch'] })
    expect(out.holdingLogs?.[0].previousCashAccountsState).toEqual([{ id: 'k', name: 'KBank', balance: 1 }])
    warn.mockRestore()
  })

  it('does not throw when a required list was saved as something that is not a list', () => {
    const warn = quiet()
    const out = migrate(legacy({ holdings: { a: 1 }, dcaPlans: 'x', cashAccounts: 5, spendCards: {}, spendTransactions: 'x' }))
    expect(out.holdings).toEqual([])
    expect(out.dcaPlans).toEqual([])
    expect(out.cashAccounts).toEqual([])
    expect(out.spendCards).toBeUndefined()
    expect(out.spendTransactions).toBeUndefined()
    warn.mockRestore()
  })

  it('says nothing and keeps every entry (same objects) when the lists are clean', () => {
    const warn = quiet()
    const txn = { id: 't1', type: 'expense', amount: 100, date: '2026-01-01', categoryId: 'food', tags: ['a', 'b'] }
    const card = { id: 'c1', name: 'Visa', creditLimit: 1000, balance: 250.5, statementDay: 1, dueDay: 15 }
    const account = { id: 'k', name: 'KBank', balance: 10.25 }
    const out = migrate(legacy({ spendTransactions: [txn], spendCards: [card], cashAccounts: [account], dcaCardOrder: ['x', 'y'] }))
    expect(out.spendTransactions?.[0]).toBe(txn)
    expect(out.spendCards?.[0]).toBe(card)
    expect(out.cashAccounts[0]).toBe(account)
    expect(out.dcaCardOrder).toEqual(['x', 'y'])
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('does not change the damaged object it was given', () => {
    const warn = quiet()
    const raw = legacy({ holdings: [null, holding({})], spendSettings: { cardOrder: [null, 'c1'] } })
    const before = JSON.stringify(raw)
    migrate(raw)
    expect(JSON.stringify(raw)).toBe(before)
    warn.mockRestore()
  })
})

describe('migrate: balances rounded to the satang', () => {
  it('clears float noise on wallet and card balances', () => {
    const out = migrate(
      legacy({
        cashAccounts: [
          { id: 'a', name: 'Wallet', balance: -1.1368683772161603e-13 },
          { id: 'b', name: 'KBank', balance: 0.30000000000000004 },
          { id: 'c', name: 'USD', balance: 12.345, currency: 'USD', thbCost: 400.123456 },
        ],
        spendCards: [
          { id: 'c1', name: 'Visa', creditLimit: 1000, balance: 1e-13, statementDay: 1, dueDay: 15 },
          { id: 'c2', name: 'Amex', creditLimit: 1000, balance: 99.99000000000001, statementDay: 1, dueDay: 15 },
        ],
      }),
    )
    expect(out.cashAccounts.map((a) => a.balance)).toEqual([0, 0.3, 12.35])
    // Not minus zero: `-0 < 0` is false, but it would print as "-0"
    expect(Object.is(out.cashAccounts[0].balance, -0)).toBe(false)
    // Only the balance is touched
    expect(out.cashAccounts[2].thbCost).toBe(400.123456)
    expect(out.spendCards?.map((c) => c.balance)).toEqual([0, 99.99])
  })

  it('leaves balances that are not finite numbers alone, and keeps unchanged entries as the same objects', () => {
    const clean = { id: 'a', name: 'Wallet', balance: -250.5 }
    const odd = { id: 'b', name: 'Odd', balance: Number.NaN }
    const text = { id: 'c', name: 'Text', balance: '12.005' }
    const inf = { id: 'c1', name: 'Visa', creditLimit: 1, balance: Number.POSITIVE_INFINITY, statementDay: 1, dueDay: 15 }
    const card = { id: 'c2', name: 'Amex', creditLimit: 1, balance: 10, statementDay: 1, dueDay: 15 }
    const out = migrate(legacy({ cashAccounts: [clean, odd, text], spendCards: [inf, card] }))
    expect(out.cashAccounts[0]).toBe(clean)
    expect(out.cashAccounts[1]).toBe(odd)
    expect(out.cashAccounts[2]).toBe(text)
    expect(out.spendCards?.[0]).toBe(inf)
    expect(out.spendCards?.[1]).toBe(card)
  })
})

describe('migrate: running it twice changes nothing more', () => {
  const cases: Record<string, Record<string, unknown>> = {
    'null entries in lists': { holdings: [null, holding({})], cashAccounts: [null], dcaPlans: [null, { id: 'p1', monthlyTarget: 100 }], liabilities: [null], spendCards: [null], spendRecurring: [null] },
    'nested null entries': { holdings: [holding({ assetClass: 'crypto', locations: [null, { id: 'l1', name: 'L', qty: 1, thbSpent: 300 }] as unknown as Holding['locations'] })], spendSettings: { cardOrder: [null, 'c1'] } },
    'lists that are not lists': { holdings: {}, dcaPlans: 'x', cashAccounts: 5, spendCards: {} },
    'float noise on balances': {
      cashAccounts: [{ id: 'a', name: 'W', balance: -1e-13 }, { id: 'b', name: 'K', balance: 0.30000000000000004 }, { id: 'c', name: 'N', balance: Number.NaN }],
      spendCards: [{ id: 'c1', name: 'Visa', creditLimit: 1000, balance: 1e-13, statementDay: 1, dueDay: 15 }],
      liabilities: [{ id: 'l1', name: 'Phone', category: 'installment', balance: 1.1e-13, lastPaidAmount: 333.3400000000001 }],
    },
    'half-satang balances': { cashAccounts: [{ id: 'a', name: 'W', balance: 1.005 }, { id: 'b', name: 'K', balance: 2.675 }, { id: 'c', name: 'N', balance: -0.005 }] },
  }
  for (const [name, raw] of Object.entries(cases)) {
    it(name, () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const once = migrate(legacy(raw))
      warn.mockClear()
      const twice = migrate(once)
      expect(twice).toEqual(once)
      // Nothing left to drop the second time
      expect(warn).not.toHaveBeenCalled()
      warn.mockRestore()
    })
  }
})

describe('justImportedFixedCosts', () => {
  it('is true only on the run that moved the fixed costs', () => {
    const before = legacy({})
    const after = migrate(before)
    expect(justImportedFixedCosts(before, after)).toBe(true)
    expect(justImportedFixedCosts(after, migrate(after))).toBe(false)
  })

  it('drops the saved data schema stamp from the data in memory', () => {
    expect(migrate(legacy({ dataSchema: 2 }))).not.toHaveProperty('dataSchema')
  })
})

describe('isFromNewerApp', () => {
  it('flags data saved by a newer version only', () => {
    expect(isFromNewerApp({ dataSchema: DATA_SCHEMA + 1 })).toBe(true)
    expect(isFromNewerApp({ dataSchema: DATA_SCHEMA })).toBe(false)
    expect(isFromNewerApp({})).toBe(false)
    expect(isFromNewerApp(null)).toBe(false)
  })
})

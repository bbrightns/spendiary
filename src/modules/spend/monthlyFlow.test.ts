import { describe, expect, it } from 'vitest'
import { livingAverage, livingSpend, monthlyFlow } from './monthlyFlow'
import type { SpendRecurring, SpendTransaction } from '../../lib/types'

const txn = (date: string, amount: number, extra: Partial<SpendTransaction> = {}): SpendTransaction => ({
  id: `${date}-${amount}`, type: 'expense', amount, date, categoryId: 'food', tags: [], createdAt: date, ...extra,
} as SpendTransaction)

const rent: SpendRecurring = {
  id: 'rent', name: 'Rent', type: 'expense', amount: 7000, categoryId: 'home', frequency: 'monthly', day: 1, startDate: '2026-01-01',
} as SpendRecurring

describe('livingSpend', () => {
  it('leaves out fixed bills and one-offs, nets money paid back', () => {
    const txns = [
      txn('2026-10-02', 300),
      txn('2026-10-01', 7000, { recurring: { id: 'rent', date: '2026-10-01' } }),
      txn('2026-10-05', 20000, { outsideBudget: true }),
      txn('2026-10-06', 100, { type: 'income', paidBack: true }),
      txn('2026-10-07', 5000, { type: 'income' }),
    ]
    expect(livingSpend(txns, [rent])).toBe(200)
  })

  it('counts a bill whose recurring item was opted out of fixed costs', () => {
    const txns = [txn('2026-10-01', 500, { recurring: { id: 'rent', date: '2026-10-01' } })]
    expect(livingSpend(txns, [{ ...rent, fixedCost: false }])).toBe(500)
  })
})

describe('livingAverage', () => {
  it('averages finished months and skips months with nothing logged', () => {
    const txns = [
      txn('2026-06-10', 9999), // four months back: outside the window
      txn('2026-09-10', 9000),
      txn('2026-08-10', 6000),
      txn('2026-10-15', 50000), // the current month is not finished
    ]
    expect(livingAverage(txns, [], undefined, '2026-10-31')).toEqual({ average: 7500, months: 2 })
  })

  it('is zero with no history', () => {
    expect(livingAverage([], [], undefined, '2026-10-31')).toEqual({ average: 0, months: 0 })
  })
})

describe('monthlyFlow', () => {
  it('reports a shortfall and how long cash covers it', () => {
    const f = monthlyFlow({ salary: 37200, fixed: 7082, living: 10000, invest: 40664, cash: 200000 })
    expect(f.out).toBe(57746)
    expect(f.net).toBe(-20546)
    expect(f.runwayMonths).toBeCloseTo(9.73, 2)
  })

  it('has no runway when salary covers everything', () => {
    const f = monthlyFlow({ salary: 50000, fixed: 7000, living: 10000, invest: 20000, cash: 0 })
    expect(f.net).toBe(13000)
    expect(f.runwayMonths).toBeNull()
  })

  it('treats negative cash as none', () => {
    expect(monthlyFlow({ salary: 0, fixed: 1000, living: 0, invest: 0, cash: -500 }).runwayMonths).toBe(0)
  })
})

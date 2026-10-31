import { describe, expect, it } from 'vitest'
import { flowVerdict, livingAverage, livingPace, livingSpend, monthlyFlow } from './monthlyFlow'
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

describe('flowVerdict', () => {
  const flow = (salary: number, cash: number) => monthlyFlow({ salary, fixed: 7000, living: 10000, invest: 40000, cash })

  it('is covered when salary pays for everything', () => {
    expect(flowVerdict(flow(60000, 0), 0)).toEqual({ kind: 'covered', leftover: 3000 })
  })

  it('tops up from cash when cash lasts', () => {
    expect(flowVerdict(flow(37000, 200000), 200000)).toMatchObject({ kind: 'topUp', topUp: 20000, runwayMonths: 10 })
  })

  it('flags cash running low and says how much DCA to cut', () => {
    expect(flowVerdict(flow(37000, 60000), 60000)).toMatchObject({ kind: 'low', topUp: 20000, cut: 20000, dcaNotEnough: false })
  })

  it('cuts DCA by what cash cannot cover', () => {
    expect(flowVerdict(flow(37000, 5000), 5000)).toEqual({ kind: 'short', topUp: 20000, cut: 15000, dcaNotEnough: false })
  })

  it('says when even no DCA would not be enough', () => {
    expect(flowVerdict(flow(10000, 0), 0)).toEqual({ kind: 'short', topUp: 47000, cut: 40000, dcaNotEnough: true })
  })
})

describe('livingPace', () => {
  const october = { start: '2026-10-01', end: '2026-10-31' }
  it('waits for the first week', () => {
    expect(livingPace(3000, october, '2026-10-06')).toBeNull()
  })
  it('projects the month from the pace so far', () => {
    expect(livingPace(7000, october, '2026-10-07')).toBe(31000)
  })
})

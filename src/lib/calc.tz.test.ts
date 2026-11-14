import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DcaPlan, Liability } from './types'
import { isConfirmedForPeriod, isLiabilityFirstDueNextMonth, isSkippedForPeriod } from './calc'

/**
 * `new Date('2026-11-05')` is midnight UTC, which is still the 4th anywhere west of Greenwich.
 * Dates saved as YYYY-MM-DD must be read as local days.
 */
describe('a plain saved date is read as a local day, west of UTC too', () => {
  const saved = process.env.TZ
  beforeAll(() => {
    process.env.TZ = 'America/Los_Angeles'
  })
  afterAll(() => {
    if (saved === undefined) delete process.env.TZ
    else process.env.TZ = saved
  })

  const loan = (over: Partial<Liability>): Liability => ({ id: 'l1', name: 'Car', category: 'auto_loan', balance: 5000, monthlyPayment: 500, ...over })

  it('a loan added on its due day has its first payment next month', () => {
    const now = new Date(2026, 10, 20, 12)
    expect(new Date('2026-11-05').getDate()).toBe(4) // the trap this guards against
    expect(isLiabilityFirstDueNextMonth(loan({ dueDay: 5, createdAt: '2026-11-05' }), now)).toBe(true)
  })

  it('a loan added on the 1st counts as added this month', () => {
    const now = new Date(2026, 10, 20, 12)
    expect(isLiabilityFirstDueNextMonth(loan({ dueDay: 1, createdAt: '2026-11-01' }), now)).toBe(true)
  })

  it('a weekly DCA buy confirmed on Monday counts for that week', () => {
    // Wednesday 11 Nov 2026; the week began on Monday the 9th
    const now = new Date(2026, 10, 11, 12)
    const plan = { id: 'p', name: 'P', assetClass: 'fund', frequency: 'weekly', monthlyAmount: 1000, dayOfMonth: 1 } as DcaPlan
    expect(isConfirmedForPeriod({ ...plan, confirmedDates: ['2026-11-09'] }, now)).toBe(true)
    expect(isSkippedForPeriod({ ...plan, skippedDates: ['2026-11-09'] }, now)).toBe(true)
    // Last week's Sunday stays last week
    expect(isConfirmedForPeriod({ ...plan, confirmedDates: ['2026-11-08'] }, now)).toBe(false)
  })
})

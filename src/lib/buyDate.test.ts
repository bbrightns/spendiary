import { describe, expect, it } from 'vitest'
import type { DcaPlan } from './types'
import { buyDateThisPeriod } from './calc'

const plan = (over: Partial<DcaPlan>) => ({ id: 'p', name: 'P', assetClass: 'fund', monthlyAmount: 1000, dayOfMonth: 15, ...over }) as DcaPlan
const day = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`

describe('buyDateThisPeriod', () => {
  const sun18Oct = new Date(2026, 9, 18, 21, 30)

  it('monthly: this month on the plan day', () => {
    expect(day(buyDateThisPeriod(plan({}), sun18Oct))).toBe('2026-10-15')
  })

  it('monthly: a day past the month end falls on the last day', () => {
    expect(day(buyDateThisPeriod(plan({ dayOfMonth: 31 }), new Date(2026, 1, 28)))).toBe('2026-2-28')
  })

  it('weekly: the buy day of this Monday-to-Sunday week', () => {
    // dayOfMonth % 7 is the weekday: 1 = Monday
    expect(day(buyDateThisPeriod(plan({ frequency: 'weekly', dayOfMonth: 1 }), sun18Oct))).toBe('2026-10-12')
  })

  it('daily: today', () => {
    expect(day(buyDateThisPeriod(plan({ frequency: 'daily' }), sun18Oct))).toBe('2026-10-18')
  })
})

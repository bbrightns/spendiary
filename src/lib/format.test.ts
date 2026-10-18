import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { localDateStr, localDay, thbExact } from './format'
import { isConfirmedForPeriod, isSkippedForPeriod } from './calc'
import type { DcaPlan } from './types'

// Thailand is UTC+7: anything before 7am local is still the previous day in UTC
const originalTz = process.env.TZ
beforeAll(() => {
  process.env.TZ = 'Asia/Bangkok'
})
afterAll(() => {
  if (originalTz === undefined) delete process.env.TZ
  else process.env.TZ = originalTz
})

/** 06:30 on 18 Oct in Bangkok = 23:30 on 17 Oct in UTC */
const EARLY_MORNING = '2026-10-17T23:30:00.000Z'

describe('localDateStr', () => {
  it('gives the local day, not the UTC one', () => {
    const d = new Date(EARLY_MORNING)
    expect(d.toISOString().slice(0, 10)).toBe('2026-10-17')
    expect(localDateStr(d)).toBe('2026-10-18')
  })
})

describe('localDay', () => {
  it('keeps a plain date as it is', () => {
    expect(localDay('2026-10-18')).toBe('2026-10-18')
  })

  it('reads a timestamp in the local time zone', () => {
    expect(localDay(EARLY_MORNING)).toBe('2026-10-18')
    expect(localDay('2026-10-18T05:00:00.000Z')).toBe('2026-10-18')
    expect(localDay('2026-10-18T17:30:00.000Z')).toBe('2026-10-19')
  })
})

describe('DCA period checks with timestamps saved before 7am', () => {
  const plan = (dates: Partial<Pick<DcaPlan, 'confirmedDates' | 'skippedDates'>>, frequency: DcaPlan['frequency']): DcaPlan =>
    ({ id: 'p', name: 'Plan', assetClass: 'fund', frequency, monthlyAmount: 1000, dayOfMonth: 1, ...dates })
  const now = new Date('2026-10-18T03:00:00.000Z') // 10:00 on 18 Oct in Bangkok

  it('counts a daily buy confirmed at 06:30 as today', () => {
    expect(isConfirmedForPeriod(plan({ confirmedDates: [EARLY_MORNING] }, 'daily'), now)).toBe(true)
    expect(isSkippedForPeriod(plan({ skippedDates: [EARLY_MORNING] }, 'daily'), now)).toBe(true)
  })

  it('counts a monthly buy confirmed at 06:30 on the 1st as this month', () => {
    const firstOfMonth = '2026-09-30T23:30:00.000Z' // 06:30 on 1 Oct in Bangkok
    expect(isConfirmedForPeriod(plan({ confirmedDates: [firstOfMonth] }, 'monthly'), now)).toBe(true)
    expect(isSkippedForPeriod(plan({ skippedDates: [firstOfMonth] }, 'monthly'), now)).toBe(true)
  })

  it('still reads plain dates the same way', () => {
    expect(isConfirmedForPeriod(plan({ confirmedDates: ['2026-10-18'] }, 'daily'), now)).toBe(true)
    expect(isConfirmedForPeriod(plan({ confirmedDates: ['2026-10-17'] }, 'daily'), now)).toBe(false)
  })
})

describe('thbExact', () => {
  it('keeps the satang when there are some', () => {
    expect(thbExact(45.5)).toBe('฿\u202f45.50')
    expect(thbExact(3333.33)).toBe('฿\u202f3,333.33')
    expect(thbExact(0.05)).toBe('฿\u202f0.05')
  })

  it('leaves whole amounts without decimals', () => {
    expect(thbExact(8500)).toBe('฿\u202f8,500')
    expect(thbExact(120.001)).toBe('฿\u202f120')
  })
})

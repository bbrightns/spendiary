import { describe, expect, it } from 'vitest'
import type { DcaPlan, SpendiaryData } from '../../lib/types'
import { emptyData } from '../migrate'
import { skipDcaBuy, unskipDcaBuy } from './dca'

const plan = { id: 'p1', name: 'Bitcoin', assetClass: 'crypto', monthlyAmount: 300, dayOfMonth: 1 } as DcaPlan
const state = (): SpendiaryData => ({ ...emptyData, dcaPlans: [plan], holdingLogs: [] })

describe('unskipDcaBuy', () => {
  it('undoes a skip: the date and its log entry are gone', () => {
    const skipped = skipDcaBuy(state(), 'p1', '2026-10-18')
    expect(skipped.dcaPlans[0].skippedDates).toEqual(['2026-10-18'])
    expect(skipped.holdingLogs).toHaveLength(1)

    const back = unskipDcaBuy(skipped, 'p1', '2026-10-18')
    expect(back.dcaPlans[0].skippedDates).toEqual([])
    expect(back.holdingLogs).toEqual([])
  })

  it('leaves other days and other plans alone', () => {
    let s = skipDcaBuy(state(), 'p1', '2026-10-17')
    s = skipDcaBuy(s, 'p1', '2026-10-18')
    const back = unskipDcaBuy(s, 'p1', '2026-10-18')
    expect(back.dcaPlans[0].skippedDates).toEqual(['2026-10-17'])
    expect(back.holdingLogs).toHaveLength(1)
    expect(back.holdingLogs?.[0].dcaDate).toBe('2026-10-17')
  })

  it('does nothing when that day was not skipped', () => {
    const s = state()
    expect(unskipDcaBuy(s, 'p1', '2026-10-18')).toBe(s)
  })
})

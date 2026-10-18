import { describe, expect, it } from 'vitest'
import type { DcaPlan, SpendiaryData } from '../../lib/types'
import { emptyData } from '../migrate'
import { removePlan, skipDcaBuy, upsertPlan } from './dca'
import { undoHoldingLog } from './holdingLogs'

const plan: DcaPlan = { id: 'p1', name: 'S&P 500', assetClass: 'fund', frequency: 'monthly', monthlyAmount: 5000, dayOfMonth: 10 }
const state = (over: Partial<SpendiaryData> = {}): SpendiaryData => ({ ...emptyData, dcaPlans: [plan], ...over })

describe('upsertPlan', () => {
  it('adds a new plan with an id and logs it as created', () => {
    const out = upsertPlan(state(), { name: 'Gold', assetClass: 'gold', monthlyAmount: 2000, dayOfMonth: 1 })
    expect(out.dcaPlans).toHaveLength(2)
    expect(out.dcaPlans[1].id).toBeTruthy()
    expect(out.holdingLogs?.[0]).toMatchObject({ action: 'add', ticker: 'DCA', holdingName: 'DCA Plan: Gold', assetClass: 'gold' })
    expect(out.holdingLogs?.[0].note).toBe('Created DCA plan of ฿2,000/month')
  })

  it('updates an existing plan and logs it as an edit', () => {
    const out = upsertPlan(state(), { ...plan, monthlyAmount: 6000 })
    expect(out.dcaPlans).toEqual([{ ...plan, monthlyAmount: 6000 }])
    expect(out.holdingLogs?.[0]).toMatchObject({ action: 'edit', note: 'Updated DCA plan of ฿6,000/month' })
  })
})

describe('removePlan', () => {
  it('removes the plan and logs it', () => {
    const out = removePlan(state(), 'p1')
    expect(out.dcaPlans).toEqual([])
    expect(out.holdingLogs?.[0].note).toBe('Deleted DCA plan of ฿5,000/month')
  })

  it('changes nothing for an unknown plan', () => {
    const before = state()
    expect(removePlan(before, 'nope')).toBe(before)
  })
})

describe('skipDcaBuy', () => {
  it('records the skipped date first and links the log to the plan', () => {
    const out = skipDcaBuy(state({ dcaPlans: [{ ...plan, skippedDates: ['2026-09-10'] }] }), 'p1', '2026-10-10')
    expect(out.dcaPlans[0].skippedDates).toEqual(['2026-10-10', '2026-09-10'])
    expect(out.holdingLogs?.[0]).toMatchObject({ dcaPlanId: 'p1', dcaDate: '2026-10-10' })
  })

  it('can be undone from the log', () => {
    const skipped = skipDcaBuy(state(), 'p1', '2026-10-10')
    const undone = undoHoldingLog(skipped, skipped.holdingLogs![0].id)
    expect(undone.dcaPlans[0].skippedDates).toEqual([])
    expect(undone.holdingLogs).toEqual([])
  })

  it('changes nothing for an unknown plan', () => {
    const before = state()
    expect(skipDcaBuy(before, 'nope', '2026-10-10')).toBe(before)
  })
})

import { describe, expect, it } from 'vitest'
import type { Holding, SpendiaryData } from '../../lib/types'
import { emptyData } from '../migrate'
import { addHoldingLog, undoHoldingLog } from './holdingLogs'
import { buyMoreHolding, sellHolding } from './holdings'
import { planEditUndo } from './undoEdit'

const apple = (over: Partial<Holding> = {}): Holding =>
  ({ id: 'h1', name: 'Apple', ticker: 'AAPL', assetClass: 'fund', units: 10, totalUnits: 10, avgCost: 100, avgCostThb: 100, price: 120, totalThbInvested: 1000, ...over }) as Holding

const state = (h: Holding = apple()): SpendiaryData => ({ ...emptyData, holdings: [h] })

/** Saves an edit the way the holding form does: the new holding plus its log */
const edit = (s: SpendiaryData, after: Holding) =>
  addHoldingLog({ ...s, holdings: s.holdings.map((h) => (h.id === after.id ? after : h)) }, {
    action: 'edit', holdingId: after.id, holdingName: after.name, ticker: after.ticker, assetClass: after.assetClass, note: 'Edited',
    previousHoldingState: s.holdings.find((h) => h.id === after.id), afterHoldingState: after,
  })

const buy = (s: SpendiaryData, units: number, thb: number) => {
  const h = s.holdings[0]
  const totalThb = (h.totalThbInvested ?? 0) + thb
  const u = h.units + units
  return buyMoreHolding(s, { updatedHolding: { ...h, units: u, totalUnits: u, totalThbInvested: totalThb, avgCost: totalThb / u, avgCostThb: totalThb / u }, note: 'buy' })
}

const editLog = (s: SpendiaryData) => s.holdingLogs!.find((l) => l.action === 'edit')!

describe('undo of an edit', () => {
  it('saves which fields the edit changed', () => {
    const out = edit(state(), apple({ name: 'Apple Inc.', tag: 'Tech' }))
    expect(editLog(out).changes).toEqual({ name: ['Apple', 'Apple Inc.'], tag: [undefined, 'Tech'] })
  })

  it('puts the name back and keeps a buy made after the edit', () => {
    const edited = edit(state(), apple({ name: 'Apple Inc.', tag: 'Tech' }))
    const bought = buy(edited, 5, 600)
    const undone = undoHoldingLog(bought, editLog(bought).id).holdings[0]
    expect(undone.name).toBe('Apple')
    expect(undone.tag).toBeUndefined()
    expect(undone).toMatchObject({ units: 15, totalThbInvested: 1600 })
  })

  it('undoes a change of units by its amount, keeping later buys, and recomputes the average', () => {
    // 10 → 12 units by edit (cost 1000 → 1200), then +5 units for 600
    const edited = edit(state(), apple({ units: 12, totalUnits: 12, totalThbInvested: 1200 }))
    const bought = buy(edited, 5, 600)
    const undone = undoHoldingLog(bought, editLog(bought).id).holdings[0]
    expect(undone).toMatchObject({ units: 15, totalUnits: 15, totalThbInvested: 1600 })
    expect(undone.avgCost).toBeCloseTo(1600 / 15)
  })

  it('keeps a field that was changed again after the edit', () => {
    const first = edit(state(), apple({ name: 'Apple Inc.', tag: 'Tech' }))
    const second = edit(first, { ...first.holdings[0], name: 'Apple Computer' })
    const firstLog = second.holdingLogs!.find((l) => l.changes?.tag)!
    const plan = planEditUndo(second.holdings[0], firstLog)
    expect(plan).toMatchObject({ ok: true, kept: ['name'] })
    const undone = undoHoldingLog(second, firstLog.id).holdings[0]
    expect(undone.name).toBe('Apple Computer')
    expect(undone.tag).toBeUndefined()
  })

  it('refuses when the units would go below zero, and leaves everything as it was', () => {
    const edited = edit(state(), apple({ units: 20, totalUnits: 20, totalThbInvested: 2000 }))
    const h = edited.holdings[0]
    const sold = sellHolding(edited, {
      holdingId: 'h1', soldUnits: 15, soldPrice: 120, proceeds: 1800, realizedPnL: 300, realizedPnLPercent: 20, note: 'Sold 15 units',
      remainingHolding: { ...h, units: 5, totalUnits: 5, totalThbInvested: 500 },
    })
    expect(planEditUndo(sold.holdings[0], editLog(sold))).toMatchObject({ ok: false })
    expect(undoHoldingLog(sold, editLog(sold).id)).toBe(sold)
  })

  it('refuses when the holding is gone, keeping the log', () => {
    const edited = edit(state(), apple({ name: 'Apple Inc.' }))
    const gone = { ...edited, holdings: [] }
    expect(undoHoldingLog(gone, editLog(gone).id)).toBe(gone)
  })

  it('works on older logs without saved changes, from their snapshots', () => {
    const edited = edit(state(), apple({ name: 'Apple Inc.' }))
    const old = { ...edited, holdingLogs: edited.holdingLogs!.map(({ changes: _c, ...l }) => l) }
    expect(undoHoldingLog(buy(old, 1, 100), editLog(old).id).holdings[0]).toMatchObject({ name: 'Apple', units: 11 })
  })
})

import { describe, expect, it } from 'vitest'
import { buildBuyTrend, buyTrendStats, groupBuys, type TrendBuy } from './buyTrend'
import type { Holding, HoldingLog } from './types'

let n = 0
function buy(date: string, units: number, thb: number, extra: Partial<HoldingLog> = {}): HoldingLog {
  n++
  return {
    id: `l${n}`,
    timestamp: `${date}T10:00:${String(n % 60).padStart(2, '0')}.000Z`,
    action: 'buy_more',
    holdingName: 'BTC',
    ticker: 'BTC',
    assetClass: 'crypto',
    note: '',
    holdingId: 'h1',
    delta: { units, thb },
    ...extra,
  }
}

function sell(date: string, soldUnits: number, soldPrice: number, unitsBefore: number): HoldingLog {
  n++
  return {
    id: `l${n}`,
    timestamp: `${date}T10:00:00.000Z`,
    action: 'sell',
    holdingName: 'BTC',
    ticker: 'BTC',
    assetClass: 'crypto',
    note: '',
    holdingId: 'h1',
    soldUnits,
    soldPrice,
    delta: { units: -soldUnits, thb: 0, before: { units: unitsBefore, thb: 0, price: soldPrice } },
  }
}

describe('buildBuyTrend', () => {
  it('reads each buy price and the running weighted average, oldest first', () => {
    // Logs are stored newest first
    const logs = [buy('2026-03-01', 2, 200), buy('2026-02-01', 1, 50), buy('2026-01-01', 1, 100)]
    const t = buildBuyTrend(logs, { holdingId: 'h1' })
    expect(t.buys.map((b) => b.date)).toEqual(['2026-01-01', '2026-02-01', '2026-03-01'])
    expect(t.buys.map((b) => b.price)).toEqual([100, 50, 100])
    expect(t.buys.map((b) => b.avgAfter)).toEqual([100, 75, 87.5])
    expect(t.avg).toBe(87.5)
    expect(t.totalThb).toBe(350)
    expect(t.totalUnits).toBe(4)
  })

  it('leaves free units out of the average', () => {
    const logs = [buy('2026-01-02', 1, 500, { source: 'received' }), buy('2026-01-01', 1, 100)]
    const t = buildBuyTrend(logs, { holdingId: 'h1' })
    expect(t.buys).toHaveLength(1)
    expect(t.avg).toBe(100)
    expect(t.receivedCount).toBe(1)
  })

  it('keeps the average through a sale and weighs later buys against what is left', () => {
    const logs = [
      buy('2026-03-01', 1, 400),
      sell('2026-02-01', 1, 300, 2),
      buy('2026-01-02', 1, 300),
      buy('2026-01-01', 1, 100),
    ]
    const t = buildBuyTrend(logs, { holdingId: 'h1' })
    // 2 units at 200 avg, sell half → 1 unit / ฿200, then +1 at ฿400 → 2 units / ฿600
    expect(t.buys[1].avgAfter).toBe(200)
    expect(t.avg).toBe(300)
    expect(t.sells).toEqual([{ id: expect.any(String), date: '2026-02-01', price: 300, units: 1 }])
  })

  it('starts over after selling everything', () => {
    const logs = [buy('2026-03-01', 1, 50), sell('2026-02-01', 1, 120, 1), buy('2026-01-01', 1, 100)]
    expect(buildBuyTrend(logs, { holdingId: 'h1' }).avg).toBe(50)
  })

  it('filters to one plan, and skips transfers, edits, cash and other holdings', () => {
    const logs = [
      buy('2026-01-05', 1, 100, { dcaPlanId: 'p1', dcaDate: '2026-01-04' }),
      buy('2026-01-06', 1, 300),
      buy('2026-01-07', 1, 999, { holdingId: 'h2' }),
      buy('2026-01-08', 1, 999, { action: 'transfer' }),
      buy('2026-01-09', 1, 999, { action: 'edit' }),
      buy('2026-01-10', 1, 999, { assetClass: 'cash', dcaPlanId: 'p1' }),
    ]
    const plan = buildBuyTrend(logs, { planId: 'p1' })
    expect(plan.buys).toHaveLength(1)
    // The plan's buy day, not the day it was logged
    expect(plan.buys[0].date).toBe('2026-01-04')
    expect(plan.buys[0].dca).toBe(true)
    expect(buildBuyTrend(logs, { holdingId: 'h1' }).buys.map((b) => b.price)).toEqual([100, 300])
  })

  it('reads old logs from their before/after snapshots and counts the ones it cannot read', () => {
    const h = (units: number, total: number): Holding => ({
      id: 'h1', name: 'BTC', ticker: 'BTC', assetClass: 'crypto', units, avgCost: total / units, price: 1, totalThbInvested: total,
    })
    const old = buy('2026-01-02', 0, 0, { delta: undefined, previousHoldingState: h(1, 100), afterHoldingState: h(3, 500) })
    const broken = buy('2026-01-03', 0, 0, { delta: undefined })
    const t = buildBuyTrend([broken, old], { holdingId: 'h1' })
    expect(t.buys[0]).toMatchObject({ units: 2, thb: 400, price: 200 })
    expect(t.unreadableCount).toBe(1)
  })

  it('does not count a DCA buy with no linked holding as unreadable', () => {
    const t = buildBuyTrend([buy('2026-01-01', 0, 0, { dcaPlanId: 'p1', holdingId: undefined })], { planId: 'p1' })
    expect(t.buys).toHaveLength(0)
    expect(t.unreadableCount).toBe(0)
    expect(t.avg).toBeNull()
  })

  it('needs a holding or a plan to filter by', () => {
    expect(buildBuyTrend([buy('2026-01-01', 1, 100)], {}).buys).toHaveLength(0)
  })
})

describe('buyTrendStats', () => {
  const t = buildBuyTrend([buy('2026-01-03', 1, 300), buy('2026-01-02', 1, 100), buy('2026-01-01', 2, 400)], { holdingId: 'h1' })

  it('finds the cheapest and dearest buy and the share below today', () => {
    const s = buyTrendStats(t, 250)
    expect(s.cheapest?.price).toBe(100)
    expect(s.dearest?.price).toBe(300)
    expect(s.belowNow).toBeCloseTo(2 / 3)
    expect(s.meanBuyPrice).toBe(200)
    expect(s.vsAvg).toBeCloseTo(250 / 200 - 1)
  })

  it('has no comparison without a current price', () => {
    const s = buyTrendStats(t, null)
    expect(s.belowNow).toBeNull()
    expect(s.vsAvg).toBeNull()
  })
})

describe('groupBuys', () => {
  const daily = (days: number): TrendBuy[] =>
    Array.from({ length: days }, (_, i) => {
      const d = new Date(2026, 0, 1 + i)
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      return { id: `b${i}`, date, price: 100 + i, units: 1, thb: 100 + i, dca: true, avgAfter: 100 }
    })

  it('keeps every buy when there are few', () => {
    expect(groupBuys(daily(30)).by).toBe('buy')
  })

  it('merges daily buys by week, weighting the price by units', () => {
    const g = groupBuys(daily(200))
    expect(g.by).toBe('week')
    expect(g.points.length).toBeLessThanOrEqual(60)
    expect(g.points.reduce((s, p) => s + p.count, 0)).toBe(200)
    const p = g.points[1]
    expect(p.price).toBeCloseTo(p.thb / p.units)
  })

  it('falls back to months for years of daily buys', () => {
    const g = groupBuys(daily(800))
    expect(g.by).toBe('month')
    expect(g.points.length).toBeLessThanOrEqual(60)
  })
})

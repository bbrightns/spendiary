import { describe, expect, it } from 'vitest'
import type { Holding } from './types'
import { addToLocation, assignAllToLocation, buyInto, roundQty, sumQty, takeFromLocation, visibleLocations, withLocations } from './locations'

const stock = (over: Partial<Holding> = {}): Holding =>
  ({ id: 's1', name: 'Apple', ticker: 'AAPL', assetClass: 'stock', units: 10, avgCost: 6000, price: 7000, totalThbInvested: 60_000, totalUsdInvested: 1_700, ...over }) as Holding

describe('quantities', () => {
  it('rounds to the asset precision so sums do not drift', () => {
    expect(roundQty('crypto', 0.1 + 0.2)).toBe(0.3)
    expect(sumQty('crypto', [{ id: 'a', name: 'A', qty: 0.1, thbSpent: 0 }, { id: 'b', name: 'B', qty: 0.2, thbSpent: 0 }])).toBe(0.3)
    expect(roundQty('gold', 15.24449)).toBe(15.2445)
  })
})

describe('addToLocation / takeFromLocation', () => {
  it('adds to an existing location found by name, ignoring case', () => {
    const r = addToLocation('stock', [{ id: 'w', name: 'Webull', qty: 1, thbSpent: 6000, usdSpent: 170 }], { name: 'webull' }, 2, 12_000, 340)
    expect(r.locationId).toBe('w')
    expect(r.locations).toEqual([{ id: 'w', name: 'Webull', qty: 3, thbSpent: 18_000, usdSpent: 510 }])
  })

  it('takes a share of the cost, and the exact rest when emptied; the emptied location stays', () => {
    const locs = [{ id: 'w', name: 'Webull', qty: 3, thbSpent: 10_000, usdSpent: 300 }]
    const part = takeFromLocation('stock', locs, 'w', 1)!
    expect(part.costThb).toBe(3333.33)
    expect(part.costUsd).toBe(100)
    const all = takeFromLocation('stock', part.locations, 'w', 2)!
    expect(all.costThb).toBe(6666.67)
    expect(all.locations).toEqual([{ id: 'w', name: 'Webull', qty: 0, thbSpent: 0, usdSpent: 0 }])
    expect(visibleLocations({ assetClass: 'stock', locations: all.locations })).toEqual([])
  })

  it('refuses more than is there', () => {
    expect(takeFromLocation('stock', [{ id: 'w', name: 'W', qty: 1, thbSpent: 1 }], 'w', 2)).toBeNull()
    expect(takeFromLocation('stock', [{ id: 'w', name: 'W', qty: 1, thbSpent: 1 }], 'nope', 1)).toBeNull()
  })
})

describe('buyInto', () => {
  it('buys into a broker and rebuilds the totals from all brokers', () => {
    const h = withLocations(stock(), [{ id: 'w', name: 'Webull', qty: 10, thbSpent: 60_000, usdSpent: 1_700 }])
    const { holding, locationId } = buyInto(h, { name: 'Dime' }, 2, 14_000, 400)
    expect(holding.locations?.map((l) => [l.name, l.qty])).toEqual([['Webull', 10], ['Dime', 2]])
    expect(holding).toMatchObject({ units: 12, totalThbInvested: 74_000, totalUsdInvested: 2_100 })
    expect(holding.locations?.find((l) => l.id === locationId)?.name).toBe('Dime')
  })

  it('puts a buy with no location named into the first one, so the locations keep adding up', () => {
    const h = withLocations(stock(), [{ id: 'w', name: 'Webull', qty: 10, thbSpent: 60_000, usdSpent: 1_700 }])
    const { holding } = buyInto(h, undefined, 1, 7000, 200)
    expect(holding.locations).toEqual([{ id: 'w', name: 'Webull', qty: 11, thbSpent: 67_000, usdSpent: 1_900 }])
    expect(holding.units).toBe(11)
  })

  it('only adds to the totals when the holding has units but no locations yet', () => {
    const { holding, locationId } = buyInto(stock(), { name: 'Dime' }, 2, 14_000, 400)
    expect(holding.locations).toBeUndefined()
    expect(locationId).toBeUndefined()
    expect(holding).toMatchObject({ units: 12, totalThbInvested: 74_000, totalUsdInvested: 2_100 })
  })

  it('starts the first location of an empty holding', () => {
    const { holding } = buyInto(stock({ units: 0, totalThbInvested: 0, totalUsdInvested: 0 }), { name: 'Dime' }, 2, 14_000, 400)
    expect(holding.locations).toHaveLength(1)
    expect(holding.units).toBe(2)
  })
})

describe('assignAllToLocation', () => {
  it('leaves out the USD cost when the holding never knew it', () => {
    const noUsd = stock({ totalUsdInvested: undefined, avgCostUsd: undefined })
    const h = withLocations(noUsd, assignAllToLocation(noUsd, 'Dime').locations ?? [])
    expect(h.locations?.[0].usdSpent).toBeUndefined()
    expect(h.totalUsdInvested).toBeUndefined()
  })

  it('puts the whole holding and its cost into one broker', () => {
    expect(assignAllToLocation(stock(), ' Webull ').locations).toEqual([
      expect.objectContaining({ name: 'Webull', qty: 10, thbSpent: 60_000, usdSpent: 1_700 }),
    ])
  })
})

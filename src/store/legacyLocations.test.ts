import { describe, expect, it } from 'vitest'
import type { DcaPlan, Holding, HoldingLog, SpendiaryData } from '../lib/types'
import { emptyData, migrate } from './migrate'
import { upgradeLocations, withLegacyLocations } from './legacyLocations'

const oldBtc = {
  id: 'b1', name: 'Bitcoin', ticker: 'BTC', assetClass: 'crypto', units: 0.44, avgCost: 2_000_000, price: 3_000_000, totalThbInvested: 880_000,
  btcLocations: [
    { id: 'cold', name: 'Ledger', satoshi: 32_000_000, thbSpent: 640_000, isLocked: true },
    { id: 'ex', name: 'Bitkub', satoshi: 12_000_000, thbSpent: 240_000 },
  ],
} as unknown as Holding
const oldGold = {
  id: 'g1', name: 'Gold', ticker: 'GOLD', assetClass: 'gold', units: 15.244, avgCost: 2800, price: 3000, totalThbInvested: 42_683,
  goldLocations: [{ id: 'hsh', name: 'HSH', grams: 15.244, thbSpent: 42_683 }],
} as unknown as Holding
const oldPlan = { id: 'p1', name: 'Bitcoin', assetClass: 'crypto', monthlyAmount: 300, dayOfMonth: 1, holdingId: 'b1', btcLocationId: 'cold' } as unknown as DcaPlan
const data = (over: Partial<SpendiaryData> = {}): SpendiaryData => ({ ...emptyData, holdings: [oldBtc, oldGold], dcaPlans: [oldPlan], ...over })

describe('upgradeLocations', () => {
  it('turns the old BTC (sats) and gold (grams) fields into locations, keeping every amount', () => {
    const out = upgradeLocations(data())
    expect(out.holdings[0].locations).toEqual([
      { id: 'cold', name: 'Ledger', qty: 0.32, thbSpent: 640_000, isLocked: true },
      { id: 'ex', name: 'Bitkub', qty: 0.12, thbSpent: 240_000 },
    ])
    expect(out.holdings[1].locations).toEqual([{ id: 'hsh', name: 'HSH', qty: 15.244, thbSpent: 42_683 }])
    expect(out.holdings[0]).not.toHaveProperty('btcLocations')
    expect(out.holdings[1]).not.toHaveProperty('goldLocations')
    expect(out.dcaPlans[0]).toMatchObject({ locationId: 'cold' })
    expect(out.dcaPlans[0]).not.toHaveProperty('btcLocationId')
  })

  it('upgrades the holding snapshots that undo uses', () => {
    const log = { id: 'l1', timestamp: '', action: 'sell', holdingName: 'Bitcoin', ticker: 'BTC', assetClass: 'crypto', previousHoldingState: oldBtc, afterHoldingState: oldBtc } as HoldingLog
    const out = upgradeLocations(data({ holdingLogs: [log] }))
    expect(out.holdingLogs?.[0].previousHoldingState?.locations).toHaveLength(2)
    expect(out.holdingLogs?.[0].afterHoldingState?.locations).toHaveLength(2)
  })

  it('is safe to run twice', () => {
    const once = upgradeLocations(data())
    expect(upgradeLocations(once)).toEqual(once)
  })

  it('round-trips through the saved shape unchanged', () => {
    const current = migrate(data())
    expect(migrate(withLegacyLocations(current))).toEqual(current)
  })

  it('takes the old fields when an older device changed them after our last save', () => {
    const saved = withLegacyLocations(upgradeLocations(data()))
    // The older app moved 0.02 BTC from Bitkub to Ledger and only knows the old field
    const olderEdit = {
      ...saved,
      holdings: saved.holdings.map((h) =>
        h.id !== 'b1'
          ? h
          : {
              ...h,
              btcLocations: [
                { id: 'cold', name: 'Ledger', satoshi: 34_000_000, thbSpent: 680_000, isLocked: true },
                { id: 'ex', name: 'Bitkub', satoshi: 10_000_000, thbSpent: 200_000 },
              ],
            },
      ),
      dcaPlans: saved.dcaPlans.map((p) => ({ ...p, btcLocationId: 'ex' })),
    } as SpendiaryData
    const out = upgradeLocations(olderEdit)
    expect(out.holdings[0].locations?.map((l) => l.qty)).toEqual([0.34, 0.1])
    expect(out.dcaPlans[0].locationId).toBe('ex')
  })

  it('writes the old fields next to the new ones for older devices', () => {
    const saved = withLegacyLocations(upgradeLocations(data())) as unknown as { holdings: Record<string, unknown>[]; dcaPlans: Record<string, unknown>[] }
    expect(saved.holdings[0].btcLocations).toEqual((oldBtc as unknown as Record<string, unknown>).btcLocations)
    expect(saved.holdings[1].goldLocations).toEqual((oldGold as unknown as Record<string, unknown>).goldLocations)
    expect(saved.dcaPlans[0].btcLocationId).toBe('cold')
  })
})

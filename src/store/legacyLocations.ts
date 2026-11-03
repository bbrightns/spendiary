import type { DcaPlan, Holding, HoldingLocation, HoldingLog, SpendiaryData } from '../lib/types'
import { roundQty } from '../lib/locations'
import { SATS_PER_BTC as SATS } from '../lib/calc'

/**
 * Before v2 of locations, BTC kept `btcLocations` (satoshi) and gold kept `goldLocations` (grams),
 * and DCA plans pointed at them with `btcLocationId` / `goldLocationId`. Everything now uses
 * `Holding.locations` and `DcaPlan.locationId`.
 *
 * - Loading: `upgradeLocations` turns the old fields into the new ones (saved data, backups, undo snapshots).
 * - Saving: `withLegacyLocations` also writes the old fields, so a device still running the previous
 *   version keeps seeing its wallets. If that device then changes them, the old fields no longer match
 *   the new ones on the next load, and the old fields win (they hold the newer edit).
 *   Drop the save side once every device runs this version; keep the load side for old backups.
 */

export interface LegacyBtcLocation { id: string; name: string; satoshi: number; thbSpent: number; isLocked?: boolean }
export interface LegacyGoldLocation { id: string; name: string; grams: number; thbSpent: number; isLocked?: boolean }
type LegacyHolding = Holding & { btcLocations?: LegacyBtcLocation[]; goldLocations?: LegacyGoldLocation[] }
type LegacyPlan = DcaPlan & { btcLocationId?: string; goldLocationId?: string }

const lock = (isLocked?: boolean) => (isLocked ? { isLocked: true } : {})

function fromLegacy(h: LegacyHolding): HoldingLocation[] | undefined {
  if (h.assetClass === 'crypto' && Array.isArray(h.btcLocations)) {
    return h.btcLocations.map((l) => ({ id: l.id, name: l.name, qty: roundQty('crypto', (l.satoshi || 0) / SATS), thbSpent: l.thbSpent || 0, ...lock(l.isLocked) }))
  }
  if (h.assetClass === 'gold' && Array.isArray(h.goldLocations)) {
    return h.goldLocations.map((l) => ({ id: l.id, name: l.name, qty: roundQty('gold', l.grams || 0), thbSpent: l.thbSpent || 0, ...lock(l.isLocked) }))
  }
  return undefined
}

function toLegacy(h: Holding): Pick<LegacyHolding, 'btcLocations' | 'goldLocations'> {
  if (!h.locations) return {}
  if (h.assetClass === 'crypto') {
    return { btcLocations: h.locations.map((l) => ({ id: l.id, name: l.name, satoshi: Math.round(l.qty * SATS), thbSpent: l.thbSpent, ...lock(l.isLocked) })) }
  }
  if (h.assetClass === 'gold') {
    return { goldLocations: h.locations.map((l) => ({ id: l.id, name: l.name, grams: l.qty, thbSpent: l.thbSpent, ...lock(l.isLocked) })) }
  }
  return {}
}

/** Same wallets, amounts and cost, compared at the old fields' precision */
function sameLegacy(a: LegacyHolding, b: Pick<LegacyHolding, 'btcLocations' | 'goldLocations'>): boolean {
  const norm = (h: Pick<LegacyHolding, 'btcLocations' | 'goldLocations'>) =>
    JSON.stringify([
      (h.btcLocations ?? []).map((l) => [l.id, l.name, Math.round(l.satoshi), Math.round(l.thbSpent * 100), !!l.isLocked]),
      (h.goldLocations ?? []).map((l) => [l.id, l.name, Math.round(l.grams * 10_000), Math.round(l.thbSpent * 100), !!l.isLocked]),
    ])
  return norm(a) === norm(b)
}

export function upgradeHolding(raw: Holding): Holding {
  const h = raw as LegacyHolding
  if (!('btcLocations' in h) && !('goldLocations' in h)) return raw
  const { btcLocations: _b, goldLocations: _g, ...rest } = h
  const legacy = fromLegacy(h)
  // Old fields only (saved before this version), or changed by an older device since our last save
  const useLegacy = legacy !== undefined && (!h.locations || !sameLegacy(h, toLegacy(h)))
  if (useLegacy) return { ...rest, locations: legacy }
  return rest
}

export function upgradePlan(raw: DcaPlan): DcaPlan {
  const p = raw as LegacyPlan
  if (!('btcLocationId' in p) && !('goldLocationId' in p)) return raw
  const { btcLocationId, goldLocationId, ...rest } = p
  const legacyId = p.assetClass === 'gold' ? goldLocationId : btcLocationId ?? goldLocationId
  // The old id is what an older device last chose when it differs from ours
  const locationId = legacyId && legacyId !== p.locationId ? legacyId : p.locationId
  return { ...rest, ...(locationId ? { locationId } : {}) }
}

function upgradeLog(log: HoldingLog): HoldingLog {
  if (!log.previousHoldingState && !log.afterHoldingState) return log
  return {
    ...log,
    ...(log.previousHoldingState ? { previousHoldingState: upgradeHolding(log.previousHoldingState) } : {}),
    ...(log.afterHoldingState ? { afterHoldingState: upgradeHolding(log.afterHoldingState) } : {}),
  }
}

/**
 * A US stock's brokers that no longer add up to its units were changed by a device on the previous
 * version (it knows nothing of brokers and only moved the units). Its units are the newer truth, so the
 * brokers go; the user sets them again. BTC and gold are not touched: their old fields carry such edits.
 */
function dropStaleBrokers(h: Holding): Holding {
  if (h.assetClass !== 'stock' || !h.locations?.length) return h
  const sum = h.locations.reduce((s, l) => s + l.qty, 0)
  if (Math.abs(sum - (h.units ?? 0)) <= 1e-6) return h
  const { locations: _l, ...rest } = h
  return rest
}

/** Old location fields → `locations` / `locationId`, in holdings, plans and undo snapshots. Safe to run twice. */
export function upgradeLocations(data: SpendiaryData): SpendiaryData {
  return {
    ...data,
    holdings: (data.holdings ?? []).map((h) => dropStaleBrokers(upgradeHolding(h))),
    dcaPlans: (data.dcaPlans ?? []).map(upgradePlan),
    ...(Array.isArray(data.holdingLogs) ? { holdingLogs: data.holdingLogs.map(upgradeLog) } : {}),
  }
}

function legacyHolding(h: Holding): Holding {
  const old = toLegacy(h)
  return old.btcLocations || old.goldLocations ? ({ ...h, ...old } as Holding) : h
}

/** Adds the old location fields next to the new ones, for devices still on the previous version */
export function withLegacyLocations(data: SpendiaryData): SpendiaryData {
  return {
    ...data,
    holdings: data.holdings.map(legacyHolding),
    dcaPlans: data.dcaPlans.map((p) => {
      if (!p.locationId) return p
      if (p.assetClass === 'crypto') return { ...p, btcLocationId: p.locationId } as DcaPlan
      if (p.assetClass === 'gold') return { ...p, goldLocationId: p.locationId } as DcaPlan
      return p
    }),
    ...(Array.isArray(data.holdingLogs)
      ? {
          holdingLogs: data.holdingLogs.map((l) =>
            l.previousHoldingState || l.afterHoldingState
              ? {
                  ...l,
                  ...(l.previousHoldingState ? { previousHoldingState: legacyHolding(l.previousHoldingState) } : {}),
                  ...(l.afterHoldingState ? { afterHoldingState: legacyHolding(l.afterHoldingState) } : {}),
                }
              : l,
          ),
        }
      : {}),
  }
}

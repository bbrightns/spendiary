import type { AssetClass, Holding, HoldingLocation } from './types'
import { newId } from './id'
import { roundMoney } from './money'

/**
 * Where a holding is kept: wallets and vaults for BTC and gold, brokers for US stocks.
 * Every location stores its quantity in the holding's own unit (BTC, grams, shares),
 * so the holding's totals are simply the sums of its locations.
 */

const SATS_PER_BTC = 100_000_000

/** Asset classes whose holdings can be split by location */
export function supportsLocations(assetClass: AssetClass | undefined): boolean {
  return assetClass === 'crypto' || assetClass === 'gold' || assetClass === 'stock'
}

/** Decimal places a quantity keeps: sats for BTC, 0.0001 g for gold, fractional shares for stocks */
function qtyDecimals(assetClass: AssetClass | undefined): number {
  if (assetClass === 'crypto') return 8
  if (assetClass === 'gold') return 4
  return 6
}

/** Rounds a quantity to its asset's precision, so sums never drift (0.1 + 0.2 BTC stays 0.3) */
export function roundQty(assetClass: AssetClass | undefined, n: number): number {
  const f = 10 ** qtyDecimals(assetClass)
  return Math.round(n * f) / f
}

/** Smallest meaningful quantity: anything below it counts as empty */
export function qtyEpsilon(assetClass: AssetClass | undefined): number {
  return 10 ** -qtyDecimals(assetClass) / 2
}

export function hasLocations(h: Pick<Holding, 'locations'> | null | undefined): boolean {
  return (h?.locations?.length ?? 0) > 0
}

/** Locations that still hold something. Emptied ones are kept (a DCA plan may point at them) but not listed */
export function visibleLocations(h: Pick<Holding, 'locations' | 'assetClass'> | null | undefined): HoldingLocation[] {
  if (!h) return []
  const eps = qtyEpsilon(h.assetClass)
  return (h.locations ?? []).filter((l) => l.qty > eps)
}

export function sumQty(assetClass: AssetClass | undefined, locs: HoldingLocation[]): number {
  return roundQty(assetClass, locs.reduce((s, l) => s + l.qty, 0))
}

/** Holding totals rebuilt from its locations (units, THB cost, USD cost for stocks) */
export function totalsFromLocations(h: Holding, locs: HoldingLocation[]): Partial<Holding> {
  const units = sumQty(h.assetClass, locs)
  const totalThb = roundMoney(locs.reduce((s, l) => s + l.thbSpent, 0))
  const avg = units > 0 ? totalThb / units : h.avgCost
  const out: Partial<Holding> = {
    units,
    totalUnits: units,
    totalThbInvested: totalThb,
    avgCost: avg,
    avgCostThb: avg,
  }
  if (h.assetClass === 'stock' && locs.some((l) => typeof l.usdSpent === 'number')) {
    const totalUsd = locs.reduce((s, l) => s + (l.usdSpent ?? 0), 0)
    out.totalUsdInvested = totalUsd
    out.avgCostUsd = units > 0 ? totalUsd / units : h.avgCostUsd
  }
  return out
}

/** The holding with new locations and its totals recomputed from them */
export function withLocations(h: Holding, locs: HoldingLocation[]): Holding {
  return { ...h, ...totalsFromLocations(h, locs), locations: locs }
}

/** Finds a location by id, then by name (case-insensitive) */
export function findLocation(locs: HoldingLocation[], target: { id?: string; name?: string }): HoldingLocation | undefined {
  if (target.id) {
    const byId = locs.find((l) => l.id === target.id)
    if (byId) return byId
  }
  const name = target.name?.trim().toLowerCase()
  return name ? locs.find((l) => l.name.trim().toLowerCase() === name) : undefined
}

/**
 * Puts a quantity and its cost into a location: an existing one (by id, then by name) or a new one.
 * Returns the new list and the id the quantity went into.
 */
export function addToLocation(
  assetClass: AssetClass | undefined,
  locs: HoldingLocation[],
  target: { id?: string; name: string },
  qty: number,
  thbSpent: number,
  usdSpent?: number,
): { locations: HoldingLocation[]; locationId: string } {
  const existing = findLocation(locs, target)
  if (existing) {
    return {
      locationId: existing.id,
      locations: locs.map((l) =>
        l.id !== existing.id
          ? l
          : {
              ...l,
              qty: roundQty(assetClass, l.qty + qty),
              thbSpent: roundMoney(l.thbSpent + thbSpent),
              ...(usdSpent !== undefined ? { usdSpent: (l.usdSpent ?? 0) + usdSpent } : {}),
            },
      ),
    }
  }
  const id = target.id || newId()
  const created: HoldingLocation = {
    id,
    name: target.name.trim(),
    qty: roundQty(assetClass, qty),
    thbSpent: roundMoney(thbSpent),
    ...(usdSpent !== undefined ? { usdSpent } : {}),
  }
  return { locationId: id, locations: [...locs, created] }
}

/**
 * Takes a quantity out of one location with its share of the cost (average cost of that location).
 * Taking everything takes the exact remaining cost. The emptied location stays in the list at 0.
 * Returns null when the location is missing or holds less than asked.
 */
export function takeFromLocation(
  assetClass: AssetClass | undefined,
  locs: HoldingLocation[],
  locationId: string,
  qty: number,
): { locations: HoldingLocation[]; costThb: number; costUsd: number } | null {
  const loc = locs.find((l) => l.id === locationId)
  const eps = qtyEpsilon(assetClass)
  if (!loc || !(qty > 0) || qty > loc.qty + eps) return null
  const all = qty >= loc.qty - eps
  const share = loc.qty > 0 ? qty / loc.qty : 0
  const costThb = all ? loc.thbSpent : roundMoney(loc.thbSpent * share)
  const costUsd = all ? (loc.usdSpent ?? 0) : (loc.usdSpent ?? 0) * share
  return {
    costThb,
    costUsd,
    locations: locs.map((l) =>
      l.id !== locationId
        ? l
        : {
            ...l,
            qty: all ? 0 : roundQty(assetClass, l.qty - qty),
            thbSpent: all ? 0 : roundMoney(l.thbSpent - costThb),
            ...(l.usdSpent !== undefined ? { usdSpent: all ? 0 : l.usdSpent - costUsd } : {}),
          },
    ),
  }
}

/** Quantity as people type and read it: sats for BTC, otherwise the holding's own unit */
export function toInputQty(assetClass: AssetClass | undefined, qty: number): number {
  return assetClass === 'crypto' ? Math.round(qty * SATS_PER_BTC) : qty
}

export function fromInputQty(assetClass: AssetClass | undefined, n: number): number {
  return assetClass === 'crypto' ? n / SATS_PER_BTC : roundQty(assetClass, n)
}

/** Unit word for a location quantity */
export function qtyUnit(assetClass: AssetClass | undefined): string {
  if (assetClass === 'crypto') return 'sats'
  if (assetClass === 'gold') return 'g'
  return 'shares'
}

/** "32,000,000 sats", "15.2440 g", "12.5 shares" */
export function formatLocationQty(assetClass: AssetClass | undefined, qty: number): string {
  if (assetClass === 'crypto') return `${toInputQty(assetClass, qty).toLocaleString()} sats`
  if (assetClass === 'gold') return `${qty.toFixed(4)} g`
  return `${qty.toLocaleString(undefined, { maximumFractionDigits: 6 })} shares`
}

/** What a location is called for this asset: a broker for stocks, a location for BTC and gold */
export function locationNoun(assetClass: AssetClass | undefined): string {
  return assetClass === 'stock' ? 'broker' : 'location'
}

/**
 * Adds a buy (or a gift) to a holding. With a location named, it goes into that location and the totals
 * follow from all locations. A holding that already has units but no locations yet cannot say where those
 * units are, so the buy only adds to its totals (set a location for the whole holding first).
 */
export function buyInto(
  h: Holding,
  target: { id?: string; name?: string } | undefined,
  qty: number,
  thbSpent: number,
  usdSpent?: number,
): { holding: Holding; locationId?: string } {
  const ac = h.assetClass
  const units = h.units ?? h.totalUnits ?? 0
  const named = !!target && (!!target.id || !!target.name?.trim())
  if (named && (hasLocations(h) || units <= qtyEpsilon(ac))) {
    const existing = findLocation(h.locations ?? [], target!)
    const r = addToLocation(ac, h.locations ?? [], { id: existing?.id ?? target!.id, name: existing?.name ?? target!.name ?? '' }, qty, thbSpent, usdSpent)
    return { holding: withLocations(h, r.locations), locationId: r.locationId }
  }
  const newUnits = roundQty(ac, units + qty)
  const totalThb = roundMoney((h.totalThbInvested ?? units * (h.avgCostThb ?? h.avgCost ?? 0)) + thbSpent)
  const avg = newUnits > 0 ? totalThb / newUnits : h.avgCost
  const out: Holding = { ...h, units: newUnits, totalUnits: newUnits, totalThbInvested: totalThb, avgCost: avg, avgCostThb: avg }
  if (usdSpent !== undefined) {
    const totalUsd = (h.totalUsdInvested ?? units * (h.avgCostUsd ?? 0)) + usdSpent
    out.totalUsdInvested = totalUsd
    out.avgCostUsd = newUnits > 0 ? totalUsd / newUnits : h.avgCostUsd
  }
  return { holding: out }
}

/** Puts the whole holding (all units and cost) into one named location: the first step before splitting it */
export function assignAllToLocation(h: Holding, name: string): Holding {
  const units = h.units ?? h.totalUnits ?? 0
  const loc: HoldingLocation = {
    id: newId(),
    name: name.trim(),
    qty: roundQty(h.assetClass, units),
    thbSpent: roundMoney(h.totalThbInvested ?? units * (h.avgCostThb ?? h.avgCost ?? 0)),
    ...(h.assetClass === 'stock' ? { usdSpent: h.totalUsdInvested ?? units * (h.avgCostUsd ?? 0) } : {}),
  }
  return { ...h, locations: [loc] }
}

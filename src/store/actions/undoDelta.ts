import type { CashAccount, Holding, HoldingDelta, HoldingFigures, HoldingLocation, HoldingLog, SpendiaryData } from '../../lib/types'
import { qtyEpsilon, roundQty } from '../../lib/locations'
import { roundMoney } from '../../lib/money'

/**
 * Undo by reversing exactly what a buy, sale or add did (its delta), instead of guessing from
 * before/after snapshots. Reversing a change leaves everything that happened after it in place.
 */

const units = (h: Holding | undefined) => h?.units ?? h?.totalUnits ?? 0

/**
 * What going from `before` to `after` did to a holding. `before` missing = the holding was created;
 * `after` missing = it was sold off and removed. Cash moves are added by the caller.
 */
export function holdingDelta(
  before: Holding | undefined,
  after: Holding | undefined,
  cash?: HoldingDelta['cash'],
  /** Cash accounts after the change: names and balances for the trade history */
  accountsAfter?: CashAccount[],
): HoldingDelta {
  const ac = (after ?? before)?.assetClass
  const usdBefore = before?.totalUsdInvested
  const usdAfter = after?.totalUsdInvested
  const out: HoldingDelta = {
    units: roundQty(ac, units(after) - units(before)),
    thb: roundMoney((after?.totalThbInvested ?? 0) - (before?.totalThbInvested ?? 0)),
  }
  if (usdBefore !== undefined || usdAfter !== undefined) out.usd = (usdAfter ?? 0) - (usdBefore ?? 0)
  if (!before) out.holdingCreated = true
  if (!after) out.holdingRemoved = true
  if (before) out.before = figures(before)
  if (after) out.after = figures(after)

  // The one location whose quantity changed
  const prevLocs = before?.locations ?? []
  const nextLocs = after?.locations ?? []
  const eps = qtyEpsilon(ac)
  const changed = [...new Set([...prevLocs, ...nextLocs].map((l) => l.id))].filter((id) => {
    const a = prevLocs.find((l) => l.id === id)?.qty ?? 0
    const b = nextLocs.find((l) => l.id === id)?.qty ?? 0
    return Math.abs(b - a) > eps
  })
  if (changed.length === 1) {
    const a = prevLocs.find((l) => l.id === changed[0])
    const b = nextLocs.find((l) => l.id === changed[0])
    out.location = {
      id: changed[0],
      name: (b ?? a)?.name,
      qty: roundQty(ac, (b?.qty ?? 0) - (a?.qty ?? 0)),
      thb: roundMoney((b?.thbSpent ?? 0) - (a?.thbSpent ?? 0)),
      ...(a?.usdSpent !== undefined || b?.usdSpent !== undefined ? { usd: (b?.usdSpent ?? 0) - (a?.usdSpent ?? 0) } : {}),
      ...(!a ? { created: true } : {}),
    }
  }
  const moved = withAccountDetails((cash ?? []).filter((c) => c.amount !== 0), accountsAfter)
  if (moved.length > 0) out.cash = moved
  return out
}

/** The numbers of a holding the trade history shows */
function figures(h: Holding): HoldingFigures {
  return {
    units: units(h),
    thb: h.totalThbInvested ?? units(h) * (h.avgCostThb ?? h.avgCost ?? 0),
    ...(h.totalUsdInvested !== undefined ? { usd: h.totalUsdInvested } : {}),
    price: h.price,
  }
}

/** Cash moves with each account's name, currency and balance afterwards, for the trade history */
export function withAccountDetails(cash: NonNullable<HoldingDelta['cash']>, accountsAfter?: CashAccount[]): NonNullable<HoldingDelta['cash']> {
  return cash.map((c) => {
    const acc = accountsAfter?.find((a) => a.id === c.accountId)
    return acc ? { ...c, name: acc.name, currency: acc.currency ?? 'THB', balanceAfter: acc.balance } : c
  })
}

export type UndoResult = { ok: true; data: SpendiaryData } | { ok: false; reason: string }

/** Takes a delta back out of the location it touched; null when that location is gone or no longer holds enough */
function reverseLocation(h: Holding, d: HoldingDelta): HoldingLocation[] | null {
  const locs = h.locations ?? []
  const dl = d.location
  if (!dl) return locs
  const ac = h.assetClass
  const loc = locs.find((l) => l.id === dl.id)
  // The location was removed since: there is nowhere to put this back
  if (!loc) return null
  const qty = roundQty(ac, loc.qty - dl.qty)
  if (qty < -qtyEpsilon(ac)) return null
  const next: HoldingLocation = {
    ...loc,
    qty: Math.max(0, qty),
    thbSpent: Math.max(0, roundMoney(loc.thbSpent - dl.thb)),
    ...(loc.usdSpent !== undefined && dl.usd !== undefined ? { usdSpent: Math.max(0, loc.usdSpent - dl.usd) } : {}),
  }
  // A location this entry created goes away with it once it is empty again
  if (dl.created && next.qty <= qtyEpsilon(ac)) return locs.filter((l) => l.id !== loc.id)
  return locs.map((l) => (l.id === loc.id ? next : l))
}

/** The holding with a delta reversed: units, cost and the location it touched; null when that would go below zero */
function reverseHolding(h: Holding, d: HoldingDelta): Holding | null {
  const ac = h.assetClass
  const u = roundQty(ac, units(h) - d.units)
  if (u < -qtyEpsilon(ac)) return null
  const locations = h.locations ? reverseLocation(h, d) : undefined
  if (h.locations && !locations) return null
  const thb = Math.max(0, roundMoney((h.totalThbInvested ?? 0) - d.thb))
  const usd = h.totalUsdInvested !== undefined && d.usd !== undefined ? Math.max(0, h.totalUsdInvested - d.usd) : h.totalUsdInvested
  const nu = Math.max(0, u)
  const avg = nu > 0 ? thb / nu : h.avgCost
  return {
    ...h,
    units: nu,
    totalUnits: nu,
    totalThbInvested: thb,
    avgCost: avg,
    avgCostThb: avg,
    ...(usd !== undefined ? { totalUsdInvested: usd, avgCostUsd: nu > 0 ? usd / nu : h.avgCostUsd } : {}),
    ...(locations ? { locations } : {}),
  }
}

/** Cash accounts with a log's cash moves reversed; a deleted account is skipped */
function reverseCash(accounts: CashAccount[], d: HoldingDelta): CashAccount[] {
  if (!d.cash?.length) return accounts
  return accounts.map((a) => {
    const back = d.cash!.filter((c) => c.accountId === a.id).reduce((s, c) => s + c.amount, 0)
    return back === 0 ? a : { ...a, balance: roundMoney(a.balance - back) }
  })
}

/**
 * Holdings and cash with a delta log reversed, or why it can't be:
 * - add: the holding goes away only if nothing was bought or sold since; otherwise just this add comes off it
 * - buy: the units, cost and cash come back out
 * - sell: they go back in; a holding the sale removed comes back, merged into one of the same ticker if it was re-added
 */
export function undoHoldingDelta(prev: SpendiaryData, log: HoldingLog): UndoResult {
  const d = log.delta!
  // Cash only (a savings DCA, a buy with no holding): just the money goes back
  if (!log.holdingId) return { ok: true, data: { ...prev, cashAccounts: reverseCash(prev.cashAccounts ?? [], d) } }
  let holdings = [...prev.holdings]
  const idx = holdings.findIndex((h) => h.id === log.holdingId)
  const current = idx >= 0 ? holdings[idx] : undefined

  if (d.holdingRemoved) {
    // Sold off: bring it back, into a holding of the same ticker if one was added since
    const twin = current ?? holdings.find((h) => h.assetClass === log.assetClass && h.ticker.toUpperCase() === log.ticker.toUpperCase())
    if (twin && (twin.locations?.length ?? 0) > 0 && twin.id !== log.holdingId) {
      return { ok: false, reason: `"${twin.name}" was added again and is now split across locations. Buy the units back into one of them instead.` }
    }
    if (twin) {
      // The old holding's location ids don't exist on a re-added one
      const back = reverseHolding(twin, twin.id === log.holdingId ? d : { ...d, location: undefined })
      if (!back) return { ok: false, reason: `"${log.holdingName}" can't take these units back.` }
      holdings = holdings.map((h) => (h.id === twin.id ? back : h))
    } else if (log.previousHoldingState) {
      holdings.push(log.previousHoldingState)
    } else {
      return { ok: false, reason: `"${log.holdingName}" was sold off and its details weren't saved, so the sale can't be undone.` }
    }
  } else if (!current) {
    // Nothing to reverse against; an add whose holding was already removed is simply gone
    if (!d.holdingCreated) return { ok: false, reason: `"${log.holdingName}" is no longer in your portfolio, so this can't be undone.` }
  } else if (d.holdingCreated && Math.abs(units(current) - d.units) <= qtyEpsilon(current.assetClass)) {
    // Added and nothing changed its units since: remove it
    holdings = holdings.filter((h) => h.id !== current.id)
  } else {
    const back = reverseHolding(current, d)
    if (!back) {
      return {
        ok: false,
        reason: `Undoing this would leave ${log.holdingName}${d.location ? ' at that location' : ''} below zero, because some of it was sold or moved since.`,
      }
    }
    holdings = holdings.map((h) => (h.id === current.id ? back : h))
  }

  return { ok: true, data: { ...prev, holdings, cashAccounts: reverseCash(prev.cashAccounts ?? [], d) } }
}

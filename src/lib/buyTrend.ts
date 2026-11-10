import type { HoldingLog } from './types'
import { logHoldingStates } from './logStates'
import { localDateStr } from './format'

/** One paid buy: what it cost per unit, and the average buy price right after it */
export interface TrendBuy {
  id: string
  /** YYYY-MM-DD: the plan's buy day for DCA buys, else the day it was logged */
  date: string
  /** THB per unit */
  price: number
  units: number
  /** THB spent */
  thb: number
  /** Came from a DCA plan */
  dca: boolean
  planId?: string
  /** Average buy price after this buy, THB per unit */
  avgAfter: number
}

/** One sale, drawn on the chart; it lowers units held but not the average buy price */
export interface TrendSell {
  id: string
  date: string
  price: number
  units: number
}

export interface BuyTrend {
  buys: TrendBuy[]
  sells: TrendSell[]
  /** Average buy price now (paid units still held), null with no paid buys */
  avg: number | null
  totalThb: number
  totalUnits: number
  /** Buys that came free (gift, inheritance), left out on purpose */
  receivedCount: number
  /** Buys whose log has no numbers to read, left out */
  unreadableCount: number
}

export interface BuyTrendFilter {
  holdingId?: string
  /** Only the buys this DCA plan logged */
  planId?: string
}

function logDate(log: HoldingLog): string {
  if (log.dcaDate && /^\d{4}-\d{2}-\d{2}$/.test(log.dcaDate)) return log.dcaDate
  const at = new Date(log.timestamp)
  return Number.isNaN(at.getTime()) ? '' : localDateStr(at)
}

/** Units and THB a buy added, from its delta, or from the old before/after snapshots */
function buyFigures(log: HoldingLog): { units: number; thb: number } | null {
  if (log.delta) return { units: log.delta.units, thb: log.delta.thb }
  const { prev, curr } = logHoldingStates(log)
  if (!curr) return null
  const cost = (h?: { totalThbInvested?: number; avgCost: number; units: number }) =>
    h ? (h.totalThbInvested ?? h.avgCost * h.units) : 0
  return { units: curr.units - (prev?.units ?? 0), thb: cost(curr) - cost(prev) }
}

/** Units held right before a sale, so the sale can take its share of the paid units */
function unitsBeforeSale(log: HoldingLog): number | undefined {
  if (log.delta?.before) return log.delta.before.units
  return logHoldingStates(log).prev?.units
}

function matches(log: HoldingLog, f: BuyTrendFilter): boolean {
  if (f.planId && log.dcaPlanId !== f.planId) return false
  if (f.holdingId && log.holdingId !== f.holdingId) return false
  return Boolean(f.planId || f.holdingId)
}

/**
 * Every paid buy of a holding (or of one DCA plan) in date order, with the running average buy price.
 * Free units (source 'received') are left out. A sale keeps the average and takes its share of units,
 * the same way the holding's own average cost works. Computed from the log every time, never stored.
 */
export function buildBuyTrend(logs: HoldingLog[], filter: BuyTrendFilter): BuyTrend {
  const picked = logs
    .filter((l) => l.assetClass !== 'cash' && matches(l, filter))
    .filter((l) => l.action === 'add' || l.action === 'buy_more' || l.action === 'sell')
    .map((l) => ({ log: l, date: logDate(l) }))
    .filter((x) => x.date)
    // Oldest first; logs on the same day keep the order they were saved in
    .sort((a, b) => a.date.localeCompare(b.date) || a.log.timestamp.localeCompare(b.log.timestamp))

  const buys: TrendBuy[] = []
  const sells: TrendSell[] = []
  let units = 0
  let cost = 0
  let totalThb = 0
  let totalUnits = 0
  let receivedCount = 0
  let unreadableCount = 0

  for (const { log, date } of picked) {
    if (log.action === 'sell') {
      // A sale in a plan-only view still lowers what that plan bought, by the same share
      const sold = log.soldUnits ?? (log.delta ? -log.delta.units : 0)
      if (!(sold > 0)) continue
      const before = unitsBeforeSale(log)
      const share = Math.min(1, before && before > 0 ? sold / before : units > 0 ? sold / units : 1)
      units *= 1 - share
      cost *= 1 - share
      if (units < 1e-12) { units = 0; cost = 0 }
      const price = log.soldPrice ?? (log.proceeds && sold ? log.proceeds / sold : 0)
      if (price > 0) sells.push({ id: log.id, date, price, units: sold })
      continue
    }
    if (log.source === 'received') { receivedCount++; continue }
    const fig = buyFigures(log)
    if (!fig || !(fig.units > 0) || !(fig.thb > 0)) {
      // A DCA plan with no linked holding logs units 0: not a buy we can place
      if (!(log.delta && log.delta.units === 0 && log.delta.thb === 0)) unreadableCount++
      continue
    }
    units += fig.units
    cost += fig.thb
    totalThb += fig.thb
    totalUnits += fig.units
    buys.push({
      id: log.id,
      date,
      price: fig.thb / fig.units,
      units: fig.units,
      thb: fig.thb,
      dca: Boolean(log.dcaPlanId),
      ...(log.dcaPlanId ? { planId: log.dcaPlanId } : {}),
      avgAfter: cost / units,
    })
  }

  return {
    buys,
    sells,
    avg: units > 0 ? cost / units : buys.length ? buys[buys.length - 1].avgAfter : null,
    totalThb,
    totalUnits,
    receivedCount,
    unreadableCount,
  }
}

export interface BuyTrendStats {
  /** Share of buys (0–1) bought below the current price */
  belowNow: number | null
  cheapest?: TrendBuy
  dearest?: TrendBuy
  /** Plain mean of the buy prices: the gap to the weighted average is what buying by amount saved */
  meanBuyPrice: number | null
  /** Current price against the average buy price, as a fraction */
  vsAvg: number | null
}

export function buyTrendStats(trend: BuyTrend, currentPrice: number | null): BuyTrendStats {
  const { buys, avg } = trend
  if (!buys.length) return { belowNow: null, meanBuyPrice: null, vsAvg: null }
  let cheapest = buys[0]
  let dearest = buys[0]
  for (const b of buys) {
    if (b.price < cheapest.price) cheapest = b
    if (b.price > dearest.price) dearest = b
  }
  const now = currentPrice && currentPrice > 0 ? currentPrice : null
  return {
    belowNow: now ? buys.filter((b) => b.price < now).length / buys.length : null,
    cheapest,
    dearest,
    meanBuyPrice: buys.reduce((s, b) => s + b.price, 0) / buys.length,
    vsAvg: now && avg ? now / avg - 1 : null,
  }
}

/** One dot on the chart: a single buy, or several merged when there are too many to tell apart */
export interface TrendPoint {
  key: string
  date: string
  /** Last day in the group, the same as date for one buy */
  endDate: string
  price: number
  units: number
  thb: number
  count: number
  dca: boolean
  avgAfter: number
}

function weekStart(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const at = new Date(y, m - 1, d)
  at.setDate(at.getDate() - ((at.getDay() + 6) % 7))
  return localDateStr(at)
}

/** Merge buys by week, then by month, until there are at most `max` dots (daily DCA makes hundreds) */
export function groupBuys(buys: TrendBuy[], max = 60): { points: TrendPoint[]; by: 'buy' | 'week' | 'month' } {
  const one = (b: TrendBuy): TrendPoint => ({
    key: b.id, date: b.date, endDate: b.date, price: b.price, units: b.units, thb: b.thb, count: 1, dca: b.dca, avgAfter: b.avgAfter,
  })
  if (buys.length <= max) return { points: buys.map(one), by: 'buy' }
  const merge = (keyOf: (d: string) => string): TrendPoint[] => {
    const out: TrendPoint[] = []
    let last: TrendPoint | undefined
    let lastKey = ''
    for (const b of buys) {
      const k = keyOf(b.date)
      if (last && k === lastKey) {
        last.units += b.units
        last.thb += b.thb
        last.count++
        last.price = last.thb / last.units
        last.endDate = b.date
        last.dca = last.dca || b.dca
        last.avgAfter = b.avgAfter
      } else {
        last = { ...one(b), key: k }
        lastKey = k
        out.push(last)
      }
    }
    return out
  }
  const weeks = merge(weekStart)
  if (weeks.length <= max) return { points: weeks, by: 'week' }
  return { points: merge((d) => d.slice(0, 7)), by: 'month' }
}

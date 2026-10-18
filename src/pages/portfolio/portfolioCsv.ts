import { ASSET_META, GRAMS_PER_BAHT_GOLD, SATS_PER_BTC, type HoldingMetrics } from '../../lib/calc'
import { rateOrZero } from '../../lib/fx'
import type { AssetClass } from '../../lib/types'

/** The holdings CSV (Portfolio → Export) and the small labels the page shares with it. */

export const PORTFOLIO_CSV_HEADER = [
    'Asset Class',
    'Tag / Group',
    'Ticker',
    'Holding Name',
    'Quantity',
    'Unit',
    'Avg Cost (THB)',
    'Current Price (THB)',
    'Total Cost (THB)',
    'Market Value (THB)',
    'Unrealized PnL (THB)',
    'Unrealized PnL (%)',
    'Portfolio Weight (%)',
    'Foreign / Native Currency Details',
    'Storage Locations',
    'Last Updated',
]

/** One CSV row per holding; weights are against the whole portfolio value. */
export function portfolioCsvRows(rows: HoldingMetrics[], portfolioValue: number, usdThb: number | null) {
  // Real rate or 0: USD figures that need converting are left out rather than worked out at a made-up rate
  const rate = rateOrZero(usdThb)

  return rows.map((h) => {
    const isStock = h.assetClass === 'stock'
    const isCrypto = h.assetClass === 'crypto'
    const isGold = h.assetClass === 'gold'
    const isFund = h.assetClass === 'fund'
    const isRealEstate = h.assetClass === 'real_estate'

    const assetClassLabel = ASSET_META[h.assetClass]?.label ?? h.assetClass
    const uLabel = unitLabel(h.assetClass)
    const avgCostThb = h.units > 0 ? h.costBasis / h.units : h.avgCost

    let nativeDetails = ''
    let locationsStr = ''

    if (isStock) {
      const avgUsd = h.avgCostUsd ?? (rate > 0 ? h.avgCost / rate : 0)
      const priceUsd = rate > 0 ? h.price / rate : 0
      const totalCostUsd = h.totalUsdInvested ?? (avgUsd * h.units)
      const marketValUsd = rate > 0 ? h.marketValue / rate : 0
      const pnlUsd = marketValUsd - totalCostUsd
      nativeDetails = rate > 0
        ? `Avg: $${avgUsd.toFixed(2)} | Price: $${priceUsd.toFixed(2)} | Cost: $${totalCostUsd.toFixed(2)} | Value: $${marketValUsd.toFixed(2)} | PnL: ${pnlUsd >= 0 ? '+' : ''}$${pnlUsd.toFixed(2)}`
        : `Avg: ${h.avgCostUsd ? `$${h.avgCostUsd.toFixed(2)}` : 'n/a'} | USD price and value: n/a (no USD/THB rate loaded)`
    } else if (isCrypto) {
      const sats = Math.round(h.units * SATS_PER_BTC)
      const avgCostPerBtc = h.units > 0 ? h.costBasis / h.units : h.avgCost
      const avgCostPerBtcUsd = rate > 0 ? avgCostPerBtc / rate : 0
      const priceUsd = rate > 0 ? h.price / rate : 0
      nativeDetails = rate > 0
        ? `${sats.toLocaleString()} sats | Avg: $${Math.round(avgCostPerBtcUsd).toLocaleString()}/BTC | Price: $${Math.round(priceUsd).toLocaleString()}/BTC`
        : `${sats.toLocaleString()} sats | Avg: ฿${Math.round(avgCostPerBtc).toLocaleString()}/BTC | Price: ฿${Math.round(h.price).toLocaleString()}/BTC`
      locationsStr = (h.btcLocations ?? []).map((loc) => `${loc.name}: ${loc.satoshi.toLocaleString()} sats (฿${loc.thbSpent.toLocaleString()})`).join('; ')
    } else if (isGold) {
      const bahtGold = h.units / GRAMS_PER_BAHT_GOLD
      const avgCostPerBaht = (h.units > 0 ? h.costBasis / h.units : h.avgCost) * GRAMS_PER_BAHT_GOLD
      const pricePerBaht = h.price * GRAMS_PER_BAHT_GOLD
      nativeDetails = `${bahtGold.toFixed(4)} gold baht | Avg: ฿${Math.round(avgCostPerBaht).toLocaleString()}/gold baht | Price: ฿${Math.round(pricePerBaht).toLocaleString()}/gold baht`
      locationsStr = (h.goldLocations ?? []).map((loc) => `${loc.name}: ${(loc.grams / GRAMS_PER_BAHT_GOLD).toFixed(4)} gold baht (${loc.grams}g, ฿${loc.thbSpent.toLocaleString()})`).join('; ')
    } else if (isFund) {
      nativeDetails = `Avg NAV: ฿${h.avgCost.toFixed(4)} | Current NAV: ฿${h.price.toFixed(4)}`
    } else if (isRealEstate) {
      nativeDetails = `Real Estate | Valuation: ฿${h.price.toLocaleString()} | Cost: ฿${h.avgCost.toLocaleString()}`
    }

    const weightPct = portfolioValue > 0 ? (h.marketValue / portfolioValue) * 100 : 0
    const qty = isCrypto ? Number(h.units.toFixed(8)) : Number(h.units.toFixed(4))

    return [
      assetClassLabel,
      h.tag || '',
      h.ticker,
      h.name,
      qty,
      uLabel,
      avgCostThb.toFixed(2),
      h.price.toFixed(2),
      h.costBasis.toFixed(2),
      h.marketValue.toFixed(2),
      // No real price: there is no P/L to write, only a value counted at cost
      h.priced ? h.pnl.toFixed(2) : '',
      h.priced ? `${h.pnlPct >= 0 ? '+' : ''}${h.pnlPct.toFixed(2)}%` : 'No price yet',
      `${weightPct.toFixed(2)}%`,
      nativeDetails,
      locationsStr,
      h.updatedAt || '',
    ]
  })
}

export function isPriceStale(updatedAt?: string): boolean {
  if (!updatedAt) return false
  const [y, m, d] = updatedAt.split('-').map(Number)
  const updated = new Date(y, m - 1, d)
  return (Date.now() - updated.getTime()) / 86_400_000 >= 7
}

export function unitLabel(assetClass: AssetClass): string {
  if (assetClass === 'fund') return 'units'
  if (assetClass === 'stock') return 'shares'
  if (assetClass === 'gold') return 'g'
  return 'BTC'
}

/** Live prices: BTC and stocks via Binance + Yahoo Finance, all converted to THB. */

async function binancePrice(symbol: string): Promise<number> {
  const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`)
  if (!res.ok) throw new Error(`Binance ${symbol}: ${res.status}`)
  const json = await res.json()
  const price = parseFloat(json.price)
  if (!price || isNaN(price)) throw new Error(`Binance ${symbol}: invalid price`)
  return price
}

const THAI_GOLD_GRAMS_PER_TROY_OUNCE = 31.1035
const GOLD_PRICE_CACHE_TTL_MS = 5 * 60 * 1000
let cachedGoldPrice: { xauThb: number; pricePerGram: number; updatedAt: number } | null = null

/** USD/THB — tries Binance USDTTHB first, falls back to open.er-api.com */
export async function fetchUsdThb(): Promise<number> {
  try {
    return await binancePrice('USDTTHB')
  } catch {
    const res = await fetch('https://open.er-api.com/v6/latest/USD')
    if (!res.ok) throw new Error(`USD/THB fallback: ${res.status}`)
    const json = await res.json()
    const rate = json?.rates?.THB
    if (!rate) throw new Error('USD/THB fallback: no THB rate')
    return rate
  }
}

/**
 * GoldPriceService: fetch XAU/THB spot from Binance and derive THB per gram.
 * Falls back to the last cached value if the API fails.
 */
export async function fetchXauThbPricePerGram(): Promise<{ xauThb: number; pricePerGram: number; updatedAt: number }> {
  const now = Date.now()
  if (cachedGoldPrice && now < cachedGoldPrice.updatedAt + GOLD_PRICE_CACHE_TTL_MS) {
    return cachedGoldPrice
  }

  try {
    const xauUsdt = await binancePrice('XAUTUSDT')
    const usdThb = await fetchUsdThb()
    const xauThb = xauUsdt * usdThb
    if (typeof xauThb !== 'number' || Number.isNaN(xauThb) || xauThb <= 0) {
      throw new Error('Invalid XAU/THB price')
    }

    const pricePerGram = parseFloat((xauThb / THAI_GOLD_GRAMS_PER_TROY_OUNCE).toFixed(4))
    cachedGoldPrice = { xauThb, pricePerGram, updatedAt: now }
    return cachedGoldPrice
  } catch (error) {
    if (cachedGoldPrice) {
      return cachedGoldPrice
    }
    throw error
  }
}

/** BTC in THB = BTCUSDT × USD/THB */
export async function fetchBtcThb(): Promise<number> {
  const [btcUsdt, usdThb] = await Promise.all([
    binancePrice('BTCUSDT'),
    fetchUsdThb(),
  ])
  return btcUsdt * usdThb
}

/** Fetch a single stock's latest price in USD via Finnhub Quote API. */
async function fetchOneStockUsd(ticker: string): Promise<number> {
  const token = import.meta.env.VITE_FINNHUB_API_KEY || ''
  if (!token) throw new Error('Finnhub API key not configured (VITE_FINNHUB_API_KEY)')
  
  const res = await fetch(
    `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker.toUpperCase())}&token=${token}`,
  )
  if (!res.ok) throw new Error(`Finnhub ${ticker}: ${res.status}`)
  const json = await res.json()
  const price = json?.c
  if (!price || isNaN(price)) throw new Error(`Finnhub ${ticker}: invalid price in response`)
  return price
}

/** Stock prices in USD from Finnhub API (parallel). */
export async function fetchStockPricesUsd(tickers: string[]): Promise<Record<string, number>> {
  if (tickers.length === 0) return {}
  const results = await Promise.allSettled(
    tickers.map(async (t) => ({ ticker: t.toUpperCase(), price: await fetchOneStockUsd(t) })),
  )
  const map: Record<string, number> = {}
  for (const r of results) {
    if (r.status === 'fulfilled') map[r.value.ticker] = r.value.price
  }
  return map
}

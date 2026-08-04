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

/** USD/THB — tries Binance TH USDTTHB first, falls back to open.er-api.com */
export async function fetchUsdThb(): Promise<number> {
  try {
    const res = await fetch('https://api.binance.th/api/v1/ticker/price?symbol=USDTTHB')
    if (!res.ok) throw new Error(`Binance TH USDTTHB: ${res.status}`)
    const json = await res.json()
    const price = parseFloat(json.price)
    if (!price || isNaN(price)) throw new Error('Binance TH USDTTHB: invalid price')
    return price
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

/** Stock prices in USD via Supabase Edge Function (proxies Yahoo Finance — no API key needed). */
export async function fetchStockPricesUsd(tickers: string[]): Promise<Record<string, number>> {
  if (tickers.length === 0) return {}

  const supabaseUrl = import.meta.env.VITE_API_URL || ''
  const supabaseKey = import.meta.env.VITE_API_TOKEN || ''
  if (!supabaseUrl) throw new Error('Supabase URL not configured (VITE_API_URL)')

  const symbols = tickers.map((t) => t.toUpperCase()).join(',')

  const res = await fetch(`${supabaseUrl}/functions/v1/smart-responder`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
      'apikey': supabaseKey,
    },
    body: JSON.stringify({ symbols }),
  })

  if (!res.ok) throw new Error(`stock-price Edge Function: ${res.status}`)

  const json = await res.json()
  if (json.error) throw new Error(`stock-price Edge Function: ${json.error}`)

  // json.prices = { "SGOV": 100.43, "AAPL": 210.5, ... }
  return (json.prices as Record<string, number>) ?? {}
}

/** Live prices: BTC and stocks via Binance + Yahoo Finance, all converted to THB. */

async function binancePrice(symbol: string): Promise<number> {
  const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`)
  if (!res.ok) throw new Error(`Binance ${symbol}: ${res.status}`)
  const json = await res.json()
  const price = parseFloat(json.price)
  if (!price || isNaN(price)) throw new Error(`Binance ${symbol}: invalid price`)
  return price
}

/** USD/THB — tries Binance USDTTHB first, falls back to open.er-api.com */
export async function fetchUsdThb(): Promise<number> {
  try {
    return await binancePrice('USDTTHB')
  } catch {
    // Fallback: free exchange rate API, no key needed
    const res = await fetch('https://open.er-api.com/v6/latest/USD')
    if (!res.ok) throw new Error(`USD/THB fallback: ${res.status}`)
    const json = await res.json()
    const rate = json?.rates?.THB
    if (!rate) throw new Error('USD/THB fallback: no THB rate')
    return rate
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

/** Fetch a single stock's latest price in USD via Yahoo Finance chart endpoint (via Vite proxy). */
async function fetchOneStockUsd(ticker: string): Promise<number> {
  const res = await fetch(
    `/yahoo-finance/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`,
  )
  if (!res.ok) throw new Error(`Yahoo ${ticker}: ${res.status}`)
  const json = await res.json()
  const price =
    json?.chart?.result?.[0]?.meta?.regularMarketPrice ??
    json?.chart?.result?.[0]?.meta?.previousClose
  if (!price) throw new Error(`Yahoo ${ticker}: no price in response`)
  return price
}

/** Stock prices in USD from Yahoo Finance chart API (parallel, via Vite dev proxy). */
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

import { useEffect, useRef, useState } from 'react'
import { useData } from '../store/DataContext'
import { fetchBtcThb, fetchStockPricesUsd, fetchUsdThb, fetchXauThbPricePerGram } from '../lib/prices'
import { localDateStr } from '../lib/format'

const REFRESH_MS = 60_000

const CACHED_USD_THB_KEY = 'spendiary.cached_usd_thb'
const CACHED_GOLD_PRICE_KEY = 'spendiary.cached_gold_thb_gram'
const CACHED_LAST_UPDATED_KEY = 'spendiary.cached_prices_last_updated'

export type PriceStatus = 'idle' | 'loading' | 'ok' | 'partial' | 'error'

export function useLivePrices() {
  const { data, upsertHolding, setUsdThb } = useData()
  const [status, setStatus] = useState<PriceStatus>('idle')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(() => {
    try {
      const cached = localStorage.getItem(CACHED_LAST_UPDATED_KEY)
      return cached ? new Date(cached) : null
    } catch {
      return null
    }
  })
  const [usdThbLocal, setUsdThbLocal] = useState<number | null>(() => {
    try {
      const cached = localStorage.getItem(CACHED_USD_THB_KEY)
      return cached ? parseFloat(cached) : null
    } catch {
      return null
    }
  })
  const [goldThbPerGram, setGoldThbPerGram] = useState<number | null>(() => {
    try {
      const cached = localStorage.getItem(CACHED_GOLD_PRICE_KEY)
      if (cached) return parseFloat(cached)
      const gh = data.holdings.find((h) => h.assetClass === 'gold' && h.price > 0)
      return gh ? gh.price : null
    } catch {
      return null
    }
  })
  const [errorMsg, setErrorMsg] = useState<string>('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Keep a stable ref to data so the interval always sees latest holdings
  const dataRef = useRef(data)
  dataRef.current = data

  async function refresh() {
    setStatus('loading')
    const holdings = dataRef.current.holdings
    const stockHoldings = holdings.filter((h) => h.assetClass === 'stock')
    const cryptoHoldings = holdings.filter((h) => h.assetClass === 'crypto')
    const goldHoldings = holdings.filter((h) => h.assetClass === 'gold')
    const today = localDateStr()

    let btcOk = false
    let stocksOk = false
    let goldOk = false
    const errors: string[] = []

    // BTC
    if (cryptoHoldings.length > 0) {
      try {
        const btcThb = await fetchBtcThb()
        for (const h of cryptoHoldings) {
          upsertHolding({ ...h, price: btcThb, updatedAt: today })
        }
        btcOk = true
      } catch (e) {
        errors.push(`BTC: ${(e as Error).message}`)
      }
    } else {
      btcOk = true
    }

    // Stocks
    if (stockHoldings.length > 0) {
      try {
        const [usdRate, stockPricesUsd] = await Promise.all([
          fetchUsdThb(),
          fetchStockPricesUsd(stockHoldings.map((h) => h.ticker)),
        ])
        setUsdThbLocal(usdRate)
        setUsdThb(usdRate)
        try {
          localStorage.setItem(CACHED_USD_THB_KEY, String(usdRate))
        } catch {
          // ignore
        }
        for (const h of stockHoldings) {
          const usdPrice = stockPricesUsd[h.ticker.toUpperCase()]
          if (usdPrice && usdRate > 0) {
            upsertHolding({ ...h, price: usdPrice * usdRate, updatedAt: today })
          }
        }
        stocksOk = true
      } catch (e) {
        errors.push(`Stocks: ${(e as Error).message}`)
      }
    } else {
      stocksOk = true
    }

    // Gold
    if (goldHoldings.length > 0) {
      try {
        const goldPrice = await fetchXauThbPricePerGram()
        setGoldThbPerGram(goldPrice.pricePerGram)
        try {
          localStorage.setItem(CACHED_GOLD_PRICE_KEY, String(goldPrice.pricePerGram))
        } catch {
          // ignore
        }
        for (const h of goldHoldings) {
          upsertHolding({ ...h, price: goldPrice.pricePerGram, updatedAt: today })
        }
        goldOk = true
      } catch (e) {
        errors.push(`Gold: ${(e as Error).message}`)
      }
    } else {
      goldOk = true
    }

    if (btcOk && stocksOk && goldOk) {
      setStatus('ok')
      setErrorMsg('')
    } else if (btcOk || stocksOk) {
      setStatus('partial')
      setErrorMsg(errors.join(' · '))
    } else {
      setStatus('error')
      setErrorMsg(errors.join(' · '))
    }
    const now = new Date()
    setLastUpdated(now)
    try {
      localStorage.setItem(CACHED_LAST_UPDATED_KEY, now.toISOString())
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (usdThbLocal && usdThbLocal > 0) {
      setUsdThb(usdThbLocal)
    }
  }, [setUsdThb])

  useEffect(() => {
    refresh()
    timerRef.current = setInterval(refresh, REFRESH_MS)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  return { status, lastUpdated, usdThb: usdThbLocal, goldThbPerGram, errorMsg, refresh }
}

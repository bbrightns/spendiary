import { useEffect, useRef, useState } from 'react'
import { useData } from '../store/DataContext'
import { fetchBtcThb, fetchStockPricesUsd, fetchUsdThb, fetchXauThbPricePerGram } from '../lib/prices'
import { localDateStr } from '../lib/format'
import { hasRealPrice } from '../lib/calc'
import {
  isValidPrice,
  readCachedGoldThbPerGram,
  readPricesUpdatedAt,
  writeCachedGoldThbPerGram,
  writePricesUpdatedAt,
} from '../lib/priceCache'

const REFRESH_MS = 60_000

export type PriceStatus = 'idle' | 'loading' | 'ok' | 'partial' | 'error'

export function useLivePrices() {
  const { data, upsertHolding, usdThb, setUsdThb } = useData()
  const [status, setStatus] = useState<PriceStatus>('idle')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(readPricesUpdatedAt)
  const [goldThbPerGram, setGoldThbPerGram] = useState<number | null>(() => {
    const cached = readCachedGoldThbPerGram()
    if (cached !== null) return cached
    // A cost stand-in is not a gold price
    const gh = data.holdings.find((h) => h.assetClass === 'gold' && isValidPrice(h.price) && hasRealPrice(h))
    return gh ? gh.price : null
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
        if (!isValidPrice(btcThb)) throw new Error('invalid price')
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
        // Saves the rate for the next visit too (see lib/fx.ts)
        setUsdThb(usdRate)
        for (const stale of stockHoldings) {
          const usdPrice = stockPricesUsd[stale.ticker.toUpperCase()]
          // Re-read the latest holding: units/cost may have changed (e.g. DCA confirm) while the fetch was in flight
          const h = dataRef.current.holdings.find((x) => x.id === stale.id)
          if (h && isValidPrice(usdPrice) && isValidPrice(usdRate)) {
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
        if (!isValidPrice(goldPrice.pricePerGram)) throw new Error('invalid price')
        setGoldThbPerGram(goldPrice.pricePerGram)
        writeCachedGoldThbPerGram(goldPrice.pricePerGram)
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
    writePricesUpdatedAt(now)
  }

  useEffect(() => {
    refresh()
    timerRef.current = setInterval(refresh, REFRESH_MS)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  return { status, lastUpdated, usdThb, goldThbPerGram, errorMsg, refresh }
}

/**
 * Live prices kept on this device between visits. A cached value is only used when it is a real
 * price (a finite number above zero); anything else (an old "NaN", an empty or hand-edited entry)
 * reads as "no price yet" instead of reaching the totals.
 */
import { isValidRate } from './fx'

const GOLD_KEY = 'spendiary.cached_gold_thb_gram'
const UPDATED_AT_KEY = 'spendiary.cached_prices_last_updated'

/** A usable price: a finite number above zero */
export const isValidPrice = isValidRate

/** The last real Thai gold price (THB per gram, 96.5%) saved on this device, or null */
export function readCachedGoldThbPerGram(): number | null {
  try {
    const raw = localStorage.getItem(GOLD_KEY)
    if (raw === null) return null
    const price = Number(raw)
    if (isValidPrice(price)) return price
    // A broken entry would come back on every visit; drop it
    localStorage.removeItem(GOLD_KEY)
    return null
  } catch {
    return null
  }
}

/** Keep a freshly fetched gold price; an invalid one is never saved */
export function writeCachedGoldThbPerGram(price: number): void {
  if (!isValidPrice(price)) return
  try {
    localStorage.setItem(GOLD_KEY, String(price))
  } catch {
    // Storage full or blocked: the price still works for this visit
  }
}

/** When live prices last refreshed on this device, or null when unknown or unreadable */
export function readPricesUpdatedAt(): Date | null {
  try {
    const raw = localStorage.getItem(UPDATED_AT_KEY)
    if (!raw) return null
    const date = new Date(raw)
    return Number.isNaN(date.getTime()) ? null : date
  } catch {
    return null
  }
}

export function writePricesUpdatedAt(at: Date): void {
  try {
    localStorage.setItem(UPDATED_AT_KEY, at.toISOString())
  } catch {
    // ignore
  }
}

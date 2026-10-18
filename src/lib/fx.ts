/**
 * The USD/THB rate the app uses. It is always a rate that was really fetched (now, or the last
 * time this device was online), never a guessed constant. When no real rate has ever been
 * fetched it is null, and callers must say so rather than invent one.
 */
import { STORAGE_KEYS } from './storageKeys'

const RATE_KEY = STORAGE_KEYS.usdThb
const RATE_AT_KEY = STORAGE_KEYS.usdThbAt
// Older builds only stored when any price last refreshed; good enough as the rate's date
const LEGACY_PRICES_AT_KEY = STORAGE_KEYS.pricesUpdatedAt

export interface UsdThbRate {
  rate: number
  /** When it was fetched; null when the device only kept the rate */
  asOf: Date | null
}

/** A usable exchange rate: a finite number above zero */
export function isValidRate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function readDate(key: string): Date | null {
  const raw = localStorage.getItem(key)
  if (!raw) return null
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

/** The last real rate saved on this device, or null when there is none (or it is unreadable) */
export function readCachedUsdThb(): UsdThbRate | null {
  try {
    const rate = Number(localStorage.getItem(RATE_KEY))
    if (!isValidRate(rate)) return null
    return { rate, asOf: readDate(RATE_AT_KEY) ?? readDate(LEGACY_PRICES_AT_KEY) }
  } catch {
    return null
  }
}

/** Keep a freshly fetched rate so the next visit starts with it */
export function writeCachedUsdThb(rate: number, asOf: Date): void {
  try {
    localStorage.setItem(RATE_KEY, String(rate))
    localStorage.setItem(RATE_AT_KEY, asOf.toISOString())
  } catch {
    // Storage full or blocked: the rate still works for this visit
  }
}

/**
 * The rate to convert with, or 0 when no real rate is known. Multiplying by 0 leaves USD amounts
 * out of THB totals (the app says so in a notice) instead of converting them at a made-up rate.
 */
export function rateOrZero(usdThb: number | null | undefined): number {
  return isValidRate(usdThb) ? usdThb : 0
}

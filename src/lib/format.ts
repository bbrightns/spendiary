/** THB is the default currency throughout Spendiary. */

/** Narrow no-break space — keeps ฿ visually clear of the digits. */
const NBSP = ' '

const baht = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const baht2 = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** e.g. ฿1,240,500 */
export function thb(value: number, decimals = false): string {
  const n = decimals ? baht2.format(value) : baht.format(Math.round(value))
  return `฿${NBSP}${n}`
}

/** Compact for tight spaces, e.g. ฿1.24M */
export function thbCompact(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}฿${NBSP}${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${sign}฿${NBSP}${(abs / 1_000).toFixed(1)}K`
  return `${sign}฿${NBSP}${baht.format(abs)}`
}

/** Signed percentage, e.g. +12.4% */
export function pct(value: number, decimals = 1): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}%`
}

/** Signed money, e.g. +฿12,400 */
export function signedThb(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : ''
  return `${sign}฿${NBSP}${baht.format(Math.abs(Math.round(value)))}`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
}

export function daysUntil(iso: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(iso)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - now.getTime()) / 86_400_000)
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

import { thb, thbCompact } from './format'

const NBSP = String.fromCharCode(160)

/** A price per unit: whole baht for big prices (BTC, gold), satang for fund NAVs, more for tiny coins */
export function unitPrice(value: number): string {
  if (value >= 1000) return thb(value)
  if (value >= 1) return thb(value, true)
  return `฿${NBSP}${value.toLocaleString('en-US', { maximumSignificantDigits: 4 })}`
}

/** Short axis label, no ฿: 2.45M, 31.2K, 12.35 */
export function axisPrice(value: number): string {
  if (Math.abs(value) >= 1000) return thbCompact(value).replace(`฿${NBSP}`, '')
  if (Math.abs(value) >= 1) return value.toFixed(2)
  return value.toLocaleString('en-US', { maximumSignificantDigits: 3 })
}

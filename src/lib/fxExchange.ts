import { roundMoney } from './money'

export interface ExchangeAmounts {
  thb: number
  usd: number
  /** THB per USD */
  rate: number
  /** Which of the three was worked out from the other two */
  derived: 'thb' | 'usd' | 'rate'
}

const pos = (n: number) => Number.isFinite(n) && n > 0
const round4 = (n: number) => Math.round(n * 10_000) / 10_000

/**
 * An exchange from any two of: baht paid, dollars received, rate.
 * The dollars that arrived win over a typed rate (that's what the account really got), so with all
 * three typed the rate is worked out from the amounts. Null until two are given.
 */
export function resolveExchange(thb: number, usd: number, rate: number): ExchangeAmounts | null {
  if (pos(thb) && pos(usd)) return { thb: roundMoney(thb), usd: roundMoney(usd), rate: round4(thb / usd), derived: 'rate' }
  if (pos(usd) && pos(rate)) return { thb: roundMoney(usd * rate), usd: roundMoney(usd), rate, derived: 'thb' }
  if (pos(thb) && pos(rate)) return { thb: roundMoney(thb), usd: roundMoney(thb / rate), rate, derived: 'usd' }
  return null
}

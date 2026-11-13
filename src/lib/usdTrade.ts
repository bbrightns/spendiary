import { isValidRate } from './fx'
import { roundMoney } from './money'

/** The currency the money of a US-stock trade moved in: picks which numbers the form asks for */
export type TradeCurrency = 'USD' | 'THB'

/** What the person typed; '' or 0 means left empty */
export interface UsdTradeInput {
  currency: TradeCurrency
  shares: number
  priceUsd: number
  /** THB trades only: the baht that left (buy) or arrived (sell) */
  amountThb: number
  /** A rate typed by hand; 0 = use liveFx (USD trades) or work it out from the amounts (THB trades) */
  fx: number
  /** Today's real USD/THB rate, or 0 when none is known */
  liveFx: number
}

export interface UsdTrade {
  shares: number
  priceUsd: number
  /** shares × price */
  usd: number
  thb: number
  /** THB per USD this trade used */
  fx: number
  /** THB trade with no shares typed: shares were estimated from the amount at the rate */
  sharesEstimated: boolean
  /** THB trade with shares typed: the rate came out of the amounts, not a field */
  fxFromAmounts: boolean
}

const round4 = (n: number) => Math.round(n * 10_000) / 10_000
const pos = (n: number) => Number.isFinite(n) && n > 0

/**
 * Resolves a US-stock trade from the fields its currency needs:
 * - USD: shares and price. USD = shares × price; THB = USD × (typed rate, else today's rate).
 * - THB: the baht amount and the price. Shares typed: the rate is amount ÷ (shares × price).
 *   Shares left empty: they are estimated at the typed or today's rate.
 * Null while a needed number is missing (or no rate is known where one is needed).
 */
export function resolveUsdTrade(i: UsdTradeInput): UsdTrade | null {
  if (!pos(i.priceUsd)) return null
  const rate = pos(i.fx) ? i.fx : isValidRate(i.liveFx) ? i.liveFx : 0

  if (i.currency === 'USD') {
    if (!pos(i.shares) || rate <= 0) return null
    const usd = roundMoney(i.shares * i.priceUsd)
    return { shares: i.shares, priceUsd: i.priceUsd, usd, thb: roundMoney(usd * rate), fx: rate, sharesEstimated: false, fxFromAmounts: false }
  }

  if (!pos(i.amountThb)) return null
  const thb = roundMoney(i.amountThb)
  if (pos(i.shares)) {
    const usd = roundMoney(i.shares * i.priceUsd)
    if (usd <= 0) return null
    return { shares: i.shares, priceUsd: i.priceUsd, usd, thb, fx: round4(thb / usd), sharesEstimated: false, fxFromAmounts: true }
  }
  if (rate <= 0) return null
  const shares = round4(thb / rate / i.priceUsd)
  if (shares <= 0) return null
  return { shares, priceUsd: i.priceUsd, usd: roundMoney(thb / rate), thb, fx: rate, sharesEstimated: true, fxFromAmounts: false }
}

/** A rate more than `tolerance` away from today's: most likely a typo in the amount, shares or price */
export function fxLooksOff(fx: number, liveFx: number, tolerance = 0.05): boolean {
  if (!pos(fx) || !isValidRate(liveFx)) return false
  return Math.abs(fx - liveFx) / liveFx > tolerance
}

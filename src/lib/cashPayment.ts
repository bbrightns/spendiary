import type { CashAccount } from './types'
import { isValidRate } from './fx'
import { roundMoney } from './money'

/** What a trade cost or paid out: always in THB, and in USD too when the trade itself was priced in USD */
export interface TradeAmount {
  thb: number
  /** The USD figure of the trade (US stocks); used as-is for a USD account instead of converting the THB */
  usd?: number
}

/**
 * The trade's amount in the currency of the cash account it moves through.
 * - THB account: the THB amount
 * - USD account: the trade's own USD amount, or the THB amount converted at `usdThb`
 * Null when a USD account needs a conversion and no real rate is known.
 */
export function amountInAccountCurrency(
  account: Pick<CashAccount, 'currency'> | undefined,
  trade: TradeAmount,
  usdThb: number | null | undefined,
): number | null {
  if (account?.currency !== 'USD') return roundMoney(trade.thb)
  if (trade.usd !== undefined && Number.isFinite(trade.usd) && trade.usd > 0) return roundMoney(trade.usd)
  if (!isValidRate(usdThb)) return null
  return roundMoney(trade.thb / usdThb)
}

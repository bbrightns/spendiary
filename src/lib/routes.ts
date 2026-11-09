/** Paths shared by the Spend and Invest sides, kept here so layout code needn't import a module. */

/** Prefix of Spend's inner pages (/spend/txns, …) */
export const SPEND_ROOT = '/spend'
/** Spend Home is the app's home */
export const SPEND_HOME = '/'
/** Invest's home page */
export const INVEST_HOME = '/invest'

export function isSpendPath(pathname: string): boolean {
  return pathname === SPEND_HOME || pathname === SPEND_ROOT || pathname.startsWith(`${SPEND_ROOT}/`)
}

/** Cash & liquidity lives on Spend → Accounts as its own view (one home for every wallet) */
export const SPEND_CASH = `${SPEND_ROOT}/accounts?view=cash`

/**
 * Every page on the Invest side, as routed in App.tsx. Keep the two in step: switching to Invest
 * only returns to a saved page listed here. A saved page that no longer exists (or moved to Spend)
 * would hit the catch-all and bounce you back to Spend home, and Spend never overwrites the saved
 * Invest page, so the switch would stay broken on that device.
 */
const INVEST_PAGES = [
  INVEST_HOME,
  '/portfolio',
  '/rebalance',
  '/dca',
  '/dividends',
  '/cashflow/dca',
  '/cashflow/dividends',
  '/retirement',
  '/logs',
  '/logs/summary',
]

export function isInvestPage(pathname: string): boolean {
  return INVEST_PAGES.includes(pathname)
}

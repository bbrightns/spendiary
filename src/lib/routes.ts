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

/** Old Invest paths that now redirect into Spend; a saved "last Invest page" pointing at one goes to Invest home instead */
const MOVED_TO_SPEND = ['/cash', '/cashflow/cash', '/debts', '/cashflow/debts']

export function isMovedToSpend(pathname: string): boolean {
  return MOVED_TO_SPEND.includes(pathname)
}

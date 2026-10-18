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

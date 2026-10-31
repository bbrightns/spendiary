import { useLocation } from 'react-router-dom'
import { INVEST_HOME, SPEND_HOME, SPEND_ROOT, isMovedToSpend, isSpendPath } from '../lib/routes'
import { STORAGE_KEYS } from '../lib/storageKeys'

export const LAST_INVEST_KEY = STORAGE_KEYS.lastInvestPath
export const LAST_SPEND_KEY = STORAGE_KEYS.lastSpendPath
export const LAST_SIDE_KEY = STORAGE_KEYS.lastSide
/** One Settings page serves both sides; it isn't a side of its own */
export const SETTINGS_PATH = '/settings'

export const isSettings = (path: string) => path === SETTINGS_PATH || path.startsWith(`${SETTINGS_PATH}/`)

export function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // storage unavailable — switching still works, it just lands on the section's home
  }
}

/** Where switching into a side lands: the last page visited there (kept across visits), else its home. */
export function lastPathFor(spend: boolean): string {
  const saved = read(spend ? LAST_SPEND_KEY : LAST_INVEST_KEY)
  // Ignore anything stale that no longer belongs to that side
  // Spend Home moved from /spend to /, and Invest Home from / to /invest; old saved paths are
  // remapped (/spend) or fail the side check (/ now belongs to Spend) and fall back to home
  const path = saved === SPEND_ROOT ? SPEND_HOME : saved
  const bare = path?.split(/[?#]/)[0] ?? ''
  // A page that moved to Spend would redirect there and land you on the wrong side
  const valid = !!path && path.startsWith('/') && isSpendPath(bare) === spend && !isMovedToSpend(bare)
  return valid ? path! : spend ? SPEND_HOME : INVEST_HOME
}

/**
 * Which side the app is on. Pages under /spend are Spend; Settings keeps whichever side you
 * came from (so opening it from Spend doesn't flip the sidebar and tab bar to Invest).
 */
export function useSpendSide(): boolean {
  const { pathname } = useLocation()
  if (isSpendPath(pathname)) return true
  return isSettings(pathname) && read(LAST_SIDE_KEY) === 'spend'
}

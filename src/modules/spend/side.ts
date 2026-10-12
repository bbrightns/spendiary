import { useLocation } from 'react-router-dom'
import { SPEND_ROOT, isSpendPath } from './nav'

export const LAST_INVEST_KEY = 'spendiary.last_invest_path'
export const LAST_SPEND_KEY = 'spendiary.last_spend_path'
export const LAST_SIDE_KEY = 'spendiary.last_side'
/** One Settings page serves both sides; it isn't a side of its own */
export const SETTINGS_PATH = '/settings'

export const isSettings = (path: string) => path === SETTINGS_PATH

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
  const valid = !!saved && saved.startsWith('/') && isSpendPath(saved.split(/[?#]/)[0]) === spend
  return valid ? saved! : spend ? SPEND_ROOT : '/'
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

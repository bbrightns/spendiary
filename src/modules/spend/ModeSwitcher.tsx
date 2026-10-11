import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { SPEND_ROOT, isSpendPath } from './nav'

const LAST_INVEST_KEY = 'spendiary.last_invest_path'
const LAST_SPEND_KEY = 'spendiary.last_spend_path'
const INVEST_SETTINGS = '/settings'
const SPEND_SETTINGS = `${SPEND_ROOT}/settings`

const isSettings = (path: string) => path === INVEST_SETTINGS || path === SPEND_SETTINGS

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
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
 * Invest ↔ Spend switch. Each side remembers the last page you were on; from a settings
 * page it goes to the other side's settings instead.
 */
export function ModeSwitcher({ size = 'md', className = '' }: { size?: 'sm' | 'md'; className?: string }) {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const spend = isSpendPath(pathname)

  useEffect(() => {
    // Settings pages aren't remembered, so coming back lands on a page you were using
    if (isSettings(pathname)) return
    write(spend ? LAST_SPEND_KEY : LAST_INVEST_KEY, pathname + search)
  }, [pathname, search, spend])

  const go = (toSpend: boolean) => {
    if (toSpend === spend) return
    navigate(isSettings(pathname) ? (toSpend ? SPEND_SETTINGS : INVEST_SETTINGS) : lastPathFor(toSpend))
  }

  const btn = size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 flex-1 px-3 text-sm'
  // Each side has its own color: Invest the brand blue, Spend green
  const options = [
    { label: 'Invest', active: !spend, onClick: () => go(false), on: 'bg-brand text-white', idle: 'hover:text-brand-ink' },
    {
      label: 'Spend',
      active: spend,
      onClick: () => go(true),
      on: 'bg-emerald-700 text-white',
      idle: 'hover:text-emerald-700 dark:hover:text-emerald-300',
    },
  ]

  return (
    <div
      role="radiogroup"
      aria-label="Switch between Invest and Spend"
      className={`inline-flex items-center gap-0.5 rounded-full border border-line-strong/40 bg-surface-muted p-0.5 ${className}`}
    >
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          role="radio"
          aria-checked={o.active}
          onClick={o.onClick}
          className={`${btn} inline-flex items-center justify-center rounded-full font-semibold transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
            o.active ? `${o.on} font-bold shadow-xs` : `text-ink-muted ${o.idle}`
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

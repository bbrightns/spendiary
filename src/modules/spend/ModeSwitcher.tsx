import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { SPEND_ROOT, isSpendPath } from './nav'

const LAST_INVEST_KEY = 'spendiary.last_invest_path'
const LAST_SPEND_KEY = 'spendiary.last_spend_path'

function read(key: string): string | null {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value)
  } catch {
    // storage unavailable — switching still works, it just lands on the section root
  }
}

/** Where switching into a side should land: the last page visited there, else its root. */
export function lastPathFor(spend: boolean): string {
  return (spend ? read(LAST_SPEND_KEY) : read(LAST_INVEST_KEY)) ?? (spend ? SPEND_ROOT : '/')
}

/** Invest ↔ Spend switch. Each side remembers the last page you were on. */
export function ModeSwitcher({ size = 'md', className = '' }: { size?: 'sm' | 'md'; className?: string }) {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const spend = isSpendPath(pathname)

  useEffect(() => {
    if (pathname === '/settings') return
    write(spend ? LAST_SPEND_KEY : LAST_INVEST_KEY, pathname + search)
  }, [pathname, search, spend])

  const go = (toSpend: boolean) => {
    if (toSpend === spend) return
    navigate(lastPathFor(toSpend))
  }

  const btn = size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 flex-1 px-3 text-sm'
  const options = [
    { label: 'Invest', active: !spend, onClick: () => go(false) },
    { label: 'Spend', active: spend, onClick: () => go(true) },
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
            o.active ? 'bg-surface text-ink font-bold shadow-xs' : 'text-ink-muted hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

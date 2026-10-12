import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { LAST_INVEST_KEY, LAST_SIDE_KEY, LAST_SPEND_KEY, isSettings, lastPathFor, useSpendSide, write } from './side'

/** Spend ↔ Invest switch (Spend first: it's where the app opens). Each side remembers the last page you were on. */
export function ModeSwitcher({ size = 'md', className = '' }: { size?: 'sm' | 'md'; className?: string }) {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const spend = useSpendSide()

  useEffect(() => {
    // Settings isn't remembered, so coming back lands on a page you were using
    if (isSettings(pathname)) return
    write(spend ? LAST_SPEND_KEY : LAST_INVEST_KEY, pathname + search)
    write(LAST_SIDE_KEY, spend ? 'spend' : 'invest')
  }, [pathname, search, spend])

  const go = (toSpend: boolean) => {
    if (toSpend === spend && !isSettings(pathname)) return
    navigate(lastPathFor(toSpend))
  }

  const btn = size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 flex-1 px-3 text-sm'
  // Each side has its own color: Spend green, Invest the brand blue
  const options = [
    {
      label: 'Spend',
      active: spend,
      onClick: () => go(true),
      on: 'bg-emerald-700 text-white',
      idle: 'hover:text-emerald-700 dark:hover:text-emerald-300',
    },
    { label: 'Invest', active: !spend, onClick: () => go(false), on: 'bg-brand text-white', idle: 'hover:text-brand-ink' },
  ]

  return (
    <div
      role="radiogroup"
      aria-label="Switch between Spend and Invest"
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

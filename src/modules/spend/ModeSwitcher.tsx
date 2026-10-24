import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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

  // A thumb slides under the picked side instead of the buttons swapping colors
  const groupRef = useRef<HTMLDivElement>(null)
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null)
  // No slide on the first measure, so the thumb doesn't sweep in when the page loads
  const [animate, setAnimate] = useState(false)
  useLayoutEffect(() => {
    const measure = () => {
      const b = btnRefs.current[spend ? 0 : 1]
      if (b) setThumb({ left: b.offsetLeft, width: b.offsetWidth })
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (groupRef.current) ro.observe(groupRef.current)
    return () => ro.disconnect()
  }, [spend, size])
  useEffect(() => {
    if (!thumb || animate) return
    const t = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(t)
  }, [thumb, animate])

  const btn = size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 flex-1 px-3 text-sm'
  // Each side has its own color: Spend green, Invest blue (not the brand, which is indigo in dark mode)
  const options = [
    {
      label: 'Spend',
      active: spend,
      onClick: () => go(true),
      idle: 'hover:text-spend-ink',
    },
    { label: 'Invest', active: !spend, onClick: () => go(false), idle: 'hover:text-invest-ink' },
  ]

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label="Switch between Spend and Invest"
      className={`relative inline-flex items-center gap-0.5 rounded-full border border-line-strong/40 bg-surface-muted p-0.5 ${className}`}
    >
      {thumb && (
        <span
          aria-hidden="true"
          className={`absolute bottom-0.5 top-0.5 left-0 rounded-full shadow-xs ${spend ? 'bg-spend' : 'bg-invest'} ${
            animate ? 'transition-[transform,width,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none' : ''
          }`}
          style={{ width: thumb.width, transform: `translateX(${thumb.left}px)` }}
        />
      )}
      {options.map((o, i) => (
        <button
          key={o.label}
          ref={(el) => {
            btnRefs.current[i] = el
          }}
          type="button"
          role="radio"
          aria-checked={o.active}
          onClick={o.onClick}
          className={`${btn} relative inline-flex items-center justify-center rounded-full font-semibold transition-colors duration-300 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
            o.active ? 'font-bold text-white' : `text-ink-muted ${o.idle}`
          } ${thumb ? '' : o.active ? (i === 0 ? 'bg-spend' : 'bg-invest') : ''}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

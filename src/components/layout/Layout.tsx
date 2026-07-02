import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { Sidebar } from './Sidebar'
import { SettingsIcon, SparkleIcon } from '../icons'

export function Layout({ children }: { children: ReactNode }) {
  return (
    /* Outer shell: fills the entire viewport, neutral bg so the phone frame is visible on desktop, transitions to canvas bg on widescreen */
    <div className="min-h-dvh bg-[#d1d5db] dark:bg-[#111318] flex justify-center lg:bg-canvas lg:dark:bg-canvas lg:block">
      
      {/* Skip to main content (keyboard / screen reader) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-ink focus:px-4 focus:py-2 focus:text-[14px] focus:font-semibold focus:text-white focus:shadow-[var(--shadow-lift)] focus:outline-none"
      >
        Skip to content
      </a>

      {/* ── Desktop Widescreen Layout (≥ lg) ── */}
      <div className="hidden lg:flex min-h-dvh w-full">
        <Sidebar />
        <main id="main-content" className="flex-1 pl-64">
          <div className="mx-auto max-w-5xl px-8 py-8">
            {children}
          </div>
        </main>
      </div>

      {/* ── Mobile/Tablet Simulator Layout (< lg) ── */}
      <div className="relative w-full max-w-[390px] min-h-dvh bg-canvas flex flex-col shadow-2xl lg:hidden">
        {/* Top brand bar */}
        <div className="sticky top-0 z-20 flex items-center gap-2.5 border-b border-line bg-canvas/80 px-5 py-3.5 backdrop-blur-xl">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-ink text-white dark:bg-brand-soft dark:text-brand">
            <SparkleIcon className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </div>
          <p className="font-display text-[17px] font-extrabold tracking-tight text-ink">Spendiary</p>
          <p className="flex-1 text-right text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
            {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
          </p>
          <NavLink
            to="/settings"
            aria-label="Settings"
            className={({ isActive }) =>
              `grid h-11 w-11 place-items-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
                isActive ? 'bg-brand-soft text-brand-ink' : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
              }`
            }
          >
            <SettingsIcon className="h-[19px] w-[19px]" />
          </NavLink>
        </div>

        {/* Page content */}
        <main className="flex-1">
          <div className="w-full px-5 pb-28 pt-6">
            {children}
          </div>
        </main>

        {/* Bottom navigation — constrained inside the frame */}
        <BottomNav />
      </div>
    </div>
  )
}



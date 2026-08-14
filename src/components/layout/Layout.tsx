import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { Sidebar } from './Sidebar'
import { SettingsIcon } from '../icons'
import { useData } from '../../store/DataContext'

export function Layout({ children }: { children: ReactNode }) {
  const { user } = useData()
  const isTestMode = user?.id === 'test-user-local'

  return (
    /* Outer shell: fills the entire viewport, neutral bg so the phone frame is visible on desktop preview, transparent on widescreen to show ambient gradient */
    <div className="min-h-dvh bg-slate-200/80 dark:bg-[#111318] flex justify-center lg:bg-transparent lg:dark:bg-canvas lg:block relative">
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
        <main id="main-content" className="flex-1 pl-64 transition-all duration-300">
          <div className="mx-auto max-w-[1440px] px-8 lg:px-10 py-7">
            {children}
          </div>
        </main>
      </div>

      {/* ── Mobile/Tablet Simulator Layout (< lg) ── */}
      <div className="relative w-full max-w-[420px] min-h-dvh app-canvas-bg flex flex-col shadow-2xl lg:hidden">
        {/* Top brand bar */}
        <div className="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-surface/75 px-5 py-3.5 backdrop-blur-xl">
          <img src="/logo.png" alt="Spendiary Logo" className="h-8 w-8 object-contain shrink-0" />
          <p className="font-display text-[17.5px] font-extrabold tracking-tight leading-none text-ink -translate-y-[0.5px]">Spendiary</p>
          {isTestMode && (
            <span className="rounded-full bg-amber-500/10 text-amber-600 dark:bg-amber-400/15 dark:text-amber-300 border border-amber-500/20 px-2 py-0.5 text-[9.5px] font-bold tracking-wider uppercase">
              Test
            </span>
          )}
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

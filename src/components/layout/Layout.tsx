import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { Sidebar } from './Sidebar'
import { Footer } from './Footer'
import { ClockIcon, SettingsIcon } from '../icons'
import { useData } from '../../store/DataContext'
import { useScrollVisibility } from '../../hooks/useScrollVisibility'

export function Layout({ children }: { children: ReactNode }) {
  const { user } = useData()
  const isTestMode = user?.id === 'test-user-local'
  const isVisible = useScrollVisibility()

  return (
    <div className="min-h-dvh bg-transparent lg:dark:bg-canvas relative flex flex-col">
      {/* Skip to main content (keyboard / screen reader) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-ink focus:px-4 focus:py-2 focus:text-[14px] focus:font-semibold focus:text-white focus:shadow-[var(--shadow-lift)] focus:outline-none"
      >
        Skip to content
      </a>

      {/* ── Desktop Sidebar (≥ lg) ── */}
      <Sidebar />

      {/* ── Mobile Top Brand Bar (< lg) ── */}
      <div
        className={`sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-surface/75 px-4 sm:px-5 py-3 backdrop-blur-xl transition-transform duration-300 ease-in-out lg:hidden ${
          isVisible ? 'translate-y-0' : '-translate-y-full pointer-events-none'
        }`}
      >
        <img src="/logo.png" alt="Spendiary Logo" className="h-7 w-7 sm:h-8 sm:w-8 object-contain shrink-0" />
        <p className="font-display text-[17px] sm:text-[17.5px] font-extrabold tracking-tight leading-none text-ink -translate-y-[0.5px]">
          Spendiary
        </p>
        {isTestMode && (
          <span className="rounded-full bg-amber-500/10 text-amber-600 dark:bg-amber-400/15 dark:text-amber-300 border border-amber-500/20 px-2 py-0.5 text-[9px] sm:text-[9.5px] font-bold tracking-wider uppercase">
            Test
          </span>
        )}
        <p className="flex-1 text-right text-[11.5px] sm:text-[12px] font-semibold uppercase tracking-wide text-ink-muted truncate mr-1">
          {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
        </p>
        <div className="flex items-center gap-1 shrink-0">
          <NavLink
            to="/logs"
            aria-label="Activity Logs"
            title="Activity Logs"
            className={({ isActive }) =>
              `grid h-9 w-9 place-items-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
                isActive ? 'bg-brand-soft text-brand-ink' : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
              }`
            }
          >
            <ClockIcon className="h-[18.5px] w-[18.5px]" />
          </NavLink>
          <NavLink
            to="/settings"
            aria-label="Settings"
            title="Settings"
            className={({ isActive }) =>
              `grid h-9 w-9 place-items-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
                isActive ? 'bg-brand-soft text-brand-ink' : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
              }`
            }
          >
            <SettingsIcon className="h-[18.5px] w-[18.5px]" />
          </NavLink>
        </div>
      </div>

      {/* ── Single Main Content Viewport ── */}
      <main id="main-content" className="flex-1 lg:pl-64 transition-all duration-300">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-10 py-6 sm:py-7 pb-28 lg:pb-7 flex flex-col min-h-[calc(100dvh-60px)] lg:min-h-dvh">
          <div className="flex-1">
            {children}
          </div>
          <Footer />
        </div>
      </main>

      {/* ── Mobile Bottom Navigation (< lg) ── */}
      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  )
}

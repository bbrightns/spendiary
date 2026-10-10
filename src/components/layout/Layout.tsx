import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { Sidebar } from './Sidebar'
import { Footer } from './Footer'
import { TestModeBanner } from './TestModeBanner'
import { SettingsIcon, SearchIcon } from '../icons'
import { CommandPalette, openCommandPalette } from '../ui/CommandPalette'
import { useData } from '../../store/DataContext'
import { useScrollVisibility } from '../../hooks/useScrollVisibility'
import { ModeSwitcher } from '../../modules/spend/ModeSwitcher'
import { QuickAddSheet } from '../../modules/spend/QuickAddSheet'
import { PayBillSheet } from '../../modules/spend/PayBillSheet'
import { SpendBottomNav } from '../../modules/spend/SpendBottomNav'
import { isSpendPath } from '../../modules/spend/nav'

export function Layout({ children }: { children: ReactNode }) {
  const { user } = useData()
  const isTestMode = user?.id === 'test-user-local'
  const isVisible = useScrollVisibility()
  const isSpend = isSpendPath(useLocation().pathname)

  return (
    <div className={`min-h-dvh bg-transparent lg:dark:bg-canvas relative flex flex-col ${isTestMode ? 'pt-9' : ''}`}>
      {/* Global Command Palette */}
      <CommandPalette />

      {/* Test Mode Global Warning Banner */}
      <TestModeBanner />

      {/* Skip to main content (keyboard / screen reader) */}
      <a
        href="#main-content"
        className={`sr-only focus:not-sr-only focus:fixed focus:left-4 ${isTestMode ? 'focus:top-12' : 'focus:top-4'} focus:z-50 focus:rounded-xl focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-[var(--shadow-lift)] focus:outline-none`}
      >
        Skip to content
      </a>

      {/* ── Desktop Sidebar (≥ lg) ── */}
      <Sidebar />

      {/* ── Mobile Top Brand Bar (< lg) ── */}
      <div
        className={`sticky ${isTestMode ? 'top-9' : 'top-0'} z-20 flex items-center gap-2 border-b border-line bg-surface/75 px-4 sm:px-5 py-3 backdrop-blur-xl transition-transform duration-300 ease-in-out lg:hidden ${
          isVisible ? 'translate-y-0' : '-translate-y-full pointer-events-none'
        }`}
      >
        <img src="/logo.png" alt="Spendiary Logo" className="h-7 w-7 sm:h-8 sm:w-8 object-contain shrink-0" />
        {/* Wordmark steps aside on very narrow phones so the mode switch never crowds Search / Settings */}
        <p className="hidden min-[380px]:block font-display text-base sm:text-lg font-extrabold tracking-tight leading-none text-ink -translate-y-[0.5px]">
          Spendiary
        </p>
        <div className="flex flex-1 justify-end mr-1 min-w-0">
          <ModeSwitcher size="sm" />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={openCommandPalette}
            aria-label="Quick Search / Command Palette"
            title="Search (Cmd+K)"
            className="grid h-9 w-9 place-items-center rounded-xl text-ink-muted hover:bg-surface-muted hover:text-ink transition-colors cursor-pointer"
          >
            <SearchIcon className="h-[18.5px] w-[18.5px]" />
          </button>
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
        {isSpend ? <SpendBottomNav /> : <BottomNav />}
      </div>

      {/* Spend sheets — Quick Add (+ button, sidebar, command palette) and card Pay bill (reminders) */}
      <QuickAddSheet />
      <PayBillSheet />
    </div>
  )
}

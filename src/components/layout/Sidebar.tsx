import { Link, useLocation } from 'react-router-dom'
import { navItems, settingsItem } from './nav'
import { useData } from '../../store/DataContext'
import { useTheme } from '../../hooks/useTheme'

import { shouldConfirmBuy } from '../../lib/calc'

export function Sidebar() {
  const location = useLocation()
  const pathname = location.pathname
  const { data, user, usdThb } = useData()
  const { setTheme } = useTheme()
  const isTestMode = user?.id === 'test-user-local'

  // Calculate live badge counts
  const dcaAlertCount = data.dcaPlans.filter((p) => shouldConfirmBuy(p)).length

  const getBadgeCount = (path: string) => {
    if (path === '/dca') return dcaAlertCount
    return 0
  }

  const toggleTheme = () => {
    // If currently dark (or system evaluating to dark), toggle to light, else dark
    const isDark = document.documentElement.classList.contains('dark')
    setTheme(isDark ? 'light' : 'dark')
  }

  const displayName = data.userName || (user?.id === 'guest-local' ? 'Guest' : 'User')
  const userInitial = displayName.charAt(0).toUpperCase()

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-line bg-surface/85 backdrop-blur-xl px-4 py-5 lg:flex flex-col justify-between select-none">
      <div className="flex flex-col gap-6">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-2 pt-1">
          <Link to="/" className="flex items-center gap-2.5 group">
            <img
              src="/logo.png"
              alt="Spendiary Logo"
              className="h-9 w-9 rounded-xl object-contain shadow-xs transition-transform group-hover:scale-105"
            />
            <div>
              <span className="font-display text-[19px] font-extrabold tracking-tight text-ink leading-none">
                Spendiary
              </span>
              <p className="text-[10.5px] font-medium text-ink-muted leading-tight mt-0.5">
                Financial Cockpit
              </p>
            </div>
          </Link>
          {isTestMode && (
            <span className="rounded-full bg-amber-500/10 text-amber-600 dark:bg-amber-400/15 dark:text-amber-300 border border-amber-500/20 px-2 py-0.5 text-[9.5px] font-bold tracking-wider uppercase">
              Test
            </span>
          )}
        </div>

        {/* Live Market Bar */}
        {usdThb && usdThb > 0 && (
          <div className="mx-1 px-3 py-2 rounded-xl bg-surface-muted/70 border border-line/60 flex items-center justify-between text-[11.5px]">
            <div className="flex items-center gap-1.5 font-medium text-ink-muted">
              <span className="h-2 w-2 rounded-full bg-gain animate-pulse shrink-0" />
              <span>USD/THB</span>
            </div>
            <span className="font-display font-bold tnum text-ink">
              ฿{usdThb.toFixed(2)}
            </span>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="flex flex-col gap-1">
          <span className="px-3 text-[11px] font-semibold tracking-normal text-ink-muted mb-1">
            Navigation
          </span>
          {navItems.map((item) => {
            const isActive =
              item.to === '/'
                ? pathname === '/'
                : pathname.startsWith(item.to)
            const badgeCount = getBadgeCount(item.to)

            return (
              <Link
                key={item.to}
                to={item.to}
                className={[
                  'flex items-center justify-between px-3 py-2.5 rounded-xl text-[13.5px] font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset',
                  isActive
                    ? 'text-brand-ink bg-brand-soft/70 shadow-xs font-bold'
                    : 'text-ink-muted hover:bg-surface-muted hover:text-ink',
                ].join(' ')}
              >
                <div className="flex items-center gap-3">
                  <item.icon
                    className={`h-[19px] w-[19px] ${isActive ? 'text-brand-ink' : 'text-ink-muted'}`}
                    strokeWidth={isActive ? 2.2 : 1.7}
                  />
                  <span>{item.label}</span>
                </div>

                {badgeCount > 0 && (
                  <span
                    className="px-1.5 py-0.2 rounded-full text-[10.5px] font-bold leading-tight bg-brand text-white"
                  >
                    {badgeCount}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Footer / User Profile & Controls */}
      <div className="flex flex-col gap-2 pt-4 border-t border-line">
        {/* Settings link */}
        <Link
          to={settingsItem.to}
          className={[
            'flex items-center justify-between px-3 py-2.5 rounded-xl text-[13.5px] font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset',
            pathname.startsWith(settingsItem.to)
              ? 'text-brand-ink bg-brand-soft/70 shadow-xs font-bold'
              : 'text-ink-muted hover:bg-surface-muted hover:text-ink',
          ].join(' ')}
        >
          <div className="flex items-center gap-3">
            <settingsItem.icon className="h-[19px] w-[19px]" strokeWidth={1.7} />
            <span>{settingsItem.label}</span>
          </div>
        </Link>

        {/* User Card + Theme Switch */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-surface-muted/50 border border-line/40">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-ink text-white font-bold text-[12px] dark:bg-brand-soft dark:text-brand">
              {userInitial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-bold text-ink leading-tight">
                {displayName}
              </p>
              <p className="truncate text-[10.5px] text-ink-muted leading-tight">
                {user?.id === 'guest-local' ? 'Local Mode' : 'Cloud Sync'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className="grid h-11 w-11 place-items-center rounded-xl text-ink-muted hover:bg-surface hover:text-ink hover:shadow-xs transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            title="Toggle theme"
            aria-label="Toggle theme"
          >
            <svg className="h-5 w-5 dark:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
            <svg className="h-5 w-5 hidden dark:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 9h-1m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  )
}

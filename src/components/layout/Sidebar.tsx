import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { navItems, settingsItem, strategySubItems } from './nav'
import { useData } from '../../store/DataContext'
import { useTheme } from '../../hooks/useTheme'
import { ChevronDownIcon } from '../icons'

import { shouldConfirmBuy } from '../../lib/calc'

export function Sidebar() {
  const location = useLocation()
  const pathname = location.pathname
  const { data, user } = useData()
  const { setTheme } = useTheme()
  const isTestMode = user?.id === 'test-user-local'

  // Calculate live badge counts
  const dcaAlertCount = data.dcaPlans.filter((p) => shouldConfirmBuy(p)).length

  const getBadgeCount = (path?: string) => {
    if (path === '/dca') return dcaAlertCount
    return 0
  }

  const isStrategyActive = strategySubItems.some((sub) => pathname.startsWith(sub.to))
  const [isStrategiesOpen, setIsStrategiesOpen] = useState(isStrategyActive)

  useEffect(() => {
    if (isStrategyActive) {
      setIsStrategiesOpen(true)
    }
  }, [isStrategyActive])

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
          <Link to="/" className="flex items-center gap-2 group">
            <img
              src="/logo.png"
              alt="Spendiary Logo"
              className="h-8 w-8 object-contain transition-transform group-hover:scale-105"
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

        {/* Navigation Items */}
        <nav className="flex flex-col gap-1">
          <span className="px-3 text-[11px] font-semibold tracking-normal text-ink-muted mb-1">
            Navigation
          </span>
          {navItems.map((item) => {
            if (item.subItems) {
              const isChildActive = item.subItems.some((sub) => pathname.startsWith(sub.to))

              return (
                <div key={item.label} className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => setIsStrategiesOpen((prev) => !prev)}
                    className={[
                      'w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[13.5px] font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset cursor-pointer select-none',
                      isChildActive
                        ? 'text-brand-ink bg-brand-soft/50 font-bold'
                        : 'text-ink-muted hover:bg-surface-muted hover:text-ink',
                    ].join(' ')}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon
                        className={`h-[19px] w-[19px] ${isChildActive ? 'text-brand-ink' : 'text-ink-muted'}`}
                        strokeWidth={isChildActive ? 2.2 : 1.7}
                      />
                      <span>{item.label}</span>
                    </div>

                    <ChevronDownIcon
                      className={`h-4 w-4 transition-transform duration-200 ${
                        isStrategiesOpen ? 'rotate-180 text-ink' : 'text-ink-muted'
                      }`}
                      strokeWidth={2}
                    />
                  </button>

                  {isStrategiesOpen && (
                    <div className="flex flex-col gap-1 pl-3.5 ml-3 border-l border-line/70 py-0.5">
                      {item.subItems.map((sub) => {
                        const isSubActive = pathname.startsWith(sub.to)

                        return (
                          <Link
                            key={sub.to}
                            to={sub.to}
                            title={sub.description}
                            className={[
                              'flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset',
                              isSubActive
                                ? 'text-brand-ink bg-brand-soft/80 shadow-xs font-bold'
                                : 'text-ink-muted hover:bg-surface-muted hover:text-ink',
                            ].join(' ')}
                          >
                            <sub.icon
                              className={`h-[17px] w-[17px] shrink-0 ${isSubActive ? 'text-brand-ink' : 'text-ink-muted'}`}
                              strokeWidth={isSubActive ? 2.2 : 1.7}
                            />
                            <span className="truncate">{sub.label}</span>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }

            const toPath = item.to || '/'
            const isActive =
              toPath === '/'
                ? pathname === '/'
                : pathname.startsWith(toPath)
            const badgeCount = getBadgeCount(toPath)

            return (
              <Link
                key={toPath}
                to={toPath}
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
                    className="px-1.5 py-0.2 rounded-full text-[10.5px] font-bold leading-tight bg-brand text-white dark:bg-[#4f46e5]"
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
          to={settingsItem.to || '/settings'}
          className={[
            'flex items-center justify-between px-3 py-2.5 rounded-xl text-[13.5px] font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset',
            pathname.startsWith(settingsItem.to || '/settings')
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

import { Link, useLocation } from 'react-router-dom'
import { desktopNavSections, isSubItemActive, settingsItem } from './nav'
import { useData } from '../../store/DataContext'
import { useTheme } from '../../hooks/useTheme'
import { PlusIcon, SearchIcon } from '../icons'
import { openCommandPalette } from '../ui/CommandPalette'
import { Button } from '../ui/Button'
import { ModeSwitcher } from '../../modules/spend/ModeSwitcher'
import { useSpendSide } from '../../modules/spend/side'
import { openQuickAdd } from '../../modules/spend/QuickAddSheet'
import { spendAccountsItem, spendLoansItem, spendNavSections, spendOverviewItem } from '../../modules/spend/nav'
import { useSpend } from '../../modules/spend/useSpend'
import { SIDE_ACTIVE } from '../../modules/spend/tones'

import { isDividendReceivedThisMonth, isLiabilityActionableThisMonth, shouldConfirmBuy } from '../../lib/calc'
import { SEARCH_SHORTCUT } from '../../lib/shortcut'

export function Sidebar() {
  const location = useLocation()
  const pathname = location.pathname
  const { data, user } = useData()
  const { setTheme } = useTheme()
  const isTestMode = user?.id === 'test-user-local'
  const isSpend = useSpendSide()
  const side = SIDE_ACTIVE[isSpend ? 'spend' : 'invest']
  // One Settings page for both sides; always opens at the top (General)
  const settingsTo = '/settings'

  // Calculate live badge counts
  const dcaAlertCount = data.dcaPlans.filter((p) => shouldConfirmBuy(p)).length
  const currentMonth = new Date().getMonth() + 1
  const dividendAlertCount = (data.holdings ?? []).filter(
    (h) =>
      h.paysDividend &&
      (h.dividendMonths ?? []).includes(currentMonth) &&
      !isDividendReceivedThisMonth(h.id, data.dividendRecords),
  ).length
  const debtAlertCount = (data.liabilities ?? []).filter((l) => isLiabilityActionableThisMonth(l)).length
  const { reminders: billReminders, dueRecurring } = useSpend()

  const getBadgeCount = (path?: string) => {
    // Loans are paid from Spend, so their due badge sits on Spend's Loans page
    if (path === spendLoansItem.to) return debtAlertCount
    if (path === spendAccountsItem.to) return billReminders.length
    if (path === spendOverviewItem.to) return dueRecurring.length
    if (path === '/dca') return dcaAlertCount
    if (path === '/dividends') return dividendAlertCount
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
    <aside
      className={`fixed bottom-0 left-0 z-40 hidden w-64 border-r border-line bg-surface/85 backdrop-blur-xl px-4 py-5 lg:flex flex-col justify-between select-none transition-[top] duration-200 ${
        isTestMode ? 'top-9' : 'top-0'
      }`}
    >
      <div className="flex flex-col gap-6">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-2 pt-1">
          {/* The logo goes to Spend Home, where the app opens */}
          <Link to={spendOverviewItem.to} className="flex items-center gap-2 group">
            <img
              src="/logo.png"
              alt="Spendiary Logo"
              className="h-8 w-8 object-contain transition-transform group-hover:scale-105"
            />
            <div>
              <span className="font-display text-lg font-extrabold tracking-tight text-ink leading-none">
                Spendiary
              </span>
              <p className="text-xs font-medium text-ink-muted leading-tight mt-0.5">
                Financial Cockpit
              </p>
            </div>
          </Link>
          {isTestMode && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-700 dark:bg-amber-400/20 dark:text-amber-300 border border-amber-500/30 px-2 py-0.5 text-xs font-extrabold tracking-wider uppercase shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Test
            </span>
          )}
        </div>

        <ModeSwitcher className="-mt-2 w-full" />

        {isSpend && (
          <Button size="sm" onClick={() => openQuickAdd()} className="-mt-3 w-full">
            <PlusIcon className="h-4 w-4" strokeWidth={2.4} />
            Quick add
          </Button>
        )}

        {/* Quick Search & Command Bar Trigger */}
        <button
          type="button"
          onClick={openCommandPalette}
          className="mb-3 flex items-center justify-between w-full rounded-xl border border-line bg-surface-muted/60 hover:bg-surface-muted dark:hover:bg-surface-muted/80 px-3 py-2 text-left text-xs font-medium text-ink-muted hover:text-ink transition-all shadow-2xs group cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <SearchIcon className="h-4 w-4 text-ink-faint group-hover:text-brand transition-colors" />
            <span className="font-semibold text-ink-soft">Search / Actions...</span>
          </div>
          <kbd className="inline-flex items-center gap-0.5 rounded-md bg-surface border border-line px-1.5 py-0.5 font-mono text-xs text-ink-muted shadow-2xs">
            {SEARCH_SHORTCUT}
          </kbd>
        </button>

        {/* Navigation Items — flat, grouped by intent */}
        <nav className="flex flex-col">
          {(isSpend ? spendNavSections : desktopNavSections).map((section, index) => (
            <div
              key={section.title}
              className={`flex flex-col gap-0.5 ${index > 0 ? 'mt-3 border-t border-line/60 pt-3' : ''}`}
            >
              <span className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-brand/70">
                {section.title}
              </span>
              {section.items.map((item) => {
                const isActive = isSubItemActive(item, pathname)
                const badgeCount = getBadgeCount(item.to)

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    title={item.description}
                    className={[
                      'flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset',
                      isActive
                        ? `${side.text} ${side.bg} shadow-xs font-bold`
                        : 'text-ink hover:bg-surface-muted',
                    ].join(' ')}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <item.icon
                        className={`h-4.5 w-4.5 shrink-0 ${isActive ? side.text : 'text-ink-soft'}`}
                        strokeWidth={isActive ? 2.2 : 1.7}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {badgeCount > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white shadow-xs">
                        {badgeCount}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* Footer / User Profile & Controls */}
      <div className="flex flex-col gap-2 pt-4 border-t border-line">
        {/* Settings link */}
        <Link
          to={settingsTo}
          className={[
            'flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset',
            pathname === '/settings'
              ? `${side.text} ${side.bg} shadow-xs font-bold`
              : 'text-ink-muted hover:bg-surface-muted hover:text-ink',
          ].join(' ')}
        >
          <div className="flex items-center gap-3">
            <settingsItem.icon className="h-4.5 w-4.5" strokeWidth={1.7} />
            <span>{settingsItem.label}</span>
          </div>
        </Link>

        {/* User Card + Theme Switch */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-surface-muted/50 border border-line/40">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-ink text-white font-bold text-xs dark:bg-brand-soft dark:text-brand">
              {userInitial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-ink leading-tight">
                {displayName}
              </p>
              <p className="truncate text-xs text-ink-muted leading-tight">
                {user?.id === 'guest-local' ? 'Local Mode' : 'Cloud Sync'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className="grid h-11 w-11 place-items-center rounded-xl text-ink-muted hover:bg-surface hover:text-ink hover:shadow-xs transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            title="Toggle theme"
            aria-label="Toggle light and dark theme"
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

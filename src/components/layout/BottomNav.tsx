import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { cashflowSubItems, mobileNavItems, strategySubItems } from './nav'
import { useData } from '../../store/DataContext'
import { isDividendReceivedThisMonth, isLiabilityActionableThisMonth, shouldConfirmBuy } from '../../lib/calc'
import { Modal } from '../ui/Modal'
import { NavSheetList } from './NavSheetList'

export function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const pathname = location.pathname
  const { data } = useData()
  const [isStrategySheetOpen, setIsStrategySheetOpen] = useState(false)
  const [isCashflowSheetOpen, setIsCashflowSheetOpen] = useState(false)

  // Calculate alert counts
  const dcaAlertCount = data.dcaPlans.filter((p) => shouldConfirmBuy(p)).length
  const currentMonth = new Date().getMonth() + 1
  const dividendAlertCount = (data.holdings ?? []).filter(
    (h) =>
      h.paysDividend &&
      (h.dividendMonths ?? []).includes(currentMonth) &&
      !isDividendReceivedThisMonth(h.id, data.dividendRecords),
  ).length
  const cashflowAlertCount = dcaAlertCount + dividendAlertCount
  const debtAlertCount = (data.liabilities ?? []).filter((l) => isLiabilityActionableThisMonth(l)).length

  // Close sheets on route change
  useEffect(() => {
    setIsStrategySheetOpen(false)
    setIsCashflowSheetOpen(false)
  }, [pathname])

  // Handle ESC key to close sheets
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsStrategySheetOpen(false)
        setIsCashflowSheetOpen(false)
      }
    }
    if (isStrategySheetOpen || isCashflowSheetOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isStrategySheetOpen, isCashflowSheetOpen])

  return (
    <>
      {/* ── Bottom Navigation Bar ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-surface/85 backdrop-blur-xl safe-bottom">
        <div className="flex items-stretch justify-around px-2">
          {mobileNavItems.map((item) => {
            if (item.isAction) {
              const isCashflow = item.id === 'cashflow'
              const isStrategy = item.id === 'strategies'

              const isActive = isCashflow
                ? pathname.startsWith('/dca') ||
                  pathname.startsWith('/dividends') ||
                  pathname.startsWith('/cashflow')
                : isStrategy
                ? pathname.startsWith('/rebalance') || pathname.startsWith('/retirement')
                : false

              const badgeCount = isCashflow ? cashflowAlertCount : 0

              const handleClick = () => {
                if (isCashflow) {
                  setIsStrategySheetOpen(false)
                  setIsCashflowSheetOpen((prev) => !prev)
                } else if (isStrategy) {
                  setIsCashflowSheetOpen(false)
                  setIsStrategySheetOpen((prev) => !prev)
                }
              }

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={handleClick}
                  aria-label={item.label}
                  aria-expanded={isCashflow ? isCashflowSheetOpen : isStrategySheetOpen}
                  aria-haspopup="dialog"
                  className={[
                    'group relative flex flex-1 flex-col items-center gap-1 px-1 pb-2 pt-2.5 text-xs font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset cursor-pointer min-h-[48px]',
                    isActive ? 'text-brand-ink' : 'text-ink-muted',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'relative flex h-9 w-12 items-center justify-center rounded-full transition-all duration-200',
                      isActive ? 'bg-brand-soft' : 'bg-transparent',
                    ].join(' ')}
                  >
                    <item.icon className="h-5 w-5" strokeWidth={isActive ? 2 : 1.6} />

                    {/* iPhone style notification badge bubble */}
                    {badgeCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white shadow-xs ring-2 ring-surface">
                        {badgeCount}
                      </span>
                    )}
                  </span>
                  {item.short}
                </button>
              )
            }

            // Normal Route Link
            const toPath = item.to || '/'
            const isActive =
              toPath === '/'
                ? pathname === '/'
                : pathname.startsWith(toPath)

            const routeBadge = item.id === 'home' ? debtAlertCount : 0

            return (
              <Link
                key={item.id}
                to={toPath}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={[
                  'group relative flex flex-1 flex-col items-center gap-1 px-1 pb-2 pt-2.5 text-xs font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset min-h-[48px]',
                  isActive ? 'text-brand-ink' : 'text-ink-muted',
                ].join(' ')}
              >
                <span
                  className={[
                    'relative flex h-9 w-12 items-center justify-center rounded-full transition-all duration-200',
                    isActive ? 'bg-brand-soft' : 'bg-transparent',
                  ].join(' ')}
                >
                  <item.icon className="h-5 w-5" strokeWidth={isActive ? 2 : 1.6} />

                  {/* Route notification badge bubble */}
                  {routeBadge > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-xs font-bold text-white shadow-xs ring-2 ring-surface">
                      {routeBadge}
                    </span>
                  )}
                </span>
                {item.short}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* ── Cashflow Bottom Sheet Modal ── */}
      <Modal
        open={isCashflowSheetOpen}
        onClose={() => setIsCashflowSheetOpen(false)}
        title="Cashflow"
        description="Select money allocation or dividend income"
      >
        <NavSheetList
          items={cashflowSubItems}
          activePath={pathname}
          badgeFor={(to) => (to === '/dca' ? dcaAlertCount : to === '/dividends' ? dividendAlertCount : 0)}
          onSelect={(to) => {
            setIsCashflowSheetOpen(false)
            navigate(to)
          }}
        />
      </Modal>

      {/* ── Strategies Bottom Sheet Modal ── */}
      <Modal
        open={isStrategySheetOpen}
        onClose={() => setIsStrategySheetOpen(false)}
        title="Strategies"
        description="Select an investment planning engine"
      >
        <NavSheetList
          items={strategySubItems}
          activePath={pathname}
          onSelect={(to) => {
            setIsStrategySheetOpen(false)
            navigate(to)
          }}
        />
      </Modal>
    </>
  )
}

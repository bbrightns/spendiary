import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { cashflowSubItems, mobileNavItems, strategySubItems } from './nav'
import { useData } from '../../store/DataContext'
import { shouldConfirmBuy } from '../../lib/calc'
import { Modal } from '../ui/Modal'

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
    (h) => h.paysDividend && (h.dividendMonths ?? []).includes(currentMonth),
  ).length
  const cashflowAlertCount = dcaAlertCount + dividendAlertCount

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
                  className={[
                    'group relative flex flex-1 flex-col items-center gap-1 px-1 pb-2 pt-2.5 text-[10.5px] font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset cursor-pointer',
                    isActive ? 'text-brand-ink' : 'text-ink-muted',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'relative flex h-9 w-12 items-center justify-center rounded-full transition-all duration-200',
                      isActive ? 'bg-brand-soft' : 'bg-transparent',
                    ].join(' ')}
                  >
                    <item.icon className="h-[20px] w-[20px]" strokeWidth={isActive ? 2 : 1.6} />

                    {/* iPhone style notification badge bubble */}
                    {badgeCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-xs ring-2 ring-surface">
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

            return (
              <Link
                key={item.id}
                to={toPath}
                className={[
                  'group relative flex flex-1 flex-col items-center gap-1 px-1 pb-2 pt-2.5 text-[10.5px] font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset',
                  isActive ? 'text-brand-ink' : 'text-ink-muted',
                ].join(' ')}
              >
                <span
                  className={[
                    'relative flex h-9 w-12 items-center justify-center rounded-full transition-all duration-200',
                    isActive ? 'bg-brand-soft' : 'bg-transparent',
                  ].join(' ')}
                >
                  <item.icon className="h-[20px] w-[20px]" strokeWidth={isActive ? 2 : 1.6} />
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
        <div className="flex flex-col gap-2.5 py-1">
          {cashflowSubItems.map((subItem) => {
            const isSelected = pathname.startsWith(subItem.to)
            const subBadge =
              subItem.to === '/dca'
                ? dcaAlertCount
                : subItem.to === '/dividends'
                ? dividendAlertCount
                : 0

            return (
              <button
                key={subItem.to}
                type="button"
                onClick={() => {
                  setIsCashflowSheetOpen(false)
                  navigate(subItem.to)
                }}
                className={[
                  'w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-200 text-left cursor-pointer active:scale-[0.99]',
                  isSelected
                    ? 'border-brand/40 bg-brand-soft/70 shadow-xs'
                    : 'border-line/70 bg-surface-muted/50 hover:bg-surface-muted hover:border-line',
                ].join(' ')}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={[
                      'grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-colors',
                      isSelected
                        ? 'bg-brand text-white shadow-xs'
                        : 'bg-surface text-ink-muted border border-line',
                    ].join(' ')}
                  >
                    <subItem.icon className="h-5 w-5" strokeWidth={isSelected ? 2.2 : 1.8} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-display font-bold text-[14px] text-ink leading-tight">
                        {subItem.label}
                      </p>
                      {isSelected && (
                        <span className="rounded-full bg-brand/15 text-brand-ink px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider">
                          Active
                        </span>
                      )}
                      {subBadge > 0 && (
                        <span className="rounded-full bg-red-500 text-white px-1.5 py-0.2 text-[9.5px] font-bold">
                          {subBadge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11.5px] text-ink-muted leading-tight mt-1 truncate">
                      {subItem.description}
                    </p>
                  </div>
                </div>

                <svg
                  className={`h-4 w-4 shrink-0 transition-transform ${
                    isSelected ? 'text-brand-ink translate-x-0.5' : 'text-ink-muted/50'
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )
          })}
        </div>
      </Modal>

      {/* ── Strategies Bottom Sheet Modal ── */}
      <Modal
        open={isStrategySheetOpen}
        onClose={() => setIsStrategySheetOpen(false)}
        title="Strategies"
        description="Select an investment planning engine"
      >
        <div className="flex flex-col gap-2.5 py-1">
          {strategySubItems.map((subItem) => {
            const isSelected = pathname.startsWith(subItem.to)

            return (
              <button
                key={subItem.to}
                type="button"
                onClick={() => {
                  setIsStrategySheetOpen(false)
                  navigate(subItem.to)
                }}
                className={[
                  'w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-200 text-left cursor-pointer active:scale-[0.99]',
                  isSelected
                    ? 'border-brand/40 bg-brand-soft/70 shadow-xs'
                    : 'border-line/70 bg-surface-muted/50 hover:bg-surface-muted hover:border-line',
                ].join(' ')}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={[
                      'grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-colors',
                      isSelected
                        ? 'bg-brand text-white shadow-xs'
                        : 'bg-surface text-ink-muted border border-line',
                    ].join(' ')}
                  >
                    <subItem.icon className="h-5 w-5" strokeWidth={isSelected ? 2.2 : 1.8} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-display font-bold text-[14px] text-ink leading-tight">
                        {subItem.label}
                      </p>
                      {isSelected && (
                        <span className="rounded-full bg-brand/15 text-brand-ink px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-[11.5px] text-ink-muted leading-tight mt-1 truncate">
                      {subItem.description}
                    </p>
                  </div>
                </div>

                <svg
                  className={`h-4 w-4 shrink-0 transition-transform ${
                    isSelected ? 'text-brand-ink translate-x-0.5' : 'text-ink-muted/50'
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )
          })}
        </div>
      </Modal>
    </>
  )
}




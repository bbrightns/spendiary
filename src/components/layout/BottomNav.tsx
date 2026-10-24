import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { mobileNavItems, moreSheetItems, isNavPathActive } from './nav'
import { useData } from '../../store/DataContext'
import { isDividendReceivedThisMonth, shouldConfirmBuy } from '../../lib/calc'
import { Modal } from '../ui/Modal'
import { NavSheetList } from './NavSheetList'
import { SIDE_ACTIVE } from '../tones'

const ON = SIDE_ACTIVE.invest

export function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const pathname = location.pathname
  const { data } = useData()
  const [isMoreSheetOpen, setIsMoreSheetOpen] = useState(false)

  // Calculate alert counts
  const dcaAlertCount = data.dcaPlans.filter((p) => shouldConfirmBuy(p)).length
  const currentMonth = new Date().getMonth() + 1
  const dividendAlertCount = (data.holdings ?? []).filter(
    (h) =>
      h.paysDividend &&
      (h.dividendMonths ?? []).includes(currentMonth) &&
      !isDividendReceivedThisMonth(h.id, data.dividendRecords),
  ).length
  const moreAlertCount = dividendAlertCount

  // Close sheet on route change
  useEffect(() => {
    setIsMoreSheetOpen(false)
  }, [pathname])

  // Handle ESC key to close the sheet
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMoreSheetOpen(false)
    }
    if (isMoreSheetOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isMoreSheetOpen])

  return (
    <>
      {/* ── Bottom Navigation Bar ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-surface/85 backdrop-blur-xl safe-bottom">
        <div className="flex items-stretch justify-around px-2">
          {mobileNavItems.map((item) => {
            if (item.isAction) {
              // "More" tab lights up while browsing any of its sheet destinations
              const isActive = moreSheetItems.some((sub) =>
                sub.exact ? pathname === sub.to : pathname.startsWith(sub.to),
              )

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setIsMoreSheetOpen((prev) => !prev)}
                  aria-label={item.label}
                  aria-expanded={isMoreSheetOpen}
                  aria-haspopup="dialog"
                  className={[
                    'group relative flex flex-1 flex-col items-center gap-0.5 px-1 pb-1 pt-1.5 text-xs font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset cursor-pointer min-h-[48px]',
                    isActive ? ON.text : 'text-ink-muted',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'relative flex h-8 w-12 items-center justify-center rounded-full transition-all duration-200',
                      isActive ? ON.bg : 'bg-transparent',
                    ].join(' ')}
                  >
                    <item.icon className="h-5 w-5" strokeWidth={isActive ? 2 : 1.6} />

                    {/* iPhone style notification badge bubble */}
                    {moreAlertCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-xs font-bold text-white shadow-xs ring-2 ring-surface">
                        {moreAlertCount}
                      </span>
                    )}
                  </span>
                  {item.short}
                </button>
              )
            }

            // Normal Route Link
            const toPath = item.to || '/'
            const isActive = isNavPathActive(toPath, pathname, item.exact)

            const routeBadge = item.id === 'dca' ? dcaAlertCount : 0

            return (
              <Link
                key={item.id}
                to={toPath}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={[
                  'group relative flex flex-1 flex-col items-center gap-0.5 px-1 pb-1 pt-1.5 text-xs font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset min-h-[48px]',
                  isActive ? ON.text : 'text-ink-muted',
                ].join(' ')}
              >
                <span
                  className={[
                    'relative flex h-8 w-12 items-center justify-center rounded-full transition-all duration-200',
                    isActive ? ON.bg : 'bg-transparent',
                  ].join(' ')}
                >
                  <item.icon className="h-5 w-5" strokeWidth={isActive ? 2 : 1.6} />

                  {/* Route notification badge bubble */}
                  {routeBadge > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-xs font-bold text-white shadow-xs ring-2 ring-surface">
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

      {/* ── More Bottom Sheet Modal ── */}
      <Modal
        open={isMoreSheetOpen}
        onClose={() => setIsMoreSheetOpen(false)}
        title="More"
        description="Dividends, cash, planning tools & reports"
      >
        <NavSheetList
          items={moreSheetItems}
          activePath={pathname}
          badgeFor={(to) =>
            to === '/dividends' ? dividendAlertCount : 0
          }
          onSelect={(to) => {
            setIsMoreSheetOpen(false)
            navigate(to)
          }}
        />
      </Modal>
    </>
  )
}

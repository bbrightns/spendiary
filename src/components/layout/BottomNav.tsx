import { Link, useLocation } from 'react-router-dom'
import { navItems } from './nav'
import { useData } from '../../store/DataContext'
import { shouldConfirmBuy } from '../../lib/calc'

export function BottomNav() {
  const location = useLocation()
  const pathname = location.pathname
  const { data } = useData()

  // Calculate DCA ready count
  const dcaAlertCount = data.dcaPlans.filter((p) => shouldConfirmBuy(p)).length

  return (
    <nav className="sticky bottom-0 z-40 border-t border-line bg-surface/85 backdrop-blur-xl safe-bottom">
      <div className="flex items-stretch justify-around px-2">
        {navItems.map((item) => {
          // Custom active match matching subpaths
          const isActive =
            item.to === '/'
              ? pathname === '/'
              : pathname.startsWith(item.to)

          const isDca = item.to === '/dca'
          const showBadge = isDca && dcaAlertCount > 0

          return (
            <Link
              key={item.to}
              to={item.to}
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

                {/* iPhone style notification badge bubble */}
                {showBadge && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-xs ring-2 ring-surface">
                    {dcaAlertCount}
                  </span>
                )}
              </span>
              {item.short}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}



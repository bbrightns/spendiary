import { Link, useLocation } from 'react-router-dom'
import { navItems, settingsItem } from './nav'
import { SparkleIcon } from '../icons'

export function Sidebar() {
  const location = useLocation()
  const pathname = location.pathname

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-line bg-surface px-4 py-6 lg:flex flex-col justify-between">
      <div className="flex flex-col gap-8">
        {/* Brand Header */}
        <div className="flex items-center gap-2.5 px-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-ink text-white dark:bg-brand-soft dark:text-brand">
            <SparkleIcon className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </div>
          <span className="font-display text-[18px] font-extrabold tracking-tight text-ink">Spendiary</span>
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive =
              item.to === '/'
                ? pathname === '/'
                : item.to === '/portfolio'
                ? pathname.startsWith('/portfolio') || pathname.startsWith('/logs')
                : pathname.startsWith(item.to)

            return (
              <Link
                key={item.to}
                to={item.to}
                className={[
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset',
                  isActive
                    ? 'text-brand-ink bg-brand-soft/30'
                    : 'text-ink-muted hover:bg-surface-muted/50 hover:text-ink',
                ].join(' ')}
              >
                <item.icon className="h-[20px] w-[20px]" strokeWidth={isActive ? 2 : 1.6} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Settings / Footer at the bottom */}
      <div>
        <Link
          to={settingsItem.to}
          className={[
            'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset',
            pathname.startsWith(settingsItem.to)
              ? 'text-brand-ink bg-brand-soft/30'
              : 'text-ink-muted hover:bg-surface-muted/50 hover:text-ink',
          ].join(' ')}
        >
          <settingsItem.icon className="h-[20px] w-[20px]" />
          <span>{settingsItem.label}</span>
        </Link>
      </div>
    </aside>
  )
}

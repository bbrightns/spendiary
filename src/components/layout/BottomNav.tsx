import { Link, useLocation } from 'react-router-dom'
import { navItems } from './nav'

export function BottomNav() {
  const location = useLocation()
  const pathname = location.pathname

  return (
    <nav className="sticky bottom-0 z-40 border-t border-line bg-surface/85 backdrop-blur-xl safe-bottom">
      <div className="flex items-stretch justify-around px-2">
        {navItems.map((item) => {
          // Custom active match matching subpaths
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
                'group relative flex flex-1 flex-col items-center gap-1 px-1 pb-2 pt-2.5 text-[10.5px] font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset',
                isActive ? 'text-brand-ink' : 'text-ink-muted',
              ].join(' ')}
            >
              <span
                className={[
                  'flex h-9 w-12 items-center justify-center rounded-full transition-all duration-200',
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
  )
}



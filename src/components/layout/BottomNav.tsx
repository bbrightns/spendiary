import { NavLink } from 'react-router-dom'
import { navItems } from './nav'

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/85 backdrop-blur-xl safe-bottom lg:hidden">
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              [
                'group relative flex flex-1 flex-col items-center gap-1 px-1 pb-2 pt-2.5 text-[10.5px] font-semibold transition-colors duration-200',
                isActive ? 'text-brand-ink' : 'text-ink-muted',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={[
                    'flex h-8 w-12 items-center justify-center rounded-full transition-all duration-200',
                    isActive ? 'bg-brand-soft' : 'bg-transparent',
                  ].join(' ')}
                >
                  <item.icon className="h-[20px] w-[20px]" strokeWidth={isActive ? 2 : 1.6} />
                </span>
                {item.short}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

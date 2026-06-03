import { NavLink } from 'react-router-dom'
import { navItems, settingsItem } from './nav'
import { SparkleIcon } from '../icons'

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[252px] flex-col border-r border-line bg-surface/80 px-4 py-6 backdrop-blur-xl lg:flex">
      <div className="flex items-center gap-2.5 px-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-white shadow-[var(--shadow-soft)]">
          <SparkleIcon className="h-5 w-5" strokeWidth={1.8} />
        </div>
        <div className="leading-tight">
          <p className="font-display text-[17px] font-extrabold tracking-tight text-ink">Spendiary</p>
          <p className="text-[11px] font-medium text-ink-muted">Personal Finance</p>
        </div>
      </div>

      <nav className="mt-8 flex flex-1 flex-col gap-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              [
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] font-medium transition-all duration-200',
                isActive
                  ? 'bg-brand-soft text-brand-ink'
                  : 'text-ink-soft hover:bg-surface-muted hover:text-ink',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className="h-[19px] w-[19px]"
                  strokeWidth={isActive ? 1.9 : 1.6}
                />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <NavLink
        to={settingsItem.to}
        className={({ isActive }) =>
          [
            'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] font-medium transition-all duration-200',
            isActive
              ? 'bg-brand-soft text-brand-ink'
              : 'text-ink-soft hover:bg-surface-muted hover:text-ink',
          ].join(' ')
        }
      >
        {({ isActive }) => (
          <>
            <settingsItem.icon className="h-[19px] w-[19px]" strokeWidth={isActive ? 1.9 : 1.6} />
            {settingsItem.label}
          </>
        )}
      </NavLink>

      <div className="mt-3 rounded-2xl border border-line bg-canvas/60 p-4">
        <p className="text-[13px] font-semibold text-ink">Tracking in THB</p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-ink-muted">
          All balances shown in Thai Baht. Data stays on this device.
        </p>
      </div>
    </aside>
  )
}

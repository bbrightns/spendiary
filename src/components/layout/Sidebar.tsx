import { NavLink } from 'react-router-dom'
import { navItems, settingsItem } from './nav'
import { SparkleIcon } from '../icons'
import { useData } from '../../store/DataContext'

function useSyncLabel(lastSyncedAt: Date | null, syncStatus: string): string | null {
  if (!lastSyncedAt && syncStatus !== 'error') return null
  if (syncStatus === 'syncing') return 'Syncing…'
  if (syncStatus === 'error') return 'Sync failed'
  if (!lastSyncedAt) return null
  const mins = Math.floor((Date.now() - lastSyncedAt.getTime()) / 60_000)
  if (mins < 1) return 'Synced just now'
  if (mins < 60) return `Synced ${mins}m ago`
  return `Synced ${Math.floor(mins / 60)}h ago`
}

export function Sidebar() {
  const { syncStatus, lastSyncedAt } = useData()
  const syncLabel = useSyncLabel(lastSyncedAt, syncStatus)
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[252px] flex-col border-r border-line bg-surface/80 px-4 py-6 backdrop-blur-xl lg:flex">
      <div className="flex items-center gap-2.5 px-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-white dark:bg-brand-soft dark:text-brand shadow-[var(--shadow-soft)]">
          <SparkleIcon className="h-5 w-5" strokeWidth={1.8} />
        </div>
        <div className="leading-tight">
          <p className="font-display text-[17px] font-extrabold tracking-tight text-ink">Spendiary</p>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
          </p>
          {syncLabel && (
            <p className={`text-[10px] font-medium leading-none ${syncStatus === 'error' ? 'text-loss' : syncStatus === 'syncing' ? 'text-warn' : 'text-ink-faint'}`}>
              {syncLabel}
            </p>
          )}
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
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1',
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
            'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1',
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

    </aside>
  )
}

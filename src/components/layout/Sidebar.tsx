import { NavLink } from 'react-router-dom'
import { navItems, settingsItem } from './nav'
import { SparkleIcon } from '../icons'
import { useData } from '../../store/DataContext'

function useSyncLabel(lastSyncedAt: Date | null, syncStatus: string): { text: string; color: string } | null {
  if (syncStatus === 'syncing') return { text: 'Syncing…', color: 'text-warn' }
  if (syncStatus === 'error') return { text: 'Sync failed', color: 'text-loss' }
  if (!lastSyncedAt) return null
  const mins = Math.floor((Date.now() - lastSyncedAt.getTime()) / 60_000)
  const text = mins < 1 ? 'Synced' : mins < 60 ? `Synced ${mins}m ago` : `Synced ${Math.floor(mins / 60)}h ago`
  return { text, color: 'text-gain' }
}

export function Sidebar() {
  const { syncStatus, lastSyncedAt } = useData()
  const syncLabel = useSyncLabel(lastSyncedAt, syncStatus)
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[252px] flex-col border-r border-line bg-surface/80 px-4 py-6 backdrop-blur-xl lg:flex">
      <div className="flex items-center gap-3 px-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink text-white dark:bg-brand-soft dark:text-brand shadow-[var(--shadow-soft)]">
          <SparkleIcon className="h-5 w-5" strokeWidth={1.8} />
        </div>
        <div className="min-w-0">
          <p className="font-display text-[17px] font-extrabold tracking-tight text-ink">Spendiary</p>
          <p className="mt-0.5 text-[12px] text-ink-muted">
            {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
          </p>
        </div>
      </div>

      <div className="mx-3 mt-6 border-t border-line" />

      <nav className="mt-4 flex flex-1 flex-col gap-1">
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

      {syncLabel && (
        <div className={`mb-2 flex items-center gap-1.5 px-3 text-[12px] font-medium ${syncLabel.color}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {syncLabel.text}
        </div>
      )}

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

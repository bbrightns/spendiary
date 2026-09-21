import { isSubItemActive, type NavSubItem } from './nav'
import { ChevronRightIcon } from '../icons'

interface NavSheetListProps {
  items: NavSubItem[]
  /** Current route, used to mark the matching option as Active */
  activePath: string
  onSelect: (to: string) => void
  /** Optional badge count per destination path */
  badgeFor?: (to: string) => number
}

/**
 * Shared option cards for the mobile navigation bottom sheets.
 * Keeps Cashflow, Strategies and Activity Logs visually identical.
 */
export function NavSheetList({ items, activePath, onSelect, badgeFor }: NavSheetListProps) {
  return (
    <div className="flex flex-col gap-2.5 py-1">
      {items.map((item) => {
        const isSelected = isSubItemActive(item, activePath)
        const badge = badgeFor?.(item.to) ?? 0

        return (
          <button
            key={item.to}
            type="button"
            onClick={() => onSelect(item.to)}
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
                <item.icon className="h-5 w-5" strokeWidth={isSelected ? 2.2 : 1.8} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-display font-bold text-sm text-ink leading-tight">
                    {item.label}
                  </p>
                  {isSelected && (
                    <span className="rounded-full bg-brand/15 text-brand-ink px-2 py-0.5 text-xs font-bold uppercase tracking-wider">
                      Active
                    </span>
                  )}
                  {badge > 0 && (
                    <span className="rounded-full bg-red-500 text-white px-1.5 py-0.2 text-xs font-bold">
                      {badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-ink-muted leading-tight mt-1 truncate">
                  {item.description}
                </p>
              </div>
            </div>

            <ChevronRightIcon
              className={`h-4 w-4 shrink-0 transition-transform ${
                isSelected ? 'text-brand-ink translate-x-0.5' : 'text-ink-muted/50'
              }`}
              strokeWidth={2}
            />
          </button>
        )
      })}
    </div>
  )
}

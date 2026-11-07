import type { ReactNode } from 'react'

interface EntryRowProps {
  /** The 40px tile on the left */
  icon: ReactNode
  title: ReactNode
  /** A small chip right after the title */
  badge?: ReactNode
  meta: ReactNode
  /** The amount on the right, with its colour class */
  amount?: ReactNode
  amountClass?: string
  /** A smaller line under the amount */
  sub?: ReactNode
  subClass?: string
  onClick: () => void
  ariaLabel: string
  /** Before the row, outside its button (a selection checkbox) */
  leading?: ReactNode
  /** One action after the amount, outside the row's button */
  action?: ReactNode
  /** Under the row, lined up with the title (tags) */
  children?: ReactNode
}

/** The history row, Spend and Invest alike: tile, title over meta, amount and at most one action (DESIGN 6.3). */
export function EntryRow({ icon, title, badge, meta, amount, amountClass = 'text-ink', sub, subClass = 'text-ink-muted', onClick, ariaLabel, leading, action, children }: EntryRowProps) {
  return (
    <div className="group py-3">
      <div className="flex items-center gap-2">
        {leading}
        <button
          type="button"
          onClick={onClick}
          className="flex min-w-0 flex-1 items-center gap-3 text-left cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          aria-label={ariaLabel}
        >
          <span className="relative shrink-0">{icon}</span>
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-sm font-semibold text-ink">{title}</span>
              {badge}
            </span>
            <span className="block truncate text-xs text-ink-muted">{meta}</span>
          </span>
          {(amount !== undefined || sub !== undefined) && (
            <span className="shrink-0 text-right">
              {amount !== undefined && <span className={`block text-sm font-bold tnum ${amountClass}`}>{amount}</span>}
              {sub !== undefined && <span className={`block text-xs tnum ${subClass}`}>{sub}</span>}
            </span>
          )}
        </button>
        {action}
      </div>
      {children}
    </div>
  )
}

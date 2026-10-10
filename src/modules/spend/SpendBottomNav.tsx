import { Link, useLocation } from 'react-router-dom'
import { isNavPathActive, type NavSubItem } from '../../components/layout/nav'
import { PlusIcon } from '../../components/icons'
import { spendAccountsItem, spendAnalysisItem, spendOverviewItem, spendTxnsItem } from './nav'
import { openQuickAdd } from './QuickAddSheet'
import { useSpend } from './useSpend'

const tabClass =
  'group relative flex flex-1 flex-col items-center gap-1 px-1 pb-2 pt-2.5 text-xs font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset min-h-[48px]'

function Tab({ item, pathname, badge = 0, badgeLabel = 'to review' }: { item: NavSubItem; pathname: string; badge?: number; badgeLabel?: string }) {
  const active = isNavPathActive(item.to, pathname, item.exact)
  return (
    <Link
      to={item.to}
      aria-label={badge > 0 ? `${item.label}, ${badge} ${badgeLabel}` : item.label}
      aria-current={active ? 'page' : undefined}
      className={`${tabClass} ${active ? 'text-brand-ink' : 'text-ink-muted'}`}
    >
      <span className={`relative flex h-9 w-12 items-center justify-center rounded-full transition-all duration-200 ${active ? 'bg-brand-soft' : ''}`}>
        <item.icon className="h-5 w-5" strokeWidth={active ? 2 : 1.6} />
        {badge > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-xs font-bold text-white shadow-xs ring-2 ring-surface">
            {badge}
          </span>
        )}
      </span>
      {item.short}
    </Link>
  )
}

/** Mobile bottom bar while in Spend: Home · Accounts · [+] · History · Analysis (Invest switch lives in the header) */
export function SpendBottomNav() {
  const { pathname } = useLocation()
  const { reminders, dueRecurring } = useSpend()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-surface/85 backdrop-blur-xl safe-bottom">
      <div className="flex items-stretch justify-around px-2">
        <Tab item={spendOverviewItem} pathname={pathname} badge={dueRecurring.length} />
        <Tab item={spendAccountsItem} pathname={pathname} badge={reminders.length} badgeLabel={reminders.length === 1 ? 'bill due' : 'bills due'} />
        <div className="flex flex-1 items-start justify-center">
          <button
            type="button"
            onClick={() => openQuickAdd()}
            aria-label="Quick add transaction"
            className="-mt-4 grid h-14 w-14 place-items-center rounded-full bg-ink text-white shadow-[var(--shadow-lift)] ring-4 ring-canvas transition-transform active:scale-95 dark:bg-[#4f46e5] cursor-pointer focus-visible:outline-none focus-visible:ring-brand"
          >
            <PlusIcon className="h-6 w-6" strokeWidth={2.4} />
          </button>
        </div>
        <Tab item={spendTxnsItem} pathname={pathname} />
        <Tab item={spendAnalysisItem} pathname={pathname} />
      </div>
    </nav>
  )
}

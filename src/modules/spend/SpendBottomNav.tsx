import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { isNavPathActive, isSubItemActive, type NavSubItem } from '../../components/layout/nav'
import { NavSheetList } from '../../components/layout/NavSheetList'
import { Modal } from '../../components/ui/Modal'
import { DotsHorizontalIcon, PlusIcon } from '../../components/icons'
import { isLiabilityActionableThisMonth } from '../../lib/calc'
import { useData } from '../../store/DataContext'
import { spendAccountsItem, spendLoansItem, spendMoreItems, spendOverviewItem, spendRecurringItem, spendTxnsItem } from './nav'
import { openQuickAdd } from './QuickAddSheet'
import { useSpend } from './useSpend'

const tabClass =
  'group relative flex flex-1 flex-col items-center gap-0.5 px-1 pb-1 pt-1.5 text-xs font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset min-h-[48px]'

function Tab({ item, pathname, badge = 0, badgeLabel = 'to review' }: { item: NavSubItem; pathname: string; badge?: number; badgeLabel?: string }) {
  const active = isNavPathActive(item.to, pathname, item.exact)
  return (
    <Link
      to={item.to}
      aria-label={badge > 0 ? `${item.label}, ${badge} ${badgeLabel}` : item.label}
      aria-current={active ? 'page' : undefined}
      className={`${tabClass} ${active ? 'text-brand-ink' : 'text-ink-muted'}`}
    >
      <span className={`relative flex h-8 w-12 items-center justify-center rounded-full transition-all duration-200 ${active ? 'bg-brand-soft' : ''}`}>
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

/** Mobile bottom bar while in Spend: Home · Accounts · [+] · History · More (Invest switch lives in the header) */
export function SpendBottomNav() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { reminders, dueRecurring } = useSpend()
  const [moreOpen, setMoreOpen] = useState(false)
  const loansDue = (useData().data.liabilities ?? []).filter((l) => isLiabilityActionableThisMonth(l)).length
  // "More" lights up while on any page inside it
  const moreActive = spendMoreItems.some((item) => isSubItemActive(item, pathname))

  useEffect(() => setMoreOpen(false), [pathname])

  return (
    <>
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
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-label="More"
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
            className={`${tabClass} cursor-pointer ${moreActive ? 'text-brand-ink' : 'text-ink-muted'}`}
          >
            <span className={`relative flex h-8 w-12 items-center justify-center rounded-full transition-all duration-200 ${moreActive ? 'bg-brand-soft' : ''}`}>
              <DotsHorizontalIcon className="h-5 w-5" strokeWidth={moreActive ? 2 : 1.6} />
            </span>
            More
          </button>
        </div>
      </nav>

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="More" description="Bills, loans, analysis and settings">
        <NavSheetList
          items={spendMoreItems}
          activePath={pathname}
          // Due bills already badge the Home tab (where they're logged); the sheet row repeats it so the page is easy to find
          badgeFor={(to) => (to === spendRecurringItem.to ? dueRecurring.length : to === spendLoansItem.to ? loansDue : 0)}
          onSelect={(to) => {
            setMoreOpen(false)
            navigate(to)
          }}
        />
      </Modal>
    </>
  )
}

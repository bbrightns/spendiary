import { useToast } from '../../store/ToastContext'
import { useData } from '../../store/DataContext'
import { categoryUsage } from './logic'
import type { SpendCategory } from './categories'
import { useSpend } from './useSpend'

/** What still uses a category, as lines for the delete warning (empty when nothing does). */
export function useCategoryUsage() {
  const { transactions, recurring, settings } = useSpend()
  const hasLoans = (useData().data.liabilities ?? []).length > 0
  return (c: SpendCategory) => categoryUsage(c.id, { transactions, recurring, budget: settings.categoryBudgets?.[c.id], hasLoans })
}

/** The catch-all categories, which every picker keeps. */
export const KEEP_CATEGORY = new Set(['other', 'other_in'])

/**
 * Take a category out of the pickers, with Undo. One you made is deleted unless
 * something uses it; a built-in (or a used one) is hidden and can come back in Settings.
 */
export function useRemoveCategory() {
  const { removeCategory, setCategoryHidden, upsertCategory } = useSpend()
  const { showToast } = useToast()
  return (c: SpendCategory) => {
    if (KEEP_CATEGORY.has(c.id)) return
    if (c.custom && removeCategory(c.id) === 'removed') {
      showToast(`Deleted ${c.label}`, 'info', {
        label: 'Undo',
        onClick: () => upsertCategory({ id: c.id, type: c.type, label: c.label, icon: c.iconKey, tone: c.tone }),
      })
      return
    }
    setCategoryHidden(c.id, true)
    showToast(`Deleted ${c.label} · restore it in Settings`, 'info', { label: 'Undo', onClick: () => setCategoryHidden(c.id, false) })
  }
}

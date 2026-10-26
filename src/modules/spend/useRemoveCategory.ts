import { useToast } from '../../store/ToastContext'
import type { SpendCategory } from './categories'
import { useSpend } from './useSpend'

/** The catch-all categories, which every picker keeps. */
export const KEEP_CATEGORY = new Set(['other', 'other_in'])

/**
 * Take a category out of the pickers, with Undo. One you made is deleted unless
 * something uses it; a built-in (or a used one) is hidden and can come back in Settings.
 * Deleting one that is already hidden deletes it for good: it leaves Settings too.
 */
export function useRemoveCategory() {
  const { removeCategory, setCategoryHidden, setCategoryRemoved, upsertCategory } = useSpend()
  const { showToast } = useToast()
  return (c: SpendCategory) => {
    if (KEEP_CATEGORY.has(c.id)) return
    // Already hidden and can't be deleted outright (a built-in, or used by past transactions): delete it for good
    if (c.hidden && !(c.custom && removeCategory(c.id) === 'removed')) {
      setCategoryRemoved(c.id, true)
      showToast(`Deleted ${c.label}`, 'info', {
        label: 'Undo',
        onClick: () => {
          setCategoryRemoved(c.id, false)
          setCategoryHidden(c.id, true)
        },
      })
      return
    }
    if (c.hidden) {
      showToast(`Removed ${c.label}`, 'info', {
        label: 'Undo',
        onClick: () => upsertCategory({ id: c.id, type: c.type, label: c.label, icon: c.iconKey, tone: c.tone, hidden: true }),
      })
      return
    }
    if (c.custom && removeCategory(c.id) === 'removed') {
      showToast(`Removed ${c.label}`, 'info', {
        label: 'Undo',
        onClick: () => upsertCategory({ id: c.id, type: c.type, label: c.label, icon: c.iconKey, tone: c.tone }),
      })
      return
    }
    setCategoryHidden(c.id, true)
    showToast(`Removed ${c.label} · bring it back in Settings`, 'info', { label: 'Undo', onClick: () => setCategoryHidden(c.id, false) })
  }
}

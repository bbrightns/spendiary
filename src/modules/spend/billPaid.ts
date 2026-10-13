import { thb } from '../../lib/format'
import type { SpendRecurring } from '../../lib/types'
import type { ResultDetail } from '../../store/ToastContext'
import { getCategory } from './categories'
import { nextOccurrence } from './logic'

const day = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

/**
 * The "Paid" popup for a bill (or "Received" for income): the amount leads, then the bill,
 * how it was paid, and when the next one is due.
 */
export function paidDetail(p: {
  rec?: SpendRecurring
  /** The occurrence that was paid */
  date: string
  name: string
  amount: number
  accountName?: string
  categoryId?: string
  subcategory?: string
}): ResultDetail {
  const cat = getCategory(p.categoryId)
  const next = p.rec ? nextOccurrence(p.rec, p.date) : undefined
  return {
    amount: thb(p.amount),
    name: p.name,
    meta: [p.accountName, cat && (p.subcategory ? `${cat.label} › ${p.subcategory}` : cat.label)].filter(Boolean).join(' · ') || undefined,
    footnote: next ? `Next due ${day(next)}` : undefined,
  }
}

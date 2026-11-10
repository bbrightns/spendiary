import type { SpendRecurring } from '../../lib/types'
import { RepeatIcon, TransferIcon, getCategory } from './categories'
import { TONES } from './tones'

export const shortDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

/** Icon and color for a recurring item: its category's, or the transfer look */
export function recurringLook(rec: Pick<SpendRecurring, 'type' | 'categoryId'>) {
  if (rec.type === 'transfer') return { Icon: TransferIcon, tone: TONES.sky.chip }
  const cat = getCategory(rec.categoryId)
  return { Icon: cat?.icon ?? RepeatIcon, tone: TONES[cat?.tone ?? 'slate'].chip }
}

/** Amount color for a recurring item */
export const recurringAmountClass = (type: SpendRecurring['type']) => (type === 'income' ? 'text-gain-ink' : type === 'transfer' ? 'text-ink-muted' : 'text-ink')

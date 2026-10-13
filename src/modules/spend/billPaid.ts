import { localDateStr, thb } from '../../lib/format'
import type { Liability, SpendRecurring } from '../../lib/types'
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

/** Satang only when there are some: ฿3,333.33 but ฿8,500 */
const money = (n: number) => thb(n, !Number.isInteger(Math.round(n * 100) / 100))

/**
 * The "Paid" popup for a loan payment: the amount, the loan, which payment it was and where it
 * came from, then what's left and when the next one is due — or that it's paid off.
 */
export function loanPaidDetail(p: {
  /** The loan as it was before this payment */
  loan: Liability
  amount: number
  accountName?: string
  /** Paying on this day (defaults to today) */
  now?: Date
}): { detail: ResultDetail; paidOff: boolean } {
  const { loan } = p
  const n = (loan.paidInstallments ?? 0) + 1
  const left = Math.max(0, loan.balance - p.amount)
  const paidOff = left <= 0 || (!!loan.totalInstallments && n >= loan.totalInstallments)
  const step = loan.isInstallment && loan.totalInstallments ? `Payment ${n}/${loan.totalInstallments}` : undefined

  // The title already says "Paid off"
  let footnote = loan.totalInstallments && n >= loan.totalInstallments ? `All ${loan.totalInstallments} payments done` : 'Nothing left to pay'
  if (!paidOff) {
    footnote = `${money(left)} left`
    if (loan.dueDay) {
      // This month's payment is done, so the next one is next month's due day
      const now = p.now ?? new Date()
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 2, 0).getDate()
      const next = new Date(now.getFullYear(), now.getMonth() + 1, Math.min(loan.dueDay, lastDay))
      footnote += ` · next due ${day(localDateStr(next))}`
    }
  }

  return {
    detail: {
      amount: money(p.amount),
      name: loan.name,
      meta: [step, p.accountName].filter(Boolean).join(' · ') || undefined,
      footnote,
    },
    paidOff,
  }
}

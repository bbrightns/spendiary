import type { Liability, SpendCard } from '../../lib/types'
import { localDateStr } from '../../lib/format'
import { roundMoney } from '../../lib/money'

/**
 * Whether a payment counts as spending by default: buying on installment (a 0% phone plan) is,
 * paying back a loan (mortgage, car, personal) only moves money. Goes by category, since the
 * installment flag is also used to count a car loan's terms.
 */
export function paymentIsSpending(l: Liability): boolean {
  return l.category === 'installment'
}

/** Nothing left to pay: no balance, or every installment paid. */
export function isLoanDone(l: Liability): boolean {
  if (l.balance <= 0) return true
  return !!(l.isInstallment && l.totalInstallments && (l.paidInstallments ?? 0) >= l.totalInstallments)
}

/** What one payment is: the set monthly amount, else the balance spread over the installments left. */
export function loanPaymentAmount(l: Liability): number {
  // The last installment clears whatever rounding left behind (฿10,000 / 3 → 3,333.33 ×2 + 3,333.34)
  if (l.totalInstallments && (l.paidInstallments ?? 0) + 1 >= l.totalInstallments) return roundMoney(l.balance)
  if ((l.monthlyPayment ?? 0) > 0) return l.monthlyPayment!
  const remaining = Math.max(1, (l.totalInstallments ?? 1) - (l.paidInstallments ?? 0))
  return Math.round(l.balance / remaining)
}

/** How far along a loan is, 0–1: installments paid, else how much of the original balance is gone. */
export function loanProgress(l: Liability): number {
  if (l.isInstallment && l.totalInstallments) return Math.min(1, (l.paidInstallments ?? 0) / l.totalInstallments)
  const original = l.originalBalance ?? 0
  return original > 0 ? Math.min(1, Math.max(0, 1 - l.balance / original)) : 0
}

/**
 * When a card installment's first payment is due: the purchase lands on the next statement
 * (closing on the statement day, on or after the purchase) and is paid on the due day after it.
 */
export function firstInstallmentDue(card: Pick<SpendCard, 'statementDay' | 'dueDay'>, purchaseDate: string): string {
  const [y, m, d] = purchaseDate.split('-').map(Number)
  const at = (year: number, month: number, day: number) => new Date(year, month, Math.min(day, new Date(year, month + 1, 0).getDate()))
  const closeMonth = d <= card.statementDay ? m - 1 : m
  const close = at(y, closeMonth, card.statementDay)
  // A due day after the statement day falls in the same month; otherwise the month after
  const due = at(close.getFullYear(), close.getMonth() + (card.dueDay > card.statementDay ? 0 : 1), card.dueDay)
  return localDateStr(due)
}

/** One installment, rounded down to the satang; the last payment picks up the remainder. */
export const installmentAmount = (total: number, months: number) => Math.floor((total / months) * 100) / 100

/**
 * Credit a card's installment plans still hold: the bank blocks the whole remaining amount
 * from the limit, not just this month's payment.
 */
export function installmentHold(loans: Liability[], cardId: string): number {
  return loans
    .filter((l) => l.payFromId === cardId && l.category === 'installment' && !isLoanDone(l))
    .reduce((s, l) => s + Math.max(0, l.balance), 0)
}

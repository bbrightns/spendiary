import type { Liability } from '../../lib/types'

/** Nothing left to pay: no balance, or every installment paid. */
export function isLoanDone(l: Liability): boolean {
  if (l.balance <= 0) return true
  return !!(l.isInstallment && l.totalInstallments && (l.paidInstallments ?? 0) >= l.totalInstallments)
}

/** What one payment is: the set monthly amount, else the balance spread over the installments left. */
export function loanPaymentAmount(l: Liability): number {
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

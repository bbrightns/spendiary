import type { DebtCategory, Liability } from '../../lib/types'
import { CarIcon, CreditCardIcon, DebtIcon, HomeIcon, ReceiptPercentIcon, ShoppingBagIcon } from '../../components/icons'

/** Icon for a loan or installment by its category. */
export function DebtCategoryIcon({ category, className = 'h-4 w-4' }: { category: DebtCategory; className?: string }) {
  switch (category) {
    case 'installment':
      return <ShoppingBagIcon className={className} />
    case 'credit_card':
      return <CreditCardIcon className={className} />
    case 'mortgage':
      return <HomeIcon className={className} />
    case 'auto_loan':
      return <CarIcon className={className} />
    case 'personal_loan':
    case 'student_loan':
      return <ReceiptPercentIcon className={className} />
    default:
      return <DebtIcon className={className} />
  }
}

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

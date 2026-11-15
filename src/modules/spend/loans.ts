import type { Liability, SpendCard } from '../../lib/types'
import { roundMoney } from '../../lib/money'
import { cardCycle, followingStatement, statementFor } from './logic'

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
  return statementDue(card, statementFor(card, purchaseDate))
}

/** The due date of the statement closing on `statement` */
function statementDue(card: Pick<SpendCard, 'statementDay' | 'dueDay'>, statement: string): string {
  const [y, m, d] = statement.split('-').map(Number)
  return cardCycle(card, new Date(y, m - 1, d)).lastStatementDue
}

/**
 * A converted charge posts installment 1 on its own statement (`statement`, the one the charge billed on),
 * so installment 2 bills on the statement after it and is due on that one's due date (YYYY-MM-DD).
 */
export function nextInstallmentDue(card: Pick<SpendCard, 'statementDay' | 'dueDay'>, statement: string): string {
  return statementDue(card, followingStatement(card, statement))
}

/**
 * One installment, rounded down to the satang; the last payment picks up the remainder.
 * Divided in whole satang: 1009.8 / 10 in floating point is 100.9799…, which would floor a satang short.
 */
export const installmentAmount = (total: number, months: number) => Math.floor(Math.round(total * 100) / months) / 100

/**
 * Credit a card's installment plans still hold: the bank blocks the whole remaining amount
 * from the limit, not just this month's payment.
 */
export function installmentHold(loans: Liability[], cardId: string): number {
  return loans
    .filter((l) => l.payFromId === cardId && l.category === 'installment' && !isLoanDone(l))
    .reduce((s, l) => s + Math.max(0, l.balance), 0)
}

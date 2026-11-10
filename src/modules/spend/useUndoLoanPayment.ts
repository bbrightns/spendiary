import { useData } from '../../store/DataContext'
import { useSpend } from './useSpend'

/**
 * Undo a loan's latest payment: its balance and installment count go back, and the Spend
 * transaction it logged (if any) is removed so the wallet gets the money back too.
 */
export function useUndoLoanPayment() {
  const { data, undoLiabilityPayment } = useData()
  const { transactions, removeTransaction } = useSpend()
  return (liabilityId: string) => {
    // Only the transaction from that payment's day: one paid outside the app logged nothing,
    // and an older month's payment must stay
    const paidOn = (data.liabilities ?? []).find((l) => l.id === liabilityId)?.lastPaidDate
    const logged = paidOn ? transactions.find((t) => t.liabilityId === liabilityId && t.date === paidOn) : undefined
    if (logged) removeTransaction(logged.id)
    undoLiabilityPayment(liabilityId)
  }
}

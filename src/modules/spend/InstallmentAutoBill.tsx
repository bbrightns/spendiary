import { useEffect, useRef } from 'react'
import { useData } from '../../store/DataContext'
import { useToast } from '../../store/ToastContext'
import { localDateStr, thb } from '../../lib/format'
import { installmentBillDates, isLoanDone, loanPaymentAmount } from './loans'
import { useSpend } from './useSpend'

/**
 * Bills card installments the way the bank does: on each statement day, that month's payment goes
 * onto the card as an expense and comes off the plan. Catches up on statements missed while the
 * app was closed. Renders nothing; mounted once in the layout.
 */
export function InstallmentAutoBill() {
  const { data, dataReady, payLiabilityInstallment } = useData()
  const { cards, transactions, addTransaction } = useSpend()
  const { showToast } = useToast()
  // Payments already posted this session, so a re-render before the data catches up can't post twice
  const posted = useRef(new Set<string>())

  useEffect(() => {
    if (!dataReady) return
    const today = localDateStr()
    let count = 0
    let sum = 0
    for (const loan of data.liabilities ?? []) {
      if (!loan.autoBillToCard || !loan.firstDueDate || !loan.totalInstallments || isLoanDone(loan)) continue
      const card = cards.find((c) => c.id === loan.payFromId)
      if (!card) continue
      let paid = loan.paidInstallments ?? 0
      let balance = loan.balance
      installmentBillDates(card, loan.firstDueDate, loan.totalInstallments, today).forEach((date, i) => {
        // Already billed (or paid by hand before its statement)
        if (i < paid || balance <= 0) return
        const key = `${loan.id}:${i}`
        if (posted.current.has(key)) return
        posted.current.add(key)
        if (transactions.some((t) => t.liabilityId === loan.id && t.date === date)) return
        const amount = loanPaymentAmount({ ...loan, balance, paidInstallments: paid })
        addTransaction({
          type: 'expense',
          amount,
          categoryId: loan.spendCategoryId ?? 'bills',
          accountId: card.id,
          date,
          note: `${loan.name} ${i + 1}/${loan.totalInstallments}`,
          liabilityId: loan.id,
        })
        payLiabilityInstallment(loan.id, amount, date)
        paid += 1
        balance = Math.round((balance - amount) * 100) / 100
        count += 1
        sum += amount
      })
    }
    if (count > 0) showToast(count === 1 ? `Installment of ${thb(sum, true)} billed to your card` : `${count} installments (${thb(sum, true)}) billed to your cards`, 'info')
  }, [dataReady, data.liabilities, cards, transactions, addTransaction, payLiabilityInstallment, showToast])

  return null
}

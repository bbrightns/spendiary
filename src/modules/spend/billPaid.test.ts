import { describe, expect, it } from 'vitest'
import type { Liability } from '../../lib/types'
import { thb } from '../../lib/format'
import { loanPaidDetail } from './billPaid'

const loan = (over: Partial<Liability> = {}): Liability => ({ id: 'l1', name: 'Car', category: 'auto_loan', balance: 100_000, ...over })
const oct14 = new Date(2026, 9, 14)

describe('loanPaidDetail', () => {
  it('shows what is left and the next due day, next month', () => {
    const { detail, paidOff } = loanPaidDetail({ loan: loan({ dueDay: 28 }), amount: 8_500, accountName: 'KBank', now: oct14 })
    expect(paidOff).toBe(false)
    expect(detail.amount).toBe(thb(8_500))
    expect(detail.meta).toBe('KBank')
    expect(detail.footnote).toBe(`${thb(91_500)} left · next due Sat 28 Nov`)
  })

  it('clamps the due day to a short month', () => {
    const { detail } = loanPaidDetail({ loan: loan({ dueDay: 31 }), amount: 1_000, now: new Date(2027, 0, 20) })
    expect(detail.footnote).toContain('next due Sun 28 Feb')
  })

  it('names the installment and shows satang only when there are some', () => {
    const { detail } = loanPaidDetail({
      loan: loan({ category: 'installment', isInstallment: true, totalInstallments: 3, paidInstallments: 0, balance: 10_000 }),
      amount: 3_333.33,
      now: oct14,
    })
    expect(detail.amount).toBe(thb(3_333.33, true))
    expect(detail.meta).toBe('Payment 1/3')
    expect(detail.footnote).toBe(`${thb(6_666.67, true)} left`)
  })

  it('is paid off on the last installment', () => {
    const { detail, paidOff } = loanPaidDetail({
      loan: loan({ isInstallment: true, totalInstallments: 10, paidInstallments: 9, balance: 3_990 }),
      amount: 3_990,
    })
    expect(paidOff).toBe(true)
    expect(detail.footnote).toBe('All 10 payments done')
  })

  it('is paid off when the balance is cleared early', () => {
    const { detail, paidOff } = loanPaidDetail({ loan: loan({ totalInstallments: 10, paidInstallments: 5, balance: 2_000 }), amount: 2_000 })
    expect(paidOff).toBe(true)
    expect(detail.footnote).toBe('Nothing left to pay')
  })
})

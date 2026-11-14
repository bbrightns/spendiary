import { describe, expect, it } from 'vitest'
import type { Liability } from '../../lib/types'
import { payLiabilityInstallment } from '../../store/actions/liabilities'
import { installmentAmount, loanPaymentAmount } from './loans'

const satang = (n: number) => Math.round(n * 100)

describe('installmentAmount', () => {
  it('keeps a split that divides evenly exact', () => {
    // 1009.8 / 10 is 100.97999… in floating point, which used to floor to 100.97
    expect(installmentAmount(1009.8, 10)).toBe(100.98)
    expect(installmentAmount(1024.08, 3)).toBe(341.36)
    expect(installmentAmount(1026.6, 4)).toBe(256.65)
  })

  it('rounds down to the satang when it does not divide evenly', () => {
    expect(installmentAmount(10_000, 3)).toBe(3333.33)
    expect(installmentAmount(1000, 6)).toBe(166.66)
  })

  it('is always the whole-satang floor of total ÷ months', () => {
    for (let c = 100_000; c < 160_000; c += 7) {
      for (const months of [3, 4, 6, 10, 12, 24]) {
        expect(satang(installmentAmount(c / 100, months))).toBe(Math.floor(c / months))
      }
    }
  })
})

describe('paying an installment plan to the end', () => {
  const plan = (total: number, months: number): Liability => ({
    id: 'l1',
    name: 'Phone',
    category: 'installment',
    balance: total,
    originalBalance: total,
    monthlyPayment: installmentAmount(total, months),
    isInstallment: true,
    totalInstallments: months,
    paidInstallments: 0,
  })

  it('pays exactly the total and leaves a balance of 0', () => {
    for (const [total, months] of [[1000, 3], [1000, 6], [10_000, 3], [1000.13, 6], [1234.56, 10], [45_990, 24], [1009.8, 10]] as const) {
      let l = plan(total, months)
      let paid = 0
      for (let i = 0; i < months; i++) {
        const amount = loanPaymentAmount(l)
        paid += satang(amount)
        l = payLiabilityInstallment({ liabilities: [l] } as never, 'l1', amount).liabilities![0]
        // Never a fraction of a satang left on the balance
        expect(l.balance).toBe(satang(l.balance) / 100)
      }
      expect(paid).toBe(satang(total))
      expect(l.balance).toBe(0)
      expect(l.paidInstallments).toBe(months)
    }
  })
})

import { describe, expect, it } from 'vitest'
import type { Liability, SpendCard, SpendTransaction, SpendiaryData } from '../../lib/types'
import { canConvertCharge } from './logic'
import { clearTransactionsData, convertToInstallmentData, firstInstallmentTxn, removeTransactionData, undoInstallmentData } from './useSpend'
import { firstInstallmentDue, nextInstallmentDue } from './loans'
import { isLiabilityActionableThisMonth } from '../../lib/calc'

const card: SpendCard = { id: 'c1', name: 'KTC', color: 'x', creditLimit: 100_000, balance: 5_000, statementDay: 25, dueDay: 10 }
const charge = (p: Partial<SpendTransaction> = {}): SpendTransaction => ({
  id: 't1',
  type: 'expense',
  amount: 3_000,
  categoryId: 'shopping',
  accountId: 'c1',
  date: '2026-11-08',
  createdAt: '2026-11-08T00:00:00Z',
  ...p,
})
const plan = { id: 'p1', name: 'Phone', category: 'installment', balance: 3_000 } as Liability
const data = (txns: SpendTransaction[]) => ({ spendCards: [card], spendTransactions: txns, liabilities: [] }) as unknown as SpendiaryData

describe('canConvertCharge', () => {
  it('allows a charge on the open cycle', () => {
    expect(canConvertCharge(card, '2026-11-25', '2026-11-14')).toBe(true)
  })
  it('allows the last statement until its due day, then not', () => {
    expect(canConvertCharge(card, '2026-10-25', '2026-11-10')).toBe(true)
    expect(canConvertCharge(card, '2026-10-25', '2026-11-11')).toBe(false)
  })
  it('refuses an older statement', () => {
    expect(canConvertCharge(card, '2026-09-25', '2026-11-01')).toBe(false)
  })
})

describe('convertToInstallmentData', () => {
  const converted = { ...plan, totalInstallments: 3, monthlyPayment: 1_000, balance: 2_000, paidInstallments: 1 }
  const first = (old: SpendTransaction) => firstInstallmentTxn(old, converted, 'i1', '2026-11-14T00:00:00Z')

  it('puts installment 1 in the charge\'s place and adds the plan', () => {
    const old = charge({ time: '12:30', statement: '2026-11-25' })
    const d = convertToInstallmentData(data([old]), 't1', converted, first(old))
    expect(d.spendTransactions).toHaveLength(1)
    expect(d.spendTransactions?.[0]).toMatchObject({
      id: 'i1',
      type: 'expense',
      amount: 1_000,
      accountId: 'c1',
      date: '2026-11-08',
      time: '12:30',
      statement: '2026-11-25',
      liabilityId: 'p1',
      note: 'Phone payment 1/3',
    })
    // 5,000 − 3,000 charge + 1,000 installment
    expect(d.spendCards?.[0].balance).toBe(3_000)
    expect(d.liabilities).toEqual([converted])
  })
  it('takes a charge entered as already in the balance off too', () => {
    const old = charge({ alreadyInBalance: true })
    const d = convertToInstallmentData(data([old]), 't1', converted, first(old))
    expect(d.spendCards?.[0].balance).toBe(3_000)
  })
  it('does nothing for a missing charge', () => {
    const d0 = data([])
    expect(convertToInstallmentData(d0, 't1', converted, first(charge()))).toBe(d0)
  })
  it('undo puts the charge and the balance back and drops installment 1 and the plan', () => {
    const original = charge({ alreadyInBalance: true })
    const d0 = data([original])
    const f = first(original)
    const back = undoInstallmentData(convertToInstallmentData(d0, 't1', converted, f), original, f, 'p1')
    expect(back.spendTransactions).toEqual([original])
    expect(back.spendCards?.[0].balance).toBe(5_000)
    expect(back.liabilities).toEqual([])
  })
  it('undo still works after installment 1 was deleted by hand', () => {
    const original = charge()
    const f = first(original)
    const converted1 = convertToInstallmentData(data([original]), 't1', converted, f)
    const deleted = { ...converted1, spendTransactions: [], spendCards: [{ ...card, balance: 2_000 }] }
    const back = undoInstallmentData(deleted, original, f, 'p1')
    expect(back.spendTransactions).toEqual([original])
    expect(back.spendCards?.[0].balance).toBe(5_000)
  })
})

describe('a converted plan\'s next payment is due with the bill after installment 1', () => {
  // Statement day 25, due day 10: a charge on 8 Nov bills on 25 Nov (due 10 Dec), with installment 1 in its place.
  // Installment 2 bills on 25 Dec, due 10 Jan; 10 Dec is already paid by paying the card bill.
  it('is the due date of the statement after the charge\'s', () => {
    expect(nextInstallmentDue(card, '2026-11-25')).toBe('2027-01-10')
    expect(nextInstallmentDue(card, '2026-10-25')).toBe('2026-12-10')
  })
  it('clamps to short months', () => {
    expect(nextInstallmentDue({ statementDay: 31, dueDay: 20 }, '2027-01-31')).toBe('2027-03-20')
    expect(nextInstallmentDue({ statementDay: 5, dueDay: 31 }, '2027-01-05')).toBe('2027-02-28')
  })
  it('is not actionable before that month, then is', () => {
    const l: Liability = {
      ...plan,
      balance: 2_000,
      monthlyPayment: 1_000,
      isInstallment: true,
      totalInstallments: 3,
      paidInstallments: 1,
      dueDay: 10,
      firstDueDate: nextInstallmentDue(card, '2026-11-25'),
      createdAt: '2026-11-14',
    }
    const at = (iso: string) => new Date(`${iso}T12:00:00`)
    expect(isLiabilityActionableThisMonth(l, at('2026-11-14'))).toBe(false)
    expect(isLiabilityActionableThisMonth(l, at('2026-12-15'))).toBe(false)
    expect(isLiabilityActionableThisMonth(l, at('2027-01-05'))).toBe(true)
  })
  it('a new installment purchase is first due with its own statement', () => {
    expect(firstInstallmentDue(card, '2026-11-08')).toBe('2026-12-10')
    expect(firstInstallmentDue(card, '2026-11-25')).toBe('2026-12-10')
    expect(firstInstallmentDue(card, '2026-11-26')).toBe('2027-01-10')
  })
})

describe('converting installment 1 of a converted charge again', () => {
  it('is refused: an installment is already part of a plan', () => {
    const converted = { ...plan, totalInstallments: 3, monthlyPayment: 1_000, balance: 2_000, paidInstallments: 1 }
    const old = charge()
    const first = firstInstallmentTxn(old, converted, 'i1', '2026-11-14T00:00:00Z')
    const once = convertToInstallmentData(data([old]), 't1', converted, first)
    const again = { ...plan, id: 'p2', totalInstallments: 2, monthlyPayment: 500, balance: 500, paidInstallments: 1 }
    expect(convertToInstallmentData(once, 'i1', again, firstInstallmentTxn(first, again, 'i2', 'x'))).toBe(once)
  })
})

describe('converting onto another card', () => {
  const other: SpendCard = { id: 'c2', name: 'SCB', color: 'x', creditLimit: 50_000, balance: 0, statementDay: 15, dueDay: 2 }
  it('posts installment 1 on the plan\'s card, without the old card\'s statement', () => {
    const converted = { ...plan, payFromId: 'c2', totalInstallments: 3, monthlyPayment: 1_000, balance: 2_000, paidInstallments: 1 }
    const old = charge({ statement: '2026-11-25' })
    const first = firstInstallmentTxn(old, converted, 'i1', '2026-11-14T00:00:00Z')
    expect(first).toMatchObject({ accountId: 'c2', statement: undefined })
    const d = convertToInstallmentData({ ...data([old]), spendCards: [card, other] }, 't1', converted, first)
    // The charge comes off KTC, installment 1 lands on SCB
    expect(d.spendCards?.map((c) => c.balance)).toEqual([2_000, 1_000])
  })
  it('keeps the statement on the same card', () => {
    const same = { ...plan, payFromId: 'c1', totalInstallments: 3, monthlyPayment: 1_000 }
    expect(firstInstallmentTxn(charge({ statement: '2026-11-25' }), same, 'i1', 'x').statement).toBe('2026-11-25')
  })
})

describe('deleting a loan payment', () => {
  const loan: Liability = { id: 'p1', name: 'Phone', category: 'installment', balance: 2_000, originalBalance: 3_000, monthlyPayment: 1_000, isInstallment: true, totalInstallments: 3, paidInstallments: 1, lastPaidDate: '2026-11-14', lastPaidAmount: 1_000 }
  const payment = (p: Partial<SpendTransaction> = {}) => charge({ id: 'pay', amount: 1_000, categoryId: 'bills', date: '2026-11-14', liabilityId: 'p1', ...p })
  const withLoan = (txns: SpendTransaction[], l: Liability = loan) => ({ ...data(txns), liabilities: [l] }) as SpendiaryData

  it('takes the latest payment back off the loan', () => {
    const d = removeTransactionData(withLoan([payment()]), 'pay')
    expect(d.spendTransactions).toEqual([])
    expect(d.spendCards?.[0].balance).toBe(4_000)
    expect(d.liabilities?.[0]).toMatchObject({ balance: 3_000, paidInstallments: 0 })
  })
  it('leaves the loan alone for an older payment', () => {
    const d = removeTransactionData(withLoan([payment({ date: '2026-10-14' })]), 'pay')
    expect(d.liabilities?.[0]).toMatchObject({ balance: 2_000, paidInstallments: 1 })
  })
  it('deleting installment 1 of a converted charge puts it back on the plan', () => {
    const converted = { ...plan, totalInstallments: 3, monthlyPayment: 1_000, balance: 2_000, originalBalance: 3_000, paidInstallments: 1 }
    const old = charge()
    const once = convertToInstallmentData(data([old]), 't1', converted, firstInstallmentTxn(old, converted, 'i1', 'x'))
    const d = removeTransactionData(once, 'i1')
    expect(d.liabilities?.[0]).toMatchObject({ balance: 3_000, paidInstallments: 0 })
    // Card owes what it did before the charge: 5,000 − 3,000
    expect(d.spendCards?.[0].balance).toBe(2_000)
  })
  it('a payment whose loan was deleted only gives the money back', () => {
    const d = removeTransactionData({ ...data([payment()]), liabilities: [] } as SpendiaryData, 'pay')
    expect(d.spendCards?.[0].balance).toBe(4_000)
  })
})

describe('deleting every transaction', () => {
  it('puts bills back as due and loans back as unpaid, like deleting them one by one', () => {
    const loan: Liability = { id: 'p1', name: 'Phone', category: 'installment', balance: 2_000, monthlyPayment: 1_000, totalInstallments: 3, paidInstallments: 1, lastPaidDate: '2026-11-14', lastPaidAmount: 1_000 }
    const rec = { id: 'r1', name: 'Netflix', type: 'expense', amount: 419, categoryId: 'bills', frequency: 'monthly', day: 1, startDate: '2026-01-01', doneDates: ['2026-11-01'] } as const
    const d = clearTransactionsData({
      ...data([
        charge({ id: 'pay', amount: 1_000, date: '2026-11-14', liabilityId: 'p1' }),
        charge({ id: 'bill', amount: 419, date: '2026-11-01', recurring: { id: 'r1', date: '2026-11-01' } }),
        charge({ id: 'shop', amount: 500 }),
      ]),
      liabilities: [loan],
      spendRecurring: [{ ...rec, doneDates: [...rec.doneDates] }],
    } as SpendiaryData)
    expect(d.spendTransactions).toEqual([])
    expect(d.spendCards?.[0].balance).toBe(5_000 - 1_000 - 419 - 500)
    expect(d.spendRecurring?.[0].doneDates).toEqual([])
    expect(d.liabilities?.[0]).toMatchObject({ balance: 3_000, paidInstallments: 0 })
  })
})

import { describe, expect, it } from 'vitest'
import type { Liability, SpendCard, SpendTransaction, SpendiaryData } from '../../lib/types'
import { canConvertCharge } from './logic'
import { convertToInstallmentData, firstInstallmentTxn, undoInstallmentData } from './useSpend'
import { nextMonthDue } from './loans'
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

describe('a converted plan comes due next month, not this one', () => {
  // Installment 1 was posted when converting, so the next is due on the due day next month
  const planOn = (today: string, dueDay: number): Liability => ({
    ...plan,
    balance: 2_000,
    monthlyPayment: 1_000,
    isInstallment: true,
    totalInstallments: 3,
    paidInstallments: 1,
    dueDay,
    firstDueDate: nextMonthDue(dueDay, today),
    createdAt: today,
  })
  const at = (iso: string) => new Date(`${iso}T12:00:00`)
  it.each([
    ['2026-11-03', 10],
    ['2026-11-14', 10],
    ['2026-11-28', 10],
    ['2026-11-28', 5],
    ['2026-01-31', 30],
  ])('converted %s, due day %i', (today, dueDay) => {
    const l = planOn(today, dueDay)
    expect(isLiabilityActionableThisMonth(l, at(today))).toBe(false)
    const [y, m] = today.split('-').map(Number)
    const next = new Date(y, m, 1)
    expect(isLiabilityActionableThisMonth(l, next)).toBe(true)
  })
  it('clamps the due day to a short month', () => {
    expect(nextMonthDue(31, '2027-01-15')).toBe('2027-02-28')
    expect(nextMonthDue(10, '2026-12-20')).toBe('2027-01-10')
  })
})

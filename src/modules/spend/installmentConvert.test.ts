import { describe, expect, it } from 'vitest'
import type { Liability, SpendCard, SpendTransaction, SpendiaryData } from '../../lib/types'
import { canConvertCharge } from './logic'
import { convertToInstallmentData, undoInstallmentData } from './useSpend'

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
  it('takes the charge off the card and adds the plan', () => {
    const d = convertToInstallmentData(data([charge()]), 't1', plan)
    expect(d.spendTransactions).toEqual([])
    expect(d.spendCards?.[0].balance).toBe(2_000)
    expect(d.liabilities).toEqual([plan])
  })
  it('takes a charge entered as already in the balance off too', () => {
    const d = convertToInstallmentData(data([charge({ alreadyInBalance: true })]), 't1', plan)
    expect(d.spendCards?.[0].balance).toBe(2_000)
  })
  it('does nothing for a missing charge', () => {
    const d0 = data([])
    expect(convertToInstallmentData(d0, 't1', plan)).toBe(d0)
  })
  it('undo puts the charge and the balance back and drops the plan', () => {
    const original = charge({ alreadyInBalance: true })
    const d0 = data([original])
    const back = undoInstallmentData(convertToInstallmentData(d0, 't1', plan), original, 'p1')
    expect(back.spendTransactions).toEqual([original])
    expect(back.spendCards?.[0].balance).toBe(5_000)
    expect(back.liabilities).toEqual([])
  })
})

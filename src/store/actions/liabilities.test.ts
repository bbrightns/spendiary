import { describe, expect, it } from 'vitest'
import type { Liability, SpendiaryData } from '../../lib/types'
import { emptyData } from '../migrate'
import { payLiabilityInstallment, removeLiability, setLiabilities, undoLiabilityPayment, upsertLiability } from './liabilities'

const loan = (over: Partial<Liability> = {}): Liability => ({
  id: 'l1',
  name: 'Phone',
  category: 'installment',
  balance: 10000,
  monthlyPayment: 1000,
  totalInstallments: 10,
  paidInstallments: 0,
  originalBalance: 10000,
  ...over,
} as Liability)

const state = (item: Liability): SpendiaryData => ({ ...emptyData, liabilities: [item] })
const first = (d: SpendiaryData) => d.liabilities![0]

describe('payLiabilityInstallment', () => {
  it('takes the given amount off and counts the installment', () => {
    const out = first(payLiabilityInstallment(state(loan()), 'l1', 1500))
    expect(out).toMatchObject({ balance: 8500, paidInstallments: 1, lastPaidAmount: 1500 })
    expect(out.lastPaidDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('uses the monthly payment when no amount is given', () => {
    expect(first(payLiabilityInstallment(state(loan()), 'l1')).balance).toBe(9000)
  })

  it('splits the balance over the installments left when there is no monthly payment', () => {
    const out = first(payLiabilityInstallment(state(loan({ monthlyPayment: undefined, paidInstallments: 6 })), 'l1'))
    expect(out.balance).toBe(7500)
  })

  it('never goes below zero and records what actually came off', () => {
    const out = first(payLiabilityInstallment(state(loan({ balance: 300 })), 'l1', 1000))
    expect(out).toMatchObject({ balance: 0, lastPaidAmount: 300 })
  })

  it('logs the payment', () => {
    const log = payLiabilityInstallment(state(loan()), 'l1').holdingLogs?.[0]
    expect(log).toMatchObject({ action: 'edit', ticker: 'DEBT' })
    expect(log?.note).toContain('Paid installment 1/10')
  })

  it('changes nothing for an unknown debt', () => {
    const before = state(loan())
    expect(payLiabilityInstallment(before, 'nope', 100)).toBe(before)
  })
})

describe('undoLiabilityPayment', () => {
  it('puts back exactly what the payment took off', () => {
    const before = state(loan())
    const undone = first(undoLiabilityPayment(payLiabilityInstallment(before, 'l1', 1234), 'l1'))
    expect(undone).toMatchObject({ balance: 10000, paidInstallments: 0, lastPaidAmount: undefined, lastPaidDate: undefined })
  })

  it('never restores above the original balance', () => {
    const out = first(undoLiabilityPayment(state(loan({ balance: 9800, paidInstallments: 1, lastPaidAmount: 1000 })), 'l1'))
    expect(out.balance).toBe(10000)
  })

  it('falls back to the monthly payment for older records', () => {
    const out = first(undoLiabilityPayment(state(loan({ balance: 8000, paidInstallments: 2, originalBalance: undefined })), 'l1'))
    expect(out).toMatchObject({ balance: 9000, paidInstallments: 1 })
  })

  it('changes nothing when nothing has been paid', () => {
    const before = state(loan())
    expect(undoLiabilityPayment(before, 'l1')).toBe(before)
  })
})

describe('upsertLiability / removeLiability / setLiabilities', () => {
  it('adds a debt with an update date and logs it', () => {
    const out = upsertLiability(emptyData, { name: 'Car', category: 'auto_loan', balance: 300_000 })
    expect(out.liabilities).toHaveLength(1)
    expect(first(out).updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(out.holdingLogs?.[0]).toMatchObject({ action: 'add', ticker: 'DEBT', note: 'Added liability "Car" with balance ฿300,000' })
  })

  it('logs an edit of an existing debt', () => {
    const out = upsertLiability(state(loan()), { ...loan(), balance: 9000 })
    expect(first(out).balance).toBe(9000)
    expect(out.holdingLogs?.[0]).toMatchObject({ action: 'edit', note: 'Updated liability "Phone" balance to ฿9,000' })
  })

  it('removes a debt and logs it, or changes nothing for an unknown one', () => {
    const out = removeLiability(state(loan()), 'l1')
    expect(out.liabilities).toEqual([])
    expect(out.holdingLogs?.[0].action).toBe('sell')
    const before = state(loan())
    expect(removeLiability(before, 'nope')).toBe(before)
  })

  it('replaces the whole list', () => {
    expect(setLiabilities(state(loan()), []).liabilities).toEqual([])
  })
})

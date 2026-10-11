import { describe, expect, it } from 'vitest'
import type { CashAccount, PayCycle, SpendCard, SpendRecurring, SpendTransaction } from '../../lib/types'
import {
  accountTotals,
  applyToBalances,
  cardBill,
  cardCycle,
  dayAllowance,
  dueRecurring,
  occurrencesBetween,
  parseTags,
  paydayIn,
  periodFor,
  shiftPeriod,
} from './logic'

const txn = (p: Partial<SpendTransaction>): SpendTransaction => ({
  id: Math.random().toString(36).slice(2),
  type: 'expense',
  amount: 100,
  date: '2026-10-10',
  createdAt: '2026-10-10T00:00:00Z',
  ...p,
})

const wallet = (id: string, balance: number): CashAccount => ({ id, name: id, balance }) as CashAccount
const card = (p: Partial<SpendCard> = {}): SpendCard => ({
  id: 'card',
  name: 'Card',
  creditLimit: 50_000,
  balance: 0,
  statementDay: 25,
  dueDay: 10,
  ...p,
})

describe('parseTags', () => {
  it('reads word tags, lowercased and unique', () => {
    expect(parseTags('Milk tea #NoseTea #nosetea #office')).toEqual(['nosetea', 'office'])
  })
  it('keeps Thai tags whole', () => {
    expect(parseTags('ชา #ร้านโปรด')).toEqual(['ร้านโปรด'])
  })
  it('ignores store names glued to other characters', () => {
    expect(parseTags('Snacks #7-11')).toEqual([])
    expect(parseTags('a#b')).toEqual([])
  })
  it('allows trailing punctuation', () => {
    expect(parseTags('Lunch #office, then #gym.')).toEqual(['office', 'gym'])
  })
})

describe('applyToBalances', () => {
  const b = { cashAccounts: [wallet('w1', 1000), wallet('w2', 500)], spendCards: [card({ balance: 200 })] }

  it('moves money for expense, income and transfer', () => {
    expect(applyToBalances(b, txn({ accountId: 'w1', amount: 100 }), 1).cashAccounts[0].balance).toBe(900)
    expect(applyToBalances(b, txn({ type: 'income', accountId: 'w1', amount: 100 }), 1).cashAccounts[0].balance).toBe(1100)
    const t = applyToBalances(b, txn({ type: 'transfer', accountId: 'w1', toAccountId: 'card', amount: 150 }), 1)
    expect(t.cashAccounts[0].balance).toBe(850)
    expect(t.spendCards[0].balance).toBe(50)
  })
  it('a card charge raises what is owed; reversing undoes it', () => {
    const x = txn({ accountId: 'card', amount: 99.99 })
    const after = applyToBalances(b, x, 1)
    expect(after.spendCards[0].balance).toBe(299.99)
    expect(applyToBalances(after, x, -1).spendCards[0].balance).toBe(200)
  })
  it('leaves balances alone for entries already in the balance', () => {
    expect(applyToBalances(b, txn({ accountId: 'w1', alreadyInBalance: true }), 1)).toBe(b)
  })
})

describe('periods', () => {
  it('calendar month', () => {
    expect(periodFor('2026-02-14')).toEqual({ start: '2026-02-01', end: '2026-02-28' })
  })
  it('payday cycle shifts weekend paydays earlier', () => {
    const cycle: PayCycle = { mode: 'payday', rule: { kind: 'day', day: 25 }, weekend: 'before' } as PayCycle
    // 25 Oct 2026 is a Sunday → paid Fri 23 Oct
    expect(paydayIn(2026, 9, cycle).getDate()).toBe(23)
    expect(periodFor('2026-10-24', cycle).start).toBe('2026-10-23')
    const next = shiftPeriod(periodFor('2026-10-24', cycle), 1, cycle)
    expect(next.start > '2026-10-24').toBe(true)
  })
})

describe('cardCycle and cardBill', () => {
  it('statement and due dates around today', () => {
    const c = cardCycle(card(), new Date(2026, 9, 11))
    expect(c).toEqual({
      lastStatement: '2026-09-25',
      nextStatement: '2026-10-25',
      lastStatementDue: '2026-10-10',
      nextStatementDue: '2026-11-10',
    })
  })
  it('bill = balance minus charges since the statement closed', () => {
    const c = card({ balance: 1500 })
    const txns = [txn({ accountId: 'card', amount: 1000, date: '2026-09-20' }), txn({ accountId: 'card', amount: 500, date: '2026-10-01' })]
    const bill = cardBill(c, txns, 5, '2026-10-05')
    expect(bill.amountDue).toBe(1000)
    expect(bill.statementTotal).toBe(1000)
    expect(bill.status).toBe('due')
  })
})

describe('recurring', () => {
  const rec = (p: Partial<SpendRecurring>): SpendRecurring =>
    ({ id: 'r', name: 'Rent', type: 'expense', amount: 1, frequency: 'monthly', day: 31, startDate: '2026-01-01', ...p }) as SpendRecurring

  it('clamps monthly days to short months', () => {
    expect(occurrencesBetween(rec({}), '2026-02-01', '2026-03-31')).toEqual(['2026-02-28', '2026-03-31'])
  })
  it('weekly on Sunday (day 7)', () => {
    expect(occurrencesBetween(rec({ frequency: 'weekly', day: 7 }), '2026-10-05', '2026-10-18')).toEqual(['2026-10-11', '2026-10-18'])
  })
  it('due list skips logged and skipped dates', () => {
    const r = rec({ day: 1, doneDates: ['2026-09-01'], skippedDates: [] })
    expect(dueRecurring([r], '2026-10-05').map((d) => d.date)).toEqual(['2026-10-01'])
  })
})

describe('dayAllowance', () => {
  it('splits what is left over the days left, including today', () => {
    const p = { start: '2026-10-01', end: '2026-10-31' }
    const a = dayAllowance(3100, p, [txn({ amount: 1000, date: '2026-10-05' }), txn({ amount: 50, date: '2026-10-22' })], '2026-10-22')
    expect(a.daysLeft).toBe(10)
    expect(a.allowance).toBe(210)
    expect(a.leftToday).toBe(160)
  })
})

describe('accountTotals', () => {
  it('sums spend, income and transfers for one account', () => {
    const t = accountTotals(
      [
        txn({ accountId: 'w1', amount: 100, date: '2026-09-01' }),
        txn({ type: 'income', accountId: 'w1', amount: 300 }),
        txn({ type: 'transfer', accountId: 'w1', toAccountId: 'w2', amount: 50 }),
        txn({ type: 'transfer', accountId: 'w2', toAccountId: 'w1', amount: 20 }),
        txn({ accountId: 'other', amount: 999 }),
      ],
      'w1',
    )
    expect(t).toMatchObject({ spent: 100, income: 300, net: 200, transferOut: 50, transferIn: 20, count: 4, since: '2026-09-01' })
  })
})

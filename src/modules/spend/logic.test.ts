import { describe, expect, it } from 'vitest'
import { categoriesFor, guessCategory, syncCategories } from './categories'
import { homeOrder, isDefaultOrder, moveCard } from './homeLayout'
import type { CashAccount, Liability, PayCycle, SpendCard, SpendRecurring, SpendTransaction } from '../../lib/types'
import { firstInstallmentDue, installmentAmount, installmentHold, isLoanDone, loanPaymentAmount, loanProgress, paymentIsSpending } from './loans'
import { isLiabilityActionableThisMonth, isLiabilityFirstDueNextMonth, isLiabilityPaidThisMonth } from '../../lib/calc'
import { availableCredit, limitOwner, totalAvailable } from './credit'
import {
  accountTotals,
  applyOrder,
  moveId,
  activeTagQuery,
  noteTitle,
  recurringNote,
  suggestTags,
  averageMonthlySpend,
  goalProgress,
  isThaiHoliday,
  thaiHolidays,
  minimumPayment,
  applyToBalances,
  cardBill,
  unbilledOpening,
  cardCycle,
  dayAllowance,
  dueRecurring,
  occurrencesBetween,
  parseTags,
  paydayIn,
  periodFor,
  shiftPeriod,
  sortTxns,
  totalsBySubcategory,
  categoryBreakdown,
  renameInList,
  renameSubOn,
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

describe('sortTxns', () => {
  it('orders newest first by date, then time of day, then creation time', () => {
    const rows = [
      txn({ id: 'a', date: '2026-10-12', time: '20:00' }),
      txn({ id: 'b', date: '2026-10-13', time: '08:15' }),
      txn({ id: 'c', date: '2026-10-13', time: '19:28' }),
      txn({ id: 'd', date: '2026-10-13', createdAt: '2026-10-13T23:00:00Z' }),
      txn({ id: 'e', date: '2026-10-13', createdAt: '2026-10-13T01:00:00Z' }),
    ]
    expect(sortTxns(rows).map((t) => t.id)).toEqual(['c', 'b', 'd', 'e', 'a'])
  })
})

describe('totalsBySubcategory', () => {
  it('sums expenses per subcategory within one category, biggest first', () => {
    const rows = [
      txn({ categoryId: 'food', subcategory: 'Dessert', amount: 45 }),
      txn({ categoryId: 'food', subcategory: 'Regular', amount: 50 }),
      txn({ categoryId: 'food', subcategory: 'Regular', amount: 60 }),
      txn({ categoryId: 'food', amount: 999 }),
      txn({ categoryId: 'transport', subcategory: 'Yaris', amount: 1370 }),
      txn({ type: 'income', categoryId: 'food', subcategory: 'Regular', amount: 5 }),
    ]
    expect(totalsBySubcategory(rows, 'food')).toEqual([
      { subcategory: 'Regular', amount: 110 },
      { subcategory: 'Dessert', amount: 45 },
    ])
  })
})

describe('categoryBreakdown', () => {
  it('names untagged entries by their note, so the biggest spend is not left out', () => {
    const rows = [
      txn({ categoryId: 'family', subcategory: 'Pop', amount: 500 }),
      txn({ categoryId: 'family', note: 'ค่าส่งเงินพ่อแม่', amount: 6000 }),
      txn({ categoryId: 'family', amount: 40 }),
      txn({ categoryId: 'food', note: 'Sushi', amount: 300 }),
    ]
    expect(categoryBreakdown(rows, 'family')).toEqual([
      { label: 'ค่าส่งเงินพ่อแม่', amount: 6000 },
      { label: 'Pop', amount: 500 },
      { label: 'Other', amount: 40 },
    ])
  })
  it('folds the long tail into Other and stays empty when nothing is named', () => {
    const rows = ['A', 'B', 'C'].map((note, i) => txn({ categoryId: 'food', note, amount: 30 - i * 10 }))
    expect(categoryBreakdown(rows, 'food', 2)).toEqual([
      { label: 'A', amount: 30 },
      { label: 'B', amount: 20 },
      { label: 'Other', amount: 10 },
    ])
    expect(categoryBreakdown([txn({ categoryId: 'food', amount: 9 })], 'food')).toEqual([])
  })
})

describe('parseTags', () => {
  it('reads word tags, lowercased and unique', () => {
    expect(parseTags('Milk tea #NoseTea #nosetea #office')).toEqual(['nosetea', 'office'])
  })
  it('keeps Thai tags whole', () => {
    expect(parseTags('ชา #ร้านโปรด')).toEqual(['ร้านโปรด'])
  })
  it('keeps hyphens and dots inside a tag', () => {
    expect(parseTags('Snacks #7-11')).toEqual(['7-11'])
    expect(parseTags('ข้าว #ป.ประสงค์ อร่อย')).toEqual(['ป.ประสงค์'])
  })
  it('ignores a # glued to a word before it', () => {
    expect(parseTags('a#b')).toEqual([])
    expect(parseTags('x #a#b')).toEqual([])
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

describe('opening amount not billed yet', () => {
  // Statement day 25, due day 10. Added on 12 Oct: owes 1,000, none of it on a statement yet
  const c = card({ balance: 1000, unbilled: { amount: 1000, statement: '2026-10-25' } })

  it('is this cycle, not overdue, until its statement closes', () => {
    const bill = cardBill(c, [], 5, '2026-10-12')
    expect(bill.amountDue).toBe(0)
    expect(bill.status).toBe('clear')
    expect(unbilledOpening(c, '2026-09-25')).toBe(1000)
  })
  it('becomes that statement\'s bill once it closes', () => {
    const bill = cardBill(c, [], 5, '2026-10-26')
    expect(unbilledOpening(c, '2026-10-25')).toBe(0)
    expect(bill.amountDue).toBe(1000)
    expect(bill.dueDate).toBe('2026-11-10')
  })
  it('splits a mixed balance: the billed part is due now, the rest later', () => {
    const mixed = card({ balance: 1500, unbilled: { amount: 1000, statement: '2026-10-25' } })
    const bill = cardBill(mixed, [], 5, '2026-10-05')
    expect(bill.amountDue).toBe(500)
    expect(bill.dueDate).toBe('2026-10-10')
  })
  it('without it, the whole opening balance is billed (old behaviour)', () => {
    const bill = cardBill(card({ balance: 1000 }), [], 5, '2026-10-12')
    expect(bill.amountDue).toBe(1000)
    expect(bill.status).toBe('overdue')
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

describe('averageMonthlySpend', () => {
  const spendIn = (date: string, amount: number) => txn({ date, amount })
  it('averages complete months since tracking began', () => {
    const txns = [spendIn('2026-06-10', 300), spendIn('2026-07-05', 600), spendIn('2026-08-01', 900), spendIn('2026-09-15', 1200), spendIn('2026-10-02', 5000)]
    // Oct is the current month (not complete); Jun–Sep count
    expect(averageMonthlySpend(txns, undefined, '2026-10-11')).toEqual({ average: 750, months: 4 })
  })
  it('needs at least 3 months', () => {
    expect(averageMonthlySpend([spendIn('2026-09-01', 100)], undefined, '2026-10-11')).toBeUndefined()
  })
  it('caps at 6 months', () => {
    const txns = Array.from({ length: 10 }, (_, i) => spendIn(`2025-${String(12 - i).padStart(2, '0')}-05`, 100))
    expect(averageMonthlySpend(txns, undefined, '2026-01-15')?.months).toBe(6)
  })
})

describe('minimumPayment', () => {
  it('is a share of the bill, rounded up to the satang, capped at the bill', () => {
    expect(minimumPayment(5630)).toBe(450.4)
    expect(minimumPayment(1000, 10)).toBe(100)
    expect(minimumPayment(0)).toBe(0)
    expect(minimumPayment(50, 100)).toBe(50)
  })
})

describe('Thai holidays', () => {
  it('adds substitution days for weekend holidays', () => {
    // 13–15 Apr 2024 were Sat–Mon → substitutes Tue 16
    const h = thaiHolidays(2024)
    expect(h.has('2024-04-16')).toBe(true)
    expect(isThaiHoliday('2026-10-23')).toBe(true)
    expect(isThaiHoliday('2026-10-22')).toBe(false)
  })
  it('moves payday off holidays and extra days off', () => {
    const base: PayCycle = { mode: 'payday', rule: { kind: 'day', day: 23 }, weekend: 'before' }
    // Fri 23 Oct 2026 is Chulalongkorn Day
    expect(paydayIn(2026, 9, base).getDate()).toBe(23)
    expect(paydayIn(2026, 9, { ...base, holidays: true }).getDate()).toBe(22)
    expect(paydayIn(2026, 9, { ...base, extraHolidays: ['2026-10-23', '2026-10-22'] }).getDate()).toBe(21)
  })
})

describe('goalProgress', () => {
  const goal = { id: 'g', name: 'Trip', target: 12000, createdAt: '' }
  it('uses the typed amount, or the linked wallet', () => {
    expect(goalProgress({ ...goal, saved: 3000 }, [], '2026-01-10')).toMatchObject({ saved: 3000, left: 9000, pct: 25, done: false })
    expect(goalProgress({ ...goal, walletId: 'w', saved: 1 }, [{ id: 'w', balance: 12500 }], '2026-01-10')).toMatchObject({ saved: 12500, left: 0, pct: 100, done: true })
  })
  it('works out the monthly amount to a deadline', () => {
    const p = goalProgress({ ...goal, saved: 0, deadline: '2026-07-01' }, [], '2026-01-10')
    expect(p.monthsLeft).toBe(6)
    expect(p.perMonth).toBe(2000)
    expect(goalProgress({ ...goal, deadline: '2025-12-01' }, [], '2026-01-10').overdue).toBe(true)
  })
})

describe('guessCategory', () => {
  it('finds Thai keywords inside longer words and English keywords', () => {
    expect(guessCategory('ค่ากาแฟ Starbucks', 'expense')?.id).toBe('drinks')
    expect(guessCategory('Grab ride', 'expense')?.id).toBe('transport')
    expect(guessCategory('Team lunch', 'expense')?.id).toBe('food')
    expect(guessCategory('random thing', 'expense')).toBeUndefined()
  })

  it('a one- or two-letter word only counts when it is a whole word', () => {
    // "c" is the start of "cafe", which isn't a reason to call a transfer Drinks
    expect(guessCategory('โอนเงิน C', 'expense')).toBeUndefined()
    expect(guessCategory('Payment ID A1 b', 'expense')).toBeUndefined()
    expect(guessCategory('ค่ากาแฟ', 'expense')?.id).toBe('drinks')
    expect(guessCategory('coffee', 'expense')?.id).toBe('drinks')
    expect(guessCategory('BTS', 'expense')?.id).toBe('transport')
  })
})

describe('cardBill early payments', () => {
  // Statement closes on the 25th (inclusive); today is after it
  const transfer = (date: string, amount: number) => txn({ type: 'transfer', toAccountId: 'card', accountId: 'w', date, amount })
  it('counts a payment made before the statement closed as paid early', () => {
    const txns = [txn({ accountId: 'card', amount: 5969, date: '2026-10-05' }), transfer('2026-10-20', 2000)]
    const bill = cardBill(card({ balance: 3969 }), txns, 5, '2026-10-26')
    expect(bill).toMatchObject({ statementTotal: 5969, paidEarly: 2000, amountDue: 3969, other: 0 })
  })
  it('a payment in the window settles the previous bill first', () => {
    // Owed 1,000 from September, paid on 8 Oct; 500 charged this cycle
    const txns = [txn({ accountId: 'card', amount: 500, date: '2026-10-05' }), transfer('2026-10-08', 1000)]
    const bill = cardBill(card({ balance: 500 }), txns, 5, '2026-10-26')
    expect(bill).toMatchObject({ paidEarly: 0, amountDue: 500, other: 0 })
  })
  it('charges on the statement day belong to that statement', () => {
    const bill = cardBill(card({ balance: 300 }), [txn({ accountId: 'card', amount: 300, date: '2026-10-25' })], 5, '2026-10-26')
    expect(bill).toMatchObject({ to: '2026-10-25', statementTotal: 300, amountDue: 300 })
  })
})

describe('overpaying a card', () => {
  it('leaves credit that the next charges use up first', () => {
    const b = { cashAccounts: [wallet('w', 10000)], spendCards: [card({ balance: 600 })] }
    const paid = applyToBalances(b, txn({ type: 'transfer', accountId: 'w', toAccountId: 'card', amount: 1000 }), 1)
    expect(paid.spendCards[0].balance).toBe(-400)
    expect(cardBill(paid.spendCards[0], [], 5, '2026-10-26')).toMatchObject({ amountDue: 0, status: 'clear' })
    const charged = applyToBalances(paid, txn({ accountId: 'card', amount: 650 }), 1)
    expect(charged.spendCards[0].balance).toBe(250)
  })
})

describe('home card order', () => {
  it('cleans up a saved order and adds missing cards', () => {
    expect(homeOrder(['days', 'bogus', 'days', 'allowance'])).toEqual(['days', 'allowance', 'month', 'recurring'])
    expect(homeOrder(undefined)).toEqual(['allowance', 'month', 'recurring', 'days'])
  })
  it('moves a card and stops at the ends', () => {
    const o = homeOrder()
    expect(moveCard(o, 'days', -1)).toEqual(['allowance', 'month', 'days', 'recurring'])
    expect(moveCard(o, 'allowance', -1)).toBe(o)
    expect(isDefaultOrder(o)).toBe(true)
  })
})

describe('noteTitle', () => {
  it('drops tags from a normal note', () => {
    expect(noteTitle('Milk tea #nosetea')).toBe('Milk tea')
    expect(noteTitle('Snacks #7-11, cold')).toBe('Snacks, cold')
    expect(noteTitle('#ป.ประสงค์')).toBe('ป.ประสงค์')
  })
  it('uses the first tag when the note is only tags', () => {
    expect(noteTitle('#NoseTea #office')).toBe('NoseTea')
  })
  it('is empty without a note', () => {
    expect(noteTitle(undefined)).toBe('')
    expect(noteTitle('   ')).toBe('')
  })
})

describe('tag suggestions', () => {
  const t = (tags: string[]) => txn({ tags })
  const history = [t(['nosetea', 'office']), t(['nosetea']), t(['noodle']), t(['gym'])]

  it('finds the half-typed tag at the end only', () => {
    expect(activeTagQuery('Lunch #no')).toBe('no')
    expect(activeTagQuery('Snacks #7-1')).toBe('7-1')
    expect(activeTagQuery('Lunch #')).toBe('')
    expect(activeTagQuery('Lunch #no ')).toBeNull()
    expect(activeTagQuery('Lunch')).toBeNull()
    expect(activeTagQuery('a#b')).toBeNull()
  })
  it('suggests used tags by prefix, most used first', () => {
    expect(suggestTags(history, 'Lunch #no', 'no')).toEqual(['nosetea', 'noodle'])
  })
  it('lists everything for a bare #, skipping tags already in the note', () => {
    expect(suggestTags(history, '#gym #', '')).toEqual(['nosetea', 'office', 'noodle'])
  })
  it('does not suggest what is already fully typed', () => {
    expect(suggestTags(history, '#gym', 'gym')).toEqual([])
  })
})

describe('category order', () => {
  it('keeps Other last, with the user\'s own categories before it', () => {
    syncCategories({
      customCategories: [
        { id: 'c1', label: 'Pets', type: 'expense', icon: 'tag', tone: 'rose' },
        { id: 'c2', label: 'Tips', type: 'income', icon: 'tag', tone: 'teal' },
      ],
      categoryEdits: {},
    })
    const ex = categoriesFor('expense').map((c) => c.label)
    expect(ex.slice(-2)).toEqual(['Pets', 'Other'])
    const inc = categoriesFor('income').map((c) => c.label)
    expect(inc.slice(-2)).toEqual(['Tips', 'Other'])
  })
  it('follows the saved order per type, with unlisted ones after and Other still last', () => {
    syncCategories({
      customCategories: [{ id: 'c1', label: 'Pets', type: 'expense', icon: 'tag', tone: 'rose' }],
      categoryEdits: {},
      categoryOrder: { expense: ['fun', 'other', 'food'], income: ['bonus'] },
    })
    const ex = categoriesFor('expense').map((c) => c.id)
    expect(ex.slice(0, 3)).toEqual(['fun', 'food', 'drinks'])
    expect(ex.slice(-2)).toEqual(['c1', 'other'])
    expect(categoriesFor('income')[0].id).toBe('bonus')
    syncCategories({})
  })
})

describe('renaming a subcategory', () => {
  it('renames in place, merges onto an existing label, and adds a label that was not offered', () => {
    expect(renameInList(['Snack', 'Sushi'], 'Snack', 'Snacks')).toEqual(['Snacks', 'Sushi'])
    expect(renameInList(['Snack', 'Sushi', 'Buffet'], 'Snack', 'Sushi')).toEqual(['Sushi', 'Buffet'])
    expect(renameInList(['Sushi'], 'Gone', 'Back')).toEqual(['Sushi', 'Back'])
  })
  it('retags only that category\'s items, and leaves the array alone when nothing matches', () => {
    const rows = [
      txn({ id: '1', categoryId: 'food', subcategory: 'Snack' }),
      txn({ id: '2', categoryId: 'drinks', subcategory: 'Snack' }),
      txn({ id: '3', categoryId: 'food', subcategory: 'Sushi' }),
    ]
    expect(renameSubOn(rows, 'food', 'Snack', 'Snacks').map((t) => t.subcategory)).toEqual(['Snacks', 'Snack', 'Sushi'])
    expect(renameSubOn(rows, 'food', 'Nope', 'X')).toBe(rows)
  })
})

describe('saved order', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  const ids = (xs: { id: string }[]) => xs.map((x) => x.id)

  it('keeps the original order without a saved one', () => {
    expect(ids(applyOrder(items, undefined))).toEqual(['a', 'b', 'c'])
  })
  it('puts saved ids first and new items after, skipping unknown ids', () => {
    expect(ids(applyOrder(items, ['c', 'gone', 'a']))).toEqual(['c', 'a', 'b'])
  })
  it('moves an id one step and stops at the ends', () => {
    expect(moveId(['a', 'b', 'c'], 'c', -1)).toEqual(['a', 'c', 'b'])
    expect(moveId(['a', 'b', 'c'], 'a', -1)).toEqual(['a', 'b', 'c'])
    expect(moveId(['a', 'b', 'c'], 'x', 1)).toEqual(['a', 'b', 'c'])
  })
})

describe('loans', () => {
  const loan = (p: Partial<Liability>): Liability => ({ id: 'l', name: 'L', category: 'personal_loan', balance: 10_000, ...p })

  it('pays the monthly amount, else the balance spread over what is left', () => {
    expect(loanPaymentAmount(loan({ monthlyPayment: 3990 }))).toBe(3990)
    expect(loanPaymentAmount(loan({ balance: 9000, totalInstallments: 10, paidInstallments: 7 }))).toBe(3000)
  })
  it('counts only installment purchases as spending, whatever the installment flag says', () => {
    expect(paymentIsSpending(loan({ category: 'installment' }))).toBe(true)
    expect(paymentIsSpending(loan({ category: 'auto_loan', isInstallment: true, totalInstallments: 60 }))).toBe(false)
  })
  it('is done when nothing is owed or every installment is paid', () => {
    expect(isLoanDone(loan({ balance: 0 }))).toBe(true)
    expect(isLoanDone(loan({ isInstallment: true, totalInstallments: 10, paidInstallments: 10 }))).toBe(true)
    expect(isLoanDone(loan({}))).toBe(false)
  })
  it('measures progress by installments, else by how much of the original is gone', () => {
    expect(loanProgress(loan({ isInstallment: true, totalInstallments: 10, paidInstallments: 4 }))).toBeCloseTo(0.4)
    expect(loanProgress(loan({ balance: 7500, originalBalance: 10_000 }))).toBeCloseTo(0.25)
    expect(loanProgress(loan({}))).toBe(0)
  })
})

describe('card installments', () => {
  const card = { statementDay: 25, dueDay: 10 }
  const loan = (p: Partial<Liability>): Liability => ({ id: 'l', name: 'L', category: 'installment', balance: 10_000, ...p })

  it('bills the first payment on the next statement', () => {
    // Bought before the 25th → on the 25 Oct statement → due 10 Nov
    expect(firstInstallmentDue(card, '2026-10-11')).toBe('2026-11-10')
    // On the statement day itself it still makes that statement
    expect(firstInstallmentDue(card, '2026-10-25')).toBe('2026-11-10')
    // After it → 25 Nov statement → due 10 Dec
    expect(firstInstallmentDue(card, '2026-10-26')).toBe('2026-12-10')
    // Due day after the statement day falls in the same month
    expect(firstInstallmentDue({ statementDay: 5, dueDay: 25 }, '2026-10-11')).toBe('2026-11-25')
    // Short months clamp (statement on the 31st)
    expect(firstInstallmentDue({ statementDay: 31, dueDay: 15 }, '2026-02-10')).toBe('2026-03-15')
  })
  it('rounds each payment down and lets the last one clear the rest', () => {
    expect(installmentAmount(10_000, 3)).toBe(3333.33)
    expect(loanPaymentAmount(loan({ balance: 3333.34, monthlyPayment: 3333.33, totalInstallments: 3, paidInstallments: 2 }))).toBe(3333.34)
    expect(loanPaymentAmount(loan({ balance: 6666.67, monthlyPayment: 3333.33, totalInstallments: 3, paidInstallments: 1 }))).toBe(3333.33)
  })
  it('holds what open installment plans still owe against the card', () => {
    const loans = [
      loan({ id: 'a', payFromId: 'ktc', balance: 18_000, totalInstallments: 10, paidInstallments: 1 }),
      loan({ id: 'b', payFromId: 'ktc', balance: 0 }),
      loan({ id: 'c', payFromId: 'uob', balance: 5000 }),
      loan({ id: 'd', payFromId: 'ktc', category: 'auto_loan', balance: 400_000 }),
    ]
    expect(installmentHold(loans, 'ktc')).toBe(18_000)
  })
  it('waits for the first due date before asking for a payment', () => {
    const l = loan({ dueDay: 10, firstDueDate: '2026-11-10', createdAt: '2026-10-11' })
    expect(isLiabilityFirstDueNextMonth(l, new Date(2026, 9, 20))).toBe(true)
    expect(isLiabilityFirstDueNextMonth(l, new Date(2026, 10, 3))).toBe(false)
  })
  it("'next month' only applies to the month the debt was added in", () => {
    const l = loan({ category: 'personal_loan', dueDay: 5, firstPaymentMonth: 'next', createdAt: '2026-10-11' })
    expect(isLiabilityFirstDueNextMonth(l, new Date(2026, 9, 20))).toBe(true)
    expect(isLiabilityFirstDueNextMonth(l, new Date(2026, 10, 3))).toBe(false)
  })
})

describe('card installment, paid by hand', () => {
  it('asks for Pay from the month of its first due date', () => {
    // Bought 11 Oct on a card closing the 25th, due the 10th → first due 10 Nov
    const l: Liability = {
      id: 'ipad', name: 'iPad', category: 'installment', balance: 20_000, monthlyPayment: 2000,
      isInstallment: true, totalInstallments: 10, paidInstallments: 0, dueDay: 10,
      firstDueDate: firstInstallmentDue({ statementDay: 25, dueDay: 10 }, '2026-10-11'), createdAt: '2026-10-11',
    }
    expect(isLiabilityActionableThisMonth(l, new Date(2026, 9, 28))).toBe(false)
    expect(isLiabilityActionableThisMonth(l, new Date(2026, 10, 3))).toBe(true)
    expect(isLiabilityActionableThisMonth(l, new Date(2026, 10, 15))).toBe(true)
  })
})

describe('shared credit limits', () => {
  const c = (p: Partial<SpendCard> & { id: string }): SpendCard => ({ name: p.id, creditLimit: 0, balance: 0, statementDay: 25, dueDay: 10, ...p })
  const smart = c({ id: 'smart', name: 'ttb So Smart', creditLimit: 122_000, balance: 735 })
  const disney = c({ id: 'disney', name: 'ttb Disney', creditLimit: 122_000, balance: 120, sharedLimitWith: 'smart' })
  const ktc = c({ id: 'ktc', creditLimit: 120_000, balance: 5969 })
  const cards = [smart, disney, ktc]

  it('counts every card on the limit, from either card', () => {
    expect(availableCredit(disney, cards, []).left).toBe(121_145)
    expect(availableCredit(smart, cards, []).left).toBe(121_145)
    expect(availableCredit(disney, cards, []).sharedWith).toEqual(['ttb So Smart'])
    expect(availableCredit(ktc, cards, []).left).toBe(114_031)
  })
  it('takes installment holds on any card in the group off the shared limit', () => {
    const plan: Liability = { id: 'p', name: 'TV', category: 'installment', balance: 20_000, payFromId: 'disney' }
    expect(availableCredit(smart, cards, [plan]).left).toBe(101_145)
  })
  it('counts a shared limit once in the total', () => {
    expect(totalAvailable(cards, [])).toEqual({ limit: 242_000, left: 121_145 + 114_031 })
  })
  it('falls back to its own limit when the main card is gone or shares one itself', () => {
    expect(limitOwner(disney, [disney, ktc]).id).toBe('disney')
    const chained = c({ id: 'x', sharedLimitWith: 'disney', creditLimit: 5000 })
    expect(limitOwner(chained, [...cards, chained]).id).toBe('x')
  })
})

describe('paying a debt ahead of its due date', () => {
  const base: Liability = { id: 'i', name: 'iPhone', category: 'installment', balance: 52_110, monthlyPayment: 5790, isInstallment: true, totalInstallments: 10, dueDay: 1 }

  it('counts a payment made shortly before the due date for that due date', () => {
    const l = { ...base, paidInstallments: 1, lastPaidDate: '2026-09-25', createdAt: '2026-08-10' }
    expect(isLiabilityPaidThisMonth(l, new Date(2026, 9, 12))).toBe(true)
    expect(isLiabilityActionableThisMonth(l, new Date(2026, 9, 12))).toBe(false)
    // …but not for the month after
    expect(isLiabilityActionableThisMonth(l, new Date(2026, 10, 3))).toBe(true)
  })
  it("counts any payment since it was added when this month has the first payment", () => {
    // Added 20 Sep (after the 1st) → first due 1 Oct; paid the same day, 11 days early wouldn't matter
    const l = { ...base, paidInstallments: 1, lastPaidDate: '2026-09-02', createdAt: '2026-09-01', firstPaymentMonth: 'next' as const }
    expect(isLiabilityPaidThisMonth(l, new Date(2026, 9, 12))).toBe(true)
  })
  it("doesn't count a late payment for last month as this month's", () => {
    // Due the 1st, last month's paid late on 5 Sep → 1 Oct is still owed
    const l = { ...base, paidInstallments: 3, lastPaidDate: '2026-09-05', createdAt: '2026-05-01' }
    expect(isLiabilityPaidThisMonth(l, new Date(2026, 9, 12))).toBe(false)
    expect(isLiabilityActionableThisMonth(l, new Date(2026, 9, 12))).toBe(true)
  })
})

describe('recurringNote', () => {
  it('joins an older item’s separate name and note, name first', () => {
    expect(recurringNote({ name: 'Netflix', note: '#subscription' })).toBe('Netflix #subscription')
    expect(recurringNote({ name: 'Netflix', note: 'family plan' })).toBe('Netflix family plan')
  })

  it('keeps a merged note as it is, and falls back to the name', () => {
    expect(recurringNote({ name: 'Netflix', note: 'Netflix #subscription' })).toBe('Netflix #subscription')
    expect(recurringNote({ name: 'netflix', note: 'Netflix  #subscription ' })).toBe('Netflix  #subscription')
    expect(recurringNote({ name: 'Rent' })).toBe('Rent')
  })
})

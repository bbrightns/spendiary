import { describe, expect, it } from 'vitest'
import type { CashAccount, DcaPlan, Holding, HoldingLog, SpendTransaction, SpendiaryData } from '../../lib/types'
import { investTransactions, isInvested } from './invest'
import { guessColumns, investCandidates, pairExisting, parseCsv, toImportRows } from './importCsv'
import { toCsv } from './exportCsv'

const acct = (id: string, balance: number): CashAccount => ({ id, name: id, balance })
const holding = (thb: number): Holding => ({ id: 'h1', name: 'S&P 500', ticker: 'SPX', assetClass: 'fund', units: 1, avgCost: thb, price: thb, totalThbInvested: thb }) as Holding
const log = (l: Partial<HoldingLog>): HoldingLog =>
  ({ id: 'l1', timestamp: '2026-10-05T09:30:00', action: 'buy_more', holdingName: 'S&P 500', ticker: 'SPX', assetClass: 'fund', note: '', ...l }) as HoldingLog
const data = (logs: HoldingLog[], plans: DcaPlan[] = []) => ({ holdingLogs: logs, dcaPlans: plans, cashAccounts: [], holdings: [] }) as unknown as SpendiaryData

describe('investTransactions', () => {
  it('shows a DCA buy paid from an account, for the amount paid', () => {
    const plan = { id: 'p1', name: 'Monthly S&P', assetClass: 'fund', monthlyAmount: 5000, dayOfMonth: 5 } as DcaPlan
    const [row] = investTransactions(
      data([log({ dcaPlanId: 'p1', dcaDate: '2026-10-05', paidFromAccountId: 'kbank', paidAmount: 4800, holdingId: 'h1', previousHoldingState: holding(0), afterHoldingState: holding(4800) })], [plan]),
      null,
    )
    expect(row).toMatchObject({ id: 'dca-l1', type: 'transfer', amount: 4800, accountId: 'kbank', date: '2026-10-05', note: 'Monthly S&P', source: 'dca' })
    expect(isInvested(row)).toBe(true)
  })

  it('shows a DCA buy with no account as an invested row without one', () => {
    const plan = { id: 'p1', name: 'Monthly S&P', assetClass: 'fund', monthlyAmount: 5000, dayOfMonth: 5 } as DcaPlan
    const [row] = investTransactions(data([log({ dcaPlanId: 'p1', dcaDate: '2026-10-05' })], [plan]), null)
    expect(row).toMatchObject({ amount: 5000, accountId: undefined, source: 'dca' })
  })

  it('shows a savings DCA as a transfer into the savings account, not as invested', () => {
    const plan = { id: 'p2', name: 'Savings', assetClass: 'cash', cashAccountId: 'save', monthlyAmount: 3000, dayOfMonth: 1 } as DcaPlan
    const before = [acct('kbank', 10_000), acct('save', 0)]
    const after = [acct('kbank', 7000), acct('save', 3000)]
    const [row] = investTransactions(
      data([log({ dcaPlanId: 'p2', assetClass: 'cash', paidFromAccountId: 'kbank', paidAmount: 3000, previousCashAccountsState: before, afterCashAccountsState: after })], [plan]),
      null,
    )
    expect(row).toMatchObject({ type: 'transfer', amount: 3000, accountId: 'kbank', toAccountId: 'save', source: 'dca' })
    expect(isInvested(row)).toBe(false)
  })

  it('shows Buy more for what left the paying account, or what was invested when none was picked', () => {
    const paid = log({
      id: 'b1',
      holdingId: 'h1',
      cashAccountId: 'kbank',
      previousCashAccountsState: [acct('kbank', 10_000)],
      afterCashAccountsState: [acct('kbank', 8000)],
      previousHoldingState: holding(1000),
      afterHoldingState: holding(3000),
    })
    const unpaid = log({ id: 'b2', holdingId: 'h1', previousHoldingState: holding(3000), afterHoldingState: holding(4500) })
    const rows = investTransactions(data([paid, unpaid]), null)
    expect(rows[0]).toMatchObject({ id: 'buy-b1', amount: 2000, accountId: 'kbank', source: 'buy', time: '09:30', note: 'S&P 500 (SPX)' })
    expect(rows[1]).toMatchObject({ id: 'buy-b2', amount: 1500, accountId: undefined, source: 'buy' })
  })

  it('leaves out cash-account logs and plan edits', () => {
    const rows = investTransactions(
      data([log({ assetClass: 'cash', holdingName: 'Cash Accounts' }), log({ action: 'add', ticker: 'DCA', holdingName: 'DCA Plan: x' })]),
      null,
    )
    expect(rows).toEqual([])
  })
})

describe('export → import with Invest rows on the account', () => {
  it('pairs exported transfers and expenses with their own entries, and a statement-only DCA line with the Invest row', () => {
    const own = [
      { id: 't1', type: 'transfer', amount: 5000, date: '2026-10-05', accountId: 'kbank', toAccountId: 'card', note: 'Pay card', createdAt: '' },
      { id: 'e1', type: 'expense', amount: 5000, date: '2026-10-05', accountId: 'kbank', note: 'Rent', createdAt: '' },
    ] as SpendTransaction[]
    const dca = { id: 'dca-1', type: 'transfer', amount: 5000, date: '2026-10-05', accountId: 'kbank', note: 'Monthly S&P', source: 'dca', createdAt: '' } as SpendTransaction
    const name = (id?: string) => ({ kbank: 'KBank', card: 'KTC' })[id as 'kbank'] ?? ''
    // Spend's export leaves Invest rows out, the bank statement line for the DCA is added by hand
    const csv = toCsv(own, { category: () => '', account: name }) + '2026-10-05,,expense,,,KBank,,S&P 500 fund,,-5000.00\r\n'
    const [header, ...body] = parseCsv(csv)
    const rows = toImportRows(body, guessColumns(header)!).rows
    const pairs = pairExisting(rows, [...own, ...investCandidates([...own, dca], 'kbank')], 'kbank')
    expect(rows.map((r) => r.type)).toEqual(['transfer', 'expense', 'expense'])
    expect([0, 1, 2].map((i) => pairs.get(i)?.id)).toEqual(['t1', 'e1', 'dca-1'])
  })
})

describe('investCandidates', () => {
  const rows = [
    { id: 'dca-1', type: 'transfer', amount: 5000, date: '2026-10-05', accountId: 'kbank', source: 'dca' },
    { id: 'dca-2', type: 'transfer', amount: 3000, date: '2026-10-01', accountId: 'kbank', toAccountId: 'save', source: 'dca' },
    { id: 'div-1', type: 'income', amount: 120, date: '2026-10-03', accountId: 'kbank', source: 'dividend' },
    { id: 'own', type: 'expense', amount: 50, date: '2026-10-03', accountId: 'kbank' },
  ]

  it('reads Invest rows on the account as statement lines: money out and money in', () => {
    expect(investCandidates(rows, 'kbank').map((c) => [c.id, c.type])).toEqual([
      ['dca-1', 'expense'],
      ['dca-2', 'expense'],
      ['div-1', 'income'],
    ])
    expect(investCandidates(rows, 'save').map((c) => [c.id, c.type, c.accountId])).toEqual([['dca-2', 'income', 'save']])
  })
})

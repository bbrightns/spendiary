import { describe, expect, it } from 'vitest'
import type { SpendRecurring, SpendiaryData } from '../../lib/types'
import { emptyData } from '../../store/migrate'
import { accountLabel, reconcileAccounts, recurringUsing, syncRecurringAccounts, trackRemovedMoves } from './accountRemoval'
import { recurringInput } from './useSpend'

const rec = (over: Partial<SpendRecurring>): SpendRecurring => ({
  id: 'r1',
  name: 'Rent',
  type: 'expense',
  amount: 1000,
  categoryId: 'bills',
  frequency: 'monthly',
  day: 1,
  startDate: '2026-01-01',
  ...over,
})

const kbank = { id: 'kbank', name: 'KBank', balance: 5000 }
const scb = { id: 'scb', name: 'SCB', balance: 100 }
const card = { id: 'ktc', name: 'KTC', balance: 0, creditLimit: 10000, statementDay: 25, dueDay: 10 } as NonNullable<SpendiaryData['spendCards']>[number]

const data = (over: Partial<SpendiaryData> = {}): SpendiaryData => ({ ...emptyData, cashAccounts: [kbank, scb], spendCards: [card], ...over })

describe('recurringUsing', () => {
  it('finds every item that uses the account, with its role', () => {
    const list = [
      rec({ id: 'a', accountId: 'kbank' }),
      rec({ id: 'b', type: 'income', accountId: 'kbank' }),
      rec({ id: 'c', type: 'transfer', accountId: 'scb', toAccountId: 'kbank' }),
      rec({ id: 'd', type: 'transfer', accountId: 'kbank', toAccountId: 'scb' }),
      rec({ id: 'e', accountId: 'scb' }),
    ]
    expect(recurringUsing(list, 'kbank').map((u) => [u.rec.id, u.role])).toEqual([
      ['a', 'pays from it'],
      ['b', 'is paid into it'],
      ['c', 'transfers into it'],
      ['d', 'transfers from it'],
    ])
  })

  it('ignores a stale toAccountId on a non-transfer', () => {
    expect(recurringUsing([rec({ accountId: 'scb', toAccountId: 'kbank' })], 'kbank')).toEqual([])
  })
})

describe('syncRecurringAccounts', () => {
  const live = new Set(['kbank'])

  it('pauses an item whose account is gone and marks why', () => {
    const [out] = syncRecurringAccounts([rec({ type: 'transfer', accountId: 'kbank', toAccountId: 'scb' })], live)
    expect(out).toMatchObject({ paused: true, pausedReason: 'accountRemoved' })
  })

  it('leaves an item the user paused alone, and does not resume it later', () => {
    const list = [rec({ accountId: 'scb', paused: true })]
    expect(syncRecurringAccounts(list, live)).toBe(list)
    expect(syncRecurringAccounts(list, new Set(['scb']))).toBe(list)
  })

  it('resumes an item paused by a removal once its accounts are back', () => {
    const [out] = syncRecurringAccounts([rec({ accountId: 'kbank', paused: true, pausedReason: 'accountRemoved' })], live)
    expect(out.paused).toBeUndefined()
    expect(out.pausedReason).toBeUndefined()
  })

  it('returns the same array when nothing changes (no wallet = not tracked)', () => {
    const list = [rec({ accountId: 'kbank' }), rec({ id: 'r2', accountId: undefined })]
    expect(syncRecurringAccounts(list, live)).toBe(list)
  })
})

describe('reconcileAccounts', () => {
  it('returns next as is when accounts did not change', () => {
    const prev = data()
    const next = { ...prev, monthlyIncome: 5 }
    expect(reconcileAccounts(prev, next)).toBe(next)
  })

  it('on delete: keeps the name, clears defaults and favorites, pauses recurring; the logs stay', () => {
    const txn = { id: 't1', type: 'expense' as const, amount: 50, accountId: 'kbank', date: '2026-10-01', createdAt: '' }
    const prev = data({
      spendTransactions: [txn],
      spendRecurring: [rec({ id: 'r1', type: 'transfer', accountId: 'scb', toAccountId: 'kbank', doneDates: ['2026-10-01'] })],
      spendSettings: { defaultAccountId: 'kbank', favoriteAccountIds: ['kbank', 'scb'] },
    })
    const out = reconcileAccounts(prev, { ...prev, cashAccounts: [scb] })
    expect(out.spendSettings?.removedAccounts?.kbank?.name).toBe('KBank')
    expect(out.spendSettings?.defaultAccountId).toBeUndefined()
    expect(out.spendSettings?.favoriteAccountIds).toEqual(['scb'])
    expect(out.spendRecurring?.[0]).toMatchObject({ paused: true, pausedReason: 'accountRemoved', toAccountId: 'kbank', doneDates: ['2026-10-01'] })
    expect(out.spendTransactions).toEqual([txn])
  })

  it('handles a deleted card the same way', () => {
    const prev = data({ spendRecurring: [rec({ accountId: 'ktc' })] })
    const out = reconcileAccounts(prev, { ...prev, spendCards: [] })
    expect(out.spendSettings?.removedAccounts?.ktc?.name).toBe('KTC')
    expect(out.spendRecurring?.[0].paused).toBe(true)
  })

  it('on undo (same id back): forgets the saved name and resumes', () => {
    const removed = reconcileAccounts(data({ spendRecurring: [rec({ accountId: 'kbank' })] }), data({ cashAccounts: [scb], spendRecurring: [rec({ accountId: 'kbank' })] }))
    const back = reconcileAccounts(removed, { ...removed, cashAccounts: [kbank, scb] })
    expect(back.spendSettings?.removedAccounts).toEqual({})
    expect(back.spendRecurring?.[0].paused).toBeUndefined()
  })

  it('a transfer resumes only when both of its wallets are back', () => {
    const prev = data({ spendRecurring: [rec({ type: 'transfer', accountId: 'kbank', toAccountId: 'scb' })] })
    const bothGone = reconcileAccounts(prev, { ...prev, cashAccounts: [] })
    const oneBack = reconcileAccounts(bothGone, { ...bothGone, cashAccounts: [kbank] })
    expect(oneBack.spendRecurring?.[0].paused).toBe(true)
    const allBack = reconcileAccounts(oneBack, { ...oneBack, cashAccounts: [kbank, scb] })
    expect(allBack.spendRecurring?.[0].paused).toBeUndefined()
  })
})

describe('money moved on a deleted account', () => {
  const txn = (over: object) => ({ type: 'expense' as const, amount: 100, accountId: 'kbank', ...over })

  it('is kept while the account is gone: a deleted expense gives the money back', () => {
    const removed = { kbank: { name: 'KBank', removedAt: '' } }
    expect(trackRemovedMoves(removed, txn({}), -1)?.kbank.pending).toBe(100)
    expect(trackRemovedMoves(removed, txn({ type: 'income' }), -1)?.kbank.pending).toBe(-100)
  })

  it('an edit (take back old, add new) keeps only the difference; a full round trip leaves nothing', () => {
    let removed = trackRemovedMoves({ kbank: { name: 'KBank', removedAt: '' } }, txn({}), -1)
    removed = trackRemovedMoves(removed, txn({ amount: 30 }), 1)
    expect(removed?.kbank.pending).toBe(70)
    removed = trackRemovedMoves(removed, txn({ amount: 70 }), 1)
    expect(removed?.kbank.pending).toBeUndefined()
  })

  it('a transfer between a live and a deleted wallet only tracks the deleted side', () => {
    const removed = { kbank: { name: 'KBank', removedAt: '' } }
    const out = trackRemovedMoves(removed, txn({ type: 'transfer', toAccountId: 'scb' }), -1)
    expect(out?.kbank.pending).toBe(100)
    expect(out?.scb).toBeUndefined()
  })

  it('returns the same object when no deleted account is touched', () => {
    const removed = { kbank: { name: 'KBank', removedAt: '' } }
    expect(trackRemovedMoves(removed, txn({ accountId: 'scb' }), 1)).toBe(removed)
    expect(trackRemovedMoves(undefined, txn({}), 1)).toBeUndefined()
  })

  it('lands on the balance when the account comes back (wallet +, card owed −)', () => {
    const prev = data({ cashAccounts: [scb], spendCards: [], spendSettings: { removedAccounts: { kbank: { name: 'KBank', removedAt: '', pending: 250 }, ktc: { name: 'KTC', removedAt: '', pending: 40 } } } })
    const back = reconcileAccounts(prev, { ...prev, cashAccounts: [kbank, scb], spendCards: [card] })
    expect(back.cashAccounts.find((a) => a.id === 'kbank')?.balance).toBe(5250)
    expect(back.spendCards?.[0].balance).toBe(-40)
    expect(back.spendSettings?.removedAccounts).toEqual({})
  })
})

describe('accountLabel', () => {
  it('prefers the live name, then the deleted one, else nothing', () => {
    const removed = { kbank: { name: 'KBank' } }
    expect(accountLabel('kbank', 'KBank Savings', removed)).toBe('KBank Savings')
    expect(accountLabel('kbank', undefined, removed)).toBe('KBank (deleted)')
    expect(accountLabel('other', undefined, removed)).toBeUndefined()
    expect(accountLabel(undefined, undefined, removed)).toBeUndefined()
  })
})

describe('recurringInput for a transfer', () => {
  it('moves money between the two wallets, without a category', () => {
    const input = recurringInput(rec({ type: 'transfer', categoryId: '', subcategory: 'x', accountId: 'kbank', toAccountId: 'scb', name: 'Savings' }))
    expect(input).toMatchObject({ type: 'transfer', accountId: 'kbank', toAccountId: 'scb', amount: 1000 })
    expect(input.categoryId).toBeUndefined()
    expect(input.subcategory).toBeUndefined()
  })

  it('never carries a toAccountId on an expense', () => {
    expect(recurringInput(rec({ accountId: 'kbank', toAccountId: 'scb' })).toAccountId).toBeUndefined()
  })
})

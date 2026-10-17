import { describe, expect, it } from 'vitest'
import type { CashAccount } from '../lib/types'
import { payFromAccount, revertCashAccountsChange, upsert } from './dataHelpers'

const acc = (id: string, balance: number, name = id): CashAccount => ({ id, name, balance })

describe('payFromAccount', () => {
  it('takes the payment out of the chosen account only', () => {
    const out = payFromAccount([acc('a', 1000), acc('b', 500)], { accountId: 'a', amount: 250 })
    expect(out).toEqual([acc('a', 750), acc('b', 500)])
  })

  it('rounds to satang so float drift does not build up', () => {
    expect(payFromAccount([acc('a', 0.3)], { accountId: 'a', amount: 0.1 })[0].balance).toBe(0.2)
  })

  it('returns the same list when nothing was paid', () => {
    const list = [acc('a', 1)]
    expect(payFromAccount(list)).toBe(list)
  })
})

describe('upsert', () => {
  it('adds an item without an id and gives it one', () => {
    const out = upsert<CashAccount>([], { name: 'New', balance: 5 })
    expect(out).toHaveLength(1)
    expect(out[0].id).toBeTruthy()
  })

  it('merges into the item with the same id', () => {
    const out = upsert<CashAccount>([acc('a', 1, 'Old')], { id: 'a', name: 'Renamed', balance: 2 })
    expect(out).toEqual([acc('a', 2, 'Renamed')])
  })

  it('adds an item whose id is not in the list yet', () => {
    expect(upsert<CashAccount>([acc('a', 1)], { id: 'b', name: 'b', balance: 2 })).toHaveLength(2)
  })
})

describe('revertCashAccountsChange', () => {
  it('moves a balance back by the logged change, keeping later changes', () => {
    // The log moved 1000 → 800; since then another change took it to 700
    const out = revertCashAccountsChange([acc('a', 700)], [acc('a', 1000)], [acc('a', 800)])
    expect(out).toEqual([acc('a', 900)])
  })

  it('removes an account the logged change added', () => {
    expect(revertCashAccountsChange([acc('a', 1), acc('new', 5)], [acc('a', 1)], [acc('a', 1), acc('new', 5)])).toEqual([acc('a', 1)])
  })

  it('brings back an account the logged change deleted', () => {
    expect(revertCashAccountsChange([acc('a', 1)], [acc('a', 1), acc('gone', 9)], [acc('a', 1)])).toEqual([acc('a', 1), acc('gone', 9)])
  })

  it('restores a field the logged change edited', () => {
    expect(revertCashAccountsChange([acc('a', 1, 'New name')], [acc('a', 1, 'Old name')], [acc('a', 1, 'New name')])).toEqual([acc('a', 1, 'Old name')])
  })
})

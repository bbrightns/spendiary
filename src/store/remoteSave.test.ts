import { describe, expect, it } from 'vitest'
import { interpretSave, lockHeaders } from './remoteSave'
import { retryDelayMs, sameSavedData } from './remoteSave'

const stamp = '2026-10-17T11:33:54.329+00:00'

describe('interpretSave', () => {
  it('reads the new stamp from a successful update', () => {
    expect(interpretSave('update', { error: null, data: [{ updated_at: stamp }] })).toEqual({ kind: 'saved', updatedAt: stamp })
  })

  it('reports a conflict when the update matched no row', () => {
    expect(interpretSave('update', { error: null, data: [] })).toEqual({ kind: 'conflict' })
  })

  it('reports a conflict when another device created the row first', () => {
    expect(interpretSave('insert', { error: { code: '23505' }, data: null })).toEqual({ kind: 'conflict' })
  })

  it('passes other errors through', () => {
    const error = { code: '42501', message: 'permission denied' }
    expect(interpretSave('insert', { error, data: null })).toEqual({ kind: 'error', error })
    expect(interpretSave('update', { error, data: null })).toEqual({ kind: 'error', error })
  })

  it('never reports a conflict for a forced write', () => {
    expect(interpretSave('force', { error: null, data: [] })).toEqual({ kind: 'saved', updatedAt: null })
  })

  it('reads the stamp from a successful insert', () => {
    expect(interpretSave('insert', { error: null, data: [{ updated_at: stamp }] })).toEqual({ kind: 'saved', updatedAt: stamp })
  })

  it("reports a conflict when the database's write lock rejects a stale write", () => {
    const error = { code: '40001', message: 'user_data changed since it was loaded', hint: 'stale_write' }
    expect(interpretSave('update', { error, data: null })).toEqual({ kind: 'conflict' })
    expect(interpretSave('insert', { error, data: null })).toEqual({ kind: 'conflict' })
  })
})

describe('lockHeaders', () => {
  it('sends the loaded stamp with an update', () => {
    expect(lockHeaders('update', stamp)).toEqual({ 'x-spendiary-base-updated-at': stamp })
  })

  it('marks a restore as a deliberate overwrite', () => {
    expect(lockHeaders('force', stamp)).toEqual({ 'x-spendiary-force': '1' })
    expect(lockHeaders('force', null)).toEqual({ 'x-spendiary-force': '1' })
  })

  it('sends nothing to check for a new row, or a row that never had a stamp', () => {
    expect(lockHeaders('insert', null)).toEqual({})
    expect(lockHeaders('update', null)).toEqual({})
  })
})

describe('sameSavedData', () => {
  // The database stores the payload as jsonb, which reorders keys and drops nothing else
  it('ignores key order, at any depth', () => {
    const sent = { userName: 'A', cashAccounts: [{ id: 'k', name: 'KBank', balance: 10 }], lastUpdatedAt: 5 }
    const stored = { lastUpdatedAt: 5, cashAccounts: [{ balance: 10, name: 'KBank', id: 'k' }], userName: 'A' }
    expect(sameSavedData(sent, stored)).toBe(true)
  })

  it('treats a key set to undefined as absent, the way JSON does', () => {
    expect(sameSavedData({ a: 1, b: undefined }, { a: 1 })).toBe(true)
    expect(sameSavedData({ a: 1 }, { a: 1, b: undefined })).toBe(true)
  })

  it('sees any real difference', () => {
    const a = { userName: 'A', cashAccounts: [{ id: 'k', balance: 10 }], lastUpdatedAt: 5 }
    expect(sameSavedData(a, { ...a, lastUpdatedAt: 6 })).toBe(false)
    expect(sameSavedData(a, { ...a, cashAccounts: [{ id: 'k', balance: 10.01 }] })).toBe(false)
    expect(sameSavedData(a, { ...a, cashAccounts: [] })).toBe(false)
    expect(sameSavedData(a, { ...a, extra: null })).toBe(false)
    expect(sameSavedData({ list: [1, 2] }, { list: [2, 1] })).toBe(false)
    expect(sameSavedData({ list: [1, 2] }, { list: { 0: 1, 1: 2 } })).toBe(false)
    expect(sameSavedData({ a: null }, { a: {} })).toBe(false)
    expect(sameSavedData({ a: 0 }, { a: '0' })).toBe(false)
  })

  it('is false when either side is missing', () => {
    expect(sameSavedData(null, null)).toBe(false)
    expect(sameSavedData({ a: 1 }, null)).toBe(false)
    expect(sameSavedData(undefined, { a: 1 })).toBe(false)
  })
})

describe('retryDelayMs', () => {
  it('waits longer after each failure, up to a minute', () => {
    expect([1, 2, 3, 4, 5, 6, 50].map(retryDelayMs)).toEqual([5_000, 10_000, 20_000, 40_000, 60_000, 60_000, 60_000])
  })
})

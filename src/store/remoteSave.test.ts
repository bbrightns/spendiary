import { describe, expect, it } from 'vitest'
import { interpretSave, lockHeaders } from './remoteSave'

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

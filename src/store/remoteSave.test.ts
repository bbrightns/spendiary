import { describe, expect, it } from 'vitest'
import { interpretSave } from './remoteSave'

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
})

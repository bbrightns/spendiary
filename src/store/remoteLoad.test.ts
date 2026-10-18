import { describe, expect, it } from 'vitest'
import { resolveRemoteLoad } from './remoteLoad'

const payload = { holdings: [{ id: 'h1' }] }
const updated_at = '2026-10-17T11:33:54.329+00:00'
const networkError = new Error('Failed to fetch')

describe('resolveRemoteLoad', () => {
  it('uses the row when the query succeeds', () => {
    expect(resolveRemoteLoad({ error: null, row: { payload, updated_at }, asUser: true })).toEqual({ kind: 'loaded', payload, updatedAt: updated_at })
  })

  it('keeps a missing version stamp as null', () => {
    expect(resolveRemoteLoad({ error: null, row: { payload }, asUser: true })).toEqual({ kind: 'loaded', payload, updatedAt: null })
  })

  it('treats no row, asked as the user, as a new user', () => {
    expect(resolveRemoteLoad({ error: null, row: null, asUser: true })).toEqual({ kind: 'empty' })
  })

  it('does not trust no row when asked without the user session', () => {
    // Row-level security hides the row from a signed-out request, which looks the same as "no row"
    expect(resolveRemoteLoad({ error: null, row: null, asUser: false })).toEqual({ kind: 'failed' })
  })

  it('treats a row without a payload as no row', () => {
    expect(resolveRemoteLoad({ error: null, row: { updated_at }, asUser: false })).toEqual({ kind: 'failed' })
    expect(resolveRemoteLoad({ error: null, row: { updated_at }, asUser: true })).toEqual({ kind: 'empty' })
  })

  it('fails when the query errors', () => {
    expect(resolveRemoteLoad({ error: networkError, row: null, asUser: true })).toEqual({ kind: 'failed' })
    expect(resolveRemoteLoad({ error: networkError, row: { payload, updated_at }, asUser: true })).toEqual({ kind: 'failed' })
  })
})

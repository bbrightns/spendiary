import { describe, expect, it } from 'vitest'
import { resolveRemoteLoad } from './remoteLoad'

const payload = { holdings: [{ id: 'h1' }] }
const updated_at = '2026-10-17T11:33:54.329+00:00'
const networkError = new Error('Failed to fetch')

describe('resolveRemoteLoad', () => {
  it('uses the client row when the query succeeds', () => {
    expect(resolveRemoteLoad({ error: null, row: { payload, updated_at } }, null)).toEqual({ kind: 'loaded', payload, updatedAt: updated_at })
  })

  it('keeps a missing version stamp as null', () => {
    expect(resolveRemoteLoad({ error: null, row: { payload } }, null)).toEqual({ kind: 'loaded', payload, updatedAt: null })
  })

  it('treats a successful query with no row as a new user', () => {
    expect(resolveRemoteLoad({ error: null, row: null }, null)).toEqual({ kind: 'empty' })
  })

  it('falls back to the REST row when the client fails', () => {
    const rest = { ok: true, list: [{ payload, updated_at }], usedUserToken: true }
    expect(resolveRemoteLoad({ error: networkError, row: null }, rest)).toEqual({ kind: 'loaded', payload, updatedAt: updated_at })
  })

  it('trusts an empty REST answer asked with the user token', () => {
    const rest = { ok: true, list: [], usedUserToken: true }
    expect(resolveRemoteLoad({ error: networkError, row: null }, rest)).toEqual({ kind: 'empty' })
  })

  it('does not trust an empty REST answer asked with the anon key', () => {
    const rest = { ok: true, list: [], usedUserToken: false }
    expect(resolveRemoteLoad({ error: networkError, row: null }, rest)).toEqual({ kind: 'failed' })
  })

  it('fails when the client errors and REST is not ok', () => {
    const rest = { ok: false, list: null, usedUserToken: true }
    expect(resolveRemoteLoad({ error: networkError, row: null }, rest)).toEqual({ kind: 'failed' })
  })

  it('fails when the client errors and REST never answered', () => {
    expect(resolveRemoteLoad({ error: networkError, row: null }, null)).toEqual({ kind: 'failed' })
  })

  it('fails when REST returns something that is not a list', () => {
    const rest = { ok: true, list: { message: 'oops' }, usedUserToken: true }
    expect(resolveRemoteLoad({ error: networkError, row: null }, rest)).toEqual({ kind: 'failed' })
  })
})

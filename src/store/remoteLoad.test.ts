import { describe, expect, it } from 'vitest'
import { resolveRemoteLoad } from './remoteLoad'

const payload = { holdings: [{ id: 'h1' }] }
const networkError = new Error('Failed to fetch')

describe('resolveRemoteLoad', () => {
  it('uses the client payload when the query succeeds', () => {
    expect(resolveRemoteLoad({ error: null, payload }, null)).toEqual({ kind: 'loaded', payload })
  })

  it('treats a successful query with no row as a new user', () => {
    expect(resolveRemoteLoad({ error: null, payload: null }, null)).toEqual({ kind: 'empty' })
  })

  it('falls back to the REST payload when the client fails', () => {
    const rest = { ok: true, list: [{ payload }], usedUserToken: true }
    expect(resolveRemoteLoad({ error: networkError, payload: null }, rest)).toEqual({ kind: 'loaded', payload })
  })

  it('trusts an empty REST answer asked with the user token', () => {
    const rest = { ok: true, list: [], usedUserToken: true }
    expect(resolveRemoteLoad({ error: networkError, payload: null }, rest)).toEqual({ kind: 'empty' })
  })

  it('does not trust an empty REST answer asked with the anon key', () => {
    const rest = { ok: true, list: [], usedUserToken: false }
    expect(resolveRemoteLoad({ error: networkError, payload: null }, rest)).toEqual({ kind: 'failed' })
  })

  it('fails when the client errors and REST is not ok', () => {
    const rest = { ok: false, list: null, usedUserToken: true }
    expect(resolveRemoteLoad({ error: networkError, payload: null }, rest)).toEqual({ kind: 'failed' })
  })

  it('fails when the client errors and REST never answered', () => {
    expect(resolveRemoteLoad({ error: networkError, payload: null }, null)).toEqual({ kind: 'failed' })
  })

  it('fails when REST returns something that is not a list', () => {
    const rest = { ok: true, list: { message: 'oops' }, usedUserToken: true }
    expect(resolveRemoteLoad({ error: networkError, payload: null }, rest)).toEqual({ kind: 'failed' })
  })
})

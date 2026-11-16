/**
 * A pretend Supabase for Playwright: one `user_data` row kept in memory, served through page.route().
 * It never talks to the real database (AGENTS.md: "Simulate Supabase with Playwright route()").
 * The row behaves like the real one with supabase/sql/user_data_write_lock.sql applied:
 * the server stamps `updated_at`, and an update whose stamp no longer matches writes nothing.
 */
export const SIM_URL = 'https://sim-project.supabase.co'
export const USER_ID = '00000000-0000-4000-8000-000000000001'

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')

/** A signed-in session as supabase-js keeps it in localStorage */
export function sessionEntry() {
  const exp = Math.floor(Date.now() / 1000) + 3600
  const user = { id: USER_ID, aud: 'authenticated', role: 'authenticated', email: 'sim@example.com', app_metadata: { provider: 'google' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
  const access_token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER_ID, role: 'authenticated', exp, aud: 'authenticated' })}.sim`
  return { key: 'sb-sim-project-auth-token', value: JSON.stringify({ access_token, refresh_token: 'sim-refresh', token_type: 'bearer', expires_in: 3600, expires_at: exp, user }) }
}

export class SupabaseSim {
  constructor(payload = null) {
    this.tick = 0
    this.row = payload ? { payload, updated_at: this.stamp() } : null
    /** Every write that reached the "server": { method, committed, payload } */
    this.writes = []
    this.reads = 0
    /** What to do with the next writes, first in first out: 'fail' (never arrives), 'lost' (saved, answer lost), 'ok' */
    this.plan = []
    /** Milliseconds each write waits before it is handled */
    this.delay = 0
  }

  stamp() {
    this.tick += 1
    return `2026-11-16T10:00:00.${String(this.tick).padStart(6, '0')}+00:00`
  }

  /** Another device saved */
  writeElsewhere(payload) {
    this.row = { payload, updated_at: this.stamp() }
  }

  async install(context) {
    const user = JSON.parse(sessionEntry().value).user
    await context.route(`${SIM_URL}/auth/v1/**`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) }))
    await context.route(`${SIM_URL}/functions/v1/**`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
    await context.route(`${SIM_URL}/rest/v1/user_data**`, (route) => this.handle(route))
    // Price feeds: not part of this test
    await context.route(/binance|version\.json/, (route) => route.abort())
  }

  async handle(route) {
    const req = route.request()
    const method = req.method()
    const url = new URL(req.url())
    const headers = req.headers()
    const json = (status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': '*' }, body: JSON.stringify(body) })
    if (method === 'OPTIONS') {
      return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } })
    }
    if (method === 'GET') {
      this.reads += 1
      const one = (headers.accept ?? '').includes('vnd.pgrst.object')
      const rows = this.row ? [this.row] : []
      if (!one) return json(200, rows)
      if (rows.length === 0) return json(406, { code: 'PGRST116', details: 'The result contains 0 rows', hint: null, message: 'JSON object requested, multiple (or no) rows returned' })
      return json(200, rows[0])
    }
    if (this.delay) await new Promise((r) => setTimeout(r, this.delay))
    const step = this.plan.shift() ?? 'ok'
    const body = req.postDataJSON()
    if (step === 'fail') {
      this.writes.push({ method, committed: false, payload: body.payload })
      return route.abort('internetdisconnected')
    }
    let committed = false
    let response
    if (method === 'DELETE') {
      this.row = null
      committed = true
      response = () => json(200, [])
    } else if (method === 'PATCH') {
      const want = url.searchParams.get('updated_at') ?? ''
      const matches = this.row && (want === `eq.${this.row.updated_at}` || (want === 'is.null' && this.row.updated_at === null))
      if (matches) {
        this.row = { payload: body.payload, updated_at: this.stamp() }
        committed = true
      }
      const out = matches ? [{ updated_at: this.row.updated_at }] : []
      response = () => json(200, out)
    } else if (method === 'POST') {
      const upsert = (headers.prefer ?? '').includes('resolution=merge-duplicates')
      if (this.row && !upsert) {
        response = () => json(409, { code: '23505', message: 'duplicate key value violates unique constraint "user_data_pkey"', details: null, hint: null })
      } else {
        this.row = { payload: body.payload, updated_at: this.stamp() }
        committed = true
        const out = [{ updated_at: this.row.updated_at }]
        response = () => json(201, out)
      }
    } else {
      return route.abort()
    }
    this.writes.push({ method, committed, payload: body?.payload })
    if (step === 'lost') return route.abort('internetdisconnected')
    return response()
  }
}

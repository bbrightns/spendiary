export interface Env {
  DB: D1Database
  AUTH_TOKEN: string
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

function isAuthorized(req: Request, env: Env): boolean {
  return req.headers.get('Authorization') === `Bearer ${env.AUTH_TOKEN}`
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(req.url)

    // CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS })
    }

    if (pathname !== '/api/data') {
      return json({ error: 'Not found' }, 404)
    }

    if (!isAuthorized(req, env)) {
      return json({ error: 'Unauthorized' }, 401)
    }

    // ── GET: return stored data ──────────────────────────────────
    if (req.method === 'GET') {
      const row = await env.DB
        .prepare('SELECT payload FROM app_data WHERE id = ?')
        .bind('main')
        .first<{ payload: string }>()

      if (!row) return json(null, 404)

      // Return raw payload (already JSON) without double-encoding
      return new Response(row.payload, {
        headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    // ── PUT: save data ───────────────────────────────────────────
    if (req.method === 'PUT') {
      const body = await req.text()

      // Basic sanity check — must be valid JSON object
      let parsed: unknown
      try {
        parsed = JSON.parse(body)
      } catch {
        return json({ error: 'Invalid JSON' }, 400)
      }
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return json({ error: 'Payload must be a JSON object' }, 400)
      }

      await env.DB
        .prepare(`
          INSERT INTO app_data (id, payload, updated_at)
          VALUES (?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            payload    = excluded.payload,
            updated_at = excluded.updated_at
        `)
        .bind('main', body, Date.now())
        .run()

      return json({ ok: true })
    }

    return json({ error: 'Method not allowed' }, 405)
  },
}

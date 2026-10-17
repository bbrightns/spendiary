/**
 * Decides what the first cloud load actually told us.
 *
 * The danger this guards against: treating "the load failed" as "this user has no data".
 * If we do that, the app starts from empty data and the next save overwrites the real row.
 * So we only report `empty` when a source positively confirmed there is no row.
 */
export type RemoteLoadResult =
  /** `updatedAt` is the row's version stamp; the next save only succeeds if it is still current */
  | { kind: 'loaded'; payload: unknown; updatedAt: string | null }
  /** Confirmed: no row exists yet, so this is a new user */
  | { kind: 'empty' }
  /** Not sure what is in the cloud, so saving must stay off */
  | { kind: 'failed' }

/** A `user_data` row as selected (`payload, updated_at`) */
interface RemoteRow {
  payload?: unknown
  updated_at?: unknown
}

/** What the supabase-js query returned */
export interface ClientLoad {
  error: unknown
  row: RemoteRow | null | undefined
}

/** What the REST fallback returned; null when it was not tried or threw */
export interface RestLoad {
  ok: boolean
  list: unknown
  /** False when no user access token was found and the public anon key was sent instead */
  usedUserToken: boolean
}

function loadedFrom(row: unknown): RemoteLoadResult | null {
  if (!row || typeof row !== 'object') return null
  const { payload, updated_at } = row as RemoteRow
  if (!payload) return null
  return { kind: 'loaded', payload, updatedAt: typeof updated_at === 'string' ? updated_at : null }
}

export function resolveRemoteLoad(client: ClientLoad, rest: RestLoad | null): RemoteLoadResult {
  if (!client.error) {
    const fromClient = loadedFrom(client.row)
    if (fromClient) return fromClient
  }

  const fromRest = rest?.ok && Array.isArray(rest.list) ? loadedFrom(rest.list[0]) : null
  if (fromRest) return fromRest

  // The client query ran without error and found no row: a new user
  if (!client.error) return { kind: 'empty' }

  // An empty REST answer only counts when it was asked as the user.
  // With the anon key, row-level security hides the row and also returns [].
  if (rest?.ok && Array.isArray(rest.list) && rest.list.length === 0 && rest.usedUserToken) {
    return { kind: 'empty' }
  }

  return { kind: 'failed' }
}

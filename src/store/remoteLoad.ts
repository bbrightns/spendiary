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
  /** True when the query was sent with this user's session; without one, row-level security hides the row */
  asUser: boolean
}

function loadedFrom(row: unknown): RemoteLoadResult | null {
  if (!row || typeof row !== 'object') return null
  const { payload, updated_at } = row as RemoteRow
  if (!payload) return null
  return { kind: 'loaded', payload, updatedAt: typeof updated_at === 'string' ? updated_at : null }
}

export function resolveRemoteLoad(client: ClientLoad): RemoteLoadResult {
  if (client.error) return { kind: 'failed' }
  const loaded = loadedFrom(client.row)
  if (loaded) return loaded
  // No row: a new user, but only if the database was asked as that user
  return client.asUser ? { kind: 'empty' } : { kind: 'failed' }
}

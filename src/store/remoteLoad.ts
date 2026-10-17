/**
 * Decides what the first cloud load actually told us.
 *
 * The danger this guards against: treating "the load failed" as "this user has no data".
 * If we do that, the app starts from empty data and the next save overwrites the real row.
 * So we only report `empty` when a source positively confirmed there is no row.
 */
export type RemoteLoadResult =
  | { kind: 'loaded'; payload: unknown }
  /** Confirmed: no row exists yet, so this is a new user */
  | { kind: 'empty' }
  /** Not sure what is in the cloud, so saving must stay off */
  | { kind: 'failed' }

/** What the supabase-js query returned */
export interface ClientLoad {
  error: unknown
  payload: unknown
}

/** What the REST fallback returned; null when it was not tried or threw */
export interface RestLoad {
  ok: boolean
  list: unknown
  /** False when no user access token was found and the public anon key was sent instead */
  usedUserToken: boolean
}

export function resolveRemoteLoad(client: ClientLoad, rest: RestLoad | null): RemoteLoadResult {
  if (!client.error && client.payload) return { kind: 'loaded', payload: client.payload }

  const restRow = rest?.ok && Array.isArray(rest.list) ? rest.list[0] : undefined
  if (restRow && typeof restRow === 'object' && 'payload' in restRow && restRow.payload) {
    return { kind: 'loaded', payload: restRow.payload }
  }

  // The client query ran without error and found no row: a new user
  if (!client.error) return { kind: 'empty' }

  // An empty REST answer only counts when it was asked as the user.
  // With the anon key, row-level security hides the row and also returns [].
  if (rest?.ok && Array.isArray(rest.list) && rest.list.length === 0 && rest.usedUserToken) {
    return { kind: 'empty' }
  }

  return { kind: 'failed' }
}

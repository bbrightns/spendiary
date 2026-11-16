/**
 * Cloud saves use an optimistic lock on `updated_at`.
 *
 * Each device remembers the version stamp it last loaded or saved. A save only goes through
 * if the row still carries that stamp. If another tab or device saved in between, the row
 * has a newer stamp, nothing is written, and we report a conflict instead of overwriting it.
 */
export type SaveMode =
  /** The row exists: update it only if its stamp still matches ours */
  | 'update'
  /** No row yet: create it, failing if another device created it first */
  | 'insert'
  /** The user chose to replace the cloud data (restore from backup): write unconditionally */
  | 'force'

export type SaveOutcome =
  | { kind: 'saved'; updatedAt: string | null }
  | { kind: 'conflict' }
  | { kind: 'error'; error: unknown }

/** Postgres "unique_violation": the row we tried to insert already exists */
const UNIQUE_VIOLATION = '23505'
/** Raised by the database's write lock (supabase/sql/user_data_write_lock.sql) when the row moved on */
const STALE_WRITE = '40001'
const errorCode = (error: unknown) => (error as { code?: unknown } | null)?.code

/**
 * Request headers the database's write lock reads: the stamp this device loaded, or that a restore
 * replaces the data on purpose. A new row has nothing to check against. Headers belong to one
 * request, and the database ignores them until its SQL is run.
 */
export function lockHeaders(mode: SaveMode, loadedStamp: string | null): Record<string, string> {
  if (mode === 'force') return { 'x-spendiary-force': '1' }
  if (mode === 'update' && loadedStamp) return { 'x-spendiary-base-updated-at': loadedStamp }
  return {}
}

export function interpretSave(mode: SaveMode, res: { error: unknown; data?: unknown }): SaveOutcome {
  if (res.error) {
    const code = errorCode(res.error)
    if (mode === 'insert' && code === UNIQUE_VIOLATION) return { kind: 'conflict' }
    if (mode !== 'force' && code === STALE_WRITE) return { kind: 'conflict' }
    return { kind: 'error', error: res.error }
  }
  const rows = Array.isArray(res.data) ? res.data : []
  // A conditional update that matched no row means the stamp moved on: someone else saved
  if (mode === 'update' && rows.length === 0) return { kind: 'conflict' }
  const stamp = (rows[0] as { updated_at?: unknown } | undefined)?.updated_at
  return { kind: 'saved', updatedAt: typeof stamp === 'string' ? stamp : null }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

/**
 * True when two payloads are the same saved data. The database keeps the payload as jsonb, which
 * reorders keys, so text can't be compared; and JSON drops keys set to undefined.
 * Used to recognise our own save in the cloud after its answer was lost on the way back.
 */
export function sameSavedData(a: unknown, b: unknown): boolean {
  if (!isObject(a) || !isObject(b)) return false
  return sameJson(a, b)
}

function sameJson(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (!isObject(a) || !isObject(b)) return false
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((entry, i) => sameJson(entry ?? null, b[i] ?? null))
  }
  const keys = (o: Record<string, unknown>) => Object.keys(o).filter((k) => o[k] !== undefined)
  const aKeys = keys(a)
  if (aKeys.length !== keys(b).length) return false
  return aKeys.every((k) => b[k] !== undefined && sameJson(a[k], b[k]))
}

/** How long to wait before trying a failed save again: 5 s, doubling, at most a minute */
export function retryDelayMs(failures: number): number {
  return Math.min(60_000, 5_000 * 2 ** Math.max(0, Math.min(failures, 10) - 1))
}

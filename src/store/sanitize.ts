/**
 * Saved data is one JSON blob that older versions, backups and hand edits have all written to. A list
 * holding `null` (or a number where a holding should be) used to make migrate() throw, and a payload that
 * can't be migrated locks its owner out of the app. This pass runs first and removes only what no code
 * can read:
 * - `null` entries in any list, at any depth (no list in the model holds nulls)
 * - anything that isn't an object in the top-level lists of records
 * - a top-level list of records saved as something that isn't a list (migrate then fills in the default)
 * Valid entries are never touched, and a value with nothing to drop is returned as the same object.
 */

/** Top-level lists whose entries are records (objects) */
const RECORD_LISTS = [
  'cashAccounts',
  'fixedCostItems',
  'netWorthHistory',
  'portfolioHistory',
  'holdings',
  'holdingLogs',
  'dcaPlans',
  'transfers',
  'plannedAssets',
  'dividendRecords',
  'liabilities',
  'spendTransactions',
  'spendCards',
  'spendRecurring',
  'spendGoals',
  'fxExchanges',
] as const

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

type Dropped = Map<string, number>

function clean(value: unknown, path: string, recordsOnly: boolean, dropped: Dropped): unknown {
  if (Array.isArray(value)) {
    let changed = false
    const out: unknown[] = []
    for (const entry of value) {
      if (entry === null || entry === undefined || (recordsOnly && !isRecord(entry))) {
        dropped.set(path, (dropped.get(path) ?? 0) + 1)
        changed = true
        continue
      }
      const cleaned = clean(entry, path, false, dropped)
      if (!Object.is(cleaned, entry)) changed = true
      out.push(cleaned)
    }
    return changed ? out : value
  }
  if (isRecord(value)) {
    let out: Record<string, unknown> | null = null
    for (const key of Object.keys(value)) {
      const cleaned = clean(value[key], path ? `${path}.${key}` : key, false, dropped)
      if (!Object.is(cleaned, value[key])) {
        out ??= { ...value }
        out[key] = cleaned
      }
    }
    return out ?? value
  }
  return value
}

/** Returns the data without its unreadable list entries, and what was dropped as `path: count` */
export function dropInvalidEntries<T extends object>(data: T): { data: T; dropped: string[] } {
  const dropped: Dropped = new Map()
  let out = data as Record<string, unknown>
  const set = (key: string, value: unknown) => {
    if (out === data) out = { ...out }
    if (value === undefined) delete out[key]
    else out[key] = value
  }
  for (const key of Object.keys(data)) {
    const value = (data as Record<string, unknown>)[key]
    const isList = (RECORD_LISTS as readonly string[]).includes(key)
    if (isList && value !== undefined && value !== null && !Array.isArray(value)) {
      dropped.set(`${key} (not a list)`, 1)
      set(key, undefined)
      continue
    }
    const cleaned = clean(value, key, isList, dropped)
    if (!Object.is(cleaned, value)) set(key, cleaned)
  }
  return { data: out as T, dropped: [...dropped].map(([path, count]) => `${path}: ${count}`) }
}

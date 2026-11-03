import type { Holding, HoldingLog } from '../../lib/types'
import { qtyEpsilon, roundQty } from '../../lib/locations'
import { roundMoney } from '../../lib/money'

/**
 * Undoing an edit of a holding, field by field, so changes made after the edit survive:
 * - amounts (units, money put in) go back by how much the edit changed them, so later buys and sells stay;
 * - every other field goes back only while it still holds the value the edit gave it.
 */

/** One field the edit changed: [value before, value after] */
export type FieldChanges = Record<string, [before: unknown, after: unknown]>

/** Amounts: undone by their change, not by the old value */
const AMOUNT_FIELDS = ['units', 'totalUnits', 'totalThbInvested', 'totalUsdInvested'] as const
/** Follow from the amounts once those change */
const AVERAGE_FIELDS = ['avgCost', 'avgCostThb', 'avgCostUsd']
/** Never part of an edit: identity, bookkeeping, and locations (they change only through buy, sell and move) */
const IGNORED = new Set(['id', 'updatedAt', 'locations'])

/** Names people know, for the "kept because it changed again" message */
const LABELS: Record<string, string> = {
  name: 'name', ticker: 'ticker', tag: 'tag', price: 'price', placeholderPrice: 'price',
  avgCost: 'average cost', avgCostThb: 'average cost', avgCostUsd: 'average cost',
  paysDividend: 'dividend settings', expectedDps: 'dividend settings', dividendMonths: 'dividend settings',
  dividendPayouts: 'dividend settings', defaultCashAccountId: 'dividend settings', isLocked: 'lock',
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/** The fields an edit changed, from its before / after snapshots */
export function diffHolding(before: Holding, after: Holding): FieldChanges {
  const b = before as unknown as Record<string, unknown>
  const a = after as unknown as Record<string, unknown>
  const out: FieldChanges = {}
  for (const key of new Set([...Object.keys(b), ...Object.keys(a)])) {
    if (IGNORED.has(key) || same(b[key], a[key])) continue
    out[key] = [b[key], a[key]]
  }
  return out
}

/** What an edit log changed: saved with the log, or worked out from its snapshots (older logs) */
export function editChanges(log: HoldingLog): FieldChanges | null {
  if (log.changes) return log.changes
  if (log.previousHoldingState && log.afterHoldingState) return diffHolding(log.previousHoldingState, log.afterHoldingState)
  return null
}

export type EditUndoPlan =
  | { ok: true; holding: Holding; kept: string[] }
  | { ok: false; reason: string }

/** The holding after undoing this edit, or why it can't be undone */
export function planEditUndo(current: Holding | undefined, log: HoldingLog): EditUndoPlan {
  if (!current) return { ok: false, reason: `"${log.holdingName}" is no longer in your portfolio, so this edit can't be undone.` }
  const changes = editChanges(log)
  // Very old logs kept only the "before" snapshot: restoring it is all that can be done
  if (!changes) {
    return log.previousHoldingState
      ? { ok: true, holding: log.previousHoldingState, kept: [] }
      : { ok: false, reason: 'This edit has no saved details to undo.' }
  }

  const next = { ...current } as unknown as Record<string, unknown>
  const kept = new Set<string>()
  const ac = current.assetClass

  // 1. Amounts go back by the edit's change
  let amountsChanged = false
  for (const key of AMOUNT_FIELDS) {
    const change = changes[key]
    if (!change) continue
    const delta = (Number(change[0]) || 0) - (Number(change[1]) || 0)
    if (delta === 0) continue
    const value = (Number(next[key]) || 0) + delta
    next[key] = key === 'totalThbInvested' ? roundMoney(value) : key === 'totalUsdInvested' ? value : roundQty(ac, value)
    amountsChanged = true
  }
  if (amountsChanged) {
    const units = Number(next.units) || 0
    if (units < -qtyEpsilon(ac)) {
      return { ok: false, reason: `Undoing this edit would leave ${log.holdingName} below zero, because some of it was sold after the edit.` }
    }
    if ((current.locations?.length ?? 0) > 0) {
      return { ok: false, reason: `${log.holdingName} is now split across locations, so its units can only change with Buy, Sell or Move.` }
    }
  }

  // 2. Every other field goes back while it still holds the edited value
  for (const [key, [before, after]] of Object.entries(changes)) {
    if ((AMOUNT_FIELDS as readonly string[]).includes(key)) continue
    if (amountsChanged && AVERAGE_FIELDS.includes(key)) continue
    if (!same(next[key], after)) {
      kept.add(LABELS[key] ?? key)
      continue
    }
    if (before === undefined) delete next[key]
    else next[key] = before
  }

  // 3. Averages follow the amounts
  if (amountsChanged) {
    const units = Number(next.units) || 0
    const thb = Number(next.totalThbInvested) || 0
    if (units > 0) {
      next.avgCost = thb / units
      next.avgCostThb = thb / units
      if (typeof next.totalUsdInvested === 'number') next.avgCostUsd = next.totalUsdInvested / units
    }
  }

  return { ok: true, holding: next as unknown as Holding, kept: [...kept] }
}

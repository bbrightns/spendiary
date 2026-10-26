import type { RemovedAccount, SpendRecurring, SpendTransaction, SpendiaryData } from '../../lib/types'
import { roundMoney } from '../../lib/money'
import { moneyDeltas } from './logic'

/** Wallet and card ids a recurring item moves money through. */
export function recurringAccountIds(r: Pick<SpendRecurring, 'type' | 'accountId' | 'toAccountId'>): string[] {
  const ids = [r.accountId, r.type === 'transfer' ? r.toAccountId : undefined]
  return ids.filter((id): id is string => !!id)
}

export interface RecurringUse {
  rec: SpendRecurring
  /** How the item uses the account, e.g. "pays from it" */
  role: string
}

/** Recurring items that use this wallet or card, with how they use it. */
export function recurringUsing(list: SpendRecurring[], accountId: string): RecurringUse[] {
  const out: RecurringUse[] = []
  for (const rec of list) {
    const from = rec.accountId === accountId
    const to = rec.type === 'transfer' && rec.toAccountId === accountId
    if (!from && !to) continue
    const role =
      rec.type === 'transfer' ? (from && to ? 'transfers from and to it' : from ? 'transfers from it' : 'transfers into it') : rec.type === 'income' ? 'is paid into it' : 'pays from it'
    out.push({ rec, role })
  }
  return out
}

export interface OtherUse {
  id: string
  /** e.g. "DCA · S&P 500" */
  label: string
  role: string
}

/**
 * DCA plans, loans and holdings that point at this account. They aren't paused: each one
 * asks for another account the next time it's used (a savings deposit can't be logged until then).
 */
export function otherUsing(d: Pick<SpendiaryData, 'dcaPlans' | 'liabilities' | 'holdings'>, accountId: string): OtherUse[] {
  const out: OtherUse[] = []
  for (const p of d.dcaPlans ?? []) {
    if (p.cashAccountId === accountId) out.push({ id: `dca-in-${p.id}`, label: `DCA · ${p.name}`, role: 'deposits into it' })
    if (p.payFromAccountId === accountId) out.push({ id: `dca-from-${p.id}`, label: `DCA · ${p.name}`, role: 'pays from it' })
  }
  for (const l of d.liabilities ?? []) if (l.payFromId === accountId) out.push({ id: `loan-${l.id}`, label: l.name, role: 'paid from it' })
  for (const h of d.holdings ?? []) if (h.defaultCashAccountId === accountId) out.push({ id: `div-${h.id}`, label: h.name, role: 'dividends go into it' })
  return out
}

/** Ids of every wallet and card that exists. */
export function liveAccountIds(d: Pick<SpendiaryData, 'cashAccounts' | 'spendCards'>): Set<string> {
  return new Set([...(d.cashAccounts ?? []).map((a) => a.id), ...(d.spendCards ?? []).map((c) => c.id)])
}

/** Ids this item uses that no longer exist. */
export function missingAccountIds(r: SpendRecurring, live: Set<string>): string[] {
  return recurringAccountIds(r).filter((id) => !live.has(id))
}

/**
 * Pauses recurring items whose wallet or card is gone, so they can't log money into nowhere,
 * and resumes the ones paused that way once every account they use is back (e.g. after an undo).
 * An item the user paused stays as it is. Returns the same array when nothing changes.
 */
export function syncRecurringAccounts(list: SpendRecurring[], live: Set<string>): SpendRecurring[] {
  let changed = false
  const next = list.map((r) => {
    const missing = missingAccountIds(r, live).length > 0
    if (missing && !r.paused) {
      changed = true
      return { ...r, paused: true, pausedReason: 'accountRemoved' as const }
    }
    if (!missing && r.pausedReason === 'accountRemoved') {
      changed = true
      const rest = { ...r }
      delete rest.paused
      delete rest.pausedReason
      return rest
    }
    return r
  })
  return changed ? next : list
}

/**
 * Run after any data change. When wallets or cards went away: remember their names (past
 * transactions keep showing them), drop them from Quick add's default and favorites, and pause
 * the recurring items that use them. When they come back: forget the saved name and resume.
 * Returns `next` untouched when no account was added or removed.
 */
export function reconcileAccounts(prev: SpendiaryData, next: SpendiaryData): SpendiaryData {
  if (prev.cashAccounts === next.cashAccounts && prev.spendCards === next.spendCards) return next
  const names = new Map<string, string>()
  for (const a of prev.cashAccounts ?? []) names.set(a.id, a.name)
  for (const c of prev.spendCards ?? []) names.set(c.id, c.name)
  const live = liveAccountIds(next)
  const removed = [...names.keys()].filter((id) => !live.has(id))
  const st = next.spendSettings ?? {}
  const back = Object.keys(st.removedAccounts ?? {}).filter((id) => live.has(id))

  let out = next
  if (removed.length > 0 || back.length > 0) {
    const now = new Date().toISOString()
    const removedAccounts = { ...st.removedAccounts }
    for (const id of back) delete removedAccounts[id]
    for (const id of removed) removedAccounts[id] = { name: names.get(id)!, removedAt: now }
    const gone = new Set(removed)
    // Transactions of a deleted account edited while it was gone: their money lands now it's back
    const pending = new Map(back.map((id) => [id, st.removedAccounts?.[id]?.pending ?? 0]).filter(([, v]) => v !== 0) as [string, number][])
    if (pending.size > 0) {
      out = {
        ...out,
        cashAccounts: (out.cashAccounts ?? []).map((a) => (pending.has(a.id) ? { ...a, balance: roundMoney(a.balance + pending.get(a.id)!) } : a)),
        spendCards: out.spendCards?.map((c) => (pending.has(c.id) ? { ...c, balance: roundMoney(c.balance - pending.get(c.id)!) } : c)),
      }
    }
    out = {
      ...out,
      spendSettings: {
        ...st,
        removedAccounts,
        defaultAccountId: st.defaultAccountId && gone.has(st.defaultAccountId) ? undefined : st.defaultAccountId,
        favoriteAccountIds: st.favoriteAccountIds?.filter((id) => !gone.has(id)),
      },
    }
  }
  const list = out.spendRecurring ?? []
  const synced = syncRecurringAccounts(list, live)
  return synced === list ? out : { ...out, spendRecurring: synced }
}

/**
 * A transaction added (sign 1) or taken back (−1) that touches deleted accounts: keeps the money it
 * would have moved on them, so an undo of the delete brings the right balance back.
 * Returns the same object when it touches none.
 */
export function trackRemovedMoves(
  removed: Record<string, RemovedAccount> | undefined,
  txn: Pick<SpendTransaction, 'type' | 'amount' | 'accountId' | 'toAccountId' | 'alreadyInBalance'>,
  sign: 1 | -1,
): Record<string, RemovedAccount> | undefined {
  if (!removed) return removed
  let out = removed
  for (const [id, delta] of moneyDeltas(txn)) {
    const r = out[id]
    if (!r) continue
    if (out === removed) out = { ...removed }
    out[id] = { ...r, pending: roundMoney((r.pending ?? 0) + delta * sign) || undefined }
  }
  return out
}

/** A wallet or card name for a transaction row, falling back to the name it had when it was deleted. */
export function accountLabel(id: string | undefined, liveName: string | undefined, removed: Record<string, { name: string }> | undefined): string | undefined {
  if (!id) return undefined
  if (liveName) return liveName
  const gone = removed?.[id]?.name
  return gone ? `${gone} (deleted)` : undefined
}

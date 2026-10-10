import type { CashAccount, SpendTransaction } from '../../lib/types'
import { localDateStr } from '../../lib/format'

/** Letters, digits and combining marks so Thai tags like #ร้านโปรด stay whole. */
const TAG_RE = /#([\p{L}\p{N}\p{M}_]+)/gu

/** Unique lowercase hashtags in a note, without the leading #. */
export function parseTags(note?: string): string[] {
  if (!note) return []
  const found = new Set<string>()
  for (const m of note.matchAll(TAG_RE)) found.add(m[1].toLowerCase())
  return [...found]
}

/** Wallets the Spend module works with (amounts are THB only for now). */
export function spendWallets(accounts: CashAccount[]): CashAccount[] {
  return accounts.filter((a) => (a.currency ?? 'THB') === 'THB')
}

/**
 * Apply (sign = 1) or reverse (sign = -1) a transaction's effect on wallet balances.
 * Wallets that no longer exist are skipped.
 */
export function applyToWallets(accounts: CashAccount[], txn: SpendTransaction, sign: 1 | -1): CashAccount[] {
  const deltas = new Map<string, number>()
  const add = (id: string | undefined, v: number) => {
    if (!id) return
    deltas.set(id, (deltas.get(id) ?? 0) + v)
  }
  if (txn.type === 'expense') add(txn.accountId, -txn.amount)
  else if (txn.type === 'income') add(txn.accountId, txn.amount)
  else {
    add(txn.accountId, -txn.amount)
    add(txn.toAccountId, txn.amount)
  }
  if (deltas.size === 0) return accounts
  return accounts.map((a) => {
    const d = deltas.get(a.id)
    return d ? { ...a, balance: Math.round((a.balance + d * sign) * 100) / 100 } : a
  })
}

/** "YYYY-MM" key for a date string or Date. */
export function monthKey(d: string | Date = new Date()): string {
  return (typeof d === 'string' ? d : localDateStr(d)).slice(0, 7)
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return monthKey(d)
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

export function daysInMonth(key: string): number {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

export interface MonthTotals {
  income: number
  expense: number
  /** income − expense; transfers are excluded on purpose */
  net: number
  byCategory: { categoryId: string; amount: number }[]
}

export function totalsFor(txns: SpendTransaction[]): MonthTotals {
  let income = 0
  let expense = 0
  const cat = new Map<string, number>()
  for (const t of txns) {
    if (t.type === 'income') income += t.amount
    else if (t.type === 'expense') {
      expense += t.amount
      const id = t.categoryId ?? 'other'
      cat.set(id, (cat.get(id) ?? 0) + t.amount)
    }
  }
  const byCategory = [...cat.entries()]
    .map(([categoryId, amount]) => ({ categoryId, amount }))
    .sort((a, b) => b.amount - a.amount)
  return { income, expense, net: income - expense, byCategory }
}

/** Newest first: by date, then by creation time. */
export function sortTxns(txns: SpendTransaction[]): SpendTransaction[] {
  return [...txns].sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)))
}

/** Tags by when they were last typed (created or edited), most recent first. */
export function recentTags(txns: SpendTransaction[], limit = 3): string[] {
  const seen: string[] = []
  const byRecency = [...txns].sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt))
  for (const t of byRecency) {
    for (const tag of t.tags ?? []) {
      if (!seen.includes(tag)) seen.push(tag)
      if (seen.length === limit) return seen
    }
  }
  return seen
}

/** Most-used tags across all transactions, most frequent first. */
export function topTags(txns: SpendTransaction[], limit = 8): string[] {
  const count = new Map<string, number>()
  for (const t of txns) for (const tag of t.tags ?? []) count.set(tag, (count.get(tag) ?? 0) + 1)
  return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([tag]) => tag)
}

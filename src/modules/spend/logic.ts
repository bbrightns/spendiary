import type { CashAccount, SpendCard, SpendTransaction } from '../../lib/types'
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

export interface Balances {
  cashAccounts: CashAccount[]
  spendCards: SpendCard[]
}

/**
 * Apply (sign = 1) or reverse (sign = -1) a transaction's effect on balances.
 * Money leaving a wallet lowers its balance; money "leaving" a card raises what you owe.
 * Accounts that no longer exist are skipped.
 */
export function applyToBalances(b: Balances, txn: SpendTransaction, sign: 1 | -1): Balances {
  const deltas = moneyDeltas(txn)
  if (deltas.size === 0) return b
  const round = (n: number) => Math.round(n * 100) / 100
  const touched = (id: string) => (deltas.get(id) ?? 0) * sign
  return {
    cashAccounts: b.cashAccounts.map((a) => (deltas.has(a.id) ? { ...a, balance: round(a.balance + touched(a.id)) } : a)),
    spendCards: b.spendCards.map((c) => (deltas.has(c.id) ? { ...c, balance: round(c.balance - touched(c.id)) } : c)),
  }
}

/** Net money in (+) / out (−) per account id for one transaction. */
function moneyDeltas(txn: SpendTransaction): Map<string, number> {
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
  return deltas
}

/** Date `day` of the month containing `ref`, clamped to the month's length. */
function dayInMonth(ref: Date, day: number, monthOffset = 0): Date {
  const y = ref.getFullYear()
  const m = ref.getMonth() + monthOffset
  const last = new Date(y, m + 1, 0).getDate()
  return new Date(y, m, Math.min(day, last))
}

export interface CardCycle {
  /** Last statement closing date (YYYY-MM-DD), on or before today */
  lastStatement: string
  /** Next statement closing date, after today */
  nextStatement: string
  /** Due date of the last statement (may be past) */
  lastStatementDue: string
  /** Due date of the next statement */
  nextStatementDue: string
}

/**
 * The due date that matters right now: the last statement's, while it still has
 * money owing and isn't past; otherwise the upcoming statement's.
 */
export function upcomingDue(cyc: CardCycle, owed: number, spentThisCycle: number, today = new Date()) {
  const statementOwed = Math.max(0, owed - Math.max(0, spentThisCycle))
  const todayStr = localDateStr(today)
  const useLast = statementOwed > 0 && cyc.lastStatementDue >= todayStr
  const date = useLast ? cyc.lastStatementDue : cyc.nextStatementDue
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const days = Math.round((new Date(y, m - 1, d).getTime() - t.getTime()) / 86_400_000)
  return { date, days, amount: useLast ? statementOwed : Math.max(0, owed) }
}

export function cardCycle(card: Pick<SpendCard, 'statementDay' | 'dueDay'>, today = new Date()): CardCycle {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  let last = dayInMonth(t, card.statementDay)
  if (last > t) last = dayInMonth(t, card.statementDay, -1)
  const next = dayInMonth(last, card.statementDay, 1)
  // Due date belongs to a statement: same month if the due day comes later, else the month after
  const dueFor = (stmt: Date) => dayInMonth(stmt, card.dueDay, card.dueDay > card.statementDay ? 0 : 1)
  return {
    lastStatement: localDateStr(last),
    nextStatement: localDateStr(next),
    lastStatementDue: localDateStr(dueFor(last)),
    nextStatementDue: localDateStr(dueFor(next)),
  }
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

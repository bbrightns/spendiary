import type { CashAccount, PayCycle, SpendCard, SpendRecurring, SpendTransaction } from '../../lib/types'
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

// ── Card bills ───────────────────────────────────────────────────────────────

export const DEFAULT_BILL_REMINDER_DAYS = 5

export type BillStatus = 'overdue' | 'due' | 'upcoming' | 'clear'

export interface CardBill {
  card: SpendCard
  /** Statement window: after `from`, up to and including `to` */
  from: string
  to: string
  dueDate: string
  /** Negative when overdue */
  daysToDue: number
  /** Left to pay on the last statement */
  amountDue: number
  /** Charges − refunds that the statement billed (from logged transactions) */
  statementTotal: number
  /** Charges and refunds in the statement window, newest first */
  items: SpendTransaction[]
  /** Payments into the card since the statement closed */
  paidSoFar: number
  /** Owed beyond the logged statement items (opening balance, interest, older carry-over) */
  other: number
  status: BillStatus
  /** Inside the reminder window (or overdue) with money still due */
  remind: boolean
}

/**
 * The last statement's bill for a card. What's due is read from the card balance:
 * owed now minus what's been charged since the statement closed. That keeps it right
 * even when the starting balance was typed in rather than logged.
 */
export function cardBill(card: SpendCard, txns: SpendTransaction[], reminderDays = DEFAULT_BILL_REMINDER_DAYS, today = localDateStr()): CardBill {
  const t = parse(today)
  const cyc = cardCycle(card, t)
  const prevStatement = cardCycle(card, parse(addDays(cyc.lastStatement, -1))).lastStatement
  const onCard = txns.filter((x) => x.accountId === card.id && (x.type === 'expense' || x.type === 'income'))
  const net = (x: SpendTransaction) => (x.type === 'expense' ? x.amount : -x.amount)

  const items = onCard.filter((x) => x.date > prevStatement && x.date <= cyc.lastStatement).sort((a, b) => b.date.localeCompare(a.date))
  const statementTotal = items.reduce((s, x) => s + net(x), 0)
  const sinceStatement = onCard.filter((x) => x.date > cyc.lastStatement).reduce((s, x) => s + net(x), 0)
  const paidSoFar = txns
    .filter((x) => x.type === 'transfer' && x.toAccountId === card.id && x.date > cyc.lastStatement)
    .reduce((s, x) => s + x.amount, 0)

  const amountDue = Math.max(0, Math.round((card.balance - sinceStatement) * 100) / 100)
  const daysToDue = Math.round((parse(cyc.lastStatementDue).getTime() - t.getTime()) / 86_400_000)
  const status: BillStatus = amountDue <= 0 ? 'clear' : daysToDue < 0 ? 'overdue' : daysToDue <= reminderDays ? 'due' : 'upcoming'

  return {
    card,
    from: prevStatement,
    to: cyc.lastStatement,
    dueDate: cyc.lastStatementDue,
    daysToDue,
    amountDue,
    statementTotal,
    items,
    paidSoFar,
    other: Math.round((amountDue + paidSoFar - statementTotal) * 100) / 100,
    status,
    remind: status === 'due' || status === 'overdue',
  }
}

// ── Spending periods ─────────────────────────────────────────────────────────
// A "month" is either the calendar month or a pay cycle: from one payday up to
// the day before the next. Dates are local YYYY-MM-DD strings throughout.

/** Inclusive date range */
export interface Period {
  start: string
  end: string
}

const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const addDays = (s: string, n: number) => {
  const d = parse(s)
  d.setDate(d.getDate() + n)
  return localDateStr(d)
}

export const isCalendar = (cycle?: PayCycle) => !cycle || cycle.mode === 'calendar' || !cycle.rule

/** Payday for a month (`month` is 0-based and may overflow, like the Date constructor). */
export function paydayIn(year: number, month: number, cycle: PayCycle): Date {
  const lastDay = new Date(year, month + 1, 0).getDate()
  const rule = cycle.rule ?? { kind: 'day', day: 1 }
  const day =
    rule.kind === 'day'
      ? Math.min(Math.max(1, rule.day), lastDay)
      : Math.max(1, lastDay - Math.max(0, rule.daysBefore))
  const d = new Date(year, month, day)
  const shift = cycle.weekend ?? 'before'
  if (shift !== 'keep') {
    const step = shift === 'before' ? -1 : 1
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + step)
  }
  return d
}

/** The spending period that contains `date`. */
export function periodFor(date: string, cycle?: PayCycle): Period {
  const d = parse(date)
  if (isCalendar(cycle)) {
    return {
      start: localDateStr(new Date(d.getFullYear(), d.getMonth(), 1)),
      end: localDateStr(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
    }
  }
  // Paydays around the date; weekend shifts can push one across a month boundary
  const paydays = [-2, -1, 0, 1, 2].map((o) => localDateStr(paydayIn(d.getFullYear(), d.getMonth() + o, cycle!)))
  const start = [...paydays].reverse().find((p) => p <= date)!
  const next = paydays.find((p) => p > date)!
  return { start, end: addDays(next, -1) }
}

export function shiftPeriod(p: Period, delta: number, cycle?: PayCycle): Period {
  let cur = p
  for (let i = 0; i < Math.abs(delta); i++) cur = periodFor(delta > 0 ? addDays(cur.end, 1) : addDays(cur.start, -1), cycle)
  return cur
}

export const inPeriod = (p: Period, date: string) => date >= p.start && date <= p.end

/** Days from `today` to the period's end, counting both (0 if the period is over). */
export function daysLeftIn(p: Period, today = localDateStr()): number {
  if (today > p.end) return 0
  const from = today < p.start ? p.start : today
  return Math.round((parse(p.end).getTime() - parse(from).getTime()) / 86_400_000) + 1
}

export function periodLabel(p: Period, cycle?: PayCycle): string {
  const s = parse(p.start)
  if (isCalendar(cycle)) return s.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const e = parse(p.end)
  const short = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return `${short(s)} – ${short(e)} ${e.getFullYear()}`
}

/** Next `count` paydays from today (for previews). */
export function upcomingPaydays(cycle: PayCycle, count = 3, today = localDateStr()): string[] {
  const t = parse(today)
  const out: string[] = []
  for (let o = 0; out.length < count && o < count + 3; o++) {
    const p = localDateStr(paydayIn(t.getFullYear(), t.getMonth() + o, cycle))
    if (p >= today && !out.includes(p)) out.push(p)
  }
  return out
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

// ── Recurring ────────────────────────────────────────────────────────────────

type Schedule = Pick<SpendRecurring, 'frequency' | 'day' | 'month' | 'startDate'>

/** Occurrence dates between `from` and `to` (inclusive), never before the start date. */
export function occurrencesBetween(r: Schedule, from: string, to: string): string[] {
  const lo = from > r.startDate ? from : r.startDate
  if (lo > to) return []
  const out: string[] = []
  const a = parse(lo)
  const b = parse(to)
  if (r.frequency === 'weekly') {
    // JS: 0 = Sun; ours: 1 = Mon … 7 = Sun
    const target = r.day % 7
    const d = new Date(a)
    d.setDate(d.getDate() + ((target - d.getDay() + 7) % 7))
    for (; d <= b; d.setDate(d.getDate() + 7)) out.push(localDateStr(d))
    return out
  }
  for (let y = a.getFullYear(), m = a.getMonth(); new Date(y, m, 1) <= b; m++) {
    if (r.frequency === 'yearly' && m % 12 !== (r.month ?? 1) - 1) continue
    const last = new Date(y, m + 1, 0).getDate()
    const s = localDateStr(new Date(y, m, Math.min(Math.max(1, r.day), last)))
    if (s >= lo && s <= to) out.push(s)
  }
  return out
}

/** How far back unconfirmed occurrences are still offered (older ones quietly drop off). */
export const RECURRING_LOOKBACK_DAYS = 45

export interface DueRecurring {
  rec: SpendRecurring
  date: string
}

/** Occurrences up to today that are neither logged nor skipped, oldest first. */
export function dueRecurring(list: SpendRecurring[], today = localDateStr()): DueRecurring[] {
  const from = addDays(today, -RECURRING_LOOKBACK_DAYS)
  const out: DueRecurring[] = []
  for (const rec of list) {
    if (rec.paused) continue
    for (const date of occurrencesBetween(rec, from, today)) {
      if (!(rec.doneDates ?? []).includes(date) && !(rec.skippedDates ?? []).includes(date)) out.push({ rec, date })
    }
  }
  return out.sort((x, y) => x.date.localeCompare(y.date))
}

/** First occurrence after today, or undefined if none within ~13 months. */
export function nextOccurrence(r: Schedule, today = localDateStr()): string | undefined {
  return occurrencesBetween(r, addDays(today, 1), addDays(today, 400))[0]
}

export function frequencyLabel(r: Schedule): string {
  if (r.frequency === 'weekly') return `Every ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][(r.day - 1 + 7) % 7]}`
  if (r.frequency === 'monthly') return `Monthly on the ${ordinalDay(r.day)}`
  const month = new Date(2000, (r.month ?? 1) - 1, 1).toLocaleDateString('en-GB', { month: 'short' })
  return `Yearly on ${r.day} ${month}`
}

function ordinalDay(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

// ── Category budgets ─────────────────────────────────────────────────────────

export type BudgetState = 'ok' | 'near' | 'over'

export function budgetState(spent: number, budget: number): BudgetState {
  if (spent > budget) return 'over'
  if (spent >= budget * 0.85) return 'near'
  return 'ok'
}

import { useCallback, useMemo } from 'react'
import { useData } from '../../store/DataContext'
import { localDateStr } from '../../lib/format'
import { newId } from '../../lib/id'
import type { SpendCard, SpendCustomCategory, SpendGoal, SpendRecurring, SpendSettings, SpendTransaction, SpendiaryData } from '../../lib/types'
import { SPEND_CATEGORIES } from './categories'
import { investTransactions } from './invest'
import { DEFAULT_BILL_REMINDER_DAYS, applyOrder, applyToBalances, cardBill, dueRecurring, parseTags, recurringNote, renameInList, renameSubOn, sortTxns, spendWallets } from './logic'
import { availableCredit } from './credit'
import { accountLabel, trackRemovedMoves } from './accountRemoval'

export type SpendTxnInput = Omit<SpendTransaction, 'id' | 'createdAt' | 'updatedAt' | 'tags'>

/** A category as edited in the category sheet; omit `id` to add one. */
export type CategoryInput = Omit<SpendCustomCategory, 'id'> & { id?: string }

/** A wallet or a credit card, as one pickable "pay with" option. */
export interface PayMethod {
  id: string
  kind: 'cash' | 'card'
  name: string
  color?: string
  /** Cash: money available. Card: amount owed. */
  balance: number
  /** Card only */
  creditLimit?: number
  /** Card only: credit left, counting cards sharing its limit and installment holds */
  available?: number
  locked?: boolean
}

function markOccurrence(list: SpendRecurring[], id: string, date: string, key: 'doneDates' | 'skippedDates'): SpendRecurring[] {
  return list.map((r) => (r.id === id && !(r[key] ?? []).includes(date) ? { ...r, [key]: [...(r[key] ?? []), date].slice(-24) } : r))
}

function unmarkOccurrence(list: SpendRecurring[], id: string, date: string, key: 'doneDates' | 'skippedDates'): SpendRecurring[] {
  return list.map((r) => (r.id === id && (r[key] ?? []).includes(date) ? { ...r, [key]: (r[key] ?? []).filter((d) => d !== date) } : r))
}

/**
 * The transaction a recurring occurrence turns into: dated when it's paid (now), not when it
 * was due; the due date stays on the link to the occurrence.
 */
export function recurringInput(rec: SpendRecurring): SpendTxnInput {
  const now = new Date()
  const transfer = rec.type === 'transfer'
  return {
    type: rec.type,
    amount: rec.amount,
    categoryId: transfer ? undefined : rec.categoryId,
    subcategory: transfer ? undefined : rec.subcategory,
    accountId: rec.accountId,
    toAccountId: transfer ? rec.toAccountId : undefined,
    date: localDateStr(now),
    time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    note: recurringNote(rec),
  }
}

/**
 * Wallet and card balances after adding (1) or taking back (−1) these transactions. Money a change
 * would move on a deleted account is kept with its saved name, for an undo of the delete.
 */
function moveMoney(d: SpendiaryData, moves: [SpendTransaction, 1 | -1][]): Pick<SpendiaryData, 'cashAccounts' | 'spendCards' | 'spendSettings'> {
  let balances = { cashAccounts: d.cashAccounts ?? [], spendCards: d.spendCards ?? [] }
  const before = d.spendSettings?.removedAccounts
  let removed = before
  for (const [txn, sign] of moves) {
    balances = applyToBalances(balances, txn, sign)
    removed = trackRemovedMoves(removed, txn, sign)
  }
  return { ...balances, ...(removed !== before ? { spendSettings: { ...d.spendSettings, removedAccounts: removed } } : {}) }
}

/**
 * Spend module data access. Writes go through the shared store so they sync with
 * everything else, but never touch Invest-side state other than wallet balances.
 */
export function useSpend() {
  const { data, setData, usdThb } = useData()
  // Stored Spend rows + read-only rows from Invest (dividends, DCA buys)
  const fromInvest = useMemo(() => investTransactions(data, usdThb), [data, usdThb])
  // Tags are re-read from the note so rows saved under older tag rules (e.g. `#7-11` → "7") follow the current ones
  const stored = useMemo(() => (data.spendTransactions ?? []).map((t) => ({ ...t, tags: parseTags(t.note) })), [data.spendTransactions])
  const transactions = useMemo(() => sortTxns([...stored, ...fromInvest]), [stored, fromInvest])
  const settings: SpendSettings = useMemo(() => data.spendSettings ?? {}, [data.spendSettings])
  // In the order the user arranged on Accounts; pickers follow it too
  const wallets = useMemo(() => applyOrder(spendWallets(data.cashAccounts ?? []), settings.walletOrder), [data.cashAccounts, settings.walletOrder])
  const cards = useMemo(() => applyOrder(data.spendCards ?? [], settings.cardOrder), [data.spendCards, settings.cardOrder])

  const methods = useMemo<PayMethod[]>(
    () => [
      ...cards.map((c) => ({
        id: c.id,
        kind: 'card' as const,
        name: c.name,
        color: c.color,
        balance: c.balance,
        creditLimit: c.creditLimit,
        available: availableCredit(c, cards, data.liabilities ?? []).left,
      })),
      ...wallets.map((w) => ({ id: w.id, kind: 'cash' as const, name: w.name, color: w.color, balance: w.balance, locked: w.category === 'locked' })),
    ],
    [cards, wallets, data.liabilities],
  )

  const bills = useMemo(
    () => cards.map((c) => cardBill(c, transactions, settings.billReminderDays ?? DEFAULT_BILL_REMINDER_DAYS)),
    [cards, transactions, settings.billReminderDays],
  )
  /** Bills to nag about: due within the reminder window, or overdue */
  const reminders = useMemo(() => bills.filter((b) => b.remind).sort((a, b) => a.daysToDue - b.daysToDue), [bills])

  const recurring = useMemo(() => data.spendRecurring ?? [], [data.spendRecurring])
  /** A wallet or card's name, or the name it had if it was deleted ("KBank (deleted)") */
  const accountName = useCallback(
    (id: string | undefined) => accountLabel(id, methods.find((m) => m.id === id)?.name, settings.removedAccounts),
    [methods, settings.removedAccounts],
  )
  const goals = useMemo(() => data.spendGoals ?? [], [data.spendGoals])
  /** Recurring occurrences waiting to be confirmed or skipped */
  const dueRecurringList = useMemo(() => dueRecurring(recurring), [recurring])

  /**
   * Log a transaction. With `fromRecurring`, the occurrence is marked done in the same
   * update, so a confirmed bill can never be logged twice.
   */
  function addTransaction(input: SpendTxnInput, fromRecurring?: { id: string; date: string }): SpendTransaction {
    const txn: SpendTransaction = {
      ...input,
      id: newId(),
      tags: parseTags(input.note),
      createdAt: new Date().toISOString(),
      // Remembered so deleting it puts the occurrence back as due
      ...(fromRecurring ? { recurring: { id: fromRecurring.id, date: fromRecurring.date } } : {}),
    }
    setData((prev) => ({
      ...prev,
      ...moveMoney(prev, [[txn, 1]]),
      spendTransactions: [...(prev.spendTransactions ?? []), txn],
      ...(fromRecurring ? { spendRecurring: markOccurrence(prev.spendRecurring ?? [], fromRecurring.id, fromRecurring.date, 'doneDates') } : {}),
    }))
    return txn
  }

  /** Log many at once (e.g. a statement import) in one update. */
  function addTransactions(inputs: SpendTxnInput[]): number {
    const now = new Date().toISOString()
    const txns: SpendTransaction[] = inputs.map((input) => ({ ...input, id: newId(), tags: parseTags(input.note), createdAt: now }))
    setData((prev) => ({
      ...prev,
      ...moveMoney(prev, txns.map((t) => [t, 1])),
      spendTransactions: [...(prev.spendTransactions ?? []), ...txns],
    }))
    return txns.length
  }

  /** Log a recurring occurrence as-is (its usual amount, on its date). */
  function confirmRecurring(rec: SpendRecurring, date: string) {
    return addTransaction(recurringInput(rec), { id: rec.id, date })
  }

  function skipRecurring(id: string, date: string) {
    setData((prev) => ({ ...prev, spendRecurring: markOccurrence(prev.spendRecurring ?? [], id, date, 'skippedDates') }))
  }

  /** Undo a skip: the occurrence is due again. */
  function unskipRecurring(id: string, date: string) {
    setData((prev) => ({ ...prev, spendRecurring: unmarkOccurrence(prev.spendRecurring ?? [], id, date, 'skippedDates') }))
  }

  function upsertRecurring(rec: Omit<SpendRecurring, 'id'> & { id?: string }) {
    const id = rec.id ?? newId()
    setData((prev) => {
      const list = prev.spendRecurring ?? []
      return {
        ...prev,
        spendRecurring: list.some((r) => r.id === id) ? list.map((r) => (r.id === id ? { ...r, ...rec, id } : r)) : [...list, { ...rec, id }],
      }
    })
    return id
  }

  function removeRecurring(id: string) {
    setData((prev) => ({ ...prev, spendRecurring: (prev.spendRecurring ?? []).filter((r) => r.id !== id) }))
  }

  function updateTransaction(id: string, input: SpendTxnInput) {
    setData((prev) => {
      const list = prev.spendTransactions ?? []
      const old = list.find((t) => t.id === id)
      if (!old) return prev
      const next: SpendTransaction = { ...old, ...input, tags: parseTags(input.note), updatedAt: new Date().toISOString() }
      return {
        ...prev,
        ...moveMoney(prev, [
          [old, -1],
          [next, 1],
        ]),
        spendTransactions: list.map((t) => (t.id === id ? next : t)),
      }
    })
  }

  /**
   * Fill in category, subcategory, time and note on entries that are already logged (e.g. a re-import).
   * Amount, date and wallet stay as they are, so no balance moves.
   */
  function patchTransactions(patches: { id: string; categoryId?: string; subcategory?: string; time?: string; note?: string }[]) {
    const byId = new Map(patches.map((p) => [p.id, p]))
    const now = new Date().toISOString()
    setData((prev) => ({
      ...prev,
      spendTransactions: (prev.spendTransactions ?? []).map((t) => {
        const p = byId.get(t.id)
        if (!p) return t
        return {
          ...t,
          ...(p.categoryId ? { categoryId: p.categoryId } : {}),
          ...(p.subcategory ? { subcategory: p.subcategory } : {}),
          ...(p.time ? { time: p.time } : {}),
          ...(p.note ? { note: p.note, tags: parseTags(p.note) } : {}),
          updatedAt: now,
        }
      }),
    }))
  }

  /** Delete every Spend transaction, putting wallet and card balances back as if each had been deleted one by one. */
  function clearTransactions(): number {
    const count = (data.spendTransactions ?? []).length
    setData((prev) => ({
      ...prev,
      ...moveMoney(prev, (prev.spendTransactions ?? []).map((t) => [t, -1])),
      spendTransactions: [],
    }))
    return count
  }

  function removeTransaction(id: string) {
    setData((prev) => {
      const list = prev.spendTransactions ?? []
      const old = list.find((t) => t.id === id)
      if (!old) return prev
      return {
        ...prev,
        ...moveMoney(prev, [[old, -1]]),
        spendTransactions: list.filter((t) => t.id !== id),
        // A bill marked paid comes back as due once its transaction is gone
        ...(old.recurring ? { spendRecurring: unmarkOccurrence(prev.spendRecurring ?? [], old.recurring.id, old.recurring.date, 'doneDates') } : {}),
      }
    })
  }

  function upsertCard(card: Omit<SpendCard, 'id'> & { id?: string }): string {
    const id = card.id ?? newId()
    setData((prev) => {
      const list = prev.spendCards ?? []
      const exists = list.some((c) => c.id === id)
      return {
        ...prev,
        spendCards: exists ? list.map((c) => (c.id === id ? { ...c, ...card, id } : c)) : [...list, { ...card, id }],
      }
    })
    return id
  }

  /** Removes the card; its past transactions stay, shown without a payment method. */
  function removeCard(id: string) {
    setData((prev) => ({
      ...prev,
      // Cards that shared this one's limit get it as their own, so they aren't left without one
      spendCards: (prev.spendCards ?? [])
        .filter((c) => c.id !== id)
        .map((c) => {
          if (c.sharedLimitWith !== id) return c
          const main = (prev.spendCards ?? []).find((m) => m.id === id)
          return { ...c, sharedLimitWith: undefined, creditLimit: main?.creditLimit ?? c.creditLimit }
        }),
      spendSettings: {
        ...prev.spendSettings,
        defaultAccountId: prev.spendSettings?.defaultAccountId === id ? undefined : prev.spendSettings?.defaultAccountId,
        favoriteAccountIds: (prev.spendSettings?.favoriteAccountIds ?? []).filter((x) => x !== id),
      },
    }))
  }

  function updateSettings(patch: Partial<SpendSettings>) {
    setData((prev) => ({ ...prev, spendSettings: { ...prev.spendSettings, ...patch } }))
  }

  /**
   * Add or change a category. Built-ins keep their id and store only the user's edits;
   * new ones become custom categories. Returns the category id.
   */
  function upsertCategory(input: CategoryInput): string {
    const id = input.id ?? `cat-${newId()}`
    const isBuiltIn = SPEND_CATEGORIES.some((c) => c.id === id)
    setData((prev) => {
      const st = prev.spendSettings ?? {}
      if (isBuiltIn) {
        const edit = { label: input.label, tone: input.tone, icon: input.icon, hidden: input.hidden || undefined }
        return { ...prev, spendSettings: { ...st, categoryEdits: { ...st.categoryEdits, [id]: edit } } }
      }
      const list = st.customCategories ?? []
      const next = { id, type: input.type, label: input.label, tone: input.tone, icon: input.icon, hidden: input.hidden || undefined }
      return {
        ...prev,
        spendSettings: {
          ...st,
          customCategories: list.some((c) => c.id === id) ? list.map((c) => (c.id === id ? next : c)) : [...list, next],
        },
      }
    })
    return id
  }

  /** Offer a subcategory under a category (no-op if it's blank or already there). */
  function addSubcategory(categoryId: string, label: string) {
    const clean = label.trim()
    if (!clean) return
    setData((prev) => {
      const st = prev.spendSettings ?? {}
      const list = st.subcategories?.[categoryId] ?? []
      if (list.includes(clean)) return prev
      return { ...prev, spendSettings: { ...st, subcategories: { ...st.subcategories, [categoryId]: [...list, clean] } } }
    })
  }

  /** Stop offering a subcategory; transactions already using it keep the label. */
  function removeSubcategory(categoryId: string, label: string) {
    setData((prev) => {
      const st = prev.spendSettings ?? {}
      const list = (st.subcategories?.[categoryId] ?? []).filter((s) => s !== label)
      return { ...prev, spendSettings: { ...st, subcategories: { ...st.subcategories, [categoryId]: list } } }
    })
  }

  /**
   * Rename a subcategory under one category, on past transactions and recurring items too.
   * A name already in use merges the two. Returns how many transactions changed.
   */
  function renameSubcategory(categoryId: string, from: string, to: string): number {
    const clean = to.trim()
    if (!clean || clean === from) return 0
    const count = (data.spendTransactions ?? []).filter((t) => t.categoryId === categoryId && t.subcategory === from).length
    const now = new Date().toISOString()
    setData((prev) => {
      const st = prev.spendSettings ?? {}
      return {
        ...prev,
        spendSettings: { ...st, subcategories: { ...st.subcategories, [categoryId]: renameInList(st.subcategories?.[categoryId] ?? [], from, clean) } },
        spendTransactions: (prev.spendTransactions ?? []).map((t) =>
          t.categoryId === categoryId && t.subcategory === from ? { ...t, subcategory: clean, updatedAt: now } : t,
        ),
        spendRecurring: renameSubOn(prev.spendRecurring ?? [], categoryId, from, clean),
      }
    })
    return count
  }

  /** Hide a category from the pickers (or show it again), keeping its name, icon and color. */
  function setCategoryHidden(id: string, hidden: boolean) {
    const isBuiltIn = SPEND_CATEGORIES.some((c) => c.id === id)
    setData((prev) => {
      const st = prev.spendSettings ?? {}
      if (isBuiltIn) {
        const edit = { ...st.categoryEdits?.[id], hidden: hidden || undefined }
        return { ...prev, spendSettings: { ...st, categoryEdits: { ...st.categoryEdits, [id]: edit } } }
      }
      const list = (st.customCategories ?? []).map((c) => (c.id === id ? { ...c, hidden: hidden || undefined } : c))
      return { ...prev, spendSettings: { ...st, customCategories: list } }
    })
  }

  /**
   * Delete a category for good (it leaves Settings too), or bring it back fully shown.
   * Its name stays on past transactions either way.
   */
  function setCategoryRemoved(id: string, removed: boolean) {
    const isBuiltIn = SPEND_CATEGORIES.some((c) => c.id === id)
    const flags = { hidden: removed || undefined, removed: removed || undefined }
    setData((prev) => {
      const st = prev.spendSettings ?? {}
      if (isBuiltIn) return { ...prev, spendSettings: { ...st, categoryEdits: { ...st.categoryEdits, [id]: { ...st.categoryEdits?.[id], ...flags } } } }
      const list = (st.customCategories ?? []).map((c) => (c.id === id ? { ...c, ...flags } : c))
      return { ...prev, spendSettings: { ...st, customCategories: list } }
    })
  }

  /** Back to the shipped name, icon and color. */
  function resetCategory(id: string) {
    setData((prev) => {
      const rest = { ...prev.spendSettings?.categoryEdits }
      delete rest[id]
      return { ...prev, spendSettings: { ...prev.spendSettings, categoryEdits: rest } }
    })
  }

  /**
   * Remove a custom category. One still used by a transaction or recurring item is
   * hidden instead, so history keeps its name.
   */
  function removeCategory(id: string): 'removed' | 'hidden' {
    const used = (data.spendTransactions ?? []).some((t) => t.categoryId === id) || (data.spendRecurring ?? []).some((r) => r.categoryId === id)
    setData((prev) => {
      const st = prev.spendSettings ?? {}
      const list = st.customCategories ?? []
      if (used) return { ...prev, spendSettings: { ...st, customCategories: list.map((c) => (c.id === id ? { ...c, hidden: true } : c)) } }
      const budgets = { ...st.categoryBudgets }
      delete budgets[id]
      return { ...prev, spendSettings: { ...st, customCategories: list.filter((c) => c.id !== id), categoryBudgets: budgets } }
    })
    return used ? 'hidden' : 'removed'
  }

  function upsertGoal(goal: Omit<SpendGoal, 'id' | 'createdAt'> & { id?: string }): string {
    const id = goal.id ?? newId()
    setData((prev) => {
      const list = prev.spendGoals ?? []
      const old = list.find((g) => g.id === id)
      const next: SpendGoal = { ...old, ...goal, id, createdAt: old?.createdAt ?? new Date().toISOString() }
      return { ...prev, spendGoals: old ? list.map((g) => (g.id === id ? next : g)) : [...list, next] }
    })
    return id
  }

  function removeGoal(id: string) {
    setData((prev) => ({ ...prev, spendGoals: (prev.spendGoals ?? []).filter((g) => g.id !== id) }))
  }

  function toggleFavorite(id: string) {
    setData((prev) => {
      const favs = prev.spendSettings?.favoriteAccountIds ?? []
      return {
        ...prev,
        spendSettings: { ...prev.spendSettings, favoriteAccountIds: favs.includes(id) ? favs.filter((x) => x !== id) : [...favs, id] },
      }
    })
  }

  return {
    transactions,
    wallets,
    cards,
    methods,
    accountName,
    settings,
    bills,
    reminders,
    recurring,
    dueRecurring: dueRecurringList,
    confirmRecurring,
    skipRecurring,
    unskipRecurring,
    upsertRecurring,
    removeRecurring,
    addTransaction,
    addTransactions,
    updateTransaction,
    removeTransaction,
    patchTransactions,
    clearTransactions,
    upsertCard,
    removeCard,
    toggleFavorite,
    goals,
    upsertGoal,
    removeGoal,
    upsertCategory,
    resetCategory,
    removeCategory,
    setCategoryHidden,
    setCategoryRemoved,
    subcategories: (categoryId: string | undefined): string[] => (categoryId ? settings.subcategories?.[categoryId] ?? [] : []),
    addSubcategory,
    removeSubcategory,
    renameSubcategory,
    updateSettings,
    setDefaultAccount: (id: string | undefined) => updateSettings({ defaultAccountId: id }),
    setMonthlyBudget: (amount: number | undefined) => updateSettings({ monthlyBudget: amount }),
  }
}

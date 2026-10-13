import { useMemo } from 'react'
import { useData } from '../../store/DataContext'
import type { SpendCard, SpendCustomCategory, SpendGoal, SpendRecurring, SpendSettings, SpendTransaction, SpendiaryData } from '../../lib/types'
import { SPEND_CATEGORIES } from './categories'
import { investTransactions } from './invest'
import { DEFAULT_BILL_REMINDER_DAYS, applyOrder, applyToBalances, cardBill, dueRecurring, parseTags, sortTxns, spendWallets } from './logic'
import { availableCredit } from './credit'

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

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function markOccurrence(list: SpendRecurring[], id: string, date: string, key: 'doneDates' | 'skippedDates'): SpendRecurring[] {
  return list.map((r) => (r.id === id && !(r[key] ?? []).includes(date) ? { ...r, [key]: [...(r[key] ?? []), date].slice(-24) } : r))
}

/** The transaction a recurring occurrence turns into. */
export function recurringInput(rec: SpendRecurring, date: string): SpendTxnInput {
  return { type: rec.type, amount: rec.amount, categoryId: rec.categoryId, accountId: rec.accountId, date, note: rec.note ?? rec.name }
}

function balancesOf(d: SpendiaryData) {
  return { cashAccounts: d.cashAccounts ?? [], spendCards: d.spendCards ?? [] }
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
  const goals = useMemo(() => data.spendGoals ?? [], [data.spendGoals])
  /** Recurring occurrences waiting to be confirmed or skipped */
  const dueRecurringList = useMemo(() => dueRecurring(recurring), [recurring])

  /**
   * Log a transaction. With `fromRecurring`, the occurrence is marked done in the same
   * update, so a confirmed bill can never be logged twice.
   */
  function addTransaction(input: SpendTxnInput, fromRecurring?: { id: string; date: string }): SpendTransaction {
    const txn: SpendTransaction = { ...input, id: newId(), tags: parseTags(input.note), createdAt: new Date().toISOString() }
    setData((prev) => ({
      ...prev,
      ...applyToBalances(balancesOf(prev), txn, 1),
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
      ...txns.reduce((b, t) => applyToBalances(b, t, 1), balancesOf(prev)),
      spendTransactions: [...(prev.spendTransactions ?? []), ...txns],
    }))
    return txns.length
  }

  /** Log a recurring occurrence as-is (its usual amount, on its date). */
  function confirmRecurring(rec: SpendRecurring, date: string) {
    return addTransaction(recurringInput(rec, date), { id: rec.id, date })
  }

  function skipRecurring(id: string, date: string) {
    setData((prev) => ({ ...prev, spendRecurring: markOccurrence(prev.spendRecurring ?? [], id, date, 'skippedDates') }))
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
      const reverted = applyToBalances(balancesOf(prev), old, -1)
      return {
        ...prev,
        ...applyToBalances(reverted, next, 1),
        spendTransactions: list.map((t) => (t.id === id ? next : t)),
      }
    })
  }

  function removeTransaction(id: string) {
    setData((prev) => {
      const list = prev.spendTransactions ?? []
      const old = list.find((t) => t.id === id)
      if (!old) return prev
      return {
        ...prev,
        ...applyToBalances(balancesOf(prev), old, -1),
        spendTransactions: list.filter((t) => t.id !== id),
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
    settings,
    bills,
    reminders,
    recurring,
    dueRecurring: dueRecurringList,
    confirmRecurring,
    skipRecurring,
    upsertRecurring,
    removeRecurring,
    addTransaction,
    addTransactions,
    updateTransaction,
    removeTransaction,
    upsertCard,
    removeCard,
    toggleFavorite,
    goals,
    upsertGoal,
    removeGoal,
    upsertCategory,
    resetCategory,
    removeCategory,
    subcategories: (categoryId: string | undefined): string[] => (categoryId ? settings.subcategories?.[categoryId] ?? [] : []),
    addSubcategory,
    removeSubcategory,
    updateSettings,
    setDefaultAccount: (id: string | undefined) => updateSettings({ defaultAccountId: id }),
    setMonthlyBudget: (amount: number | undefined) => updateSettings({ monthlyBudget: amount }),
  }
}

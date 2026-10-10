import { useMemo } from 'react'
import { useData } from '../../store/DataContext'
import type { SpendCard, SpendSettings, SpendTransaction, SpendiaryData } from '../../lib/types'
import { applyToBalances, parseTags, sortTxns, spendWallets } from './logic'

export type SpendTxnInput = Omit<SpendTransaction, 'id' | 'createdAt' | 'updatedAt' | 'tags'>

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
  locked?: boolean
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function balancesOf(d: SpendiaryData) {
  return { cashAccounts: d.cashAccounts ?? [], spendCards: d.spendCards ?? [] }
}

/**
 * Spend module data access. Writes go through the shared store so they sync with
 * everything else, but never touch Invest-side state other than wallet balances.
 */
export function useSpend() {
  const { data, setData } = useData()
  const transactions = useMemo(() => sortTxns(data.spendTransactions ?? []), [data.spendTransactions])
  const wallets = useMemo(() => spendWallets(data.cashAccounts ?? []), [data.cashAccounts])
  const cards = useMemo(() => data.spendCards ?? [], [data.spendCards])
  const settings: SpendSettings = useMemo(() => data.spendSettings ?? {}, [data.spendSettings])

  const methods = useMemo<PayMethod[]>(
    () => [
      ...cards.map((c) => ({ id: c.id, kind: 'card' as const, name: c.name, color: c.color, balance: c.balance, creditLimit: c.creditLimit })),
      ...wallets.map((w) => ({ id: w.id, kind: 'cash' as const, name: w.name, color: w.color, balance: w.balance, locked: w.category === 'locked' })),
    ],
    [cards, wallets],
  )

  function addTransaction(input: SpendTxnInput): SpendTransaction {
    const txn: SpendTransaction = { ...input, id: newId(), tags: parseTags(input.note), createdAt: new Date().toISOString() }
    setData((prev) => ({
      ...prev,
      ...applyToBalances(balancesOf(prev), txn, 1),
      spendTransactions: [...(prev.spendTransactions ?? []), txn],
    }))
    return txn
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
      spendCards: (prev.spendCards ?? []).filter((c) => c.id !== id),
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
    addTransaction,
    updateTransaction,
    removeTransaction,
    upsertCard,
    removeCard,
    toggleFavorite,
    setDefaultAccount: (id: string | undefined) => updateSettings({ defaultAccountId: id }),
    setMonthlyBudget: (amount: number | undefined) => updateSettings({ monthlyBudget: amount }),
  }
}

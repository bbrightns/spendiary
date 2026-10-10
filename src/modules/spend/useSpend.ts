import { useMemo } from 'react'
import { useData } from '../../store/DataContext'
import type { SpendSettings, SpendTransaction } from '../../lib/types'
import { applyToWallets, parseTags, sortTxns, spendWallets } from './logic'

export type SpendTxnInput = Omit<SpendTransaction, 'id' | 'createdAt' | 'updatedAt' | 'tags'>

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Spend module data access. Writes go through the shared store so they sync with
 * everything else, but never touch Invest-side state other than wallet balances.
 */
export function useSpend() {
  const { data, setData } = useData()
  const transactions = useMemo(() => sortTxns(data.spendTransactions ?? []), [data.spendTransactions])
  const wallets = useMemo(() => spendWallets(data.cashAccounts ?? []), [data.cashAccounts])
  const settings: SpendSettings = data.spendSettings ?? {}

  function addTransaction(input: SpendTxnInput): SpendTransaction {
    const txn: SpendTransaction = { ...input, id: newId(), tags: parseTags(input.note), createdAt: new Date().toISOString() }
    setData((prev) => ({
      ...prev,
      spendTransactions: [...(prev.spendTransactions ?? []), txn],
      cashAccounts: applyToWallets(prev.cashAccounts ?? [], txn, 1),
    }))
    return txn
  }

  function updateTransaction(id: string, input: SpendTxnInput) {
    setData((prev) => {
      const list = prev.spendTransactions ?? []
      const old = list.find((t) => t.id === id)
      if (!old) return prev
      const next: SpendTransaction = { ...old, ...input, tags: parseTags(input.note), updatedAt: new Date().toISOString() }
      const reverted = applyToWallets(prev.cashAccounts ?? [], old, -1)
      return {
        ...prev,
        spendTransactions: list.map((t) => (t.id === id ? next : t)),
        cashAccounts: applyToWallets(reverted, next, 1),
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
        spendTransactions: list.filter((t) => t.id !== id),
        cashAccounts: applyToWallets(prev.cashAccounts ?? [], old, -1),
      }
    })
  }

  function setMonthlyBudget(amount: number | undefined) {
    setData((prev) => ({ ...prev, spendSettings: { ...prev.spendSettings, monthlyBudget: amount } }))
  }

  return { transactions, wallets, settings, addTransaction, updateTransaction, removeTransaction, setMonthlyBudget }
}

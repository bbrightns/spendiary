import type { CashAccount } from '../lib/types'
import { newId } from './migrate'

/**
 * Undo one logged change to the cash accounts as a delta on top of the current list:
 * balances move back by (before − after), edited fields go back to their old values,
 * accounts the log added are removed and accounts it deleted come back.
 */
export function revertCashAccountsChange(current: CashAccount[], before: CashAccount[], after: CashAccount[]): CashAccount[] {
  const byId = (list: CashAccount[], id: string) => list.find((a) => a.id === id)
  const reverted = current
    .filter((c) => !(byId(after, c.id) && !byId(before, c.id)))
    .map((c) => {
      const b = byId(before, c.id)
      const a = byId(after, c.id)
      if (!b || !a) return c
      const restored: CashAccount = { ...c }
      for (const key of Object.keys({ ...a, ...b }) as (keyof CashAccount)[]) {
        if (key !== 'balance' && key !== 'id' && JSON.stringify(a[key]) !== JSON.stringify(b[key])) {
          ;(restored as unknown as Record<string, unknown>)[key] = b[key]
        }
      }
      restored.balance = Math.round((c.balance + (b.balance - a.balance)) * 100) / 100
      return restored
    })
  const deleted = before.filter((b) => !byId(after, b.id) && !byId(current, b.id))
  return [...reverted, ...deleted]
}

/** A DCA buy paid out of one of the user's cash accounts. */
export interface DcaPayment {
  accountId: string
  /** THB */
  amount: number
}

/** The cash accounts after a DCA buy's payment leaves the account it was paid from. */
export function payFromAccount(accounts: CashAccount[], payment?: DcaPayment): CashAccount[] {
  if (!payment) return accounts
  return accounts.map((a) => (a.id === payment.accountId ? { ...a, balance: Math.round((a.balance - payment.amount) * 100) / 100 } : a))
}

/** Insert (when no id) or replace (when id matches) an item in a list. */
export function upsert<T extends { id: string }>(list: T[], item: Omit<T, 'id'> & { id?: string }): T[] {
  if (item.id && list.some((x) => x.id === item.id)) {
    return list.map((x) => (x.id === item.id ? ({ ...x, ...item } as T) : x))
  }
  return [...list, { ...item, id: item.id ?? newId() } as T]
}

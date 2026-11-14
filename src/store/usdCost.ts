import type { CashAccount, SpendiaryData } from '../lib/types'
import { roundMoney } from '../lib/money'

/**
 * The baht cost of what sits in a USD account, so a US stock bought from it costs what the
 * dollars really cost (the rate they were exchanged at), not today's rate.
 */

const isUsd = (a: Pick<CashAccount, 'currency'>) => a.currency === 'USD'

/** A USD account's average rate (THB per USD), or null when its cost isn't known or it holds nothing */
export function walletRate(a: Pick<CashAccount, 'currency' | 'balance' | 'thbCost'> | undefined): number | null {
  if (!a || !isUsd(a) || a.thbCost === undefined || !(a.balance > 0) || !(a.thbCost > 0)) return null
  return a.thbCost / a.balance
}

/**
 * A USD account after `usdDelta` dollars moved in (+) or out (−):
 * - out: the cost comes off in proportion, so the average rate stays the same
 * - in: `thbIn` is added when it's known (an exchange, a sale's proceeds); otherwise the money
 *   comes in at the account's average rate
 * An account with no known cost, or a THB account, is returned unchanged apart from the balance.
 */
export function moveUsd(a: CashAccount, usdDelta: number, thbIn?: number): CashAccount {
  const balance = roundMoney(a.balance + usdDelta)
  if (!isUsd(a) || a.thbCost === undefined) return { ...a, balance }
  if (balance <= 0) return { ...a, balance, thbCost: 0 }
  if (usdDelta < 0) {
    const rate = walletRate(a)
    return { ...a, balance, thbCost: rate === null ? 0 : roundMoney(balance * rate) }
  }
  const rate = walletRate(a)
  const added = thbIn ?? (rate === null ? 0 : usdDelta * rate)
  return { ...a, balance, thbCost: roundMoney(a.thbCost + added) }
}

/**
 * Keeps each USD account's cost in step with its balance after any change that didn't set the cost
 * itself (a buy paid from it, an undo, a dividend, a balance typed in): the average rate stays put.
 * Changes that did set it (an exchange, a sale, the cost typed in) are left as they are.
 */
export function syncUsdCosts(prev: SpendiaryData, next: SpendiaryData): SpendiaryData {
  const before = new Map((prev.cashAccounts ?? []).map((a) => [a.id, a]))
  let changed = false
  const cashAccounts = (next.cashAccounts ?? []).map((a) => {
    const old = before.get(a.id)
    if (!old || !isUsd(a) || !isUsd(old) || a.thbCost === undefined) return a
    if (a.thbCost !== old.thbCost || a.balance === old.balance) return a
    changed = true
    return { ...a, thbCost: moveUsd(old, a.balance - old.balance).thbCost }
  })
  return changed ? { ...next, cashAccounts } : next
}

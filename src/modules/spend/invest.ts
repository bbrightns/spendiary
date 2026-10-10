import type { SpendTransaction, SpendiaryData } from '../../lib/types'
import { localDateStr } from '../../lib/format'

/**
 * Read-only Spend rows derived from the Invest side, so money that already moved
 * there shows up here without being logged (or applied to balances) twice:
 *  - dividends received → income
 *  - DCA buys → "invested" transfers (excluded from spending, like any transfer)
 * Deleting or undoing on the Invest side removes them here too.
 */
export function investTransactions(data: SpendiaryData, usdThb: number | null): SpendTransaction[] {
  const out: SpendTransaction[] = []
  const accounts = data.cashAccounts ?? []

  for (const r of data.dividendRecords ?? []) {
    const acct = accounts.find((a) => a.id === r.cashAccountId)
    // netAmount is in the receiving account's currency
    const amount = (acct?.currency ?? 'THB') === 'USD' ? (usdThb ? r.netAmount * usdThb : 0) : r.netAmount
    if (!(amount > 0)) continue
    out.push({
      id: `div-${r.id}`,
      type: 'income',
      amount: Math.round(amount * 100) / 100,
      categoryId: 'dividend',
      accountId: r.cashAccountId,
      date: r.paymentDate,
      note: `${r.ticker || r.holdingName} dividend`,
      createdAt: r.createdAt,
      source: 'dividend',
    })
  }

  const plans = new Map((data.dcaPlans ?? []).map((p) => [p.id, p]))
  for (const log of data.holdingLogs ?? []) {
    // Cash DCA just moves money into your own savings, so it isn't "invested"
    if (!log.dcaPlanId || log.assetClass === 'cash') continue
    const plan = plans.get(log.dcaPlanId)
    const spent = (log.afterHoldingState?.totalThbInvested ?? 0) - (log.previousHoldingState?.totalThbInvested ?? 0)
    const amount = spent > 0 ? spent : plan?.monthlyAmount ?? 0
    if (!(amount > 0)) continue
    out.push({
      id: `dca-${log.id}`,
      type: 'transfer',
      amount: Math.round(amount * 100) / 100,
      accountId: log.cashAccountId,
      date: log.dcaDate ?? localDateStr(new Date(log.timestamp)),
      note: plan?.name ?? log.holdingName,
      createdAt: log.timestamp,
      source: 'dca',
    })
  }
  return out
}

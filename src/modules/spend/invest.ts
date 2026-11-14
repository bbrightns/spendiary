import { logCashStates, logHoldingStates } from '../../lib/logStates'
import type { CashAccount, SpendTransaction, SpendiaryData } from '../../lib/types'
import { localDateStr } from '../../lib/format'
import { roundMoney } from '../../lib/money'

/** Money put into an investment (a DCA or Buy more row), not a savings DCA into your own account. */
export const isInvested = (t: Pick<SpendTransaction, 'source' | 'toAccountId'>) => (t.source === 'dca' || t.source === 'buy') && !t.toAccountId

/**
 * Read-only Spend rows derived from the Invest side, so money that already moved
 * there shows up here without being logged (or applied to balances) twice:
 *  - dividends received → income
 *  - DCA buys and Buy more → "invested" transfers (excluded from spending, like any transfer),
 *    from the account they were paid from, or no account when none was picked
 *  - savings DCA → a transfer into the savings account
 * Deleting or undoing on the Invest side removes them here too.
 */
export function investTransactions(data: SpendiaryData, usdThb: number | null): SpendTransaction[] {
  const out: SpendTransaction[] = []
  const accounts = data.cashAccounts ?? []

  for (const r of data.dividendRecords ?? []) {
    const acct = accounts.find((a) => a.id === r.cashAccountId)
    // netAmount is in the receiving account's currency; with no account, in the holding's
    // (US stocks pay in USD)
    const holding = (data.holdings ?? []).find((h) => h.id === r.holdingId)
    const usdHolding = !!holding && ((holding.totalUsdInvested ?? 0) > 0 || (holding.avgCostUsd ?? 0) > 0)
    const currency = acct ? acct.currency ?? 'THB' : usdHolding ? 'USD' : 'THB'
    const amount = currency === 'USD' ? (usdThb ? r.netAmount * usdThb : 0) : r.netAmount
    if (!(amount > 0)) continue
    out.push({
      id: `div-${r.id}`,
      type: 'income',
      amount: roundMoney(amount),
      categoryId: 'dividend',
      accountId: r.cashAccountId,
      date: r.paymentDate,
      note: `${r.ticker || r.holdingName} dividend`,
      createdAt: r.createdAt,
      source: 'dividend',
    })
  }

  const plans = new Map((data.dcaPlans ?? []).map((p) => [p.id, p]))
  const balanceOf = (list: CashAccount[] | undefined, id?: string) => list?.find((a) => a.id === id)?.balance
  for (const log of data.holdingLogs ?? []) {
    const at = new Date(log.timestamp)
    const time = Number.isNaN(at.getTime()) ? undefined : `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`
    const states = logHoldingStates(log)
    const cash = logCashStates(log)
    const invested = log.delta ? log.delta.thb : (states.curr?.totalThbInvested ?? 0) - (states.prev?.totalThbInvested ?? 0)

    if (log.dcaPlanId) {
      const plan = plans.get(log.dcaPlanId)
      if (log.assetClass === 'cash') {
        // Savings DCA: money moved into one of your own accounts, so a transfer rather than an investment
        const into = plan?.cashAccountId
        const deposited = (balanceOf(cash.curr, into) ?? 0) - (balanceOf(cash.prev, into) ?? 0)
        const amount = log.paidAmount ?? deposited
        if (!(amount > 0)) continue
        out.push({
          id: `dca-${log.id}`,
          type: 'transfer',
          amount: roundMoney(amount),
          accountId: log.paidFromAccountId,
          toAccountId: into,
          date: log.dcaDate ?? localDateStr(at),
          time,
          note: plan?.name ?? log.holdingName,
          createdAt: log.timestamp,
          source: 'dca',
        })
        continue
      }
      const amount = log.paidAmount ?? (invested > 0 ? invested : plan?.monthlyAmount ?? 0)
      if (!(amount > 0)) continue
      out.push({
        id: `dca-${log.id}`,
        type: 'transfer',
        amount: roundMoney(amount),
        accountId: log.paidFromAccountId,
        date: log.dcaDate ?? localDateStr(at),
        time,
        note: plan?.name ?? log.holdingName,
        createdAt: log.timestamp,
        source: 'dca',
      })
      continue
    }

    // Buy more on a holding (not cash accounts), or a new holding paid from an account: what left the
    // paying account, else what was invested. Spend counts in baht, so a USD account's payment shows
    // as what the holding cost in baht.
    const paidAdd = log.action === 'add' && !!log.cashAccountId
    if ((log.action !== 'buy_more' && !paidAdd) || log.assetClass === 'cash' || !log.holdingId || log.source === 'received') continue
    const payingUsd = accounts.find((a) => a.id === log.cashAccountId)?.currency === 'USD'
    const paid = log.cashAccountId && !payingUsd
      ? (balanceOf(cash.prev, log.cashAccountId) ?? 0) - (balanceOf(cash.curr, log.cashAccountId) ?? 0)
      : 0
    const amount = paid > 0 ? paid : invested
    if (!(amount > 0)) continue
    out.push({
      id: `buy-${log.id}`,
      type: 'transfer',
      amount: roundMoney(amount),
      accountId: log.cashAccountId,
      date: localDateStr(at),
      time,
      note: log.ticker && log.ticker !== log.holdingName ? `${log.holdingName} (${log.ticker})` : log.holdingName,
      createdAt: log.timestamp,
      source: 'buy',
    })
  }

  // Baht exchanged into a USD account: a transfer out of the THB account that paid
  for (const ex of data.fxExchanges ?? []) {
    if (!ex.fromAccountId || !(ex.thb > 0)) continue
    const to = accounts.find((a) => a.id === ex.toAccountId)
    out.push({
      id: `fx-${ex.id}`,
      type: 'transfer',
      amount: roundMoney(ex.thb),
      accountId: ex.fromAccountId,
      toAccountId: ex.toAccountId,
      date: ex.date,
      note: `THB → USD${to ? ` · ${to.name}` : ''} · $${ex.usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      createdAt: ex.createdAt,
      source: 'fx',
    })
  }
  return out
}

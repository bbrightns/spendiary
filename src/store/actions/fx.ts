import type { FxExchange, SpendiaryData } from '../../lib/types'
import type { DataContextValue } from '../DataContext'
import { newId } from '../migrate'
import { roundMoney } from '../../lib/money'
import { moveUsd } from '../usdCost'

/**
 * Baht exchanged into a USD account. The THB account (when one is picked) pays the baht, the USD
 * account gets the dollars and their baht cost, so its average rate follows what was really paid.
 * Each action takes the current data plus the arguments useData() exposes and returns the next data.
 */
export function exchangeToUsd(prev: SpendiaryData, ...[params]: Parameters<DataContextValue['exchangeToUsd']>): SpendiaryData {
  const accounts = prev.cashAccounts ?? []
  const to = accounts.find((a) => a.id === params.toAccountId)
  if (!to || to.currency !== 'USD' || !(params.thb > 0) || !(params.usd > 0)) return prev
  const from = params.fromAccountId ? accounts.find((a) => a.id === params.fromAccountId && (a.currency ?? 'THB') === 'THB') : undefined

  // What the dollars already there cost: as typed now (it may correct the saved one), as saved, or nothing when there are none
  const typed = params.openingThbCost !== undefined && params.openingThbCost >= 0 ? params.openingThbCost : undefined
  const opening = typed ?? to.thbCost ?? (to.balance <= 0 ? 0 : undefined)
  const toAfter = moveUsd({ ...to, thbCost: opening }, params.usd, params.thb)

  const record: FxExchange = {
    id: newId(),
    date: params.date,
    createdAt: new Date().toISOString(),
    ...(from ? { fromAccountId: from.id } : {}),
    toAccountId: to.id,
    thb: roundMoney(params.thb),
    usd: roundMoney(params.usd),
  }
  return {
    ...prev,
    cashAccounts: accounts.map((a) =>
      a.id === to.id ? toAfter : from && a.id === from.id ? { ...a, balance: roundMoney(a.balance - params.thb) } : a,
    ),
    fxExchanges: [record, ...(prev.fxExchanges ?? [])],
  }
}

/** Takes an exchange back: the baht return, the dollars and their cost come out. Missing accounts are skipped. */
export function undoFxExchange(prev: SpendiaryData, ...[id]: Parameters<DataContextValue['undoFxExchange']>): SpendiaryData {
  const ex = (prev.fxExchanges ?? []).find((e) => e.id === id)
  if (!ex) return prev
  return {
    ...prev,
    cashAccounts: (prev.cashAccounts ?? []).map((a) => {
      if (a.id === ex.fromAccountId) return { ...a, balance: roundMoney(a.balance + ex.thb) }
      if (a.id !== ex.toAccountId) return a
      const balance = roundMoney(a.balance - ex.usd)
      return a.thbCost === undefined ? { ...a, balance } : { ...a, balance, thbCost: Math.max(0, roundMoney(a.thbCost - ex.thb)) }
    }),
    fxExchanges: (prev.fxExchanges ?? []).filter((e) => e.id !== id),
  }
}

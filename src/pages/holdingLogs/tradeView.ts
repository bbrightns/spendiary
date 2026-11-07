/** What a Trades row shows for each kind of entry, plus the page's search and totals. */
import { getCashDiffItems, getLogTransactionDetails } from '../../lib/activitySummary'
import { thb } from '../../lib/format'
import type { HoldingLog } from '../../lib/types'
import { canUndoLog } from '../../store/actions/holdingLogs'
import { getDestinationLocation, getDisplayNote, getLogActionMeta, isAcquisitionLog } from './logMeta'

export interface TradeRowView {
  title: string
  meta: string
  amount?: string
  amountClass?: string
  sub?: string
  subClass?: string
}

const NOT_A_TICKER = ['CASH', 'FIXED', 'DCA', 'DEBT', 'IMPORT']

const line = (parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(' · ')
const trueMinus = (s: string) => s.replace(/^-/, '−')
const money2 = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const plusOrMinus = (n: number) => (n >= 0 ? '+' : '−')

export function tickerOf(log: HoldingLog): string | undefined {
  return log.ticker && !NOT_A_TICKER.includes(log.ticker) ? log.ticker : undefined
}

export function getTradeRow(log: HoldingLog, usdThb: number | null): TradeRowView {
  const time = new Date(log.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const ticker = tickerOf(log)
  const note = getDisplayNote(log)
  const location = getDestinationLocation(log)

  // A plan change, an import, a debt entry: a record with no amount of its own
  if (!canUndoLog(log)) return { title: log.holdingName, meta: line([time, note]) }

  const cash = log.action === 'dividend' ? [] : getCashDiffItems(log)
  if (cash.length > 1) return { title: log.holdingName, meta: line([time, `${cash.length} accounts`]) }
  if (cash.length === 1) {
    const c = cash[0]
    const change = c.actionType === 'add' ? c.currBalance : c.diff
    const moved = change !== undefined && Math.abs(change) > 0.001
    const state =
      c.actionType === 'add'
        ? 'New account'
        : c.actionType === 'remove'
          ? 'Account removed'
          : c.currBalance !== undefined && moved
            ? `Balance now ${c.currencySymbol}${money2(c.currBalance)}`
            : c.prevName && c.currName && c.prevName !== c.currName
              ? `Was "${c.prevName}"`
              : note
    return {
      title: log.dcaPlanId ? log.holdingName : c.currName ?? c.accountName,
      meta: line([time, state]),
      ...(moved ? { amount: `${plusOrMinus(change)}${c.currencySymbol}${money2(Math.abs(change))}`, amountClass: change > 0 ? 'text-gain-ink' : 'text-ink' } : {}),
    }
  }

  if (log.action === 'transfer' && log.transfer) {
    const t = log.transfer
    const qty = (n: number) => (t.unit === 'sats' ? `${n.toLocaleString()} sats` : t.unit === 'grams' ? `${n.toFixed(4)} g` : `${n.toLocaleString()} ${t.unit}`)
    return {
      title: log.holdingName,
      meta: line([ticker, time, `${t.fromName} → ${t.toName}`]),
      amount: qty(t.received),
      amountClass: 'text-ink-muted',
      ...(t.fee > 0 ? { sub: `Fee ${qty(t.fee)}` } : {}),
    }
  }

  if (log.action === 'dividend') {
    const tx = getLogTransactionDetails(log, usdThb)
    const net = log.netDividend ?? tx.amountThbValue
    return {
      title: log.holdingName,
      meta: line([ticker, time, note]),
      ...(net !== null ? { amount: `+${thb(net, true)}`, amountClass: 'text-gain-ink' } : {}),
    }
  }

  const tx = getLogTransactionDetails(log, usdThb)
  const shares = tx.sharesDisplay !== '-' ? trueMinus(tx.sharesDisplay) : undefined

  if (log.action === 'sell') {
    const pnl = log.realizedPnL
    return {
      title: log.holdingName,
      meta: line([ticker, time, shares, location ?? note]),
      ...(tx.amountThbValue !== null ? { amount: `+${thb(tx.amountThbValue, true)}`, amountClass: 'text-gain-ink' } : {}),
      ...(pnl !== undefined ? { sub: `P&L ${plusOrMinus(pnl)}${thb(Math.abs(pnl), true)}`, subClass: pnl >= 0 ? 'text-gain-ink' : 'text-loss-ink' } : {}),
    }
  }

  if (log.action === 'add' || log.action === 'buy_more') {
    const memo = note.split(' · ').filter((part) => part !== location && part !== 'Automatic DCA buy').join(' · ')
    return {
      title: log.holdingName,
      meta: line([ticker, time, location, memo]),
      ...(tx.amountThbValue !== null ? { amount: thb(tx.amountThbValue, true) } : {}),
      ...(shares ? { sub: shares } : {}),
    }
  }

  // Edits: the units that changed, else the new price; a skipped DCA buy has neither
  const edited = shares ?? (tx.priceDisplay !== '-' ? tx.priceDisplay : undefined)
  return {
    title: log.holdingName,
    meta: line([ticker, time, note]),
    ...(edited ? { amount: edited, amountClass: 'text-ink-muted' } : {}),
  }
}

/** Every word must match the asset, its note, its kind or its location */
export function matchesTrade(log: HoldingLog, terms: string[]): boolean {
  if (terms.length === 0) return true
  const haystack = [log.ticker, log.holdingName, log.note, log.assetClass, getLogActionMeta(log).label, getDestinationLocation(log)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return terms.every((term) => haystack.includes(term))
}

/** Money through these entries, for the line above the list. Gifts cost nothing, and a debt entry is not a sale */
export function tradeTotals(logs: HoldingLog[], usdThb: number | null): { bought: number; sold: number; dividends: number } {
  const totals = { bought: 0, sold: 0, dividends: 0 }
  for (const log of logs) {
    if (log.action === 'dividend') totals.dividends += log.netDividend ?? getLogTransactionDetails(log, usdThb).amountThbValue ?? 0
    else if (log.action === 'sell' && canUndoLog(log)) totals.sold += getLogTransactionDetails(log, usdThb).amountThbValue ?? 0
    else if (isAcquisitionLog(log) && log.source !== 'received') totals.bought += getLogTransactionDetails(log, usdThb).amountThbValue ?? 0
  }
  return totals
}

import { GRAMS_PER_BAHT_GOLD, SATS_PER_BTC } from '../../lib/calc'
import { getCashDiffItems, getLogTransactionDetails } from '../../lib/activitySummary'
import { thb } from '../../lib/format'
import { rateOrZero } from '../../lib/fx'
import type { CashAccount, HoldingLog } from '../../lib/types'

export interface LogDetailsContext {
  cashAccounts: CashAccount[] | undefined
  usdThb: number | null
  /** Whether the "Details" part of this entry is expanded */
  detailsOpen: boolean
  onToggleDetails: () => void
}

/** The before → after comparison under an activity-log entry; null when there is nothing to compare. */
export function renderLogDetails(log: HoldingLog, { cashAccounts, usdThb, detailsOpen, onToggleDetails }: LogDetailsContext) {
  // ── Transfer: where the coins went, and what (if anything) was lost on the way ──
  if (log.action === 'transfer' && log.transfer) {
    const t = log.transfer
    const fmtQty = (n: number) => (t.unit === 'sats' ? `${n.toLocaleString()} sats` : `${n.toFixed(4)} g`)
    return (
      <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 rounded-2xl bg-surface-muted p-4 sm:grid-cols-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-ink-muted">Moved</div>
          <div className="mt-1 text-base font-bold tnum text-ink">{fmtQty(t.amount)}</div>
          <div className="mt-0.5 truncate text-xs text-ink-faint">{t.fromName} → {t.toName}</div>
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-ink-muted">Arrived</div>
          <div className="mt-1 text-base font-bold tnum text-ink">{fmtQty(t.received)}</div>
          <div className="mt-0.5 truncate text-xs text-ink-faint">{t.destCreated ? 'New location' : 'Existing location'}</div>
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-ink-muted">Network fee</div>
          <div className="mt-1 text-base font-bold tnum text-ink">{t.fee > 0 ? fmtQty(t.fee) : 'None'}</div>
          <div className="mt-0.5 truncate text-xs text-ink-faint">Cost carried over: {thb(t.costMoved)}</div>
        </div>
      </div>
    )
  }

  // ── Dividend Action: Unified 3-Column Summary Strip ──
  if (log.action === 'dividend') {
    const netDiv = log.netDividend ?? (log.note.match(/(?:dividend|ปันผล)\s*฿([0-9,.]+)/i) ? parseFloat(log.note.match(/(?:dividend|ปันผล)\s*฿([0-9,.]+)/i)![1].replace(/,/g, '')) : null)
    const tax = log.withholdingTax ?? (log.note.match(/Tax[^:]*:\s*-?฿([0-9,.]+)/i) ? parseFloat(log.note.match(/Tax[^:]*:\s*-?฿([0-9,.]+)/i)![1].replace(/,/g, '')) : null)
    const dps = log.dividendPerShare ?? (log.note.match(/DPS:\s*฿([0-9,.]+)/i) ? parseFloat(log.note.match(/DPS:\s*฿([0-9,.]+)/i)![1].replace(/,/g, '')) : null)
    const gross = log.grossDividend ?? (netDiv !== null && tax !== null ? netDiv + tax : null)
    const prevHold = log.previousHoldingState
    const currHold = log.afterHoldingState
    const holdingUnits = currHold?.units ?? currHold?.totalUnits ?? prevHold?.units ?? prevHold?.totalUnits ?? (gross && dps && dps > 0 ? Math.round(gross / dps) : null)
    const cashAccMatch = log.note.match(/(?:into|เข้า)\s*([^·\n()]+)/i)
    const cashAccName = cashAccMatch ? cashAccMatch[1].trim() : (log.cashAccountId ? cashAccounts?.find((c) => c.id === log.cashAccountId)?.name : undefined)

    return (
      <div className="rounded-2xl bg-surface-muted p-4 space-y-2.5">
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {/* Col 1: net dividend */}
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-ink-muted flex items-center gap-1 truncate">
              <span className="truncate">Net dividend</span>
            </span>
            <div className="text-sm sm:text-base font-black tracking-tight text-emerald-600 dark:text-emerald-400 truncate mt-0.5">
              {netDiv !== null ? `฿${netDiv.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
            </div>
            <span className="text-xs font-medium text-ink-faint truncate mt-0.5" title={cashAccName ? `Into ${cashAccName}` : 'Received into wallet'}>
              {cashAccName ? `Into ${cashAccName}` : 'Received into wallet'}
            </span>
          </div>

          {/* Col 2: tax withheld */}
          <div className="flex flex-col min-w-0 border-l border-line/60 pl-2 sm:pl-3">
            <span className="text-xs font-bold text-ink-muted flex items-center gap-1 truncate">
              <span className="truncate">Tax withheld (10%)</span>
            </span>
            <div className="text-sm sm:text-base font-extrabold tracking-tight text-loss/90 truncate mt-0.5">
              {tax !== null ? `-฿${tax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
            </div>
            {gross !== null && (
              <span className="text-xs font-medium text-ink-faint truncate mt-0.5" title={`Gross ฿${gross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}>
                Gross ฿{gross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            )}
          </div>

          {/* Col 3: dividend per share */}
          <div className="flex flex-col min-w-0 border-l border-line/60 pl-2 sm:pl-3">
            <span className="text-xs font-bold text-ink-muted flex items-center gap-1 truncate">
              <span className="truncate">Dividend per share</span>
            </span>
            <div className="text-sm sm:text-base font-extrabold tracking-tight text-ink truncate mt-0.5">
              {dps !== null ? `฿${dps.toLocaleString()}/share` : '-'}
            </div>
            {holdingUnits && (
              <span className="text-xs font-medium text-ink-faint truncate mt-0.5" title={`From ${holdingUnits.toLocaleString()} shares`}>
                From {holdingUnits.toLocaleString()} shares
              </span>
            )}
          </div>
        </div>
      </div>
    )
  }

  const prev = log.previousHoldingState
  const curr = log.afterHoldingState ?? (log.action === 'sell' && prev ? { ...prev, units: 0, totalUnits: 0, totalThbInvested: 0 } : null)

  if (!prev || !curr) {
    const cashItems = getCashDiffItems(log)
    if (cashItems.length > 0) {
      return (
        <div className="rounded-2xl bg-surface-muted p-4 text-xs space-y-2.5">
          {cashItems.map((item, idx) => {
            const sym = item.currencySymbol
            const hasNameChange = item.prevName && item.currName && item.prevName !== item.currName

            return (
              <div key={idx} className={idx > 0 ? 'pt-2.5 border-t border-line/60 space-y-2' : 'space-y-2'}>
                {/* Account Name Row */}
                {hasNameChange && (
                  <div>
                    <span className="text-ink-faint block text-xs uppercase tracking-wider font-semibold">
                      Account name
                    </span>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-ink mt-0.5">
                      <span className="whitespace-nowrap">{item.prevName}</span>
                      <span className="text-ink-faint text-xs">→</span>
                      <span className="font-semibold text-brand whitespace-nowrap">{item.currName}</span>
                    </div>
                  </div>
                )}

                {/* Account Balance Row */}
                <div>
                  <span className="text-ink-faint block text-xs uppercase tracking-wider font-semibold">
                    {item.actionType === 'add' ? `New Account: ${item.accountName}` : `Balance: ${item.accountName}`}
                  </span>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-ink mt-0.5">
                    {item.actionType === 'add' ? (
                      <>
                        <span className="text-ink-muted text-xs">(New Account)</span>
                        <span className="text-ink-faint text-xs">→</span>
                        <span className="font-bold text-gain whitespace-nowrap">
                          {sym}{item.currBalance?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="rounded-md px-1.5 py-0.5 text-xs font-bold whitespace-nowrap bg-gain/10 text-gain">
                          +{sym}{item.currBalance?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </>
                    ) : item.actionType === 'remove' ? (
                      <>
                        <span className="whitespace-nowrap">
                          {sym}{item.prevBalance?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-ink-faint text-xs">→</span>
                        <span className="font-bold text-loss whitespace-nowrap">(Removed)</span>
                      </>
                    ) : (
                      <>
                        {item.prevBalance !== undefined && (
                          <>
                            <span className="whitespace-nowrap">
                              {sym}{item.prevBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span className="text-ink-faint text-xs">→</span>
                          </>
                        )}
                        <span className="font-bold text-brand whitespace-nowrap">
                          {sym}{item.currBalance?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        {item.diff !== undefined && Math.abs(item.diff) > 0.001 && (
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-xs font-bold whitespace-nowrap ${
                              item.diff > 0 ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss'
                            }`}
                          >
                            {item.diff > 0 ? '+' : ''}{sym}{Math.abs(item.diff).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )
    }

    return null
  }

  const prevUnits = prev.units ?? prev.totalUnits ?? 0
  const currUnits = curr.units ?? curr.totalUnits ?? 0
  const unitDiff = currUnits - prevUnits
  const unitsChanged = Math.abs(unitDiff) > 0.0001 && Number(currUnits.toFixed(4)) !== Number(prevUnits.toFixed(4))

  const prevBasis = prev.totalThbInvested ?? (prevUnits * (prev.avgCostThb ?? prev.avgCost ?? 0))
  const currBasis = curr.totalThbInvested ?? (currUnits * (curr.avgCostThb ?? curr.avgCost ?? 0))
  const prevAvgCostThb = prevUnits > 0 ? prevBasis / prevUnits : (prev.avgCostThb ?? prev.avgCost ?? 0)
  const currAvgCostThb = currUnits > 0 ? currBasis / currUnits : (curr.avgCostThb ?? curr.avgCost ?? 0)
  const avgCostDiffThb = currAvgCostThb - prevAvgCostThb
  const avgCostChanged = Math.abs(avgCostDiffThb) > 0.01 && Number(currAvgCostThb.toFixed(2)) !== Number(prevAvgCostThb.toFixed(2))

  // Real rate or 0: without one, USD figures fall back to THB below instead of using a made-up rate
  const fx = rateOrZero(usdThb)

  // Price change calculations
  const prevPriceThb = prev.price ?? 0
  const currPriceThb = curr.price ?? 0
  const priceDiffThb = currPriceThb - prevPriceThb
  const priceChanged = Math.abs(priceDiffThb) > 0.01 && Number(currPriceThb.toFixed(2)) !== Number(prevPriceThb.toFixed(2))

  const tickerChanged = !!prev.ticker && !!curr.ticker && prev.ticker !== curr.ticker
  const nameChanged = !!prev.name && !!curr.name && prev.name !== curr.name

  const formatUnit = (val: number) => {
    if (log.assetClass === 'crypto') {
      const sats = Math.round(val * SATS_PER_BTC)
      return `${sats.toLocaleString()} sats`
    }
    if (log.assetClass === 'gold') return `${val.toFixed(4)} g (${(val / GRAMS_PER_BAHT_GOLD).toFixed(4)} gold baht)`
    if (log.assetClass === 'stock') return val.toLocaleString(undefined, { maximumFractionDigits: 4 }) + ' shares'
    return val.toLocaleString(undefined, { maximumFractionDigits: 4 }) + ' units'
  }

  const formatUnitDiff = (diff: number) => {
    const prefix = diff > 0 ? '+' : ''
    if (log.assetClass === 'crypto') {
      const sats = Math.round(diff * SATS_PER_BTC)
      return `${prefix}${sats.toLocaleString()} sats`
    }
    if (log.assetClass === 'gold') {
      const baht = diff / GRAMS_PER_BAHT_GOLD
      const formattedBaht = Number.isInteger(Number(baht.toFixed(4))) ? baht.toFixed(0) : baht.toFixed(4)
      return `${prefix}${formattedBaht} gold baht (${prefix}${diff.toFixed(4)} g)`
    }
    if (log.assetClass === 'stock') {
      return `${prefix}${diff.toLocaleString(undefined, { maximumFractionDigits: 4 })} shares`
    }
    return `${prefix}${diff.toLocaleString(undefined, { maximumFractionDigits: 4 })}`
  }

  // Format average cost per asset class
  let prevAvgCostDisplay = ''
  let currAvgCostDisplay = ''
  let avgCostDeltaBadge: { text: string; positive: boolean } | null = null

  if (log.assetClass === 'crypto' && fx > 0) {
    const prevUsd = (prev.avgCostUsd && prev.avgCostUsd > 0) ? prev.avgCostUsd : (fx > 0 ? prevAvgCostThb / fx : 0)
    const currUsd = (curr.avgCostUsd && curr.avgCostUsd > 0) ? curr.avgCostUsd : (fx > 0 ? currAvgCostThb / fx : 0)
    prevAvgCostDisplay = `$${Math.round(prevUsd).toLocaleString()}/BTC`
    currAvgCostDisplay = `$${Math.round(currUsd).toLocaleString()}/BTC`
    const diffUsd = Math.round(currUsd - prevUsd)
    if (diffUsd !== 0 && prevUnits > 0) {
      const sign = diffUsd > 0 ? '+' : '-'
      avgCostDeltaBadge = {
        text: `${sign}$${Math.abs(diffUsd).toLocaleString()}/BTC`,
        positive: diffUsd < 0,
      }
    }
  } else if (log.assetClass === 'stock' && (fx > 0 || ((prev.avgCostUsd ?? 0) > 0 && (curr.avgCostUsd ?? 0) > 0))) {
    const prevUsd = (prev.avgCostUsd && prev.avgCostUsd > 0) ? prev.avgCostUsd : (fx > 0 ? prevAvgCostThb / fx : 0)
    const currUsd = (curr.avgCostUsd && curr.avgCostUsd > 0) ? curr.avgCostUsd : (fx > 0 ? currAvgCostThb / fx : 0)
    prevAvgCostDisplay = `$${prevUsd.toFixed(2)}/share`
    currAvgCostDisplay = `$${currUsd.toFixed(2)}/share`
    const diff = Number((currUsd - prevUsd).toFixed(2))
    if (Math.abs(diff) > 0.001 && prevUnits > 0) {
      const sign = diff > 0 ? '+' : '-'
      avgCostDeltaBadge = {
        text: `${sign}$${Math.abs(diff).toFixed(2)}/share`,
        positive: diff < 0,
      }
    }
  } else if (log.assetClass === 'gold') {
    const prevBaht = prevAvgCostThb * GRAMS_PER_BAHT_GOLD
    const currBaht = currAvgCostThb * GRAMS_PER_BAHT_GOLD

    prevAvgCostDisplay = `฿${Math.round(prevBaht).toLocaleString()}/gold baht`
    currAvgCostDisplay = `฿${Math.round(currBaht).toLocaleString()}/gold baht`
    const diffBaht = Math.round(currBaht - prevBaht)
    if (diffBaht !== 0 && prevUnits > 0) {
      const sign = diffBaht > 0 ? '+' : '-'
      avgCostDeltaBadge = {
        text: `${sign}฿${Math.abs(diffBaht).toLocaleString()}/gold baht`,
        positive: diffBaht < 0,
      }
    }
  } else {
    prevAvgCostDisplay = `฿${prevAvgCostThb.toFixed(2)}/unit`
    currAvgCostDisplay = `฿${currAvgCostThb.toFixed(2)}/unit`
    const diff = Number((currAvgCostThb - prevAvgCostThb).toFixed(2))
    if (Math.abs(diff) > 0.001 && prevUnits > 0) {
      const sign = diff > 0 ? '+' : '-'
      avgCostDeltaBadge = {
        text: `${sign}฿${Math.abs(diff).toFixed(2)}/unit`,
        positive: diff < 0,
      }
    }
  }

  // Format price per asset class
  let prevPriceDisplay = ''
  let currPriceDisplay = ''
  let priceDeltaBadge: { text: string; positive: boolean } | null = null

  if (priceChanged || (log.action === 'edit' && !unitsChanged && !avgCostChanged)) {
    if (log.assetClass === 'stock' && fx > 0) {
      const prevUsd = (prevPriceThb > 0 && fx > 0) ? prevPriceThb / fx : 0
      const currUsd = (currPriceThb > 0 && fx > 0) ? currPriceThb / fx : 0
      prevPriceDisplay = `$${prevUsd.toFixed(2)}/share`
      currPriceDisplay = `$${currUsd.toFixed(2)}/share`
      const diffUsd = Number((currUsd - prevUsd).toFixed(2))
      const pct = prevUsd > 0 ? ((diffUsd / prevUsd) * 100).toFixed(2) : '0.00'
      if (Math.abs(diffUsd) > 0.001) {
        const sign = diffUsd > 0 ? '+' : ''
        priceDeltaBadge = {
          text: `${sign}$${Math.abs(diffUsd).toFixed(2)} (${sign}${pct}%)`,
          positive: diffUsd >= 0,
        }
      }
    } else if (log.assetClass === 'fund' || (fx <= 0 && (log.assetClass === 'stock' || log.assetClass === 'crypto'))) {
      prevPriceDisplay = `฿${prevPriceThb.toFixed(4)}/unit`
      currPriceDisplay = `฿${currPriceThb.toFixed(4)}/unit`
      const diff = Number((currPriceThb - prevPriceThb).toFixed(4))
      const pct = prevPriceThb > 0 ? ((diff / prevPriceThb) * 100).toFixed(2) : '0.00'
      if (Math.abs(diff) > 0.0001) {
        const sign = diff > 0 ? '+' : ''
        priceDeltaBadge = {
          text: `${sign}฿${Math.abs(diff).toFixed(4)} (${sign}${pct}%)`,
          positive: diff >= 0,
        }
      }
    } else if (log.assetClass === 'crypto' && fx > 0) {
      const prevUsd = (prevPriceThb > 0 && fx > 0) ? prevPriceThb / fx : 0
      const currUsd = (currPriceThb > 0 && fx > 0) ? currPriceThb / fx : 0
      prevPriceDisplay = `$${Math.round(prevUsd).toLocaleString()}/BTC`
      currPriceDisplay = `$${Math.round(currUsd).toLocaleString()}/BTC`
      const diffUsd = Math.round(currUsd - prevUsd)
      const pct = prevUsd > 0 ? ((diffUsd / prevUsd) * 100).toFixed(2) : '0.00'
      if (diffUsd !== 0) {
        const sign = diffUsd > 0 ? '+' : ''
        priceDeltaBadge = {
          text: `${sign}$${Math.abs(diffUsd).toLocaleString()} (${sign}${pct}%)`,
          positive: diffUsd >= 0,
        }
      }
    } else if (log.assetClass === 'gold') {
      const prevBaht = prevPriceThb * GRAMS_PER_BAHT_GOLD
      const currBaht = currPriceThb * GRAMS_PER_BAHT_GOLD
      prevPriceDisplay = `฿${Math.round(prevBaht).toLocaleString()}/gold baht`
      currPriceDisplay = `฿${Math.round(currBaht).toLocaleString()}/gold baht`
      const diffBaht = Math.round(currBaht - prevBaht)
      const pct = prevBaht > 0 ? ((diffBaht / prevBaht) * 100).toFixed(2) : '0.00'
      if (diffBaht !== 0) {
        const sign = diffBaht > 0 ? '+' : ''
        priceDeltaBadge = {
          text: `${sign}฿${Math.abs(diffBaht).toLocaleString()} (${sign}${pct}%)`,
          positive: diffBaht >= 0,
        }
      }
    }
  }

  const showTickerRow = tickerChanged && prev.ticker !== curr.ticker
  const showNameRow = nameChanged && prev.name !== curr.name
  const showBalanceRow = (log.action === 'buy_more' || log.action === 'sell')
    ? (formatUnit(prevUnits) !== formatUnit(currUnits) || currUnits === 0)
    : (unitsChanged && formatUnit(prevUnits) !== formatUnit(currUnits))

  const showAvgCostRow = (log.action === 'buy_more' || log.action === 'sell')
    ? (prevAvgCostDisplay !== currAvgCostDisplay && prevAvgCostDisplay !== '' && currAvgCostDisplay !== '')
    : (avgCostChanged && prevAvgCostDisplay !== currAvgCostDisplay && prevAvgCostDisplay !== '' && currAvgCostDisplay !== '')

  const showPriceRow = priceChanged && prevPriceDisplay !== currPriceDisplay && prevPriceDisplay !== '' && currPriceDisplay !== ''

  if (!showTickerRow && !showNameRow && !showBalanceRow && !showAvgCostRow && !showPriceRow && log.action !== 'sell' && log.action !== 'buy_more' && log.action !== 'add') {
    return null
  }

  const isFund = log.assetClass === 'fund'
  const priceLabel = isFund ? 'NAV / Price' : 'Market Price'

  return (
    <div className="rounded-2xl bg-surface-muted p-4 text-xs space-y-2.5">
      {/* Holding Name Row (if renamed) */}
      {showNameRow && (
        <div>
          <span className="text-ink-faint block text-xs uppercase tracking-wider font-semibold">Asset name</span>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-ink mt-0.5">
            <span className="whitespace-nowrap">{prev.name}</span>
            <span className="text-ink-faint text-xs">→</span>
            <span className="font-semibold text-brand whitespace-nowrap">{curr.name}</span>
          </div>
        </div>
      )}

      {/* Ticker Symbol Row (if ticker updated) */}
      {showTickerRow && (
        <div className={showNameRow ? 'pt-1.5 border-t border-line/60' : ''}>
          <span className="text-ink-faint block text-xs uppercase tracking-wider font-semibold">Ticker symbol</span>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-ink mt-0.5">
            <span className="rounded-md bg-surface px-1.5 py-0.5 tnum text-xs font-medium text-ink-muted border border-line">{prev.ticker}</span>
            <span className="text-ink-faint text-xs">→</span>
            <span className="rounded-md bg-brand/10 border border-brand/20 px-1.5 py-0.5 tnum text-xs font-bold text-brand">{curr.ticker}</span>
          </div>
        </div>
      )}

      {log.action === 'sell' ? (() => {
        const pnl = log.realizedPnL ?? (log.note.match(/Realized PnL:\s*([+-]?฿[0-9,.]+)/) ? parseFloat(log.note.match(/Realized PnL:\s*([+-]?฿[0-9,.]+)/)![1].replace(/[฿,]/g, '')) : null)
        const pct = log.realizedPnLPercent ?? (log.note.match(/\(([+-]?[0-9.]+)%\)/) ? parseFloat(log.note.match(/\(([+-]?[0-9.]+)%\)/)![1]) : null)
        const isGain = pnl !== null && pnl >= 0
        const isDetailsOpen = detailsOpen
        const txDetails = getLogTransactionDetails(log, usdThb)
        const cashItems = getCashDiffItems(log)

        let cashDest = ''
        if (cashItems.length > 0) {
          const deposit = cashItems.find((c) => c.diff && c.diff > 0) || cashItems[0]
          if (deposit) cashDest = `Into ${deposit.accountName}`
        } else {
          const depMatch = log.note.match(/(?:Deposited to|ฝากเข้า)\s*([^·\n()]+)/i)
          if (depMatch) cashDest = `Into ${depMatch[1].trim()}`
        }

        return (
          <>
            {/* ── Unified 3-Column Strip for Sell ── */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {/* Col 1: amount received */}
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-ink-muted flex items-center gap-1 truncate">
                  <span className="truncate">Money received</span>
                </span>
                <div className="text-sm sm:text-base font-black tracking-tight text-ink truncate mt-0.5">
                  {txDetails.amountThbDisplay && txDetails.amountThbDisplay !== '-' ? txDetails.amountThbDisplay : (log.proceeds ? thb(log.proceeds) : '-')}
                </div>
                <span className="text-xs font-medium text-ink-faint truncate mt-0.5" title={cashDest || 'Received into wallet'}>
                  {cashDest || 'Received into wallet'}
                </span>
              </div>

              {/* Col 2: sold */}
              <div className="flex flex-col min-w-0 border-l border-line/60 pl-2 sm:pl-3">
                <span className="text-xs font-bold text-ink-muted flex items-center gap-1 truncate">
                  <span className="truncate">Sold</span>
                </span>
                <div className="text-sm sm:text-base font-extrabold tracking-tight text-ink-muted truncate mt-0.5">
                  {txDetails.sharesDisplay && txDetails.sharesDisplay !== '-' ? txDetails.sharesDisplay : (Math.abs(unitDiff) > 0 ? formatUnitDiff(unitDiff) : '-')}
                </div>
                {txDetails.sharesDisplaySecondary && (
                  <div className="text-2xs font-medium text-ink-faint tnum truncate">
                    {txDetails.sharesDisplaySecondary}
                  </div>
                )}
                <span className="text-xs font-medium text-ink-faint truncate mt-0.5">
                  Taken out of portfolio
                </span>
              </div>

              {/* Col 3: profit / loss */}
              <div className="flex flex-col min-w-0 border-l border-line/60 pl-2 sm:pl-3">
                <span className="text-xs font-bold text-ink-muted flex items-center gap-1 truncate">
                  <span className="truncate">{isGain ? 'Net profit' : 'Loss'}</span>
                </span>
                <div className={`text-sm sm:text-base font-black tracking-tight truncate mt-0.5 ${isGain ? 'text-gain' : 'text-loss'}`}>
                  {pnl !== null ? `${isGain ? '+' : ''}${thb(pnl)}` : '-'}
                </div>
                {pct !== null && (
                  <span className={`text-xs font-bold truncate mt-0.5 ${isGain ? 'text-gain' : 'text-loss'}`}>
                    {isGain ? '+' : ''}{pct.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>

            {/* Cash movement row */}
            {cashItems.length > 0 && (
              <div className="pt-2 border-t border-line/50 space-y-1">
                {cashItems.map((item, idx) => {
                  const sym = item.currencySymbol
                  return (
                    <div key={idx} className="flex flex-wrap items-center justify-between text-xs text-ink-muted">
                      <span className="font-semibold text-ink-soft flex items-center gap-1">
                        <span>{item.diff && item.diff < 0 ? 'Paid from' : 'Received into'}: {item.accountName}</span>
                      </span>
                      <div className="flex items-center gap-1 tnum text-xs">
                        {item.prevBalance !== undefined && (
                          <>
                            <span>{sym}{item.prevBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            <span className="text-ink-faint">→</span>
                          </>
                        )}
                        <span className="font-bold text-ink">{sym}{item.currBalance?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        {item.diff !== undefined && (
                          <span className={`rounded px-1 text-xs font-bold ${item.diff > 0 ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss'}`}>
                            {item.diff > 0 ? '+' : ''}{sym}{Math.abs(item.diff).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Collapse toggle for details */}
            {(showPriceRow || showBalanceRow || showAvgCostRow) && (
              <div className="pt-2 border-t border-line/60">
                <button
                  type="button"
                  onClick={() => onToggleDetails()}
                  className="inline-flex items-center gap-1.5 py-0.5 text-xs font-semibold text-ink-muted hover:text-ink active:scale-95 transition-all cursor-pointer select-none"
                >
                  <span>{isDetailsOpen ? '▲ Hide details' : '▼ Show details'}</span>
                </button>

                {isDetailsOpen && (
                  <div className="mt-2 space-y-2 pt-1.5 border-t border-line/40 text-xs">
                    {showPriceRow && (
                      <div>
                        <span className="text-ink-faint block text-xs uppercase tracking-wider font-semibold">
                          {isFund ? 'NAV / price' : 'Market price on sale day'}
                        </span>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-ink mt-0.5">
                          <span className="whitespace-nowrap">{prevPriceDisplay}</span>
                          <span className="text-ink-faint text-xs">→</span>
                          <span className="font-semibold text-brand whitespace-nowrap">{currPriceDisplay}</span>
                          {priceDeltaBadge && (
                            <span className={`rounded-md px-1.5 py-0.5 text-xs font-bold whitespace-nowrap ${priceDeltaBadge.positive ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss'}`}>
                              {priceDeltaBadge.text}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {showBalanceRow && (
                      <div className={showPriceRow ? 'pt-1.5 border-t border-line/60' : ''}>
                        <span className="text-ink-faint block text-xs uppercase tracking-wider font-semibold">Amount left after sale</span>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-ink mt-0.5">
                          <span className="whitespace-nowrap">{formatUnit(prevUnits)}</span>
                          <span className="text-ink-faint text-xs">→</span>
                          {currUnits === 0 ? (
                            <span className="font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">0 (all sold)</span>
                          ) : (
                            <span className="font-semibold text-brand whitespace-nowrap">{formatUnit(currUnits)}</span>
                          )}
                          {Math.abs(unitDiff) > 0.0001 && (
                            <span className={`rounded-md px-1.5 py-0.5 text-xs font-bold whitespace-nowrap ${unitDiff > 0 ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss'}`}>
                              {formatUnitDiff(unitDiff)}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {showAvgCostRow && (
                      <div className={(showPriceRow || showBalanceRow) ? 'pt-1.5 border-t border-line/60' : ''}>
                        <span className="text-ink-faint block text-xs uppercase tracking-wider font-semibold">
                          {(log.assetClass === 'gold' || log.assetClass === 'crypto')
                            ? 'Average cost across all locations (remaining)'
                            : 'Average cost (remaining)'}
                        </span>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-ink mt-0.5">
                          <span className="whitespace-nowrap">{prevAvgCostDisplay}</span>
                          <span className="text-ink-faint text-xs">→</span>
                          <span className="font-semibold text-brand whitespace-nowrap">{currAvgCostDisplay}</span>
                          {avgCostDeltaBadge && (
                            <span className={`rounded-md px-1.5 py-0.5 text-xs font-bold whitespace-nowrap ${avgCostDeltaBadge.positive ? 'bg-gain/10 text-gain' : 'bg-surface-muted text-ink-muted'}`}>
                              {avgCostDeltaBadge.text}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {(log.assetClass === 'gold' || log.assetClass === 'crypto') && (
                      <div className="pt-1.5 border-t border-line/40 text-xs text-ink-muted">
                        <span className="font-medium text-ink-soft">Profit or loss is worked out from the actual cost of the location you sold from.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )
      })() : (log.action === 'buy_more' || log.action === 'add') ? (() => {
        const txDetails = getLogTransactionDetails(log, usdThb)
        const isDetailsOpen = detailsOpen
        const cashItems = getCashDiffItems(log)

        let buyPriceDisplay = ''
        if (txDetails.priceDisplay && txDetails.priceDisplay !== '-') {
          buyPriceDisplay = txDetails.priceDisplay
          if (log.assetClass === 'gold' && !buyPriceDisplay.includes('/')) {
            buyPriceDisplay += '/gold baht'
          } else if (log.assetClass === 'stock' && !buyPriceDisplay.includes('/')) {
            buyPriceDisplay += '/sh'
          } else if (log.assetClass === 'crypto' && !buyPriceDisplay.includes('/')) {
            buyPriceDisplay += '/BTC'
          } else if ((log.assetClass === 'fund' || log.assetClass === 'real_estate') && !buyPriceDisplay.includes('/')) {
            buyPriceDisplay += '/unit'
          }
        } else if (currPriceDisplay) {
          buyPriceDisplay = currPriceDisplay
        }

        let cashSource = ''
        if (cashItems.length > 0) {
          const deduction = cashItems.find((c) => c.diff && c.diff < 0) || cashItems[0]
          if (deduction) cashSource = `From ${deduction.accountName}`
        } else {
          const paidMatch = log.note.match(/(?:Paid from|จ่ายจาก)\s*([^·\n()]+)/i)
          if (paidMatch) cashSource = `From ${paidMatch[1].trim()}`
        }
        const isReceived = log.source === 'received'
        const receivedLine = isReceived ? (log.receivedFrom ? `From ${log.receivedFrom}` : 'Gift / inheritance') : ''

        return (
          <>
            {/* ── Unified 3-Column Strip for Buy / Add ── */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {/* Col 1: amount bought */}
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-ink-muted flex items-center gap-1 truncate">
                  <span className="truncate">{isReceived ? 'Value received' : 'Amount bought'}</span>
                </span>
                <div className="text-sm sm:text-base font-black tracking-tight text-sky-700 dark:text-sky-300 truncate mt-0.5">
                  {txDetails.amountThbDisplay && txDetails.amountThbDisplay !== '-' ? txDetails.amountThbDisplay : (txDetails.sharesDisplay || '-')}
                </div>
                <span className="text-xs font-medium text-ink-faint truncate mt-0.5" title={receivedLine || cashSource || 'Invested'}>
                  {receivedLine || cashSource || 'Invested'}
                </span>
              </div>

              {/* Col 2: units received */}
              <div className="flex flex-col min-w-0 border-l border-line/60 pl-2 sm:pl-3">
                <span className="text-xs font-bold text-ink-muted flex items-center gap-1 truncate">
                  <span className="truncate">Units received</span>
                </span>
                <div className="text-sm sm:text-base font-extrabold tracking-tight text-gain truncate mt-0.5">
                  {txDetails.sharesDisplay && txDetails.sharesDisplay !== '-' ? txDetails.sharesDisplay : (unitDiff > 0 ? formatUnitDiff(unitDiff) : '-')}
                </div>
                {txDetails.sharesDisplaySecondary && (
                  <div className="text-2xs font-medium text-ink-faint tnum truncate">
                    {txDetails.sharesDisplaySecondary}
                  </div>
                )}
                <span className="text-xs font-medium text-ink-faint truncate mt-0.5">
                  Added to portfolio
                </span>
              </div>

              {/* Col 3: purchase price */}
              <div className="flex flex-col min-w-0 border-l border-line/60 pl-2 sm:pl-3">
                <span className="text-xs font-bold text-ink-muted flex items-center gap-1 truncate">
                  <span className="truncate">{isReceived ? 'Price that day' : 'Buy price'}</span>
                </span>
                <div className="text-sm sm:text-base font-extrabold tracking-tight text-ink truncate mt-0.5">
                  {buyPriceDisplay || '-'}
                </div>
                <span className="text-xs font-medium text-ink-faint truncate mt-0.5">
                  {isReceived ? 'Your cost per unit' : 'Price per unit'}
                </span>
              </div>
            </div>

            {/* Cash movement row */}
            {cashItems.length > 0 && (
              <div className="pt-2 border-t border-line/50 space-y-1">
                {cashItems.map((item, idx) => {
                  const sym = item.currencySymbol
                  return (
                    <div key={idx} className="flex flex-wrap items-center justify-between text-xs text-ink-muted">
                      <span className="font-semibold text-ink-soft flex items-center gap-1">
                        <span>{item.diff && item.diff < 0 ? 'Paid from' : 'Received into'}: {item.accountName}</span>
                      </span>
                      <div className="flex items-center gap-1 tnum text-xs">
                        {item.prevBalance !== undefined && (
                          <>
                            <span>{sym}{item.prevBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            <span className="text-ink-faint">→</span>
                          </>
                        )}
                        <span className="font-bold text-ink">{sym}{item.currBalance?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        {item.diff !== undefined && (
                          <span className={`rounded px-1 text-xs font-bold ${item.diff > 0 ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss'}`}>
                            {item.diff > 0 ? '+' : ''}{sym}{Math.abs(item.diff).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Collapse toggle for details */}
            {(showPriceRow || showBalanceRow || showAvgCostRow) && (
              <div className="pt-2 border-t border-line/60">
                <button
                  type="button"
                  onClick={() => onToggleDetails()}
                  className="inline-flex items-center gap-1.5 py-0.5 text-xs font-semibold text-ink-muted hover:text-ink active:scale-95 transition-all cursor-pointer select-none"
                >
                  <span>{isDetailsOpen ? '▲ Hide details' : '▼ Show details'}</span>
                </button>

                {isDetailsOpen && (
                  <div className="mt-2 space-y-2 pt-1.5 border-t border-line/40 text-xs">
                    {showPriceRow && (
                      <div>
                        <span className="text-ink-faint block text-xs uppercase tracking-wider font-semibold">
                          {priceLabel}
                        </span>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-ink mt-0.5">
                          <span className="whitespace-nowrap">{prevPriceDisplay}</span>
                          <span className="text-ink-faint text-xs">→</span>
                          <span className="font-semibold text-brand whitespace-nowrap">{currPriceDisplay}</span>
                          {priceDeltaBadge && (
                            <span className={`rounded-md px-1.5 py-0.5 text-xs font-bold whitespace-nowrap ${priceDeltaBadge.positive ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss'}`}>
                              {priceDeltaBadge.text}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {showBalanceRow && (
                      <div className={showPriceRow ? 'pt-1.5 border-t border-line/60' : ''}>
                        <span className="text-ink-faint block text-xs uppercase tracking-wider font-semibold">Total holding</span>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-ink mt-0.5">
                          <span className="whitespace-nowrap">{formatUnit(prevUnits)}</span>
                          <span className="text-ink-faint text-xs">→</span>
                          <span className="font-semibold text-brand whitespace-nowrap">{formatUnit(currUnits)}</span>
                          {Math.abs(unitDiff) > 0.0001 && (
                            <span className={`rounded-md px-1.5 py-0.5 text-xs font-bold whitespace-nowrap ${unitDiff > 0 ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss'}`}>
                              {formatUnitDiff(unitDiff)}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {showAvgCostRow && (
                      <div className={(showPriceRow || showBalanceRow) ? 'pt-1.5 border-t border-line/60' : ''}>
                        <span className="text-ink-faint block text-xs uppercase tracking-wider font-semibold">
                          New average cost
                        </span>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-ink mt-0.5">
                          <span className="whitespace-nowrap">{prevAvgCostDisplay}</span>
                          <span className="text-ink-faint text-xs">→</span>
                          <span className="font-semibold text-brand whitespace-nowrap">{currAvgCostDisplay}</span>
                          {avgCostDeltaBadge && (
                            <span className={`rounded-md px-1.5 py-0.5 text-xs font-bold whitespace-nowrap ${avgCostDeltaBadge.positive ? 'bg-gain/10 text-gain' : 'bg-surface-muted text-ink-muted'}`}>
                              {avgCostDeltaBadge.text}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )
      })() : (() => {
        const isPriceOnly = showPriceRow && !unitsChanged && !avgCostChanged && !showNameRow && !showTickerRow

        if (isPriceOnly) {
          return (
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {/* Col 1: old price */}
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-ink-muted flex items-center gap-1 truncate">
                  <span className="truncate">Old price</span>
                </span>
                <div className="text-sm sm:text-base font-extrabold tracking-tight text-ink-muted truncate mt-0.5">
                  {prevPriceDisplay}
                </div>
                <span className="text-xs font-medium text-ink-faint truncate mt-0.5">
                  Before update
                </span>
              </div>

              {/* Col 2: new price */}
              <div className="flex flex-col min-w-0 border-l border-line/60 pl-2 sm:pl-3">
                <span className="text-xs font-bold text-ink-muted flex items-center gap-1 truncate">
                  <span className="truncate">New price</span>
                </span>
                <div className="text-sm sm:text-base font-black tracking-tight text-brand truncate mt-0.5">
                  {currPriceDisplay}
                </div>
                <span className="text-xs font-medium text-ink-faint truncate mt-0.5">
                  {isFund ? 'Current NAV' : 'Latest market price'}
                </span>
              </div>

              {/* Col 3: change */}
              <div className="flex flex-col min-w-0 border-l border-line/60 pl-2 sm:pl-3">
                <span className="text-xs font-bold text-ink-muted flex items-center gap-1 truncate">
                  <span className="truncate">Change</span>
                </span>
                <div className={`text-sm sm:text-base font-black tracking-tight truncate mt-0.5 ${priceDeltaBadge?.positive ? 'text-gain' : 'text-loss'}`}>
                  {priceDeltaBadge ? priceDeltaBadge.text.split(' ')[0] : '-'}
                </div>
                {priceDeltaBadge && priceDeltaBadge.text.includes('(') && (
                  <span className={`text-xs font-bold truncate mt-0.5 ${priceDeltaBadge?.positive ? 'text-gain' : 'text-loss'}`}>
                    {priceDeltaBadge.text.substring(priceDeltaBadge.text.indexOf('(')).replace(/[()]/g, '')}
                  </span>
                )}
              </div>
            </div>
          )
        }

        return (
          <>
            {/* ── NON-SELL / NON-BUY General Edit ── */}
            {showPriceRow && (
              <div className={(showNameRow || showTickerRow) ? 'pt-1.5 border-t border-line/60' : ''}>
                <span className="text-ink-faint block text-xs uppercase tracking-wider font-semibold">
                  {priceLabel}
                </span>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-ink mt-0.5">
                  <span className="whitespace-nowrap">{prevPriceDisplay}</span>
                  <span className="text-ink-faint text-xs">→</span>
                  <span className="font-semibold text-brand whitespace-nowrap">{currPriceDisplay}</span>
                  {priceDeltaBadge && (
                    <span className={`rounded-md px-1.5 py-0.5 text-xs font-bold whitespace-nowrap ${priceDeltaBadge.positive ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss'}`}>
                      {priceDeltaBadge.text}
                    </span>
                  )}
                </div>
              </div>
            )}

            {showBalanceRow && (
              <div className={(showNameRow || showTickerRow || showPriceRow) ? 'pt-1.5 border-t border-line/60' : ''}>
                <span className="text-ink-faint block text-xs uppercase tracking-wider font-semibold">Holding balance</span>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-ink mt-0.5">
                  <span className="whitespace-nowrap">{formatUnit(prevUnits)}</span>
                  <span className="text-ink-faint text-xs">→</span>
                  <span className="font-semibold text-brand whitespace-nowrap">{formatUnit(currUnits)}</span>
                  {Math.abs(unitDiff) > 0.0001 && (
                    <span className={`rounded-md px-1.5 py-0.5 text-xs font-bold whitespace-nowrap ${unitDiff > 0 ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss'}`}>
                      {formatUnitDiff(unitDiff)}
                    </span>
                  )}
                </div>
              </div>
            )}

            {showAvgCostRow && (
              <div className={(showNameRow || showTickerRow || showPriceRow || showBalanceRow) ? 'pt-1.5 border-t border-line/60' : ''}>
                <span className="text-ink-faint block text-xs uppercase tracking-wider font-semibold">Average cost</span>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-ink mt-0.5">
                  <span className="whitespace-nowrap">{prevAvgCostDisplay}</span>
                  <span className="text-ink-faint text-xs">→</span>
                  <span className="font-semibold text-brand whitespace-nowrap">{currAvgCostDisplay}</span>
                  {avgCostDeltaBadge && (
                    <span className={`rounded-md px-1.5 py-0.5 text-xs font-bold whitespace-nowrap ${avgCostDeltaBadge.positive ? 'bg-gain/10 text-gain' : 'bg-surface-muted text-ink-muted'}`}>
                      {avgCostDeltaBadge.text}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Linked Cash Account Row */}
            {(() => {
              const cashItems = getCashDiffItems(log)
              if (cashItems.length === 0) return null
              return (
                <div className="pt-1.5 border-t border-line/60 space-y-1.5">
                  {cashItems.map((item, idx) => {
                    const sym = item.currencySymbol
                    return (
                      <div key={idx}>
                        <span className="text-ink-faint block text-xs uppercase tracking-wider font-semibold">
                          {item.diff && item.diff > 0 ? 'Cash Deposit' : 'Cash Deduction'}: {item.accountName}
                        </span>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-ink mt-0.5">
                          {item.prevBalance !== undefined && (
                            <>
                              <span className="whitespace-nowrap">{sym}{item.prevBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              <span className="text-ink-faint text-xs">→</span>
                            </>
                          )}
                          <span className="font-bold text-brand whitespace-nowrap">{sym}{item.currBalance?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          {item.diff !== undefined && (
                            <span className={`rounded-md px-1.5 py-0.5 text-xs font-bold whitespace-nowrap ${item.diff > 0 ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss'}`}>
                              {item.diff > 0 ? '+' : ''}{sym}{Math.abs(item.diff).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </>
        )
      })()}
    </div>
  )
}

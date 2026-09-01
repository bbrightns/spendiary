import { useState } from 'react'
import { useData } from '../store/DataContext'
import { useToast } from '../store/ToastContext'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Modal } from '../components/ui/Modal'
import { GuideTour } from '../components/guide/GuideTour'
import { usePageGuide } from '../hooks/usePageGuide'
import { ASSET_META, GRAMS_PER_BAHT_GOLD, SATS_PER_BTC, goldThbPerGramToXauUsd } from '../lib/calc'
import type { AssetClass, HoldingLog } from '../lib/types'
import { ClockIcon, UndoIcon, WalletIcon } from '../components/icons'


interface ActionMeta {
  label: string
  style: string
  icon: string
  isPriceUpdate: boolean
}

function getLogActionMeta(log: HoldingLog): ActionMeta {
  if (log.action === 'add') {
    return {
      label: 'Added',
      style: 'bg-gain/10 text-gain',
      icon: '+',
      isPriceUpdate: false,
    }
  }

  if (log.action === 'buy_more') {
    return {
      label: log.dcaPlanId ? 'DCA Buy' : 'Bought more',
      style: 'bg-brand/10 text-brand',
      icon: '↑',
      isPriceUpdate: false,
    }
  }

  // edit action
  const prev = log.previousHoldingState
  const curr = log.afterHoldingState
  if (prev && curr) {
    const prevUnits = prev.units ?? prev.totalUnits ?? 0
    const currUnits = curr.units ?? curr.totalUnits ?? 0
    const unitDiff = Math.abs(currUnits - prevUnits)

    const prevBasis = prev.totalThbInvested ?? (prevUnits * (prev.avgCostThb ?? prev.avgCost ?? 0))
    const currBasis = curr.totalThbInvested ?? (currUnits * (curr.avgCostThb ?? curr.avgCost ?? 0))
    const basisDiff = Math.abs(currBasis - prevBasis)

    const prevPrice = prev.price ?? 0
    const currPrice = curr.price ?? 0
    const priceDiff = Math.abs(currPrice - prevPrice)

    if (priceDiff > 0.001 && unitDiff < 0.00001 && basisDiff < 0.01) {
      const isFund = log.assetClass === 'fund'
      return {
        label: isFund ? 'NAV Updated' : 'Price Updated',
        style: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20',
        icon: '🏷️',
        isPriceUpdate: true,
      }
    }
  }

  if (log.note && (log.note.toLowerCase().includes('price') || log.note.toLowerCase().includes('nav')) && !log.note.includes('+') && !log.note.includes('shares @') && !log.note.includes('units @')) {
    return {
      label: log.assetClass === 'fund' ? 'NAV Updated' : 'Price Updated',
      style: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20',
      icon: '🏷️',
      isPriceUpdate: true,
    }
  }

  return {
    label: 'Edited',
    style: 'bg-surface-muted text-ink-muted',
    icon: '✎',
    isPriceUpdate: false,
  }
}

const ASSET_FILTERS: { key: AssetClass | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'fund', label: 'Funds' },
  { key: 'stock', label: 'Stocks' },
  { key: 'crypto', label: 'Bitcoin' },
  { key: 'gold', label: 'Gold' },
  { key: 'cash', label: 'Cash' },
]

const ACTION_FILTERS = [
  { key: 'all', label: 'All actions' },
  { key: 'add', label: 'Added' },
  { key: 'buy_more', label: 'Bought more' },
  { key: 'edit', label: 'Edited' },
] as const

export function HoldingLogs() {
  const {
    steps,
    isRunning,
    currentStepIndex,
    startTour,
    endTour,
    finishTour,
    nextStep,
    prevStep,
  } = usePageGuide('logs')
  const { data, undoHoldingLog, usdThb } = useData()
  const { showToast } = useToast()
  const logs = data.holdingLogs ?? []

  const [undoTarget, setUndoTarget] = useState<HoldingLog | null>(null)
  const [assetFilter, setAssetFilter] = useState<AssetClass | 'all'>('all')
  const [actionFilter, setActionFilter] = useState<'all' | 'add' | 'buy_more' | 'edit'>('all')

  const filtered = logs.filter((l) => {
    if (assetFilter !== 'all' && l.assetClass !== assetFilter) return false
    if (actionFilter !== 'all' && l.action !== actionFilter) return false
    return true
  })

  // Group by date
  const groups: { date: string; entries: typeof filtered }[] = []
  for (const log of filtered) {
    const date = new Date(log.timestamp).toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
    })
    const last = groups[groups.length - 1]
    if (last && last.date === date) {
      last.entries.push(log)
    } else {
      groups.push({ date, entries: [log] })
    }
  }

  // Helper to detect destination wallet / storage location
  const getDestinationLocation = (log: typeof filtered[number]): string | null => {
    const prev = log.previousHoldingState
    const curr = log.afterHoldingState

    if (log.assetClass === 'crypto') {
      const prevLocs = prev?.btcLocations ?? []
      const currLocs = curr?.btcLocations ?? []
      for (const c of currLocs) {
        const p = prevLocs.find((item) => item.id === c.id || item.name === c.name)
        if (!p || c.satoshi > p.satoshi || c.thbSpent > p.thbSpent) {
          return c.name
        }
      }
      if (currLocs.length === 1) return currLocs[0].name
    }

    if (log.assetClass === 'gold') {
      const prevLocs = prev?.goldLocations ?? []
      const currLocs = curr?.goldLocations ?? []
      for (const c of currLocs) {
        const p = prevLocs.find((item) => item.id === c.id || item.name === c.name)
        if (!p || c.grams > p.grams || c.thbSpent > p.thbSpent) {
          return c.name
        }
      }
      if (currLocs.length === 1) return currLocs[0].name
    }

    if (log.note) {
      const match = log.note.match(/(?:·|→)\s*([A-Za-z0-9\s_-]+)$/)
      if (match && match[1]) {
        const name = match[1].trim()
        if (!name.startsWith('(+') && !name.startsWith('฿') && !name.startsWith('$') && !name.endsWith('spent')) {
          return name
        }
      }
    }

    return null
  }

  // Helper to render before -> after comparison details
  const renderStateComparison = (log: typeof filtered[number]) => {
    const prev = log.previousHoldingState
    const curr = log.afterHoldingState

    if (!prev || !curr) return null

    const prevUnits = prev.units ?? prev.totalUnits ?? 0
    const currUnits = curr.units ?? curr.totalUnits ?? 0
    const unitDiff = currUnits - prevUnits
    const unitsChanged = Math.abs(unitDiff) > 0.00001

    const prevBasis = prev.totalThbInvested ?? (prevUnits * (prev.avgCostThb ?? prev.avgCost ?? 0))
    const currBasis = curr.totalThbInvested ?? (currUnits * (curr.avgCostThb ?? curr.avgCost ?? 0))
    const basisDiff = currBasis - prevBasis
    const basisChanged = Math.abs(basisDiff) > 0.01

    const prevAvgCostThb = prevUnits > 0 ? prevBasis / prevUnits : (prev.avgCostThb ?? prev.avgCost ?? 0)
    const currAvgCostThb = currUnits > 0 ? currBasis / currUnits : (curr.avgCostThb ?? curr.avgCost ?? 0)
    const avgCostDiffThb = currAvgCostThb - prevAvgCostThb
    const avgCostChanged = Math.abs(avgCostDiffThb) > 0.001

    const fx = usdThb && usdThb > 0 ? usdThb : 34

    // Price change calculations
    const prevPriceThb = prev.price ?? 0
    const currPriceThb = curr.price ?? 0
    const priceDiffThb = currPriceThb - prevPriceThb
    const priceChanged = Math.abs(priceDiffThb) > 0.001

    const formatUnit = (val: number) => {
      if (log.assetClass === 'crypto') {
        const sats = Math.round(val * SATS_PER_BTC)
        return `${sats.toLocaleString()} sats`
      }
      if (log.assetClass === 'gold') return `${val.toFixed(4)} g (${(val / GRAMS_PER_BAHT_GOLD).toFixed(4)} บาททอง)`
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
        return `${prefix}${diff.toFixed(4)} g`
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

    if (log.assetClass === 'crypto') {
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
    } else if (log.assetClass === 'stock') {
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
      const prevXauUsd = goldThbPerGramToXauUsd(prevAvgCostThb, fx)
      const currXauUsd = goldThbPerGramToXauUsd(currAvgCostThb, fx)

      prevAvgCostDisplay = `฿${Math.round(prevBaht).toLocaleString()}/บาททอง ($${Math.round(prevXauUsd).toLocaleString()}/oz)`
      currAvgCostDisplay = `฿${Math.round(currBaht).toLocaleString()}/บาททอง ($${Math.round(currXauUsd).toLocaleString()}/oz)`
      const diffBaht = Math.round(currBaht - prevBaht)
      if (diffBaht !== 0 && prevUnits > 0) {
        const sign = diffBaht > 0 ? '+' : '-'
        avgCostDeltaBadge = {
          text: `${sign}฿${Math.abs(diffBaht).toLocaleString()}/บาททอง`,
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
      if (log.assetClass === 'stock') {
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
      } else if (log.assetClass === 'fund') {
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
      } else if (log.assetClass === 'crypto') {
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
        prevPriceDisplay = `฿${Math.round(prevBaht).toLocaleString()}/บาททอง`
        currPriceDisplay = `฿${Math.round(currBaht).toLocaleString()}/บาททอง`
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

    const showBalanceRow = log.action === 'buy_more' ? true : unitsChanged
    const showAvgCostRow = log.action === 'buy_more' ? true : (avgCostChanged || basisChanged)
    const showPriceRow = (priceChanged || (log.action === 'edit' && !showBalanceRow && !showAvgCostRow)) && prevPriceDisplay !== ''

    if (!showBalanceRow && !showAvgCostRow && !showPriceRow) {
      return null
    }

    const isFund = log.assetClass === 'fund'
    const priceLabel = isFund ? 'NAV / Price' : 'Market Price'

    return (
      <div className="mt-3 rounded-xl border border-line bg-surface-muted/50 p-3 text-[12.5px] space-y-2.5">
        {/* Price / NAV Row */}
        {showPriceRow && (
          <div>
            <span className="text-ink-faint block text-[10.5px] uppercase tracking-wider font-semibold">
              {priceLabel}
            </span>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-ink mt-0.5">
              <span className="whitespace-nowrap">{prevPriceDisplay}</span>
              <span className="text-ink-faint text-[11px]">→</span>
              <span className="font-semibold text-brand whitespace-nowrap">{currPriceDisplay}</span>
              {priceDeltaBadge && (
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold whitespace-nowrap ${
                    priceDeltaBadge.positive ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss'
                  }`}
                >
                  {priceDeltaBadge.text}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Holding Balance */}
        {showBalanceRow && (
          <div className={showPriceRow ? 'pt-1.5 border-t border-line/60' : ''}>
            <span className="text-ink-faint block text-[10.5px] uppercase tracking-wider font-semibold">Holding Balance</span>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-ink mt-0.5">
              <span className="whitespace-nowrap">{formatUnit(prevUnits)}</span>
              <span className="text-ink-faint text-[11px]">→</span>
              <span className="font-semibold text-brand whitespace-nowrap">{formatUnit(currUnits)}</span>
              {Math.abs(unitDiff) > 0.00001 && (
                <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold whitespace-nowrap ${unitDiff > 0 ? 'bg-gain/10 text-gain' : 'bg-surface-muted text-ink-muted'}`}>
                  {formatUnitDiff(unitDiff)}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Average Cost */}
        {showAvgCostRow && (
          <div className={(showPriceRow || showBalanceRow) ? 'pt-1.5 border-t border-line/60' : ''}>
            <span className="text-ink-faint block text-[10.5px] uppercase tracking-wider font-semibold">Average Cost</span>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-ink mt-0.5">
              <span className="whitespace-nowrap">{prevAvgCostDisplay}</span>
              <span className="text-ink-faint text-[11px]">→</span>
              <span className="font-semibold text-brand whitespace-nowrap">{currAvgCostDisplay}</span>
              {avgCostDeltaBadge && (
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold whitespace-nowrap ${
                    avgCostDeltaBadge.positive ? 'bg-gain/10 text-gain' : 'bg-surface-muted text-ink-muted'
                  }`}
                >
                  {avgCostDeltaBadge.text}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="Portfolio"
        title="Activity Logs"
        onStartGuide={startTour}
      />

      {/* Filters */}
      <div id="guide-logs-header" className="mb-5 space-y-2.5">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
          {ASSET_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setAssetFilter(f.key)}
              aria-label={`Filter by ${f.label}`}
              aria-pressed={assetFilter === f.key}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors cursor-pointer ${
                assetFilter === f.key ? 'bg-ink text-white dark:bg-[#4f46e5]' : 'bg-surface-muted text-ink-soft hover:text-ink'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
          {ACTION_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setActionFilter(f.key)}
              aria-label={`Filter by ${f.label}`}
              aria-pressed={actionFilter === f.key}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors cursor-pointer ${
                actionFilter === f.key ? 'bg-ink text-white dark:bg-[#4f46e5]' : 'bg-surface-muted text-ink-soft hover:text-ink'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div id="guide-logs-list">
        {filtered.length === 0 ? (
          <Card>
            <EmptyState
              icon={<ClockIcon className="h-7 w-7" />}
              title="No activity yet"
              description="Actions you take in Portfolio (adding, buying more, or editing holdings) will appear here."
              accent="var(--color-brand)"
            />
          </Card>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.date}>
                <p className="mb-2.5 px-1 text-[12.5px] font-bold text-ink-soft tracking-wide">{group.date}</p>
                <Card padded={false}>
                  <ul className="divide-y divide-line">
                  {group.entries.map((log) => {
                    const locName = getDestinationLocation(log)
                    const actionMeta = getLogActionMeta(log)
                    return (
                      <li key={log.id} className="flex items-start gap-3.5 px-5 py-4 transition-colors hover:bg-surface-muted/30">
                        <span
                          className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[14px] font-bold shadow-sm"
                          style={{
                            color: ASSET_META[log.assetClass]?.color ?? '#6366f1',
                            background: `color-mix(in srgb, ${ASSET_META[log.assetClass]?.color ?? '#6366f1'} 14%, transparent)`,
                          }}
                        >
                          {actionMeta.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-[14.5px] font-bold text-ink">{log.holdingName}</span>
                            {log.ticker && log.ticker !== 'CASH' && log.ticker !== 'FIXED' && log.ticker !== 'DCA' && (
                              <span className="rounded-md bg-surface-muted px-1.5 py-0.5 text-[11px] font-medium text-ink-muted">
                                {log.ticker}
                              </span>
                            )}
                            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${actionMeta.style}`}>
                              {actionMeta.label}
                            </span>
                            {locName && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 border border-brand/20 px-2 py-0.5 text-[11px] font-semibold text-brand">
                                <WalletIcon className="h-3 w-3" />
                                {locName}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-[13px] font-medium text-ink-muted leading-relaxed">{log.note}</p>
                          
                          {/* State comparison (Before -> After) */}
                          {renderStateComparison(log)}
                        </div>

                        <div className="flex flex-col items-end gap-2 shrink-0 pt-0.5">
                          <time className="text-[11.5px] font-medium text-ink-faint">
                            {new Date(log.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                          </time>
                          <button
                            onClick={() => setUndoTarget(log)}
                            aria-label={`Undo activity for ${log.holdingName}`}
                            className="rounded-lg px-2 py-1 text-[11.5px] font-bold text-loss hover:bg-loss/10 transition-colors cursor-pointer"
                          >
                            Undo
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </Card>
            </div>
          ))}
        </div>
      )}
      </div>

      {/* Custom Undo Confirmation Modal */}
      <Modal
        open={!!undoTarget}
        onClose={() => setUndoTarget(null)}
        title={`Undo "${undoTarget?.holdingName}"?`}
        description="This will revert your portfolio balance and holdings state to before this activity was recorded."
      >
        <div className="space-y-4 pb-1">
          {undoTarget && (() => {
            const undoMeta = getLogActionMeta(undoTarget)
            return (
              <div className="rounded-2xl border border-line bg-surface-muted p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[12px] font-bold"
                      style={{
                        color: ASSET_META[undoTarget.assetClass]?.color ?? '#6366f1',
                        background: `color-mix(in srgb, ${ASSET_META[undoTarget.assetClass]?.color ?? '#6366f1'} 14%, transparent)`,
                      }}
                    >
                      {undoMeta.icon}
                    </span>
                    <span className="font-bold text-[14px] text-ink truncate">{undoTarget.holdingName}</span>
                    {undoTarget.ticker && undoTarget.ticker !== 'CASH' && undoTarget.ticker !== 'FIXED' && undoTarget.ticker !== 'DCA' && (
                      <span className="rounded-md bg-surface px-1.5 py-0.5 text-[11px] font-medium text-ink-muted">
                        {undoTarget.ticker}
                      </span>
                    )}
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${undoMeta.style}`}>
                    {undoMeta.label}
                  </span>
                </div>
                <p className="text-[12.5px] font-medium text-ink-muted leading-relaxed">{undoTarget.note}</p>
                <time className="block text-[11px] text-ink-faint">
                  {new Date(undoTarget.timestamp).toLocaleString('en-GB', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </time>
              </div>
            )
          })()}

          <div className="flex flex-col gap-2.5 pt-1">
            <button
              onClick={() => {
                if (undoTarget) {
                  undoHoldingLog(undoTarget.id)
                  showToast(`Undid activity for "${undoTarget.holdingName}"`, 'info')
                }
                setUndoTarget(null)
              }}
              aria-label={`Confirm undo activity for ${undoTarget?.holdingName ?? ''}`}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-loss px-5 text-sm font-bold text-white dark:bg-rose-600 dark:hover:bg-rose-700 transition-all hover:opacity-90 active:scale-[0.98] cursor-pointer shadow-sm"
            >
              <UndoIcon className="h-4 w-4" strokeWidth={2.4} />
              <span>Yes, undo activity</span>
            </button>
            <button
              onClick={() => setUndoTarget(null)}
              aria-label="Cancel undo"
              className="w-full rounded-full py-2.5 text-[14px] font-semibold text-ink-muted transition-colors hover:text-ink cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      <GuideTour
        isOpen={isRunning}
        steps={steps}
        currentStepIndex={currentStepIndex}
        onNext={nextStep}
        onPrev={prevStep}
        onClose={endTour}
        onFinish={finishTour}
      />
    </>
  )
}



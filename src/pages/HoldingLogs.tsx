import { useState } from 'react'
import { useData } from '../store/DataContext'
import { useToast } from '../store/ToastContext'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Modal } from '../components/ui/Modal'
import { ASSET_META, GRAMS_PER_BAHT_GOLD, SATS_PER_BTC } from '../lib/calc'
import type { AssetClass, HoldingLog } from '../lib/types'
import { ClockIcon, UndoIcon, WalletIcon } from '../components/icons'

const ACTION_LABEL = {
  add: 'Added',
  buy_more: 'Bought more',
  edit: 'Edited',
}

const ACTION_STYLE = {
  add: 'bg-gain/10 text-gain',
  buy_more: 'bg-brand/10 text-brand',
  edit: 'bg-surface-muted text-ink-muted',
}

const ACTION_ICON = {
  add: '+',
  buy_more: '↑',
  edit: '✎',
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

    if (prev && curr) {
      const prevUnits = prev.units ?? prev.totalUnits ?? 0
      const currUnits = curr.units ?? curr.totalUnits ?? 0
      const unitDiff = currUnits - prevUnits

      const prevBasis = prev.totalThbInvested ?? (prevUnits * (prev.avgCostThb ?? prev.avgCost ?? 0))
      const currBasis = curr.totalThbInvested ?? (currUnits * (curr.avgCostThb ?? curr.avgCost ?? 0))

      const prevAvgCostThb = prevUnits > 0 ? prevBasis / prevUnits : (prev.avgCostThb ?? prev.avgCost ?? 0)
      const currAvgCostThb = currUnits > 0 ? currBasis / currUnits : (curr.avgCostThb ?? curr.avgCost ?? 0)

      const fx = usdThb && usdThb > 0 ? usdThb : 34

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
        if (log.assetClass === 'crypto') {
          const sats = Math.round(diff * SATS_PER_BTC)
          return `+${sats.toLocaleString()} sats`
        }
        if (log.assetClass === 'gold') {
          return `+${diff.toFixed(4)} g`
        }
        if (log.assetClass === 'stock') {
          return `+${diff.toLocaleString(undefined, { maximumFractionDigits: 4 })} shares`
        }
        return `+${diff.toLocaleString(undefined, { maximumFractionDigits: 4 })}`
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
        if (diff !== 0 && prevUnits > 0) {
          const sign = diff > 0 ? '+' : '-'
          avgCostDeltaBadge = {
            text: `${sign}$${Math.abs(diff).toFixed(2)}/share`,
            positive: diff < 0,
          }
        }
      } else if (log.assetClass === 'gold') {
        prevAvgCostDisplay = `฿${prevAvgCostThb.toFixed(2)}/g`
        currAvgCostDisplay = `฿${currAvgCostThb.toFixed(2)}/g`
        const diff = Number((currAvgCostThb - prevAvgCostThb).toFixed(2))
        if (diff !== 0 && prevUnits > 0) {
          const sign = diff > 0 ? '+' : '-'
          avgCostDeltaBadge = {
            text: `${sign}฿${Math.abs(diff).toFixed(2)}/g`,
            positive: diff < 0,
          }
        }
      } else {
        prevAvgCostDisplay = `฿${prevAvgCostThb.toFixed(2)}/unit`
        currAvgCostDisplay = `฿${currAvgCostThb.toFixed(2)}/unit`
        const diff = Number((currAvgCostThb - prevAvgCostThb).toFixed(2))
        if (diff !== 0 && prevUnits > 0) {
          const sign = diff > 0 ? '+' : '-'
          avgCostDeltaBadge = {
            text: `${sign}฿${Math.abs(diff).toFixed(2)}/unit`,
            positive: diff < 0,
          }
        }
      }

      return (
        <div className="mt-3 rounded-xl border border-line bg-surface-muted/50 p-3 text-[12.5px] space-y-2.5">
          {/* Holding Balance */}
          <div>
            <span className="text-ink-faint block text-[10.5px] uppercase tracking-wider font-semibold">Holding Balance</span>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-ink mt-0.5">
              <span className="whitespace-nowrap">{formatUnit(prevUnits)}</span>
              <span className="text-ink-faint text-[11px]">→</span>
              <span className="font-semibold text-brand whitespace-nowrap">{formatUnit(currUnits)}</span>
              {unitDiff > 0 && (
                <span className="rounded-md bg-gain/10 px-1.5 py-0.5 text-[11px] font-bold text-gain whitespace-nowrap">
                  {formatUnitDiff(unitDiff)}
                </span>
              )}
            </div>
          </div>

          {/* Average Cost */}
          <div className="pt-1.5 border-t border-line/60">
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
        </div>
      )
    }

    return null
  }

  return (
    <>
      <PageHeader eyebrow="Portfolio" title="Activity Logs" />

      {/* Filters */}
      <div className="mb-5 space-y-2.5">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
          {ASSET_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setAssetFilter(f.key)}
              aria-label={`Filter by ${f.label}`}
              aria-pressed={assetFilter === f.key}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors cursor-pointer ${
                assetFilter === f.key ? 'bg-ink text-white dark:bg-brand dark:text-white' : 'bg-surface-muted text-ink-soft hover:text-ink'
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
                actionFilter === f.key ? 'bg-ink text-white dark:bg-brand dark:text-white' : 'bg-surface-muted text-ink-soft hover:text-ink'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

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
                    return (
                      <li key={log.id} className="flex items-start gap-3.5 px-5 py-4 transition-colors hover:bg-surface-muted/30">
                        <span
                          className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[14px] font-bold shadow-sm"
                          style={{
                            color: ASSET_META[log.assetClass]?.color ?? '#6366f1',
                            background: `color-mix(in srgb, ${ASSET_META[log.assetClass]?.color ?? '#6366f1'} 14%, transparent)`,
                          }}
                        >
                          {ACTION_ICON[log.action]}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-[14.5px] font-bold text-ink">{log.holdingName}</span>
                            {log.ticker && log.ticker !== 'CASH' && log.ticker !== 'FIXED' && log.ticker !== 'DCA' && (
                              <span className="rounded-md bg-surface-muted px-1.5 py-0.5 text-[11px] font-medium text-ink-muted">
                                {log.ticker}
                              </span>
                            )}
                            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${ACTION_STYLE[log.action]}`}>
                              {ACTION_LABEL[log.action]}
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

      {/* Custom Undo Confirmation Modal */}
      <Modal
        open={!!undoTarget}
        onClose={() => setUndoTarget(null)}
        title={`Undo "${undoTarget?.holdingName}"?`}
        description="This will revert your portfolio balance and holdings state to before this activity was recorded."
      >
        <div className="space-y-4 pb-1">
          {undoTarget && (
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
                    {ACTION_ICON[undoTarget.action]}
                  </span>
                  <span className="font-bold text-[14px] text-ink truncate">{undoTarget.holdingName}</span>
                  {undoTarget.ticker && undoTarget.ticker !== 'CASH' && undoTarget.ticker !== 'FIXED' && undoTarget.ticker !== 'DCA' && (
                    <span className="rounded-md bg-surface px-1.5 py-0.5 text-[11px] font-medium text-ink-muted">
                      {undoTarget.ticker}
                    </span>
                  )}
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${ACTION_STYLE[undoTarget.action]}`}>
                  {ACTION_LABEL[undoTarget.action]}
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
          )}

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
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-loss px-5 text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.98] cursor-pointer shadow-sm"
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
    </>
  )
}


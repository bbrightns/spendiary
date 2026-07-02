import { useState } from 'react'

import { useData } from '../store/DataContext'
import { useLivePrices } from '../hooks/useLivePrices'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { AddButton } from '../components/ui/AddButton'
import { DonutChart } from '../components/charts/DonutChart'
import { PnLPill, PnLText } from '../components/ui/PnL'
import { HoldingForm } from '../components/forms/HoldingForm'
import { BuyMoreForm } from '../components/forms/BuyMoreForm'
import { Modal } from '../components/ui/Modal'
import { NumberField, TextField } from '../components/ui/Field'
import { Button } from '../components/ui/Button'
import { PlusIcon, PortfolioIcon, TrashIcon, PencilIcon } from '../components/icons'
import {
  ASSET_META,
  allocations,
  holdingMetrics,
  portfolioSummary,
  totalCash,
} from '../lib/calc'
import type { AssetClass, BtcLocation, Holding } from '../lib/types'
import { pct, thb, thbCompact, formatNumber } from '../lib/format'

const FILTERS: { key: AssetClass | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'fund', label: 'Mutual Funds' },
  { key: 'stock', label: 'US Stocks' },
  { key: 'crypto', label: 'Bitcoin' },
  { key: 'gold', label: 'Gold' },
]

const SATS_PER_BTC = 100_000_000

export function Portfolio() {
  const {
    data,
    removeHolding,
    upsertBtcLocation,
    removeBtcLocation,
    upsertGoldLocation,
    removeGoldLocation,
    setRebalanceTargets,
  } = useData()
  const { status: priceStatus, lastUpdated, usdThb, goldThbPerGram, errorMsg, refresh: refreshPrices } = useLivePrices()
  const [filter, setFilter] = useState<AssetClass | 'all'>('all')
  const [sortBy, setSortBy] = useState<'none' | 'value' | 'pnl' | 'type'>('none')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [search, setSearch] = useState('')

  // Rebalancing states
  const [rebalanceOpen, setRebalanceOpen] = useState(false)
  const [newCash, setNewCash] = useState<number | ''>('')
  const [smartRebalance, setSmartRebalance] = useState(false)

  const initialTargets: Record<AssetClass, number> = data.rebalanceTargets ?? {
    fund: 40,
    stock: 30,
    crypto: 20,
    gold: 0,
    cash: 10,
  }
  const [targets, setLocalTargets] = useState<Record<AssetClass, number>>(initialTargets)

  // Derived values for rebalancing
  const totalCashVal = totalCash(data)
  const portVal = data.holdings.reduce((sum, h) => sum + h.units * h.price, 0)
  const currentNetWorth = totalCashVal + portVal

  const actualVals: Record<AssetClass, number> = {
    fund: data.holdings.filter(h => h.assetClass === 'fund').reduce((s, h) => s + h.units * h.price, 0),
    stock: data.holdings.filter(h => h.assetClass === 'stock').reduce((s, h) => s + h.units * h.price, 0),
    crypto: data.holdings.filter(h => h.assetClass === 'crypto').reduce((s, h) => s + h.units * h.price, 0),
    gold: data.holdings.filter(h => h.assetClass === 'gold').reduce((s, h) => s + h.units * h.price, 0),
    cash: totalCashVal,
  }

  const targetsSum = Object.values(targets).reduce((s, x) => s + x, 0)
  const cashToDeploy = Number(newCash) || 0
  const targetTotalValue = currentNetWorth + cashToDeploy

  const handleTargetChange = (key: AssetClass, val: number) => {
    const updated = { ...targets, [key]: val }
    setLocalTargets(updated)
    const sum = Object.values(updated).reduce((s, x) => s + x, 0)
    if (sum === 100) {
      setRebalanceTargets(updated)
    }
  }

  const rebalanceRows = (Object.keys(targets) as AssetClass[]).map((key) => {
    const actualVal = actualVals[key]
    const actualPct = currentNetWorth > 0 ? (actualVal / currentNetWorth) * 100 : 0
    const targetPct = targets[key]
    const targetVal = (targetPct / 100) * targetTotalValue

    let diff = targetVal - actualVal
    let actionLabel = '—'
    let actionCls = 'text-ink-muted'

    if (targetsSum === 100) {
      if (diff > 5) {
        actionLabel = `Buy ${thbCompact(diff)}`
        actionCls = 'text-gain font-semibold'
      } else if (diff < -5) {
        actionLabel = `Sell ${thbCompact(Math.abs(diff))}`
        actionCls = 'text-loss font-semibold'
      } else {
        actionLabel = 'Balanced'
        actionCls = 'text-ink-muted font-medium'
      }
    }

    return {
      key,
      actualVal,
      actualPct,
      targetPct,
      targetVal,
      diff,
      actionLabel,
      actionCls,
    }
  })

  // Smart Rebalancing math pass
  if (targetsSum === 100 && smartRebalance && cashToDeploy > 0) {
    const deficits = (Object.keys(targets) as AssetClass[]).map(key => {
      const actualVal = actualVals[key]
      const targetVal = (targets[key] / 100) * targetTotalValue
      return { key, deficit: Math.max(0, targetVal - actualVal) }
    })
    const totalDeficit = deficits.reduce((s, d) => s + d.deficit, 0)

    rebalanceRows.forEach((row) => {
      const def = deficits.find(d => d.key === row.key)
      if (def && def.deficit > 0) {
        const allocated = totalDeficit > 0 ? cashToDeploy * (def.deficit / totalDeficit) : 0
        if (allocated > 5) {
          row.actionLabel = `Add ${thbCompact(allocated)}`
          row.actionCls = 'text-brand font-semibold'
        } else {
          row.actionLabel = 'Balanced'
          row.actionCls = 'text-ink-muted font-medium'
        }
      } else {
        row.actionLabel = 'Balanced'
        row.actionCls = 'text-ink-muted font-medium'
      }
    })
  }

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Holding | null>(null)
  const [buyOpen, setBuyOpen] = useState(false)
  const [buying, setBuying] = useState<Holding | null>(null)

  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null)

  // BTC / Gold location expansion
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [locEditOpen, setLocEditOpen] = useState(false)
  const [locEditHoldingId, setLocEditHoldingId] = useState<string>('')
  const [locEditing, setLocEditing] = useState<BtcLocation | import('../lib/types').GoldLocation | null>(null)
  const [locName, setLocName] = useState('')
  const [locSatoshi, setLocSatoshi] = useState<number | ''>('')
  const [locGrams, setLocGrams] = useState<number | ''>('')
  const [locThbSpent, setLocThbSpent] = useState<number | ''>('')
  const [locErrors, setLocErrors] = useState(false)

  const summary = portfolioSummary(data.holdings)
  const alloc = allocations(data.holdings)

  const openAdd = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (h: Holding) => { setEditing(h); setFormOpen(true) }
  const openBuy = (h: Holding) => { setBuying(h); setBuyOpen(true) }
  function openLocEdit(holdingId: string, loc: BtcLocation | import('../lib/types').GoldLocation) {
    setLocEditHoldingId(holdingId)
    setLocEditing(loc)
    setLocName(loc.name)
    if ('satoshi' in loc) {
      setLocSatoshi(loc.satoshi)
      setLocGrams('')
    } else {
      setLocGrams(loc.grams)
      setLocSatoshi('')
    }
    setLocThbSpent(loc.thbSpent)
    setLocErrors(false)
    setLocEditOpen(true)
  }

  function saveLocEdit() {
    if (!locEditing || !locName.trim() || locThbSpent === '') {
      setLocErrors(true)
      return
    }
    if ('satoshi' in locEditing && locSatoshi === '') {
      setLocErrors(true)
      return
    }
    if (!('satoshi' in locEditing) && locGrams === '') {
      setLocErrors(true)
      return
    }

    if ('satoshi' in locEditing) {
      upsertBtcLocation(locEditHoldingId, {
        id: locEditing.id,
        name: locName.trim(),
        satoshi: Number(locSatoshi),
        thbSpent: Number(locThbSpent),
      })
    } else {
      upsertGoldLocation(locEditHoldingId, {
        id: locEditing.id,
        name: locName.trim(),
        grams: Number(locGrams),
        thbSpent: Number(locThbSpent),
      })
    }
    setLocEditOpen(false)
  }


  if (data.holdings.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Holdings" title="Portfolio" />
        <Card>
          <EmptyState
            icon={<PortfolioIcon className="h-7 w-7" />}
            title="No holdings yet"
            description="Add your mutual funds, US stocks, and Bitcoin to see allocation, value, and profit/loss at a glance."
            accent="var(--color-funds)"
            action={<AddButton onClick={openAdd} label="Add holding" />}
          />
        </Card>
        <HoldingForm open={formOpen} editing={editing} onClose={() => setFormOpen(false)} />
      </>
    )
  }

  const TYPE_ORDER: Record<AssetClass, number> = { crypto: 0, gold: 1, stock: 2, fund: 3, cash: 4 }

  const searchLower = search.toLowerCase()
  const rows = data.holdings
    .map(holdingMetrics)
    .filter((h) => filter === 'all' || h.assetClass === filter)
    .filter((h) =>
      !search ||
      h.name.toLowerCase().includes(searchLower) ||
      h.ticker.toLowerCase().includes(searchLower),
    )
    .sort((a, b) => {
      if (sortBy === 'none') return 0
      const dir = sortDir === 'desc' ? -1 : 1
      if (sortBy === 'value') return dir * (a.marketValue - b.marketValue)
      if (sortBy === 'pnl')   return dir * (a.pnlPct - b.pnlPct)
      if (sortBy === 'type')  return dir * (TYPE_ORDER[a.assetClass] - TYPE_ORDER[b.assetClass])
      return 0
    })

  const segments = alloc.map((a) => ({
    label: ASSET_META[a.assetClass].plural,
    value: a.value,
    color: ASSET_META[a.assetClass].color,
  }))

  return (
    <>
      <PageHeader
        eyebrow="Holdings"
        title="Portfolio"
        subtitle={
          <span
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 flex-wrap text-[14.5px] text-ink-muted"
          >
            {priceStatus === 'loading' && 'Fetching live prices…'}
            {priceStatus === 'ok' && lastUpdated && (
              <>
                <span className="inline-block h-2 w-2 rounded-full bg-gain animate-pulse" />
                Live · updated {lastUpdated.toLocaleTimeString()}
                {usdThb && <span className="text-ink-soft">· USD/THB {usdThb.toFixed(2)}</span>}
                {goldThbPerGram !== null && (
                  <span className="text-ink-soft">· Gold {formatNumber(goldThbPerGram, 4)} THB/g</span>
                )}
              </>
            )}
            {priceStatus === 'partial' && lastUpdated && (
              <>
                <span className="inline-block h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                Partial update · {lastUpdated.toLocaleTimeString()}
                {usdThb && <span className="text-ink-soft">· USD/THB {usdThb.toFixed(2)}</span>}
                {goldThbPerGram !== null && (
                  <span className="text-ink-soft">· Gold {formatNumber(goldThbPerGram, 4)} THB/g</span>
                )}
                <span className="text-loss text-[12px]">{errorMsg}</span>
              </>
            )}
            {priceStatus === 'error' && (
              <span className="text-loss">
                Price fetch failed ·{' '}
                <button onClick={refreshPrices} className="underline">retry</button>
              </span>
            )}
            {priceStatus === 'idle' && "Valued at the latest prices you've filled in."}
          </span>
        }
      />

      <div className="grid grid-cols-1 gap-4 ">
        {/* Allocation chart */}
        <Card className=" animate-rise">
          <h2 className="font-display text-[17px] font-bold text-ink [text-wrap:balance]">Asset Allocation</h2>
          <div className="mt-5 flex flex-col items-center gap-6">
            <DonutChart
              segments={segments}
              ariaLabel={`Portfolio asset allocation, total value ${thb(summary.value)}`}
              centerLabel="Total"
              centerValue={thbCompact(summary.value)}
            />
            <ul className="w-full space-y-2.5">
              {alloc.map((a) => (
                <li key={a.assetClass} className="flex items-center gap-3">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: ASSET_META[a.assetClass].color }}
                  />
                  <span className="flex-1 text-[14px] font-medium text-ink">
                    {ASSET_META[a.assetClass].plural}
                  </span>
                  <span className="text-[13px] font-semibold tnum text-ink-muted">
                    {pct(a.pct, 0)}
                  </span>
                  <span className="w-20 text-right text-[14px] font-semibold tnum text-ink">
                    {thbCompact(a.value)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        {/* Rebalancing Calculator */}
        <Card className="animate-rise">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[17px] font-bold text-ink">Rebalancing Calculator</h2>
            <button
              onClick={() => setRebalanceOpen(!rebalanceOpen)}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-3.5 text-[12px] font-semibold text-white shadow-[var(--shadow-soft)] transition-all duration-200 hover:bg-ink-hover dark:bg-[#4f46e5] dark:hover:bg-[#4338ca] active:scale-95 cursor-pointer whitespace-nowrap"
            >
              {rebalanceOpen ? 'Collapse' : 'Configure & Calculate'}
            </button>
          </div>
          
          {rebalanceOpen && (
            <div className="mt-5 space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <NumberField
                  label="New Cash to Deploy"
                  prefix="฿"
                  value={newCash}
                  onChange={setNewCash}
                  placeholder="e.g. 50,000"
                />
                
                {Number(newCash) > 0 && (
                  <div className="flex flex-col justify-end pb-1.5">
                    <label className="flex items-center gap-2 text-[13.5px] font-semibold text-ink-soft cursor-pointer">
                      <input
                        type="checkbox"
                        checked={smartRebalance}
                        onChange={(e) => setSmartRebalance(e.target.checked)}
                        className="rounded border-line-strong text-brand focus:ring-brand/15 h-4 w-4"
                      />
                      Smart Rebalancing (Buy Only)
                    </label>
                    <p className="mt-1 text-[11px] text-ink-muted">
                      Directs new cash solely to underweight classes. No sell recommendations.
                    </p>
                  </div>
                )}
              </div>

              {targetsSum !== 100 && (
                <div className="rounded-xl border border-warn/25 bg-warn-soft px-3.5 py-2.5 text-[12.5px] text-warn font-semibold flex items-center gap-2">
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <path d="M8 5v4M8 11.5v.5" strokeLinecap="round" />
                    <circle cx={8} cy={8} r={6.5} />
                  </svg>
                  <span>Allocation targets sum to {targetsSum}%. Must equal 100% to calculate trades.</span>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12.5px] border-collapse">
                  <thead>
                    <tr className="text-ink-muted border-b border-line pb-1.5 font-medium">
                      <th className="pb-1.5 font-semibold text-left">Asset</th>
                      <th className="pb-1.5 font-semibold text-right">Actual</th>
                      <th className="pb-1.5 font-semibold text-center w-[75px]">Target</th>
                      <th className="pb-1.5 font-semibold text-right">Advice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rebalanceRows.map((row) => {
                      const color = ASSET_META[row.key]?.color ?? 'var(--color-cash)'
                      const shortName = row.key === 'fund' ? 'Funds' : row.key === 'stock' ? 'Stocks' : row.key === 'crypto' ? 'Bitcoin' : row.key === 'gold' ? 'Gold' : 'Cash'

                      return (
                        <tr key={row.key} className="border-b border-line last:border-0 align-middle">
                          {/* Asset Name + Target Value */}
                          <td className="py-2.5 text-left font-medium text-ink">
                            <div className="flex items-center gap-1.5">
                              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                              <span className="truncate">{shortName}</span>
                            </div>
                            <div className="text-[10px] text-ink-muted pl-3.5">
                              Tgt: {targetsSum === 100 ? thbCompact(row.targetVal) : '—'}
                            </div>
                          </td>
                          
                          {/* Actual Value */}
                          <td className="py-2.5 text-right tnum text-ink-soft">
                            <div className="font-semibold">{thbCompact(row.actualVal)}</div>
                            <div className="text-[10px] text-ink-muted">{row.actualPct.toFixed(0)}%</div>
                          </td>

                          {/* Target input % */}
                          <td className="py-2.5 text-center">
                            <div className="inline-flex items-center rounded-lg border border-line-strong px-1.5 py-0.5 bg-surface-muted max-w-[65px] mx-auto">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={row.targetPct}
                                onChange={(e) => handleTargetChange(row.key, Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                                className="w-full text-center outline-none bg-transparent tnum text-[12.5px] font-bold text-ink"
                              />
                              <span className="text-[10px] text-ink-muted font-bold ml-0.5">%</span>
                            </div>
                          </td>

                          {/* Action Advice */}
                          <td className="py-2.5 text-right tnum font-bold">
                            {targetsSum === 100 ? (
                              <span className={row.diff > 5 ? 'text-gain' : row.diff < -5 ? 'text-loss' : 'text-ink-muted'}>
                                {row.actionLabel}
                              </span>
                            ) : (
                              <span className="text-ink-muted">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>

        {/* Performance summary + holdings list */}
        <Card className=" animate-rise overflow-hidden" padded={false}>
          {/* Summary metrics */}
          <div className="grid grid-cols-2 gap-5  p-5  ">
            <Metric label="Current Value" value={thb(summary.value)} />
            <Metric label="Amount Invested" value={thb(summary.cost)} muted />
            <Metric
              label="Total Profit / Loss"
              valueNode={<PnLText value={summary.pnl} className="text-[22px]" />}
              extra={<PnLPill value={summary.pnlPct} asPct />}
            />
          </div>

          {/* Holdings list */}
          <div className="mt-6 border-t border-line pt-5">
            <div className="px-5 ">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-[15px] font-bold text-ink">
                  Holdings
                  <span className="ml-2 rounded-full bg-surface-muted px-2 py-0.5 text-[12px] font-semibold text-ink-muted">
                    {rows.length}
                  </span>
                </h3>
                <AddButton onClick={openAdd} label="Add holding" />
              </div>

              {/* Search */}
              <div className="relative mb-3">
                <svg
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
                  viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8}
                >
                  <circle cx={6.5} cy={6.5} r={4.5} />
                  <path d="M10.5 10.5l3 3" strokeLinecap="round" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or ticker…"
                  className="w-full rounded-xl border border-line bg-surface-muted py-2 pl-9 pr-8 text-[13.5px] text-ink outline-none placeholder:text-ink-faint focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-ink-faint hover:text-ink"
                  >
                    <svg viewBox="0 0 12 12" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                      <path d="M2 2l8 8M10 2l-8 8" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Filter pills */}
              <div className="mb-2 flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                      filter === f.key
                        ? 'bg-ink text-white dark:bg-[#4f46e5] dark:text-white'
                        : 'bg-surface-muted text-ink-soft hover:text-ink'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Sort controls */}
              <div className="mb-4 flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                <span className="shrink-0 text-[11px] font-medium text-ink-faint">Sort:</span>
                {([ ['value','Value'], ['pnl','Profit %'], ['type','Type'] ] as const).map(([key, label]) => {
                  const active = sortBy === key
                  const showDir = active && key !== 'type'
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        if (active && key !== 'type') {
                          setSortDir((d) => d === 'desc' ? 'asc' : 'desc')
                        } else {
                          setSortBy(key)
                          setSortDir('desc')
                        }
                      }}
                      className={`flex shrink-0 items-center gap-0.5 rounded-full px-3 py-1 text-[12px] font-semibold transition-colors ${
                        active
                          ? 'bg-brand text-white dark:bg-[#4f46e5]'
                          : 'bg-surface-muted text-ink-soft hover:text-ink'
                      }`}
                    >
                      {label}
                      {showDir && (
                        <span className="ml-0.5 text-[10px]">{sortDir === 'desc' ? '↓' : '↑'}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            <ul className="divide-y divide-line border-t border-line">
              {rows.map((h) => {
                const isBtc = h.assetClass === 'crypto'
                const isGold = h.assetClass === 'gold'
                const isExpandable = isBtc || isGold
                const isExpanded = isExpandable && expandedId === h.id

                // Circular ticker badge (Google Finance style)
                const tickerLabel = h.ticker.slice(0, 4).toUpperCase()
                const tickerFontSize = tickerLabel.length <= 2 ? 'text-[13px]' : tickerLabel.length === 3 ? 'text-[11px]' : 'text-[10px]'
                const badge = (
                  <span
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-full font-bold text-white ${tickerFontSize}`}
                    style={{ background: ASSET_META[h.assetClass].color }}
                  >
                    {tickerLabel}
                  </span>
                )

                const unitsLabel = isBtc
                  ? `${Math.round(h.units * SATS_PER_BTC).toLocaleString()} sats`
                  : isGold
                  ? `${h.units.toFixed(4)} g · Gold`
                  : `${h.units.toLocaleString()} ${unitLabel(h.assetClass)} · ${ASSET_META[h.assetClass].label}`

                const staleIndicator = isPriceStale(h.updatedAt) && (
                  <span title={`Price last updated: ${h.updatedAt ?? 'unknown'}`} aria-label="Price is stale" className="h-2 w-2 shrink-0 rounded-full bg-warn" />
                )

                const chevron = isExpandable && (
                  <svg aria-hidden="true" width={14} height={14} viewBox="0 0 14 14" fill="none"
                    className={`shrink-0 text-ink-muted transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                    <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )

                const buyBtn = (
                  <button
                    onClick={(e) => { e.stopPropagation(); openBuy(h) }}
                    aria-label={`Buy more ${h.name}`}
                    title="Buy more"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand transition-all hover:bg-brand hover:text-white active:scale-95"
                  >
                    <PlusIcon className="h-[16px] w-[16px]" strokeWidth={2.2} />
                  </button>
                )

                const rowClick = () => {
                  if (isExpandable) setExpandedId(isExpanded ? null : h.id)
                  else openEdit(h)
                }

                return (
                  <li
                    key={h.id}
                    className="overflow-hidden transition-colors hover:bg-surface-muted/50"
                  >
                    {/* ── Mobile (< sm): compact 2-row ── */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={rowClick}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); rowClick() } }}
                      aria-label={isExpandable ? (isExpanded ? `Collapse ${h.name}` : `Expand ${h.name}`) : `Edit ${h.name}`}
                      className="flex  cursor-pointer items-center gap-3 px-5 py-3.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    >
                      {badge}
                      <div className="min-w-0 flex-1">
                        {/* Line 1: name + value */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <p className="truncate text-[14px] font-semibold text-ink">{h.name}</p>
                            {staleIndicator}{chevron}
                          </div>
                          <p className="shrink-0 text-[14px] font-bold tnum text-ink">{thb(h.marketValue)}</p>
                        </div>
                        {/* Line 2: units + PnL% */}
                        <div className="mt-0.5 flex items-center justify-between gap-2">
                          <p className="truncate text-[12px] text-ink-muted">{unitsLabel}</p>
                          <PnLPill value={h.pnlPct} asPct />
                        </div>
                      </div>
                      {buyBtn}
                    </div>

                    {/* ── Desktop (≥ sm): richer 2-row ── */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={rowClick}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); rowClick() } }}
                      aria-label={isExpandable ? (isExpanded ? `Collapse ${h.name}` : `Expand ${h.name}`) : `Edit ${h.name}`}
                      className="hidden  cursor-pointer items-center gap-3 px-6 py-3.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    >
                      {badge}
                      <div className="min-w-0 flex-1">
                        {/* Line 1: name + value */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <p className="truncate text-[15px] font-semibold text-ink">{h.name}</p>
                            {staleIndicator}{chevron}
                          </div>
                          <p className="shrink-0 text-[15px] font-bold tnum text-ink">{thb(h.marketValue)}</p>
                        </div>
                        {/* Line 2: units · type + PnL amount + PnL % */}
                        <div className="mt-0.5 flex items-center justify-between gap-3">
                          <p className="truncate text-[12.5px] text-ink-muted">{unitsLabel}</p>
                          <div className="flex shrink-0 items-center gap-2">
                            <PnLText value={h.pnl} className="text-[12.5px]" />
                            <PnLPill value={h.pnlPct} asPct />
                          </div>
                        </div>
                      </div>
                      {buyBtn}
                    </div>

                    {/* BTC / Gold sub-breakdown panel */}
                    {isExpandable && isExpanded && (
                      <div className="border-t border-line bg-surface-muted px-5 pb-3.5 pt-2.5 ">
                        <p className="mb-2 text-[12px] font-semibold text-ink-muted">Locations</p>

                        {isBtc && (
                          (h.btcLocations ?? []).length === 0
                            ? <p className="py-1 text-[13px] text-ink-muted">No locations yet. Use "Buy more" to add.</p>
                            : (
                              <ul className="space-y-1.5">
                                {(h.btcLocations ?? []).map((loc) => (
                                  <li key={loc.id} className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2">
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[13px] font-semibold text-ink">{loc.name}</p>
                                      <p className="tnum text-[12px] text-ink-muted">
                                        {loc.satoshi.toLocaleString()} sats · {thb(loc.thbSpent)} spent
                                      </p>
                                    </div>
                                    <button
                                      onClick={() => openLocEdit(h.id, loc)}
                                      aria-label={`Edit location ${loc.name}`}
                                      className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
                                    >
                                      <PencilIcon className="h-[14px] w-[14px]" />
                                    </button>
                                    <button
                                      onClick={() => removeBtcLocation(h.id, loc.id)}
                                      aria-label={`Remove location ${loc.name}`}
                                      className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-loss/10 hover:text-loss"
                                    >
                                      <TrashIcon className="h-[14px] w-[14px]" />
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )
                        )}

                         {isGold && (
                          (h.goldLocations ?? []).length === 0
                            ? <p className="py-1 text-[13px] text-ink-muted">No locations yet. Use "Buy more" to add.</p>
                            : (
                              <ul className="space-y-1.5">
                                {(h.goldLocations ?? []).map((loc) => (
                                  <li key={loc.id} className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2">
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[13px] font-semibold text-ink">{loc.name}</p>
                                      <p className="tnum text-[12px] text-ink-muted">
                                        {loc.grams.toFixed(4)} g · {thb(loc.thbSpent)} spent
                                      </p>
                                    </div>
                                    <button
                                      onClick={() => openLocEdit(h.id, loc)}
                                      aria-label={`Edit location ${loc.name}`}
                                      className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
                                    >
                                      <PencilIcon className="h-[14px] w-[14px]" />
                                    </button>
                                    <button
                                      onClick={() => removeGoldLocation(h.id, loc.id)}
                                      aria-label={`Remove location ${loc.name}`}
                                      className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-loss/10 hover:text-loss"
                                    >
                                      <TrashIcon className="h-[14px] w-[14px]" />
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        </Card>
      </div>

      <HoldingForm open={formOpen} editing={editing} onClose={() => setFormOpen(false)} />
      <BuyMoreForm open={buyOpen} holding={buying} onClose={() => setBuyOpen(false)} />

      {/* BTC / Gold location edit modal */}
      <Modal
        open={locEditOpen}
        onClose={() => setLocEditOpen(false)}
        title="Edit location"
        description={locEditing && !('satoshi' in locEditing) ? "Update this location's name, grams, or THB spent." : "Update this location's name, satoshi amount, or THB spent."}
      >
        <div className="space-y-4 pb-2">
          <TextField
            label="Location name"
            value={locName}
            onChange={setLocName}
            placeholder="e.g. Ledger"
            error={locErrors && !locName.trim() ? 'Required' : undefined}
          />
          <div className="grid grid-cols-1 gap-3 ">
            {locEditing && 'satoshi' in locEditing ? (
              <NumberField
                label="Satoshi"
                value={locSatoshi}
                onChange={setLocSatoshi}
                placeholder="0"
                step={1}
                error={locErrors && (locSatoshi === '' || Number(locSatoshi) < 0) ? 'Required' : undefined}
              />
            ) : (
              <NumberField
                label="Grams"
                value={locGrams}
                onChange={setLocGrams}
                placeholder="0.00"
                step={0.0001}
                error={locErrors && (locGrams === '' || Number(locGrams) < 0) ? 'Required' : undefined}
              />
            )}
            <NumberField
              label="THB spent"
              prefix="฿"
              value={locThbSpent}
              onChange={setLocThbSpent}
              placeholder="0"
              error={locErrors && (locThbSpent === '' || Number(locThbSpent) < 0) ? 'Required' : undefined}
            />
          </div>
          <div className="pt-2">
            <Button onClick={saveLocEdit} className="w-full">Save changes</Button>
          </div>
        </div>
      </Modal>

      {/* Remove holding confirmation */}
      <Modal
        open={removeConfirmOpen}
        onClose={() => { setRemoveConfirmOpen(false); setRemoveTarget(null) }}
        title={`Remove "${removeTarget?.name}"?`}
        description="This will permanently delete the holding and all its transaction history. This cannot be undone."
      >
        <div className="flex flex-col gap-3 pb-1">
          <button
            onClick={() => {
              if (removeTarget) removeHolding(removeTarget.id)
              setRemoveConfirmOpen(false)
              setRemoveTarget(null)
            }}
            className="inline-flex h-11 w-full items-center justify-center rounded-full bg-loss px-5 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
          >
            Yes, remove holding
          </button>
          <button
            onClick={() => { setRemoveConfirmOpen(false); setRemoveTarget(null) }}
            className="w-full rounded-full py-2.5 text-[14px] font-semibold text-ink-muted transition-colors hover:text-ink"
          >
            Cancel
          </button>
        </div>
      </Modal>
    </>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isPriceStale(updatedAt?: string): boolean {
  if (!updatedAt) return false
  const [y, m, d] = updatedAt.split('-').map(Number)
  const updated = new Date(y, m - 1, d)
  return (Date.now() - updated.getTime()) / 86_400_000 >= 7
}

function unitLabel(assetClass: AssetClass): string {
  if (assetClass === 'fund') return 'units'
  if (assetClass === 'stock') return 'shares'
  if (assetClass === 'gold') return 'g'
  return 'BTC'
}

function Metric({
  label,
  value,
  valueNode,
  extra,
  muted,
}: {
  label: string
  value?: string
  valueNode?: React.ReactNode
  extra?: React.ReactNode
  muted?: boolean
}) {
  return (
    <div>
      <p className="text-[12.5px] font-medium text-ink-muted">{label}</p>
      <div className="mt-1.5">
        {valueNode ?? (
          <span className={`font-display text-[22px] font-extrabold tracking-tight tnum ${muted ? 'text-ink-soft' : 'text-ink'}`}>
            {value}
          </span>
        )}
      </div>
      {extra && <div className="mt-1.5">{extra}</div>}
    </div>
  )
}


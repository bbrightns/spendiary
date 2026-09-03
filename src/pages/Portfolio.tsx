import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

import { useData } from '../store/DataContext'
import { useToast } from '../store/ToastContext'
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
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { FilterChip } from '../components/ui/FilterChip'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { IconButton } from '../components/ui/IconButton'
import { NumberField, TextField } from '../components/ui/Field'
import { Button } from '../components/ui/Button'
import { AssetLogo } from '../components/ui/AssetLogo'
import { GuideTour } from '../components/guide/GuideTour'
import { usePageGuide } from '../hooks/usePageGuide'
import { PlusIcon, PortfolioIcon, TrashIcon, PencilIcon, CopyIcon, CheckIcon } from '../components/icons'
import {
  ASSET_META,
  GRAMS_PER_BAHT_GOLD,
  allocations,
  goldThbPerBahtToXauUsd,
  goldThbPerGramToXauUsd,
  holdingMetrics,
  portfolioSummary,
} from '../lib/calc'
import { generatePortfolioMarkdown } from '../lib/portfolioMarkdown'
import type { AssetClass, BtcLocation, Holding, NetWorthSnapshot } from '../lib/types'
import { money, thb, thbCompact } from '../lib/format'

const FILTERS: { key: AssetClass | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'fund', label: 'Thai Funds' },
  { key: 'stock', label: 'US Stocks' },
  { key: 'crypto', label: 'Bitcoin' },
  { key: 'gold', label: 'Gold' },
]

const SATS_PER_BTC = 100_000_000

export function Portfolio() {
  const {
    steps,
    isRunning,
    currentStepIndex,
    startTour,
    endTour,
    finishTour,
    nextStep,
    prevStep,
  } = usePageGuide('portfolio')
  const {
    data,

    removeHolding,
    upsertBtcLocation,
    removeBtcLocation,
    upsertGoldLocation,
    removeGoldLocation,
    recordPortfolioSnapshot,
  } = useData()
  const { showToast } = useToast()
  const { status: priceStatus, lastUpdated, usdThb, goldThbPerGram, errorMsg, refresh: refreshPrices } = useLivePrices()
  const [filter, setFilter] = useState<AssetClass | 'all'>('all')
  const [sortBy, setSortBy] = useState<'none' | 'value' | 'pnl' | 'type'>('value')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [search, setSearch] = useState('')
  const [copied, setCopied] = useState(false)

  const handleCopyMarkdown = async () => {
    try {
      const md = generatePortfolioMarkdown(data, usdThb, goldThbPerGram)
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(md)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = md
        textarea.style.position = 'fixed'
        textarea.style.left = '-9999px'
        textarea.style.top = '-9999px'
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      setCopied(true)
      showToast('คัดลอกข้อมูลพอร์ตในรูปแบบ Markdown สำเร็จแล้ว', 'success')
      setTimeout(() => setCopied(false), 2500)
    } catch {
      showToast('ไม่สามารถคัดลอก Markdown ได้', 'error')
    }
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
  const [locGoldUnit, setLocGoldUnit] = useState<'grams' | 'baht'>('grams')
  const [locGrams, setLocGrams] = useState<number | ''>('')
  const [locGoldBaht, setLocGoldBaht] = useState<number | ''>('')
  const [locThbSpent, setLocThbSpent] = useState<number | ''>('')
  const [locErrors, setLocErrors] = useState(false)

  const summary = portfolioSummary(data.holdings)
  const alloc = allocations(data.holdings)

  // Record today's portfolio value snapshot whenever it changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (summary.value > 0) recordPortfolioSnapshot(summary.value) }, [summary.value])

  const openAdd = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (h: Holding) => { setEditing(h); setFormOpen(true) }
  const openBuy = (h: Holding) => { setBuying(h); setBuyOpen(true) }
  function openLocEdit(holdingId: string, loc: BtcLocation | import('../lib/types').GoldLocation) {
    setLocEditHoldingId(holdingId)
    setLocEditing(loc)
    setLocName(loc.name)
    setLocGoldUnit('grams')
    if ('satoshi' in loc) {
      setLocSatoshi(loc.satoshi)
      setLocGrams('')
      setLocGoldBaht('')
    } else {
      setLocGrams(loc.grams)
      setLocGoldBaht(Number((loc.grams / GRAMS_PER_BAHT_GOLD).toFixed(6)))
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
    if ('satoshi' in locEditing && (locSatoshi === '' || Number(locSatoshi) < 0)) {
      setLocErrors(true)
      return
    }
    const g = locGoldUnit === 'baht'
      ? (locGoldBaht !== '' ? Number(locGoldBaht) * GRAMS_PER_BAHT_GOLD : 0)
      : Number(locGrams)
    if (!('satoshi' in locEditing) && g <= 0) {
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
        grams: g,
        thbSpent: Number(locThbSpent),
      })
    }
    showToast(`Updated location "${locName.trim()}"`, 'success')
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
            description="Add your Thai funds, US stocks, and Bitcoin to see allocation, value, and profit/loss at a glance."
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
                  <span className="text-ink-soft">
                    · Gold ฿{Math.round(goldThbPerGram * GRAMS_PER_BAHT_GOLD).toLocaleString()} / บาททองคำ
                  </span>
                )}
              </>
            )}
            {priceStatus === 'partial' && lastUpdated && (
              <>
                <span className="inline-block h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                Partial update · {lastUpdated.toLocaleTimeString()}
                {usdThb && <span className="text-ink-soft">· USD/THB {usdThb.toFixed(2)}</span>}
                {goldThbPerGram !== null && (
                  <span className="text-ink-soft">
                    · Gold ฿{Math.round(goldThbPerGram * GRAMS_PER_BAHT_GOLD).toLocaleString()} / บาททองคำ
                  </span>
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
        onStartGuide={startTour}
        action={
          <div id="guide-portfolio-actions" className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyMarkdown}
              aria-label="Copy portfolio markdown"
              title="Copy Portfolio as Markdown"
              className="inline-flex h-9 items-center gap-2 rounded-full border border-line-strong bg-surface px-3.5 text-[12.5px] font-semibold text-ink shadow-[var(--shadow-soft)] transition-all duration-200 hover:bg-surface-muted active:scale-95 cursor-pointer whitespace-nowrap"
            >
              {copied ? (
                <>
                  <CheckIcon className="h-4 w-4 text-gain shrink-0" strokeWidth={2.2} />
                  <span className="text-gain">Copied MD!</span>
                </>
              ) : (
                <>
                  <CopyIcon className="h-4 w-4 text-ink-muted shrink-0" />
                  <span>Copy Portfolio MD</span>
                </>
              )}
            </button>
          </div>
        }
      />

      {/* Main Split-View Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (5 cols): Allocation Donut + Rebalancer + Portfolio Trend */}
        <div id="guide-portfolio-alloc" className="lg:col-span-5 xl:col-span-4 space-y-6">
          {/* Asset Allocation card (Hero Overview & Allocation) */}
          <Card className="animate-rise">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[16px] font-bold text-ink">Asset Allocation</h2>
            </div>

            {/* Value & PnL Hero Summary */}
            <div id="guide-portfolio-summary" className="mt-3.5 p-3.5 rounded-2xl bg-surface-muted/60 border border-line/60">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Portfolio Value</span>
                  <p className="mt-1 font-display text-[22px] sm:text-[24px] font-black tracking-tight tnum text-ink leading-tight">
                    {thb(summary.value)}
                  </p>
                  <p className="mt-1 text-[11.5px] text-ink-muted font-medium">
                    Invested: <span className="font-semibold tnum text-ink-soft">{thbCompact(summary.cost)}</span>
                  </p>
                </div>
                <div className="text-right flex flex-col items-end shrink-0">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">All-Time PnL</span>
                  <div className="mt-1 flex items-baseline justify-end">
                    <PnLText value={summary.pnl} className="font-display text-[18px] sm:text-[20px] !font-black tracking-tight leading-tight" />
                  </div>
                  <div className="mt-1 flex items-center justify-end gap-1">
                    <PnLPill value={summary.pnlPct} asPct size="sm" />
                    <span className="text-[11px] text-ink-muted font-medium">all-time</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Donut Chart & Breakdown */}
            <div className="mt-4 flex flex-col items-center gap-4">
              <DonutChart
                segments={segments}
                size={155}
                thickness={17}
                ariaLabel={`Holdings asset allocation, total value ${thb(summary.value)}`}
                centerLabel="Total"
                centerValue={thbCompact(summary.value)}
              />

              <div className="w-full space-y-2 pt-2 border-t border-line">
                {alloc.map((a) => {
                  const pctVal = summary.value > 0 ? (a.value / summary.value) * 100 : 0
                  return (
                    <div key={a.assetClass} className="flex items-center justify-between text-[12.5px]">
                      <span className="flex items-center gap-2 font-medium text-ink">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ background: ASSET_META[a.assetClass].color }}
                        />
                        {ASSET_META[a.assetClass].plural}
                      </span>
                      <span className="font-bold tnum text-ink">
                        {thb(a.value)}{' '}
                        <span className="font-normal text-ink-muted text-[11px]">
                          ({pctVal.toFixed(1)}%)
                        </span>
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-[11.5px]">
              <span className="text-ink-muted">{data.holdings.length} holding positions</span>
              <Link
                to="/rebalance"
                className="inline-flex items-center gap-1 font-bold text-brand hover:underline cursor-pointer"
              >
                <span>Rebalance Portfolio</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </Card>

          {/* Portfolio Value Trend */}
          {(data.portfolioHistory?.length ?? 0) >= 1 && (
            <PortfolioTrendChart history={data.portfolioHistory!} />
          )}
        </div>

        {/* Right Column (7 cols): Holdings Hub & Management */}
        <div id="guide-portfolio-holdings" className="lg:col-span-7 xl:col-span-8 space-y-6">
          <Card className="animate-rise overflow-hidden" padded={false}>
            <div className="pt-5">
              <div className="px-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display text-[17px] font-bold text-ink">
                      Holdings & Assets
                    </h3>
                    <p className="text-[12px] text-ink-muted">
                      {rows.length} of {data.holdings.length} positions shown
                    </p>
                  </div>
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
                      aria-label="Clear search query"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-ink-faint hover:text-ink cursor-pointer"
                    >
                      <svg viewBox="0 0 12 12" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                        <path d="M2 2l8 8M10 2l-8 8" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Filter pills & Sort controls */}
                <div id="guide-portfolio-tabs" className="mb-4 flex flex-wrap items-center justify-between gap-2.5">
                  {/* Filter pills */}
                  <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                    {FILTERS.map((f) => (
                      <FilterChip
                        key={f.key}
                        active={filter === f.key}
                        onClick={() => setFilter(f.key)}
                        aria-label={`Filter holdings by ${f.label}`}
                      >
                        {f.label}
                      </FilterChip>
                    ))}
                  </div>

                  {/* Sort controls */}
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
                    <span className="shrink-0 text-[11px] font-medium text-ink-faint mr-1">Sort:</span>
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
                          aria-label={`Sort by ${label}${active && key !== 'type' ? ` (${sortDir === 'desc' ? 'descending' : 'ascending'})` : ''}`}
                          aria-pressed={active}
                          className={`flex shrink-0 items-center gap-0.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold transition-colors cursor-pointer ${
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
              </div>

              <ul className="divide-y divide-line border-t border-line">
                {rows.map((h) => {
                  const isBtc = h.assetClass === 'crypto'
                  const isGold = h.assetClass === 'gold'
                  const isExpandable = isBtc || isGold
                  const isExpanded = isExpandable && expandedId === h.id

                  const badge = (
                    <AssetLogo
                      ticker={h.ticker}
                      name={h.name}
                      assetClass={h.assetClass}
                      size="md"
                    />
                  )

                  const fxRate = usdThb && usdThb > 0 ? usdThb : 35
                  const btcAvgCostThb = (h.units > 0 ? (h.costBasis / h.units) : h.avgCost)
                  const btcAvgCostUsd = fxRate > 0 ? btcAvgCostThb / fxRate : 0
                  const goldAvgCostPerBaht = (h.units > 0 ? (h.costBasis / h.units) : h.avgCost) * GRAMS_PER_BAHT_GOLD
                  const goldAvgCostXauUsd = goldThbPerBahtToXauUsd(goldAvgCostPerBaht, fxRate)
                  const unitsLabel = isBtc
                    ? `${Math.round(h.units * SATS_PER_BTC).toLocaleString()} sats · avg ${money(btcAvgCostUsd, 'USD')}/BTC`
                    : isGold
                    ? `${h.units.toFixed(4)} g (${(h.units / GRAMS_PER_BAHT_GOLD).toFixed(4)} บาททอง) · avg ${thb(goldAvgCostPerBaht)}/บาททอง ($${Math.round(goldAvgCostXauUsd).toLocaleString()}/oz)`
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
                      className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand transition-all hover:bg-brand hover:text-white dark:hover:bg-[#4f46e5] active:scale-95 cursor-pointer"
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
                      {/* ── Compact & Desktop Unified Row ── */}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={rowClick}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); rowClick() } }}
                        aria-label={isExpandable ? (isExpanded ? `Collapse ${h.name}` : `Expand ${h.name}`) : `Edit ${h.name}`}
                        className="flex cursor-pointer items-center gap-3.5 px-5 py-3.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                      >
                        {badge}
                        <div className="min-w-0 flex-1">
                          {/* Line 1: name + value */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <p className="truncate text-[14.5px] font-semibold text-ink">
                                {h.name} <span className="text-[11.5px] font-normal text-ink-muted ml-1">{h.ticker}</span>
                              </p>
                              {staleIndicator}{chevron}
                            </div>
                            <p className="shrink-0 text-[14.5px] font-bold tnum text-ink">{thb(h.marketValue)}</p>
                          </div>
                          {/* Line 2: units + PnL% */}
                          <div className="mt-0.5 flex items-center justify-between gap-2">
                            <p className="truncate text-[12px] text-ink-muted">{unitsLabel}</p>
                            <PnLPill value={h.pnlPct} asPct />
                          </div>
                        </div>
                        {buyBtn}
                      </div>

                      {/* BTC / Gold sub-breakdown panel */}
                      {isExpandable && isExpanded && (
                        <div className="border-t border-line bg-surface-muted px-5 pb-3.5 pt-2.5">
                          <p className="mb-2 text-[12px] font-semibold text-ink-muted">Storage & Purchase Locations</p>

                          {isBtc && (
                            (h.btcLocations ?? []).length === 0
                              ? <p className="py-1 text-[13px] text-ink-muted">No locations yet. Use "Buy more" to add.</p>
                              : (
                                <ul className="space-y-1.5">
                                  {(h.btcLocations ?? []).map((loc) => {
                                    const locCostPerBtcThb = loc.satoshi > 0 ? (loc.thbSpent / loc.satoshi) * SATS_PER_BTC : 0
                                    const locCostPerBtcUsd = fxRate > 0 ? locCostPerBtcThb / fxRate : 0
                                    return (
                                      <li key={loc.id} className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2">
                                        <div className="min-w-0 flex-1">
                                          <p className="text-[13px] font-semibold text-ink">{loc.name}</p>
                                          <p className="tnum text-[12px] text-ink-muted">
                                            {loc.satoshi.toLocaleString()} sats · {thb(loc.thbSpent)} spent · avg {money(locCostPerBtcUsd, 'USD')}/BTC
                                          </p>
                                        </div>
                                        <IconButton
                                          icon={<PencilIcon className="h-3.5 w-3.5" />}
                                          label={`Edit location ${loc.name}`}
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => openLocEdit(h.id, loc)}
                                        />
                                        <IconButton
                                          icon={<TrashIcon className="h-3.5 w-3.5" />}
                                          label={`Remove location ${loc.name}`}
                                          variant="danger"
                                          size="sm"
                                          onClick={() => {
                                            removeBtcLocation(h.id, loc.id)
                                            showToast(`Removed location "${loc.name}"`, 'info')
                                          }}
                                        />
                                      </li>
                                    )
                                  })}
                                </ul>
                              )
                          )}

                          {isGold && (
                            (h.goldLocations ?? []).length === 0
                              ? <p className="py-1 text-[13px] text-ink-muted">No locations yet. Use "Buy more" to add.</p>
                              : (
                                <ul className="space-y-1.5">
                                  {(h.goldLocations ?? []).map((loc) => {
                                    const locCostPerBaht = loc.grams > 0 ? (loc.thbSpent / loc.grams) * GRAMS_PER_BAHT_GOLD : 0
                                    const locCostXauUsd = goldThbPerBahtToXauUsd(locCostPerBaht, fxRate)
                                    const locBaht = loc.grams / GRAMS_PER_BAHT_GOLD
                                    return (
                                      <li key={loc.id} className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2">
                                        <div className="min-w-0 flex-1">
                                          <p className="text-[13px] font-semibold text-ink">{loc.name}</p>
                                          <p className="tnum text-[12px] text-ink-muted">
                                            {loc.grams.toFixed(4)} g ({locBaht.toFixed(4)} บาททอง) · {thb(loc.thbSpent)} spent · avg {thb(locCostPerBaht)}/บาททอง (${Math.round(locCostXauUsd).toLocaleString()}/oz)
                                          </p>
                                        </div>
                                        <IconButton
                                          icon={<PencilIcon className="h-3.5 w-3.5" />}
                                          label={`Edit location ${loc.name}`}
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => openLocEdit(h.id, loc)}
                                        />
                                        <IconButton
                                          icon={<TrashIcon className="h-3.5 w-3.5" />}
                                          label={`Remove location ${loc.name}`}
                                          variant="danger"
                                          size="sm"
                                          onClick={() => {
                                            removeGoldLocation(h.id, loc.id)
                                            showToast(`Removed location "${loc.name}"`, 'info')
                                          }}
                                        />
                                      </li>
                                    )
                                  })}
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
      </div>

      <HoldingForm open={formOpen} editing={editing} onClose={() => setFormOpen(false)} />
      <BuyMoreForm open={buyOpen} holding={buying} onClose={() => setBuyOpen(false)} />

      {/* BTC / Gold location edit modal */}
      <Modal
        open={locEditOpen}
        onClose={() => setLocEditOpen(false)}
        title="Edit location"
        description={locEditing && !('satoshi' in locEditing) ? "Update this location's name, grams, or THB spent." : "Update this location's name, satoshi amount, or THB spent."}
        footer={
          <Button onClick={saveLocEdit} className="w-full">Save changes</Button>
        }
      >
        <div className="space-y-4 pb-2">
          <TextField
            label="Location name"
            value={locName}
            onChange={setLocName}
            placeholder="e.g. Ledger"
            error={locErrors && !locName.trim() ? 'Required' : undefined}
          />
          {locEditing && !('satoshi' in locEditing) && (
            <div className="space-y-1">
              <label className="text-[13px] font-medium text-ink-soft">Unit / หน่วย</label>
              <SegmentedControl
                size="sm"
                value={locGoldUnit}
                onChange={setLocGoldUnit}
                options={[
                  { value: 'grams', label: 'กรัม (Grams)' },
                  { value: 'baht', label: 'บาททองคำ (15.244g)' },
                ]}
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-3">
            {locEditing && 'satoshi' in locEditing ? (
              <NumberField
                label="Satoshi"
                value={locSatoshi}
                onChange={setLocSatoshi}
                placeholder="0"
                step={1}
                error={locErrors && (locSatoshi === '' || Number(locSatoshi) < 0) ? 'Required' : undefined}
              />
            ) : locGoldUnit === 'grams' ? (
              <NumberField
                label="Grams (กรัม)"
                value={locGrams}
                onChange={(val) => {
                  setLocGrams(val)
                  if (val !== '' && Number(val) > 0) {
                    setLocGoldBaht(Number((Number(val) / GRAMS_PER_BAHT_GOLD).toFixed(6)))
                  } else {
                    setLocGoldBaht('')
                  }
                }}
                placeholder="0.00"
                step={0.0001}
                error={locErrors && (locGrams === '' || Number(locGrams) < 0) ? 'Required' : undefined}
              />
            ) : (
              <NumberField
                label="Weight in บาททองคำ (ทองคำแท่ง)"
                value={locGoldBaht}
                onChange={(val) => {
                  setLocGoldBaht(val)
                  if (val !== '' && Number(val) > 0) {
                    setLocGrams(Number((Number(val) * GRAMS_PER_BAHT_GOLD).toFixed(6)))
                  } else {
                    setLocGrams('')
                  }
                }}
                placeholder="0.00"
                step={0.0001}
                error={locErrors && (locGoldBaht === '' || Number(locGoldBaht) < 0) ? 'Required' : undefined}
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
          {locEditing && 'satoshi' in locEditing && Number(locSatoshi) > 0 && Number(locThbSpent) > 0 && (
            <div className="rounded-xl border border-line bg-surface-muted px-3.5 py-2.5 text-[12.5px] space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">BTC amount</span>
                <span className="font-semibold text-ink tnum">{(Number(locSatoshi) / SATS_PER_BTC).toFixed(8)} BTC</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Avg cost / BTC</span>
                <span className="font-semibold text-brand tnum">
                  {money(((Number(locThbSpent) / Number(locSatoshi)) * SATS_PER_BTC) / (usdThb && usdThb > 0 ? usdThb : 35), 'USD')} (≈ {thb((Number(locThbSpent) / Number(locSatoshi)) * SATS_PER_BTC)})
                </span>
              </div>
            </div>
          )}
          {locEditing && !('satoshi' in locEditing) && Number(locGrams) > 0 && Number(locThbSpent) > 0 && (
            <div className="rounded-xl border border-line bg-surface-muted px-3.5 py-2.5 text-[12.5px] space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Weight in บาททองคำ</span>
                <span className="font-semibold text-ink tnum">{(Number(locGrams) / GRAMS_PER_BAHT_GOLD).toFixed(4)} บาท</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Avg cost / บาททองคำ</span>
                <span className="font-semibold text-brand tnum">
                  {thb((Number(locThbSpent) / Number(locGrams)) * GRAMS_PER_BAHT_GOLD)}
                  {(usdThb && usdThb > 0 ? usdThb : 35) > 0 && ` ($${Math.round(goldThbPerGramToXauUsd(Number(locThbSpent) / Number(locGrams), usdThb && usdThb > 0 ? usdThb : 35)).toLocaleString()}/oz XAUUSD)`}
                </span>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Remove holding confirmation */}
      <ConfirmModal
        open={removeConfirmOpen}
        onClose={() => { setRemoveConfirmOpen(false); setRemoveTarget(null) }}
        title={`Remove "${removeTarget?.name}"?`}
        description="This will permanently delete the holding and all its transaction history. This cannot be undone."
        confirmText="Yes, remove holding"
        confirmVariant="danger"
        confirmIcon={<TrashIcon className="h-4 w-4" strokeWidth={2.2} />}
        cancelText="Cancel"
        onConfirm={() => {
          if (removeTarget) {
            removeHolding(removeTarget.id)
            showToast(`Removed "${removeTarget.name}" from portfolio`, 'info')
          }
          setRemoveConfirmOpen(false)
          setRemoveTarget(null)
        }}
      />

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


// ── Portfolio Value Trend Chart ───────────────────────────────────────────────

function PortfolioTrendChart({ history }: { history: NetWorthSnapshot[] }) {
  const colorVar = 'var(--color-funds)'
  const first = history[0]
  const last = history[history.length - 1]
  const [y0, mo0, d0] = first.date.split('-').map(Number)
  const startDate = new Date(y0, mo0 - 1, d0).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const todayLabel = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

  // Single snapshot — show a "building history" state
  if (history.length < 2) {
    return (
      <Card className="animate-rise overflow-hidden" padded={false}>
        <div className="flex items-center justify-between px-5 pt-5">
          <div>
            <h2 className="font-display text-[15px] font-bold text-ink">Portfolio Value Trend</h2>
            <p className="text-[12.5px] text-ink-muted">Building history… come back tomorrow</p>
          </div>
          <span className="rounded-full bg-surface-muted px-3 py-1 text-[12px] font-semibold text-ink-muted">Day 1</span>
        </div>
        <div className="relative px-5 pb-5 pt-3">
          {/* Flat placeholder line */}
          <svg viewBox="0 0 600 96" className="w-full" style={{ height: 88, display: 'block' }} aria-hidden>
            <defs>
              <linearGradient id="pvg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: colorVar, stopOpacity: 0.15 }} />
                <stop offset="100%" style={{ stopColor: colorVar, stopOpacity: 0 }} />
              </linearGradient>
            </defs>
            <path d="M2,52 L598,52 L598,96 L2,96Z" fill="url(#pvg)" />
            <path d="M2,52 L598,52" fill="none" style={{ stroke: colorVar }} strokeWidth="2" strokeLinecap="round" strokeDasharray="6,4" opacity="0.5" />
            <circle cx={300} cy={52} r="5" style={{ fill: colorVar }} />
          </svg>
          <div className="flex justify-between">
            <span className="text-[11px] text-ink-faint">{startDate}</span>
            <span className="text-[11px] font-semibold text-ink-muted">{thb(last.value)} today</span>
            <span className="text-[11px] text-ink-faint">{todayLabel}</span>
          </div>
        </div>
      </Card>
    )
  }

  // Multi-snapshot — full line chart
  const W = 600, H = 96
  const PAD_X = 2, PAD_Y = 10
  const iW = W - PAD_X * 2
  const iH = H - PAD_Y * 2

  const vals = history.map((s) => s.value)
  const minV = Math.min(...vals)
  const maxV = Math.max(...vals)
  const range = maxV - minV || 1

  const pts = history.map((s, i) => ({
    x: PAD_X + (i / (history.length - 1)) * iW,
    y: PAD_Y + (1 - (s.value - minV) / range) * iH,
    ...s,
  }))

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const areaPath = `${linePath} L${pts[pts.length - 1].x},${H} L${pts[0].x},${H}Z`

  const change = last.value - first.value
  const changePct = Math.abs((change / first.value) * 100)
  const isUp = change >= 0
  const lineColor = isUp ? 'var(--color-funds)' : 'var(--color-loss)'

  return (
    <Card className="animate-rise overflow-hidden" padded={false}>
      <div className="flex items-center justify-between px-5 pt-5">
        <div>
          <h2 className="font-display text-[15px] font-bold text-ink">Portfolio Value Trend</h2>
          <p className="text-[12.5px] text-ink-muted">{history.length} snapshots · since {startDate}</p>
        </div>
        <div className={`flex items-baseline gap-1 rounded-full px-3 py-1 text-[13px] font-bold ${isUp ? 'bg-gain-soft text-gain' : 'bg-loss-soft text-loss'}`}>
          {isUp ? '▲' : '▼'} {changePct.toFixed(1)}%
          <span className="text-[11px] font-medium opacity-70">from start</span>
        </div>
      </div>
      <div className="relative px-5 pb-4 pt-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 88, display: 'block' }} aria-hidden>
          <defs>
            <linearGradient id="pvg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: lineColor, stopOpacity: 0.2 }} />
              <stop offset="100%" style={{ stopColor: lineColor, stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#pvg)" />
          <path d={linePath} fill="none" style={{ stroke: lineColor }} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="4" style={{ fill: lineColor }} />
        </svg>
        <div className="flex justify-between">
          <span className="text-[11px] text-ink-faint">{startDate}</span>
          <span className="text-[11px] font-semibold text-ink-muted">{thb(last.value)} today</span>
          <span className="text-[11px] text-ink-faint">{todayLabel}</span>
        </div>
      </div>
    </Card>
  )
}

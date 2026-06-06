import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
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
import { CoinsIcon, PlusIcon, PortfolioIcon, TrashIcon, PencilIcon } from '../components/icons'
import {
  ASSET_META,
  allocations,
  holdingMetrics,
  portfolioSummary,
} from '../lib/calc'
import type { AssetClass, BtcLocation, Holding } from '../lib/types'
import { pct, thb, thbCompact } from '../lib/format'

const FILTERS: { key: AssetClass | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'fund', label: 'Mutual Funds' },
  { key: 'stock', label: 'US Stocks' },
  { key: 'crypto', label: 'Bitcoin' },
  { key: 'gold', label: 'Gold' },
]

const SATS_PER_BTC = 100_000_000

export function Portfolio() {
  const { data, removeHolding, upsertBtcLocation, removeBtcLocation, removeGoldLocation } = useData()
  const { status: priceStatus, lastUpdated, usdThb, errorMsg, refresh: refreshPrices } = useLivePrices()
  const [filter, setFilter] = useState<AssetClass | 'all'>('all')
  const [sortBy, setSortBy] = useState<'none' | 'value' | 'pnl' | 'type'>('none')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [search, setSearch] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Holding | null>(null)
  const [buyOpen, setBuyOpen] = useState(false)
  const [buying, setBuying] = useState<Holding | null>(null)

  // Swipe-to-reveal actions
  const [swipedId, setSwipedId] = useState<string | null>(null)

  // Remove confirmation
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null)

  // BTC / Gold location expansion
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [locEditOpen, setLocEditOpen] = useState(false)
  const [locEditHoldingId, setLocEditHoldingId] = useState<string>('')
  const [locEditing, setLocEditing] = useState<BtcLocation | null>(null)
  const [locName, setLocName] = useState('')
  const [locSatoshi, setLocSatoshi] = useState<number | ''>('')
  const [locThbSpent, setLocThbSpent] = useState<number | ''>('')
  const [locErrors, setLocErrors] = useState(false)

  const summary = portfolioSummary(data.holdings)
  const alloc = allocations(data.holdings)

  const openAdd = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (h: Holding) => { setSwipedId(null); setEditing(h); setFormOpen(true) }
  const openBuy = (h: Holding) => { setSwipedId(null); setBuying(h); setBuyOpen(true) }
  const confirmRemove = (id: string, name: string) => {
    setSwipedId(null)
    setRemoveTarget({ id, name })
    setRemoveConfirmOpen(true)
  }

  function openLocEdit(holdingId: string, loc: BtcLocation) {
    setLocEditHoldingId(holdingId)
    setLocEditing(loc)
    setLocName(loc.name)
    setLocSatoshi(loc.satoshi)
    setLocThbSpent(loc.thbSpent)
    setLocErrors(false)
    setLocEditOpen(true)
  }

  function saveLocEdit() {
    if (!locEditing || !locName.trim() || locSatoshi === '' || locThbSpent === '') {
      setLocErrors(true)
      return
    }
    upsertBtcLocation(locEditHoldingId, {
      id: locEditing.id,
      name: locName.trim(),
      satoshi: Number(locSatoshi),
      thbSpent: Number(locThbSpent),
    })
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
            action={
              <AddButton onClick={openAdd} label="Add holding" />
            }
          />
        </Card>
        <HoldingForm open={formOpen} editing={editing} onClose={() => setFormOpen(false)} />
      </>
    )
  }

  const TYPE_ORDER: Record<AssetClass, number> = { crypto: 0, gold: 1, stock: 2, fund: 3 }

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
              </>
            )}
            {priceStatus === 'partial' && lastUpdated && (
              <>
                <span className="inline-block h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                Partial update · {lastUpdated.toLocaleTimeString()}
                {usdThb && <span className="text-ink-soft">· USD/THB {usdThb.toFixed(2)}</span>}
                <span className="text-loss text-[12px]">{errorMsg}</span>
              </>
            )}
            {priceStatus === 'error' && (
              <span className="text-loss">
                Price fetch failed ·{' '}
                <button onClick={refreshPrices} className="underline">retry</button>
              </span>
            )}
            {priceStatus === 'idle' && 'Valued at the latest prices you\'ve filled in.'}
          </span>
        }
        action={
          <div className="flex items-center gap-2">
            <Link
              to="/logs"
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-4 text-[14px] font-semibold text-ink-soft shadow-[var(--shadow-soft)] transition-all hover:bg-surface-muted hover:text-ink active:scale-95"
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="shrink-0">
                <path d="M2 3.5h11M2 7.5h8M2 11.5h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
              Logs
            </Link>
            <AddButton onClick={openAdd} label="Add holding" />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Allocation chart */}
        <Card className="lg:col-span-2 animate-rise">
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

        {/* Performance summary + holdings list */}
        <Card className="lg:col-span-3 animate-rise">
          {/* ── Summary metrics ── */}
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
            <Metric label="Current Value" value={thb(summary.value)} />
            <Metric label="Amount Invested" value={thb(summary.cost)} muted />
            <Metric
              label="Total Profit / Loss"
              valueNode={<PnLText value={summary.pnl} className="text-[22px]" />}
              extra={<PnLPill value={summary.pnlPct} asPct />}
            />
          </div>

          {/* ── Holdings list ── */}
          <div className="mt-6 border-t border-line pt-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-[15px] font-bold text-ink">
                Holdings
                <span className="ml-2 rounded-full bg-surface-muted px-2 py-0.5 text-[12px] font-semibold text-ink-muted">
                  {rows.length}
                </span>
              </h3>
            </div>

            {/* Search bar */}
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

            {/* Swipe hint — shown only if nothing is swiped yet */}
            {swipedId === null && rows.length > 0 && (
              <p className="mb-3 text-[11.5px] text-ink-faint flex items-center gap-1">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M12 8H4M7 5l-3 3 3 3"/>
                </svg>
                Swipe a row left to buy, edit, or remove
              </p>
            )}

            <ul className="space-y-2">
              {rows.map((h) => {
                const isBtc = h.assetClass === 'crypto'
                const isGold = h.assetClass === 'gold'
                const isExpandable = isBtc || isGold
                const isExpanded = isExpandable && expandedId === h.id
                const isSwiped = swipedId === h.id
                return (
                  <SwipeRow
                    key={h.id}
                    isSwiped={isSwiped}
                    onSwipeOpen={() => { setSwipedId(h.id); setExpandedId(null) }}
                    onSwipeClose={() => setSwipedId(null)}
                    actions={
                      <>
                        <button
                          onClick={() => openBuy(h)}
                          aria-label={`Buy more ${h.name}`}
                          className="flex h-full w-14 flex-col items-center justify-center gap-0.5 bg-gain/90 text-white transition-opacity hover:bg-gain"
                        >
                          <PlusIcon className="h-5 w-5" strokeWidth={2.2} />
                          <span className="text-[10px] font-semibold">Buy</span>
                        </button>
                        <button
                          onClick={() => openEdit(h)}
                          aria-label={`Edit ${h.name}`}
                          className="flex h-full w-14 flex-col items-center justify-center gap-0.5 bg-brand/90 text-white transition-opacity hover:bg-brand dark:bg-[#4f46e5]/90 dark:hover:bg-[#4f46e5]"
                        >
                          <PencilIcon className="h-4 w-4" />
                          <span className="text-[10px] font-semibold">Edit</span>
                        </button>
                        <button
                          onClick={() => confirmRemove(h.id, h.name)}
                          aria-label={`Remove ${h.name}`}
                          className="flex h-full w-14 flex-col items-center justify-center gap-0.5 rounded-r-2xl bg-loss/90 text-white transition-opacity hover:bg-loss"
                        >
                          <TrashIcon className="h-4 w-4" />
                          <span className="text-[10px] font-semibold">Remove</span>
                        </button>
                      </>
                    }
                  >
                    {/* Main row content */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (isSwiped) { setSwipedId(null); return }
                        if (isExpandable) {
                          setExpandedId(isExpanded ? null : h.id)
                        } else {
                          openEdit(h)
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          if (isExpandable) setExpandedId(isExpanded ? null : h.id)
                          else openEdit(h)
                        }
                      }}
                      aria-label={isExpandable ? (isExpanded ? `Collapse ${h.name} locations` : `Expand ${h.name} locations`) : `Edit ${h.name}`}
                      className="flex cursor-pointer items-center gap-3 px-4 py-3.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    >
                      {/* Avatar */}
                      <span
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[12px] font-bold"
                        style={{
                          color: ASSET_META[h.assetClass].color,
                          background: `color-mix(in srgb, ${ASSET_META[h.assetClass].color} 14%, transparent)`,
                        }}
                      >
                        {h.assetClass === 'crypto' ? (
                          <CoinsIcon className="h-[18px] w-[18px]" />
                        ) : (
                          h.ticker.slice(0, 2).toUpperCase()
                        )}
                      </span>

                      {/* Two-line content */}
                      <div className="min-w-0 flex-1">
                        {/* Line 1: name + value */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <p className="truncate text-[14px] font-semibold text-ink">{h.name}</p>
                            {isPriceStale(h.updatedAt) && (
                              <span
                                title={`Price not updated in 7+ days${h.updatedAt ? ` (last: ${h.updatedAt})` : ''}`}
                                aria-label="Stale price"
                                className="h-2 w-2 shrink-0 rounded-full bg-warn"
                              />
                            )}
                            {isExpandable && (
                              <svg
                                aria-hidden="true"
                                width={14}
                                height={14}
                                viewBox="0 0 14 14"
                                fill="none"
                                className={`shrink-0 text-ink-muted transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                              >
                                <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                          <p className="shrink-0 text-[14px] font-bold tnum text-ink">{thb(h.marketValue)}</p>
                        </div>

                        {/* Line 2: units/type + PnL pill */}
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <p className="truncate text-[12px] text-ink-muted">
                            {isBtc
                              ? `${Math.round(h.units * SATS_PER_BTC).toLocaleString()} sats`
                              : isGold
                              ? `${h.units.toFixed(2)} g · Gold`
                              : `${h.units.toLocaleString()} ${unitLabel(h.assetClass)} · ${ASSET_META[h.assetClass].label}`
                            }
                          </p>
                          <PnLPill value={h.pnlPct} asPct />
                        </div>
                      </div>
                    </div>

                    {/* BTC / Gold sub-breakdown panel */}
                    {isExpandable && isExpanded && (
                      <div className="border-t border-line bg-surface-muted px-4 pb-3 pt-2">
                        <p className="mb-2 text-[12px] font-semibold text-ink-muted">Locations</p>

                        {isBtc && (
                          (h.btcLocations ?? []).length === 0 ? (
                            <p className="py-1 text-[13px] text-ink-muted">No locations yet. Use "Buy more" to add.</p>
                          ) : (
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
                          (h.goldLocations ?? []).length === 0 ? (
                            <p className="py-1 text-[13px] text-ink-muted">No locations yet. Use "Buy more" to add.</p>
                          ) : (
                            <ul className="space-y-1.5">
                              {(h.goldLocations ?? []).map((loc) => (
                                <li key={loc.id} className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[13px] font-semibold text-ink">{loc.name}</p>
                                    <p className="tnum text-[12px] text-ink-muted">
                                      {loc.grams.toFixed(2)} g · {thb(loc.thbSpent)} spent
                                    </p>
                                  </div>
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

                        <div className="mt-2 flex items-center gap-4">
                          <button
                            onClick={(e) => { e.stopPropagation(); openEdit(h) }}
                            className="text-[12px] font-semibold text-brand hover:underline"
                          >
                            Edit holding details
                          </button>
                        </div>
                      </div>
                    )}
                  </SwipeRow>
                )
              })}
            </ul>
          </div>
        </Card>
      </div>

      <HoldingForm open={formOpen} editing={editing} onClose={() => setFormOpen(false)} />
      <BuyMoreForm open={buyOpen} holding={buying} onClose={() => setBuyOpen(false)} />

      {/* BTC location edit modal */}
      <Modal
        open={locEditOpen}
        onClose={() => setLocEditOpen(false)}
        title="Edit location"
        description="Update this location's name, satoshi amount, or THB spent."
      >
        <div className="space-y-4 pb-2">
          <TextField
            label="Location name"
            value={locName}
            onChange={setLocName}
            placeholder="e.g. Ledger"
            error={locErrors && !locName.trim() ? 'Required' : undefined}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <NumberField
              label="Satoshi"
              value={locSatoshi}
              onChange={setLocSatoshi}
              placeholder="0"
              step={1}
              error={locErrors && (locSatoshi === '' || Number(locSatoshi) < 0) ? 'Required' : undefined}
            />
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

      {/* Remove holding confirmation modal */}
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
            className="inline-flex h-11 w-full items-center justify-center rounded-full bg-loss px-5 text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
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

// ── SwipeRow ──────────────────────────────────────────────────────────────────

interface SwipeRowProps {
  isSwiped: boolean
  onSwipeOpen: () => void
  onSwipeClose: () => void
  actions: React.ReactNode
  children: React.ReactNode
}

function SwipeRow({ isSwiped, onSwipeOpen, onSwipeClose, actions, children }: SwipeRowProps) {
  const touchStartX = useRef<number | null>(null)
  const ACTION_WIDTH = 42 * 3 // 3 buttons × 42px each

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (dx < -50) {
      onSwipeOpen()
    } else if (dx > 30) {
      onSwipeClose()
    }
  }

  return (
    <li
      className="relative rounded-2xl border border-line bg-surface overflow-hidden transition-colors hover:border-line-strong"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Action buttons revealed at right */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 flex"
        style={{ width: ACTION_WIDTH }}
      >
        <div
          className={`pointer-events-auto flex h-full w-full transition-opacity duration-200 ${isSwiped ? 'opacity-100' : 'opacity-0'}`}
        >
          {actions}
        </div>
      </div>

      {/* Sliding content wrapper */}
      <div
        className="relative transition-transform duration-200 ease-out"
        style={{ transform: isSwiped ? `translateX(-${ACTION_WIDTH}px)` : 'translateX(0)' }}
      >
        {children}
      </div>
    </li>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isPriceStale(updatedAt?: string): boolean {
  if (!updatedAt) return false
  const [y, m, d] = updatedAt.split('-').map(Number)
  const updated = new Date(y, m - 1, d)
  const daysSince = (Date.now() - updated.getTime()) / 86_400_000
  return daysSince >= 7
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
          <span
            className={`font-display text-[22px] font-extrabold tracking-tight tnum ${
              muted ? 'text-ink-soft' : 'text-ink'
            }`}
          >
            {value}
          </span>
        )}
      </div>
      {extra && <div className="mt-1.5">{extra}</div>}
    </div>
  )
}

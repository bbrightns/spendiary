import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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
  const { data, removeHolding, reorderHoldings, upsertBtcLocation, removeBtcLocation, removeGoldLocation } = useData()
  const { status: priceStatus, lastUpdated, usdThb, errorMsg, refresh: refreshPrices } = useLivePrices()
  const [filter, setFilter] = useState<AssetClass | 'all'>('all')
  const [sortBy, setSortBy] = useState<'none' | 'value' | 'pnl' | 'type'>('none')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIds = data.holdings.map((h) => h.id)
    const oldIdx = oldIds.indexOf(active.id as string)
    const newIdx = oldIds.indexOf(over.id as string)
    reorderHoldings(arrayMove(oldIds, oldIdx, newIdx))
    setSortBy('none')   // clear auto-sort when user manually reorders
  }
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Holding | null>(null)
  const [buyOpen, setBuyOpen] = useState(false)
  const [buying, setBuying] = useState<Holding | null>(null)

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
  const openEdit = (h: Holding) => { setEditing(h); setFormOpen(true) }
  const openBuy = (h: Holding) => { setBuying(h); setBuyOpen(true) }
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

  const rows = data.holdings
    .map(holdingMetrics)
    .filter((h) => filter === 'all' || h.assetClass === filter)
    .sort((a, b) => {
      if (sortBy === 'none') return 0   // preserve stored order (drag order)
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
          <span className="flex items-center gap-2 flex-wrap text-[14.5px] text-ink-muted">
            {priceStatus === 'loading' && 'Fetching live prices…'}
            {priceStatus === 'ok' && lastUpdated && (
              <>
                <span className="inline-block h-2 w-2 rounded-full bg-gain animate-pulse" />
                Live · updated {lastUpdated.toLocaleTimeString()}
                {usdThb && <span className="text-ink-faint">· USD/THB {usdThb.toFixed(2)}</span>}
              </>
            )}
            {priceStatus === 'partial' && lastUpdated && (
              <>
                <span className="inline-block h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                Partial update · {lastUpdated.toLocaleTimeString()}
                {usdThb && <span className="text-ink-faint">· USD/THB {usdThb.toFixed(2)}</span>}
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

        {/* Performance summary */}
        <Card className="lg:col-span-3 animate-rise">
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
            <Metric label="Current Value" value={thb(summary.value)} />
            <Metric label="Cost Basis" value={thb(summary.cost)} muted />
            <Metric
              label="Total Profit / Loss"
              valueNode={<PnLText value={summary.pnl} className="text-[22px]" />}
              extra={<PnLPill value={summary.pnlPct} asPct />}
            />
          </div>

          <div className="mt-6 border-t border-line pt-5">
            {/* Filter pills */}
            <div className="mb-2 flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                    filter === f.key
                      ? 'bg-ink text-white'
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
                        ? 'bg-brand text-white'
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

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={rows.map((h) => h.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {rows.map((h) => {
                const isBtc = h.assetClass === 'crypto'
                const isGold = h.assetClass === 'gold'
                const isExpandable = isBtc || isGold
                const isExpanded = isExpandable && expandedId === h.id
                return (
                  <SortableRow key={h.id} id={h.id}>{(dragHandle) => (<>
                    {/* Main row */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => {
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
                      className="flex cursor-pointer items-center gap-3 px-3.5 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    >
                      {dragHandle}
                      <span
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[12px] font-bold"
                        style={{
                          color: ASSET_META[h.assetClass].color,
                          background: `color-mix(in srgb, ${ASSET_META[h.assetClass].color} 12%, white)`,
                        }}
                      >
                        {h.assetClass === 'crypto' ? (
                          <CoinsIcon className="h-[18px] w-[18px]" />
                        ) : (
                          h.ticker.slice(0, 2).toUpperCase()
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <p className="truncate text-[14px] font-semibold text-ink">{h.name}</p>
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
                        <p className="text-[12px] text-ink-muted">
                          {isBtc
                            ? `${Math.round(h.units * SATS_PER_BTC).toLocaleString()} sats (${h.units.toFixed(8)} BTC)`
                            : isGold
                            ? `${h.units.toFixed(2)} g · Gold`
                            : `${h.units.toLocaleString()} ${unitLabel(h.assetClass)} · ${ASSET_META[h.assetClass].label}`
                          }
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[14px] font-bold tnum text-ink">{thb(h.marketValue)}</p>
                        <div className="mt-0.5 flex justify-end">
                          <PnLPill value={h.pnlPct} asPct />
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); openBuy(h) }}
                          title="Buy more"
                          aria-label={`Buy more ${h.name}`}
                          className="grid h-9 w-9 place-items-center rounded-full bg-brand-soft text-brand transition-colors hover:bg-brand hover:text-white"
                        >
                          <PlusIcon className="h-[16px] w-[16px]" strokeWidth={2.2} />
                        </button>
                      </div>
                    </div>

                    {/* BTC / Gold sub-breakdown panel */}
                    {isExpandable && isExpanded && (
                      <div className="border-t border-line bg-surface-muted px-4 pb-3 pt-2">
                        <p className="mb-2 text-[12px] font-semibold text-ink-muted">Locations</p>

                        {/* BTC locations */}
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
                                    aria-label={`Edit ${loc.name}`}
                                    className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
                                  >
                                    <PencilIcon className="h-[14px] w-[14px]" />
                                  </button>
                                  <button
                                    onClick={() => removeBtcLocation(h.id, loc.id)}
                                    aria-label={`Remove ${loc.name}`}
                                    className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-loss/10 hover:text-loss"
                                  >
                                    <TrashIcon className="h-[14px] w-[14px]" />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )
                        )}

                        {/* Gold locations */}
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
                                    aria-label={`Remove ${loc.name}`}
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
                          <button
                            onClick={(e) => { e.stopPropagation(); removeHolding(h.id) }}
                            className="text-[12px] font-semibold text-loss hover:underline"
                          >
                            Remove holding
                          </button>
                        </div>
                      </div>
                    )}
                  </>)}</SortableRow>
                )
              })}
            </ul>
              </SortableContext>
            </DndContext>
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
    </>
  )
}

// ── Drag-and-drop helpers ─────────────────────────────────────────────────────

function SortableRow({ id, children }: { id: string; children: (handle: React.ReactNode) => React.ReactNode }) {
  const { setNodeRef, transform, transition, isDragging, attributes, listeners } = useSortable({ id })

  const handle = (
    <span
      {...attributes}
      {...listeners}
      className="grid h-8 w-5 shrink-0 cursor-grab place-items-center text-ink-faint active:cursor-grabbing touch-none"
      aria-label="Drag to reorder"
    >
      <svg width="12" height="16" viewBox="0 0 12 16" fill="none">
        <circle cx="4" cy="3"  r="1.5" fill="currentColor"/>
        <circle cx="8" cy="3"  r="1.5" fill="currentColor"/>
        <circle cx="4" cy="8"  r="1.5" fill="currentColor"/>
        <circle cx="8" cy="8"  r="1.5" fill="currentColor"/>
        <circle cx="4" cy="13" r="1.5" fill="currentColor"/>
        <circle cx="8" cy="13" r="1.5" fill="currentColor"/>
      </svg>
    </span>
  )

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : undefined,
      }}
      className="rounded-2xl border border-line bg-surface overflow-hidden transition-colors hover:border-line-strong"
    >
      {children(handle)}
    </li>
  )
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

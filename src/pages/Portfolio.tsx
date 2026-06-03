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
]

const SATS_PER_BTC = 100_000_000

export function Portfolio() {
  const { data, upsertBtcLocation, removeBtcLocation } = useData()
  const { status: priceStatus, lastUpdated, usdThb, errorMsg, refresh: refreshPrices } = useLivePrices()
  const [filter, setFilter] = useState<AssetClass | 'all'>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Holding | null>(null)
  const [buyOpen, setBuyOpen] = useState(false)
  const [buying, setBuying] = useState<Holding | null>(null)

  // BTC location editing
  const [expandedBtcId, setExpandedBtcId] = useState<string | null>(null)
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

  const rows = data.holdings
    .map(holdingMetrics)
    .filter((h) => filter === 'all' || h.assetClass === filter)
    .sort((a, b) => b.marketValue - a.marketValue)

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
        action={<AddButton onClick={openAdd} label="Add holding" />}
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
            <div className="mb-4 flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
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

            <ul className="space-y-2">
              {rows.map((h) => {
                const isBtc = h.assetClass === 'crypto'
                const isExpanded = isBtc && expandedBtcId === h.id
                return (
                  <li key={h.id} className="rounded-2xl border border-line bg-surface overflow-hidden transition-colors hover:border-line-strong">
                    {/* Main row */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (isBtc) {
                          setExpandedBtcId(isExpanded ? null : h.id)
                        } else {
                          openEdit(h)
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          if (isBtc) setExpandedBtcId(isExpanded ? null : h.id)
                          else openEdit(h)
                        }
                      }}
                      aria-label={isBtc ? (isExpanded ? `Collapse ${h.name} locations` : `Expand ${h.name} locations`) : `Edit ${h.name}`}
                      className="flex cursor-pointer items-center gap-3 px-3.5 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    >
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
                        <p className="truncate text-[14px] font-semibold text-ink">{h.name}</p>
                        <p className="text-[12px] text-ink-muted">
                          {isBtc
                            ? `${Math.round(h.units * SATS_PER_BTC).toLocaleString()} sats (${h.units.toFixed(8)} BTC)`
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
                      {isBtc && (
                        <svg
                          aria-hidden="true"
                          width={14}
                          height={14}
                          viewBox="0 0 14 14"
                          fill="none"
                          className={`ml-1 shrink-0 text-ink-muted transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                        >
                          <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); openBuy(h) }}
                        title="Buy more"
                        aria-label={`Buy more ${h.name}`}
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-soft text-brand transition-colors hover:bg-brand hover:text-white"
                      >
                        <PlusIcon className="h-[18px] w-[18px]" strokeWidth={2.2} />
                      </button>
                    </div>

                    {/* BTC sub-breakdown panel */}
                    {isBtc && isExpanded && (
                      <div className="border-t border-line bg-surface-muted px-4 pb-3 pt-2">
                        <p className="mb-2 text-[12px] font-semibold text-ink-muted">
                          Locations
                        </p>
                        {(h.btcLocations ?? []).length === 0 ? (
                          <p className="text-[13px] text-ink-muted py-1">No locations yet. Use "Buy more" to add.</p>
                        ) : (
                          <ul className="space-y-1.5">
                            {(h.btcLocations ?? []).map((loc) => (
                              <li key={loc.id} className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2">
                                <div className="min-w-0 flex-1">
                                  <p className="text-[13px] font-semibold text-ink">{loc.name}</p>
                                  <p className="text-[12px] text-ink-muted tnum">
                                    {loc.satoshi.toLocaleString()} sats · {thb(loc.thbSpent)} spent
                                  </p>
                                </div>
                                <button
                                  onClick={() => openLocEdit(h.id, loc)}
                                  aria-label={`Edit ${loc.name}`}
                                  className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted hover:bg-surface-muted hover:text-ink transition-colors"
                                >
                                  <PencilIcon className="h-[14px] w-[14px]" />
                                </button>
                                <button
                                  onClick={() => removeBtcLocation(h.id, loc.id)}
                                  aria-label={`Remove ${loc.name}`}
                                  className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted hover:bg-loss/10 hover:text-loss transition-colors"
                                >
                                  <TrashIcon className="h-[14px] w-[14px]" />
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); openEdit(h) }}
                          className="mt-2 text-[12px] font-semibold text-brand hover:underline"
                        >
                          Edit holding details
                        </button>
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

function unitLabel(assetClass: AssetClass): string {
  if (assetClass === 'fund') return 'units'
  if (assetClass === 'stock') return 'shares'
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

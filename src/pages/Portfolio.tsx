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
import { SellHoldingModal } from '../components/forms/SellHoldingModal'
import { ConfirmDividendModal } from '../components/forms/ConfirmDividendModal'
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
import { PlusIcon, MinusIcon, PortfolioIcon, TrashIcon, PencilIcon, CopyIcon, CheckIcon, DownloadIcon, DotsHorizontalIcon, DividendIcon } from '../components/icons'
import {
  ASSET_META,
  GRAMS_PER_BAHT_GOLD,
  allocations,
  assetGroupAllocations,
  holdingMetrics,
  portfolioSummary,
} from '../lib/calc'
import { generatePortfolioMarkdown } from '../lib/portfolioMarkdown'
import { InteractivePortfolioChart } from '../components/charts/InteractiveTrendChart'
import type { AssetClass, BtcLocation, Holding } from '../lib/types'
import { money, thb, thbCompact } from '../lib/format'

const FILTERS: { key: AssetClass | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'fund', label: 'Thai Funds/Stocks' },
  { key: 'stock', label: 'US Stocks' },
  { key: 'crypto', label: 'Bitcoin' },
  { key: 'gold', label: 'Gold' },
  { key: 'real_estate', label: 'Real Estate' },
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
  const goldHolding = data.holdings.find((h) => h.assetClass === 'gold' && h.price > 0)
  const effectiveGoldThbPerGram = goldThbPerGram ?? goldHolding?.price ?? null
  const effectiveGoldPerBaht = effectiveGoldThbPerGram ? Math.round(effectiveGoldThbPerGram * GRAMS_PER_BAHT_GOLD) : null
  const effectiveUsdThb = usdThb && usdThb > 0 ? usdThb : null

  const [filter, setFilter] = useState<AssetClass | 'all'>('all')
  const [sortBy, setSortBy] = useState<'none' | 'value' | 'pnl' | 'type'>('value')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'group'>('list')
  const [donutMode, setDonutMode] = useState<'class' | 'group'>('class')
  const [copied, setCopied] = useState(false)

  const handleCopyMarkdown = async () => {
    try {
      const md = generatePortfolioMarkdown(data, effectiveUsdThb ?? usdThb, effectiveGoldThbPerGram)
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
  const [sellOpen, setSellOpen] = useState(false)
  const [selling, setSelling] = useState<Holding | null>(null)
  const [activeMenuHoldingId, setActiveMenuHoldingId] = useState<string | null>(null)
  const [menuDirection, setMenuDirection] = useState<'down' | 'up'>('down')

  // Close action dropdown menu when clicking outside or scrolling
  useEffect(() => {
    if (!activeMenuHoldingId) return
    const handleClose = () => setActiveMenuHoldingId(null)
    window.addEventListener('click', handleClose)
    window.addEventListener('scroll', handleClose, { passive: true })
    return () => {
      window.removeEventListener('click', handleClose)
      window.removeEventListener('scroll', handleClose)
    }
  }, [activeMenuHoldingId])

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
  const groupAlloc = assetGroupAllocations(data.holdings)

  // Record today's portfolio value snapshot whenever it changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (summary.value > 0) recordPortfolioSnapshot(summary.value) }, [summary.value])

  const openAdd = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (h: Holding) => { setEditing(h); setFormOpen(true) }
  const openBuy = (h: Holding) => {
    setSelling(null)
    setSellOpen(false)
    setBuying(h)
    setBuyOpen(true)
  }
  const openSell = (h: Holding) => {
    setBuying(null)
    setBuyOpen(false)
    setSelling(h)
    setSellOpen(true)
  }
  const [dividendOpen, setDividendOpen] = useState(false)
  const [dividendHolding, setDividendHolding] = useState<Holding | null>(null)
  const openDividend = (h: Holding) => {
    setDividendHolding(h)
    setDividendOpen(true)
  }
  const switchToSell = () => {
    if (buying) {
      const h = buying
      setBuying(null)
      setBuyOpen(false)
      setSelling(h)
      setSellOpen(true)
    }
  }
  const switchToBuy = () => {
    if (selling) {
      const h = selling
      setSelling(null)
      setSellOpen(false)
      setBuying(h)
      setBuyOpen(true)
    }
  }
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

  const TYPE_ORDER: Record<AssetClass, number> = { real_estate: 0, crypto: 1, gold: 2, stock: 3, fund: 4, cash: 5 }

  const searchTrimmed = search.trim()
  const searchLower = searchTrimmed.toLowerCase()
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9ก-๙]/g, '')
  const normSearch = norm(searchTrimmed)

  const rows = data.holdings
    .map(holdingMetrics)
    .filter((h) => filter === 'all' || h.assetClass === filter)
    .filter((h) => {
      if (!searchLower) return true
      const name = h.name.toLowerCase()
      const ticker = (h.ticker || '').toLowerCase()
      const tag = (h.tag || '').toLowerCase()
      if (name.includes(searchLower) || ticker.includes(searchLower) || tag.includes(searchLower)) return true
      if (normSearch && (norm(name).includes(normSearch) || norm(ticker).includes(normSearch) || norm(tag).includes(normSearch))) return true
      if (h.btcLocations?.some((l) => l.name.toLowerCase().includes(searchLower))) return true
      if (h.goldLocations?.some((l) => l.name.toLowerCase().includes(searchLower))) return true
      return false
    })
    .sort((a, b) => {
      if (sortBy === 'none') return 0
      const dir = sortDir === 'desc' ? -1 : 1
      if (sortBy === 'value') return dir * (a.marketValue - b.marketValue)
      if (sortBy === 'pnl')   return dir * (a.pnlPct - b.pnlPct)
      if (sortBy === 'type')  return dir * (TYPE_ORDER[a.assetClass] - TYPE_ORDER[b.assetClass])
      return 0
    })

  const groupedRows = assetGroupAllocations(rows)

  const segments = donutMode === 'class'
    ? alloc.map((a) => ({
        label: ASSET_META[a.assetClass]?.plural ?? a.assetClass,
        value: a.value,
        color: ASSET_META[a.assetClass]?.color ?? '#6366f1',
      }))
    : groupAlloc.map((g) => ({
        label: g.name,
        value: g.value,
        color: g.color,
      }))

  const handleExportCsv = () => {
    if (rows.length === 0) {
      showToast('No holdings to export', 'error')
      return
    }

    const headers = [
      'Asset Class',
      'Tag / Group',
      'Ticker',
      'Holding Name',
      'Quantity',
      'Unit',
      'Avg Cost (THB)',
      'Current Price (THB)',
      'Total Cost (THB)',
      'Market Value (THB)',
      'Unrealized PnL (THB)',
      'Unrealized PnL (%)',
      'Portfolio Weight (%)',
      'Foreign / Native Currency Details',
      'Storage Locations',
      'Last Updated',
    ]

    const escapeCsv = (val: string | number | null | undefined): string => {
      if (val === null || val === undefined) return ''
      const str = String(val).trim()
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    const rate = usdThb && usdThb > 0 ? usdThb : 35

    const csvRows = rows.map((h) => {
      const isStock = h.assetClass === 'stock'
      const isCrypto = h.assetClass === 'crypto'
      const isGold = h.assetClass === 'gold'
      const isFund = h.assetClass === 'fund'
      const isRealEstate = h.assetClass === 'real_estate'

      const assetClassLabel = ASSET_META[h.assetClass]?.label ?? h.assetClass
      const uLabel = unitLabel(h.assetClass)
      const avgCostThb = h.units > 0 ? h.costBasis / h.units : h.avgCost

      let nativeDetails = ''
      let locationsStr = ''

      if (isStock) {
        const avgUsd = h.avgCostUsd ?? (rate > 0 ? h.avgCost / rate : 0)
        const priceUsd = rate > 0 ? h.price / rate : 0
        const totalCostUsd = h.totalUsdInvested ?? (avgUsd * h.units)
        const marketValUsd = rate > 0 ? h.marketValue / rate : 0
        const pnlUsd = marketValUsd - totalCostUsd
        nativeDetails = `Avg: $${avgUsd.toFixed(2)} | Price: $${priceUsd.toFixed(2)} | Cost: $${totalCostUsd.toFixed(2)} | Value: $${marketValUsd.toFixed(2)} | PnL: ${pnlUsd >= 0 ? '+' : ''}$${pnlUsd.toFixed(2)}`
      } else if (isCrypto) {
        const sats = Math.round(h.units * SATS_PER_BTC)
        const avgCostPerBtc = h.units > 0 ? h.costBasis / h.units : h.avgCost
        const avgCostPerBtcUsd = rate > 0 ? avgCostPerBtc / rate : 0
        const priceUsd = rate > 0 ? h.price / rate : 0
        nativeDetails = `${sats.toLocaleString()} sats | Avg: $${Math.round(avgCostPerBtcUsd).toLocaleString()}/BTC | Price: $${Math.round(priceUsd).toLocaleString()}/BTC`
        locationsStr = (h.btcLocations ?? []).map((loc) => `${loc.name}: ${loc.satoshi.toLocaleString()} sats (฿${loc.thbSpent.toLocaleString()})`).join('; ')
      } else if (isGold) {
        const bahtGold = h.units / GRAMS_PER_BAHT_GOLD
        const avgCostPerBaht = (h.units > 0 ? h.costBasis / h.units : h.avgCost) * GRAMS_PER_BAHT_GOLD
        const pricePerBaht = h.price * GRAMS_PER_BAHT_GOLD
        nativeDetails = `${bahtGold.toFixed(4)} บาททอง | Avg: ฿${Math.round(avgCostPerBaht).toLocaleString()}/บาท | Price: ฿${Math.round(pricePerBaht).toLocaleString()}/บาท`
        locationsStr = (h.goldLocations ?? []).map((loc) => `${loc.name}: ${(loc.grams / GRAMS_PER_BAHT_GOLD).toFixed(4)} บาททอง (${loc.grams}g, ฿${loc.thbSpent.toLocaleString()})`).join('; ')
      } else if (isFund) {
        nativeDetails = `Avg NAV: ฿${h.avgCost.toFixed(4)} | Current NAV: ฿${h.price.toFixed(4)}`
      } else if (isRealEstate) {
        nativeDetails = `Real Estate | Valuation: ฿${h.price.toLocaleString()} | Cost: ฿${h.avgCost.toLocaleString()}`
      }

      const weightPct = summary.value > 0 ? (h.marketValue / summary.value) * 100 : 0
      const qty = isCrypto ? Number(h.units.toFixed(8)) : Number(h.units.toFixed(4))

      return [
        escapeCsv(assetClassLabel),
        escapeCsv(h.tag || ''),
        escapeCsv(h.ticker),
        escapeCsv(h.name),
        escapeCsv(qty),
        escapeCsv(uLabel),
        escapeCsv(avgCostThb.toFixed(2)),
        escapeCsv(h.price.toFixed(2)),
        escapeCsv(h.costBasis.toFixed(2)),
        escapeCsv(h.marketValue.toFixed(2)),
        escapeCsv(h.pnl.toFixed(2)),
        escapeCsv(`${h.pnlPct >= 0 ? '+' : ''}${h.pnlPct.toFixed(2)}%`),
        escapeCsv(`${weightPct.toFixed(2)}%`),
        escapeCsv(nativeDetails),
        escapeCsv(locationsStr),
        escapeCsv(h.updatedAt || ''),
      ].join(',')
    })

    const csvContent = '\uFEFF' + [headers.join(','), ...csvRows].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `spendiary-portfolio-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    showToast(`Exported ${rows.length} holding${rows.length === 1 ? '' : 's'} to CSV`, 'success')
  }

  const renderHoldingRow = (
    h: import('../lib/calc').HoldingMetrics,
    index: number,
    isLast: boolean,
    totalCount: number,
  ) => {
    const isBtc = h.assetClass === 'crypto'
    const isGold = h.assetClass === 'gold'
    const isRealEstate = h.assetClass === 'real_estate'
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
    const goldBaht = h.units / GRAMS_PER_BAHT_GOLD
    const unitsLabel = isBtc
      ? `${Math.round(h.units * SATS_PER_BTC).toLocaleString()} sats · avg ${money(btcAvgCostUsd, 'USD')}/BTC`
      : isGold
      ? `${h.units.toFixed(4)} g (${goldBaht.toFixed(4)} บาท) · avg ${thb(goldAvgCostPerBaht)}/บาท`
      : isRealEstate
      ? `${h.units} ${h.units > 1 ? 'units' : 'หลัง/ห้อง'} · ต้นทุน ฿${h.costBasis.toLocaleString()}`
      : `${h.units.toLocaleString()} ${unitLabel(h.assetClass)} · ${ASSET_META[h.assetClass]?.label ?? h.assetClass}`

    const staleIndicator = isPriceStale(h.updatedAt) && (
      <span title={`Price last updated: ${h.updatedAt ?? 'unknown'}`} aria-label="Price is stale" className="h-2 w-2 shrink-0 rounded-full bg-warn" />
    )

    const chevron = isExpandable && (
      <svg aria-hidden="true" width={14} height={14} viewBox="0 0 14 14" fill="none"
        className={`shrink-0 text-ink-muted transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
        <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )

    const rowClick = () => {
      if (isExpandable) setExpandedId(isExpanded ? null : h.id)
      else openEdit(h)
    }

    return (
      <li
        key={h.id}
        className={`transition-colors hover:bg-surface-muted/50 ${
          isLast && !isExpanded ? 'rounded-b-[var(--radius-card)]' : ''
        }`}
      >
        {/* ── Compact & Desktop Unified Row ── */}
        <div
          role="button"
          tabIndex={0}
          onClick={rowClick}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); rowClick() } }}
          aria-label={isExpandable ? (isExpanded ? `Collapse ${h.name}` : `Expand ${h.name}`) : `Edit ${h.name}`}
          className={`flex cursor-pointer items-center gap-3 px-4 py-3 sm:px-5 sm:py-3.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
            isLast && !isExpanded ? 'rounded-b-[var(--radius-card)]' : ''
          }`}
        >
          {badge}
          <div className="min-w-0 flex-1">
            {/* Line 1: name + value */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5 flex-wrap">
                <p className="truncate text-[14px] sm:text-[14.5px] font-semibold text-ink">
                  {h.name} <span className="text-[11px] sm:text-[11.5px] font-normal text-ink-muted ml-0.5">{h.ticker}</span>
                </p>
                {h.tag && (
                  <span className="inline-flex items-center rounded-md bg-brand/10 dark:bg-brand/20 px-1.5 py-0.5 text-[10px] sm:text-[10.5px] font-semibold text-brand tracking-tight shrink-0">
                    #{h.tag}
                  </span>
                )}
                {staleIndicator}{chevron}
              </div>
              <p className="shrink-0 text-[14px] sm:text-[14.5px] font-bold tnum text-ink">{thb(h.marketValue)}</p>
            </div>
            {/* Line 2: units + PnL% */}
            <div className="mt-0.5 flex items-center justify-between gap-2">
              <p className="truncate text-[11.5px] sm:text-[12px] text-ink-muted">{unitsLabel}</p>
              <PnLPill value={h.pnlPct} asPct size="sm" />
            </div>
          </div>

          {/* ── Action Dropdown Menu [ ⋯ ] ── */}
          <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={(e) => {
                if (activeMenuHoldingId === h.id) {
                  setActiveMenuHoldingId(null)
                } else {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const spaceBelow = window.innerHeight - rect.bottom
                  const isTailItem = totalCount >= 3 && index >= totalCount - 2
                  const openUp = (index >= 1 && isTailItem) || spaceBelow < 240 || (totalCount >= 4 && index >= totalCount - 3 && spaceBelow < 280)
                  setMenuDirection(openUp ? 'up' : 'down')
                  setActiveMenuHoldingId(h.id)
                }
              }}
              aria-label={`Actions for ${h.name}`}
              title="Actions / เมนูจัดการ"
              className={`relative grid h-8 w-8 place-items-center rounded-full transition-all cursor-pointer ${
                activeMenuHoldingId === h.id
                  ? 'bg-ink text-white dark:bg-[#4f46e5] shadow-xs'
                  : 'bg-surface-muted text-ink-muted hover:bg-surface-elevated hover:text-ink active:scale-95'
              }`}
            >
              <DotsHorizontalIcon className="h-4 w-4" />
            </button>

            {activeMenuHoldingId === h.id && (
              <div
                className={`absolute right-0 z-40 min-w-[165px] overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 ${
                  menuDirection === 'up'
                    ? 'bottom-full mb-1.5 origin-bottom-right'
                    : 'top-full mt-1.5 origin-top-right'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveMenuHoldingId(null)
                    openBuy(h)
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-semibold text-gain hover:bg-gain/10 transition-colors cursor-pointer text-left"
                >
                  <PlusIcon className="h-4 w-4 text-gain shrink-0" strokeWidth={2.4} />
                  <span>ซื้อเพิ่ม (Buy)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveMenuHoldingId(null)
                    openSell(h)
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer text-left"
                >
                  <MinusIcon className="h-4 w-4 text-rose-500 shrink-0" strokeWidth={2.4} />
                  <span>ขายออก (Sell)</span>
                </button>
                {(h.assetClass === 'fund' || h.assetClass === 'stock') && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMenuHoldingId(null)
                      openDividend(h)
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer text-left"
                  >
                    <DividendIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={2.2} />
                    <span>รับปันผล (Dividend)</span>
                  </button>
                )}
                <div className="my-1 border-t border-line/60" />
                <button
                  type="button"
                  onClick={() => {
                    setActiveMenuHoldingId(null)
                    openEdit(h)
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium text-ink-muted hover:bg-surface-muted hover:text-ink transition-colors cursor-pointer text-left"
                >
                  <PencilIcon className="h-3.5 w-3.5 shrink-0" />
                  <span>แก้ไข (Edit)</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* BTC / Gold sub-breakdown panel */}
        {isExpandable && isExpanded && (
          <div className={`border-t border-line bg-surface-muted px-5 pb-3.5 pt-2.5 ${
            isLast ? 'rounded-b-[var(--radius-card)]' : ''
          }`}>
            {/* Live Market Gold Price Banner */}
            {isGold && effectiveGoldPerBaht !== null && (
              <div className="mb-3 flex items-center justify-between rounded-xl bg-surface border border-line/70 px-3.5 py-2.5 shadow-2xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[14px]">
                    🏷️
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-semibold text-ink leading-tight">ราคาทองคำ Real-time</p>
                    <p className="text-[11px] text-ink-muted">Spot คำนวณทองไทย 96.5%</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[15px] font-bold text-amber-600 dark:text-amber-400 tnum leading-tight">
                    {thb(effectiveGoldPerBaht)}
                  </p>
                  <p className="text-[10.5px] font-medium text-ink-muted">ต่อบาททอง</p>
                </div>
              </div>
            )}

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
                      const locBaht = loc.grams / GRAMS_PER_BAHT_GOLD
                      return (
                        <li key={loc.id} className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-semibold text-ink">{loc.name}</p>
                            <p className="tnum text-[12px] text-ink-muted">
                              {loc.grams.toFixed(4)} g ({locBaht.toFixed(4)} บาททอง) · {thb(loc.thbSpent)} spent · avg {thb(locCostPerBaht)}/บาททอง
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
  }

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
            {priceStatus === 'loading' && (
              <>
                <span className="inline-block h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                <span>Updating live prices…</span>
                {effectiveUsdThb && <span className="text-ink-soft">· USD/THB {effectiveUsdThb.toFixed(2)}</span>}
                {effectiveGoldPerBaht !== null && (
                  <span className="text-ink-soft">
                    · Gold ฿{effectiveGoldPerBaht.toLocaleString()} / บาททอง
                  </span>
                )}
              </>
            )}
            {priceStatus === 'ok' && (
              <>
                <span className="inline-block h-2 w-2 rounded-full bg-gain animate-pulse" />
                Live{lastUpdated && ` · updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                {effectiveUsdThb && <span className="text-ink-soft">· USD/THB {effectiveUsdThb.toFixed(2)}</span>}
                {effectiveGoldPerBaht !== null && (
                  <span className="text-ink-soft">
                    · Gold ฿{effectiveGoldPerBaht.toLocaleString()} / บาททอง
                  </span>
                )}
              </>
            )}
            {priceStatus === 'partial' && (
              <>
                <span className="inline-block h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                Partial update{lastUpdated && ` · ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                {effectiveUsdThb && <span className="text-ink-soft">· USD/THB {effectiveUsdThb.toFixed(2)}</span>}
                {effectiveGoldPerBaht !== null && (
                  <span className="text-ink-soft">
                    · Gold ฿{effectiveGoldPerBaht.toLocaleString()} / บาททอง
                  </span>
                )}
                {errorMsg && <span className="text-loss text-[12px]">{errorMsg}</span>}
              </>
            )}
            {priceStatus === 'error' && (
              <>
                <span className="text-loss">
                  Price fetch failed ·{' '}
                  <button onClick={refreshPrices} className="underline cursor-pointer">retry</button>
                </span>
                {effectiveUsdThb && <span className="text-ink-soft">· USD/THB {effectiveUsdThb.toFixed(2)}</span>}
                {effectiveGoldPerBaht !== null && (
                  <span className="text-ink-soft">
                    · Gold ฿{effectiveGoldPerBaht.toLocaleString()} / บาททอง
                  </span>
                )}
              </>
            )}
            {priceStatus === 'idle' && (
              <>
                <span>Valued at saved prices</span>
                {effectiveUsdThb && <span className="text-ink-soft">· USD/THB {effectiveUsdThb.toFixed(2)}</span>}
                {effectiveGoldPerBaht !== null && (
                  <span className="text-ink-soft">
                    · Gold ฿{effectiveGoldPerBaht.toLocaleString()} / บาททอง
                  </span>
                )}
              </>
            )}
          </span>
        }
        onStartGuide={startTour}
        action={
          <div id="guide-portfolio-actions" className="flex items-center gap-2 flex-wrap">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportCsv}
              disabled={rows.length === 0}
              title="Export portfolio holdings to CSV"
              className="cursor-pointer shrink-0 h-9"
            >
              <DownloadIcon className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </Button>
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
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-[16px] font-bold text-ink">Port Allocation</h2>
              <div className="inline-flex rounded-lg bg-surface-muted p-0.5 text-[11px] font-semibold shrink-0">
                <button
                  type="button"
                  onClick={() => setDonutMode('class')}
                  aria-pressed={donutMode === 'class'}
                  className={`rounded-md px-2 py-1 transition-all cursor-pointer ${
                    donutMode === 'class'
                      ? 'bg-surface text-ink shadow-xs'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  ตามประเภท
                </button>
                <button
                  type="button"
                  onClick={() => setDonutMode('group')}
                  aria-pressed={donutMode === 'group'}
                  className={`rounded-md px-2 py-1 transition-all cursor-pointer ${
                    donutMode === 'group'
                      ? 'bg-surface text-ink shadow-xs'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  ตามกลุ่ม / Tag
                </button>
              </div>
            </div>

            {/* Value & PnL Hero Summary */}
            <div id="guide-portfolio-summary" className="mt-3.5 p-3.5 rounded-2xl bg-surface-muted/60 border border-line/60">
              <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                {/* Row 1: Labels */}
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Portfolio Value</span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted text-right">All-Time PnL</span>

                {/* Row 2: Values */}
                <div className="flex items-baseline min-w-0">
                  <p className="font-display text-[21px] sm:text-[24px] font-extrabold tracking-tight tnum text-ink leading-tight truncate">
                    {thb(summary.value)}
                  </p>
                </div>
                <div className="flex items-baseline justify-end min-w-0">
                  <PnLText
                    value={summary.pnl}
                    className="font-display text-[21px] sm:text-[24px] !font-extrabold tracking-tight leading-tight truncate"
                  />
                </div>

                {/* Row 3: Subtext / Details */}
                <div className="flex items-center min-w-0 h-6">
                  <p className="text-[11.5px] text-ink-muted font-medium truncate">
                    Cost: <span className="font-semibold tnum text-ink-soft">{thb(summary.cost)}</span>
                  </p>
                </div>
                <div className="flex items-center justify-end gap-1.5 min-w-0 h-6">
                  <PnLPill value={summary.pnlPct} asPct size="sm" />
                  <span className="text-[11px] text-ink-muted font-medium whitespace-nowrap">all-time</span>
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
                {donutMode === 'class' ? (
                  alloc.map((a) => {
                    const pctVal = summary.value > 0 ? (a.value / summary.value) * 100 : 0
                    return (
                      <div key={a.assetClass} className="flex items-center justify-between text-[12.5px]">
                        <span className="flex items-center gap-2 font-medium text-ink truncate mr-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ background: ASSET_META[a.assetClass].color }}
                          />
                          <span className="truncate">{ASSET_META[a.assetClass].plural}</span>
                        </span>
                        <span className="font-bold tnum text-ink shrink-0">
                          {thb(a.value)}{' '}
                          <span className="font-normal text-ink-muted text-[11px]">
                            ({pctVal.toFixed(1)}%)
                          </span>
                        </span>
                      </div>
                    )
                  })
                ) : (
                  groupAlloc.map((g) => {
                    return (
                      <div key={g.id} className="flex items-center justify-between text-[12.5px]">
                        <span className="flex items-center gap-2 font-medium text-ink truncate mr-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ background: g.color }}
                          />
                          <span className="truncate">{g.name}</span>
                          {g.isTag && (
                            <span className="rounded bg-brand/10 px-1 py-0.2 text-[9.5px] font-bold text-brand shrink-0">
                              Tag
                            </span>
                          )}
                        </span>
                        <span className="font-bold tnum text-ink shrink-0">
                          {thb(g.value)}{' '}
                          <span className="font-normal text-ink-muted text-[11px]">
                            ({g.pct.toFixed(1)}%)
                          </span>
                        </span>
                      </div>
                    )
                  })
                )}
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
        </div>

        {/* Right Column (7 cols): Holdings Hub & Management */}
        <div id="guide-portfolio-holdings" className="lg:col-span-7 xl:col-span-8 space-y-6">
          <Card className="animate-rise" padded={false}>
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
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* View Switcher: List vs Group */}
                    <div className="inline-flex rounded-full bg-surface-muted p-0.5 text-[11.5px] font-semibold border border-line/60">
                      <button
                        type="button"
                        onClick={() => setViewMode('list')}
                        aria-pressed={viewMode === 'list'}
                        className={`rounded-full px-2.5 py-1 transition-all cursor-pointer ${
                          viewMode === 'list'
                            ? 'bg-surface text-ink shadow-xs'
                            : 'text-ink-muted hover:text-ink'
                        }`}
                      >
                        รายการทั้งหมด
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('group')}
                        aria-pressed={viewMode === 'group'}
                        className={`rounded-full px-2.5 py-1 transition-all cursor-pointer ${
                          viewMode === 'group'
                            ? 'bg-surface text-ink shadow-xs'
                            : 'text-ink-muted hover:text-ink'
                        }`}
                      >
                        แยกตามกลุ่มสินทรัพย์
                      </button>
                    </div>
                    <AddButton onClick={openAdd} label="Add holding" />
                  </div>
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
                    placeholder="Search by name, ticker, or tag…"
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
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1.5 -my-1.5">
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
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1.5 -my-1.5">
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
                          className={`flex shrink-0 items-center justify-center gap-0.5 rounded-full h-[30px] px-2.5 text-[12px] font-semibold transition-colors cursor-pointer select-none leading-none ${
                            active
                              ? 'bg-ink text-white dark:bg-[#4f46e5] shadow-xs'
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

              {/* Holdings Rows / Grouped View */}
              {viewMode === 'list' ? (
                <ul className="divide-y divide-line border-t border-line">
                  {rows.map((h, index) =>
                    renderHoldingRow(h, index, index === rows.length - 1, rows.length)
                  )}
                </ul>
              ) : (
                <div className="p-3.5 sm:p-5 space-y-4 border-t border-line bg-surface-muted/20">
                  {groupedRows.map((group) => (
                    <div
                      key={group.id}
                      className="rounded-2xl border border-line bg-surface shadow-xs overflow-hidden"
                    >
                      {/* Group Header */}
                      <div className="px-4 py-3 bg-surface-muted/40 border-b border-line">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="h-3 w-3 rounded-full shrink-0 shadow-xs"
                              style={{ background: group.color }}
                            />
                            <h4 className="font-display text-[15px] font-bold text-ink truncate">
                              {group.name}
                            </h4>
                            <span className="rounded-full bg-surface px-2 py-0.5 text-[10.5px] font-semibold text-ink-muted border border-line shrink-0">
                              {group.holdingCount} {group.holdingCount === 1 ? 'position' : 'positions'}
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-display text-[15px] font-extrabold tnum text-ink">
                              {thb(group.value)}
                            </p>
                            <p className="text-[11px] font-bold text-ink-muted">
                              {group.pct.toFixed(1)}% ของพอร์ต
                            </p>
                          </div>
                        </div>

                        {/* Progress bar & Group PnL */}
                        <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
                          <span className="text-ink-muted truncate">ต้นทุน {thb(group.cost)}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <PnLText value={group.pnl} className="font-semibold" />
                            <PnLPill value={group.pnlPct} asPct size="sm" />
                          </div>
                        </div>
                        <div className="mt-2 h-1.5 w-full rounded-full bg-line overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.min(100, Math.max(0, group.pct))}%`,
                              background: group.color,
                            }}
                          />
                        </div>
                      </div>

                      {/* Group Holdings */}
                      <ul className="divide-y divide-line">
                        {group.holdings.map((h, hIdx) =>
                          renderHoldingRow(h, hIdx, hIdx === group.holdings.length - 1, group.holdings.length)
                        )}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* ── ROW 2: Portfolio Value Trend (Full Width at Bottom) ── */}
      <div id="guide-portfolio-chart" className="mt-6">
        <Card className="animate-rise overflow-hidden" padded={false}>
          {(data.portfolioHistory?.length ?? 0) >= 1 ? (
            <InteractivePortfolioChart history={data.portfolioHistory!} />
          ) : (
            <div className="p-8 text-center">
              <PortfolioIcon className="h-6 w-6 mx-auto text-brand mb-2" />
              <h3 className="font-display font-bold text-ink">Portfolio Value Trend</h3>
              <p className="text-[13px] text-ink-muted mt-1 max-w-md mx-auto">
                Snapshot history will record daily as your holdings and prices update.
              </p>
            </div>
          )}
        </Card>
      </div>

      <HoldingForm open={formOpen} editing={editing} onClose={() => setFormOpen(false)} />
      <BuyMoreForm
        open={buyOpen}
        holding={buying}
        onClose={() => {
          setBuyOpen(false)
          setBuying(null)
        }}
        onSwitchToSell={switchToSell}
      />
      <SellHoldingModal
        open={sellOpen}
        holding={selling}
        onClose={() => {
          setSellOpen(false)
          setSelling(null)
        }}
        onSwitchToBuy={switchToBuy}
      />
      <ConfirmDividendModal
        open={dividendOpen}
        holding={dividendHolding}
        onClose={() => {
          setDividendOpen(false)
          setDividendHolding(null)
        }}
      />

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

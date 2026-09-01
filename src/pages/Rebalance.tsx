import { useState } from 'react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { NumberField } from '../components/ui/Field'
import { AssetLogo } from '../components/ui/AssetLogo'
import { DonutChart } from '../components/charts/DonutChart'
import { HoldingForm } from '../components/forms/HoldingForm'
import { BuyMoreForm } from '../components/forms/BuyMoreForm'
import { PlannedAssetModal } from '../components/forms/PlannedAssetModal'
import { useData } from '../store/DataContext'
import { ASSET_META, totalCash } from '../lib/calc'
import { thb, thbCompact } from '../lib/format'
import type { Holding, InvestAssetClass, PlannedAsset, RebalanceMode } from '../lib/types'
import { CheckIcon, CopyIcon, PlusIcon, TrashIcon } from '../components/icons'

const REBALANCE_ASSETS: InvestAssetClass[] = ['fund', 'stock', 'gold', 'crypto']

export function Rebalance() {
  const {
    data,
    setRebalanceMode,
    setRebalanceTargets,
    setRebalanceHoldingTargets,
    removePlannedAsset,
    usdThb,
  } = useData()

  const [newCash, setNewCash] = useState<number | ''>('')
  const [smartRebalance, setSmartRebalance] = useState(true)
  const [plannedModalOpen, setPlannedModalOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  // Holding & Buy form modals
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Holding | null>(null)
  const [plannedForHolding, setPlannedForHolding] = useState<PlannedAsset | null>(null)
  const [buyOpen, setBuyOpen] = useState(false)
  const [buying, setBuying] = useState<Holding | null>(null)

  // Search filter for holdings mode
  const [search, setSearch] = useState('')

  const mode: RebalanceMode = data.rebalanceMode ?? 'class'
  const availCash = totalCash(data, usdThb)
  const portVal = data.holdings.reduce((sum, h) => sum + h.units * h.price, 0)
  const cashToDeploy = Number(newCash) || 0
  const targetTotalValue = portVal + cashToDeploy

  // ── 1. ASSET CLASS CALCULATIONS ──
  const initialClassTargets: Record<InvestAssetClass, number> = {
    fund: data.rebalanceTargets?.fund ?? 50,
    stock: data.rebalanceTargets?.stock ?? 30,
    gold: data.rebalanceTargets?.gold ?? 15,
    crypto: data.rebalanceTargets?.crypto ?? 5,
  }
  const [localClassTargets, setLocalClassTargets] = useState<Record<InvestAssetClass, number>>(initialClassTargets)

  const actualClassVals: Record<InvestAssetClass, number> = {
    fund: data.holdings.filter((h) => h.assetClass === 'fund').reduce((s, h) => s + h.units * h.price, 0),
    stock: data.holdings.filter((h) => h.assetClass === 'stock').reduce((s, h) => s + h.units * h.price, 0),
    crypto: data.holdings.filter((h) => h.assetClass === 'crypto').reduce((s, h) => s + h.units * h.price, 0),
    gold: data.holdings.filter((h) => h.assetClass === 'gold').reduce((s, h) => s + h.units * h.price, 0),
  }

  const classTargetsSum = Object.values(localClassTargets).reduce((s, x) => s + x, 0)

  const handleClassTargetChange = (key: InvestAssetClass, val: number) => {
    const updated = { ...localClassTargets, [key]: val }
    setLocalClassTargets(updated)
    const sum = Object.values(updated).reduce((s, x) => s + x, 0)
    if (sum === 100) {
      setRebalanceTargets(updated)
    }
  }

  const classRows = REBALANCE_ASSETS.map((key) => {
    const actualVal = actualClassVals[key]
    const actualPct = portVal > 0 ? (actualVal / portVal) * 100 : 0
    const targetPct = localClassTargets[key] ?? 0
    const targetVal = (targetPct / 100) * targetTotalValue

    const diff = targetVal - actualVal
    let actionLabel = '-'
    let actionCls = 'text-ink-muted'

    if (classTargetsSum === 100) {
      if (diff > 5) {
        actionLabel = `Buy ${thb(diff)}`
        actionCls = 'text-gain font-semibold'
      } else if (diff < -5) {
        actionLabel = `Sell ${thb(Math.abs(diff))}`
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

  // Smart Rebalance for Class Mode
  if (classTargetsSum === 100 && smartRebalance && cashToDeploy > 0) {
    const deficits = REBALANCE_ASSETS.map((key) => {
      const actualVal = actualClassVals[key]
      const targetVal = ((localClassTargets[key] ?? 0) / 100) * targetTotalValue
      return { key, deficit: Math.max(0, targetVal - actualVal) }
    })
    const totalDeficit = deficits.reduce((s, d) => s + d.deficit, 0)

    classRows.forEach((row) => {
      const def = deficits.find((d) => d.key === row.key)
      if (def && def.deficit > 0) {
        const allocated = totalDeficit > 0 ? cashToDeploy * (def.deficit / totalDeficit) : 0
        if (allocated > 5) {
          row.actionLabel = `Add ${thb(allocated)}`
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

  // ── 2. SPECIFIC HOLDINGS CALCULATIONS ──
  const plannedAssets = data.plannedAssets ?? []
  const activePlannedAssets = plannedAssets.filter(
    (pa) => !data.holdings.some((h) => h.ticker.toUpperCase() === pa.ticker.toUpperCase() || h.id === pa.id),
  )

  interface HoldingRowItem {
    id: string
    name: string
    ticker: string
    assetClass: InvestAssetClass
    actualVal: number
    actualPct: number
    targetPct: number
    targetVal: number
    diff: number
    actionLabel: string
    actionCls: string
    isPlanned: boolean
    holdingObj?: Holding
    plannedObj?: PlannedAsset
  }

  const [localHoldingTargets, setLocalHoldingTargets] = useState<Record<string, number>>(() => {
    const saved = data.rebalanceHoldingTargets ?? {}
    const init: Record<string, number> = {}
    data.holdings.forEach((h) => {
      init[h.id] = saved[h.id] ?? (portVal > 0 ? Math.round(((h.units * h.price) / portVal) * 100) : 0)
    })
    activePlannedAssets.forEach((p) => {
      init[p.id] = saved[p.id] ?? 0
    })
    return init
  })

  const holdingTargetsSum =
    data.holdings.reduce((s, h) => s + (localHoldingTargets[h.id] ?? 0), 0) +
    activePlannedAssets.reduce((s, p) => s + (localHoldingTargets[p.id] ?? 0), 0)

  const handleHoldingTargetChange = (id: string, val: number) => {
    const updated = { ...localHoldingTargets, [id]: val }
    setLocalHoldingTargets(updated)
    const sum =
      data.holdings.reduce((s, h) => s + (h.id === id ? val : (localHoldingTargets[h.id] ?? 0)), 0) +
      activePlannedAssets.reduce((s, p) => s + (p.id === id ? val : (localHoldingTargets[p.id] ?? 0)), 0)
    if (sum === 100) {
      setRebalanceHoldingTargets(updated)
    }
  }

  const holdingRows: HoldingRowItem[] = []

  // 1. Add owned holdings
  data.holdings.forEach((h) => {
    const actualVal = h.units * h.price
    const actualPct = portVal > 0 ? (actualVal / portVal) * 100 : 0
    const targetPct = localHoldingTargets[h.id] ?? 0
    const targetVal = (targetPct / 100) * targetTotalValue
    const diff = targetVal - actualVal

    let actionLabel = '-'
    let actionCls = 'text-ink-muted'

    if (holdingTargetsSum === 100) {
      if (diff > 5) {
        actionLabel = `Buy ${thb(diff)}`
        actionCls = 'text-gain font-semibold'
      } else if (diff < -5) {
        actionLabel = `Sell ${thb(Math.abs(diff))}`
        actionCls = 'text-loss font-semibold'
      } else {
        actionLabel = 'Balanced'
        actionCls = 'text-ink-muted font-medium'
      }
    }

    holdingRows.push({
      id: h.id,
      name: h.name,
      ticker: h.ticker,
      assetClass: h.assetClass as InvestAssetClass,
      actualVal,
      actualPct,
      targetPct,
      targetVal,
      diff,
      actionLabel,
      actionCls,
      isPlanned: false,
      holdingObj: h,
    })
  })

  // 2. Add planned assets
  activePlannedAssets.forEach((p) => {
    const actualVal = 0
    const actualPct = 0
    const targetPct = localHoldingTargets[p.id] ?? 0
    const targetVal = (targetPct / 100) * targetTotalValue
    const diff = targetVal

    let actionLabel = '-'
    let actionCls = 'text-ink-muted'

    if (holdingTargetsSum === 100) {
      if (diff > 5) {
        actionLabel = `Buy ${thb(diff)}`
        actionCls = 'text-gain font-semibold'
      } else {
        actionLabel = 'Balanced'
        actionCls = 'text-ink-muted font-medium'
      }
    }

    holdingRows.push({
      id: p.id,
      name: p.name,
      ticker: p.ticker,
      assetClass: p.assetClass,
      actualVal,
      actualPct,
      targetPct,
      targetVal,
      diff,
      actionLabel,
      actionCls,
      isPlanned: true,
      plannedObj: p,
    })
  })

  // Smart Rebalance for Holding Mode
  if (holdingTargetsSum === 100 && smartRebalance && cashToDeploy > 0) {
    const deficits = holdingRows.map((row) => ({
      id: row.id,
      deficit: Math.max(0, row.targetVal - row.actualVal),
    }))
    const totalDeficit = deficits.reduce((s, d) => s + d.deficit, 0)

    holdingRows.forEach((row) => {
      const def = deficits.find((d) => d.id === row.id)
      if (def && def.deficit > 0) {
        const allocated = totalDeficit > 0 ? cashToDeploy * (def.deficit / totalDeficit) : 0
        if (allocated > 5) {
          row.actionLabel = `Add ${thb(allocated)}`
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

  const currentTargetsSum = mode === 'class' ? classTargetsSum : holdingTargetsSum

  const autoBalanceRemaining = () => {
    if (mode === 'class') {
      const remaining = 100 - classTargetsSum
      if (remaining > 0) {
        const firstKey = REBALANCE_ASSETS[0]
        handleClassTargetChange(firstKey, (localClassTargets[firstKey] ?? 0) + remaining)
      }
    } else {
      const remaining = 100 - holdingTargetsSum
      if (remaining > 0 && holdingRows.length > 0) {
        const firstId = holdingRows[0].id
        handleHoldingTargetChange(firstId, (localHoldingTargets[firstId] ?? 0) + remaining)
      }
    }
  }

  // Filtered holding rows for display
  const searchLower = search.toLowerCase()
  const displayHoldingRows = holdingRows.filter(
    (h) => !search || h.name.toLowerCase().includes(searchLower) || h.ticker.toLowerCase().includes(searchLower),
  )

  // ── Donut Chart Data ──
  // Current Actual Donut
  const actualSegments = REBALANCE_ASSETS.map((key) => ({
    label: ASSET_META[key].plural,
    value: actualClassVals[key],
    color: ASSET_META[key].color,
  }))

  // Target Donut
  const targetSegments = REBALANCE_ASSETS.map((key) => {
    const pct = mode === 'class'
      ? (localClassTargets[key] ?? 0)
      : holdingRows.filter((h) => h.assetClass === key).reduce((s, h) => s + (localHoldingTargets[h.id] ?? 0), 0)
    return {
      label: ASSET_META[key].plural,
      value: (pct / 100) * targetTotalValue,
      color: ASSET_META[key].color,
    }
  })

  // ── Copy Markdown Plan ──
  const handleCopyPlan = () => {
    const lines: string[] = [
      `# Spendiary Rebalancing Plan (${new Date().toLocaleDateString()})`,
      `Mode: ${mode === 'class' ? 'Asset Class (Macro)' : 'Specific Holdings (Micro)'}`,
      `Current Portfolio Value: ${thb(portVal)}`,
      `New Cash to Deploy: ${thb(cashToDeploy)}`,
      `Projected Total Value: ${thb(targetTotalValue)}`,
      '',
      '## Action Checklist',
    ]

    if (mode === 'class') {
      classRows.forEach((r) => {
        if (r.actionLabel !== 'Balanced' && r.actionLabel !== '-') {
          lines.push(`- [ ] **${ASSET_META[r.key].plural}**: ${r.actionLabel} (Target: ${r.targetPct}%)`)
        }
      })
    } else {
      holdingRows.forEach((r) => {
        if (r.actionLabel !== 'Balanced' && r.actionLabel !== '-') {
          lines.push(`- [ ] **${r.ticker || r.name}** (${r.name}): ${r.actionLabel} (Target: ${r.targetPct}%)`)
        }
      })
    }

    navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Open Buy or Add handlers
  const openBuy = (h: Holding) => {
    setBuying(h)
    setBuyOpen(true)
  }

  const openAddPlanned = (planned: PlannedAsset) => {
    setEditing(null)
    setPlannedForHolding(planned)
    setFormOpen(true)
  }

  return (
    <>
      <PageHeader
        eyebrow="Portfolio Management"
        title="Portfolio Rebalance"
        subtitle={
          <span className="flex items-center gap-2 flex-wrap text-[14px] text-ink-muted">
            <span>Portfolio: <strong className="text-ink">{thb(portVal)}</strong></span>
            <span>·</span>
            <span>Available Liquid Cash: <strong className="text-emerald-600 dark:text-emerald-400">{thb(availCash)}</strong></span>
          </span>
        }
        action={
          <button
            type="button"
            onClick={handleCopyPlan}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-[12.5px] font-semibold text-ink shadow-[var(--shadow-soft)] transition-all duration-200 hover:bg-surface-muted active:scale-95 cursor-pointer whitespace-nowrap"
          >
            {copied ? (
              <>
                <CheckIcon className="h-4 w-4 text-gain shrink-0" strokeWidth={2.2} />
                <span className="text-gain">Copied Plan!</span>
              </>
            ) : (
              <>
                <CopyIcon className="h-4 w-4 text-ink-muted shrink-0" />
                <span>Copy Action Plan</span>
              </>
            )}
          </button>
        }
      />

      {/* Top 3 Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="animate-rise p-4">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Current Value</span>
          <p className="mt-1 font-display text-[22px] font-extrabold tnum text-ink leading-tight">
            {thb(portVal)}
          </p>
          <p className="mt-1 text-[11.5px] text-ink-muted font-medium">
            {data.holdings.length} active holding positions
          </p>
        </Card>

        <Card className="animate-rise p-4">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">New Cash Injection</span>
          <p className="mt-1 font-display text-[22px] font-extrabold tnum text-brand leading-tight">
            +{thb(cashToDeploy)}
          </p>
          <p className="mt-1 text-[11.5px] text-ink-muted font-medium">
            Available liquid: <span className="font-semibold text-ink-soft">{thbCompact(availCash)}</span>
          </p>
        </Card>

        <Card className="animate-rise p-4">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Projected Total Value</span>
          <p className="mt-1 font-display text-[22px] font-extrabold tnum text-ink leading-tight">
            {thb(targetTotalValue)}
          </p>
          <div className="mt-1 flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${currentTargetsSum === 100 ? 'bg-gain' : 'bg-warn animate-pulse'}`} />
            <span className={`text-[11.5px] font-bold ${currentTargetsSum === 100 ? 'text-gain' : 'text-warn'}`}>
              {currentTargetsSum === 100 ? '100% Target Sum' : `Sum: ${currentTargetsSum}% (Incomplete)`}
            </span>
          </div>
        </Card>
      </div>

      {/* Main 2-Column Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (5 cols): Strategy Controls & Allocation Visualizer */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6">
          {/* Strategy & Deployment Card */}
          <Card className="animate-rise">
            <h2 className="font-display text-[16px] font-bold text-ink">Rebalance Setup</h2>
            <p className="text-[12px] text-ink-muted mb-4">Configure allocation mode & capital</p>

            <div className="space-y-4">
              {/* Mode Switcher */}
              <div className="space-y-1.5">
                <span className="text-[11.5px] font-bold uppercase tracking-wider text-ink-muted">
                  Allocation Mode
                </span>
                <div className="flex rounded-xl bg-surface-muted p-1 gap-1">
                  <button
                    type="button"
                    onClick={() => setRebalanceMode('class')}
                    className={`flex-1 rounded-lg py-2 text-[12.5px] font-bold transition-all cursor-pointer ${
                      mode === 'class'
                        ? 'bg-surface text-ink shadow-sm'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    Asset Class (Macro)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRebalanceMode('holding')}
                    className={`flex-1 rounded-lg py-2 text-[12.5px] font-bold transition-all cursor-pointer ${
                      mode === 'holding'
                        ? 'bg-surface text-ink shadow-sm'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    Holdings ({holdingRows.length})
                  </button>
                </div>
              </div>

              {/* Cash Deployment */}
              <div className="space-y-2">
                <NumberField
                  label="New Cash to Deploy"
                  prefix="฿"
                  value={newCash}
                  onChange={setNewCash}
                  placeholder="e.g. 50,000"
                />

                {availCash > 0 && Number(newCash) !== availCash && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setNewCash(Math.round(availCash))}
                      className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-[11.5px] font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 active:scale-95 transition-all cursor-pointer"
                    >
                      <span>+ Use Available Cash: {thb(availCash)}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Smart Rebalance Toggle */}
              <div className="pt-2 border-t border-line">
                <label className="flex items-center gap-2.5 text-[13px] font-semibold text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={smartRebalance}
                    onChange={(e) => setSmartRebalance(e.target.checked)}
                    className="rounded border-line-strong text-brand focus:ring-brand/15 h-4 w-4"
                  />
                  <span>Smart Rebalance (Buy Only)</span>
                </label>
                <p className="mt-1 text-[11.5px] text-ink-muted leading-relaxed">
                  Calculates purchases exclusively for underweight positions without generating sell advice.
                </p>
              </div>

              {/* Targets Sum Warning */}
              {currentTargetsSum !== 100 && (
                <div className="rounded-xl border border-warn/25 bg-warn-soft px-3.5 py-2.5 text-[12px] text-warn font-semibold flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8}>
                      <path d="M8 5v4M8 11.5v.5" strokeLinecap="round" />
                      <circle cx={8} cy={8} r={6.5} />
                    </svg>
                    <span>Targets sum to {currentTargetsSum}%. Must equal 100%.</span>
                  </div>
                  {currentTargetsSum < 100 && (
                    <button
                      type="button"
                      onClick={autoBalanceRemaining}
                      className="shrink-0 underline text-[11.5px] hover:text-ink font-bold cursor-pointer"
                    >
                      Fill +{100 - currentTargetsSum}%
                    </button>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Side-by-Side Allocation Visualizer */}
          <Card className="animate-rise">
            <h2 className="font-display text-[16px] font-bold text-ink">Allocation Comparison</h2>
            <p className="text-[12px] text-ink-muted mb-4">Current vs Target Distribution</p>

            <div className="grid grid-cols-2 gap-4 items-center justify-items-center pt-2">
              <div className="flex flex-col items-center">
                <span className="text-[11.5px] font-bold text-ink-muted mb-2">Current</span>
                <DonutChart
                  segments={actualSegments}
                  size={120}
                  thickness={14}
                  ariaLabel="Current portfolio allocation"
                  centerLabel="Total"
                  centerValue={thbCompact(portVal)}
                />
              </div>

              <div className="flex flex-col items-center">
                <span className="text-[11.5px] font-bold text-brand mb-2">Target</span>
                <DonutChart
                  segments={targetSegments}
                  size={120}
                  thickness={14}
                  ariaLabel="Target portfolio allocation"
                  centerLabel="Projected"
                  centerValue={thbCompact(targetTotalValue)}
                />
              </div>
            </div>

            {/* Legend */}
            <div className="mt-4 pt-3 border-t border-line space-y-1.5">
              {REBALANCE_ASSETS.map((key) => {
                const actualPct = portVal > 0 ? (actualClassVals[key] / portVal) * 100 : 0
                const targetPct = mode === 'class'
                  ? (localClassTargets[key] ?? 0)
                  : holdingRows.filter((h) => h.assetClass === key).reduce((s, h) => s + (localHoldingTargets[h.id] ?? 0), 0)

                return (
                  <div key={key} className="flex items-center justify-between text-[12px]">
                    <span className="flex items-center gap-2 font-medium text-ink">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: ASSET_META[key].color }} />
                      {ASSET_META[key].plural}
                    </span>
                    <span className="font-semibold tnum text-ink">
                      {actualPct.toFixed(0)}% <span className="text-ink-muted font-normal">→</span> <span className="text-brand font-bold">{targetPct}%</span>
                    </span>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>

        {/* Right Column (7 cols): Full Interactive Target Table */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          <Card className="animate-rise overflow-hidden" padded={false}>
            <div className="p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-[17px] font-bold text-ink">
                    {mode === 'class' ? 'Macro Asset Allocation Targets' : 'Specific Holding Targets'}
                  </h3>
                  <p className="text-[12px] text-ink-muted">
                    {mode === 'class'
                      ? 'Adjust target percentages per asset class'
                      : `${displayHoldingRows.length} positions and planned assets`}
                  </p>
                </div>

                {mode === 'holding' && (
                  <button
                    type="button"
                    onClick={() => setPlannedModalOpen(true)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand px-3.5 text-[12px] font-bold text-white dark:text-slate-950 shadow-xs hover:bg-brand/90 active:scale-95 transition-all cursor-pointer"
                  >
                    <PlusIcon className="h-4 w-4" strokeWidth={2.2} />
                    <span>+ Add Target Asset</span>
                  </button>
                )}
              </div>

              {/* Search Filter for Holdings Mode */}
              {mode === 'holding' && (
                <div className="relative mb-4">
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
                    placeholder="Filter by name or ticker…"
                    className="w-full rounded-xl border border-line bg-surface-muted py-2 pl-9 pr-8 text-[13px] text-ink outline-none placeholder:text-ink-faint focus:border-brand focus:ring-2 focus:ring-brand/20"
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
              )}

              {/* ── Mode 1 Table: Asset Class ── */}
              {mode === 'class' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13px] border-collapse">
                    <thead>
                      <tr className="text-ink-muted border-b border-line pb-2 font-medium">
                        <th className="pb-2 font-semibold text-left">Asset Class</th>
                        <th className="pb-2 font-semibold text-right">Current Value</th>
                        <th className="pb-2 font-semibold text-center w-[90px]">Target %</th>
                        <th className="pb-2 font-semibold text-right">Projected Value</th>
                        <th className="pb-2 font-semibold text-right">Action Advice</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classRows.map((row) => {
                        const color = ASSET_META[row.key]?.color
                        const shortName = ASSET_META[row.key]?.plural ?? row.key

                        return (
                          <tr key={row.key} className="border-b border-line last:border-0 align-middle hover:bg-surface-muted/40 transition-colors">
                            <td className="py-3 text-left font-medium text-ink">
                              <div className="flex items-center gap-2">
                                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: color }} />
                                <span className="font-bold">{shortName}</span>
                              </div>
                            </td>

                            <td className="py-3 text-right tnum text-ink-soft">
                              <div className="font-bold text-ink">{thb(row.actualVal)}</div>
                              <div className="text-[11px] text-ink-muted">{row.actualPct.toFixed(1)}% of total</div>
                            </td>

                            <td className="py-3 text-center">
                              <div className="inline-flex items-center rounded-xl border border-line-strong px-2 py-1 bg-surface-muted max-w-[75px] mx-auto shadow-xs">
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={row.targetPct}
                                  onChange={(e) =>
                                    handleClassTargetChange(
                                      row.key,
                                      Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                                    )
                                  }
                                  className="w-full text-center outline-none bg-transparent tnum text-[13px] font-bold text-ink"
                                />
                                <span className="text-[10px] text-ink-muted font-bold">%</span>
                              </div>
                            </td>

                            <td className="py-3 text-right tnum font-semibold text-ink-soft">
                              {thb(row.targetVal)}
                            </td>

                            <td className="py-3 text-right tnum font-bold text-[12.5px]">
                              {classTargetsSum === 100 ? (
                                <span className={`inline-block px-2.5 py-1 rounded-full text-[12px] ${
                                  row.actionCls.includes('text-gain')
                                    ? 'bg-gain-soft text-gain'
                                    : row.actionCls.includes('text-loss')
                                    ? 'bg-loss-soft text-loss'
                                    : row.actionCls.includes('text-brand')
                                    ? 'bg-brand-soft text-brand'
                                    : 'bg-surface-muted text-ink-muted'
                                }`}>
                                  {row.actionLabel}
                                </span>
                              ) : (
                                <span className="text-ink-muted">-</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── Mode 2 Table: Specific Holdings & Planned Assets ── */}
              {mode === 'holding' && (
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[13px] border-collapse">
                      <thead>
                        <tr className="text-ink-muted border-b border-line pb-2 font-medium">
                          <th className="pb-2 font-semibold text-left">Security</th>
                          <th className="pb-2 font-semibold text-right">Current Value</th>
                          <th className="pb-2 font-semibold text-center w-[85px]">Target %</th>
                          <th className="pb-2 font-semibold text-right">Projected</th>
                          <th className="pb-2 font-semibold text-right">Action Advice</th>
                          <th className="pb-2 font-semibold text-right w-[65px]">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayHoldingRows.map((row) => {
                          const hasAction =
                            (row.actionLabel.startsWith('Buy') || row.actionLabel.startsWith('Add')) &&
                            holdingTargetsSum === 100

                          return (
                            <tr key={row.id} className="border-b border-line last:border-0 align-middle hover:bg-surface-muted/40 transition-colors">
                              <td className="py-3 text-left font-medium text-ink max-w-[180px]">
                                <div className="flex items-center gap-2.5">
                                  <AssetLogo
                                    ticker={row.ticker}
                                    name={row.name}
                                    assetClass={row.assetClass}
                                    size="md"
                                  />
                                  <div className="min-w-0">
                                    <p className="truncate text-[13.5px] font-bold text-ink leading-tight">
                                      {row.ticker || row.name}
                                    </p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <span className="truncate text-[11.5px] text-ink-muted">{row.name}</span>
                                      {row.isPlanned && (
                                        <span className="shrink-0 rounded bg-brand/15 px-1.5 py-0.2 text-[9.5px] font-extrabold text-brand uppercase">
                                          Planned
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              <td className="py-3 text-right tnum text-ink-soft">
                                <div className="font-bold text-ink">
                                  {row.actualVal > 0 ? thb(row.actualVal) : '฿0'}
                                </div>
                                <div className="text-[11px] text-ink-muted">
                                  {row.actualPct.toFixed(1)}%
                                </div>
                              </td>

                              <td className="py-3 text-center">
                                <div className="inline-flex items-center rounded-xl border border-line-strong px-2 py-1 bg-surface-muted max-w-[70px] mx-auto shadow-xs">
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={row.targetPct}
                                    onChange={(e) =>
                                      handleHoldingTargetChange(
                                        row.id,
                                        Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                                      )
                                    }
                                    className="w-full text-center outline-none bg-transparent tnum text-[12.5px] font-bold text-ink"
                                  />
                                  <span className="text-[10px] text-ink-muted font-bold">%</span>
                                </div>
                              </td>

                              <td className="py-3 text-right tnum font-semibold text-ink-soft">
                                {thb(row.targetVal)}
                              </td>

                              <td className="py-3 text-right tnum font-bold text-[12px]">
                                {holdingTargetsSum === 100 ? (
                                  <span className={`inline-block px-2.5 py-1 rounded-full text-[11.5px] ${
                                    row.actionCls.includes('text-gain')
                                      ? 'bg-gain-soft text-gain'
                                      : row.actionCls.includes('text-loss')
                                      ? 'bg-loss-soft text-loss'
                                      : row.actionCls.includes('text-brand')
                                      ? 'bg-brand-soft text-brand'
                                      : 'bg-surface-muted text-ink-muted'
                                  }`}>
                                    {row.actionLabel}
                                  </span>
                                ) : (
                                  <span className="text-ink-muted">-</span>
                                )}
                              </td>

                              <td className="py-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {hasAction && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (row.isPlanned && row.plannedObj) {
                                          openAddPlanned(row.plannedObj)
                                        } else if (row.holdingObj) {
                                          openBuy(row.holdingObj)
                                        }
                                      }}
                                      title={row.isPlanned ? 'Add to portfolio' : 'Buy more'}
                                      className="inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1 text-[11px] font-bold text-white dark:text-slate-950 shadow-xs hover:bg-brand/90 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                                    >
                                      {row.isPlanned ? '+ Add' : '+ Buy'}
                                    </button>
                                  )}
                                  {row.isPlanned && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        removePlannedAsset(row.id)
                                        setLocalHoldingTargets((prev) => {
                                          const next = { ...prev }
                                          delete next[row.id]
                                          return next
                                        })
                                      }}
                                      title="Remove planned asset"
                                      className="p-1.5 rounded-full text-ink-muted hover:text-loss hover:bg-loss-soft/30 transition-colors cursor-pointer"
                                    >
                                      <TrashIcon className="h-4 w-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Planned Asset Autocomplete Modal */}
      <PlannedAssetModal
        open={plannedModalOpen}
        onClose={() => setPlannedModalOpen(false)}
        onAdded={(id, targetPct) => {
          if (targetPct !== undefined) {
            handleHoldingTargetChange(id, targetPct)
          }
        }}
      />

      {/* Holding & Buy Modals */}
      <HoldingForm
        open={formOpen}
        editing={editing}
        initialPlannedAsset={plannedForHolding}
        onClose={() => {
          setFormOpen(false)
          setPlannedForHolding(null)
        }}
      />
      <BuyMoreForm open={buyOpen} holding={buying} onClose={() => setBuyOpen(false)} />
    </>
  )
}

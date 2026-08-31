import { useState } from 'react'
import { useData } from '../../store/DataContext'
import { Card } from '../ui/Card'
import { NumberField } from '../ui/Field'
import { AssetLogo } from '../ui/AssetLogo'
import { PlannedAssetModal } from '../forms/PlannedAssetModal'
import { ASSET_META, totalCash } from '../../lib/calc'
import { thb, thbCompact } from '../../lib/format'
import type { Holding, InvestAssetClass, PlannedAsset, RebalanceMode } from '../../lib/types'
import { PlusIcon, TrashIcon } from '../icons'

interface Props {
  onBuyHolding: (holding: Holding) => void
  onAddPlannedAsset: (planned: PlannedAsset) => void
}

const REBALANCE_ASSETS: InvestAssetClass[] = ['fund', 'stock', 'gold', 'crypto']

export function RebalancingSection({ onBuyHolding, onAddPlannedAsset }: Props) {
  const {
    data,
    setRebalanceMode,
    setRebalanceTargets,
    setRebalanceHoldingTargets,
    removePlannedAsset,
    usdThb,
  } = useData()

  const [open, setOpen] = useState(false)
  const [newCash, setNewCash] = useState<number | ''>('')
  const [smartRebalance, setSmartRebalance] = useState(false)
  const [plannedModalOpen, setPlannedModalOpen] = useState(false)

  const mode: RebalanceMode = data.rebalanceMode ?? 'class'

  // Available cash from accounts
  const availCash = totalCash(data, usdThb)

  // Portfolio total value
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

  // ── 2. SPECIFIC HOLDINGS CALCULATIONS ──
  const plannedAssets = data.plannedAssets ?? []
  // Filter planned assets that are already owned (matched by ticker)
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

  const holdingTargetsSum = Object.values(localHoldingTargets).reduce((s, x) => s + (x || 0), 0)

  const handleHoldingTargetChange = (id: string, val: number) => {
    const updated = { ...localHoldingTargets, [id]: val }
    setLocalHoldingTargets(updated)
    const sum = Object.values(updated).reduce((s, x) => s + (x || 0), 0)
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
        actionLabel = `Buy ${thbCompact(diff)}`
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

  return (
    <Card className="animate-rise">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-[16px] font-bold text-ink">Rebalancing</h2>
          <p className="text-[12px] text-ink-muted">
            {mode === 'class' ? 'Macro Asset Allocation' : 'Specific Asset Targets'}
          </p>
        </div>
        <button
          onClick={() => setOpen(!open)}
          aria-label={open ? 'Close rebalancing configuration' : 'Configure rebalancing targets'}
          aria-expanded={open}
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-ink px-3 text-[11.5px] font-semibold text-white shadow-[var(--shadow-soft)] transition-all duration-200 hover:bg-ink-hover dark:bg-brand dark:hover:bg-brand-ink active:scale-95 cursor-pointer whitespace-nowrap"
        >
          {open ? 'Close' : 'Configure'}
        </button>
      </div>

      {open && (
        <div className="mt-4 space-y-4 pt-3 border-t border-line">
          {/* Mode Switcher Segmented Control */}
          <div className="space-y-1.5">
            <span className="text-[11.5px] font-bold uppercase tracking-wider text-ink-muted">
              Rebalance By
            </span>
            <div className="flex rounded-xl bg-surface-muted p-1 gap-1">
              <button
                type="button"
                onClick={() => setRebalanceMode('class')}
                className={`flex-1 rounded-lg py-1.5 text-[12px] font-bold transition-all cursor-pointer ${
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
                className={`flex-1 rounded-lg py-1.5 text-[12px] font-bold transition-all cursor-pointer ${
                  mode === 'holding'
                    ? 'bg-surface text-ink shadow-sm'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                Specific Holdings ({holdingRows.length})
              </button>
            </div>
          </div>

          {/* Cash Deployment and Quick Chip */}
          <div className="space-y-2">
            <NumberField
              label="New Cash to Deploy"
              prefix="฿"
              value={newCash}
              onChange={setNewCash}
              placeholder="e.g. 50,000"
            />

            {/* Quick-fill liquid cash chip */}
            {availCash > 0 && Number(newCash) !== availCash && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setNewCash(Math.round(availCash))}
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 active:scale-95 transition-all cursor-pointer"
                >
                  <span>+ Use Available Cash: {thb(availCash)}</span>
                </button>
              </div>
            )}

            {Number(newCash) > 0 && (
              <div className="flex flex-col justify-end pt-1">
                <label className="flex items-center gap-2 text-[12.5px] font-semibold text-ink-soft cursor-pointer">
                  <input
                    type="checkbox"
                    checked={smartRebalance}
                    onChange={(e) => setSmartRebalance(e.target.checked)}
                    className="rounded border-line-strong text-brand focus:ring-brand/15 h-4 w-4"
                  />
                  Smart Rebalancing (Buy Only)
                </label>
                <p className="mt-0.5 text-[11px] text-ink-muted">
                  Directs new cash solely to underweight positions. No sell recommendations.
                </p>
              </div>
            )}
          </div>

          {/* Targets Sum Warning */}
          {currentTargetsSum !== 100 && (
            <div className="rounded-xl border border-warn/25 bg-warn-soft px-3 py-2 text-[12px] text-warn font-semibold flex items-center justify-between gap-2">
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

          {/* ── Table Mode 1: Asset Class ── */}
          {mode === 'class' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12px] border-collapse">
                <thead>
                  <tr className="text-ink-muted border-b border-line pb-1.5 font-medium">
                    <th className="pb-1.5 font-semibold text-left">Asset Class</th>
                    <th className="pb-1.5 font-semibold text-right">Actual</th>
                    <th className="pb-1.5 font-semibold text-center w-[70px]">Target</th>
                    <th className="pb-1.5 font-semibold text-right">Advice</th>
                  </tr>
                </thead>
                <tbody>
                  {classRows.map((row) => {
                    const color = ASSET_META[row.key]?.color
                    const shortName = ASSET_META[row.key]?.plural ?? row.key

                    return (
                      <tr key={row.key} className="border-b border-line last:border-0 align-middle">
                        <td className="py-2.5 text-left font-medium text-ink">
                          <div className="flex items-center gap-1.5">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                            <span className="truncate">{shortName}</span>
                          </div>
                        </td>

                        <td className="py-2.5 text-right tnum text-ink-soft">
                          <div className="font-semibold">{thbCompact(row.actualVal)}</div>
                          <div className="text-[10.5px] text-ink-muted">{row.actualPct.toFixed(0)}%</div>
                        </td>

                        <td className="py-2.5 text-center">
                          <div className="inline-flex items-center rounded-lg border border-line-strong px-1 py-0.5 bg-surface-muted max-w-[60px] mx-auto">
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
                              className="w-full text-center outline-none bg-transparent tnum text-[12px] font-bold text-ink"
                            />
                            <span className="text-[9.5px] text-ink-muted font-bold">%</span>
                          </div>
                        </td>

                        <td className="py-2.5 text-right tnum font-bold text-[11.5px]">
                          {classTargetsSum === 100 ? (
                            <span className={row.actionCls}>{row.actionLabel}</span>
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

          {/* ── Table Mode 2: Specific Holdings & Planned Assets ── */}
          {mode === 'holding' && (
            <div className="space-y-3">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12px] border-collapse">
                  <thead>
                    <tr className="text-ink-muted border-b border-line pb-1.5 font-medium">
                      <th className="pb-1.5 font-semibold text-left">Asset</th>
                      <th className="pb-1.5 font-semibold text-right">Actual</th>
                      <th className="pb-1.5 font-semibold text-center w-[65px]">Target</th>
                      <th className="pb-1.5 font-semibold text-right">Advice</th>
                      <th className="pb-1.5 font-semibold text-right w-[45px]">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holdingRows.map((row) => {
                      const hasAction = (row.actionLabel.startsWith('Buy') || row.actionLabel.startsWith('Add')) && currentTargetsSum === 100

                      return (
                        <tr key={row.id} className="border-b border-line last:border-0 align-middle">
                          <td className="py-2.5 text-left font-medium text-ink max-w-[130px]">
                            <div className="flex items-center gap-1.5">
                              <AssetLogo
                                ticker={row.ticker}
                                name={row.name}
                                assetClass={row.assetClass}
                                size="sm"
                              />
                              <div className="min-w-0">
                                <p className="truncate text-[12px] font-bold text-ink leading-tight">
                                  {row.ticker || row.name}
                                </p>
                                <div className="flex items-center gap-1">
                                  <span className="truncate text-[10.5px] text-ink-muted">{row.name}</span>
                                  {row.isPlanned && (
                                    <span className="shrink-0 rounded bg-brand/15 px-1 py-0.2 text-[9px] font-extrabold text-brand uppercase">
                                      Planned
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-2.5 text-right tnum text-ink-soft">
                            <div className="font-semibold">
                              {row.actualVal > 0 ? thbCompact(row.actualVal) : '฿0'}
                            </div>
                            <div className="text-[10px] text-ink-muted">
                              {row.actualPct.toFixed(0)}%
                            </div>
                          </td>

                          <td className="py-2.5 text-center">
                            <div className="inline-flex items-center rounded-lg border border-line-strong px-1 py-0.5 bg-surface-muted max-w-[55px] mx-auto">
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
                                className="w-full text-center outline-none bg-transparent tnum text-[11.5px] font-bold text-ink"
                              />
                              <span className="text-[9px] text-ink-muted font-bold">%</span>
                            </div>
                          </td>

                          <td className="py-2.5 text-right tnum font-bold text-[11px]">
                            {holdingTargetsSum === 100 ? (
                              <span className={row.actionCls}>{row.actionLabel}</span>
                            ) : (
                              <span className="text-ink-muted">-</span>
                            )}
                          </td>

                          <td className="py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {hasAction && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (row.isPlanned && row.plannedObj) {
                                      onAddPlannedAsset(row.plannedObj)
                                    } else if (row.holdingObj) {
                                      onBuyHolding(row.holdingObj)
                                    }
                                  }}
                                  title={row.isPlanned ? 'Add to portfolio' : 'Buy more'}
                                  className="inline-flex items-center gap-0.5 rounded-full bg-brand-soft px-2 py-0.5 text-[10.5px] font-bold text-brand hover:bg-brand hover:text-white transition-all cursor-pointer"
                                >
                                  {row.isPlanned ? 'Add' : 'Buy'}
                                </button>
                              )}
                              {row.isPlanned && (
                                <button
                                  type="button"
                                  onClick={() => removePlannedAsset(row.id)}
                                  title="Remove planned asset"
                                  className="p-1 rounded-full text-ink-muted hover:text-loss hover:bg-loss-soft/20 transition-colors cursor-pointer"
                                >
                                  <TrashIcon className="h-3.5 w-3.5" />
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

              {/* Add Target Asset button */}
              <button
                type="button"
                onClick={() => setPlannedModalOpen(true)}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-line-strong text-[12px] font-semibold text-brand hover:bg-surface-muted active:scale-[0.99] transition-all cursor-pointer"
              >
                <PlusIcon className="h-4 w-4" />
                <span>+ Add Target Asset (Wishlist / New Position)</span>
              </button>
            </div>
          )}
        </div>
      )}

      <PlannedAssetModal
        open={plannedModalOpen}
        onClose={() => setPlannedModalOpen(false)}
        onAdded={(id, targetPct) => {
          if (targetPct !== undefined) {
            handleHoldingTargetChange(id, targetPct)
          }
        }}
      />
    </Card>
  )
}

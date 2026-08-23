import { useEffect, useRef, useState } from 'react'
import { Modal } from '../ui/Modal'
import { NumberField, SelectField, TextField } from '../ui/Field'
import { FormActions } from './FormActions'
import { Button } from '../ui/Button'
import { useData } from '../../store/DataContext'
import { useToast } from '../../store/ToastContext'
import { ASSET_META, GRAMS_PER_BAHT_GOLD } from '../../lib/calc'
import type { AssetClass, Holding } from '../../lib/types'
import { localDateStr, thb } from '../../lib/format'
import { searchSecurities, type Security } from '../../lib/securities'
import { PencilIcon } from '../icons'

interface Props {
  open: boolean
  editing: Holding | null
  onClose: () => void
}

const SATS_PER_BTC = 100_000_000

const newId = () => crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

function formatToMaxDecimals(val: number | string, maxDecimals: number): string {
  const num = Number(val)
  if (isNaN(num) || val === '') return ''
  return Number(num.toFixed(maxDecimals)).toString()
}

function formatCostOrFx(val: number | string): string {
  const num = Number(val)
  if (isNaN(num) || val === '') return ''
  const str = num.toString()
  const dotIdx = str.indexOf('.')
  if (dotIdx === -1) {
    return num.toFixed(2)
  }
  const decimals = str.length - dotIdx - 1
  if (decimals <= 2) {
    return num.toFixed(2)
  }
  const rounded = Number(num.toFixed(4))
  const roundedStr = rounded.toString()
  const roundedDotIdx = roundedStr.indexOf('.')
  if (roundedDotIdx === -1) {
    return rounded.toFixed(2)
  }
  const roundedDecimals = roundedStr.length - roundedDotIdx - 1
  if (roundedDecimals < 2) {
    return rounded.toFixed(2)
  }
  return roundedStr
}

const blank = {
  name: '',
  ticker: '',
  assetClass: 'fund' as AssetClass,
  units: '' as number | string | '',
  avgCost: '' as number | string | '',
  price: '' as number | string | '',
}

export function HoldingForm({ open, editing, onClose }: Props) {
  const { upsertHolding, removeHolding, addHoldingLog, usdThb } = useData()
  const { showToast } = useToast()

  // Generic fields
  const [form, setForm] = useState(blank)
  const [showErrors, setShowErrors] = useState(false)

  // Applied FX Rate for stocks
  const [fxRateInput, setFxRateInput] = useState<number | string | ''>('')

  // Manual THB Invested override for stocks
  const [thbInvestedInput, setThbInvestedInput] = useState<number | string | ''>('')
  const [isThbInvestedManuallyEdited, setIsThbInvestedManuallyEdited] = useState(false)
  const [isEditingThb, setIsEditingThb] = useState(false)

  // Autocomplete (fund/stock only)
  const [suggestions, setSuggestions] = useState<Security[]>([])

  // BTC new-holding fields
  const [satoshi, setSatoshi] = useState<number | ''>('')
  const [btcThbSpent, setBtcThbSpent] = useState<number | ''>('')
  const [locationName, setLocationName] = useState('')

  // Gold new-holding fields
  const [goldUnit, setGoldUnit] = useState<'grams' | 'baht'>('grams')
  const [grams, setGrams] = useState<number | ''>('')
  const [goldBaht, setGoldBaht] = useState<number | ''>('')
  const [goldThbSpent, setGoldThbSpent] = useState<number | ''>('')
  const [goldLocationName, setGoldLocationName] = useState('')

  const isBtc = form.assetClass === 'crypto'
  const isUsd = form.assetClass === 'stock'
  const isGold = form.assetClass === 'gold'
  const rate = usdThb ?? 1

  // Guard: only reset form when modal freshly opens (false→true),
  // not when editing/price changes due to live price ticks.
  const wasOpen = useRef(false)

  useEffect(() => {
    const justOpened = !wasOpen.current && open
    wasOpen.current = open
    if (!justOpened) {
      if (open && !editing && !fxRateInput && usdThb) {
        setFxRateInput(formatCostOrFx(usdThb))
      }
      return
    }

    if (editing) {
      const loadedAvgCost = editing.assetClass === 'stock'
        ? (editing.avgCostUsd ?? (rate > 1 ? Number((editing.avgCost / rate).toFixed(4)) : editing.avgCost))
        : editing.avgCost
      const loadedPrice = editing.assetClass === 'stock'
        ? (rate > 1 ? Number((editing.price / rate).toFixed(4)) : editing.price)
        : editing.price

      setForm({
        name: editing.name,
        ticker: editing.ticker,
        assetClass: editing.assetClass,
        units: editing.assetClass === 'stock' ? formatToMaxDecimals(editing.units, 4) : editing.units,
        avgCost: editing.assetClass === 'stock' ? formatCostOrFx(loadedAvgCost) : loadedAvgCost,
        price: loadedPrice,
      })
      if (editing.assetClass === 'stock') {
        const impliedRate = editing.avgCostThb && editing.avgCostUsd ? editing.avgCostThb / editing.avgCostUsd : (usdThb || 35)
        setFxRateInput(formatCostOrFx(impliedRate))

        const histThb = editing.totalThbInvested ?? (editing.units * editing.avgCost)
        setThbInvestedInput(Number(histThb.toFixed(2)))
        setIsThbInvestedManuallyEdited(true)
        setIsEditingThb(false)
      } else {
        setFxRateInput('')
        setThbInvestedInput('')
        setIsThbInvestedManuallyEdited(false)
        setIsEditingThb(false)
      }
    } else {
      setForm(blank)
      setSatoshi('')
      setBtcThbSpent('')
      setLocationName('')
      setGrams('')
      setGoldThbSpent('')
      setGoldLocationName('')
      setFxRateInput(usdThb ? formatCostOrFx(usdThb) : '')
      setThbInvestedInput('')
      setIsThbInvestedManuallyEdited(false)
      setIsEditingThb(false)
    }
    setShowErrors(false)
  }, [open, editing, usdThb])

  // Interactive handlers for dynamic dual-currency and FX rate recalculations
  const handleSharesChange = (newUnits: number | string | '') => {
    setForm((f) => ({ ...f, units: newUnits }))
    const shares = Number(newUnits) || 0
    const avgCost = Number(form.avgCost) || 0
    const totalUsd = Number((shares * avgCost).toFixed(4))
    const fxRate = Number(fxRateInput) || usdThb || 35
    const calculatedThb = Number((totalUsd * fxRate).toFixed(2))
    setThbInvestedInput(calculatedThb)
  }

  const handleAvgCostChange = (newAvgCost: number | string | '') => {
    setForm((f) => ({ ...f, avgCost: newAvgCost }))
    const shares = Number(form.units) || 0
    const avgCost = Number(newAvgCost) || 0
    const totalUsd = Number((shares * avgCost).toFixed(4))
    const fxRate = Number(fxRateInput) || usdThb || 35
    const calculatedThb = Number((totalUsd * fxRate).toFixed(2))
    setThbInvestedInput(calculatedThb)
  }

  const handleThbInvestedChange = (newThb: number | string | '') => {
    setThbInvestedInput(newThb)
    setIsThbInvestedManuallyEdited(true)

    if (newThb === '') {
      setFxRateInput('')
      return
    }

    const thbVal = Number(newThb) || 0
    const shares = Number(form.units) || 0
    const avgCost = Number(form.avgCost) || 0
    const totalUsd = Number((shares * avgCost).toFixed(4))

    if (totalUsd > 0) {
      const calculatedFxRate = Number((thbVal / totalUsd).toFixed(4))
      setFxRateInput(calculatedFxRate)
    }
  }

  const handleFxRateChange = (newRate: number | string | '') => {
    setFxRateInput(newRate)
    setIsThbInvestedManuallyEdited(true)

    if (newRate === '') {
      setThbInvestedInput('')
      return
    }

    const rateVal = Number(newRate) || 0
    const shares = Number(form.units) || 0
    const avgCost = Number(form.avgCost) || 0
    const totalUsd = Number((shares * avgCost).toFixed(4))

    const calculatedThb = Number((totalUsd * rateVal).toFixed(2))
    setThbInvestedInput(calculatedThb)
  }

  const handleSharesBlur = () => {
    if (form.assetClass === 'stock') {
      const formatted = formatToMaxDecimals(form.units, 4)
      setForm((f) => ({ ...f, units: formatted }))
      
      const shares = Number(formatted) || 0
      const avgCost = Number(form.avgCost) || 0
      const totalUsd = Number((shares * avgCost).toFixed(4))
      const fxRate = Number(fxRateInput) || usdThb || 35
      const calculatedThb = Number((totalUsd * fxRate).toFixed(2))
      setThbInvestedInput(calculatedThb)
    }
  }

  const handleAvgCostBlur = () => {
    if (form.assetClass === 'stock') {
      const formatted = formatCostOrFx(form.avgCost)
      setForm((f) => ({ ...f, avgCost: formatted }))
      
      const shares = Number(form.units) || 0
      const avgCost = Number(formatted) || 0
      const totalUsd = Number((shares * avgCost).toFixed(4))
      const fxRate = Number(fxRateInput) || usdThb || 35
      const calculatedThb = Number((totalUsd * fxRate).toFixed(2))
      setThbInvestedInput(calculatedThb)
    }
  }

  const handleFxRateBlur = () => {
    if (form.assetClass === 'stock') {
      const formatted = formatCostOrFx(fxRateInput)
      setFxRateInput(formatted)
      
      const rateVal = Number(formatted) || 0
      const shares = Number(form.units) || 0
      const avgCost = Number(form.avgCost) || 0
      const totalUsd = Number((shares * avgCost).toFixed(4))
      const calculatedThb = Number((totalUsd * rateVal).toFixed(2))
      setThbInvestedInput(calculatedThb)
    }
  }

  const handleThbInvestedBlur = () => {
    if (thbInvestedInput !== '') {
      const formatted = Number(Number(thbInvestedInput).toFixed(2))
      setThbInvestedInput(formatted)
      
      const shares = Number(form.units) || 0
      const avgCost = Number(form.avgCost) || 0
      const totalUsd = Number((shares * avgCost).toFixed(4))
      if (totalUsd > 0) {
        const calculatedFxRate = Number((formatted / totalUsd).toFixed(4))
        setFxRateInput(formatCostOrFx(calculatedFxRate))
      }
    }
  }

  // ── Save: BTC new holding ──
  function saveBtc() {
    const sats = Number(satoshi)
    const spent = Number(btcThbSpent)
    const locName = locationName.trim()
    if (sats <= 0 || spent <= 0 || !locName) { setShowErrors(true); return }

    const btcUnits = sats / SATS_PER_BTC
    const avgCostThb = spent / btcUnits
    const savedHolding: Holding = {
      id: editing?.id ?? newId(),
      name: 'Bitcoin',
      ticker: 'BTC',
      assetClass: 'crypto',
      units: btcUnits,
      totalUnits: btcUnits,
      avgCost: avgCostThb,
      avgCostThb,
      totalThbInvested: spent,
      price: editing?.price ?? avgCostThb,
      btcLocations: [{ id: newId(), name: locName, satoshi: sats, thbSpent: spent }],
      updatedAt: localDateStr(),
    }
    upsertHolding(savedHolding)
    addHoldingLog({
      action: 'add',
      holdingId: savedHolding.id,
      holdingName: 'Bitcoin',
      ticker: 'BTC',
      assetClass: 'crypto',
      note: `${sats.toLocaleString()} sats · ฿${spent.toLocaleString()} spent · ${locationName.trim()}`,
      afterHoldingState: savedHolding,
    })
    onClose()
  }

  // ── Save: Gold new holding ──
  function saveGold() {
    const g = goldUnit === 'baht'
      ? (goldBaht !== '' ? Number(goldBaht) * GRAMS_PER_BAHT_GOLD : 0)
      : Number(grams)
    const spent = Number(goldThbSpent)
    const locName = goldLocationName.trim()
    if (g <= 0 || spent <= 0 || !locName) { setShowErrors(true); return }

    const avgCostThb = spent / g
    const bahtAmount = (g / GRAMS_PER_BAHT_GOLD).toFixed(4)
    const savedHolding: Holding = {
      id: editing?.id ?? newId(),
      name: 'Gold',
      ticker: 'XAU',
      assetClass: 'gold',
      units: g,
      totalUnits: g,
      avgCost: avgCostThb,
      avgCostThb,
      totalThbInvested: spent,
      price: avgCostThb,
      goldLocations: [{ id: newId(), name: locName, grams: g, thbSpent: spent }],
      updatedAt: localDateStr(),
    }
    upsertHolding(savedHolding)
    addHoldingLog({
      action: 'add',
      holdingId: savedHolding.id,
      holdingName: 'Gold',
      ticker: 'XAU',
      assetClass: 'gold',
      note: `${g.toFixed(4)} g (${bahtAmount} บาททอง) · ฿${spent.toLocaleString()} spent · ${goldLocationName.trim()}`,
      afterHoldingState: savedHolding,
    })
    onClose()
  }

  // ── Save: Fund / Stock / Gold edit ──
  function save() {
    const livePrice = editing?.price
    const useLivePrice = (isBtc || isUsd) && editing
    const valid =
      form.name.trim() !== '' &&
      form.units !== '' &&
      form.avgCost !== '' &&
      (useLivePrice || form.price !== '')
    if (!valid) { setShowErrors(true); return }

    const name = form.name.trim()
    const ticker = form.ticker.trim() || name.slice(0, 4).toUpperCase()
    const unitsNum = Number(form.units)
    const avgCostInput = Number(form.avgCost)

    let updateObj: Partial<Holding> = {
      id: editing?.id,
      name,
      ticker,
      assetClass: form.assetClass,
      units: unitsNum,
      totalUnits: unitsNum,
      updatedAt: localDateStr(),
    }

    if (isUsd) {
      const fxRateVal = Number(fxRateInput) || usdThb || 35
      const totalThbInvested = parseFloat((Number(thbInvestedInput) || 0).toFixed(2))
      const totalUsdInvested = Number((unitsNum * avgCostInput).toFixed(4))
      const avgCostUsd = avgCostInput
      const avgCostThb = unitsNum > 0 ? parseFloat((totalThbInvested / unitsNum).toFixed(2)) : 0

      updateObj = {
        ...updateObj,
        totalThbInvested,
        totalUsdInvested,
        avgCostUsd,
        avgCostThb,
        avgCost: avgCostThb,
        price: useLivePrice ? livePrice! : parseFloat(((Number(form.price) || 0) * (usdThb || fxRateVal)).toFixed(2)),
      }
    } else {
      const avgCostThb = avgCostInput
      const totalThbInvested = unitsNum * avgCostThb

      updateObj = {
        ...updateObj,
        avgCostThb,
        totalThbInvested,
        avgCost: avgCostThb,
        price: Number(form.price),
      }
    }

    const savedHolding = updateObj as Holding
    upsertHolding(savedHolding)
    addHoldingLog({
      action: editing ? 'edit' : 'add',
      holdingId: editing?.id ?? savedHolding.id,
      holdingName: name,
      ticker,
      assetClass: form.assetClass,
      note: editing
        ? `${unitsNum.toLocaleString(undefined, { maximumFractionDigits: 4 })} shares · cost basis ฿${updateObj.totalThbInvested?.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
        : `${unitsNum.toLocaleString(undefined, { maximumFractionDigits: 4 })} shares @ ${isUsd ? `$${avgCostInput.toLocaleString()}` : `฿${avgCostInput.toLocaleString()}`}/unit`,
      previousHoldingState: editing ? JSON.parse(JSON.stringify(editing)) : undefined,
      afterHoldingState: savedHolding,
    })
    showToast(editing ? `Updated ${name}` : `Added ${name} to portfolio`, 'success')
    onClose()
  }

  // Derived previews
  const sats = Number(satoshi)
  const btcSpent = Number(btcThbSpent)
  const btcAmount = sats > 0 ? sats / SATS_PER_BTC : 0
  const btcImpliedPrice = btcAmount > 0 && btcSpent > 0 ? btcSpent / btcAmount : 0

  const goldGrams = goldUnit === 'baht'
    ? (goldBaht !== '' ? Number(goldBaht) * GRAMS_PER_BAHT_GOLD : 0)
    : Number(grams)
  const goldSpent = Number(goldThbSpent)
  const goldImpliedPrice = goldGrams > 0 && goldSpent > 0 ? goldSpent / goldGrams : 0

  // Derived values for US Stock dual-currency cards
  const sharesInputVal = Number(form.units) || 0
  const avgCostUsdVal = Number(form.avgCost) || 0
  const fxRateVal = Number(fxRateInput) || usdThb || 35

  const totalThbInvestedVal = Number(Number(thbInvestedInput).toFixed(2)) || 0

  const livePriceUsd = editing ? Number((editing.price / (usdThb || 35)).toFixed(4)) : (Number(form.price) || 0)
  const currentMarketValueThb = Number((sharesInputVal * livePriceUsd * (usdThb || fxRateVal)).toFixed(2))
  const netPnlThb = Number((currentMarketValueThb - totalThbInvestedVal).toFixed(2))
  const netReturnPct = totalThbInvestedVal > 0 ? Number(((netPnlThb / totalThbInvestedVal) * 100).toFixed(2)) : 0

  const formattedNetPnlThb = netPnlThb > 0
    ? `+฿${netPnlThb.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : netPnlThb < 0
    ? `-฿${Math.abs(netPnlThb).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `฿0.00`

  const modalDescription = isBtc
    ? 'Log your first purchase in Satoshi.'
    : isGold
    ? 'Log your first gold purchase in grams.'
    : isUsd
    ? `Prices in USD, converted to THB at ${usdThb ? `฿${usdThb.toFixed(2)}/USD` : 'live rate'}.`
    : 'Mutual fund, valued in THB.'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit holding' : 'Add holding'}
      description={modalDescription}
    >
      <div className="space-y-5">
        {/* Asset class — always first */}
        <SelectField
          label="Asset class"
          value={form.assetClass}
          onChange={(v) => {
            setForm((f) => ({ ...f, assetClass: v as AssetClass }))
            setSuggestions([])
          }}
          options={[
            { value: 'fund', label: 'Mutual Fund' },
            { value: 'stock', label: 'US Stock' },
            { value: 'crypto', label: 'Bitcoin' },
            { value: 'gold', label: 'Gold' },
          ]}
        />

        {/* Name + Ticker — only for fund/stock (and edit mode for all) */}
        {(!isBtc && !isGold) || editing ? (
          <>
            <div className="relative">
              <TextField
                label="Name"
                value={form.name}
                error={showErrors && form.name.trim() === '' ? 'Name is required' : undefined}
                onChange={(name) => {
                  setForm((f) => ({ ...f, name }))
                  setSuggestions((!isBtc && !isGold) ? searchSecurities(name, form.assetClass) : [])
                }}
                onBlur={() => setTimeout(() => setSuggestions([]), 150)}
                placeholder={isBtc ? 'e.g. My Bitcoin' : isUsd ? 'e.g. Apple Inc.' : isGold ? 'e.g. My Gold' : 'e.g. Kasikorn Fund'}
              />
              {suggestions.length > 0 && (
                <ul className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
                  {suggestions.map((s) => (
                    <li key={s.ticker}>
                      <button
                        type="button"
                        aria-label={`Select ${s.ticker} - ${s.name}`}
                        className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-surface-muted"
                        onMouseDown={() => {
                          setForm((f) => ({ ...f, name: s.name, ticker: s.ticker }))
                          setSuggestions([])
                        }}
                      >
                        <span className="min-w-[52px] rounded-md bg-surface-muted px-1.5 py-0.5 text-center text-[11px] font-bold tracking-wide text-ink-muted">
                          {s.ticker}
                        </span>
                        <span className="text-[13.5px] text-ink">{s.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <TextField
              label="Ticker"
              hint="optional"
              value={form.ticker}
              onChange={(ticker) => setForm((f) => ({ ...f, ticker: ticker.toUpperCase() }))}
              placeholder={isBtc ? 'BTC' : isUsd ? 'AAPL' : isGold ? 'XAU' : 'e.g. KF-CASH'}
            />
          </>
        ) : null}

        {/* ── BTC: new holding ── */}
        {isBtc && !editing && (
          <>
            <TextField
              label="Location"
              value={locationName}
              onChange={setLocationName}
              placeholder="e.g. Ledger, Binance, Trezor"
              error={showErrors && !locationName.trim() ? 'Location is required' : undefined}
            />
            <div className="grid grid-cols-1 gap-3 ">
              <NumberField
                label="Satoshi bought"
                value={satoshi}
                error={showErrors && (satoshi === '' || Number(satoshi) <= 0) ? 'Required (> 0)' : undefined}
                onChange={setSatoshi}
                placeholder="e.g. 500000"
                step={1}
              />
              <NumberField
                label="THB spent"
                prefix="฿"
                value={btcThbSpent}
                error={showErrors && (btcThbSpent === '' || Number(btcThbSpent) <= 0) ? 'Required (> 0)' : undefined}
                onChange={setBtcThbSpent}
                placeholder="0"
              />
            </div>
            {sats > 0 && btcSpent > 0 && (
              <div
                className="rounded-2xl border px-4 py-3"
                style={{
                  borderColor: `color-mix(in srgb, ${ASSET_META.crypto.color} 35%, transparent)`,
                  background: `color-mix(in srgb, ${ASSET_META.crypto.color} 10%, transparent)`,
                }}
              >
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-ink-soft">Implied price / BTC</span>
                  <span className="font-semibold tnum text-ink">{thb(btcImpliedPrice)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[13px]">
                  <span className="text-ink-soft">BTC amount</span>
                  <span className="font-semibold tnum text-ink">{btcAmount.toFixed(8)} BTC ({sats.toLocaleString()} sats)</span>
                </div>
              </div>
            )}
            <div className="pt-3">
              <Button onClick={saveBtc} className="w-full">Add holding</Button>
            </div>
          </>
        )}

        {/* ── BTC: edit ── */}
        {isBtc && editing && (
          <>
            <div>
              <NumberField
                label="BTC held (decimal)"
                value={form.units}
                error={showErrors && form.units === '' ? 'Units are required' : undefined}
                onChange={(units) => setForm((f) => ({ ...f, units }))}
                placeholder="0"
                step={0.00000001}
              />
              {Number(form.units) > 0 && (
                <p className="mt-1 text-[11.5px] text-ink-muted">
                  ≈ {Math.round(Number(form.units) * SATS_PER_BTC).toLocaleString()} sats
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 ">
              <NumberField
                label="Avg cost / BTC"
                prefix="฿"
                value={form.avgCost}
                error={showErrors && form.avgCost === '' ? 'Cost is required' : undefined}
                onChange={(avgCost) => setForm((f) => ({ ...f, avgCost }))}
                placeholder="0"
              />
              <div>
                <p className="mb-1.5 text-[13px] font-medium text-ink-muted">Current price / BTC</p>
                <div className="flex h-10 items-center gap-2 rounded-xl bg-surface-muted px-3">
                  <span className="text-[13px] font-semibold tnum text-ink">
                    ฿{editing.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                  <span className="ml-auto rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">Live</span>
                </div>
              </div>
            </div>
            <FormActions
              editing
              canSave={true}
              onSave={save}
              onDelete={() => { removeHolding(editing.id); onClose() }}
            />
          </>
        )}

        {/* ── Gold: new holding ── */}
        {isGold && !editing && (
          <>
            <TextField
              label="Location"
              value={goldLocationName}
              onChange={setGoldLocationName}
              placeholder="e.g. Home safe, Bank vault, Hua Seng Heng"
              error={showErrors && !goldLocationName.trim() ? 'Location is required' : undefined}
            />

            {/* Unit selector tab */}
            <div className="space-y-1">
              <label className="text-[13px] font-medium text-ink-soft">Purchase Unit / หน่วยซื้อ</label>
              <div className="flex rounded-xl bg-surface-muted p-1 gap-1">
                <button
                  type="button"
                  onClick={() => setGoldUnit('grams')}
                  className={`flex-1 rounded-lg py-1.5 text-[12px] font-semibold transition-all cursor-pointer ${
                    goldUnit === 'grams'
                      ? 'bg-surface text-ink shadow-sm'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  กรัม (Grams)
                </button>
                <button
                  type="button"
                  onClick={() => setGoldUnit('baht')}
                  className={`flex-1 rounded-lg py-1.5 text-[12px] font-semibold transition-all cursor-pointer ${
                    goldUnit === 'baht'
                      ? 'bg-surface text-ink shadow-sm'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  บาททองคำ (15.244g)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {goldUnit === 'grams' ? (
                <NumberField
                  label="Grams bought (กรัม)"
                  value={grams}
                  error={showErrors && (grams === '' || Number(grams) <= 0) ? 'Required (> 0)' : undefined}
                  onChange={(val) => {
                    setGrams(val)
                    if (val !== '' && Number(val) > 0) {
                      setGoldBaht(Number((Number(val) / GRAMS_PER_BAHT_GOLD).toFixed(6)))
                    } else {
                      setGoldBaht('')
                    }
                  }}
                  placeholder="e.g. 15.244"
                  step={0.0001}
                />
              ) : (
                <NumberField
                  label="Weight bought in บาททองคำ (ทองคำแท่ง)"
                  value={goldBaht}
                  error={showErrors && (goldBaht === '' || Number(goldBaht) <= 0) ? 'Required (> 0)' : undefined}
                  onChange={(val) => {
                    setGoldBaht(val)
                    if (val !== '' && Number(val) > 0) {
                      setGrams(Number((Number(val) * GRAMS_PER_BAHT_GOLD).toFixed(6)))
                    } else {
                      setGrams('')
                    }
                  }}
                  placeholder="e.g. 1.0"
                  step={0.0001}
                />
              )}
              <NumberField
                label="THB spent (บาท)"
                prefix="฿"
                value={goldThbSpent}
                error={showErrors && (goldThbSpent === '' || Number(goldThbSpent) <= 0) ? 'Required (> 0)' : undefined}
                onChange={setGoldThbSpent}
                placeholder="0"
              />
            </div>
            {goldGrams > 0 && goldSpent > 0 && (
              <div
                className="rounded-2xl border px-4 py-3 space-y-1.5"
                style={{
                  borderColor: `color-mix(in srgb, ${ASSET_META.gold.color} 35%, transparent)`,
                  background: `color-mix(in srgb, ${ASSET_META.gold.color} 10%, transparent)`,
                }}
              >
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-ink-soft">Implied price / gram</span>
                  <span className="font-semibold tnum text-ink">{thb(goldImpliedPrice)}</span>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-ink-soft">Implied cost / บาททองคำ</span>
                  <span className="font-semibold tnum text-brand">{thb(goldImpliedPrice * GRAMS_PER_BAHT_GOLD)}</span>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-ink-soft">Total weight</span>
                  <span className="font-semibold tnum text-ink">{goldGrams.toFixed(4)} g ({(goldGrams / GRAMS_PER_BAHT_GOLD).toFixed(4)} บาททอง)</span>
                </div>
              </div>
            )}
            <div className="pt-3">
              <Button onClick={saveGold} className="w-full">Add holding</Button>
            </div>
          </>
        )}

        {/* ── Gold: edit ── */}
        {isGold && editing && (
          <>
            <div>
              <NumberField
                label="Weight held (grams)"
                value={form.units}
                error={showErrors && form.units === '' ? 'Weight is required' : undefined}
                onChange={(units) => setForm((f) => ({ ...f, units }))}
                placeholder="0"
                step={0.0001}
              />
              {Number(form.units) > 0 && (
                <p className="mt-1 text-[11.5px] text-ink-muted">
                  ≈ {(Number(form.units) / GRAMS_PER_BAHT_GOLD).toFixed(4)} บาททองคำ
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 ">
              <div>
                <NumberField
                  label="Avg cost / gram"
                  prefix="฿"
                  value={form.avgCost}
                  error={showErrors && form.avgCost === '' ? 'Cost is required' : undefined}
                  onChange={(avgCost) => setForm((f) => ({ ...f, avgCost }))}
                  placeholder="0"
                />
                {Number(form.avgCost) > 0 && (
                  <p className="mt-1 text-[11.5px] text-ink-muted">
                    ≈ {thb(Number(form.avgCost) * GRAMS_PER_BAHT_GOLD)} / บาททองคำ
                  </p>
                )}
              </div>
              <div>
                <NumberField
                  label="Current price / gram"
                  prefix="฿"
                  value={form.price}
                  error={showErrors && form.price === '' ? 'Price is required' : undefined}
                  onChange={(price) => setForm((f) => ({ ...f, price }))}
                  placeholder="0"
                />
                {Number(form.price) > 0 && (
                  <p className="mt-1 text-[11.5px] text-ink-muted">
                    ≈ {thb(Number(form.price) * GRAMS_PER_BAHT_GOLD)} / บาททองคำ
                  </p>
                )}
              </div>
            </div>
            <FormActions
              editing
              canSave={true}
              onSave={save}
              onDelete={() => { removeHolding(editing.id); onClose() }}
            />
          </>
        )}

        {/* ── Fund / Stock: new + edit ── */}
        {!isBtc && !isGold && (
          isUsd ? (
            <>
              {/* Card A: THB Investment Summary (Total THB Invested has a subtle edit option, rest read-only) */}
              <div className="rounded-2xl border border-line-strong bg-surface-muted p-4 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-brand">THB Investment Summary</p>
                  {!isEditingThb && (
                    <button
                      type="button"
                      onClick={() => setIsEditingThb(true)}
                      aria-label="Edit THB cost basis manually"
                      className="inline-flex items-center gap-1 rounded-md bg-brand/15 px-2 py-0.5 text-[11px] font-bold text-brand hover:bg-brand/25 active:scale-95 transition-all cursor-pointer uppercase tracking-wider"
                    >
                      <PencilIcon className="h-3 w-3" />
                      EDIT THB
                    </button>
                  )}
                </div>
                
                {isEditingThb ? (
                  <div className="space-y-3 pt-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-ink-muted">Manually Adjust THB Cost</span>
                      <button
                        type="button"
                        onClick={() => setIsEditingThb(false)}
                        aria-label="Keep manually adjusted THB value"
                        className="text-[11px] font-bold text-brand hover:underline cursor-pointer uppercase tracking-wider"
                      >
                        Keep Value
                      </button>
                    </div>
                    <NumberField
                      label=""
                      prefix="฿"
                      value={thbInvestedInput}
                      onChange={handleThbInvestedChange}
                      onBlur={handleThbInvestedBlur}
                      error={showErrors && thbInvestedInput === '' ? 'Total THB Invested is required' : undefined}
                      placeholder="0.00"
                      step={0.01}
                      allowString
                    />
                    {isThbInvestedManuallyEdited && (
                      <div className="text-right -mt-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setIsThbInvestedManuallyEdited(false)
                            const shares = Number(form.units) || 0
                            const avgCost = Number(form.avgCost) || 0
                            const fxRate = usdThb || 35
                            const calculatedThb = Number((shares * avgCost * fxRate).toFixed(2))
                            setThbInvestedInput(calculatedThb)
                            setFxRateInput(formatCostOrFx(fxRate))
                          }}
                          aria-label="Reset THB cost basis to calculate from USD shares and cost"
                          className="text-[11px] font-semibold text-brand hover:underline cursor-pointer"
                        >
                          Reset to calculated (฿{Number((sharesInputVal * avgCostUsdVal * (usdThb || 35)).toFixed(2)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} @ {Number((usdThb || 35).toFixed(2))})
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-[13px] pt-1">
                    <span className="text-ink-soft">Total THB Invested</span>
                    <span className="font-bold tnum text-[14px] text-ink">
                      ฿{totalThbInvestedVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-ink-soft">Current Market Value (THB)</span>
                  <span className="font-bold tnum text-ink">
                    ฿{currentMarketValueThb.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-ink-soft">Net Profit / Loss (THB)</span>
                  <span className={`font-bold tnum ${netPnlThb >= 0 ? 'text-gain' : 'text-loss'}`}>
                    {formattedNetPnlThb}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-ink-soft">Net Return (%)</span>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${netPnlThb >= 0 ? 'bg-gain-soft text-gain' : 'bg-loss-soft text-loss'}`}>
                    {netPnlThb >= 0 ? '+' : ''}{netReturnPct.toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* Card B: USD Position Details (USD Focus - Editable) */}
              <div className="rounded-2xl border border-line p-4 space-y-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-brand">USD Position Details</p>
                
                <NumberField
                  label="Total Shares Held"
                  value={form.units}
                  suffix="shares"
                  error={showErrors && form.units === '' ? 'Shares held is required' : undefined}
                  onChange={handleSharesChange}
                  onBlur={handleSharesBlur}
                  placeholder="0"
                  step={0.0001}
                  allowString
                />

                <NumberField
                  label="Average Cost per Share (USD)"
                  prefix="$"
                  value={form.avgCost}
                  error={showErrors && form.avgCost === '' ? 'Average cost is required' : undefined}
                  onChange={handleAvgCostChange}
                  onBlur={handleAvgCostBlur}
                  placeholder="0"
                  step={0.01}
                  allowString
                />

                {editing ? (
                  <div>
                    <p className="mb-1.5 text-[13px] font-medium text-ink-muted">Live Market Price per Share (USD)</p>
                    <div className="flex h-10 items-center gap-2 rounded-xl bg-surface-muted px-3">
                      <span className="text-[13px] font-semibold tnum text-ink">
                        ${livePriceUsd.toFixed(2)}
                      </span>
                      <span className="ml-auto rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-bold text-brand">Live</span>
                    </div>
                  </div>
                ) : (
                  <NumberField
                    label="Live Market Price per Share (USD)"
                    prefix="$"
                    value={form.price}
                    error={showErrors && form.price === '' ? 'Price is required' : undefined}
                    onChange={(price) => setForm((f) => ({ ...f, price }))}
                    placeholder="0"
                    step={0.01}
                  />
                )}

                <NumberField
                  label="Applied FX Rate (USD/THB)"
                  value={fxRateInput}
                  error={showErrors && fxRateInput === '' ? 'FX rate is required' : undefined}
                  onChange={handleFxRateChange}
                  onBlur={handleFxRateBlur}
                  placeholder="e.g. 35.20"
                  step={0.0001}
                  allowString
                />
              </div>

              <FormActions
                editing={!!editing}
                canSave={true}
                onSave={save}
                onDelete={
                  editing
                    ? () => { removeHolding(editing.id); onClose() }
                    : undefined
                }
              />
            </>
          ) : (
            <>
              <NumberField
                label="Units held"
                value={form.units}
                error={showErrors && form.units === '' ? 'Units are required' : undefined}
                onChange={(units) => setForm((f) => ({ ...f, units }))}
                placeholder="0"
                step={0.0001}
              />
              <div className="grid grid-cols-1 gap-3 ">
                <NumberField
                  label="Avg cost / unit"
                  prefix="฿"
                  value={form.avgCost}
                  error={showErrors && form.avgCost === '' ? 'Cost is required' : undefined}
                  onChange={(avgCost) => setForm((f) => ({ ...f, avgCost }))}
                  placeholder="0"
                />
                <NumberField
                  label="Current price / unit"
                  prefix="฿"
                  value={form.price}
                  error={showErrors && form.price === '' ? 'Price is required' : undefined}
                  onChange={(price) => setForm((f) => ({ ...f, price }))}
                  placeholder="0"
                />
              </div>
              <FormActions
                editing={!!editing}
                canSave={true}
                onSave={save}
                onDelete={
                  editing
                    ? () => { removeHolding(editing.id); onClose() }
                    : undefined
                }
              />
            </>
          )
        )}
      </div>
    </Modal>
  )
}


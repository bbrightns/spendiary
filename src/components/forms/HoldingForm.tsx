import { useEffect, useRef, useState } from 'react'
import { Modal } from '../ui/Modal'
import { NumberField, SelectField, TextField } from '../ui/Field'
import { FormActions } from './FormActions'
import { Button } from '../ui/Button'
import { useData } from '../../store/DataContext'
import { ASSET_META } from '../../lib/calc'
import type { AssetClass, Holding } from '../../lib/types'
import { localDateStr, thb } from '../../lib/format'
import { searchSecurities, type Security } from '../../lib/securities'

interface Props {
  open: boolean
  editing: Holding | null
  onClose: () => void
}

const SATS_PER_BTC = 100_000_000

const newId = () => crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const blank = {
  name: '',
  ticker: '',
  assetClass: 'fund' as AssetClass,
  units: '' as number | '',
  avgCost: '' as number | '',
  price: '' as number | '',
}

export function HoldingForm({ open, editing, onClose }: Props) {
  const { upsertHolding, removeHolding, addHoldingLog, usdThb } = useData()

  // Generic fields
  const [form, setForm] = useState(blank)
  const [showErrors, setShowErrors] = useState(false)

  // Autocomplete (fund/stock only)
  const [suggestions, setSuggestions] = useState<Security[]>([])

  // BTC new-holding fields
  const [satoshi, setSatoshi] = useState<number | ''>('')
  const [btcThbSpent, setBtcThbSpent] = useState<number | ''>('')
  const [locationName, setLocationName] = useState('')

  // Gold new-holding fields
  const [grams, setGrams] = useState<number | ''>('')
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
    if (!justOpened) return
    if (editing) {
      // Only stocks are USD-denominated — BTC and Gold are priced in THB directly
      const divisor = editing.assetClass === 'stock' && rate > 1 ? rate : 1
      setForm({
        name: editing.name,
        ticker: editing.ticker,
        assetClass: editing.assetClass,
        units: editing.units,
        avgCost: divisor > 1 ? parseFloat((editing.avgCost / divisor).toFixed(4)) : editing.avgCost,
        price: divisor > 1 ? parseFloat((editing.price / divisor).toFixed(4)) : editing.price,
      })
    } else {
      setForm(blank)
      setSatoshi('')
      setBtcThbSpent('')
      setLocationName('')
      setGrams('')
      setGoldThbSpent('')
      setGoldLocationName('')
    }
    setShowErrors(false)
  }, [open, editing])

  // ── Save: BTC new holding ──
  function saveBtc() {
    const sats = Number(satoshi)
    const spent = Number(btcThbSpent)
    const locName = locationName.trim()
    if (sats <= 0 || spent <= 0 || !locName) { setShowErrors(true); return }

    const btcUnits = sats / SATS_PER_BTC
    const avgCostThb = spent / btcUnits
    upsertHolding({
      name: 'Bitcoin',
      ticker: 'BTC',
      assetClass: 'crypto',
      units: btcUnits,
      avgCost: avgCostThb,
      price: editing?.price ?? avgCostThb,
      updatedAt: localDateStr(),
    })
    addHoldingLog({
      action: 'add',
      holdingName: 'Bitcoin',
      ticker: 'BTC',
      assetClass: 'crypto',
      note: `${sats.toLocaleString()} sats · ฿${spent.toLocaleString()} spent · ${locationName.trim()}`,
    })
    onClose()
  }

  // ── Save: Gold new holding ──
  function saveGold() {
    const g = Number(grams)
    const spent = Number(goldThbSpent)
    const locName = goldLocationName.trim()
    if (g <= 0 || spent <= 0 || !locName) { setShowErrors(true); return }

    const avgCostThb = spent / g
    upsertHolding({
      name: 'Gold',
      ticker: 'XAU',
      assetClass: 'gold',
      units: g,
      avgCost: avgCostThb,
      price: avgCostThb,
      goldLocations: [{ id: newId(), name: locName, grams: g, thbSpent: spent }],
      updatedAt: localDateStr(),
    })
    addHoldingLog({
      action: 'add',
      holdingName: 'Gold',
      ticker: 'XAU',
      assetClass: 'gold',
      note: `${g.toFixed(4)} g · ฿${spent.toLocaleString()} spent · ${goldLocationName.trim()}`,
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
    const multiplier = isUsd && rate > 1 ? rate : 1
    const name = form.name.trim()
    const ticker = form.ticker.trim() || name.slice(0, 4).toUpperCase()
    upsertHolding({
      id: editing?.id,
      name,
      ticker,
      assetClass: form.assetClass,
      units: Number(form.units),
      avgCost: Number(form.avgCost) * multiplier,
      price: useLivePrice ? livePrice! : Number(form.price) * multiplier,
      updatedAt: localDateStr(),
    })
    addHoldingLog({
      action: editing ? 'edit' : 'add',
      holdingName: name,
      ticker,
      assetClass: form.assetClass,
      note: editing
        ? `${Number(form.units).toLocaleString(undefined, { maximumFractionDigits: 4 })} units · avg cost ฿${(Number(form.avgCost) * multiplier).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
        : `${Number(form.units).toLocaleString(undefined, { maximumFractionDigits: 4 })} units @ ฿${(Number(form.avgCost) * multiplier).toLocaleString(undefined, { maximumFractionDigits: 2 })}/unit`,
    })
    onClose()
  }

  // Derived previews
  const sats = Number(satoshi)
  const btcSpent = Number(btcThbSpent)
  const btcAmount = sats > 0 ? sats / SATS_PER_BTC : 0
  const btcImpliedPrice = btcAmount > 0 && btcSpent > 0 ? btcSpent / btcAmount : 0

  const goldGrams = Number(grams)
  const goldSpent = Number(goldThbSpent)
  const goldImpliedPrice = goldGrams > 0 && goldSpent > 0 ? goldSpent / goldGrams : 0

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
                  <span className="font-semibold tnum text-ink">{btcAmount.toFixed(8)} BTC</span>
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
            <NumberField
              label="BTC held (decimal)"
              value={form.units}
              error={showErrors && form.units === '' ? 'Units are required' : undefined}
              onChange={(units) => setForm((f) => ({ ...f, units }))}
              placeholder="0"
              step={0.00000001}
            />
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
            <div className="grid grid-cols-1 gap-3 ">
              <NumberField
                label="Grams bought"
                value={grams}
                error={showErrors && (grams === '' || Number(grams) <= 0) ? 'Required (> 0)' : undefined}
                onChange={setGrams}
                placeholder="e.g. 15.2"
                step={0.01}
              />
              <NumberField
                label="THB spent"
                prefix="฿"
                value={goldThbSpent}
                error={showErrors && (goldThbSpent === '' || Number(goldThbSpent) <= 0) ? 'Required (> 0)' : undefined}
                onChange={setGoldThbSpent}
                placeholder="0"
              />
            </div>
            {goldGrams > 0 && goldSpent > 0 && (
              <div
                className="rounded-2xl border px-4 py-3"
                style={{
                  borderColor: `color-mix(in srgb, ${ASSET_META.gold.color} 35%, transparent)`,
                  background: `color-mix(in srgb, ${ASSET_META.gold.color} 10%, transparent)`,
                }}
              >
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-ink-soft">Implied price / gram</span>
                  <span className="font-semibold tnum text-ink">{thb(goldImpliedPrice)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[13px]">
                  <span className="text-ink-soft">Total weight</span>
                  <span className="font-semibold tnum text-ink">{goldGrams.toFixed(2)} g</span>
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
            <NumberField
              label="Weight held (grams)"
              value={form.units}
              error={showErrors && form.units === '' ? 'Weight is required' : undefined}
              onChange={(units) => setForm((f) => ({ ...f, units }))}
              placeholder="0"
              step={0.01}
            />
            <div className="grid grid-cols-1 gap-3 ">
              <NumberField
                label="Avg cost / gram"
                prefix="฿"
                value={form.avgCost}
                error={showErrors && form.avgCost === '' ? 'Cost is required' : undefined}
                onChange={(avgCost) => setForm((f) => ({ ...f, avgCost }))}
                placeholder="0"
              />
              <NumberField
                label="Current price / gram"
                prefix="฿"
                value={form.price}
                error={showErrors && form.price === '' ? 'Price is required' : undefined}
                onChange={(price) => setForm((f) => ({ ...f, price }))}
                placeholder="0"
              />
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
          <>
            {isUsd && !usdThb && (
              <div className="rounded-xl bg-warn-soft px-4 py-3 text-[13px] font-medium text-warn">
                USD/THB rate is loading. Please wait before saving to avoid wrong values.
              </div>
            )}
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
                prefix={isUsd ? '$' : '฿'}
                value={form.avgCost}
                error={showErrors && form.avgCost === '' ? 'Cost is required' : undefined}
                onChange={(avgCost) => setForm((f) => ({ ...f, avgCost }))}
                placeholder="0"
              />
              {isUsd && editing ? (
                <div>
                  <p className="mb-1.5 text-[13px] font-medium text-ink-muted">Current price / unit</p>
                  <div className="flex h-10 items-center gap-2 rounded-xl bg-surface-muted px-3">
                    <span className="text-[13px] font-semibold tnum text-ink">
                      ${(editing.price / rate).toFixed(2)}
                    </span>
                    <span className="ml-auto rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">Live</span>
                  </div>
                </div>
              ) : (
                <NumberField
                  label="Current price / unit"
                  prefix="฿"
                  value={form.price}
                  error={showErrors && form.price === '' ? 'Price is required' : undefined}
                  onChange={(price) => setForm((f) => ({ ...f, price }))}
                  placeholder="0"
                />
              )}
            </div>
            {isUsd && usdThb && form.avgCost !== '' && Number(form.avgCost) > 0 && (
              <p className="text-[12px] text-ink-muted">
                Avg cost in THB: ฿{(Number(form.avgCost) * usdThb).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                {form.price !== '' && Number(form.price) > 0 && (
                  <> · Price in THB: ฿{(Number(form.price) * usdThb).toLocaleString(undefined, { maximumFractionDigits: 0 })}</>
                )}
              </p>
            )}
            <FormActions
              editing={!!editing}
              canSave={!isUsd || !!usdThb}
              onSave={save}
              onDelete={
                editing
                  ? () => { removeHolding(editing.id); onClose() }
                  : undefined
              }
            />
          </>
        )}
      </div>
    </Modal>
  )
}


import { useEffect, useRef, useState } from 'react'
import { Modal } from '../ui/Modal'
import { NumberField, TextField, SelectField } from '../ui/Field'
import { Button } from '../ui/Button'
import { useData } from '../../store/DataContext'
import { ASSET_META, applyBuy, holdingMetrics } from '../../lib/calc'
import type { Holding } from '../../lib/types'
import { thb } from '../../lib/format'

interface Props {
  open: boolean
  holding: Holding | null
  onClose: () => void
}

const SATS_PER_BTC = 100_000_000

export function BuyMoreForm({ open, holding, onClose }: Props) {
  const { upsertHolding, upsertBtcLocation, upsertGoldLocation, addHoldingLog, usdThb } = useData()

  // Shared state
  const [units, setUnits] = useState<number | ''>('')
  const [price, setPrice] = useState<number | ''>('')
  const [showErrors, setShowErrors] = useState(false)

  // BTC-specific state
  const [satoshi, setSatoshi] = useState<number | ''>('')
  const [thbSpent, setThbSpent] = useState<number | ''>('')
  const [locationId, setLocationId] = useState('')
  const [newLocationName, setNewLocationName] = useState('')

  // Gold-specific state
  const [goldGrams, setGoldGrams] = useState<number | ''>('')
  const [goldThbSpent, setGoldThbSpent] = useState<number | ''>('')
  const [goldLocationId, setGoldLocationId] = useState('')
  const [goldNewLocationName, setGoldNewLocationName] = useState('')

  const isBtc = holding?.assetClass === 'crypto'
  const isGold = holding?.assetClass === 'gold'
  const isStock = holding?.assetClass === 'stock'
  const rate = usdThb && usdThb > 1 ? usdThb : 1
  const existingLocations = holding?.btcLocations ?? []

  // Guard: only reset form when modal *freshly opens* (false→true),
  // not when holding changes mid-session due to live price ticks.
  const wasOpen = useRef(false)

  // ALL useEffects at top level — no hooks after conditional returns
  useEffect(() => {
    const justOpened = !wasOpen.current && open
    wasOpen.current = open
    if (!justOpened || !holding) return
    setUnits('')
    setShowErrors(false)
    setSatoshi('')
    setThbSpent('')
    setLocationId((holding.btcLocations ?? [])[0]?.id ?? '__new__')
    setNewLocationName('')
    setGoldGrams('')
    setGoldThbSpent('')
    setGoldLocationId((holding.goldLocations ?? [])[0]?.id ?? '__new__')
    setGoldNewLocationName('')
    // Pre-fill price: USD for stocks, THB for funds, not used for BTC
    if (!isBtc) {
      if (isStock && rate > 1) {
        setPrice(parseFloat((holding.price / rate).toFixed(4)))
      } else {
        setPrice(holding.price)
      }
    }
  }, [open, holding])

  if (!holding) return null

  // ── Gold path ──
  if (isGold) {
    const goldExistingLocations = holding.goldLocations ?? []
    const isNewGoldLoc = goldLocationId === '__new__'
    const goldLocName = isNewGoldLoc
      ? goldNewLocationName.trim()
      : (goldExistingLocations.find((l) => l.id === goldLocationId)?.name ?? '')
    const goldValid =
      goldGrams !== '' && Number(goldGrams) > 0 &&
      goldThbSpent !== '' && Number(goldThbSpent) > 0 &&
      goldLocName.length > 0
    const g = Number(goldGrams)
    const spent = Number(goldThbSpent)
    const impliedPrice = g > 0 ? spent / g : 0
    const totalGrams = goldExistingLocations.reduce((s, l) => s + l.grams, 0)

    const goldLocOptions = [
      ...goldExistingLocations.map((l) => ({ value: l.id, label: l.name })),
      { value: '__new__', label: '+ New location…' },
    ]

    function saveGold() {
      if (!goldValid) { setShowErrors(true); return }
      const existingLoc = isNewGoldLoc ? null : goldExistingLocations.find((l) => l.id === goldLocationId)
      if (existingLoc) {
        upsertGoldLocation(holding!.id, {
          id: existingLoc.id,
          name: existingLoc.name,
          grams: existingLoc.grams + g,
          thbSpent: existingLoc.thbSpent + spent,
        })
      } else {
        upsertGoldLocation(holding!.id, { name: goldLocName, grams: g, thbSpent: spent })
      }
      addHoldingLog({
        action: 'buy_more',
        holdingName: holding!.name,
        ticker: holding!.ticker,
        assetClass: 'gold',
        note: `+${g.toFixed(2)} g · ฿${spent.toLocaleString()} spent · ${goldLocName}`,
      })
      onClose()
    }

    return (
      <Modal
        open={open}
        onClose={onClose}
        title={`Buy more · ${holding.name}`}
        description="Log a purchase in grams. Choose or create a location."
      >
        <div className="space-y-5">
          <div className="rounded-2xl bg-surface-muted px-4 py-3">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-ink-muted">Currently holding</span>
              <span className="font-semibold tnum text-ink">
                {totalGrams.toFixed(2)} g
              </span>
            </div>
          </div>

          <SelectField
            label="Location"
            value={goldLocationId}
            onChange={setGoldLocationId}
            options={goldLocOptions}
          />

          {goldLocationId === '__new__' && (
            <TextField
              label="Location name"
              value={goldNewLocationName}
              onChange={setGoldNewLocationName}
              placeholder="e.g. Home safe, Bank vault, Hua Seng Heng"
              error={showErrors && !goldNewLocationName.trim() ? 'Required' : undefined}
            />
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <NumberField
              label="Grams bought"
              value={goldGrams}
              error={showErrors && (goldGrams === '' || Number(goldGrams) <= 0) ? 'Required (> 0)' : undefined}
              onChange={setGoldGrams}
              placeholder="e.g. 5.0"
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

          {g > 0 && spent > 0 && (
            <div
              className="rounded-2xl border px-4 py-3"
              style={{
                borderColor: `color-mix(in srgb, ${ASSET_META[holding.assetClass].color} 35%, transparent)`,
                background: `color-mix(in srgb, ${ASSET_META[holding.assetClass].color} 7%, white)`,
              }}
            >
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-ink-soft">Implied price / gram</span>
                <span className="font-semibold tnum text-ink">{thb(impliedPrice)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[13px]">
                <span className="text-ink-soft">Gold amount</span>
                <span className="font-semibold tnum text-ink">{g.toFixed(2)} g</span>
              </div>
            </div>
          )}

          <div className="pt-3">
            <Button onClick={saveGold} className="w-full">Add to holding</Button>
          </div>
        </div>
      </Modal>
    )
  }

  // ── BTC path ──
  if (isBtc) {
    const isNew = locationId === '__new__'
    const locName = isNew
      ? newLocationName.trim()
      : (existingLocations.find((l) => l.id === locationId)?.name ?? '')
    const btcValid =
      satoshi !== '' && Number(satoshi) > 0 &&
      thbSpent !== '' && Number(thbSpent) > 0 &&
      locName.length > 0
    const sats = Number(satoshi)
    const spent = Number(thbSpent)
    const btcAmount = sats / SATS_PER_BTC
    const impliedPrice = btcAmount > 0 ? spent / btcAmount : 0
    const totalSats = existingLocations.reduce((s, l) => s + l.satoshi, 0)

    const locationOptions = [
      ...existingLocations.map((l) => ({ value: l.id, label: l.name })),
      { value: '__new__', label: '+ New location…' },
    ]

    function saveBtc() {
      if (!btcValid) { setShowErrors(true); return }
      const existingLoc = isNew ? null : existingLocations.find((l) => l.id === locationId)
      if (existingLoc) {
        upsertBtcLocation(holding!.id, {
          id: existingLoc.id,
          name: existingLoc.name,
          satoshi: existingLoc.satoshi + sats,
          thbSpent: existingLoc.thbSpent + spent,
        })
      } else {
        upsertBtcLocation(holding!.id, { name: locName, satoshi: sats, thbSpent: spent })
      }
      addHoldingLog({
        action: 'buy_more',
        holdingName: holding!.name,
        ticker: holding!.ticker,
        assetClass: 'crypto',
        note: `+${sats.toLocaleString()} sats · ฿${spent.toLocaleString()} spent · ${locName}`,
      })
      onClose()
    }

    return (
      <Modal
        open={open}
        onClose={onClose}
        title={`Buy more · ${holding.name}`}
        description="Log a purchase in Satoshi. Choose or create a location."
      >
        <div className="space-y-5">
          <div className="rounded-2xl bg-surface-muted px-4 py-3">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-ink-muted">Currently holding</span>
              <span className="font-semibold tnum text-ink">
                {totalSats.toLocaleString()} sats ({(totalSats / SATS_PER_BTC).toFixed(8)} BTC)
              </span>
            </div>
          </div>

          <SelectField
            label="Location"
            value={locationId}
            onChange={setLocationId}
            options={locationOptions}
          />

          {locationId === '__new__' && (
            <TextField
              label="Location name"
              value={newLocationName}
              onChange={setNewLocationName}
              placeholder="e.g. Ledger, Binance, Coinbase"
              error={showErrors && !newLocationName.trim() ? 'Required' : undefined}
            />
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              value={thbSpent}
              error={showErrors && (thbSpent === '' || Number(thbSpent) <= 0) ? 'Required (> 0)' : undefined}
              onChange={setThbSpent}
              placeholder="0"
            />
          </div>

          {satoshi !== '' && Number(satoshi) > 0 && thbSpent !== '' && Number(thbSpent) > 0 && (
            <div
              className="rounded-2xl border px-4 py-3"
              style={{
                borderColor: `color-mix(in srgb, ${ASSET_META[holding.assetClass].color} 35%, transparent)`,
                background: `color-mix(in srgb, ${ASSET_META[holding.assetClass].color} 7%, white)`,
              }}
            >
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-ink-soft">Implied price / BTC</span>
                <span className="font-semibold tnum text-ink">{thb(impliedPrice)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[13px]">
                <span className="text-ink-soft">BTC amount</span>
                <span className="font-semibold tnum text-ink">{btcAmount.toFixed(8)} BTC</span>
              </div>
            </div>
          )}

          <div className="pt-3">
            <Button onClick={saveBtc} className="w-full">Add to holding</Button>
          </div>
        </div>
      </Modal>
    )
  }

  // ── Fund / Stock path ──
  const priceInThb = isStock && rate > 1 ? Number(price) * rate : Number(price)
  const valid = units !== '' && Number(units) > 0 && price !== '' && Number(price) > 0
  const preview = valid ? applyBuy(holding, Number(units), priceInThb) : null
  const cost = valid ? Number(units) * priceInThb : 0
  const label = holding.assetClass === 'fund' ? 'units' : 'shares'

  function save() {
    if (!valid) { setShowErrors(true); return }
    const next = applyBuy(holding!, Number(units), priceInThb)
    upsertHolding({ ...holding!, ...next })
    addHoldingLog({
      action: 'buy_more',
      holdingName: holding!.name,
      ticker: holding!.ticker,
      assetClass: holding!.assetClass,
      note: `+${Number(units).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${label} @ ${isStock ? `$${Number(price).toFixed(2)}` : `฿${Number(price).toLocaleString()}`}/unit`,
    })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Buy more · ${holding.name}`}
      description={
        isStock
          ? `Price in USD — converted at ฿${rate.toFixed(2)}/USD.`
          : 'Log a purchase. Units grow and your average cost is recalculated.'
      }
    >
      <div className="space-y-5">
        <div className="rounded-2xl bg-surface-muted px-4 py-3">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-ink-muted">Currently holding</span>
            <span className="font-semibold tnum text-ink">
              {holding.units.toLocaleString(undefined, { maximumFractionDigits: 4 })} {label}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[13px]">
            <span className="text-ink-muted">Avg cost</span>
            <span className="font-semibold tnum text-ink">
              {isStock && rate > 1
                ? `$${(holding.avgCost / rate).toFixed(2)}`
                : thb(holding.avgCost, true)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <NumberField
            label={`${label} bought`}
            value={units}
            error={showErrors && (units === '' || Number(units) <= 0) ? 'Required (> 0)' : undefined}
            onChange={setUnits}
            placeholder="0"
            step={0.0001}
          />
          <NumberField
            label={isStock ? 'Price / unit (USD)' : 'Price / unit'}
            prefix={isStock ? '$' : '฿'}
            value={price}
            error={showErrors && (price === '' || Number(price) <= 0) ? 'Required (> 0)' : undefined}
            onChange={setPrice}
            placeholder="0"
          />
        </div>

        {preview && (
          <div
            className="rounded-2xl border px-4 py-3"
            style={{
              borderColor: `color-mix(in srgb, ${ASSET_META[holding.assetClass].color} 35%, transparent)`,
              background: `color-mix(in srgb, ${ASSET_META[holding.assetClass].color} 7%, white)`,
            }}
          >
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-ink-soft">Cost of this buy</span>
              <span className="font-semibold tnum text-ink">{thb(cost)}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[14px]">
              <span className="font-semibold text-ink">New total</span>
              <span className="font-bold tnum text-ink">
                {preview.units.toLocaleString(undefined, { maximumFractionDigits: 4 })} {label}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[12.5px]">
              <span className="text-ink-muted">New avg cost · value</span>
              <span className="tnum text-ink-soft">
                {isStock && rate > 1
                  ? `$${(preview.avgCost / rate).toFixed(2)}`
                  : thb(preview.avgCost, true)}{' '}
                · {thb(holdingMetrics({ ...holding, ...preview }).marketValue)}
              </span>
            </div>
          </div>
        )}

        <div className="pt-3">
          <Button onClick={save} className="w-full">Add to holding</Button>
        </div>
      </div>
    </Modal>
  )
}

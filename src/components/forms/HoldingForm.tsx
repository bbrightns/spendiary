import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { NumberField, SelectField, TextField } from '../ui/Field'
import { FormActions } from './FormActions'
import { Button } from '../ui/Button'
import { useData } from '../../store/DataContext'
import { ASSET_META } from '../../lib/calc'
import type { AssetClass, Holding } from '../../lib/types'
import { thb } from '../../lib/format'

interface Props {
  open: boolean
  editing: Holding | null
  onClose: () => void
}

const SATS_PER_BTC = 100_000_000

const blank = {
  name: '',
  ticker: '',
  assetClass: 'fund' as AssetClass,
  units: '' as number | '',
  avgCost: '' as number | '',
  price: '' as number | '',
}

export function HoldingForm({ open, editing, onClose }: Props) {
  const { upsertHolding, removeHolding, usdThb } = useData()

  // Generic fields
  const [form, setForm] = useState(blank)
  const [showErrors, setShowErrors] = useState(false)

  // BTC-specific fields (new holding path)
  const [satoshi, setSatoshi] = useState<number | ''>('')
  const [thbSpent, setThbSpent] = useState<number | ''>('')
  const [locationName, setLocationName] = useState('')

  const isBtc = form.assetClass === 'crypto'
  const isUsd = form.assetClass === 'stock'
  const rate = usdThb ?? 1

  useEffect(() => {
    if (!open) return
    if (editing) {
      const divisor = (editing.assetClass === 'stock' || editing.assetClass === 'crypto') ? rate : 1
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
      setThbSpent('')
      setLocationName('')
    }
    setShowErrors(false)
  }, [open, editing])

  // ── Save: BTC (new holding) ──
  function saveBtc() {
    const sats = Number(satoshi)
    const spent = Number(thbSpent)
    const locName = locationName.trim()
    const btcValid =
      form.name.trim() !== '' &&
      sats > 0 && spent > 0 && locName.length > 0
    if (!btcValid) { setShowErrors(true); return }

    const btcUnits = sats / SATS_PER_BTC
    const avgCostThb = spent / btcUnits
    upsertHolding({
      name: form.name.trim(),
      ticker: form.ticker.trim() || 'BTC',
      assetClass: 'crypto',
      units: btcUnits,
      avgCost: avgCostThb,
      price: editing?.price ?? avgCostThb, // fallback to cost as current price
      updatedAt: new Date().toISOString().slice(0, 10),
    })
    // We can't attach btcLocation here since we don't have the id yet — the
    // holding itself carries units/avgCost derived from the location data.
    onClose()
  }

  // ── Save: Fund / Stock ──
  function save() {
    const valid =
      form.name.trim() !== '' && form.units !== '' && form.avgCost !== '' && form.price !== ''
    if (!valid) { setShowErrors(true); return }
    const multiplier = isUsd && rate > 1 ? rate : 1
    upsertHolding({
      id: editing?.id,
      name: form.name.trim(),
      ticker: form.ticker.trim() || form.name.trim().slice(0, 4).toUpperCase(),
      assetClass: form.assetClass,
      units: Number(form.units),
      avgCost: Number(form.avgCost) * multiplier,
      price: Number(form.price) * multiplier,
      updatedAt: new Date().toISOString().slice(0, 10),
    })
    onClose()
  }

  // Derived for BTC preview
  const sats = Number(satoshi)
  const spent = Number(thbSpent)
  const btcAmount = sats > 0 ? sats / SATS_PER_BTC : 0
  const impliedPrice = btcAmount > 0 && spent > 0 ? spent / btcAmount : 0

  const modalDescription = isBtc
    ? 'Log your first purchase in Satoshi.'
    : isUsd
    ? `Prices in USD — converted to THB at ${usdThb ? `฿${usdThb.toFixed(2)}/USD` : 'live rate'}.`
    : 'Mutual fund — valued in THB.'

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
          onChange={(v) => setForm((f) => ({ ...f, assetClass: v as AssetClass }))}
          options={[
            { value: 'fund', label: 'Mutual Fund' },
            { value: 'stock', label: 'US Stock' },
            { value: 'crypto', label: 'Bitcoin' },
          ]}
        />

        {/* Name + Ticker */}
        <TextField
          label="Name"
          value={form.name}
          error={showErrors && form.name.trim() === '' ? 'Name is required' : undefined}
          onChange={(name) => setForm((f) => ({ ...f, name }))}
          placeholder={isBtc ? 'e.g. My Bitcoin' : isUsd ? 'e.g. Apple Inc.' : 'e.g. Kasikorn Fund'}
        />
        <TextField
          label="Ticker"
          hint="optional"
          value={form.ticker}
          onChange={(ticker) => setForm((f) => ({ ...f, ticker }))}
          placeholder={isBtc ? 'BTC' : isUsd ? 'AAPL' : 'e.g. KF-CASH'}
        />

        {/* ── BTC path (new holding) ── */}
        {isBtc && !editing && (
          <>
            <TextField
              label="Location"
              value={locationName}
              onChange={setLocationName}
              placeholder="e.g. Ledger, Binance, Trezor"
              error={showErrors && !locationName.trim() ? 'Location is required' : undefined}
            />
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

            {sats > 0 && spent > 0 && (
              <div
                className="rounded-2xl border px-4 py-3"
                style={{
                  borderColor: `color-mix(in srgb, ${ASSET_META.crypto.color} 35%, transparent)`,
                  background: `color-mix(in srgb, ${ASSET_META.crypto.color} 7%, white)`,
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
              <Button onClick={saveBtc} className="w-full">Add holding</Button>
            </div>
          </>
        )}

        {/* ── BTC edit path — keep simple numeric fields ── */}
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <NumberField
                label="Avg cost / BTC"
                prefix="฿"
                value={form.avgCost}
                error={showErrors && form.avgCost === '' ? 'Cost is required' : undefined}
                onChange={(avgCost) => setForm((f) => ({ ...f, avgCost }))}
                placeholder="0"
              />
              <NumberField
                label="Current price / BTC"
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
              onDelete={() => { removeHolding(editing.id); onClose() }}
            />
          </>
        )}

        {/* ── Fund / Stock path ── */}
        {!isBtc && (
          <>
            <NumberField
              label="Units held"
              value={form.units}
              error={showErrors && form.units === '' ? 'Units are required' : undefined}
              onChange={(units) => setForm((f) => ({ ...f, units }))}
              placeholder="0"
              step={0.0001}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <NumberField
                label="Avg cost / unit"
                prefix={isUsd ? '$' : '฿'}
                value={form.avgCost}
                error={showErrors && form.avgCost === '' ? 'Cost is required' : undefined}
                onChange={(avgCost) => setForm((f) => ({ ...f, avgCost }))}
                placeholder="0"
              />
              <NumberField
                label="Current price / unit"
                prefix={isUsd ? '$' : '฿'}
                value={form.price}
                error={showErrors && form.price === '' ? 'Price is required' : undefined}
                onChange={(price) => setForm((f) => ({ ...f, price }))}
                placeholder="0"
              />
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
              canSave={true}
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

import { useEffect, useRef, useState } from 'react'
import { Modal } from '../ui/Modal'
import { NumberField } from '../ui/Field'
import { Button } from '../ui/Button'
import { useData } from '../../store/DataContext'
import { ASSET_META } from '../../lib/calc'
import type { DcaPlan } from '../../lib/types'
import { localDateStr, thb } from '../../lib/format'

interface Props {
  open: boolean
  plan: DcaPlan | null
  onClose: () => void
}

export function ConfirmDcaBuyForm({ open, plan, onClose }: Props) {
  const { data, confirmDcaBuy, upsertBtcLocation, usdThb } = useData()
  const [price, setPrice] = useState<number | ''>('')
  const [showErrors, setShowErrors] = useState(false)
  const [selectedLocId, setSelectedLocId] = useState<string>('')
  const [newLocName, setNewLocName] = useState('')
  const wasOpen = useRef(false)

  const holding = plan?.holdingId
    ? data.holdings.find((h) => h.id === plan.holdingId) ?? null
    : null

  const isStock = holding?.assetClass === 'stock'
  const isBtc   = holding?.assetClass === 'crypto'
  const isGold  = holding?.assetClass === 'gold'
  const rate = usdThb ?? 1
  const btcLocations = holding?.btcLocations ?? []

  useEffect(() => {
    const justOpened = !wasOpen.current && open
    wasOpen.current = open
    if (!justOpened || !plan) return
    setShowErrors(false)
    // Pre-select location from plan preference, else first location, else new
    const preferredId = plan.btcLocationId && btcLocations.some((l) => l.id === plan.btcLocationId)
      ? plan.btcLocationId
      : btcLocations.length > 0 ? btcLocations[0].id : '__new__'
    setSelectedLocId(preferredId)
    setNewLocName('')

    // Pre-fill live price where available
    if (holding) {
      if (isStock && rate > 1) {
        setPrice(parseFloat((holding.price / rate).toFixed(2)))
      } else if (isBtc || isGold) {
        setPrice(holding.price)
      } else {
        setPrice('')   // mutual fund — user enters NAV
      }
    } else {
      setPrice('')
    }
  }, [open, plan])

  if (!plan) return null

  const priceNum = Number(price)
  const priceInThb = isStock && rate > 1 ? priceNum * rate : priceNum
  const units = priceInThb > 0 ? plan.monthlyAmount / priceInThb : 0
  const sats = Math.round(units * 1e8)
  const hasHolding = !!holding
  const valid = priceNum > 0

  // BTC location validation
  const btcLocValid = !isBtc || !hasHolding ||
    (selectedLocId !== '__new__') ||
    (newLocName.trim().length > 0)

  const priceLabel = isStock
    ? `Current price / unit (USD)`
    : isBtc ? 'Current price / BTC (฿)'
    : isGold ? 'Current price / gram (฿)'
    : 'NAV / unit (฿)'

  const pricePrefix = isStock ? '$' : '฿'
  const meta = ASSET_META[plan.assetClass]

  function confirm() {
    if (!valid || !btcLocValid) { setShowErrors(true); return }
    if (!plan) return
    const p = plan
    const today = localDateStr()

    if (isBtc && hasHolding && holding) {
      // For BTC: add sats to the selected/new location, then mark plan confirmed
      if (selectedLocId === '__new__') {
        // Create new location
        upsertBtcLocation(holding.id, {
          name: newLocName.trim(),
          satoshi: sats,
          thbSpent: p.monthlyAmount,
        })
      } else {
        // Add to existing location
        const existing = btcLocations.find((l) => l.id === selectedLocId)
        if (existing) {
          upsertBtcLocation(holding.id, {
            id: existing.id,
            name: existing.name,
            satoshi: existing.satoshi + sats,
            thbSpent: existing.thbSpent + p.monthlyAmount,
          })
        }
      }
      // Mark plan confirmed + log (skip holding unit update — managed by btcLocations)
      confirmDcaBuy(p.id, priceInThb, today)
    } else {
      confirmDcaBuy(p.id, priceInThb, today)
    }

    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Confirm buy"
      description={`Record that you bought ${plan.name} today.`}
    >
      <div className="space-y-5">
        {/* Summary card — fix: use transparent base so dark mode works */}
        <div
          className="rounded-2xl border px-4 py-3"
          style={{
            borderColor: `color-mix(in srgb, ${meta.color} 30%, transparent)`,
            background: `color-mix(in srgb, ${meta.color} 10%, transparent)`,
          }}
        >
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-ink-muted">Plan</span>
            <span className="font-semibold text-ink">{plan.name}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[13px]">
            <span className="text-ink-muted">Amount spent</span>
            <span className="font-semibold tnum text-ink">{thb(plan.monthlyAmount)}</span>
          </div>
          {!hasHolding && (
            <p className="mt-2 text-[12px] text-ink-muted">
              No linked holding — this will only mark the plan as confirmed, not update your portfolio.
              Link a holding by editing this plan.
            </p>
          )}
        </div>

        {/* Price input */}
        <NumberField
          label={priceLabel}
          prefix={pricePrefix}
          value={price}
          onChange={setPrice}
          placeholder="0"
          error={showErrors && !valid ? 'Required (> 0)' : undefined}
        />

        {/* BTC location picker */}
        {isBtc && hasHolding && (
          <div>
            <p className="mb-2 text-[13px] font-semibold text-ink">Where did you buy?</p>
            <div className="space-y-2">
              {btcLocations.map((loc) => (
                <label
                  key={loc.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                    selectedLocId === loc.id
                      ? 'border-brand bg-brand-soft'
                      : 'border-line bg-surface-muted hover:border-ink-faint'
                  }`}
                >
                  <input
                    type="radio"
                    name="btcLoc"
                    value={loc.id}
                    checked={selectedLocId === loc.id}
                    onChange={() => setSelectedLocId(loc.id)}
                    className="accent-brand"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold text-ink">{loc.name}</p>
                    <p className="text-[11.5px] text-ink-muted">
                      {loc.satoshi.toLocaleString()} sats · {thb(loc.thbSpent)} spent
                    </p>
                  </div>
                </label>
              ))}

              {/* New location option */}
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                  selectedLocId === '__new__'
                    ? 'border-brand bg-brand-soft'
                    : 'border-line bg-surface-muted hover:border-ink-faint'
                }`}
              >
                <input
                  type="radio"
                  name="btcLoc"
                  value="__new__"
                  checked={selectedLocId === '__new__'}
                  onChange={() => setSelectedLocId('__new__')}
                  className="accent-brand"
                />
                <span className="text-[13.5px] font-semibold text-ink">New location…</span>
              </label>

              {selectedLocId === '__new__' && (
                <input
                  type="text"
                  value={newLocName}
                  onChange={(e) => setNewLocName(e.target.value)}
                  placeholder="e.g. Binance, Trezor…"
                  autoFocus
                  className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-[13.5px] text-ink outline-none placeholder:text-ink-faint focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              )}
              {showErrors && !btcLocValid && (
                <p className="text-[12px] text-loss">Please enter a name for the new location.</p>
              )}
            </div>
          </div>
        )}

        {/* Preview */}
        {valid && hasHolding && (
          <div className="rounded-2xl bg-surface-muted px-4 py-3">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-ink-muted">Units to add</span>
              <span className="font-semibold tnum text-ink">
                {isBtc
                  ? `${sats.toLocaleString()} sats (${units.toFixed(8)} BTC)`
                  : isGold
                  ? `${units.toFixed(4)} g`
                  : `${units.toFixed(4)} units`}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[13px]">
              <span className="text-ink-muted">Goes to</span>
              <span className="font-semibold text-ink">
                {isBtc
                  ? selectedLocId === '__new__'
                    ? newLocName.trim() || '—'
                    : (btcLocations.find((l) => l.id === selectedLocId)?.name ?? holding!.name)
                  : holding!.name}
              </span>
            </div>
          </div>
        )}

        <div className="pt-1">
          <Button onClick={confirm} className="w-full">
            ✓ Confirm — I bought this
          </Button>
        </div>
      </div>
    </Modal>
  )
}

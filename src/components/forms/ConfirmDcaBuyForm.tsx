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
  const { data, confirmDcaBuy, usdThb } = useData()
  const [price, setPrice] = useState<number | ''>('')
  const [sats, setSats] = useState<number | ''>('')
  const [unitHeld, setUnitHeld] = useState<number | ''>('')
  const [avgCost, setAvgCost] = useState<number | ''>('')
  const [currentPrice, setCurrentPrice] = useState<number | ''>('')
  const [showErrors, setShowErrors] = useState(false)
  const [selectedLocId, setSelectedLocId] = useState<string>('')
  const [newLocName, setNewLocName] = useState('')
  const wasOpen = useRef(false)
  const SATS_PER_BTC = 100_000_000

  const holding = plan?.holdingId
    ? data.holdings.find((h) => h.id === plan.holdingId) ?? null
    : data.holdings.find((h) => h.assetClass === plan?.assetClass) ?? null

  const isStock = holding?.assetClass === 'stock'
  const isBtc   = holding?.assetClass === 'crypto'
  const isGold  = holding?.assetClass === 'gold'
  const isFund  = holding?.assetClass === 'fund'
  const rate = usdThb ?? 1
  const btcLocations = holding?.btcLocations ?? []
  const goldLocations = holding?.goldLocations ?? []

  useEffect(() => {
    const justOpened = !wasOpen.current && open
    wasOpen.current = open
    if (!justOpened || !plan) return
    setShowErrors(false)
    // Pre-select location from plan preference, else first location, else new
    let preferredId = '__new__'
    if (isBtc) {
      preferredId = plan.btcLocationId && btcLocations.some((l) => l.id === plan.btcLocationId)
        ? plan.btcLocationId
        : btcLocations.length > 0 ? btcLocations[0].id : '__new__'
    } else if (isGold) {
      preferredId = plan.goldLocationId && goldLocations.some((l) => l.id === plan.goldLocationId)
        ? plan.goldLocationId
        : goldLocations.length > 0 ? goldLocations[0].id : '__new__'
    }
    setSelectedLocId(preferredId)
    setNewLocName('')
    setSats('')

    // Pre-fill fields from holding
    if (holding) {
      setUnitHeld(holding.units || '')
      setAvgCost(holding.avgCost || '')
      
      if (isStock && rate > 1) {
        setPrice(parseFloat((holding.price / rate).toFixed(2)))
      } else if (isBtc) {
        setPrice('')
      } else if (isGold) {
        setPrice(holding.price)
      } else if (isFund) {
        setPrice('')
        setCurrentPrice(holding.price || '')
      } else {
        setPrice('')
      }
    } else {
      setUnitHeld('')
      setAvgCost('')
      setCurrentPrice('')
      setPrice('')
    }
  }, [open, plan])

  if (!plan) return null

  const priceNum = Number(price)
  const satsValue = Number(sats)
  const btcUnits = isBtc && satsValue > 0 ? satsValue / SATS_PER_BTC : 0
  const priceInThb = isBtc
    ? btcUnits > 0 ? plan.monthlyAmount / btcUnits : 0
    : isStock && rate > 1
    ? priceNum * rate
    : priceNum
  const units = isBtc
    ? btcUnits
    : priceInThb > 0
    ? plan.monthlyAmount / priceInThb
    : 0
  const satsToAdd = isBtc ? satsValue : Math.round(units * 1e8)
  const gramsToAdd = isGold ? units : 0
  const hasHolding = !!holding

  // Validation
  const valid = isBtc
    ? satsValue > 0
    : isStock
    ? Number(unitHeld) > 0 && Number(avgCost) > 0
    : isFund
    ? Number(unitHeld) > 0 && Number(avgCost) > 0 && Number(currentPrice) > 0
    : priceNum > 0

  // Location validation
  const locValid = !(isBtc || isGold) || !hasHolding ||
    (selectedLocId !== '__new__') ||
    (newLocName.trim().length > 0)

  const priceLabel = isStock
    ? `Current price / unit (USD)`
    : isBtc ? 'Satoshis bought'
    : isGold ? 'Current price / gram (฿)'
    : 'NAV / unit (฿)'

  const pricePrefix = isStock ? '$' : isBtc ? undefined : '฿'
  const meta = ASSET_META[plan.assetClass]

  function confirm() {
    if (!valid || !locValid) { setShowErrors(true); return }
    if (!plan) return
    const p = plan
    const today = localDateStr()

    if (isBtc && hasHolding && holding) {
      const btcLocUpdate = selectedLocId === '__new__'
        ? {
            name: newLocName.trim(),
            satoshi: satsToAdd,
            thbSpent: p.monthlyAmount,
          }
        : (() => {
            const existing = btcLocations.find((l) => l.id === selectedLocId)
            return existing
              ? {
                  id: existing.id,
                  name: existing.name,
                  satoshi: existing.satoshi + satsToAdd,
                  thbSpent: existing.thbSpent + p.monthlyAmount,
                }
              : undefined
          })()
      confirmDcaBuy(p.id, priceInThb, today, undefined, undefined, undefined, btcLocUpdate)
    } else if (isGold && hasHolding && holding) {
      const goldLocUpdate = selectedLocId === '__new__'
        ? {
            name: newLocName.trim(),
            grams: gramsToAdd,
            thbSpent: p.monthlyAmount,
          }
        : (() => {
            const existing = goldLocations.find((l) => l.id === selectedLocId)
            return existing
              ? {
                  id: existing.id,
                  name: existing.name,
                  grams: existing.grams + gramsToAdd,
                  thbSpent: existing.thbSpent + p.monthlyAmount,
                }
              : undefined
          })()
      confirmDcaBuy(p.id, priceInThb, today, undefined, undefined, undefined, undefined, goldLocUpdate)
    } else if (isStock && hasHolding && holding) {
      // Send total units and avg cost overrides (and the stock price in USD, which is converted to THB for metadata/updatedAt price)
      confirmDcaBuy(p.id, priceInThb, today, Number(unitHeld), Number(avgCost), priceInThb)
    } else if (isFund && hasHolding && holding) {
      // Send total units, avg cost, and current price overrides
      confirmDcaBuy(p.id, Number(currentPrice), today, Number(unitHeld), Number(avgCost), Number(currentPrice))
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

        {/* Price / Inputs block */}
        {isStock && hasHolding ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-surface-muted p-3 text-[12px] text-ink-muted">
              <span className="font-semibold text-ink">Update Total Portfolio:</span> Update your total held units and average cost to keep your portfolio stats accurate.
            </div>
            <NumberField
              label="Total units held (shares)"
              value={unitHeld}
              onChange={setUnitHeld}
              placeholder="0.00"
              error={showErrors && Number(unitHeld) <= 0 ? 'Required (> 0)' : undefined}
            />
            <NumberField
              label="Average cost per unit (USD)"
              prefix="$"
              value={avgCost}
              onChange={setAvgCost}
              placeholder="0.00"
              error={showErrors && Number(avgCost) <= 0 ? 'Required (> 0)' : undefined}
            />
          </div>
        ) : isFund && hasHolding ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-surface-muted p-3 text-[12px] text-ink-muted">
              <span className="font-semibold text-ink">Update Total Portfolio:</span> Update your total held units, average cost, and current NAV to keep your portfolio stats accurate.
            </div>
            <NumberField
              label="Total units held"
              value={unitHeld}
              onChange={setUnitHeld}
              placeholder="0.00"
              error={showErrors && Number(unitHeld) <= 0 ? 'Required (> 0)' : undefined}
            />
            <NumberField
              label="Average cost per unit (฿)"
              prefix="฿"
              value={avgCost}
              onChange={setAvgCost}
              placeholder="0.00"
              error={showErrors && Number(avgCost) <= 0 ? 'Required (> 0)' : undefined}
            />
            <NumberField
              label="Current NAV / unit (฿)"
              prefix="฿"
              value={currentPrice}
              onChange={setCurrentPrice}
              placeholder="0.00"
              error={showErrors && Number(currentPrice) <= 0 ? 'Required (> 0)' : undefined}
            />
          </div>
        ) : (
          <NumberField
            label={priceLabel}
            prefix={pricePrefix}
            value={isBtc ? sats : price}
            onChange={isBtc ? setSats : setPrice}
            placeholder={isBtc ? 'e.g. 500000' : '0'}
            error={showErrors && !valid ? 'Required (> 0)' : undefined}
          />
        )}

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
              {showErrors && !locValid && (
                <p className="text-[12px] text-loss">Please enter a name for the new location.</p>
              )}
            </div>
          </div>
        )}

        {/* Gold location picker */}
        {isGold && hasHolding && (
          <div>
            <p className="mb-2 text-[13px] font-semibold text-ink">Where did you buy?</p>
            <div className="space-y-2">
              {goldLocations.map((loc) => (
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
                    name="goldLoc"
                    value={loc.id}
                    checked={selectedLocId === loc.id}
                    onChange={() => setSelectedLocId(loc.id)}
                    className="accent-brand"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold text-ink">{loc.name}</p>
                    <p className="text-[11.5px] text-ink-muted">
                      {loc.grams.toFixed(4)} g · {thb(loc.thbSpent)} spent
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
                  name="goldLoc"
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
                  placeholder="e.g. Home safe, Bank vault…"
                  autoFocus
                  className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-[13.5px] text-ink outline-none placeholder:text-ink-faint focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              )}
              {showErrors && !locValid && (
                <p className="text-[12px] text-loss">Please enter a name for the new location.</p>
              )}
            </div>
          </div>
        )}

        {/* Preview */}
        {hasHolding && (
          <div className="rounded-2xl bg-surface-muted px-4 py-3">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-ink-muted">Units to add</span>
              <span className="font-semibold tnum text-ink">
                {isBtc
                  ? `${satsValue > 0 ? satsValue.toLocaleString() : 0} sats (${units.toFixed(8)} BTC)`
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
                  : isGold
                  ? selectedLocId === '__new__'
                    ? newLocName.trim() || '—'
                    : (goldLocations.find((l) => l.id === selectedLocId)?.name ?? holding!.name)
                  : holding!.name}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[13px]">
              <span className="text-ink-muted">Total will be</span>
              <span className="font-semibold tnum text-ink">
                {isBtc
                  ? `${(((btcLocations.find((l) => l.id === selectedLocId)?.satoshi ?? 0) + satsToAdd) / 100_000_000).toFixed(8)} BTC`
                  : isGold
                  ? `${((goldLocations.find((l) => l.id === selectedLocId)?.grams ?? 0) + gramsToAdd).toFixed(4)} g`
                  : `${((holding?.units ?? 0) + units).toFixed(4)} units`}
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

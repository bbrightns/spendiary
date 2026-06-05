import { useEffect, useRef, useState } from 'react'
import { Modal } from '../ui/Modal'
import { NumberField } from '../ui/Field'
import { Button } from '../ui/Button'
import { useData } from '../../store/DataContext'
import { ASSET_META } from '../../lib/calc'
import type { DcaPlan } from '../../lib/types'
import { thb } from '../../lib/format'

interface Props {
  open: boolean
  plan: DcaPlan | null
  onClose: () => void
}

export function ConfirmDcaBuyForm({ open, plan, onClose }: Props) {
  const { data, confirmDcaBuy, usdThb } = useData()
  const [price, setPrice] = useState<number | ''>('')
  const [showErrors, setShowErrors] = useState(false)
  const wasOpen = useRef(false)

  const holding = plan?.holdingId
    ? data.holdings.find((h) => h.id === plan.holdingId) ?? null
    : null

  const isStock = holding?.assetClass === 'stock'
  const isBtc   = holding?.assetClass === 'crypto'
  const isGold  = holding?.assetClass === 'gold'
  const rate = usdThb ?? 1

  useEffect(() => {
    const justOpened = !wasOpen.current && open
    wasOpen.current = open
    if (!justOpened || !plan) return
    setShowErrors(false)

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
  const hasHolding = !!holding
  const valid = priceNum > 0

  const priceLabel = isStock
    ? `Current price / unit (USD)`
    : isBtc ? 'Current price / BTC (฿)'
    : isGold ? 'Current price / gram (฿)'
    : 'NAV / unit (฿)'

  const pricePrefix = isStock ? '$' : '฿'

  const meta = ASSET_META[plan.assetClass]

  function confirm() {
    if (!valid) { setShowErrors(true); return }
    const today = new Date().toISOString().slice(0, 10)
    confirmDcaBuy(plan!.id, priceInThb, today)
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
        {/* Summary card */}
        <div
          className="rounded-2xl border px-4 py-3"
          style={{
            borderColor: `color-mix(in srgb, ${meta.color} 30%, transparent)`,
            background: `color-mix(in srgb, ${meta.color} 7%, white)`,
          }}
        >
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-ink-soft">Plan</span>
            <span className="font-semibold text-ink">{plan.name}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[13px]">
            <span className="text-ink-soft">Amount spent</span>
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

        {/* Preview */}
        {valid && hasHolding && (
          <div className="rounded-2xl bg-surface-muted px-4 py-3">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-ink-muted">Units to add</span>
              <span className="font-semibold tnum text-ink">
                {isBtc
                  ? `${Math.round(units * 1e8).toLocaleString()} sats (${units.toFixed(8)} BTC)`
                  : isGold
                  ? `${units.toFixed(4)} g`
                  : `${units.toFixed(4)} units`}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[13px]">
              <span className="text-ink-muted">Goes to</span>
              <span className="font-semibold text-ink">{holding!.name}</span>
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

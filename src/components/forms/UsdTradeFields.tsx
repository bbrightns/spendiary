import { useState, type ReactNode } from 'react'
import { NumberField } from '../ui/Field'
import { SegmentedControl } from '../ui/SegmentedControl'
import { PencilIcon } from '../icons'
import { money } from '../../lib/format'
import { fxLooksOff, type TradeCurrency, type UsdTrade } from '../../lib/usdTrade'

type Value = number | string | ''

interface Props {
  kind: 'buy' | 'sell' | 'add'
  /** Which numbers to ask for: the paying (or receiving) account's currency, or the toggle's */
  currency: TradeCurrency
  /** Set when no cash account fixes the currency: shows the USD / THB toggle */
  onCurrencyChange?: (c: TradeCurrency) => void
  shares: Value
  onSharesChange: (v: Value) => void
  priceUsd: Value
  onPriceUsdChange: (v: Value) => void
  amountThb: Value
  onAmountThbChange: (v: Value) => void
  /** A rate typed by hand ('' = today's rate) */
  fx: Value
  onFxChange: (v: Value) => void
  liveFx: number
  /** The trade these fields resolve to (resolveUsdTrade), null while incomplete */
  trade: UsdTrade | null
  showErrors?: boolean
  sharesLabel?: string
  priceLabel?: string
  sharesError?: string
  sharesRightElement?: ReactNode
}

const LABELS = {
  buy: { shares: 'Shares bought', price: 'Price / share (USD)', amount: 'Amount paid (THB)', toggle: 'Paid in' },
  sell: { shares: 'Shares to sell', price: 'Sell price (USD)', amount: 'Amount received (THB)', toggle: 'Received in' },
  add: { shares: 'Shares', price: 'Avg cost / share (USD)', amount: 'Total paid (THB)', toggle: 'Paid in' },
} as const

const rateText = (fx: number) => `฿${fx.toFixed(2)}/USD`

/**
 * The US-stock fields of a buy, sale or new holding, asking only for what the money's currency needs:
 * - USD: shares and price; the rate (for the THB cost) is today's unless edited
 * - THB: the baht amount, shares and price; the rate comes out of those
 */
export function UsdTradeFields(p: Props) {
  const labels = LABELS[p.kind]
  const [editRate, setEditRate] = useState(false)
  const showRateField = editRate || p.fx !== '' || p.liveFx <= 0
  const t = p.trade
  const required = (v: Value) => (p.showErrors && !(Number(String(v).replace(/,/g, '')) > 0) ? 'Required (> 0)' : undefined)

  const sharesField = (
    <NumberField
      label={p.sharesLabel ?? labels.shares}
      hint={p.currency === 'THB' && !p.sharesRightElement ? 'optional' : undefined}
      value={p.shares}
      onChange={p.onSharesChange}
      error={p.sharesError ?? (p.currency === 'USD' ? required(p.shares) : undefined)}
      placeholder={t?.sharesEstimated ? `≈ ${t.shares}` : '0'}
      step={0.0001}
      rightElement={p.sharesRightElement}
    />
  )
  const priceField = (
    <NumberField
      label={p.priceLabel ?? labels.price}
      prefix="$"
      value={p.priceUsd}
      onChange={p.onPriceUsdChange}
      error={required(p.priceUsd)}
      placeholder="0.00"
      step={0.01}
    />
  )

  return (
    <div className="space-y-3">
      {p.onCurrencyChange && (
        <div className="space-y-1">
          <span className="text-sm font-medium text-ink-soft">{labels.toggle}</span>
          <SegmentedControl
            size="sm"
            value={p.currency}
            onChange={p.onCurrencyChange}
            options={[
              { value: 'USD', label: 'USD' },
              { value: 'THB', label: 'THB' },
            ]}
          />
        </div>
      )}

      {p.currency === 'THB' && (
        <NumberField
          label={labels.amount}
          prefix="฿"
          value={p.amountThb}
          onChange={p.onAmountThbChange}
          error={required(p.amountThb)}
          placeholder="0.00"
          step={0.01}
        />
      )}

      <div className="grid grid-cols-2 items-end gap-3">
        {sharesField}
        {priceField}
      </div>

      {p.currency === 'USD' && showRateField && (
        <NumberField
          label="FX rate (THB per USD)"
          hint={p.liveFx > 0 ? `today ${p.liveFx.toFixed(2)}` : undefined}
          value={p.fx}
          onChange={p.onFxChange}
          error={p.showErrors && p.liveFx <= 0 && !(Number(p.fx) > 0) ? 'Required: no USD/THB rate loaded yet' : undefined}
          placeholder={p.liveFx > 0 ? p.liveFx.toFixed(2) : "Your broker's rate"}
          step={0.01}
        />
      )}

      {t && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl bg-surface-muted px-3 py-2 text-xs text-ink-muted">
          <span>
            <span className="font-semibold tnum text-ink">{money(t.usd, 'USD', true)}</span>
            {' · '}
            <span className="tnum">{money(t.thb, 'THB', true)}</span>
            {' at '}
            <span className="tnum">{rateText(t.fx)}</span>
            {t.fxFromAmounts && ' (from your amounts)'}
            {t.sharesEstimated && ` · ≈ ${t.shares} share${t.shares === 1 ? '' : 's'} at today's rate`}
          </span>
          {p.currency === 'USD' && !showRateField && (
            <button
              type="button"
              onClick={() => setEditRate(true)}
              className="inline-flex items-center gap-1 font-semibold text-link hover:underline cursor-pointer"
            >
              <PencilIcon className="h-3 w-3" /> Edit rate
            </button>
          )}
        </div>
      )}

      {t && p.currency === 'THB' && fxLooksOff(t.fx, p.liveFx) && (
        <p className="text-xs text-warn-ink">
          That works out to {rateText(t.fx)}, far from today's {rateText(p.liveFx)}. Check the amount, shares and price.
        </p>
      )}
    </div>
  )
}

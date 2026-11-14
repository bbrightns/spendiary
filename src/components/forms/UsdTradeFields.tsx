import { useState, type ReactNode } from 'react'
import { NumberField } from '../ui/Field'
import { SegmentedControl } from '../ui/SegmentedControl'
import { PencilIcon } from '../icons'
import { money } from '../../lib/format'
import { fieldNumber, fxLooksOff, type TradeCurrency, type UsdTrade } from '../../lib/usdTrade'

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
  /** USD trades: the broker's fee in USD; the field shows when a setter is given */
  feeUsd?: Value
  onFeeUsdChange?: (v: Value) => void
  /** The automatic rate: today's, or the paying USD wallet's average */
  liveFx: number
  /** What the automatic rate is, for the labels: "today" (default) or e.g. "wallet avg" */
  autoRateName?: string
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
  // The rate is automatic (today's, or from the amounts) until one is typed; with no rate loaded, a USD trade needs one
  const rateTyped = fieldNumber(p.fx) > 0
  const showRateField = editRate || p.fx !== '' || (p.currency === 'USD' && p.liveFx <= 0)
  const t = p.trade
  const autoName = p.autoRateName ?? 'today'
  const rateSource = rateTyped ? 'your rate' : autoName === 'today' ? "today's rate" : autoName
  // THB trade with both shares and a rate typed: the shares win, but say when the two disagree
  const sharesAtRate = p.currency === 'THB' && rateTyped && fieldNumber(p.shares) > 0 && fieldNumber(p.priceUsd) > 0 && fieldNumber(p.amountThb) > 0
    ? fieldNumber(p.amountThb) / fieldNumber(p.fx) / fieldNumber(p.priceUsd)
    : null
  const sharesMismatch = sharesAtRate !== null && Math.abs(sharesAtRate - fieldNumber(p.shares)) / fieldNumber(p.shares) > 0.005
  const useAutoRate = () => { p.onFxChange(''); setEditRate(false) }
  const editRateButton = (
    <button
      type="button"
      onClick={() => setEditRate(true)}
      className="inline-flex items-center gap-1 font-semibold text-link hover:underline cursor-pointer"
    >
      <PencilIcon className="h-3 w-3" /> Enter my own rate
    </button>
  )
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

      {p.currency === 'USD' && p.onFeeUsdChange && (
        <NumberField
          label="Fee (USD)"
          hint={p.kind === 'sell' ? 'optional · comes off what you receive' : 'optional · paid on top'}
          prefix="$"
          value={p.feeUsd ?? ''}
          onChange={p.onFeeUsdChange}
          placeholder="0.00"
          step={0.01}
        />
      )}

      {showRateField && (
        <NumberField
          label="FX rate (THB per USD)"
          hint={p.currency === 'THB' ? 'works out the shares' : p.liveFx > 0 ? `auto: ${autoName} ${p.liveFx.toFixed(2)}` : undefined}
          value={p.fx}
          onChange={p.onFxChange}
          error={p.showErrors && p.currency === 'USD' && p.liveFx <= 0 && !rateTyped ? 'Required: no USD/THB rate loaded yet' : undefined}
          placeholder={p.liveFx > 0 ? p.liveFx.toFixed(2) : "Your broker's rate"}
          step={0.0001}
          rightElement={p.liveFx > 0 ? (
            <button
              type="button"
              onClick={useAutoRate}
              className="rounded-md border border-line bg-surface-muted px-2 py-0.5 text-xs font-bold text-ink-muted hover:text-link cursor-pointer"
              title="Go back to the automatic rate"
            >
              Auto
            </button>
          ) : undefined}
        />
      )}

      {t ? (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl bg-surface-muted px-3 py-2 text-xs text-ink-muted">
          <span>
            {t.feeUsd > 0 && (
              <span className="tnum">
                {money(t.grossUsd, 'USD', true)} {p.kind === 'sell' ? '−' : '+'} {money(t.feeUsd, 'USD', true)} fee ={' '}
              </span>
            )}
            <span className="font-semibold tnum text-ink">{money(t.usd, 'USD', true)}</span>
            {' · '}
            <span className="tnum">{money(t.thb, 'THB', true)}</span>
            {' at '}
            <span className="tnum">{rateText(t.fx)}</span>
            {t.fxFromAmounts ? ' (from your amounts)' : ` (${rateSource})`}
            {t.sharesEstimated && ` · ≈ ${t.shares} share${t.shares === 1 ? '' : 's'}`}
          </span>
          {!showRateField && editRateButton}
        </div>
      ) : (
        !showRateField && <div className="text-xs">{editRateButton}</div>
      )}

      {sharesMismatch && sharesAtRate !== null && (
        <p className="text-xs text-warn-ink">
          At {rateText(fieldNumber(p.fx))} that is ≈ {Number(sharesAtRate.toFixed(4))} shares. The shares you typed are kept, and the rate comes from your amounts.
        </p>
      )}

      {t && p.currency === 'THB' && fxLooksOff(t.fx, p.liveFx) && (
        <p className="text-xs text-warn-ink">
          That works out to {rateText(t.fx)}, far from today's {rateText(p.liveFx)}. Check the amount, shares and price.
        </p>
      )}
    </div>
  )
}

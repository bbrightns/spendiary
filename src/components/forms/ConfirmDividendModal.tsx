import React, { useEffect, useRef, useState } from 'react'
import { Modal } from '../ui/Modal'
import { NumberField, SelectField, TextField } from '../ui/Field'
import { FormActions } from './FormActions'
import { AssetLogo } from '../ui/AssetLogo'
import { useData } from '../../store/DataContext'
import { useToast } from '../../store/ToastContext'
import { ASSET_META, getHoldingDpsForMonth, nextPayoutMonth } from '../../lib/calc'
import type { Holding } from '../../lib/types'
import { localDateStr, thb } from '../../lib/format'

interface Props {
  open: boolean
  holding?: Holding | null
  initialDps?: number
  onClose: () => void
}

export function ConfirmDividendModal({ open, holding, initialDps, onClose }: Props) {
  const { data, recordDividend, removeDividendRecord } = useData()
  const { showToast } = useToast()

  const [selectedHoldingId, setSelectedHoldingId] = useState<string>('')
  const [paymentDate, setPaymentDate] = useState<string>(localDateStr(new Date()))
  const [dps, setDps] = useState<number | ''>('')
  const [shares, setShares] = useState<number | ''>('')
  const [deductTax, setDeductTax] = useState<boolean>(true)
  const [taxRate, setTaxRate] = useState<number>(0.10) // 10% withholding tax default
  const [cashAccountId, setCashAccountId] = useState<string>('')
  const [note, setNote] = useState<string>('')
  const [showErrors, setShowErrors] = useState<boolean>(false)

  const wasOpen = useRef(false)

  // Resolve current active holding
  const targetHolding = holding ?? data.holdings.find((h) => h.id === selectedHoldingId) ?? null

  useEffect(() => {
    if (open && !wasOpen.current) {
      setShowErrors(false)
      const initialHolding = holding ?? data.holdings.find((h) => h.paysDividend) ?? data.holdings[0] ?? null
      const hId = initialHolding ? initialHolding.id : ''
      setSelectedHoldingId(hId)

      const today = new Date()
      setPaymentDate(localDateStr(today))

      const paymentMonth = today.getMonth() + 1
      const initialDpsVal = initialDps ?? (initialHolding ? getHoldingDpsForMonth(initialHolding, paymentMonth) : undefined)
      setDps(typeof initialDpsVal === 'number' && initialDpsVal > 0 ? initialDpsVal : '')

      const units = initialHolding ? (initialHolding.units ?? initialHolding.totalUnits ?? 0) : 0
      setShares(units > 0 ? units : '')

      setDeductTax(true)
      setTaxRate(0.10)

      // Default cash account
      const defaultAccId = initialHolding?.defaultCashAccountId ?? data.cashAccounts[0]?.id ?? ''
      setCashAccountId(defaultAccId)
      setNote('')
    }
    wasOpen.current = open
  }, [open, holding, initialDps, data.holdings, data.cashAccounts])

  // When selected holding changes from dropdown
  const handleHoldingChange = (newHoldingId: string) => {
    setSelectedHoldingId(newHoldingId)
    const found = data.holdings.find((h) => h.id === newHoldingId)
    if (found) {
      const monthNum = paymentDate ? new Date(paymentDate).getMonth() + 1 : (new Date().getMonth() + 1)
      const foundDps = getHoldingDpsForMonth(found, monthNum)
      if (foundDps > 0) {
        setDps(foundDps)
      }
      const units = found.units ?? found.totalUnits ?? 0
      if (units > 0) {
        setShares(units)
      }
      if (found.defaultCashAccountId) {
        setCashAccountId(found.defaultCashAccountId)
      }
    }
  }

  const isUsd = targetHolding?.assetClass === 'stock'
  const currencyPrefix = isUsd ? '$' : '฿'
  const formatCur = (val: number) =>
    isUsd
      ? `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : thb(val)

  const numDps = typeof dps === 'number' && !isNaN(dps) ? dps : 0
  const numShares = typeof shares === 'number' && !isNaN(shares) ? shares : 0
  const grossAmount = numDps * numShares
  const effectiveTaxRate = deductTax ? taxRate : 0
  const taxAmount = parseFloat((grossAmount * effectiveTaxRate).toFixed(2))
  const netAmount = parseFloat((grossAmount - taxAmount).toFixed(2))

  const isValid = targetHolding !== null && numDps > 0 && numShares > 0 && Boolean(paymentDate)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    submit()
  }

  const submit = () => {
    if (!isValid || !targetHolding) {
      setShowErrors(true)
      return
    }

    const selectedCashAcc = data.cashAccounts.find((c) => c.id === cashAccountId)

    const recordId = recordDividend({
      holdingId: targetHolding.id,
      holdingName: targetHolding.name,
      ticker: targetHolding.ticker,
      assetClass: targetHolding.assetClass,
      paymentDate,
      dps: numDps,
      shares: numShares,
      grossAmount,
      taxRate: effectiveTaxRate,
      taxAmount,
      netAmount,
      cashAccountId: selectedCashAcc ? selectedCashAcc.id : undefined,
      cashAccountName: selectedCashAcc ? selectedCashAcc.name : undefined,
      note: note.trim() || undefined,
    })

    const next = nextPayoutMonth(targetHolding.dividendMonths ?? [], paymentDate)
    showToast(
      `${formatCur(netAmount)} from ${targetHolding.ticker} has been recorded.`,
      'success',
      { label: 'Undo', onClick: () => removeDividendRecord(recordId) },
      {
        celebrate: true,
        title: 'Received',
        // The amount that landed, then whose dividend it was, the tax and where it went
        detail: {
          amount: formatCur(netAmount),
          name: targetHolding.name,
          meta: [effectiveTaxRate > 0 ? `After ${+(effectiveTaxRate * 100).toFixed(2)}% tax` : undefined, selectedCashAcc?.name].filter(Boolean).join(' · ') || undefined,
          footnote: next ? `Next payout in ${next}` : undefined,
        },
      },
    )
    onClose()
  }

  // Options for holding select dropdown
  const holdingOptions = data.holdings.map((h) => ({
    value: h.id,
    label: `${h.ticker} · ${h.name} (${(h.units ?? 0).toLocaleString()} ${h.assetClass === 'fund' ? 'units' : 'shares'})`,
  }))

  // Options for cash account select dropdown
  const cashAccountOptions = [
    { value: '', label: 'Do not add to a cash account' },
    ...data.cashAccounts.map((c) => ({
      value: c.id,
      label: `${c.name} (${c.currency === 'USD' ? '$' : '฿'}${c.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`,
    })),
  ]

  const assetMeta = targetHolding ? ASSET_META[targetHolding.assetClass] : null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record dividend"
      description="Record a dividend and add it to a cash account"
      footer={
        <FormActions
          editing={false}
          canSave
          onSave={submit}
          submitLabel={netAmount > 0 ? `Record ${formatCur(netAmount)}` : 'Record dividend'}
        />
      }
    >
      <form id="confirm-dividend-form" onSubmit={handleSubmit} className="space-y-4 pt-1">
        {/* Selected Holding Card or Selector */}
        {holding ? (
          <div className="flex items-center gap-3 rounded-2xl bg-surface-muted p-4">
            <AssetLogo name={holding.name} assetClass={holding.assetClass} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-base text-ink">{holding.ticker}</span>
                {assetMeta && (
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-semibold"
                    style={{ backgroundColor: `${assetMeta.color}18`, color: assetMeta.color }}
                  >
                    {assetMeta.label}
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-ink-muted">{holding.name}</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-medium text-ink-muted">You own</span>
              <p className="font-display text-sm font-bold text-ink">
                {(holding.units ?? holding.totalUnits ?? 0).toLocaleString()} {holding.assetClass === 'fund' ? 'units' : 'shares'}
              </p>
            </div>
          </div>
        ) : (
          <SelectField
            label="Choose asset"
            value={selectedHoldingId}
            options={holdingOptions}
            onChange={handleHoldingChange}
            error={showErrors && !targetHolding ? 'Please choose an asset' : undefined}
          />
        )}

        {/* Date, DPS, Shares & Account Inputs (Single unified grid for perfect 2x2 horizontal alignment) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <TextField
            label="Date received"
            type="date"
            value={paymentDate}
            onChange={setPaymentDate}
            error={showErrors && !paymentDate ? 'Please enter a date' : undefined}
          />

          <NumberField
            label="Dividend per share"
            prefix={currencyPrefix}
            placeholder="0.00"
            value={dps}
            onChange={setDps}
            error={showErrors && (!numDps || numDps <= 0) ? 'Enter an amount above 0' : undefined}
          />

          <NumberField
            label={targetHolding?.assetClass === 'fund' ? 'Units you own' : 'Shares you own'}
            placeholder="e.g. 1,000"
            value={shares}
            onChange={setShares}
            error={showErrors && (!numShares || numShares <= 0) ? 'Enter an amount above 0' : undefined}
          />

          <SelectField
            label="Paid into"
            value={cashAccountId}
            options={cashAccountOptions}
            onChange={setCashAccountId}
          />
        </div>

        {/* Summary & Withholding Tax Card */}
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-muted">Total dividend</span>
            <span className="font-semibold text-ink tnum">
              {grossAmount > 0 ? formatCur(grossAmount) : `${currencyPrefix}0.00`}
            </span>
          </div>

          {/* Tax Checkbox */}
          <div className="flex items-center justify-between pt-1 border-t border-line/60">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={deductTax}
                onChange={(e) => setDeductTax(e.target.checked)}
                className="h-4 w-4 rounded-md border-line text-brand focus:ring-brand/30"
              />
              <span className="text-xs font-medium text-ink">
                Tax withheld (10%)
              </span>
            </label>
            <span className="text-xs font-semibold text-rose-500 tnum">
              {taxAmount > 0 ? `-${formatCur(taxAmount)}` : `${currencyPrefix}0.00`}
            </span>
          </div>

          {/* Net Amount Box */}
          <div className="flex items-center justify-between border-t border-emerald-500/20 pt-2.5">
            <div>
              <span className="text-sm font-bold text-ink">Net amount received</span>
              <p className="text-xs text-ink-muted">What actually lands in your account</p>
            </div>
            <div className="text-right">
              <span className="font-display text-xl font-extrabold text-emerald-600 dark:text-emerald-400 tnum">
                {netAmount > 0 ? formatCur(netAmount) : `${currencyPrefix}0.00`}
              </span>
            </div>
          </div>
        </div>

        {/* Note (Optional) */}
        <TextField
          label="Note (optional)"
          placeholder="e.g. 1H 2026 payout"
          value={note}
          onChange={setNote}
        />
      </form>
    </Modal>
  )
}

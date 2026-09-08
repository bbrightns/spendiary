import React, { useEffect, useRef, useState } from 'react'
import { Modal } from '../ui/Modal'
import { NumberField, SelectField, TextField } from '../ui/Field'
import { Button } from '../ui/Button'
import { AssetLogo } from '../ui/AssetLogo'
import { useData } from '../../store/DataContext'
import { useToast } from '../../store/ToastContext'
import { ASSET_META } from '../../lib/calc'
import type { Holding } from '../../lib/types'
import { localDateStr, thb } from '../../lib/format'
import { CheckCircleIcon } from '../icons'

interface Props {
  open: boolean
  holding?: Holding | null
  initialDps?: number
  onClose: () => void
}

export function ConfirmDividendModal({ open, holding, initialDps, onClose }: Props) {
  const { data, recordDividend } = useData()
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

      setPaymentDate(localDateStr(new Date()))

      const initialDpsVal = initialDps ?? initialHolding?.expectedDps
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
      if (found.expectedDps && found.expectedDps > 0) {
        setDps(found.expectedDps)
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

  const numDps = typeof dps === 'number' && !isNaN(dps) ? dps : 0
  const numShares = typeof shares === 'number' && !isNaN(shares) ? shares : 0
  const grossAmount = numDps * numShares
  const effectiveTaxRate = deductTax ? taxRate : 0
  const taxAmount = parseFloat((grossAmount * effectiveTaxRate).toFixed(2))
  const netAmount = parseFloat((grossAmount - taxAmount).toFixed(2))

  const isValid = targetHolding !== null && numDps > 0 && numShares > 0 && Boolean(paymentDate)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid || !targetHolding) {
      setShowErrors(true)
      return
    }

    const selectedCashAcc = data.cashAccounts.find((c) => c.id === cashAccountId)

    recordDividend({
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

    showToast(`Recorded dividend of ฿${netAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} for ${targetHolding.ticker}`, 'success')
    onClose()
  }

  // Options for holding select dropdown
  const holdingOptions = data.holdings.map((h) => ({
    value: h.id,
    label: `${h.ticker} · ${h.name} (${(h.units ?? 0).toLocaleString()} ${h.assetClass === 'fund' ? 'units' : 'shares'})`,
  }))

  // Options for cash account select dropdown
  const cashAccountOptions = [
    { value: '', label: 'None · Do not deposit to cash (ไม่บันทึกเข้าบัญชี)' },
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
      title="Confirm Dividend Payment"
      description="Record dividend payout into your portfolio and cash accounts."
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {/* Selected Holding Card or Selector */}
        {holding ? (
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface-muted/50 p-3.5">
            <AssetLogo name={holding.name} assetClass={holding.assetClass} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-[15px] text-ink">{holding.ticker}</span>
                {assetMeta && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ backgroundColor: `${assetMeta.color}18`, color: assetMeta.color }}
                  >
                    {assetMeta.label}
                  </span>
                )}
              </div>
              <p className="truncate text-[12.5px] text-ink-muted">{holding.name}</p>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-medium text-ink-muted">In Portfolio</span>
              <p className="font-display text-[13px] font-bold text-ink">
                {(holding.units ?? holding.totalUnits ?? 0).toLocaleString()} {holding.assetClass === 'fund' ? 'units' : 'shares'}
              </p>
            </div>
          </div>
        ) : (
          <SelectField
            label="Select Holding (เลือกสินทรัพย์ที่ได้รับปันผล)"
            value={selectedHoldingId}
            options={holdingOptions}
            onChange={handleHoldingChange}
            error={showErrors && !targetHolding ? 'Please select a holding' : undefined}
          />
        )}

        {/* Date and DPS Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextField
            label="Payment Date (วันที่รับเงิน)"
            type="date"
            value={paymentDate}
            onChange={setPaymentDate}
            error={showErrors && !paymentDate ? 'Date is required' : undefined}
          />

          <NumberField
            label="Dividend per Share (DPS / ปันผลต่อหุ้น)"
            prefix="฿"
            placeholder="e.g. 0.80"
            value={dps}
            onChange={setDps}
            error={showErrors && (!numDps || numDps <= 0) ? 'Required > 0' : undefined}
          />
        </div>

        {/* Shares Eligible */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <NumberField
            label="Shares on Record Date (จำนวนหุ้นที่ได้รับสิทธิ)"
            placeholder="e.g. 10,000"
            value={shares}
            onChange={setShares}
            error={showErrors && (!numShares || numShares <= 0) ? 'Required > 0' : undefined}
          />

          <SelectField
            label="Deposit to Cash Account (เข้าบัญชีเงินสด)"
            value={cashAccountId}
            options={cashAccountOptions}
            onChange={setCashAccountId}
          />
        </div>

        {/* Summary & Withholding Tax Card */}
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-ink-muted">Gross Dividend (ยอดปันผลรวม)</span>
            <span className="font-semibold text-ink tnum">
              {grossAmount > 0 ? thb(grossAmount) : '฿0.00'}
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
              <span className="text-[12.5px] font-medium text-ink">
                Deduct 10% Withholding Tax (หักภาษี ณ ที่จ่าย 10%)
              </span>
            </label>
            <span className="text-[12.5px] font-semibold text-rose-500 tnum">
              {taxAmount > 0 ? `-฿${taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '฿0.00'}
            </span>
          </div>

          {/* Net Amount Box */}
          <div className="flex items-center justify-between border-t border-emerald-500/20 pt-2.5">
            <div>
              <span className="text-[13.5px] font-bold text-ink">Net Cash Received</span>
              <p className="text-[11px] text-ink-muted">ยอดเงินสุทธิที่จะเข้าบัญชี</p>
            </div>
            <div className="text-right">
              <span className="font-display text-[22px] font-extrabold text-emerald-600 dark:text-emerald-400 tnum">
                {netAmount > 0 ? thb(netAmount) : '฿0.00'}
              </span>
            </div>
          </div>
        </div>

        {/* Note (Optional) */}
        <TextField
          label="Note (บันทึกช่วยจำ - ถ้ามี)"
          placeholder="e.g. ปันผลระหว่างกาล 1H/2026 หรือ ปันผลประจำปี"
          value={note}
          onChange={setNote}
        />

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
          >
            <CheckCircleIcon className="h-4 w-4 mr-1.5" strokeWidth={2.2} />
            {netAmount > 0
              ? `Confirm Received (${thb(netAmount)})`
              : 'Confirm Received'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Modal } from '../ui/Modal'
import { NumberField, SelectField, TextField } from '../ui/Field'
import { Button } from '../ui/Button'
import { useData } from '../../store/DataContext'
import type { DcaPlan } from '../../lib/types'
import { localDateStr } from '../../lib/format'

function safeFixed(num: number, digits: number = 4): string {
  if (!isFinite(num) || isNaN(num)) return (0).toFixed(digits)
  return num.toFixed(digits)
}

interface Props {
  open: boolean
  plan: DcaPlan | null
  onClose: () => void
  onSuccess?: () => void
}

export function ConfirmDcaBuyForm({ open, plan, onClose, onSuccess }: Props) {
  const { data, confirmDcaBuy, usdThb } = useData()

  // Shared Amount Spent THB (editable for ALL asset classes)
  const [amountSpentThb, setAmountSpentThb] = useState<number | ''>('')

  // US Stock specific state
  const [fxRate, setFxRate] = useState<number | ''>('')
  const [unitsBought, setUnitsBought] = useState<number | ''>('')

  // Mutual Fund specific state
  const [fundUnits, setFundUnits] = useState<number | ''>('')

  // Gold specific state
  const [goldInputMode, setGoldInputMode] = useState<'grams' | 'price'>('grams')
  const [goldPricePerGram, setGoldPricePerGram] = useState<number | ''>('')
  const [goldGrams, setGoldGrams] = useState<number | ''>('')

  // Crypto / BTC specific state
  const [sats, setSats] = useState<number | ''>('')

  // Location selection state (BTC / Gold)
  const [selectedLocId, setSelectedLocId] = useState<string>('')
  const [newLocName, setNewLocName] = useState('')

  const [showErrors, setShowErrors] = useState(false)
  const wasOpen = useRef(false)
  const SATS_PER_BTC = 100_000_000

  // Lookup holding strictly by plan.holdingId first, then by exact/partial ticker or name
  const holding = plan?.holdingId
    ? data.holdings.find((h) => h.id === plan.holdingId) ?? null
    : data.holdings.find(
        (h) =>
          h.ticker.toUpperCase() === plan?.name.toUpperCase() ||
          h.name.toLowerCase() === plan?.name.toLowerCase() ||
          h.name.toLowerCase().includes(plan?.name.toLowerCase() ?? '') ||
          plan?.name.toLowerCase().includes(h.name.toLowerCase() ?? ''),
      ) ?? null

  const assetClass = plan?.assetClass ?? holding?.assetClass
  const isStock = assetClass === 'stock'
  const isBtc   = assetClass === 'crypto'
  const isGold  = assetClass === 'gold'
  const isFund  = assetClass === 'fund'
  const rate = usdThb && usdThb > 0 ? usdThb : 33.40
  const btcLocations = holding?.btcLocations ?? []
  const goldLocations = holding?.goldLocations ?? []

  useEffect(() => {
    const justOpened = !wasOpen.current && open
    wasOpen.current = open
    if (!justOpened || !plan) return
    setShowErrors(false)

    // Shared amount initialization
    setAmountSpentThb(plan.monthlyAmount)

    // US Stock initialization
    setFxRate(rate)
    setUnitsBought('')

    // Mutual Fund initialization
    setFundUnits('')

    // Gold initialization
    setGoldInputMode('grams')
    setGoldPricePerGram('')
    setGoldGrams('')

    // Crypto initialization
    setSats('')

    // Location selection initialization
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
  }, [open, plan])

  if (!plan) return null

  const amountThbNum = Number(amountSpentThb) || 0

  // --------------------------------------------------------------------------
  // Target Holding / Location Subtitle Resolution
  // --------------------------------------------------------------------------
  const selectedBtcLoc = btcLocations.find((l) => l.id === selectedLocId)
  const selectedGoldLoc = goldLocations.find((l) => l.id === selectedLocId)

  const resolvedLocationName = selectedLocId === '__new__'
    ? newLocName.trim() || 'New Location'
    : (isBtc ? selectedBtcLoc?.name : selectedGoldLoc?.name) ?? holding?.name ?? plan.name

  const targetSubtitleText = (isBtc || isGold)
    ? resolvedLocationName
    : holding?.name ?? plan.name

  // --------------------------------------------------------------------------
  // 1. Mutual Fund Real-time Calculations
  // --------------------------------------------------------------------------
  const fundUnitsNum = Number(fundUnits) || 0
  const fundImpliedNav = fundUnitsNum > 0 ? amountThbNum / fundUnitsNum : (holding?.price ?? 0)

  const fundCurrentUnits = holding?.units ?? holding?.totalUnits ?? 0
  const fundCurrentThbInvested = holding?.totalThbInvested ?? (fundCurrentUnits * (holding?.avgCostThb ?? holding?.avgCost ?? 0))

  const fundNewTotalUnits = fundCurrentUnits + fundUnitsNum
  const fundNewTotalThbInvested = fundCurrentThbInvested + amountThbNum
  const fundNewAvgCostThb = fundNewTotalUnits > 0 ? fundNewTotalThbInvested / fundNewTotalUnits : 0

  const hasValidFund = fundUnits !== '' && fundUnitsNum > 0 && amountThbNum > 0

  // --------------------------------------------------------------------------
  // 2. US Stock Real-time Calculations
  // --------------------------------------------------------------------------
  const fxRateNum = Number(fxRate) || 0
  const stockUnitsBoughtNum = Number(unitsBought) || 0
  const stockUsdSpentThisTx = fxRateNum > 0 ? amountThbNum / fxRateNum : 0
  const stockImpliedPriceUsd = stockUnitsBoughtNum > 0 ? stockUsdSpentThisTx / stockUnitsBoughtNum : 0

  const stockCurrentUnits = holding?.units ?? holding?.totalUnits ?? 0
  const stockCurrentThbInvested = holding?.totalThbInvested ?? stockCurrentUnits * (holding?.avgCostThb ?? holding?.avgCost ?? 0)
  const stockCurrentUsdInvested = holding?.totalUsdInvested ?? stockCurrentUnits * (holding?.avgCostUsd ?? (fxRateNum > 0 ? (holding?.avgCost ?? 0) / fxRateNum : 0))

  const stockNewTotalUnits = stockCurrentUnits + stockUnitsBoughtNum
  const stockNewTotalThbInvested = stockCurrentThbInvested + amountThbNum
  const stockNewTotalUsdInvested = stockCurrentUsdInvested + stockUsdSpentThisTx

  const stockNewAvgCostUsd = stockNewTotalUnits > 0 ? stockNewTotalUsdInvested / stockNewTotalUnits : 0
  const stockNewAvgCostThb = stockNewTotalUnits > 0 ? stockNewTotalThbInvested / stockNewTotalUnits : 0

  const hasValidStock = unitsBought !== '' && stockUnitsBoughtNum > 0 && amountThbNum > 0 && fxRateNum > 0

  // --------------------------------------------------------------------------
  // 3. Crypto / BTC Real-time Calculations
  // --------------------------------------------------------------------------
  const satsNum = Number(sats) || 0
  const btcImpliedPrice = satsNum > 0 ? (amountThbNum / satsNum) * SATS_PER_BTC : 0

  const btcCurrentTotalSats = holding?.btcLocations
    ? holding.btcLocations.reduce((s, l) => s + l.satoshi, 0)
    : Math.round((holding?.units ?? 0) * SATS_PER_BTC)
  const btcCurrentTotalThb = holding?.totalThbInvested ?? (holding?.btcLocations ?? []).reduce((s, l) => s + l.thbSpent, 0)

  const btcNewTotalSats = btcCurrentTotalSats + satsNum
  const btcNewTotalThbInvested = btcCurrentTotalThb + amountThbNum
  const btcNewAvgCostThb = btcNewTotalSats > 0 ? (btcNewTotalThbInvested / btcNewTotalSats) * SATS_PER_BTC : 0

  const hasValidBtc = sats !== '' && satsNum > 0 && amountThbNum > 0

  // --------------------------------------------------------------------------
  // 4. Gold Real-time Calculations
  // --------------------------------------------------------------------------
  const goldPriceNum = Number(goldPricePerGram) || 0
  const goldGramsNum = Number(goldGrams) || 0

  const goldGramsToAdd = goldInputMode === 'grams'
    ? goldGramsNum
    : goldPriceNum > 0 ? amountThbNum / goldPriceNum : 0
  const goldImpliedPricePerGram = goldInputMode === 'price' && goldPriceNum > 0
    ? goldPriceNum
    : (goldGramsToAdd > 0 ? amountThbNum / goldGramsToAdd : 0)

  const goldCurrentTotalGrams = holding?.units ?? goldLocations.reduce((s, l) => s + l.grams, 0)
  const goldCurrentTotalThb = holding?.totalThbInvested ?? goldLocations.reduce((s, l) => s + l.thbSpent, 0)

  const goldNewTotalGrams = goldCurrentTotalGrams + goldGramsToAdd
  const goldNewTotalThbInvested = goldCurrentTotalThb + amountThbNum
  const goldNewAvgCostThb = goldNewTotalGrams > 0 ? goldNewTotalThbInvested / goldNewTotalGrams : 0

  const hasValidGold = ((goldInputMode === 'grams' && goldGrams !== '') || (goldInputMode === 'price' && goldPricePerGram !== '')) && goldGramsToAdd > 0 && amountThbNum > 0

  // --------------------------------------------------------------------------
  // Validation Logic
  // --------------------------------------------------------------------------
  const valid = isStock
    ? stockUnitsBoughtNum > 0 && amountThbNum > 0 && fxRateNum > 0
    : isFund
    ? fundUnitsNum > 0 && amountThbNum > 0
    : isGold
    ? goldGramsToAdd > 0 && amountThbNum > 0
    : isBtc
    ? satsNum > 0 && amountThbNum > 0
    : amountThbNum > 0

  const locValid = !(isBtc || isGold) ||
    (selectedLocId !== '__new__') ||
    (newLocName.trim().length > 0)

  function confirm() {
    if (!valid || !locValid) { setShowErrors(true); return }
    if (!plan) return
    const p = plan
    const today = localDateStr()

    if (isStock) {
      confirmDcaBuy(
        p.id,
        0,
        today,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        {
          unitsBought: stockUnitsBoughtNum,
          amountSpentThb: amountThbNum,
          fxRate: fxRateNum,
        },
      )
    } else if (isFund) {
      confirmDcaBuy(
        p.id,
        fundImpliedNav,
        today,
        undefined,
        undefined,
        fundImpliedNav,
        undefined,
        undefined,
        undefined,
        {
          unitsBought: fundUnitsNum,
          amountSpentThb: amountThbNum,
          nav: fundImpliedNav,
        },
      )
    } else if (isGold) {
      const goldLocUpdate = selectedLocId === '__new__'
        ? {
            name: newLocName.trim(),
            grams: goldGramsToAdd,
            thbSpent: amountThbNum,
          }
        : (() => {
            const existing = goldLocations.find((l) => l.id === selectedLocId)
            return existing
              ? {
                  id: existing.id,
                  name: existing.name,
                  grams: existing.grams + goldGramsToAdd,
                  thbSpent: existing.thbSpent + amountThbNum,
                }
              : undefined
          })()
      confirmDcaBuy(p.id, goldImpliedPricePerGram, today, undefined, undefined, undefined, undefined, goldLocUpdate)
    } else if (isBtc) {
      const btcLocUpdate = selectedLocId === '__new__'
        ? {
            name: newLocName.trim(),
            satoshi: satsNum,
            thbSpent: amountThbNum,
          }
        : (() => {
            const existing = btcLocations.find((l) => l.id === selectedLocId)
            return existing
              ? {
                  id: existing.id,
                  name: existing.name,
                  satoshi: existing.satoshi + satsNum,
                  thbSpent: existing.thbSpent + amountThbNum,
                }
              : undefined
          })()
      confirmDcaBuy(p.id, btcImpliedPrice, today, undefined, undefined, undefined, btcLocUpdate)
    }

    onSuccess?.()
    onClose()
  }

  // Options for Storage / Location Dropdowns
  const btcLocationOptions = [
    ...btcLocations.map((l) => ({ value: l.id, label: l.name })),
    { value: '__new__', label: '+ New location…' },
  ]

  const goldLocationOptions = [
    ...goldLocations.map((l) => ({ value: l.id, label: l.name })),
    { value: '__new__', label: '+ New location…' },
  ]

  const valueStyle = (isValid: boolean) =>
    isValid ? 'font-semibold tnum text-ink' : 'font-medium tnum text-ink-muted'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Confirm Buy: ${holding?.name ?? plan.name}`}
      description={`Record DCA purchase into ${targetSubtitleText}`}
    >
      <div className="space-y-5">
        {/* ------------------------------------------------------------------ */}
        {/* 1. Mutual Fund Form */}
        {/* ------------------------------------------------------------------ */}
        {isFund && (
          <div className="space-y-4">
            <NumberField
              label="Amount spent (THB)"
              prefix="฿"
              value={amountSpentThb}
              onChange={setAmountSpentThb}
              placeholder="2,000"
              error={showErrors && amountThbNum <= 0 ? 'Required (> 0)' : undefined}
            />

            <NumberField
              label="Units bought"
              value={fundUnits}
              onChange={setFundUnits}
              placeholder="e.g. 108.1081"
              autoFocus
              error={showErrors && fundUnitsNum <= 0 ? 'Units bought required (> 0)' : undefined}
            />

            {/* Static PURCHASE SUMMARY Preview Section: Mutual Fund */}
            <div className="min-h-[220px] rounded-2xl border border-line-strong bg-surface-muted p-4 flex flex-col justify-between space-y-2.5 shadow-sm">
              <p className="text-[12px] font-bold uppercase tracking-wider text-brand">PURCHASE SUMMARY</p>
              
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-ink-muted">Execution NAV (this tx)</span>
                <span className={valueStyle(hasValidFund)}>
                  {hasValidFund ? `฿${safeFixed(fundImpliedNav, 4)} / unit` : '฿-- / unit'}
                </span>
              </div>

              <div className="flex items-center justify-between text-[13px]">
                <span className="text-ink-muted">Units Added</span>
                <span className={valueStyle(hasValidFund)}>
                  {hasValidFund ? `+${safeFixed(fundUnitsNum, 4)} units` : '+0.0000 units'}
                </span>
              </div>

              <div className="flex items-center justify-between text-[13px]">
                <span className="text-ink-muted">New Total Units</span>
                <span className={valueStyle(hasValidFund)}>
                  {hasValidFund ? `${safeFixed(fundNewTotalUnits, 4)} units` : '-- units'}
                </span>
              </div>

              <div className="flex items-center justify-between text-[13px]">
                <span className="text-ink-muted">New Total THB Invested</span>
                <span className={valueStyle(hasValidFund)}>
                  {hasValidFund ? `฿${fundNewTotalThbInvested.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '฿--'}
                </span>
              </div>

              <div className="pt-2 border-t border-line flex flex-col gap-1 text-[12.5px]">
                <span className="text-[11px] font-medium text-ink-muted">New Avg Cost</span>
                <div className={`text-[13.5px] ${hasValidFund ? 'font-bold tnum text-ink' : 'font-medium tnum text-ink-muted'}`}>
                  {hasValidFund ? `฿${safeFixed(fundNewAvgCostThb, 2)} / unit` : '฿-- / unit'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* 2. US Stock Form */}
        {/* ------------------------------------------------------------------ */}
        {isStock && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label="Amount spent (THB)"
                prefix="฿"
                value={amountSpentThb}
                onChange={setAmountSpentThb}
                placeholder="2,000"
                error={showErrors && amountThbNum <= 0 ? 'Required (> 0)' : undefined}
              />
              <NumberField
                label="FX Rate (USD/THB)"
                prefix="$"
                value={fxRate}
                onChange={setFxRate}
                placeholder="33.40"
                error={showErrors && fxRateNum <= 0 ? 'Required (> 0)' : undefined}
              />
            </div>

            <NumberField
              label="Shares bought"
              value={unitsBought}
              onChange={setUnitsBought}
              placeholder="e.g. 0.3000"
              autoFocus
              error={showErrors && stockUnitsBoughtNum <= 0 ? 'Shares bought required (> 0)' : undefined}
            />

            {/* Static PURCHASE SUMMARY Preview Section: Stock */}
            <div className="min-h-[220px] rounded-2xl border border-line-strong bg-surface-muted p-4 flex flex-col justify-between space-y-2.5 shadow-sm">
              <p className="text-[12px] font-bold uppercase tracking-wider text-brand">PURCHASE SUMMARY</p>
              
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-ink-muted">Implied Price/Share (this tx)</span>
                <span className={valueStyle(hasValidStock)}>
                  {hasValidStock ? `$${safeFixed(stockImpliedPriceUsd, 2)} / share` : '$ -- / share'}
                </span>
              </div>
              
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-ink-muted">Shares Added</span>
                <span className={valueStyle(hasValidStock)}>
                  {hasValidStock ? `+${safeFixed(stockUnitsBoughtNum, 4)} shares` : '+0.0000 shares'}
                </span>
              </div>

              <div className="flex items-center justify-between text-[13px]">
                <span className="text-ink-muted">New Total Shares</span>
                <span className={valueStyle(hasValidStock)}>
                  {hasValidStock ? `${safeFixed(stockNewTotalUnits, 4)} shares` : '-- shares'}
                </span>
              </div>

              <div className="flex items-center justify-between text-[13px]">
                <span className="text-ink-muted">New Total THB Invested</span>
                <span className={valueStyle(hasValidStock)}>
                  {hasValidStock ? `฿${stockNewTotalThbInvested.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '฿--'}
                </span>
              </div>

              <div className="pt-2 border-t border-line flex flex-col gap-1 text-[12.5px]">
                <span className="text-[11px] font-medium text-ink-muted">New Avg Cost</span>
                {hasValidStock ? (
                  <div className="flex items-center gap-2 flex-wrap font-bold tnum text-ink text-[13.5px]">
                    <span>${safeFixed(stockNewAvgCostUsd, 2)} / share</span>
                    <span className="text-ink-muted font-normal">≈</span>
                    <span>฿{stockNewAvgCostThb.toLocaleString(undefined, { maximumFractionDigits: 2 })} / share</span>
                  </div>
                ) : (
                  <div className="font-medium tnum text-ink-muted text-[13.5px]">
                    $ -- / share ≈ ฿-- / share
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* 3. Crypto / BTC Form */}
        {/* ------------------------------------------------------------------ */}
        {isBtc && (
          <div className="space-y-4">
            <NumberField
              label="Amount spent (THB)"
              prefix="฿"
              value={amountSpentThb}
              onChange={setAmountSpentThb}
              placeholder="2,000"
              error={showErrors && amountThbNum <= 0 ? 'Required (> 0)' : undefined}
            />

            <NumberField
              label="Sats bought"
              value={sats}
              onChange={setSats}
              placeholder="e.g. 22222"
              autoFocus
              error={showErrors && satsNum <= 0 ? 'Sats bought required (> 0)' : undefined}
            />

            <SelectField
              label="Storage / Location"
              value={selectedLocId}
              onChange={setSelectedLocId}
              options={btcLocationOptions}
            />

            {selectedLocId === '__new__' && (
              <TextField
                label="New Location Name"
                value={newLocName}
                onChange={setNewLocName}
                placeholder="e.g. Binance, Cold Wallet..."
                error={showErrors && !locValid ? 'Location name required' : undefined}
              />
            )}

            {/* Static PURCHASE SUMMARY Preview Section: Crypto / BTC */}
            <div className="min-h-[220px] rounded-2xl border border-line-strong bg-surface-muted p-4 flex flex-col justify-between space-y-2.5 shadow-sm">
              <p className="text-[12px] font-bold uppercase tracking-wider text-brand">PURCHASE SUMMARY</p>
              
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-ink-muted">Implied BTC Price (this tx)</span>
                <span className={valueStyle(hasValidBtc)}>
                  {hasValidBtc ? `฿${Math.round(btcImpliedPrice).toLocaleString()} / BTC` : '฿-- / BTC'}
                </span>
              </div>

              <div className="flex items-center justify-between text-[13px]">
                <span className="text-ink-muted">Sats Added</span>
                <span className={valueStyle(hasValidBtc)}>
                  {hasValidBtc ? `+${satsNum.toLocaleString()} sats` : '+0 sats'}
                </span>
              </div>

              <div className="flex items-center justify-between text-[13px]">
                <span className="text-ink-muted">New Total Sats</span>
                <span className={valueStyle(hasValidBtc)}>
                  {hasValidBtc ? `${btcNewTotalSats.toLocaleString()} sats` : '-- sats'}
                </span>
              </div>

              <div className="flex items-center justify-between text-[13px]">
                <span className="text-ink-muted">New Total THB Invested</span>
                <span className={valueStyle(hasValidBtc)}>
                  {hasValidBtc ? `฿${btcNewTotalThbInvested.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '฿--'}
                </span>
              </div>

              <div className="pt-2 border-t border-line flex flex-col gap-1 text-[12.5px]">
                <span className="text-[11px] font-medium text-ink-muted">New Avg Cost</span>
                <div className={`text-[13.5px] ${hasValidBtc ? 'font-bold tnum text-ink' : 'font-medium tnum text-ink-muted'}`}>
                  {hasValidBtc ? `฿${Math.round(btcNewAvgCostThb).toLocaleString()} / BTC` : '฿-- / BTC'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* 4. Gold Form */}
        {/* ------------------------------------------------------------------ */}
        {isGold && (
          <div className="space-y-4">
            <NumberField
              label="Amount spent (THB)"
              prefix="฿"
              value={amountSpentThb}
              onChange={setAmountSpentThb}
              placeholder="2,000"
              error={showErrors && amountThbNum <= 0 ? 'Required (> 0)' : undefined}
            />

            <div className="flex rounded-xl bg-surface-muted p-1 gap-1">
              <button
                type="button"
                onClick={() => setGoldInputMode('grams')}
                className={`flex-1 rounded-lg py-1.5 text-[12px] font-semibold transition-all ${
                  goldInputMode === 'grams'
                    ? 'bg-surface text-ink shadow-sm'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                Grams Bought
              </button>
              <button
                type="button"
                onClick={() => setGoldInputMode('price')}
                className={`flex-1 rounded-lg py-1.5 text-[12px] font-semibold transition-all ${
                  goldInputMode === 'price'
                    ? 'bg-surface text-ink shadow-sm'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                Price per Gram
              </button>
            </div>

            {goldInputMode === 'grams' ? (
              <NumberField
                label="Grams bought (g)"
                value={goldGrams}
                onChange={setGoldGrams}
                placeholder="e.g. 0.1636"
                autoFocus
                error={showErrors && goldGramsToAdd <= 0 ? 'Grams bought required (> 0)' : undefined}
              />
            ) : (
              <NumberField
                label="Price per gram (฿)"
                prefix="฿"
                value={goldPricePerGram}
                onChange={setGoldPricePerGram}
                placeholder="e.g. 3,200"
                autoFocus
                error={showErrors && goldGramsToAdd <= 0 ? 'Price per gram required (> 0)' : undefined}
              />
            )}

            <SelectField
              label="Storage / Location"
              value={selectedLocId}
              onChange={setSelectedLocId}
              options={goldLocationOptions}
            />

            {selectedLocId === '__new__' && (
              <TextField
                label="New Location Name"
                value={newLocName}
                onChange={setNewLocName}
                placeholder="e.g. Home safe, Bank vault..."
                error={showErrors && !locValid ? 'Location name required' : undefined}
              />
            )}

            {/* Static PURCHASE SUMMARY Preview Section: Gold */}
            <div className="min-h-[220px] rounded-2xl border border-line-strong bg-surface-muted p-4 flex flex-col justify-between space-y-2.5 shadow-sm">
              <p className="text-[12px] font-bold uppercase tracking-wider text-brand">PURCHASE SUMMARY</p>
              
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-ink-muted">Price / Gram (this tx)</span>
                <span className={valueStyle(hasValidGold)}>
                  {hasValidGold ? `฿${safeFixed(goldImpliedPricePerGram, 2)} / g` : '฿-- / g'}
                </span>
              </div>

              <div className="flex items-center justify-between text-[13px]">
                <span className="text-ink-muted">Grams Added</span>
                <span className={valueStyle(hasValidGold)}>
                  {hasValidGold ? `+${safeFixed(goldGramsToAdd, 4)} g` : '+0.0000 g'}
                </span>
              </div>

              <div className="flex items-center justify-between text-[13px]">
                <span className="text-ink-muted">New Total Grams</span>
                <span className={valueStyle(hasValidGold)}>
                  {hasValidGold ? `${safeFixed(goldNewTotalGrams, 4)} g` : '-- g'}
                </span>
              </div>

              <div className="flex items-center justify-between text-[13px]">
                <span className="text-ink-muted">New Total THB Invested</span>
                <span className={valueStyle(hasValidGold)}>
                  {hasValidGold ? `฿${goldNewTotalThbInvested.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '฿--'}
                </span>
              </div>

              <div className="pt-2 border-t border-line flex flex-col gap-1 text-[12.5px]">
                <span className="text-[11px] font-medium text-ink-muted">New Avg Cost</span>
                <div className={`text-[13.5px] ${hasValidGold ? 'font-bold tnum text-ink' : 'font-medium tnum text-ink-muted'}`}>
                  {hasValidGold ? `฿${safeFixed(goldNewAvgCostThb, 2)} / g` : '฿-- / g'}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="pt-1">
          <Button onClick={confirm} className="w-full">
            ✓ Confirm purchase
          </Button>
        </div>
      </div>
    </Modal>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Modal } from '../ui/Modal'
import { NumberField, SelectField, TextField } from '../ui/Field'
import { Button } from '../ui/Button'
import { useData } from '../../store/DataContext'
import { useToast } from '../../store/ToastContext'
import type { DcaPlan } from '../../lib/types'
import { localDateStr } from '../../lib/format'
import { findMatchingHolding, GRAMS_PER_BAHT_GOLD } from '../../lib/calc'

interface Props {
  open: boolean
  plan: DcaPlan | null
  onClose: () => void
}

function fmtNum(val: number | undefined | null, maxDec = 4): string {
  if (val === undefined || val === null || isNaN(val) || !isFinite(val)) return '0'
  return val.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDec,
  })
}

export function ConfirmDcaBuyForm({ open, plan, onClose }: Props) {
  const { data, confirmDcaBuy, usdThb } = useData()
  const { showToast } = useToast()

  // Target Holding state
  const [targetHoldingId, setTargetHoldingId] = useState<string>('')

  // Shared Amount Spent THB (editable for ALL asset classes)
  const [amountSpentThb, setAmountSpentThb] = useState<number | ''>('')

  // US Stock specific state
  const [fxRate, setFxRate] = useState<number | ''>('')
  const [unitsBought, setUnitsBought] = useState<number | ''>('')

  // Mutual Fund specific state
  const [fundUnits, setFundUnits] = useState<number | ''>('')

  // Gold specific state
  const [goldInputMode, setGoldInputMode] = useState<'grams' | 'baht' | 'price' | 'price_baht'>('grams')
  const [goldPricePerGram, setGoldPricePerGram] = useState<number | ''>('')
  const [goldPricePerBaht, setGoldPricePerBaht] = useState<number | ''>('')
  const [goldGrams, setGoldGrams] = useState<number | ''>('')
  const [goldBaht, setGoldBaht] = useState<number | ''>('')

  // Crypto / BTC specific state
  const [sats, setSats] = useState<number | ''>('')

  // Location selection state (BTC / Gold)
  const [selectedLocId, setSelectedLocId] = useState<string>('')
  const [newLocName, setNewLocName] = useState('')

  const [showErrors, setShowErrors] = useState(false)
  const wasOpen = useRef(false)
  const SATS_PER_BTC = 100_000_000

  // Target holding resolution: find matching holding or fall back to targetHoldingId
  const matchedHolding = plan ? findMatchingHolding(data.holdings, plan) : null
  const holding = (targetHoldingId && targetHoldingId !== '__new__')
    ? (data.holdings.find((h) => h.id === targetHoldingId) ?? matchedHolding)
    : (targetHoldingId === '__new__' ? null : matchedHolding)

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

    // Initial target holding
    const initialMatched = findMatchingHolding(data.holdings, plan)
    setTargetHoldingId(initialMatched?.id ?? '__new__')

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
  const btcImpliedPriceThbPerBtc = satsNum > 0 ? (amountThbNum / satsNum) * SATS_PER_BTC : 0

  const btcCurrentTotalSats = holding?.units ? Math.round(holding.units * SATS_PER_BTC) : btcLocations.reduce((s, l) => s + l.satoshi, 0)
  const btcCurrentTotalThb  = holding?.totalThbInvested ?? btcLocations.reduce((s, l) => s + l.thbSpent, 0)

  const btcNewTotalSats = btcCurrentTotalSats + satsNum
  const btcNewTotalThbInvested = btcCurrentTotalThb + amountThbNum
  const btcNewAvgCostThb = btcNewTotalSats > 0 ? (btcNewTotalThbInvested / btcNewTotalSats) * SATS_PER_BTC : 0

  const hasValidBtc = sats !== '' && satsNum > 0 && amountThbNum > 0

  // --------------------------------------------------------------------------
  // 4. Gold Real-time Calculations
  // --------------------------------------------------------------------------
  const goldPriceNum = Number(goldPricePerGram) || 0
  const goldPriceBahtNum = Number(goldPricePerBaht) || 0
  const goldGramsNum = Number(goldGrams) || 0
  const goldBahtNum = Number(goldBaht) || 0

  let goldGramsToAdd = 0
  let goldImpliedPricePerGram = 0

  if (goldInputMode === 'grams') {
    goldGramsToAdd = goldGramsNum
    goldImpliedPricePerGram = goldGramsToAdd > 0 ? amountThbNum / goldGramsToAdd : 0
  } else if (goldInputMode === 'baht') {
    goldGramsToAdd = goldBahtNum * GRAMS_PER_BAHT_GOLD
    goldImpliedPricePerGram = goldGramsToAdd > 0 ? amountThbNum / goldGramsToAdd : 0
  } else if (goldInputMode === 'price') {
    goldImpliedPricePerGram = goldPriceNum
    goldGramsToAdd = goldPriceNum > 0 ? amountThbNum / goldPriceNum : 0
  } else if (goldInputMode === 'price_baht') {
    goldImpliedPricePerGram = goldPriceBahtNum > 0 ? goldPriceBahtNum / GRAMS_PER_BAHT_GOLD : 0
    goldGramsToAdd = goldImpliedPricePerGram > 0 ? amountThbNum / goldImpliedPricePerGram : 0
  }

  const goldCurrentTotalGrams = holding?.units ?? goldLocations.reduce((s, l) => s + l.grams, 0)
  const goldCurrentTotalThb = holding?.totalThbInvested ?? goldLocations.reduce((s, l) => s + l.thbSpent, 0)

  const goldNewTotalGrams = goldCurrentTotalGrams + goldGramsToAdd
  const goldNewTotalThbInvested = goldCurrentTotalThb + amountThbNum
  const goldNewAvgCostThb = goldNewTotalGrams > 0 ? goldNewTotalThbInvested / goldNewTotalGrams : 0

  const hasValidGold = goldGramsToAdd > 0 && amountThbNum > 0

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

    const resolvedTargetId = targetHoldingId !== '__new__' ? (holding?.id ?? targetHoldingId) : undefined

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
        undefined,
        resolvedTargetId,
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
        resolvedTargetId,
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
      confirmDcaBuy(
        p.id,
        goldImpliedPricePerGram,
        today,
        undefined,
        undefined,
        undefined,
        undefined,
        goldLocUpdate,
        undefined,
        undefined,
        resolvedTargetId,
        undefined,
        {
          gramsBought: goldGramsToAdd,
          amountSpentThb: amountThbNum,
        },
      )
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
      confirmDcaBuy(
        p.id,
        btcImpliedPriceThbPerBtc,
        today,
        undefined,
        undefined,
        undefined,
        btcLocUpdate,
        undefined,
        undefined,
        undefined,
        resolvedTargetId,
        {
          satsBought: satsNum,
          amountSpentThb: amountThbNum,
        },
      )
    }

    showToast(`Confirmed DCA buy for "${holding?.name ?? plan.name}"`, 'success')
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
        {data.holdings.length > 0 && (
          <SelectField
            label="Target Holding in Portfolio"
            value={targetHoldingId}
            onChange={setTargetHoldingId}
            options={[
              ...data.holdings
                .filter((h) => !assetClass || h.assetClass === assetClass)
                .map((h) => ({ value: h.id, label: `${h.name} (${h.ticker})` })),
              { value: '__new__', label: `+ Create new holding "${plan?.name ?? 'New'}"` },
            ]}
          />
        )}

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
            <div className="rounded-2xl border border-line-strong bg-surface-muted p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <p className="text-[12px] font-bold uppercase tracking-wider text-brand">PURCHASE PREVIEW (BEFORE → AFTER)</p>
                <span className="text-[11px] font-medium text-ink-muted">Max 4 decimals</span>
              </div>

              <div className="flex items-center justify-between text-[13px]">
                <span className="text-ink-muted">Execution NAV (this tx)</span>
                <span className={valueStyle(hasValidFund)}>
                  {hasValidFund ? `฿${fmtNum(fundImpliedNav, 4)} / unit` : '฿0 / unit'}
                </span>
              </div>

              <div className="space-y-1.5 pt-1 text-[13px]">
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Units</span>
                  <span className="tnum text-ink-soft">
                    {fmtNum(fundCurrentUnits, 4)} <span className="text-ink-muted font-normal">+ ({hasValidFund ? fmtNum(fundUnitsNum, 4) : '0'})</span> → <strong className={valueStyle(hasValidFund)}>{fmtNum(hasValidFund ? fundNewTotalUnits : fundCurrentUnits, 4)}</strong>
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">THB Invested</span>
                  <span className="tnum text-ink-soft">
                    ฿{fmtNum(fundCurrentThbInvested, 2)} → <strong className={valueStyle(hasValidFund)}>฿{fmtNum(hasValidFund ? fundNewTotalThbInvested : fundCurrentThbInvested, 2)}</strong>
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-line flex items-center justify-between text-[13px]">
                <span className="font-medium text-ink-muted">New Avg Cost</span>
                <span className={`tnum ${hasValidFund ? 'font-bold text-ink' : 'font-medium text-ink-muted'}`}>
                  {hasValidFund ? `฿${fmtNum(fundNewAvgCostThb, 4)} / unit` : `฿${fmtNum(fundCurrentUnits > 0 ? fundCurrentThbInvested / fundCurrentUnits : 0, 4)} / unit`}
                </span>
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
            <div className="rounded-2xl border border-line-strong bg-surface-muted p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <p className="text-[12px] font-bold uppercase tracking-wider text-brand">PURCHASE PREVIEW (BEFORE → AFTER)</p>
                <span className="text-[11px] font-medium text-ink-muted">Max 4 decimals</span>
              </div>

              <div className="flex items-center justify-between text-[13px]">
                <span className="text-ink-muted">Implied Price (this tx)</span>
                <span className={valueStyle(hasValidStock)}>
                  {hasValidStock ? `$${fmtNum(stockImpliedPriceUsd, 4)} / share` : '$0 / share'}
                </span>
              </div>

              <div className="space-y-1.5 pt-1 text-[13px]">
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Shares</span>
                  <span className="tnum text-ink-soft">
                    {fmtNum(stockCurrentUnits, 4)} <span className="text-ink-muted font-normal">+ ({hasValidStock ? fmtNum(stockUnitsBoughtNum, 4) : '0'})</span> → <strong className={valueStyle(hasValidStock)}>{fmtNum(hasValidStock ? stockNewTotalUnits : stockCurrentUnits, 4)}</strong>
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">THB Invested</span>
                  <span className="tnum text-ink-soft">
                    ฿{fmtNum(stockCurrentThbInvested, 2)} → <strong className={valueStyle(hasValidStock)}>฿{fmtNum(hasValidStock ? stockNewTotalThbInvested : stockCurrentThbInvested, 2)}</strong>
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-line flex items-center justify-between text-[13px]">
                <span className="font-medium text-ink-muted">New Avg Cost</span>
                <div className={`tnum ${hasValidStock ? 'font-bold text-ink' : 'font-medium text-ink-muted'}`}>
                  {hasValidStock ? (
                    <span>${fmtNum(stockNewAvgCostUsd, 4)} ≈ ฿{fmtNum(stockNewAvgCostThb, 2)}</span>
                  ) : (
                    <span>$0 ≈ ฿0</span>
                  )}
                </div>
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
            <div className="rounded-2xl border border-line-strong bg-surface-muted p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <p className="text-[12px] font-bold uppercase tracking-wider text-brand">PURCHASE PREVIEW (BEFORE → AFTER)</p>
                <span className="text-[11px] font-medium text-ink-muted">Digits only</span>
              </div>

              <div className="flex items-center justify-between text-[13px]">
                <span className="text-ink-muted">Implied BTC Price</span>
                <span className={valueStyle(hasValidBtc)}>
                  {hasValidBtc ? `฿${fmtNum(Math.round(btcImpliedPriceThbPerBtc), 0)} / BTC` : '฿0 / BTC'}
                </span>
              </div>

              <div className="space-y-1.5 pt-1 text-[13px]">
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Sats</span>
                  <span className="tnum text-ink-soft">
                    {fmtNum(btcCurrentTotalSats, 0)} <span className="text-ink-muted font-normal">+ ({hasValidBtc ? fmtNum(satsNum, 0) : '0'})</span> → <strong className={valueStyle(hasValidBtc)}>{fmtNum(hasValidBtc ? btcNewTotalSats : btcCurrentTotalSats, 0)} sats</strong>
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">THB Invested</span>
                  <span className="tnum text-ink-soft">
                    ฿{fmtNum(btcCurrentTotalThb, 2)} → <strong className={valueStyle(hasValidBtc)}>฿{fmtNum(hasValidBtc ? btcNewTotalThbInvested : btcCurrentTotalThb, 2)}</strong>
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-line flex items-center justify-between text-[13px]">
                <span className="font-medium text-ink-muted">New Avg Cost</span>
                <span className={`tnum ${hasValidBtc ? 'font-bold text-ink' : 'font-medium text-ink-muted'}`}>
                  {hasValidBtc ? `$${fmtNum(Math.round(rate > 0 ? btcNewAvgCostThb / rate : 0), 0)} / BTC (≈ ฿${fmtNum(Math.round(btcNewAvgCostThb), 0)})` : '$0 / BTC'}
                </span>
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

            <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-muted p-1">
              <button
                type="button"
                onClick={() => setGoldInputMode('grams')}
                className={`rounded-lg py-1.5 text-[12px] font-semibold transition-all cursor-pointer ${
                  goldInputMode === 'grams'
                    ? 'bg-surface text-ink shadow-sm'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                Weight (g)
              </button>
              <button
                type="button"
                onClick={() => setGoldInputMode('baht')}
                className={`rounded-lg py-1.5 text-[12px] font-semibold transition-all cursor-pointer ${
                  goldInputMode === 'baht'
                    ? 'bg-surface text-ink shadow-sm'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                Weight (บาททอง)
              </button>
              <button
                type="button"
                onClick={() => setGoldInputMode('price')}
                className={`rounded-lg py-1.5 text-[12px] font-semibold transition-all cursor-pointer ${
                  goldInputMode === 'price'
                    ? 'bg-surface text-ink shadow-sm'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                Price / Gram (฿/g)
              </button>
              <button
                type="button"
                onClick={() => setGoldInputMode('price_baht')}
                className={`rounded-lg py-1.5 text-[12px] font-semibold transition-all cursor-pointer ${
                  goldInputMode === 'price_baht'
                    ? 'bg-surface text-ink shadow-sm'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                Price / บาท (฿/บาท)
              </button>
            </div>

            {goldInputMode === 'grams' && (
              <NumberField
                label="Grams bought (g)"
                value={goldGrams}
                onChange={setGoldGrams}
                placeholder="e.g. 15.244"
                autoFocus
                step={0.0001}
                error={showErrors && goldGramsToAdd <= 0 ? 'Grams bought required (> 0)' : undefined}
              />
            )}
            {goldInputMode === 'baht' && (
              <NumberField
                label="Weight bought in บาททองคำ (ทองคำแท่ง 15.244g)"
                value={goldBaht}
                onChange={setGoldBaht}
                placeholder="e.g. 1.0"
                autoFocus
                step={0.0001}
                error={showErrors && goldGramsToAdd <= 0 ? 'Weight in บาททองคำ required (> 0)' : undefined}
              />
            )}
            {goldInputMode === 'price' && (
              <NumberField
                label="Price per gram (฿/g)"
                prefix="฿"
                value={goldPricePerGram}
                onChange={setGoldPricePerGram}
                placeholder="e.g. 2,850"
                autoFocus
                error={showErrors && goldGramsToAdd <= 0 ? 'Price per gram required (> 0)' : undefined}
              />
            )}
            {goldInputMode === 'price_baht' && (
              <NumberField
                label="Price per บาททองคำ (฿/บาททองคำ)"
                prefix="฿"
                value={goldPricePerBaht}
                onChange={setGoldPricePerBaht}
                placeholder="e.g. 43,500"
                autoFocus
                error={showErrors && goldGramsToAdd <= 0 ? 'Price per บาททองคำ required (> 0)' : undefined}
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
            <div className="rounded-2xl border border-line-strong bg-surface-muted p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <p className="text-[12px] font-bold uppercase tracking-wider text-brand">PURCHASE PREVIEW (BEFORE → AFTER)</p>
                <span className="text-[11px] font-medium text-ink-muted">Max 4 decimals</span>
              </div>

              <div className="flex items-center justify-between text-[13px]">
                <span className="text-ink-muted">Price / Gram</span>
                <span className={valueStyle(hasValidGold)}>
                  {hasValidGold ? `฿${fmtNum(goldImpliedPricePerGram, 2)} / g (≈ ฿${fmtNum(goldImpliedPricePerGram * GRAMS_PER_BAHT_GOLD, 0)} / บาททอง)` : '฿0 / g'}
                </span>
              </div>

              <div className="space-y-1.5 pt-1 text-[13px]">
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Grams</span>
                  <span className="tnum text-ink-soft">
                    {fmtNum(goldCurrentTotalGrams, 4)}g <span className="text-ink-muted font-normal">+ ({hasValidGold ? fmtNum(goldGramsToAdd, 4) : '0'})</span> → <strong className={valueStyle(hasValidGold)}>{fmtNum(hasValidGold ? goldNewTotalGrams : goldCurrentTotalGrams, 4)} g (≈ {fmtNum((hasValidGold ? goldNewTotalGrams : goldCurrentTotalGrams) / GRAMS_PER_BAHT_GOLD, 4)} บาททอง)</strong>
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">THB Invested</span>
                  <span className="tnum text-ink-soft">
                    ฿{fmtNum(goldCurrentTotalThb, 2)} → <strong className={valueStyle(hasValidGold)}>฿{fmtNum(hasValidGold ? goldNewTotalThbInvested : goldCurrentTotalThb, 2)}</strong>
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-line flex items-center justify-between text-[13px]">
                <span className="font-medium text-ink-muted">New Avg Cost</span>
                <span className={`tnum ${hasValidGold ? 'font-bold text-ink' : 'font-medium text-ink-muted'}`}>
                  {hasValidGold ? `฿${fmtNum(goldNewAvgCostThb * GRAMS_PER_BAHT_GOLD, 0)} ($${fmtNum(rate > 0 ? (goldNewAvgCostThb * GRAMS_PER_BAHT_GOLD) / rate : 0, 0)}) / บาททอง` : '฿0 / บาททอง'}
                </span>
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

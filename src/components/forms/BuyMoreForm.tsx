import { useEffect, useRef, useState } from 'react'
import { Modal } from '../ui/Modal'
import { NumberField, TextField, SelectField } from '../ui/Field'
import { Button } from '../ui/Button'
import { useData } from '../../store/DataContext'
import { useToast } from '../../store/ToastContext'
import { ASSET_META, GRAMS_PER_BAHT_GOLD, applyBuy, holdingMetrics, upsert } from '../../lib/calc'
import type { BtcLocation, GoldLocation, Holding } from '../../lib/types'
import { money, thb, localDateStr } from '../../lib/format'

interface Props {
  open: boolean
  holding: Holding | null
  onClose: () => void
}

const SATS_PER_BTC = 100_000_000

function formatToMaxDecimals(val: number | string, maxDecimals: number): string {
  const num = Number(val)
  if (isNaN(num) || val === '') return ''
  return Number(num.toFixed(maxDecimals)).toString()
}

function formatCostOrFx(val: number | string): string {
  const num = Number(val)
  if (isNaN(num) || val === '') return ''
  const str = num.toString()
  const dotIdx = str.indexOf('.')
  if (dotIdx === -1) {
    return num.toFixed(2)
  }
  const decimals = str.length - dotIdx - 1
  if (decimals <= 2) {
    return num.toFixed(2)
  }
  const rounded = Number(num.toFixed(4))
  const roundedStr = rounded.toString()
  const roundedDotIdx = roundedStr.indexOf('.')
  if (roundedDotIdx === -1) {
    return rounded.toFixed(2)
  }
  const roundedDecimals = roundedStr.length - roundedDotIdx - 1
  if (roundedDecimals < 2) {
    return rounded.toFixed(2)
  }
  return roundedStr
}

export function BuyMoreForm({ open, holding, onClose }: Props) {
  const { upsertHolding, upsertBtcLocation, upsertGoldLocation, addHoldingLog, usdThb } = useData()
  const { showToast } = useToast()

  // Shared state
  const [units, setUnits] = useState<number | ''>('')
  const [price, setPrice] = useState<number | ''>('')
  const [showErrors, setShowErrors] = useState(false)

  // BTC-specific state
  const [satoshi, setSatoshi] = useState<number | ''>('')
  const [thbSpent, setThbSpent] = useState<number | ''>('')
  const [locationId, setLocationId] = useState('')
  const [newLocationName, setNewLocationName] = useState('')

  // Gold-specific state
  const [goldUnit, setGoldUnit] = useState<'grams' | 'baht'>('grams')
  const [goldGrams, setGoldGrams] = useState<number | ''>('')
  const [goldBaht, setGoldBaht] = useState<number | ''>('')
  const [goldThbSpent, setGoldThbSpent] = useState<number | ''>('')
  const [goldLocationId, setGoldLocationId] = useState('')
  const [goldNewLocationName, setGoldNewLocationName] = useState('')

  // US Stock-specific state
  const [amountSpentThb, setAmountSpentThb] = useState<number | string | ''>('')
  const [fxRate, setFxRate] = useState<number | string | ''>('')
  const [priceUsd, setPriceUsd] = useState<number | string | ''>('')
  const [sharesBought, setSharesBought] = useState<number | string | ''>('')
  const [lastFocused, setLastFocused] = useState<'thb' | 'shares'>('thb')

  const isBtc = holding?.assetClass === 'crypto'
  const isGold = holding?.assetClass === 'gold'
  const isStock = holding?.assetClass === 'stock'
  const rate = usdThb && usdThb > 1 ? usdThb : 1
  const existingLocations = holding?.btcLocations ?? []

  // Guard: only reset form when modal *freshly opens* (false→true),
  // not when holding changes mid-session due to live price ticks.
  const wasOpen = useRef(false)

  const priceInThb = isStock && rate > 1 ? Number(price) * rate : Number(price)
  const valid = units !== '' && Number(units) > 0 && price !== '' && Number(price) > 0
  const preview = valid && holding ? applyBuy(holding, Number(units), priceInThb) : null
  const cost = valid ? Number(units) * priceInThb : 0
  const label = holding?.assetClass === 'fund' ? 'units' : 'shares'

  const fxRateNum = Number(fxRate) || rate
  const priceUsdNum = Number(priceUsd) || (holding && rate > 0 ? holding.price / rate : 0)
  const amountSpentThbNum = Number(amountSpentThb)
  const sharesBoughtNum = Number(sharesBought)
  const validStock =
    amountSpentThb !== '' &&
    amountSpentThbNum > 0 &&
    fxRate !== '' &&
    fxRateNum > 0 &&
    priceUsd !== '' &&
    priceUsdNum > 0 &&
    sharesBought !== '' &&
    sharesBoughtNum > 0

  const stockCurrentUnits = holding ? (holding.units ?? holding.totalUnits ?? 0) : 0
  const stockPrevThbInvested = holding
    ? (holding.totalThbInvested ??
      stockCurrentUnits * (holding.avgCostThb ?? holding.avgCost ?? 0))
    : 0
  const stockNewTotalUnits = stockCurrentUnits + sharesBoughtNum
  const stockNewTotalThbInvested = stockPrevThbInvested + amountSpentThbNum

  function handleAmountSpentThbChange(val: number | string | '') {
    setAmountSpentThb(val)
    setLastFocused('thb')
    if (val === '' || Number(val) <= 0) {
      setSharesBought('')
      return
    }
    const valNum = Number(val)
    const currentFxRate = Number(fxRate) || rate
    const currentPriceUsd = Number(priceUsd) || (holding && rate > 0 ? holding.price / rate : 1)
    if (currentFxRate > 0 && currentPriceUsd > 0) {
      const usdSpent = valNum / currentFxRate
      const shares = usdSpent / currentPriceUsd
      setSharesBought(Number(shares.toFixed(4)))
    } else {
      setSharesBought('')
    }
  }

  function handleSharesBoughtChange(val: number | string | '') {
    setSharesBought(val)
    setLastFocused('shares')
    if (val === '' || Number(val) <= 0) {
      setAmountSpentThb('')
      return
    }
    const valNum = Number(val)
    const currentFxRate = Number(fxRate) || rate
    const currentPriceUsd = Number(priceUsd) || (holding && rate > 0 ? holding.price / rate : 1)
    if (currentFxRate > 0 && currentPriceUsd > 0) {
      const usdSpent = valNum * currentPriceUsd
      const thbSpentVal = usdSpent * currentFxRate
      setAmountSpentThb(Number(thbSpentVal.toFixed(2)))
    } else {
      setAmountSpentThb('')
    }
  }

  function handleFxRateChange(val: number | string | '') {
    setFxRate(val)
    if (val === '' || Number(val) <= 0) return
    const valNum = Number(val)
    const currentPriceUsd = Number(priceUsd) || (holding && rate > 0 ? holding.price / rate : 1)
    if (lastFocused === 'thb' && amountSpentThb !== '' && Number(amountSpentThb) > 0) {
      const usdSpent = Number(amountSpentThb) / valNum
      const shares = usdSpent / currentPriceUsd
      setSharesBought(Number(shares.toFixed(4)))
    } else if (lastFocused === 'shares' && sharesBought !== '' && Number(sharesBought) > 0) {
      const usdSpent = Number(sharesBought) * currentPriceUsd
      const thbSpentVal = usdSpent * valNum
      setAmountSpentThb(Number(thbSpentVal.toFixed(2)))
    }
  }

  function handlePriceUsdChange(val: number | string | '') {
    setPriceUsd(val)
    if (val === '' || Number(val) <= 0) return
    const valNum = Number(val)
    const currentFxRate = Number(fxRate) || rate
    if (lastFocused === 'thb' && amountSpentThb !== '' && Number(amountSpentThb) > 0) {
      const usdSpent = Number(amountSpentThb) / currentFxRate
      const shares = usdSpent / valNum
      setSharesBought(Number(shares.toFixed(4)))
    } else if (lastFocused === 'shares' && sharesBought !== '' && Number(sharesBought) > 0) {
      const usdSpent = Number(sharesBought) * valNum
      const thbSpentVal = usdSpent * currentFxRate
      setAmountSpentThb(Number(thbSpentVal.toFixed(2)))
    }
  }

  const handleAmountSpentThbBlur = () => {
    if (amountSpentThb !== '') {
      const formatted = Number(Number(amountSpentThb).toFixed(2))
      setAmountSpentThb(formatted)
      const currentFxRate = Number(fxRate) || rate
      const currentPriceUsd = Number(priceUsd) || (holding && rate > 0 ? holding.price / rate : 1)
      if (currentFxRate > 0 && currentPriceUsd > 0) {
        const usdSpent = formatted / currentFxRate
        const shares = usdSpent / currentPriceUsd
        setSharesBought(Number(shares.toFixed(4)))
      }
    }
  }

  const handleSharesBoughtBlur = () => {
    if (sharesBought !== '') {
      const formatted = formatToMaxDecimals(sharesBought, 4)
      setSharesBought(formatted)
      const formattedNum = Number(formatted)
      const currentFxRate = Number(fxRate) || rate
      const currentPriceUsd = Number(priceUsd) || (holding && rate > 0 ? holding.price / rate : 1)
      if (currentFxRate > 0 && currentPriceUsd > 0) {
        const usdSpent = formattedNum * currentPriceUsd
        const thbSpentVal = usdSpent * currentFxRate
        setAmountSpentThb(Number(thbSpentVal.toFixed(2)))
      }
    }
  }

  const handleFxRateBlur = () => {
    if (fxRate !== '') {
      const formatted = formatCostOrFx(fxRate)
      setFxRate(formatted)
      const formattedNum = Number(formatted)
      const currentPriceUsd = Number(priceUsd) || (holding && rate > 0 ? holding.price / rate : 1)
      if (lastFocused === 'thb' && amountSpentThb !== '' && Number(amountSpentThb) > 0) {
        const usdSpent = Number(amountSpentThb) / formattedNum
        const shares = usdSpent / currentPriceUsd
        setSharesBought(Number(shares.toFixed(4)))
      } else if (lastFocused === 'shares' && sharesBought !== '' && Number(sharesBought) > 0) {
        const usdSpent = Number(sharesBought) * currentPriceUsd
        const thbSpentVal = usdSpent * formattedNum
        setAmountSpentThb(Number(thbSpentVal.toFixed(2)))
      }
    }
  }

  const handlePriceUsdBlur = () => {
    if (priceUsd !== '') {
      const formatted = formatCostOrFx(priceUsd)
      setPriceUsd(formatted)
      const formattedNum = Number(formatted)
      const currentFxRate = Number(fxRate) || rate
      if (lastFocused === 'thb' && amountSpentThb !== '' && Number(amountSpentThb) > 0) {
        const usdSpent = Number(amountSpentThb) / currentFxRate
        const shares = usdSpent / formattedNum
        setSharesBought(Number(shares.toFixed(4)))
      } else if (lastFocused === 'shares' && sharesBought !== '' && Number(sharesBought) > 0) {
        const usdSpent = Number(sharesBought) * formattedNum
        const thbSpentVal = usdSpent * currentFxRate
        setAmountSpentThb(Number(thbSpentVal.toFixed(2)))
      }
    }
  }

  // ALL useEffects at top level — no hooks after conditional returns
  useEffect(() => {
    const justOpened = !wasOpen.current && open
    wasOpen.current = open
    if (!justOpened || !holding) return
    setUnits('')
    setShowErrors(false)
    setSatoshi('')
    setThbSpent('')
    setLocationId((holding.btcLocations ?? [])[0]?.id ?? '__new__')
    setNewLocationName('')
    setGoldUnit('grams')
    setGoldGrams('')
    setGoldBaht('')
    setGoldThbSpent('')
    setGoldLocationId((holding.goldLocations ?? [])[0]?.id ?? '__new__')
    setGoldNewLocationName('')
    // Pre-fill price: USD for stocks, THB for funds, not used for BTC
    if (!isBtc) {
      if (isStock && rate > 1) {
        const usdPrice = Number((holding.price / rate).toFixed(4))
        setPrice(usdPrice)
        setFxRate(formatCostOrFx(rate))
        setPriceUsd(formatCostOrFx(usdPrice))
        setAmountSpentThb('')
        setSharesBought('')
        setLastFocused('thb')
      } else {
        setPrice(holding.price)
      }
    }
  }, [open, holding])

  if (!holding) return null

  // ── Gold path ──
  if (isGold) {
    const goldExistingLocations = holding.goldLocations ?? []
    const isNewGoldLoc = goldLocationId === '__new__'
    const goldLocName = isNewGoldLoc
      ? goldNewLocationName.trim()
      : (goldExistingLocations.find((l) => l.id === goldLocationId)?.name ?? '')
    const g = goldUnit === 'baht'
      ? (goldBaht !== '' ? Number(goldBaht) * GRAMS_PER_BAHT_GOLD : 0)
      : Number(goldGrams)
    const spent = Number(goldThbSpent)
    const goldValid =
      g > 0 &&
      goldThbSpent !== '' && spent > 0 &&
      goldLocName.length > 0
    const impliedPrice = g > 0 ? spent / g : 0
    const totalGrams = goldExistingLocations.reduce((s, l) => s + l.grams, 0)
    const totalBaht = totalGrams / GRAMS_PER_BAHT_GOLD

    const goldLocOptions = [
      ...goldExistingLocations.map((l) => ({ value: l.id, label: l.name })),
      { value: '__new__', label: '+ New location…' },
    ]

    function saveGold() {
      if (!goldValid) { setShowErrors(true); return }
      const existingLoc = isNewGoldLoc ? null : goldExistingLocations.find((l) => l.id === goldLocationId)
      let updatedLocations: GoldLocation[]
      if (existingLoc) {
        updatedLocations = upsert(goldExistingLocations, {
          id: existingLoc.id,
          name: existingLoc.name,
          grams: existingLoc.grams + g,
          thbSpent: existingLoc.thbSpent + spent,
        })
        upsertGoldLocation(holding!.id, {
          id: existingLoc.id,
          name: existingLoc.name,
          grams: existingLoc.grams + g,
          thbSpent: existingLoc.thbSpent + spent,
        })
      } else {
        updatedLocations = upsert(goldExistingLocations, { name: goldLocName, grams: g, thbSpent: spent })
        upsertGoldLocation(holding!.id, { name: goldLocName, grams: g, thbSpent: spent })
      }
      const totalGrams = updatedLocations.reduce((s, l) => s + l.grams, 0)
      const totalThb = updatedLocations.reduce((s, l) => s + l.thbSpent, 0)
      const avgCost = totalGrams > 0 ? totalThb / totalGrams : holding!.avgCost
      const afterHoldingState: Holding = {
        ...holding!,
        goldLocations: updatedLocations,
        units: totalGrams,
        totalUnits: totalGrams,
        avgCost,
        totalThbInvested: totalThb,
        avgCostThb: avgCost,
      }
      const bahtAmount = (g / GRAMS_PER_BAHT_GOLD).toFixed(4)
      addHoldingLog({
        action: 'buy_more',
        holdingId: holding!.id,
        holdingName: holding!.name,
        ticker: holding!.ticker,
        assetClass: 'gold',
        note: `+${g.toFixed(4)} g (${bahtAmount} บาททอง) · ฿${spent.toLocaleString()} spent · ${goldLocName}`,
        previousHoldingState: JSON.parse(JSON.stringify(holding!)),
        afterHoldingState,
      })
      showToast(`Bought ${g.toFixed(4)}g (${bahtAmount} บาททอง) gold for ${holding!.name}`, 'success')
      onClose()
    }

    return (
      <Modal
        open={open}
        onClose={onClose}
        title={`Buy more · ${holding.name}`}
        description="Log a purchase in grams or บาททองคำ (ทองคำแท่ง 15.244g). Choose or create a location."
      >
        <div className="space-y-5">
          <div className="rounded-2xl bg-surface-muted px-4 py-3">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-ink-muted">Currently holding</span>
              <span className="font-semibold tnum text-ink">
                {totalGrams.toFixed(2)} g ({totalBaht.toFixed(4)} บาททองคำ)
              </span>
            </div>
          </div>

          <SelectField
            label="Location"
            value={goldLocationId}
            onChange={setGoldLocationId}
            options={goldLocOptions}
          />

          {goldLocationId === '__new__' && (
            <TextField
              label="Location name"
              value={goldNewLocationName}
              onChange={setGoldNewLocationName}
              placeholder="e.g. Home safe, Bank vault, Hua Seng Heng"
              error={showErrors && !goldNewLocationName.trim() ? 'Required' : undefined}
            />
          )}

          {/* Unit selector tab */}
          <div className="space-y-1">
            <label className="text-[13px] font-medium text-ink-soft">Purchase Unit / หน่วยซื้อ</label>
            <div className="flex rounded-xl bg-surface-muted p-1 gap-1">
              <button
                type="button"
                onClick={() => setGoldUnit('grams')}
                className={`flex-1 rounded-lg py-1.5 text-[12px] font-semibold transition-all cursor-pointer ${
                  goldUnit === 'grams'
                    ? 'bg-surface text-ink shadow-sm'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                กรัม (Grams)
              </button>
              <button
                type="button"
                onClick={() => setGoldUnit('baht')}
                className={`flex-1 rounded-lg py-1.5 text-[12px] font-semibold transition-all cursor-pointer ${
                  goldUnit === 'baht'
                    ? 'bg-surface text-ink shadow-sm'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                บาททองคำ (15.244g)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {goldUnit === 'grams' ? (
              <NumberField
                label="Grams bought (กรัม)"
                value={goldGrams}
                error={showErrors && (goldGrams === '' || Number(goldGrams) <= 0) ? 'Required (> 0)' : undefined}
                onChange={(val) => {
                  setGoldGrams(val)
                  if (val !== '' && Number(val) > 0) {
                    setGoldBaht(Number((Number(val) / GRAMS_PER_BAHT_GOLD).toFixed(6)))
                  } else {
                    setGoldBaht('')
                  }
                }}
                placeholder="e.g. 15.244"
                step={0.0001}
              />
            ) : (
              <NumberField
                label="Weight bought in บาททองคำ (ทองคำแท่ง)"
                value={goldBaht}
                error={showErrors && (goldBaht === '' || Number(goldBaht) <= 0) ? 'Required (> 0)' : undefined}
                onChange={(val) => {
                  setGoldBaht(val)
                  if (val !== '' && Number(val) > 0) {
                    setGoldGrams(Number((Number(val) * GRAMS_PER_BAHT_GOLD).toFixed(6)))
                  } else {
                    setGoldGrams('')
                  }
                }}
                placeholder="e.g. 1.0"
                step={0.0001}
              />
            )}
            <NumberField
              label="THB spent (บาท)"
              prefix="฿"
              value={goldThbSpent}
              error={showErrors && (goldThbSpent === '' || Number(goldThbSpent) <= 0) ? 'Required (> 0)' : undefined}
              onChange={setGoldThbSpent}
              placeholder="0"
            />
          </div>

          {g > 0 && spent > 0 && (
            <div
              className="rounded-2xl border px-4 py-3 space-y-1.5"
              style={{
                borderColor: `color-mix(in srgb, ${ASSET_META[holding.assetClass].color} 35%, transparent)`,
                background: `color-mix(in srgb, ${ASSET_META[holding.assetClass].color} 10%, transparent)`,
              }}
            >
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-ink-soft">Implied price / gram</span>
                <span className="font-semibold tnum text-ink">{thb(impliedPrice, true)}</span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-ink-soft">Implied cost / บาททองคำ</span>
                <span className="font-semibold tnum text-brand">{thb(impliedPrice * GRAMS_PER_BAHT_GOLD)}</span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-ink-soft">Gold amount</span>
                <span className="font-semibold tnum text-ink">{g.toFixed(4)} g ({(g / GRAMS_PER_BAHT_GOLD).toFixed(4)} บาททอง)</span>
              </div>
            </div>
          )}

          <div className="pt-3">
            <Button onClick={saveGold} className="w-full">Add to holding</Button>
          </div>
        </div>
      </Modal>
    )
  }

  // ── BTC path ──
  if (isBtc) {
    const isNew = locationId === '__new__'
    const locName = isNew
      ? newLocationName.trim()
      : (existingLocations.find((l) => l.id === locationId)?.name ?? '')
    const btcValid =
      satoshi !== '' && Number(satoshi) > 0 &&
      thbSpent !== '' && Number(thbSpent) > 0 &&
      locName.length > 0
    const sats = Number(satoshi)
    const spent = Number(thbSpent)
    const btcAmount = sats / SATS_PER_BTC
    const impliedPrice = btcAmount > 0 ? spent / btcAmount : 0
    const totalSats = existingLocations.reduce((s, l) => s + l.satoshi, 0)

    const locationOptions = [
      ...existingLocations.map((l) => ({ value: l.id, label: l.name })),
      { value: '__new__', label: '+ New location…' },
    ]

    function saveBtc() {
      if (!btcValid) { setShowErrors(true); return }
      const existingLoc = isNew ? null : existingLocations.find((l) => l.id === locationId)
      let updatedLocations: BtcLocation[]
      if (existingLoc) {
        updatedLocations = upsert(existingLocations, {
          id: existingLoc.id,
          name: existingLoc.name,
          satoshi: existingLoc.satoshi + sats,
          thbSpent: existingLoc.thbSpent + spent,
        })
        upsertBtcLocation(holding!.id, {
          id: existingLoc.id,
          name: existingLoc.name,
          satoshi: existingLoc.satoshi + sats,
          thbSpent: existingLoc.thbSpent + spent,
        })
      } else {
        updatedLocations = upsert(existingLocations, { name: locName, satoshi: sats, thbSpent: spent })
        upsertBtcLocation(holding!.id, { name: locName, satoshi: sats, thbSpent: spent })
      }
      const totalSatsAfter = updatedLocations.reduce((s, l) => s + l.satoshi, 0)
      const totalThb = updatedLocations.reduce((s, l) => s + l.thbSpent, 0)
      const units = totalSatsAfter / 100_000_000
      const avgCost = units > 0 ? totalThb / units : holding!.avgCost
      const afterHoldingState: Holding = {
        ...holding!,
        btcLocations: updatedLocations,
        units,
        totalUnits: units,
        avgCost,
        totalThbInvested: totalThb,
        avgCostThb: avgCost,
      }
      addHoldingLog({
        action: 'buy_more',
        holdingId: holding!.id,
        holdingName: holding!.name,
        ticker: holding!.ticker,
        assetClass: 'crypto',
        note: `+${sats.toLocaleString()} sats · ฿${spent.toLocaleString()} spent · ${locName}`,
        previousHoldingState: JSON.parse(JSON.stringify(holding!)),
        afterHoldingState,
      })
      showToast(`Bought ${sats.toLocaleString()} sats for ${holding!.name}`, 'success')
      onClose()
    }

    return (
      <Modal
        open={open}
        onClose={onClose}
        title={`Buy more · ${holding.name}`}
        description="Log a purchase in Satoshi. Choose or create a location."
      >
        <div className="space-y-5">
          <div className="rounded-2xl bg-surface-muted px-4 py-3">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-ink-muted">Currently holding</span>
              <span className="font-semibold tnum text-ink">
                {totalSats.toLocaleString()} sats ({(totalSats / SATS_PER_BTC).toFixed(8)} BTC)
              </span>
            </div>
          </div>

          <SelectField
            label="Location"
            value={locationId}
            onChange={setLocationId}
            options={locationOptions}
          />

          {locationId === '__new__' && (
            <TextField
              label="Location name"
              value={newLocationName}
              onChange={setNewLocationName}
              placeholder="e.g. Ledger, Binance, Coinbase"
              error={showErrors && !newLocationName.trim() ? 'Required' : undefined}
            />
          )}

          <div className="grid grid-cols-1 gap-3 ">
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

          {satoshi !== '' && Number(satoshi) > 0 && thbSpent !== '' && Number(thbSpent) > 0 && (
            <div
              className="rounded-2xl border px-4 py-3"
              style={{
                borderColor: `color-mix(in srgb, ${ASSET_META[holding.assetClass].color} 35%, transparent)`,
                background: `color-mix(in srgb, ${ASSET_META[holding.assetClass].color} 10%, transparent)`,
              }}
            >
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-ink-soft">Implied price / BTC</span>
                <span className="font-semibold tnum text-ink">
                  {money(impliedPrice / (usdThb && usdThb > 0 ? usdThb : 35), 'USD')} (≈ {thb(impliedPrice)})
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[13px]">
                <span className="text-ink-soft">BTC amount</span>
                <span className="font-semibold tnum text-ink">{btcAmount.toFixed(8)} BTC</span>
              </div>
            </div>
          )}

          <div className="pt-3">
            <Button onClick={saveBtc} className="w-full">Add to holding</Button>
          </div>
        </div>
      </Modal>
    )
  }

  // ── Fund / Stock path ──

  function save() {
    if (isStock) {
      if (!validStock) { setShowErrors(true); return }
      const unitsBoughtNum = Number(sharesBought)
      const priceUsdNum = Number(priceUsd)
      const fxRateNum = Number(fxRate)
      const amountSpentThbNum = Number(amountSpentThb)
      const usdSpentThisTx = unitsBoughtNum * priceUsdNum

      const currentUnits = holding!.units ?? holding!.totalUnits ?? 0
      const currentThbInvested = holding!.totalThbInvested ?? (currentUnits * (holding!.avgCostThb ?? holding!.avgCost ?? 0))
      const currentUsdInvested = holding!.totalUsdInvested ?? (currentUnits * (holding!.avgCostUsd ?? (rate > 0 ? (holding!.avgCost ?? 0) / rate : 0)))

      const newTotalUnits = currentUnits + unitsBoughtNum
      const newTotalThbInvested = currentThbInvested + amountSpentThbNum
      const newTotalUsdInvested = currentUsdInvested + usdSpentThisTx

      const newAvgCostUsd = newTotalUnits > 0 ? newTotalUsdInvested / newTotalUnits : 0
      const newAvgCostThb = newTotalUnits > 0 ? newTotalThbInvested / newTotalUnits : 0

      const next = {
        units: newTotalUnits,
        avgCost: newAvgCostThb,
        price: priceUsdNum * fxRateNum,
        updatedAt: localDateStr(new Date()),
      }

      const extra = {
        totalUnits: newTotalUnits,
        totalThbInvested: newTotalThbInvested,
        totalUsdInvested: newTotalUsdInvested,
        avgCostUsd: newAvgCostUsd,
        avgCostThb: newAvgCostThb,
      }

      const updated = { ...holding!, ...next, ...extra }
      upsertHolding(updated)
      addHoldingLog({
        action: 'buy_more',
        holdingId: holding!.id,
        holdingName: holding!.name,
        ticker: holding!.ticker,
        assetClass: holding!.assetClass,
        note: `+${unitsBoughtNum.toLocaleString(undefined, { maximumFractionDigits: 4 })} shares @ $${priceUsdNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/unit`,
        previousHoldingState: JSON.parse(JSON.stringify(holding!)),
        afterHoldingState: updated,
      })
      showToast(`Bought ${unitsBoughtNum.toLocaleString(undefined, { maximumFractionDigits: 4 })} shares of ${holding!.name}`, 'success')
      onClose()
    } else {
      if (!valid) { setShowErrors(true); return }
      const next = applyBuy(holding!, Number(units), priceInThb)
      const currentUnits = holding!.units ?? holding!.totalUnits ?? 0
      const currentThbInvested = holding!.totalThbInvested ?? (currentUnits * (holding!.avgCostThb ?? holding!.avgCost ?? 0))
      const amountSpentThb = Number(units) * priceInThb
      const newTotalThbInvested = currentThbInvested + amountSpentThb
      const newTotalUnits = next.units

      const extra = {
        totalUnits: newTotalUnits,
        totalThbInvested: newTotalThbInvested,
        avgCostThb: next.avgCost,
      }
      const updated = { ...holding!, ...next, ...extra }
      upsertHolding(updated)
      addHoldingLog({
        action: 'buy_more',
        holdingId: holding!.id,
        holdingName: holding!.name,
        ticker: holding!.ticker,
        assetClass: holding!.assetClass,
        note: `+${Number(units).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${label} @ ฿${Number(price).toLocaleString()}/unit`,
        previousHoldingState: JSON.parse(JSON.stringify(holding!)),
        afterHoldingState: updated,
      })
      showToast(`Bought ${Number(units).toLocaleString(undefined, { maximumFractionDigits: 4 })} units of ${holding!.name}`, 'success')
      onClose()
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Buy more · ${holding.name}`}
      description={
        isStock
          ? usdThb
            ? `Price in USD, converted at ฿${rate.toFixed(2)}/USD.`
            : 'USD/THB rate loading…'
          : 'Log a purchase. Units grow and your average cost is recalculated.'
      }
    >
      <div className="space-y-5">
        {isStock && !usdThb && (
          <div className="rounded-xl bg-warn-soft px-4 py-3 text-[13px] font-medium text-warn">
            USD/THB rate is loading. Please wait before saving to avoid wrong values.
          </div>
        )}
        <div className="rounded-2xl bg-surface-muted px-4 py-3">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-ink-muted">Currently holding</span>
            <span className="font-semibold tnum text-ink">
              {holding.units.toLocaleString(undefined, { maximumFractionDigits: 4 })} {label}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[13px]">
            <span className="text-ink-muted">Avg cost</span>
            <span className="font-semibold tnum text-ink">
              {isStock && rate > 1
                ? `$${(holding.avgCost / rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : thb(holding.avgCost, true)}
            </span>
          </div>
        </div>

        {isStock ? (
          <div className="grid grid-cols-1 gap-3">
            <NumberField
              label="Amount Spent (THB)"
              prefix="฿"
              value={amountSpentThb}
              error={showErrors && (amountSpentThb === '' || Number(amountSpentThb) <= 0) ? 'Required (> 0)' : undefined}
              onChange={handleAmountSpentThbChange}
              onBlur={handleAmountSpentThbBlur}
              placeholder="0"
              allowString
            />
            <NumberField
              label="Applied FX Rate (USD/THB)"
              value={fxRate}
              error={showErrors && (fxRate === '' || Number(fxRate) <= 0) ? 'Required (> 0)' : undefined}
              onChange={handleFxRateChange}
              onBlur={handleFxRateBlur}
              placeholder="e.g. 33.21"
              step={0.01}
              allowString
            />
            <NumberField
              label="Price / unit (USD)"
              prefix="$"
              value={priceUsd}
              error={showErrors && (priceUsd === '' || Number(priceUsd) <= 0) ? 'Required (> 0)' : undefined}
              onChange={handlePriceUsdChange}
              onBlur={handlePriceUsdBlur}
              placeholder="0"
              step={0.01}
              allowString
            />
            <NumberField
              label="Shares Bought"
              value={sharesBought}
              error={showErrors && (sharesBought === '' || Number(sharesBought) <= 0) ? 'Required (> 0)' : undefined}
              onChange={handleSharesBoughtChange}
              onBlur={handleSharesBoughtBlur}
              placeholder="0"
              step={0.0001}
              allowString
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            <NumberField
              label={`${label} bought`}
              value={units}
              error={showErrors && (units === '' || Number(units) <= 0) ? 'Required (> 0)' : undefined}
              onChange={setUnits}
              placeholder="0"
              step={0.0001}
            />
            <NumberField
              label="Price / unit"
              prefix="฿"
              value={price}
              error={showErrors && (price === '' || Number(price) <= 0) ? 'Required (> 0)' : undefined}
              onChange={setPrice}
              placeholder="0"
            />
          </div>
        )}

        {isStock && validStock && (
          <div
            className="rounded-2xl border px-4 py-3 space-y-1.5"
            style={{
              borderColor: `color-mix(in srgb, ${ASSET_META[holding.assetClass].color} 35%, transparent)`,
              background: `color-mix(in srgb, ${ASSET_META[holding.assetClass].color} 10%, transparent)`,
            }}
          >
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-ink-soft">Transaction Cost</span>
              <span className="font-semibold tnum text-ink">
                ฿{amountSpentThbNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                <span className="text-ink-muted">
                  (${ (amountSpentThbNum / fxRateNum).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })
                </span>
              </span>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-ink-soft">Shares Added</span>
              <span className="font-semibold tnum text-ink">+{sharesBoughtNum.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} shares</span>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-ink-soft">New Total Shares</span>
              <span className="font-semibold tnum text-ink">{stockNewTotalUnits.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} shares</span>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-ink-soft">New Total THB Invested</span>
              <span className="font-semibold tnum text-ink">฿{stockNewTotalThbInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        )}

        {!isStock && preview && (
          <div
            className="rounded-2xl border px-4 py-3"
            style={{
              borderColor: `color-mix(in srgb, ${ASSET_META[holding.assetClass].color} 35%, transparent)`,
              background: `color-mix(in srgb, ${ASSET_META[holding.assetClass].color} 10%, transparent)`,
            }}
          >
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-ink-soft">Cost of this buy</span>
              <span className="font-semibold tnum text-ink">{thb(cost)}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[14px]">
              <span className="font-semibold text-ink">New total</span>
              <span className="font-bold tnum text-ink">
                {preview.units.toLocaleString(undefined, { maximumFractionDigits: 4 })} {label}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[12.5px]">
              <span className="text-ink-muted">New avg cost · value</span>
              <span className="tnum text-ink-soft">
                {thb(preview.avgCost, true)}{' '}
                · {thb(holdingMetrics({ ...holding, ...preview }).marketValue)}
              </span>
            </div>
          </div>
        )}

        <div className="pt-3">
          <Button onClick={save} className="w-full" disabled={isStock ? !validStock : !valid}>
            Add to holding
          </Button>
        </div>
      </div>
    </Modal>
  )
}



import { useEffect, useRef, useState } from 'react'
import { Modal } from '../ui/Modal'
import { SegmentedControl } from '../ui/SegmentedControl'
import { NumberField, SelectField } from '../ui/Field'
import { Button } from '../ui/Button'
import { useData } from '../../store/DataContext'
import { useToast } from '../../store/ToastContext'
import { ASSET_META, GRAMS_PER_BAHT_GOLD, holdingMetrics } from '../../lib/calc'
import type { BtcLocation, GoldLocation, Holding } from '../../lib/types'
import { thb, localDateStr } from '../../lib/format'

interface Props {
  open: boolean
  holding: Holding | null
  onClose: () => void
  onSwitchToBuy?: () => void
}

const SATS_PER_BTC = 100_000_000

export function SellHoldingModal({ open, holding, onClose, onSwitchToBuy }: Props) {
  const { sellHolding, data, usdThb } = useData()
  const { showToast } = useToast()

  const isBtc = holding?.assetClass === 'crypto'
  const isGold = holding?.assetClass === 'gold'
  const isStock = holding?.assetClass === 'stock'
  const rate = usdThb && usdThb > 1 ? usdThb : 34

  // Cash Account integration
  const [cashAccountId, setCashAccountId] = useState<string>('none')

  // Shared / Generic State
  const [units, setUnits] = useState<number | ''>('')
  const [price, setPrice] = useState<number | ''>('')
  const [showErrors, setShowErrors] = useState(false)

  // Stock-specific State
  const [stockShares, setStockShares] = useState<number | ''>('')
  const [stockPriceUsd, setStockPriceUsd] = useState<number | ''>('')
  const [stockFxRate, setStockFxRate] = useState<number | ''>('')

  // BTC-specific State
  const [satoshi, setSatoshi] = useState<number | ''>('')
  const [btcLocationId, setBtcLocationId] = useState<string>('')
  const [btcThbProceeds, setBtcThbProceeds] = useState<number | ''>('')

  // Gold-specific State
  const [goldUnit, setGoldUnit] = useState<'grams' | 'baht'>('grams')
  const [goldGrams, setGoldGrams] = useState<number | ''>('')
  const [goldBaht, setGoldBaht] = useState<number | ''>('')
  const [goldLocationId, setGoldLocationId] = useState<string>('')
  const [goldThbProceeds, setGoldThbProceeds] = useState<number | ''>('')

  // Reset when opening
  const wasOpen = useRef(false)
  useEffect(() => {
    if (open && !wasOpen.current && holding) {
      setShowErrors(false)
      setCashAccountId('none')

      // Initial defaults
      if (holding.assetClass === 'stock') {
        setStockShares('')
        const defaultUsdPrice = rate > 0 ? Number((holding.price / rate).toFixed(2)) : 0
        setStockPriceUsd(defaultUsdPrice > 0 ? defaultUsdPrice : '')
        setStockFxRate(rate)
      } else if (holding.assetClass === 'crypto') {
        setSatoshi('')
        setBtcThbProceeds('')
        const locs = holding.btcLocations ?? []
        setBtcLocationId(locs.length > 0 ? locs[0].id : '')
      } else if (holding.assetClass === 'gold') {
        setGoldGrams('')
        setGoldBaht('')
        setGoldThbProceeds('')
        const locs = holding.goldLocations ?? []
        setGoldLocationId(locs.length > 0 ? locs[0].id : '')
      } else {
        setUnits('')
        setPrice(holding.price > 0 ? holding.price : '')
      }
    }
    wasOpen.current = open
  }, [open, holding, rate])

  if (!holding) return null

  const label = holding.assetClass === 'fund' ? 'units' : 'shares'
  const currentUnits = holding.units ?? holding.totalUnits ?? 0
  const currentCostBasis = holding.totalThbInvested ?? (currentUnits * (holding.avgCostThb ?? holding.avgCost ?? 0))
  const avgCostPerUnitThb = currentUnits > 0 ? currentCostBasis / currentUnits : (holding.avgCostThb ?? holding.avgCost ?? 0)

  // Cash Account options
  const cashAccountOptions = [
    { value: 'none', label: 'None · Do not deposit to Cash / ไม่บันทึกเงินสด' },
    ...(data.cashAccounts ?? []).map((c) => ({
      value: c.id,
      label: `${c.name} (${c.currency === 'USD' ? '$' : '฿'}${c.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`,
    })),
  ]

  // Quick percent applicator
  const applyPercent = (pct: number) => {
    if (isBtc) {
      const loc = (holding.btcLocations ?? []).find((l) => l.id === btcLocationId)
      const availableSats = loc ? loc.satoshi : Math.round(currentUnits * SATS_PER_BTC)
      const targetSats = Math.round(availableSats * (pct / 100))
      setSatoshi(targetSats > 0 ? targetSats : '')
      // Estimated proceeds from current price
      if (holding.price > 0) {
        const estBtc = targetSats / SATS_PER_BTC
        setBtcThbProceeds(Math.round(estBtc * holding.price))
      }
    } else if (isGold) {
      const loc = (holding.goldLocations ?? []).find((l) => l.id === goldLocationId)
      const availableGrams = loc ? loc.grams : currentUnits
      const targetGrams = Number((availableGrams * (pct / 100)).toFixed(4))
      setGoldGrams(targetGrams > 0 ? targetGrams : '')
      setGoldBaht(targetGrams > 0 ? Number((targetGrams / GRAMS_PER_BAHT_GOLD).toFixed(4)) : '')
      if (holding.price > 0) {
        setGoldThbProceeds(Math.round(targetGrams * holding.price))
      }
    } else if (isStock) {
      const targetShares = pct === 100 ? currentUnits : Number((currentUnits * (pct / 100)).toFixed(4))
      setStockShares(targetShares > 0 ? targetShares : '')
    } else {
      const targetUnits = pct === 100 ? currentUnits : Number((currentUnits * (pct / 100)).toFixed(4))
      setUnits(targetUnits > 0 ? targetUnits : '')
    }
  }

  // Calculate sell outcomes per asset type
  let sellUnitsCount = 0
  let totalProceedsThb = 0
  let costBasisSoldThb = 0
  let isValid = false

  if (isStock) {
    const sShares = Number(stockShares) || 0
    const sPriceUsd = Number(stockPriceUsd) || 0
    const sFx = Number(stockFxRate) || rate
    sellUnitsCount = sShares
    const proceedsUsd = sShares * sPriceUsd
    totalProceedsThb = proceedsUsd * sFx
    costBasisSoldThb = sShares * avgCostPerUnitThb
    isValid = sShares > 0 && sShares <= currentUnits + 0.0001 && sPriceUsd > 0 && sFx > 0
  } else if (isBtc) {
    const loc = (holding.btcLocations ?? []).find((l) => l.id === btcLocationId)
    const availableSats = loc ? loc.satoshi : Math.round(currentUnits * SATS_PER_BTC)
    const sSats = Number(satoshi) || 0
    sellUnitsCount = sSats / SATS_PER_BTC
    totalProceedsThb = Number(btcThbProceeds) || 0
    const locCostBasis = loc ? (loc.satoshi > 0 ? (loc.thbSpent / loc.satoshi) * sSats : 0) : sSats * (avgCostPerUnitThb / SATS_PER_BTC)
    costBasisSoldThb = locCostBasis
    isValid = sSats > 0 && sSats <= availableSats && totalProceedsThb > 0
  } else if (isGold) {
    const loc = (holding.goldLocations ?? []).find((l) => l.id === goldLocationId)
    const availableGrams = loc ? loc.grams : currentUnits
    const sGrams = Number(goldGrams) || 0
    sellUnitsCount = sGrams
    totalProceedsThb = Number(goldThbProceeds) || 0
    const locCostBasis = loc ? (loc.grams > 0 ? (loc.thbSpent / loc.grams) * sGrams : 0) : sGrams * avgCostPerUnitThb
    costBasisSoldThb = locCostBasis
    isValid = sGrams > 0 && sGrams <= availableGrams + 0.0001 && totalProceedsThb > 0
  } else {
    const u = Number(units) || 0
    const p = Number(price) || 0
    sellUnitsCount = u
    totalProceedsThb = u * p
    costBasisSoldThb = u * avgCostPerUnitThb
    isValid = u > 0 && u <= currentUnits + 0.0001 && p > 0
  }

  const realizedPnL = totalProceedsThb - costBasisSoldThb
  const realizedPnLPercent = costBasisSoldThb > 0 ? (realizedPnL / costBasisSoldThb) * 100 : 0
  const remainingUnits = Math.max(0, currentUnits - sellUnitsCount)
  const isFullSell = remainingUnits <= 0.00001

  // Handle Save Sell
  const handleSave = () => {
    if (!isValid) {
      setShowErrors(true)
      return
    }

    let remainingHolding: Holding | null = null
    const chosenCashAccount = cashAccountId !== 'none' ? data.cashAccounts.find((c) => c.id === cashAccountId) : undefined
    const cashNoteSuffix = chosenCashAccount ? ` · Deposited to ${chosenCashAccount.name}` : ''

    let note = ''
    let soldPriceDisplay = 0

    if (isStock) {
      const sShares = Number(stockShares)
      const sPriceUsd = Number(stockPriceUsd)
      const sFx = Number(stockFxRate) || rate
      soldPriceDisplay = sPriceUsd * sFx

      if (!isFullSell) {
        const remainingCostBasis = Math.max(0, currentCostBasis - costBasisSoldThb)
        remainingHolding = {
          ...holding,
          units: remainingUnits,
          totalUnits: remainingUnits,
          totalThbInvested: remainingCostBasis,
          totalUsdInvested: holding.totalUsdInvested ? Math.max(0, holding.totalUsdInvested - (sShares * (holding.avgCostUsd ?? 0))) : undefined,
          price: sPriceUsd * sFx,
          updatedAt: localDateStr(new Date()),
        }
      }

      const pnlSign = realizedPnL >= 0 ? '+' : ''
      note = `Sold ${sShares.toLocaleString(undefined, { maximumFractionDigits: 4 })} shares @ $${sPriceUsd.toFixed(2)} (FX ${sFx.toFixed(2)}) · Proceeds: ฿${totalProceedsThb.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · Realized PnL: ${pnlSign}฿${realizedPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${pnlSign}${realizedPnLPercent.toFixed(1)}%)${cashNoteSuffix}`
    } else if (isBtc) {
      const sSats = Number(satoshi)
      const loc = (holding.btcLocations ?? []).find((l) => l.id === btcLocationId)
      const locName = loc ? loc.name : 'Wallet'
      soldPriceDisplay = sellUnitsCount > 0 ? totalProceedsThb / sellUnitsCount : holding.price

      if (!isFullSell) {
        let updatedLocs: BtcLocation[] = []
        if (loc) {
          updatedLocs = (holding.btcLocations ?? []).map((l) => {
            if (l.id !== loc.id) return l
            const remSats = Math.max(0, l.satoshi - sSats)
            const remSpent = Math.max(0, l.thbSpent - costBasisSoldThb)
            return { ...l, satoshi: remSats, thbSpent: remSpent }
          }).filter((l) => l.satoshi > 0)
        }
        const totalSatsAfter = updatedLocs.reduce((s, l) => s + l.satoshi, 0)
        const totalThbAfter = updatedLocs.reduce((s, l) => s + l.thbSpent, 0)
        const u = totalSatsAfter / SATS_PER_BTC
        const avg = u > 0 ? totalThbAfter / u : holding.avgCost

        remainingHolding = {
          ...holding,
          btcLocations: updatedLocs,
          units: u,
          totalUnits: u,
          totalThbInvested: totalThbAfter,
          avgCost: avg,
          avgCostThb: avg,
          price: soldPriceDisplay,
          updatedAt: localDateStr(new Date()),
        }
      }

      const pnlSign = realizedPnL >= 0 ? '+' : ''
      note = `Sold ${sSats.toLocaleString()} sats from ${locName} · Proceeds: ฿${totalProceedsThb.toLocaleString()} · Realized PnL: ${pnlSign}฿${realizedPnL.toLocaleString()} (${pnlSign}${realizedPnLPercent.toFixed(1)}%)${cashNoteSuffix}`
    } else if (isGold) {
      const sGrams = Number(goldGrams)
      const sBaht = Number((sGrams / GRAMS_PER_BAHT_GOLD).toFixed(4))
      const loc = (holding.goldLocations ?? []).find((l) => l.id === goldLocationId)
      const locName = loc ? loc.name : 'Location'
      soldPriceDisplay = sGrams > 0 ? totalProceedsThb / sGrams : holding.price

      if (!isFullSell) {
        let updatedLocs: GoldLocation[] = []
        if (loc) {
          updatedLocs = (holding.goldLocations ?? []).map((l) => {
            if (l.id !== loc.id) return l
            const remGrams = Math.max(0, l.grams - sGrams)
            const remSpent = Math.max(0, l.thbSpent - costBasisSoldThb)
            return { ...l, grams: remGrams, thbSpent: remSpent }
          }).filter((l) => l.grams > 0)
        }
        const totalGramsAfter = updatedLocs.reduce((s, l) => s + l.grams, 0)
        const totalThbAfter = updatedLocs.reduce((s, l) => s + l.thbSpent, 0)
        const avg = totalGramsAfter > 0 ? totalThbAfter / totalGramsAfter : holding.avgCost

        remainingHolding = {
          ...holding,
          goldLocations: updatedLocs,
          units: totalGramsAfter,
          totalUnits: totalGramsAfter,
          totalThbInvested: totalThbAfter,
          avgCost: avg,
          avgCostThb: avg,
          price: soldPriceDisplay,
          updatedAt: localDateStr(new Date()),
        }
      }

      const pnlSign = realizedPnL >= 0 ? '+' : ''
      note = `Sold ${sGrams.toFixed(4)} g (${sBaht.toFixed(4)} บาททอง) from ${locName} · Proceeds: ฿${totalProceedsThb.toLocaleString()} · Realized PnL: ${pnlSign}฿${realizedPnL.toLocaleString()} (${pnlSign}${realizedPnLPercent.toFixed(1)}%)${cashNoteSuffix}`
    } else {
      const u = Number(units)
      const p = Number(price)
      soldPriceDisplay = p

      if (!isFullSell) {
        const remainingCostBasis = Math.max(0, currentCostBasis - costBasisSoldThb)
        remainingHolding = {
          ...holding,
          units: remainingUnits,
          totalUnits: remainingUnits,
          totalThbInvested: remainingCostBasis,
          price: p,
          updatedAt: localDateStr(new Date()),
        }
      }

      const pnlSign = realizedPnL >= 0 ? '+' : ''
      note = `Sold ${u.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${label} @ ฿${p.toLocaleString()} · Proceeds: ฿${totalProceedsThb.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · Realized PnL: ${pnlSign}฿${realizedPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${pnlSign}${realizedPnLPercent.toFixed(1)}%)${cashNoteSuffix}`
    }

    sellHolding({
      holdingId: holding.id,
      soldUnits: sellUnitsCount,
      soldPrice: soldPriceDisplay,
      proceeds: totalProceedsThb,
      realizedPnL,
      realizedPnLPercent,
      remainingHolding,
      cashAccountId: cashAccountId !== 'none' ? cashAccountId : undefined,
      cashDepositAmount: cashAccountId !== 'none' ? totalProceedsThb : undefined,
      note,
    })

    const pnlBadge = `${realizedPnL >= 0 ? '+' : ''}฿${Math.round(realizedPnL).toLocaleString()}`
    showToast(`Sold ${holding.name} (Realized PnL: ${pnlBadge})`, realizedPnL >= 0 ? 'success' : 'info')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Sell · ${holding.name}`}
      description="Record a sale. Calculates Realized Gain/Loss and optionally deposits proceeds to your Cash wallet."
      footer={
        <Button
          variant="danger"
          onClick={handleSave}
          className="w-full"
          disabled={!isValid}
        >
          {isFullSell ? 'Confirm Sell All & Close Position' : 'Confirm Sale'}
        </Button>
      }
    >
      <div className="space-y-4">
        {onSwitchToBuy && (
          <div className="mb-2">
            <SegmentedControl
              value="sell"
              onChange={(val) => {
                if (val === 'buy') onSwitchToBuy()
              }}
              options={[
                { value: 'buy', label: '+ ซื้อเพิ่ม (Buy)' },
                { value: 'sell', label: '− ขายออก (Sell)' },
              ]}
            />
          </div>
        )}
        {/* Context: Current holding */}
        <div className="rounded-2xl bg-surface-muted px-4 py-3">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-ink-muted">Currently holding</span>
            <span className="font-semibold tnum text-ink">
              {isBtc
                ? `${Math.round(currentUnits * SATS_PER_BTC).toLocaleString()} sats (${currentUnits.toFixed(8)} BTC)`
                : isGold
                ? `${currentUnits.toFixed(4)} g (${(currentUnits / GRAMS_PER_BAHT_GOLD).toFixed(4)} บาททอง)`
                : `${currentUnits.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${label}`}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[12.5px]">
            <span className="text-ink-muted">Avg Cost · Market Value</span>
            <span className="font-medium tnum text-ink-soft">
              {isStock && rate > 1
                ? `$${(holding.avgCost / rate).toFixed(2)} ($${(holding.price / rate).toFixed(2)}/sh)`
                : `${thb(holding.avgCost, true)}`}
              {' · '}
              {thb(holdingMetrics(holding).marketValue)}
            </span>
          </div>
        </div>

        {/* Quick Percent Selectors */}
        <div className="space-y-1.5">
          <label className="text-[12px] font-semibold uppercase tracking-wider text-ink-muted">
            Quick Select
          </label>
          <div className="grid grid-cols-4 gap-2">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => applyPercent(pct)}
                className="rounded-xl border border-line py-1.5 text-[12.5px] font-bold text-ink hover:bg-surface-muted active:scale-95 transition-all cursor-pointer"
              >
                {pct === 100 ? '100% (All)' : `${pct}%`}
              </button>
            ))}
          </div>
        </div>

        {/* Inputs per Asset Class */}
        {isStock ? (
          <div className="grid grid-cols-1 gap-3">
            <NumberField
              label="Shares to sell"
              value={stockShares}
              error={
                showErrors && (stockShares === '' || Number(stockShares) <= 0 || Number(stockShares) > currentUnits + 0.0001)
                  ? `Enter 0 < shares ≤ ${currentUnits.toLocaleString()}`
                  : undefined
              }
              onChange={(val) => setStockShares(val === '' ? '' : Number(val))}
              placeholder="0"
              step={0.0001}
            />
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label="Sell price (USD)"
                prefix="$"
                value={stockPriceUsd}
                error={showErrors && (stockPriceUsd === '' || Number(stockPriceUsd) <= 0) ? 'Required (> 0)' : undefined}
                onChange={(val) => setStockPriceUsd(val === '' ? '' : Number(val))}
                placeholder="0.00"
                step={0.01}
              />
              <NumberField
                label="FX Rate (USD/THB)"
                value={stockFxRate}
                error={showErrors && (stockFxRate === '' || Number(stockFxRate) <= 0) ? 'Required' : undefined}
                onChange={(val) => setStockFxRate(val === '' ? '' : Number(val))}
                placeholder="34.00"
                step={0.01}
              />
            </div>
          </div>
        ) : isBtc ? (
          <div className="grid grid-cols-1 gap-3">
            {(holding.btcLocations ?? []).length > 0 && (
              <SelectField
                label="Sell from Location"
                value={btcLocationId}
                onChange={setBtcLocationId}
                options={(holding.btcLocations ?? []).map((l) => ({
                  value: l.id,
                  label: `${l.name} (${l.satoshi.toLocaleString()} sats · ฿${l.thbSpent.toLocaleString()})`,
                }))}
              />
            )}
            <NumberField
              label="Satoshi to sell"
              value={satoshi}
              error={
                showErrors && (satoshi === '' || Number(satoshi) <= 0)
                  ? 'Required (> 0)'
                  : undefined
              }
              onChange={(val) => {
                setSatoshi(val === '' ? '' : Number(val))
                if (val !== '' && Number(val) > 0 && holding.price > 0) {
                  setBtcThbProceeds(Math.round((Number(val) / SATS_PER_BTC) * holding.price))
                }
              }}
              placeholder="e.g. 500000"
            />
            <NumberField
              label="THB proceeds received (เงินบาทที่ได้รับ)"
              prefix="฿"
              value={btcThbProceeds}
              error={showErrors && (btcThbProceeds === '' || Number(btcThbProceeds) <= 0) ? 'Required' : undefined}
              onChange={(val) => setBtcThbProceeds(val === '' ? '' : Number(val))}
              placeholder="0"
            />
          </div>
        ) : isGold ? (
          <div className="grid grid-cols-1 gap-3">
            {(holding.goldLocations ?? []).length > 0 && (
              <SelectField
                label="Sell from Location"
                value={goldLocationId}
                onChange={setGoldLocationId}
                options={(holding.goldLocations ?? []).map((l) => ({
                  value: l.id,
                  label: `${l.name} (${l.grams.toFixed(4)}g · ฿${l.thbSpent.toLocaleString()})`,
                }))}
              />
            )}
            <div className="space-y-1">
              <label className="text-[13px] font-medium text-ink-soft">Sale Unit / หน่วยขาย</label>
              <SegmentedControl
                size="sm"
                value={goldUnit}
                onChange={setGoldUnit}
                options={[
                  { value: 'grams', label: 'กรัม (Grams)' },
                  { value: 'baht', label: 'บาททองคำ' },
                ]}
              />
            </div>
            {goldUnit === 'grams' ? (
              <NumberField
                label="Grams to sell (กรัม)"
                value={goldGrams}
                error={showErrors && (goldGrams === '' || Number(goldGrams) <= 0) ? 'Required' : undefined}
                onChange={(val) => {
                  const num = val === '' ? '' : Number(val)
                  setGoldGrams(num)
                  if (num !== '' && num > 0) {
                    setGoldBaht(Number((num / GRAMS_PER_BAHT_GOLD).toFixed(4)))
                    if (holding.price > 0) setGoldThbProceeds(Math.round(num * holding.price))
                  } else {
                    setGoldBaht('')
                  }
                }}
                step={0.0001}
                placeholder="e.g. 15.244"
              />
            ) : (
              <NumberField
                label="Weight to sell in บาททองคำ"
                value={goldBaht}
                error={showErrors && (goldBaht === '' || Number(goldBaht) <= 0) ? 'Required' : undefined}
                onChange={(val) => {
                  const num = val === '' ? '' : Number(val)
                  setGoldBaht(num)
                  if (num !== '' && num > 0) {
                    const g = Number((num * GRAMS_PER_BAHT_GOLD).toFixed(4))
                    setGoldGrams(g)
                    if (holding.price > 0) setGoldThbProceeds(Math.round(g * holding.price))
                  } else {
                    setGoldGrams('')
                  }
                }}
                step={0.0001}
                placeholder="e.g. 1.0"
              />
            )}
            <NumberField
              label="THB proceeds received (เงินบาทที่ได้รับ)"
              prefix="฿"
              value={goldThbProceeds}
              error={showErrors && (goldThbProceeds === '' || Number(goldThbProceeds) <= 0) ? 'Required' : undefined}
              onChange={(val) => setGoldThbProceeds(val === '' ? '' : Number(val))}
              placeholder="0"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            <NumberField
              label={`${label} to sell`}
              value={units}
              error={
                showErrors && (units === '' || Number(units) <= 0 || Number(units) > currentUnits + 0.0001)
                  ? `Enter 0 < units ≤ ${currentUnits.toLocaleString()}`
                  : undefined
              }
              onChange={(val) => setUnits(val === '' ? '' : Number(val))}
              placeholder="0"
              step={0.0001}
            />
            <NumberField
              label="Sell price / unit"
              prefix="฿"
              value={price}
              error={showErrors && (price === '' || Number(price) <= 0) ? 'Required (> 0)' : undefined}
              onChange={(val) => setPrice(val === '' ? '' : Number(val))}
              placeholder="0"
            />
          </div>
        )}

        {/* Cash Deposit Selection */}
        <div className="pt-1">
          <SelectField
            label="Deposit proceeds to Cash (นำเงินเข้ากระเป๋าเงินสด)"
            value={cashAccountId}
            onChange={setCashAccountId}
            options={cashAccountOptions}
          />
        </div>

        {/* Live Preview Card */}
        {sellUnitsCount > 0 && totalProceedsThb > 0 && (
          <div
            className="rounded-2xl border px-4 py-3 space-y-2"
            style={{
              borderColor: `color-mix(in srgb, ${ASSET_META[holding.assetClass].color} 35%, transparent)`,
              background: `color-mix(in srgb, ${ASSET_META[holding.assetClass].color} 8%, transparent)`,
            }}
          >
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-ink-soft">Total Proceeds (เงินที่จะได้รับ)</span>
              <span className="font-bold tnum text-ink">{thb(totalProceedsThb)}</span>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-ink-soft">Cost Basis Sold (ต้นทุนของส่วนที่ขาย)</span>
              <span className="font-medium tnum text-ink-muted">{thb(costBasisSoldThb)}</span>
            </div>
            <div className="flex items-center justify-between text-[13px] border-t border-line/60 pt-1.5">
              <span className="font-semibold text-ink">Realized Gain / Loss (กำไร-ขาดทุน)</span>
              <span
                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px] font-bold tnum ${
                  realizedPnL >= 0
                    ? 'bg-gain/15 text-gain border border-gain/20'
                    : 'bg-loss/15 text-loss border border-loss/20'
                }`}
              >
                {realizedPnL >= 0 ? '+' : ''}
                {thb(realizedPnL)} ({realizedPnL >= 0 ? '+' : ''}
                {realizedPnLPercent.toFixed(1)}%)
              </span>
            </div>
            <div className="flex items-center justify-between text-[12.5px] text-ink-muted pt-0.5">
              <span>Remaining After Sale</span>
              <span className="font-medium tnum">
                {isFullSell ? (
                  <span className="text-rose-600 dark:text-rose-400 font-semibold">
                    0 {label} (Will remove from portfolio)
                  </span>
                ) : (
                  `${remainingUnits.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${label}`
                )}
              </span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

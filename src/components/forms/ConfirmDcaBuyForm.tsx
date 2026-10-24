import { useEffect, useRef, useState } from 'react'
import { Modal } from '../ui/Modal'
import { SegmentedControl } from '../ui/SegmentedControl'
import { NumberField, SelectField, TextField } from '../ui/Field'
import { Button } from '../ui/Button'
import { useData } from '../../store/DataContext'
import { useToast, type ResultDetail } from '../../store/ToastContext'
import type { DcaPlan } from '../../lib/types'
import { localDateStr, thb } from '../../lib/format'
import { isValidRate } from '../../lib/fx'
import { findMatchingHolding, GRAMS_PER_BAHT_GOLD, hasRealPrice, nextBuyDate, priceGap } from '../../lib/calc'
import { fetchStockPricesUsd } from '../../lib/prices'
import { BuyPreview } from './BuyPreview'

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
  const { data, confirmDcaBuy, undoDcaBuy, usdThb } = useData()
  const { showToast, showResult, hideResult } = useToast()

  // Target Holding state
  const [targetHoldingId, setTargetHoldingId] = useState<string>('')

  // Shared Amount Spent THB (editable for ALL asset classes)
  const [amountSpentThb, setAmountSpentThb] = useState<number | ''>('')

  // US Stock specific state
  const [fxRate, setFxRate] = useState<number | ''>('')
  const [unitsBought, setUnitsBought] = useState<number | ''>('')
  const [liveStockPrice, setLiveStockPrice] = useState<number | null>(null)
  const [showFxEdit, setShowFxEdit] = useState(false)

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

  // Cash account this buy is paid from ('' = not tracked)
  const [payFromId, setPayFromId] = useState('')

  const [showErrors, setShowErrors] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const wasOpen = useRef(false)
  const SATS_PER_BTC = 100_000_000

  // Target holding resolution: find matching holding or fall back to targetHoldingId
  const matchedHolding = plan ? findMatchingHolding(data.holdings, plan) : null
  const holding = (targetHoldingId && targetHoldingId !== '__new__')
    ? (data.holdings.find((h) => h.id === targetHoldingId) ?? matchedHolding)
    : (targetHoldingId === '__new__' ? null : matchedHolding)

  const assetClass = plan?.assetClass ?? holding?.assetClass
  const isCash  = assetClass === 'cash' || !!plan?.cashAccountId
  const isStock = !isCash && assetClass === 'stock'
  const isCrypto = !isCash && assetClass === 'crypto'
  const isBtc   = isCrypto && (
    (holding?.ticker ?? plan?.ticker ?? '').toUpperCase() === 'BTC' ||
    (holding?.name ?? plan?.name ?? '').toLowerCase().includes('bitcoin')
  )
  const isGold  = !isCash && assetClass === 'gold'
  const isFund  = !isCash && assetClass === 'fund'
  // The real USD/THB rate, or 0 when none has loaded: then the FX field starts empty and must be filled in
  const rate = isValidRate(usdThb) ? usdThb : 0
  const btcLocations = holding?.btcLocations ?? []
  const goldLocations = holding?.goldLocations ?? []

  const targetCashAccount = plan?.cashAccountId
    ? data.cashAccounts.find((a) => a.id === plan.cashAccountId)
    : data.cashAccounts.find((a) => a.name.toLowerCase() === plan?.name.toLowerCase())

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
    setPayFromId(plan.payFromAccountId && data.cashAccounts.some((a) => a.id === plan.payFromAccountId) ? plan.payFromAccountId : '')

    // US Stock initialization
    setFxRate(rate > 0 ? rate : '')
    setUnitsBought('')
    setLiveStockPrice(null)
    setShowFxEdit(false)

    if (plan.assetClass === 'stock') {
      const ticker = initialMatched?.ticker || plan.ticker || plan.name
      if (ticker) {
        fetchStockPricesUsd([ticker])
          .then((prices) => {
            const p = prices[ticker.toUpperCase()]
            if (p && p > 0) {
              setLiveStockPrice(p)
            }
          })
          .catch((err) => console.warn('Could not fetch stock price in DCA confirm modal:', err))
      }
    }

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

  const logName = isCash ? (targetCashAccount?.name ?? plan.name) : (holding?.name ?? plan.name)
  const targetSubtitleText = isCash
    ? (targetCashAccount?.name ?? plan.name)
    : (isBtc || isGold)
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

  const stockNewTotalUnits = stockCurrentUnits + stockUnitsBoughtNum
  const stockNewTotalThbInvested = stockCurrentThbInvested + amountThbNum

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
  const cryptoPricePerUnit = holding?.price ?? holding?.avgCost ?? 0
  const cryptoUnitsToAdd = cryptoPricePerUnit > 0 ? amountThbNum / cryptoPricePerUnit : 0
  const cryptoCurrentUnits = holding?.units ?? holding?.totalUnits ?? 0
  const cryptoTicker = holding?.ticker ?? plan.ticker ?? 'units'

  // --------------------------------------------------------------------------
  // Typo check: this buy's price against the latest market price (THB per unit)
  // --------------------------------------------------------------------------
  const marketPrice = holding && hasRealPrice(holding) && holding.price > 0 ? holding.price : null
  const stockMarketThb = liveStockPrice && fxRateNum > 0 ? liveStockPrice * fxRateNum : marketPrice

  /** "฿108,519 / BTC is 90% below the market price (฿3,400,000). Check the sats?" */
  function gapWarning(paid: number, market: number | null, unit: string, field: string): string | undefined {
    const gap = priceGap(paid, market)
    if (gap === null || market === null) return undefined
    return `${thb(paid)} ${unit} is ${Math.round(Math.abs(gap) * 100)}% ${gap < 0 ? 'below' : 'above'} the market price (${thb(market)}). Check the ${field}?`
  }

  const valid = isStock
    ? stockUnitsBoughtNum > 0 && amountThbNum > 0 && fxRateNum > 0
    : isFund
    ? fundUnitsNum > 0 && amountThbNum > 0
    : isGold
    ? goldGramsToAdd > 0 && amountThbNum > 0
    : isBtc
    ? satsNum > 0 && amountThbNum > 0
    : isCrypto
    ? cryptoUnitsToAdd > 0 && amountThbNum > 0
    : amountThbNum > 0

  const payFrom = data.cashAccounts.find((a) => a.id === payFromId)

  const locValid = !(isBtc || isGold) ||
    (selectedLocId !== '__new__') ||
    (newLocName.trim().length > 0)

  // Paint the spinner first, then apply the buy — instant feedback and no double-confirm
  function confirm() {
    if (submitting) return
    if (!valid || !locValid) { setShowErrors(true); return }
    setSubmitting(true)
    showResult({
      status: 'loading',
      title: isCash ? 'Adding your deposit…' : 'Recording your buy…',
      message: plan?.name,
    })
    requestAnimationFrame(() => {
      window.setTimeout(() => {
        try {
          applyConfirm()
        } catch (err) {
          console.error('Confirm DCA buy failed:', err)
          showResult({
            status: 'error',
            title: 'Could not save this buy',
            message: 'Nothing was changed. Please try again.',
          })
        } finally {
          setSubmitting(false)
          // If nothing replaced the working popup (e.g. no plan), close it
          hideResult(true)
        }
      }, 0)
    })
  }

  /** The popup after logging: the amount leads, then what it bought, where the money went, and the next one */
  function boughtDetail(p: DcaPlan): ResultDetail {
    const qty = isCash
      ? undefined
      : isStock
      ? `${fmtNum(stockUnitsBoughtNum)} shares`
      : isFund
      ? `${fmtNum(fundUnitsNum)} units`
      : isGold
      ? `${fmtNum(goldGramsToAdd, 2)} g`
      : isBtc
      ? `${satsNum.toLocaleString()} sats`
      : `${fmtNum(cryptoUnitsToAdd)} ${holding?.ticker ?? p.ticker ?? 'units'}`
    const next = nextBuyDate(p).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    const name = isCash ? (targetCashAccount?.name ?? p.name) : (holding?.name ?? p.name)
    // Where the money went, so the Spend ↔ Invest link is visible: "KBank Savings → ColdCard"
    const into = isBtc || isGold ? resolvedLocationName : name
    return {
      amount: thb(amountThbNum),
      name: [name, qty].filter(Boolean).join(' · '),
      meta: payFrom ? `${payFrom.name} → ${into}` : `into ${into}`,
      footnote: `${isCash ? 'Next deposit' : 'Next buy'} ${next}`,
    }
  }

  function applyConfirm() {
    if (!plan) return
    const p = plan
    const today = localDateStr()
    const payment = payFromId && amountThbNum > 0 ? { accountId: payFromId, amount: amountThbNum } : undefined

    const resolvedTargetId = targetHoldingId !== '__new__' ? (holding?.id ?? targetHoldingId) : undefined
    const undo = {
      label: 'Undo',
      onClick: () => {
        undoDcaBuy(p.id, today)
        showToast(`Removed the ${thb(amountThbNum)} ${isCash ? 'deposit' : 'buy'}`, 'info')
      },
    }

    if (isCash) {
      confirmDcaBuy(
        p.id,
        amountThbNum,
        today,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        payment,
      )
      showToast(`Added ${thb(amountThbNum)} to ${targetCashAccount?.name || p.name}`, 'success', undo, { popup: true, title: 'Logged', detail: boughtDetail(p) })
      onClose()
      return
    }

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
        undefined,
        undefined,
        payment,
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
        undefined,
        undefined,
        payment,
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
        payment,
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
        undefined,
        payment,
      )
    } else if (isCrypto) {
      confirmDcaBuy(
        p.id,
        cryptoPricePerUnit,
        today,
        cryptoUnitsToAdd,
        cryptoPricePerUnit,
        cryptoPricePerUnit,
        undefined,
        undefined,
        undefined,
        undefined,
        resolvedTargetId,
        undefined,
        undefined,
        payment,
      )
    } else {
      confirmDcaBuy(
        p.id,
        0,
        today,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        resolvedTargetId,
        undefined,
        undefined,
        payment,
      )
    }

    showToast(`Your DCA buy for ${holding?.name ?? plan.name} is logged.`, 'success', undo, { popup: true, title: 'Logged', detail: boughtDetail(p) })
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isCash ? 'Log deposit' : 'Log buy'}
      description={`${logName}${targetSubtitleText !== logName ? ` · into "${targetSubtitleText}"` : ''} · ${
        isCash ? 'log it after you move the money.' : "Spendiary doesn't trade for you; log it after you buy at your broker."
      }`}
      footer={
        <Button data-modal-submit onClick={confirm} loading={submitting} className="w-full">
          {submitting ? 'Saving…' : `Log ${amountThbNum > 0 ? `${thb(amountThbNum)} ` : ''}${isCash ? 'deposit' : 'buy'}`}
        </Button>
      }
    >
      <div className="space-y-4">
        {data.holdings.length > 0 && !isCash && (
          <SelectField
            label="Target holding in portfolio"
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
        {/* 0. Cash / Savings Deposit Form */}
        {/* ------------------------------------------------------------------ */}
        {isCash && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-surface-muted p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink-muted">Destination account</span>
                <span className="text-sm font-bold text-ink">{targetCashAccount?.name || plan.name}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink-muted">Current balance</span>
                <span className="font-display font-semibold text-ink tnum">
                  {targetCashAccount?.currency === 'USD' ? '$' : '฿'}
                  {(targetCashAccount?.balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs border-t border-line/40 pt-2">
                <span className="text-cash font-semibold">New balance after deposit</span>
                <span className="font-display font-extrabold text-cash tnum">
                  {targetCashAccount?.currency === 'USD' ? '$' : '฿'}
                  {((targetCashAccount?.balance ?? 0) + (typeof amountSpentThb === 'number' ? amountSpentThb : 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <NumberField
              label="Deposit amount (THB)"
              prefix="฿"
              value={amountSpentThb}
              onChange={setAmountSpentThb}
              placeholder="5,000"
              error={showErrors && amountThbNum <= 0 ? 'Required (> 0)' : undefined}
            />
          </div>
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

            <BuyPreview
              paid={thb(amountThbNum)}
              got={hasValidFund ? `${fmtNum(fundUnitsNum, 4)} units` : undefined}
              total={`${fmtNum(hasValidFund ? fundNewTotalUnits : fundCurrentUnits, 4)} units`}
              warning={hasValidFund ? gapWarning(fundImpliedNav, marketPrice, '/ unit', 'units') : undefined}
              details={[
                { label: 'NAV this buy', value: hasValidFund ? `฿${fmtNum(fundImpliedNav, 4)} / unit` : '—' },
                { label: 'Average cost', value: hasValidFund ? `฿${fmtNum(fundNewAvgCostThb, 4)} / unit` : fundCurrentUnits > 0 ? `฿${fmtNum(fundCurrentThbInvested / fundCurrentUnits, 4)} / unit` : '—' },
                { label: 'Total put in', value: thb(hasValidFund ? fundNewTotalThbInvested : fundCurrentThbInvested) },
              ]}
            />
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* 2. US Stock Form */}
        {/* ------------------------------------------------------------------ */}
        {isStock && (
          <div className="space-y-4">
            {/* Live Market Price Banner if fetched */}
            {liveStockPrice !== null && liveStockPrice > 0 && (
              <div className="flex items-center justify-between rounded-2xl bg-surface-muted px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-ink-soft">Market price</span>
                  <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-bold text-link">Live</span>
                </div>
                <span className="text-sm font-bold tnum text-ink">
                  ${liveStockPrice.toFixed(2)} <span className="text-xs font-normal text-ink-muted">/ share</span>
                </span>
              </div>
            )}

            {/* Amount spent with inline conversion & non-intrusive FX info */}
            <div className="space-y-1.5">
              <NumberField
                label="Amount spent (THB)"
                prefix="฿"
                value={amountSpentThb}
                onChange={setAmountSpentThb}
                placeholder="2,000"
                error={showErrors && amountThbNum <= 0 ? 'Required (> 0)' : undefined}
              />
              <div className="flex items-center justify-between px-1 text-xs text-ink-muted">
                <span>
                  ≈ <strong className="font-semibold text-ink">${fxRateNum > 0 ? (amountThbNum / fxRateNum).toFixed(2) : '0.00'} USD</strong>
                  {' · '}
                  Live FX: ฿{fxRateNum.toFixed(2)}
                </span>
                {!showFxEdit ? (
                  <button
                    type="button"
                    onClick={() => setShowFxEdit(true)}
                    className="font-semibold text-link hover:underline cursor-pointer"
                  >
                    Adjust FX rate
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowFxEdit(false)}
                    className="font-medium text-ink-muted hover:text-ink cursor-pointer"
                  >
                    Hide
                  </button>
                )}
              </div>
            </div>

            {/* Optional Collapsible FX Rate editor */}
            {showFxEdit && (
              <div className="rounded-2xl bg-surface-muted p-4 transition-all">
                <NumberField
                  label="Custom FX rate (USD/THB)"
                  hint="Override if broker used different rate"
                  value={fxRate}
                  onChange={setFxRate}
                  placeholder="Your broker's rate"
                  error={showErrors && fxRateNum <= 0 ? 'Required (> 0)' : undefined}
                />
              </div>
            )}

            {/* Shares bought - The primary field user fills */}
            <div>
              <NumberField
                label="Shares bought"
                value={unitsBought}
                onChange={setUnitsBought}
                placeholder="e.g. 0.3000"
                autoFocus
                error={showErrors && stockUnitsBoughtNum <= 0 ? 'Shares bought required (> 0)' : undefined}
              />
              {/* Quick fill estimated shares button if live price available and user hasn't typed shares yet */}
              {liveStockPrice !== null && liveStockPrice > 0 && amountThbNum > 0 && fxRateNum > 0 && (
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-xs text-ink-muted">
                    ≈ {((amountThbNum / fxRateNum) / liveStockPrice).toFixed(4)} shares @ ${liveStockPrice.toFixed(2)}
                  </span>
                  {unitsBought === '' && (
                    <button
                      type="button"
                      onClick={() => setUnitsBought(Number(((amountThbNum / fxRateNum) / liveStockPrice).toFixed(4)))}
                      className="text-xs font-bold text-link hover:underline cursor-pointer"
                    >
                      Fill estimated
                    </button>
                  )}
                </div>
              )}
            </div>

            <BuyPreview
              paid={thb(amountThbNum)}
              got={hasValidStock ? `${fmtNum(stockUnitsBoughtNum, 4)} shares` : undefined}
              total={`${fmtNum(hasValidStock ? stockNewTotalUnits : stockCurrentUnits, 4)} shares`}
              warning={hasValidStock ? gapWarning(stockImpliedPriceUsd * fxRateNum, stockMarketThb, '/ share', 'shares') : undefined}
              details={[
                { label: 'Price this buy', value: hasValidStock ? `$${fmtNum(stockImpliedPriceUsd, 2)} / share (≈ ${thb(stockImpliedPriceUsd * fxRateNum)})` : '—' },
                { label: 'Average cost', value: hasValidStock ? `${thb(stockNewAvgCostThb)} / share` : stockCurrentUnits > 0 ? `${thb(stockCurrentThbInvested / stockCurrentUnits)} / share` : '—' },
                { label: 'Total put in', value: thb(hasValidStock ? stockNewTotalThbInvested : stockCurrentThbInvested) },
              ]}
            />
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
              step={1}
              error={showErrors && satsNum <= 0 ? 'Sats bought required (> 0)' : undefined}
            />

            <SelectField
              label="Storage / location"
              value={selectedLocId}
              onChange={setSelectedLocId}
              options={btcLocationOptions}
            />

            {selectedLocId === '__new__' && (
              <TextField
                label="New location name"
                value={newLocName}
                onChange={setNewLocName}
                placeholder="e.g. Binance, Cold Wallet..."
                error={showErrors && !locValid ? 'Location name required' : undefined}
              />
            )}

            <BuyPreview
              paid={thb(amountThbNum)}
              got={hasValidBtc ? `${fmtNum(satsNum, 0)} sats` : undefined}
              total={`${fmtNum(hasValidBtc ? btcNewTotalSats : btcCurrentTotalSats, 0)} sats`}
              totalSub={`${fmtNum((hasValidBtc ? btcNewTotalSats : btcCurrentTotalSats) / SATS_PER_BTC, 8)} BTC`}
              warning={hasValidBtc ? gapWarning(btcImpliedPriceThbPerBtc, marketPrice, '/ BTC', 'sats') : undefined}
              details={[
                { label: 'Price this buy', value: hasValidBtc ? `${thb(btcImpliedPriceThbPerBtc)} / BTC` : '—' },
                { label: 'Average cost', value: hasValidBtc ? `${thb(btcNewAvgCostThb)} / BTC` : btcCurrentTotalSats > 0 ? `${thb((btcCurrentTotalThb / btcCurrentTotalSats) * SATS_PER_BTC)} / BTC` : '—' },
                { label: 'Total put in', value: thb(hasValidBtc ? btcNewTotalThbInvested : btcCurrentTotalThb) },
              ]}
            />
          </div>
        )}

        {isCrypto && !isBtc && (
          <div className="space-y-4">
            <NumberField
              label="Amount spent (THB)"
              prefix="฿"
              value={amountSpentThb}
              onChange={setAmountSpentThb}
              placeholder="2,000"
              error={showErrors && amountThbNum <= 0 ? 'Required (> 0)' : undefined}
            />
            <BuyPreview
              paid={thb(amountThbNum)}
              got={cryptoUnitsToAdd > 0 ? `${fmtNum(cryptoUnitsToAdd, 8)} ${cryptoTicker}` : undefined}
              total={`${fmtNum(cryptoCurrentUnits + cryptoUnitsToAdd, 8)} ${cryptoTicker}`}
              warning={cryptoPricePerUnit > 0 ? undefined : 'Set a current price for this coin first: the units are worked out from it.'}
              details={[{ label: 'Price used', value: cryptoPricePerUnit > 0 ? `฿${fmtNum(cryptoPricePerUnit, 8)} / ${cryptoTicker}` : '—' }]}
            />
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

            <SegmentedControl
              size="sm"
              gridCols={2}
              value={goldInputMode}
              onChange={setGoldInputMode}
              options={[
                { value: 'grams', label: 'Weight (g)' },
                { value: 'baht', label: 'Weight (gold baht)' },
                { value: 'price', label: 'Price / gram (฿/g)' },
                { value: 'price_baht', label: 'Price / gold baht' },
              ]}
            />

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
                label="Weight bought in gold baht (1 gold baht = 15.244 g)"
                value={goldBaht}
                onChange={setGoldBaht}
                placeholder="e.g. 1.0"
                autoFocus
                step={0.0001}
                error={showErrors && goldGramsToAdd <= 0 ? 'Weight in gold baht required (> 0)' : undefined}
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
                label="Price per gold baht (฿)"
                prefix="฿"
                value={goldPricePerBaht}
                onChange={setGoldPricePerBaht}
                placeholder="e.g. 43,500"
                autoFocus
                error={showErrors && goldGramsToAdd <= 0 ? 'Price per gold baht required (> 0)' : undefined}
              />
            )}

            <SelectField
              label="Storage / location"
              value={selectedLocId}
              onChange={setSelectedLocId}
              options={goldLocationOptions}
            />

            {selectedLocId === '__new__' && (
              <TextField
                label="New location name"
                value={newLocName}
                onChange={setNewLocName}
                placeholder="e.g. Home safe, Bank vault..."
                error={showErrors && !locValid ? 'Location name required' : undefined}
              />
            )}

            <BuyPreview
              paid={thb(amountThbNum)}
              got={hasValidGold ? `${fmtNum(goldGramsToAdd, 4)} g` : undefined}
              total={`${fmtNum(hasValidGold ? goldNewTotalGrams : goldCurrentTotalGrams, 4)} g`}
              totalSub={`≈ ${fmtNum((hasValidGold ? goldNewTotalGrams : goldCurrentTotalGrams) / GRAMS_PER_BAHT_GOLD, 4)} gold baht`}
              warning={hasValidGold ? gapWarning(goldImpliedPricePerGram * GRAMS_PER_BAHT_GOLD, marketPrice ? marketPrice * GRAMS_PER_BAHT_GOLD : null, '/ gold baht', goldInputMode === 'grams' || goldInputMode === 'baht' ? 'weight' : 'price') : undefined}
              details={[
                { label: 'Price this buy', value: hasValidGold ? `${thb(goldImpliedPricePerGram * GRAMS_PER_BAHT_GOLD)} / gold baht` : '—' },
                { label: 'Average cost', value: hasValidGold ? `${thb(goldNewAvgCostThb * GRAMS_PER_BAHT_GOLD)} / gold baht` : goldCurrentTotalGrams > 0 ? `${thb((goldCurrentTotalThb / goldCurrentTotalGrams) * GRAMS_PER_BAHT_GOLD)} / gold baht` : '—' },
                { label: 'Total put in', value: thb(hasValidGold ? goldNewTotalThbInvested : goldCurrentTotalThb) },
              ]}
            />
          </div>
        )}

        {/* Where the money came from: that account's balance goes down (Undo puts it back) */}
        <div className="border-t border-line pt-4">
          <SelectField
            label="Pay from account"
            value={payFromId}
            onChange={setPayFromId}
            options={[
              { value: '', label: 'Not set (no balance change)' },
              ...data.cashAccounts
                .filter((a) => a.currency !== 'USD' && !(isCash && a.id === targetCashAccount?.id))
                .map((a) => ({ value: a.id, label: `${a.name} (฿${a.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })})` })),
            ]}
          />
          <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
            {payFrom
              ? `฿${fmtNum(amountThbNum, 2)} leaves ${payFrom.name} → ฿${fmtNum(payFrom.balance - amountThbNum, 2)} left. Shows in Spend as ${isCash ? 'a transfer' : 'invested'}, not spending.`
              : isCash
                ? 'Shows in Spend as money saved, with no account it came from.'
                : 'Shows in Spend as invested, with no account. No balance changes.'}
          </p>
        </div>
      </div>
    </Modal>
  )
}

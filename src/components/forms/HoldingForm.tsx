import { useEffect, useRef, useState } from 'react'
import { Modal } from '../ui/Modal'
import { NumberField, SelectField, TextField } from '../ui/Field'
import { FormActions } from './FormActions'
import { useData } from '../../store/DataContext'
import { useToast } from '../../store/ToastContext'
import { ASSET_META, GRAMS_PER_BAHT_GOLD, SATS_PER_BTC, goldThbPerGramToXauUsd, upsert } from '../../lib/calc'
import type { AcquisitionSource, AssetClass, DividendPayoutSchedule, Holding, PlannedAsset } from '../../lib/types'
import { dateStrToTimestamp, localDateStr, thb } from '../../lib/format'
import { isValidRate } from '../../lib/fx'
import { newId } from '../../lib/id'
import { searchSecurities, type Security } from '../../lib/securities'
import { fetchStockQuote, searchStocksRemote } from '../../lib/prices'
import { CheckIcon, ChevronDownIcon, PencilIcon, LockClosedIcon } from '../icons'
import { TransactionDateField } from './TransactionDateField'
import { AcquisitionSourceField } from './AcquisitionSourceField'
import { DividendSection } from './holdingForm/DividendSection'

interface Props {
  open: boolean
  editing: Holding | null
  initialPlannedAsset?: PlannedAsset | null
  initialSection?: 'general' | 'dividend'
  onClose: () => void
}

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

const blank = {
  name: '',
  ticker: '',
  assetClass: 'stock' as AssetClass,
  tag: '',
  units: '' as number | string | '',
  avgCost: '' as number | string | '',
  price: '' as number | string | '',
}

export function HoldingForm({ open, editing, initialPlannedAsset, initialSection, onClose }: Props) {
  const { data, upsertHolding, removeHolding, removePlannedAsset, addHoldingLog, usdThb } = useData()
  const { showToast } = useToast()

  // Collapsible sections state
  const [isGeneralExpanded, setIsGeneralExpanded] = useState(true)
  const [isDividendExpanded, setIsDividendExpanded] = useState(true)

  // Safe-Haven Lock
  const [isLocked, setIsLocked] = useState(false)

  // Generic fields
  const [form, setForm] = useState(blank)
  const [showErrors, setShowErrors] = useState(false)

  // Applied FX Rate for stocks
  const [fxRateInput, setFxRateInput] = useState<number | string | ''>('')
  // The real live USD/THB rate, or 0 when none has loaded (never a guessed constant)
  const liveFx = isValidRate(usdThb) ? usdThb : 0
  // The rate typed into the form, else the live one; 0 means unknown, so USD amounts can't be converted yet
  const fxNow = Number(fxRateInput) || liveFx

  // Manual THB Invested override for stocks
  const [thbInvestedInput, setThbInvestedInput] = useState<number | string | ''>('')
  const [isThbInvestedManuallyEdited, setIsThbInvestedManuallyEdited] = useState(false)
  const [isEditingThb, setIsEditingThb] = useState(false)

  // Autocomplete (fund/stock only)
  const [suggestions, setSuggestions] = useState<Security[]>([])

  // BTC new-holding fields
  const [satoshi, setSatoshi] = useState<number | ''>('')
  const [btcThbSpent, setBtcThbSpent] = useState<number | ''>('')
  const [locationName, setLocationName] = useState('')

  // Gold new-holding fields
  const [goldUnit, setGoldUnit] = useState<'grams' | 'baht'>('grams')
  const [grams, setGrams] = useState<number | ''>('')
  const [goldBaht, setGoldBaht] = useState<number | ''>('')
  const [goldThbSpent, setGoldThbSpent] = useState<number | ''>('')
  const [goldLocationName, setGoldLocationName] = useState('')

  // Dividend tracking fields (fund & stock)
  const [paysDividend, setPaysDividend] = useState(false)
  const [dividendMonths, setDividendMonths] = useState<number[]>([])
  const [payoutDpsMap, setPayoutDpsMap] = useState<Record<number, number | string>>({})
  const [defaultCashAccountId, setDefaultCashAccountId] = useState<string>('')

  // Backdated transaction date
  const [txDate, setTxDate] = useState<string>(localDateStr())

  // New holdings only: bought, or received as a gift / inheritance
  const [source, setSource] = useState<AcquisitionSource>('bought')
  const [receivedFrom, setReceivedFrom] = useState('')
  const isReceived = !editing && source === 'received'
  const spentWord = isReceived ? 'worth' : 'spent'
  const fromName = receivedFrom.trim()
  const receivedSuffix = isReceived ? ` · Received${fromName ? ` from ${fromName}` : ''}` : ''
  const sourceLogFields = isReceived ? { source: 'received' as const, receivedFrom: fromName || undefined } : {}

  const isBtc = form.assetClass === 'crypto' && (
    form.ticker.trim().toUpperCase() === 'BTC' ||
    form.name.toLowerCase().includes('bitcoin')
  )
  const isUsd = form.assetClass === 'stock'
  const isGold = form.assetClass === 'gold'
  const isRealEstate = form.assetClass === 'real_estate'

  // Guard: only reset form when modal freshly opens (false→true),
  // not when editing/price changes due to live price ticks.
  const wasOpen = useRef(false)
  const priceAutoFilled = useRef(false)
  const remoteSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestNameQuery = useRef('')
  const [tickerCheck, setTickerCheck] = useState<
    | { state: 'idle' | 'checking' | 'notfound' }
    | { state: 'notusd'; currency: string; name?: string }
    | { state: 'ok'; name?: string; price: number }
  >({ state: 'idle' })

  // New US stock: auto-fill live price from ticker (unless the user typed one)
  useEffect(() => {
    setTickerCheck({ state: 'idle' })
    if (!open || !isUsd) return
    const t = form.ticker.trim().toUpperCase()
    if (!t) return
    setTickerCheck({ state: 'checking' })
    let cancelled = false
    const timer = setTimeout(() => {
      fetchStockQuote(t).then(({ checked, quote }) => {
        if (cancelled) return
        if (!checked) {
          setTickerCheck({ state: 'idle' })
        } else if (!quote) {
          setTickerCheck({ state: 'notfound' })
        } else if (quote.currency && quote.currency !== 'USD') {
          setTickerCheck({ state: 'notusd', currency: quote.currency, name: quote.name })
        } else {
          setTickerCheck({ state: 'ok', name: quote.name, price: quote.price })
          if (!editing && quote.price > 0) {
            setForm((f) => (f.price === '' || priceAutoFilled.current ? { ...f, price: Number(quote.price.toFixed(2)) } : f))
            priceAutoFilled.current = true
          }
        }
      })
    }, 600)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [open, editing, isUsd, form.ticker])

  useEffect(() => {
    const justOpened = !wasOpen.current && open
    wasOpen.current = open
    if (!justOpened) {
      if (open && !editing && !fxRateInput && usdThb) {
        setFxRateInput(formatCostOrFx(usdThb))
      }
      return
    }

    setTxDate(localDateStr())
    setSource('bought')
    setReceivedFrom('')

    if (initialSection === 'dividend') {
      setIsGeneralExpanded(false)
      setIsDividendExpanded(true)
    } else {
      setIsGeneralExpanded(true)
      setIsDividendExpanded(true)
    }

    if (editing) {
      // A US stock's fields are in USD: convert from THB only with a real rate, else leave them empty
      // to be filled in (putting the THB figure in a USD field would save it 30x too high)
      const loadedAvgCost = editing.assetClass === 'stock'
        ? (editing.avgCostUsd ?? (liveFx > 0 ? Number((editing.avgCost / liveFx).toFixed(4)) : ''))
        : editing.avgCost
      const loadedPrice = editing.assetClass === 'stock'
        ? (liveFx > 0 ? Number((editing.price / liveFx).toFixed(4)) : '')
        : editing.price

      setForm({
        name: editing.name,
        ticker: editing.ticker,
        assetClass: editing.assetClass,
        tag: editing.tag ?? '',
        units: editing.assetClass === 'stock' ? formatToMaxDecimals(editing.units, 4) : editing.units,
        avgCost: editing.assetClass === 'stock' ? formatCostOrFx(loadedAvgCost) : loadedAvgCost,
        price: loadedPrice,
      })
      if (editing.assetClass === 'stock') {
        const impliedRate = editing.avgCostThb && editing.avgCostUsd ? editing.avgCostThb / editing.avgCostUsd : liveFx
        setFxRateInput(impliedRate > 0 ? formatCostOrFx(impliedRate) : '')

        const histThb = editing.totalThbInvested ?? (editing.units * editing.avgCost)
        setThbInvestedInput(Number(histThb.toFixed(2)))
        setIsThbInvestedManuallyEdited(true)
        setIsEditingThb(false)
      } else {
        setFxRateInput('')
        setThbInvestedInput('')
        setIsThbInvestedManuallyEdited(false)
        setIsEditingThb(false)
      }

      setPaysDividend(Boolean(editing.paysDividend))
      setDividendMonths(editing.dividendMonths ?? [])
      setDefaultCashAccountId(editing.defaultCashAccountId ?? '')
      setIsLocked(Boolean(editing.isLocked))

      const initialMap: Record<number, number | string> = {}
      if (editing.dividendPayouts && editing.dividendPayouts.length > 0) {
        editing.dividendPayouts.forEach((p) => {
          initialMap[p.month] = p.dps
        })
      } else if (editing.dividendMonths && editing.dividendMonths.length > 0) {
        const legacyDps = typeof editing.expectedDps === 'number' && editing.expectedDps > 0
          ? editing.expectedDps
          : (parseFloat(String(editing.expectedDps ?? '')) || '')
        editing.dividendMonths.forEach((m) => {
          initialMap[m] = legacyDps
        })
      } else if (typeof editing.expectedDps === 'number' && editing.expectedDps > 0) {
        initialMap[1] = editing.expectedDps
      }
      setPayoutDpsMap(initialMap)
    } else if (initialPlannedAsset) {
      setForm({
        name: initialPlannedAsset.name,
        ticker: initialPlannedAsset.ticker,
        assetClass: initialPlannedAsset.assetClass,
        tag: '',
        units: '',
        avgCost: '',
        price: '',
      })
      setSatoshi('')
      setBtcThbSpent('')
      setLocationName('')
      setGrams('')
      setGoldThbSpent('')
      setGoldLocationName('')
      setFxRateInput(usdThb ? formatCostOrFx(usdThb) : '')
      setThbInvestedInput('')
      setIsThbInvestedManuallyEdited(false)
      setIsEditingThb(false)
      setPaysDividend(false)
      setDividendMonths([])
      setPayoutDpsMap({})
      setDefaultCashAccountId(data.cashAccounts[0]?.id ?? '')
      setIsLocked(false)
    } else {
      setForm(blank)
      setSatoshi('')
      setBtcThbSpent('')
      setLocationName('')
      setGrams('')
      setGoldThbSpent('')
      setGoldLocationName('')
      setFxRateInput(usdThb ? formatCostOrFx(usdThb) : '')
      setThbInvestedInput('')
      setIsThbInvestedManuallyEdited(false)
      setIsEditingThb(false)
      setIsLocked(false)
      setPaysDividend(false)
      setDividendMonths([])
      setPayoutDpsMap({})
      setDefaultCashAccountId(data.cashAccounts[0]?.id ?? '')
    }
    setShowErrors(false)
  }, [open, editing, initialPlannedAsset, initialSection, usdThb, data.cashAccounts])

  // Interactive handlers for dynamic dual-currency and FX rate recalculations
  const handleSharesChange = (newUnits: number | string | '') => {
    setForm((f) => ({ ...f, units: newUnits }))
    const shares = Number(newUnits) || 0
    const avgCost = Number(form.avgCost) || 0
    const totalUsd = Number((shares * avgCost).toFixed(4))
    if (fxNow > 0) setThbInvestedInput(Number((totalUsd * fxNow).toFixed(2)))
  }

  const handleAvgCostChange = (newAvgCost: number | string | '') => {
    setForm((f) => ({ ...f, avgCost: newAvgCost }))
    const shares = Number(form.units) || 0
    const avgCost = Number(newAvgCost) || 0
    const totalUsd = Number((shares * avgCost).toFixed(4))
    if (fxNow > 0) setThbInvestedInput(Number((totalUsd * fxNow).toFixed(2)))
  }

  const handleThbInvestedChange = (newThb: number | string | '') => {
    setThbInvestedInput(newThb)
    setIsThbInvestedManuallyEdited(true)

    if (newThb === '') {
      setFxRateInput('')
      return
    }

    const thbVal = Number(newThb) || 0
    const shares = Number(form.units) || 0
    const avgCost = Number(form.avgCost) || 0
    const totalUsd = Number((shares * avgCost).toFixed(4))

    if (totalUsd > 0) {
      const calculatedFxRate = Number((thbVal / totalUsd).toFixed(4))
      setFxRateInput(calculatedFxRate)
    }
  }

  const handleFxRateChange = (newRate: number | string | '') => {
    setFxRateInput(newRate)
    setIsThbInvestedManuallyEdited(true)

    if (newRate === '') {
      setThbInvestedInput('')
      return
    }

    const rateVal = Number(newRate) || 0
    const shares = Number(form.units) || 0
    const avgCost = Number(form.avgCost) || 0
    const totalUsd = Number((shares * avgCost).toFixed(4))

    const calculatedThb = Number((totalUsd * rateVal).toFixed(2))
    setThbInvestedInput(calculatedThb)
  }

  const handleSharesBlur = () => {
    if (form.assetClass === 'stock') {
      const formatted = formatToMaxDecimals(form.units, 4)
      setForm((f) => ({ ...f, units: formatted }))
      
      const shares = Number(formatted) || 0
      const avgCost = Number(form.avgCost) || 0
      const totalUsd = Number((shares * avgCost).toFixed(4))
      if (fxNow > 0) setThbInvestedInput(Number((totalUsd * fxNow).toFixed(2)))
    }
  }

  const handleAvgCostBlur = () => {
    if (form.assetClass === 'stock') {
      const formatted = formatCostOrFx(form.avgCost)
      setForm((f) => ({ ...f, avgCost: formatted }))
      
      const shares = Number(form.units) || 0
      const avgCost = Number(formatted) || 0
      const totalUsd = Number((shares * avgCost).toFixed(4))
      if (fxNow > 0) setThbInvestedInput(Number((totalUsd * fxNow).toFixed(2)))
    }
  }

  const handleFxRateBlur = () => {
    if (form.assetClass === 'stock') {
      const formatted = formatCostOrFx(fxRateInput)
      setFxRateInput(formatted)
      
      const rateVal = Number(formatted) || 0
      const shares = Number(form.units) || 0
      const avgCost = Number(form.avgCost) || 0
      const totalUsd = Number((shares * avgCost).toFixed(4))
      const calculatedThb = Number((totalUsd * rateVal).toFixed(2))
      setThbInvestedInput(calculatedThb)
    }
  }

  const handleThbInvestedBlur = () => {
    if (thbInvestedInput !== '') {
      const formatted = Number(Number(thbInvestedInput).toFixed(2))
      setThbInvestedInput(formatted)
      
      const shares = Number(form.units) || 0
      const avgCost = Number(form.avgCost) || 0
      const totalUsd = Number((shares * avgCost).toFixed(4))
      if (totalUsd > 0) {
        const calculatedFxRate = Number((formatted / totalUsd).toFixed(4))
        setFxRateInput(formatCostOrFx(calculatedFxRate))
      }
    }
  }

  // ── Save: BTC new holding ──
  function saveBtc() {
    const sats = Number(satoshi)
    const spent = Number(btcThbSpent)
    const locName = locationName.trim()
    if (sats <= 0 || spent <= 0 || !locName) { setShowErrors(true); return }

    const btcUnits = sats / SATS_PER_BTC

    // ── If a BTC holding already exists, merge the new wallet into it ──
    const existingBtc = !editing
      ? data.holdings.find((h) => h.assetClass === 'crypto')
      : null

    if (existingBtc) {
      const newLoc = { name: locName, satoshi: sats, thbSpent: spent }
      const updatedLocations = upsert(existingBtc.btcLocations ?? [], newLoc)
      const totalSats = updatedLocations.reduce((s, l) => s + l.satoshi, 0)
      const totalUnits = totalSats / SATS_PER_BTC
      const totalThb = parseFloat(updatedLocations.reduce((s, l) => s + l.thbSpent, 0).toFixed(2))
      const newAvgCostThb = totalUnits > 0 ? totalThb / totalUnits : existingBtc.avgCostThb ?? existingBtc.avgCost
      const mergedHolding: Holding = {
        ...existingBtc,
        btcLocations: updatedLocations,
        units: totalUnits,
        totalUnits,
        avgCost: newAvgCostThb,
        avgCostThb: newAvgCostThb,
        totalThbInvested: totalThb,
        updatedAt: localDateStr(),
      }
      upsertHolding(mergedHolding)
      if (initialPlannedAsset?.id) {
        removePlannedAsset(initialPlannedAsset.id)
      }
      addHoldingLog({
        action: 'add',
        timestamp: dateStrToTimestamp(txDate),
        holdingId: existingBtc.id,
        holdingName: 'Bitcoin',
        ticker: 'BTC',
        assetClass: 'crypto',
        note: `${sats.toLocaleString()} sats · ฿${spent.toLocaleString()} ${spentWord} · ${locName} (merged into existing)${receivedSuffix}`,
        afterHoldingState: mergedHolding,
        ...sourceLogFields,
      })
      onClose()
      return
    }

    // ── No existing BTC holding — create fresh ──
    const avgCostThb = spent / btcUnits
    const savedHolding: Holding = {
      id: editing?.id ?? newId(),
      name: 'Bitcoin',
      ticker: 'BTC',
      assetClass: 'crypto',
      units: btcUnits,
      totalUnits: btcUnits,
      avgCost: avgCostThb,
      avgCostThb,
      totalThbInvested: spent,
      // No live price yet: count at cost and say so (see Holding.placeholderPrice)
      price: editing?.price ?? avgCostThb,
      placeholderPrice: editing ? editing.placeholderPrice : avgCostThb,
      btcLocations: [{ id: newId(), name: locName, satoshi: sats, thbSpent: spent }],
      updatedAt: localDateStr(),
    }
    upsertHolding(savedHolding)
    if (initialPlannedAsset?.id) {
      removePlannedAsset(initialPlannedAsset.id)
    }
    addHoldingLog({
      action: 'add',
      timestamp: dateStrToTimestamp(txDate),
      holdingId: savedHolding.id,
      holdingName: 'Bitcoin',
      ticker: 'BTC',
      assetClass: 'crypto',
      note: `${sats.toLocaleString()} sats · ฿${spent.toLocaleString()} ${spentWord} · ${locName}${receivedSuffix}`,
      afterHoldingState: savedHolding,
      ...sourceLogFields,
    })
    onClose()
  }

  // ── Save: Gold new holding ──
  function saveGold() {
    const g = goldUnit === 'baht'
      ? (goldBaht !== '' ? Number(goldBaht) * GRAMS_PER_BAHT_GOLD : 0)
      : Number(grams)
    const spent = Number(goldThbSpent)
    const locName = goldLocationName.trim()
    if (g <= 0 || spent <= 0 || !locName) { setShowErrors(true); return }

    const bahtAmount = (g / GRAMS_PER_BAHT_GOLD).toFixed(4)

    // ── If a Gold holding already exists, merge the new location into it ──
    const existingGold = !editing
      ? data.holdings.find((h) => h.assetClass === 'gold')
      : null

    if (existingGold) {
      const newLoc = { name: locName, grams: g, thbSpent: spent }
      const updatedLocations = upsert(existingGold.goldLocations ?? [], newLoc)
      const totalGrams = updatedLocations.reduce((s, l) => s + l.grams, 0)
      const totalThb = parseFloat(updatedLocations.reduce((s, l) => s + l.thbSpent, 0).toFixed(2))
      const newAvgCostThb = totalGrams > 0 ? totalThb / totalGrams : existingGold.avgCostThb ?? existingGold.avgCost
      const mergedHolding: Holding = {
        ...existingGold,
        goldLocations: updatedLocations,
        units: totalGrams,
        totalUnits: totalGrams,
        avgCost: newAvgCostThb,
        avgCostThb: newAvgCostThb,
        totalThbInvested: totalThb,
        updatedAt: localDateStr(),
      }
      upsertHolding(mergedHolding)
      if (initialPlannedAsset?.id) {
        removePlannedAsset(initialPlannedAsset.id)
      }
      addHoldingLog({
        action: 'add',
        timestamp: dateStrToTimestamp(txDate),
        holdingId: existingGold.id,
        holdingName: 'Gold',
        ticker: 'XAU',
        assetClass: 'gold',
        note: `${g.toFixed(4)} g (${bahtAmount} gold baht) · ฿${spent.toLocaleString()} ${spentWord} · ${locName} (merged into existing)${receivedSuffix}`,
        afterHoldingState: mergedHolding,
        ...sourceLogFields,
      })
      onClose()
      return
    }

    // ── No existing Gold holding — create fresh ──
    const avgCostThb = spent / g
    const savedHolding: Holding = {
      id: editing?.id ?? newId(),
      name: 'Gold',
      ticker: 'XAU',
      assetClass: 'gold',
      units: g,
      totalUnits: g,
      avgCost: avgCostThb,
      avgCostThb,
      totalThbInvested: spent,
      // No live price yet: count at cost and say so (see Holding.placeholderPrice)
      price: editing?.price ?? avgCostThb,
      placeholderPrice: editing ? editing.placeholderPrice : avgCostThb,
      goldLocations: [{ id: newId(), name: locName, grams: g, thbSpent: spent }],
      updatedAt: localDateStr(),
    }
    upsertHolding(savedHolding)
    if (initialPlannedAsset?.id) {
      removePlannedAsset(initialPlannedAsset.id)
    }
    addHoldingLog({
      action: 'add',
      timestamp: dateStrToTimestamp(txDate),
      holdingId: savedHolding.id,
      holdingName: 'Gold',
      ticker: 'XAU',
      assetClass: 'gold',
      note: `${g.toFixed(4)} g (${bahtAmount} gold baht) · ฿${spent.toLocaleString()} ${spentWord} · ${locName}${receivedSuffix}`,
      afterHoldingState: savedHolding,
      ...sourceLogFields,
    })
    onClose()
  }

  // ── Save: Fund / Stock / Gold / Real Estate edit ──
  function save() {
    const livePrice = editing?.price
    const useLivePrice = (isBtc || isUsd) && editing
    const isRealEstate = form.assetClass === 'real_estate'
    const unitsNum = isRealEstate && form.units === '' ? 1 : Number(form.units)
    const valid =
      form.name.trim() !== '' &&
      (isRealEstate || form.units !== '') &&
      form.avgCost !== '' &&
      (useLivePrice || isUsd || form.price !== '') &&
      (!isUsd || fxNow > 0)
    if (!valid) { setShowErrors(true); return }

    const cleanTag = form.tag.trim() || undefined
    const name = form.name.trim()
    const ticker = form.ticker.trim() || (isRealEstate ? 'PROPERTY' : name.slice(0, 4).toUpperCase())
    const avgCostInput = Number(form.avgCost)

    const targetId = editing?.id ?? newId()
    let updateObj: Holding = {
      id: targetId,
      name,
      ticker,
      assetClass: form.assetClass,
      tag: cleanTag,
      units: unitsNum,
      totalUnits: unitsNum,
      avgCost: avgCostInput,
      price: Number(form.price) || 0,
      // Re-saving the same stand-in price keeps it marked; typing a new price makes it real
      placeholderPrice: editing?.placeholderPrice,
      updatedAt: localDateStr(),
      ...(editing?.btcLocations ? { btcLocations: editing.btcLocations } : {}),
      ...(editing?.goldLocations ? { goldLocations: editing.goldLocations } : {}),
      isLocked,
    }

    if (isUsd) {
      const fxRateVal = fxNow
      let totalThbInvested = parseFloat((Number(thbInvestedInput) || 0).toFixed(2))
      // Never silently save a zero cost basis for a position that has shares and a cost:
      // an emptied/stale THB field would otherwise wipe the real basis (e.g. from a DCA buy).
      if (totalThbInvested <= 0 && unitsNum > 0 && avgCostInput > 0) {
        totalThbInvested = parseFloat((editing?.totalThbInvested && editing.totalThbInvested > 0
          ? editing.totalThbInvested
          : unitsNum * avgCostInput * fxRateVal).toFixed(2))
      }
      const totalUsdInvested = Number((unitsNum * avgCostInput).toFixed(4))
      const avgCostUsd = avgCostInput
      const avgCostThb = unitsNum > 0 ? parseFloat((totalThbInvested / unitsNum).toFixed(2)) : 0

      updateObj = {
        ...updateObj,
        totalThbInvested,
        totalUsdInvested,
        avgCostUsd,
        avgCostThb,
        avgCost: avgCostThb,
        price: useLivePrice ? livePrice! : parseFloat(((Number(form.price) || 0) * (usdThb || fxRateVal)).toFixed(2)),
      }
      // No price typed and none found: count at cost and say so, instead of a price of 0
      if (!useLivePrice && form.price === '') {
        updateObj = { ...updateObj, price: avgCostThb, placeholderPrice: avgCostThb }
      }
    } else {
      const avgCostThb = avgCostInput
      const totalThbInvested = unitsNum * avgCostThb

      updateObj = {
        ...updateObj,
        avgCostThb,
        totalThbInvested,
        avgCost: avgCostThb,
        price: Number(form.price),
      }
    }

    const canPayDividend = form.assetClass === 'fund' || form.assetClass === 'stock'
    if (canPayDividend && paysDividend && dividendMonths.length > 0) {
      const cleanPayouts: DividendPayoutSchedule[] = dividendMonths
        .map((m) => {
          const raw = payoutDpsMap[m]
          const num = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''))
          return {
            month: m,
            dps: isNaN(num) ? 0 : Math.max(0, num),
          }
        })
        .sort((a, b) => a.month - b.month)

      const totalDpsSum = cleanPayouts.reduce((sum, p) => sum + p.dps, 0)
      const avgRoundDps = cleanPayouts.length > 0
        ? Number((totalDpsSum / cleanPayouts.length).toFixed(4))
        : 0

      updateObj = {
        ...updateObj,
        paysDividend: true,
        dividendMonths: dividendMonths.slice().sort((a, b) => a - b),
        dividendPayouts: cleanPayouts,
        expectedDps: avgRoundDps > 0 ? avgRoundDps : undefined,
        defaultCashAccountId: defaultCashAccountId || undefined,
      }
    } else {
      updateObj = {
        ...updateObj,
        paysDividend: false,
        expectedDps: undefined,
        dividendMonths: undefined,
        dividendPayouts: undefined,
        defaultCashAccountId: undefined,
      }
    }

    const savedHolding = updateObj
    upsertHolding(savedHolding)
    if (!editing && initialPlannedAsset?.id) {
      removePlannedAsset(initialPlannedAsset.id)
    }

    let logNote = ''
    if (editing) {
      const prevUnits = editing.units ?? editing.totalUnits ?? 0
      const currUnits = unitsNum
      const unitsChanged = Math.abs(currUnits - prevUnits) > 0.0001 && Number(currUnits.toFixed(4)) !== Number(prevUnits.toFixed(4))

      const prevBasis = editing.totalThbInvested ?? (prevUnits * (editing.avgCostThb ?? editing.avgCost ?? 0))
      const currBasis = updateObj.totalThbInvested ?? (currUnits * (updateObj.avgCostThb ?? updateObj.avgCost ?? 0))
      const costChanged = Math.abs(currBasis - prevBasis) > 1 && Number(currBasis.toFixed(2)) !== Number(prevBasis.toFixed(2))

      const prevPrice = editing.price ?? 0
      const currPrice = updateObj.price ?? 0
      const priceChanged = Math.abs(currPrice - prevPrice) > 0.01 && Number(currPrice.toFixed(2)) !== Number(prevPrice.toFixed(2))

      const nameChanged = editing.name.trim() !== name.trim()
      const tickerChanged = editing.ticker.trim() !== ticker.trim()

      const changes: string[] = []
      if (nameChanged) {
        changes.push(`Name: "${editing.name}" → "${name}"`)
      }
      if (tickerChanged) {
        changes.push(`Ticker: ${editing.ticker} → ${ticker}`)
      }
      if ((editing.tag || undefined) !== cleanTag) {
        changes.push(`Tag: "${editing.tag ?? 'none'}" → "${cleanTag ?? 'none'}"`)
      }
      if (priceChanged && !unitsChanged && !costChanged) {
        if (form.assetClass === 'stock') {
          const currUsd = Number(form.price) || 0
          changes.push(`Updated market price to $${currUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}/share`)
        } else if (form.assetClass === 'fund') {
          changes.push(`Updated NAV to ฿${currPrice.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}/unit`)
        } else if (form.assetClass === 'crypto') {
          changes.push(`Updated BTC price to ฿${currPrice.toLocaleString()}`)
        } else if (form.assetClass === 'gold') {
          changes.push(`Updated gold price to ฿${(currPrice * GRAMS_PER_BAHT_GOLD).toLocaleString()}/gold baht`)
        } else {
          changes.push(`Updated price to ฿${currPrice.toLocaleString()}`)
        }
      } else if (priceChanged) {
        if (form.assetClass === 'stock') {
          const currUsd = Number(form.price) || 0
          changes.push(`Price: $${currUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`)
        } else if (form.assetClass === 'fund') {
          changes.push(`NAV: ฿${currPrice.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`)
        } else {
          changes.push(`Price: ฿${currPrice.toLocaleString()}`)
        }
      }
      if (unitsChanged) {
        changes.push(`Units: ${prevUnits.toLocaleString(undefined, { maximumFractionDigits: 4 })} → ${currUnits.toLocaleString(undefined, { maximumFractionDigits: 4 })}`)
      }
      if (costChanged) {
        changes.push(`Cost basis: ฿${prevBasis.toLocaleString(undefined, { maximumFractionDigits: 2 })} → ฿${currBasis.toLocaleString(undefined, { maximumFractionDigits: 2 })}`)
      }

      logNote = changes.length > 0
        ? changes.join(' · ')
        : `Updated holding details`
    } else {
      logNote = `${unitsNum.toLocaleString(undefined, { maximumFractionDigits: 4 })} shares @ ${isUsd ? `$${avgCostInput.toLocaleString()}` : `฿${avgCostInput.toLocaleString()}`}/unit${receivedSuffix}`
    }

    addHoldingLog({
      action: editing ? 'edit' : 'add',
      timestamp: dateStrToTimestamp(txDate),
      holdingId: targetId,
      holdingName: name,
      ticker,
      assetClass: form.assetClass,
      note: logNote,
      previousHoldingState: editing ? JSON.parse(JSON.stringify(editing)) : undefined,
      afterHoldingState: savedHolding,
      ...sourceLogFields,
    })
    showToast(editing ? `Updated ${name}` : `${name} is now in your portfolio.`, 'success', undefined, { celebrate: !editing, title: 'Holding added!' })
    onClose()
  }

  // Derived previews
  const sats = Number(satoshi)
  const btcSpent = Number(btcThbSpent)
  const btcAmount = sats > 0 ? sats / SATS_PER_BTC : 0
  const btcImpliedPrice = btcAmount > 0 && btcSpent > 0 ? btcSpent / btcAmount : 0

  const goldGrams = goldUnit === 'baht'
    ? (goldBaht !== '' ? Number(goldBaht) * GRAMS_PER_BAHT_GOLD : 0)
    : Number(grams)
  const goldSpent = Number(goldThbSpent)
  const goldImpliedPrice = goldGrams > 0 && goldSpent > 0 ? goldSpent / goldGrams : 0

  // Derived values for US Stock dual-currency cards
  const sharesInputVal = Number(form.units) || 0
  const avgCostUsdVal = Number(form.avgCost) || 0
  const fxRateVal = fxNow

  const totalThbInvestedVal = Number(Number(thbInvestedInput).toFixed(2)) || 0

  // The live price in USD needs a real rate; null shows a dash instead of a guess
  const livePriceUsd = editing && liveFx > 0 ? Number((editing.price / liveFx).toFixed(4)) : null
  // An existing holding's price is already in THB; a new one's is typed in USD
  const currentMarketValueThb = editing
    ? Number((sharesInputVal * editing.price).toFixed(2))
    : Number((sharesInputVal * (Number(form.price) || 0) * (liveFx || fxRateVal)).toFixed(2))
  const netPnlThb = Number((currentMarketValueThb - totalThbInvestedVal).toFixed(2))
  const netReturnPct = totalThbInvestedVal > 0 ? Number(((netPnlThb / totalThbInvestedVal) * 100).toFixed(2)) : 0

  const formattedNetPnlThb = netPnlThb > 0
    ? `+฿${netPnlThb.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : netPnlThb < 0
    ? `-฿${Math.abs(netPnlThb).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `฿0.00`

  const modalDescription = isBtc
    ? 'Log your first purchase in Satoshi.'
    : isGold
    ? 'Log your first gold purchase in grams.'
    : isUsd
    ? `Prices in USD, converted to THB at ${usdThb ? `฿${usdThb.toFixed(2)}/USD` : 'live rate'}.`
    : isRealEstate
    ? 'Record a house, condo or land with its purchase price and current estimated value'
    : form.assetClass === 'crypto'
    ? 'Crypto units, cost per unit, and current price are recorded in Thai Baht.'
    : 'Thai fund, stock, or DR, valued in THB.'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit holding' : 'Add holding'}
      description={modalDescription}
      footer={
        isBtc && !editing ? (
          <FormActions editing={false} canSave onSave={saveBtc} submitLabel="Add holding" />
        ) : isGold && !editing ? (
          <FormActions editing={false} canSave onSave={saveGold} submitLabel="Add holding" />
        ) : (
          <FormActions
            editing={!!editing}
            canSave={true}
            onSave={save}
            onDelete={
              editing && !isLocked
                ? () => { removeHolding(editing.id); onClose() }
                : undefined
            }
          />
        )
      }
    >
      <div className="space-y-4">
        {/* Accordion 1: General info */}
        <div className="rounded-2xl border border-line bg-surface overflow-hidden shadow-2xs">
          <button
            type="button"
            onClick={() => setIsGeneralExpanded((v) => !v)}
            className="w-full flex items-center justify-between p-3.5 sm:p-4 text-left bg-surface-muted transition-colors cursor-pointer select-none"
            aria-expanded={isGeneralExpanded}
          >
            <div className="flex items-center gap-2 min-w-0 pr-2">
              <span className="text-sm font-bold text-ink truncate">
                General info
              </span>
              {!isGeneralExpanded && (form.name || form.ticker) && (
                <span className="hidden sm:inline-flex items-center rounded-md bg-surface-muted px-2 py-0.5 text-xs font-medium text-ink-muted truncate max-w-[200px]">
                  {form.ticker ? `${form.ticker} · ` : ''}{form.name || 'Holding'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!isGeneralExpanded && (
                <span className="text-xs text-brand font-medium">Tap to view / edit</span>
              )}
              <ChevronDownIcon
                className={`h-4 w-4 text-ink-muted transition-transform duration-200 ${
                  isGeneralExpanded ? 'rotate-180' : ''
                }`}
              />
            </div>
          </button>

          {isGeneralExpanded && (
            <div className="p-3.5 sm:p-4 pt-1 space-y-4 border-t border-line/60">
              {/* Asset class — always first */}
        <SelectField
          label="Asset class"
          value={form.assetClass}
          onChange={(v) => {
            const nextClass = v as AssetClass
            setForm((f) => ({
              ...f,
              assetClass: nextClass,
              units: nextClass === 'real_estate' && (f.units === '' || f.units === '0') ? '1' : f.units,
            }))
            setSuggestions([])
          }}
          options={[
            { value: 'stock', label: 'US Stock' },
            { value: 'fund', label: 'Thai Assets (Stocks, Funds, DR)' },
            { value: 'crypto', label: 'Crypto (BTC, ETH, and other tokens)' },
            { value: 'gold', label: 'Gold' },
            { value: 'real_estate', label: 'Real Estate (House / Condo / Land)' },
          ]}
        />

        {/* Transaction Date */}
        <TransactionDateField value={txDate} onChange={setTxDate} />

        {!editing && (
          <AcquisitionSourceField
            source={source}
            onSourceChange={setSource}
            receivedFrom={receivedFrom}
            onReceivedFromChange={setReceivedFrom}
          />
        )}

        {/* Name + Ticker + Tag — only for fund/stock/real_estate (and edit mode for all) */}
        {(!isBtc && !isGold) || editing ? (
          <>
            <div className="relative">
              <TextField
                label="Name"
                value={form.name}
                error={showErrors && form.name.trim() === '' ? 'Name is required' : undefined}
                onChange={(name) => {
                  setForm((f) => ({ ...f, name }))
                  const local = (!isBtc && !isGold && !isRealEstate) ? searchSecurities(name, form.assetClass) : []
                  setSuggestions(local)
                  latestNameQuery.current = name
                  if (remoteSearchTimer.current) clearTimeout(remoteSearchTimer.current)
                  if (isUsd && !editing && name.trim().length >= 2) {
                    remoteSearchTimer.current = setTimeout(() => {
                      searchStocksRemote(name.trim()).then((remote) => {
                        if (latestNameQuery.current !== name) return
                        const known = new Set(local.map((s) => s.ticker))
                        const extra: Security[] = remote
                          .filter((r) => !known.has(r.ticker))
                          .map((r) => ({ ticker: r.ticker, name: r.name, assetClass: 'stock' }))
                        if (extra.length > 0) setSuggestions([...local, ...extra].slice(0, 20))
                      })
                    }, 350)
                  }
                }}
                onBlur={() => setTimeout(() => setSuggestions([]), 150)}
                placeholder={isBtc ? 'e.g. My Bitcoin' : isUsd ? 'e.g. Apple Inc.' : isGold ? 'e.g. My Gold' : isRealEstate ? 'e.g. Sukhumvit Condo, Modern House' : 'e.g. Kasikorn Fund'}
              />
              {suggestions.length > 0 && (
                <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-2xl border border-line bg-surface shadow-[var(--shadow-lift)] animate-pop-in origin-top">
                  {suggestions.map((s) => (
                    <li key={s.ticker}>
                      <button
                        type="button"
                        aria-label={`Select ${s.ticker} - ${s.name}`}
                        className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-surface-muted"
                        onMouseDown={() => {
                          setForm((f) => ({ ...f, name: s.name, ticker: s.ticker }))
                          setSuggestions([])
                        }}
                      >
                        <span className="w-[68px] shrink-0 truncate rounded-md bg-surface-muted px-1.5 py-0.5 text-center text-xs font-bold tracking-wide text-ink-muted">
                          {s.ticker}
                        </span>
                        <span className="text-sm text-ink">{s.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <TextField
              label="Ticker / Code"
              hint="optional"
              value={form.ticker}
              onChange={(ticker) => setForm((f) => ({ ...f, ticker: ticker.toUpperCase() }))}
              placeholder={isBtc ? 'BTC' : isUsd ? 'AAPL' : isGold ? 'XAU' : isRealEstate ? 'e.g. CONDO-IDEO, HOME' : 'e.g. KF-CASH'}
            />
            {isUsd && tickerCheck.state !== 'idle' && (
              <p
                className={`-mt-2 text-xs ${
                  tickerCheck.state === 'ok' ? 'text-gain' : tickerCheck.state === 'checking' ? 'text-ink-muted' : 'text-loss'
                }`}
              >
                {tickerCheck.state === 'checking' && 'Checking ticker…'}
                {tickerCheck.state === 'ok' && (
                  <span className="inline-flex items-center gap-1">
                    <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.4} />
                    {`${tickerCheck.name ?? form.ticker} · $${tickerCheck.price.toFixed(2)}`}
                  </span>
                )}
                {tickerCheck.state === 'notfound' && 'Ticker not found — live price will not update for this holding'}
                {tickerCheck.state === 'notusd' && `Quoted in ${tickerCheck.currency}, not USD — live price is disabled for this ticker`}
              </p>
            )}

            {/* Tag / Category */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-ink-muted">Asset Tag / Group</label>
                <span className="text-xs text-ink-faint">optional · group your portfolio</span>
              </div>
              <input
                type="text"
                value={form.tag}
                onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value }))}
                placeholder={isRealEstate ? 'e.g. Real Estate, Rental Property' : form.assetClass === 'fund' ? 'e.g. Thai Equities, Fixed Income' : 'e.g. US Tech, Growth'}
                className="w-full rounded-xl border border-line bg-surface-muted px-3.5 py-2 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              {(() => {
                const assetTagsByClass: Record<AssetClass, string[]> = {
                  fund: ['Thai Equities', 'Global Equity', 'Tech', 'Fixed Income', 'Property / REITs', 'Dividend'],
                  real_estate: ['Real Estate', 'Condo', 'House', 'Rental', 'Residential', 'Land'],
                  stock: ['US Stocks', 'Big Tech', 'Dividend', 'ETFs', 'Growth'],
                  crypto: ['Bitcoin', 'Crypto'],
                  gold: ['Gold', 'Gold Bullion'],
                  cash: ['Cash'],
                }
                const existingTags = Array.from(
                  new Set(
                    data.holdings
                      .map((h) => h.tag?.trim())
                      .filter((t): t is string => Boolean(t && t.length > 0))
                  )
                )
                const suggestedTags = Array.from(
                  new Set([
                    ...(assetTagsByClass[form.assetClass] || []),
                    ...existingTags,
                  ])
                )
                if (suggestedTags.length === 0) return null
                return (
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                    <span className="shrink-0 text-xs font-semibold text-ink-muted">Suggested:</span>
                    {suggestedTags.slice(0, 10).map((tag) => {
                      const isSelected = form.tag.trim() === tag
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, tag: isSelected ? '' : tag }))}
                          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer select-none ${
                            isSelected
                              ? 'bg-brand text-white shadow-xs'
                              : 'bg-surface-muted text-ink-soft hover:text-ink hover:bg-line/40'
                          }`}
                        >
                          {isSelected && <CheckIcon className="mr-1 inline h-3 w-3" strokeWidth={2.6} />}
                          {tag}
                        </button>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          </>
        ) : null}

        {/* ── BTC: new holding ── */}
        {isBtc && !editing && (
          <>
            <TextField
              label="Location"
              value={locationName}
              onChange={setLocationName}
              placeholder="e.g. Ledger, Binance, Trezor"
              error={showErrors && !locationName.trim() ? 'Location is required' : undefined}
            />
            <div className="grid grid-cols-1 gap-3 ">
              <NumberField
                label={isReceived ? 'Satoshi received' : 'Satoshi bought'}
                value={satoshi}
                error={showErrors && (satoshi === '' || Number(satoshi) <= 0) ? 'Required (> 0)' : undefined}
                onChange={setSatoshi}
                placeholder="e.g. 500000"
                step={1}
              />
              <NumberField
                label={isReceived ? 'Value when received (THB)' : 'THB spent'}
                prefix="฿"
                value={btcThbSpent}
                error={showErrors && (btcThbSpent === '' || Number(btcThbSpent) <= 0) ? 'Required (> 0)' : undefined}
                onChange={setBtcThbSpent}
                placeholder="0"
              />
            </div>
            {sats > 0 && btcSpent > 0 && (
              <div
                className="rounded-2xl border px-4 py-3"
                style={{
                  borderColor: `color-mix(in srgb, ${ASSET_META.crypto.color} 35%, transparent)`,
                  background: `color-mix(in srgb, ${ASSET_META.crypto.color} 10%, transparent)`,
                }}
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-soft">Implied price / BTC</span>
                  <span className="font-semibold tnum text-ink">{thb(btcImpliedPrice)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-sm">
                  <span className="text-ink-soft">BTC amount</span>
                  <span className="font-semibold tnum text-ink">{btcAmount.toFixed(8)} BTC ({sats.toLocaleString()} sats)</span>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── BTC: edit ── */}
        {isBtc && editing && (
          <>
            <div>
              <NumberField
                label="BTC held (decimal)"
                value={form.units}
                error={showErrors && form.units === '' ? 'Units are required' : undefined}
                onChange={(units) => setForm((f) => ({ ...f, units }))}
                placeholder="0"
                step={0.00000001}
              />
              {Number(form.units) > 0 && (
                <p className="mt-1 text-xs text-ink-muted">
                  ≈ {Math.round(Number(form.units) * SATS_PER_BTC).toLocaleString()} sats
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 ">
              <NumberField
                label="Avg cost / BTC"
                prefix="฿"
                value={form.avgCost}
                error={showErrors && form.avgCost === '' ? 'Cost is required' : undefined}
                onChange={(avgCost) => setForm((f) => ({ ...f, avgCost }))}
                placeholder="0"
              />
              <div>
                <p className="mb-1.5 text-sm font-medium text-ink-muted">Current price / BTC</p>
                <div className="flex h-10 items-center gap-2 rounded-xl bg-surface-muted px-3">
                  <span className="text-sm font-semibold tnum text-ink">
                    ฿{editing.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                  <span className="ml-auto rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">Live</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── Gold: new holding ── */}
        {isGold && !editing && (
          <>
            <TextField
              label="Location"
              value={goldLocationName}
              onChange={setGoldLocationName}
              placeholder="e.g. Home safe, Bank vault, Hua Seng Heng"
              error={showErrors && !goldLocationName.trim() ? 'Location is required' : undefined}
            />

            {/* Unit selector tab */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-ink-soft">Purchase unit</label>
              <div className="flex rounded-xl bg-surface-muted p-1 gap-1">
                <button
                  type="button"
                  onClick={() => setGoldUnit('grams')}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                    goldUnit === 'grams'
                      ? 'bg-surface text-ink shadow-sm'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  Grams
                </button>
                <button
                  type="button"
                  onClick={() => setGoldUnit('baht')}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                    goldUnit === 'baht'
                      ? 'bg-surface text-ink shadow-sm'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  Gold baht (15.244 g)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {goldUnit === 'grams' ? (
                <NumberField
                  label={isReceived ? 'Grams received' : 'Grams bought'}
                  value={grams}
                  error={showErrors && (grams === '' || Number(grams) <= 0) ? 'Required (> 0)' : undefined}
                  onChange={(val) => {
                    setGrams(val)
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
                  label={isReceived ? 'Weight received in gold baht' : 'Weight bought in gold baht'}
                  value={goldBaht}
                  error={showErrors && (goldBaht === '' || Number(goldBaht) <= 0) ? 'Required (> 0)' : undefined}
                  onChange={(val) => {
                    setGoldBaht(val)
                    if (val !== '' && Number(val) > 0) {
                      setGrams(Number((Number(val) * GRAMS_PER_BAHT_GOLD).toFixed(6)))
                    } else {
                      setGrams('')
                    }
                  }}
                  placeholder="e.g. 1.0"
                  step={0.0001}
                />
              )}
              <NumberField
                label={isReceived ? 'Value when received (THB)' : 'THB spent'}
                prefix="฿"
                value={goldThbSpent}
                error={showErrors && (goldThbSpent === '' || Number(goldThbSpent) <= 0) ? 'Required (> 0)' : undefined}
                onChange={setGoldThbSpent}
                placeholder="0"
              />
            </div>
            {goldGrams > 0 && goldSpent > 0 && (
              <div
                className="rounded-2xl border px-4 py-3 space-y-1.5"
                style={{
                  borderColor: `color-mix(in srgb, ${ASSET_META.gold.color} 35%, transparent)`,
                  background: `color-mix(in srgb, ${ASSET_META.gold.color} 10%, transparent)`,
                }}
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-soft">Implied price / gram</span>
                  <span className="font-semibold tnum text-ink">{thb(goldImpliedPrice)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-soft">Implied cost / gold baht</span>
                  <span className="font-semibold tnum text-brand">
                    {thb(goldImpliedPrice * GRAMS_PER_BAHT_GOLD)}
                    {liveFx > 0 && ` ($${Math.round(goldThbPerGramToXauUsd(goldImpliedPrice, liveFx)).toLocaleString()}/oz XAUUSD)`}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-soft">Total weight</span>
                  <span className="font-semibold tnum text-ink">{goldGrams.toFixed(4)} g ({(goldGrams / GRAMS_PER_BAHT_GOLD).toFixed(4)} gold baht)</span>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Gold: edit ── */}
        {isGold && editing && (
          <>
            <div>
              <NumberField
                label="Weight held (grams)"
                value={form.units}
                error={showErrors && form.units === '' ? 'Weight is required' : undefined}
                onChange={(units) => setForm((f) => ({ ...f, units }))}
                placeholder="0"
                step={0.0001}
              />
              {Number(form.units) > 0 && (
                <p className="mt-1 text-xs text-ink-muted">
                  ≈ {(Number(form.units) / GRAMS_PER_BAHT_GOLD).toFixed(4)} gold baht
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 ">
              <div>
                <NumberField
                  label="Avg cost / gram"
                  prefix="฿"
                  value={form.avgCost}
                  error={showErrors && form.avgCost === '' ? 'Cost is required' : undefined}
                  onChange={(avgCost) => setForm((f) => ({ ...f, avgCost }))}
                  placeholder="0"
                />
                {Number(form.avgCost) > 0 && (
                  <p className="mt-1 text-xs text-ink-muted">
                    ≈ {thb(Number(form.avgCost) * GRAMS_PER_BAHT_GOLD)} / gold baht
                  </p>
                )}
              </div>
              <div>
                <NumberField
                  label="Current price / gram"
                  prefix="฿"
                  value={form.price}
                  error={showErrors && form.price === '' ? 'Price is required' : undefined}
                  onChange={(price) => setForm((f) => ({ ...f, price }))}
                  placeholder="0"
                />
                {Number(form.price) > 0 && (
                  <p className="mt-1 text-xs text-ink-muted">
                    ≈ {thb(Number(form.price) * GRAMS_PER_BAHT_GOLD)} / gold baht
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── Fund / Stock: new + edit ── */}
        {!isBtc && !isGold && (
          isUsd ? (
            <>
              {/* Card A: THB Investment Summary (Total THB Invested has a subtle edit option, rest read-only) */}
              <div className="rounded-2xl bg-surface-muted p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-brand">THB Investment Summary</p>
                  {!isEditingThb && (
                    <button
                      type="button"
                      onClick={() => setIsEditingThb(true)}
                      aria-label="Edit THB cost basis manually"
                      className="inline-flex items-center gap-1 rounded-md bg-brand/15 px-2 py-0.5 text-xs font-bold text-brand hover:bg-brand/25 active:scale-95 transition-all cursor-pointer uppercase tracking-wider"
                    >
                      <PencilIcon className="h-3 w-3" />
                      EDIT THB
                    </button>
                  )}
                </div>
                
                {isEditingThb ? (
                  <div className="space-y-3 pt-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-ink-muted">Manually Adjust THB Cost</span>
                      <button
                        type="button"
                        onClick={() => setIsEditingThb(false)}
                        aria-label="Keep manually adjusted THB value"
                        className="text-xs font-bold text-brand hover:underline cursor-pointer uppercase tracking-wider"
                      >
                        Keep Value
                      </button>
                    </div>
                    <NumberField
                      label=""
                      prefix="฿"
                      value={thbInvestedInput}
                      onChange={handleThbInvestedChange}
                      onBlur={handleThbInvestedBlur}
                      error={showErrors && thbInvestedInput === '' ? 'Total THB Invested is required' : undefined}
                      placeholder="0.00"
                      step={0.01}
                      allowString
                    />
                    {isThbInvestedManuallyEdited && liveFx > 0 && (
                      <div className="text-right -mt-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setIsThbInvestedManuallyEdited(false)
                            const shares = Number(form.units) || 0
                            const avgCost = Number(form.avgCost) || 0
                            const fxRate = liveFx
                            const calculatedThb = Number((shares * avgCost * fxRate).toFixed(2))
                            setThbInvestedInput(calculatedThb)
                            setFxRateInput(formatCostOrFx(fxRate))
                          }}
                          aria-label="Reset THB cost basis to calculate from USD shares and cost"
                          className="text-xs font-semibold text-brand hover:underline cursor-pointer"
                        >
                          Reset to calculated (฿{Number((sharesInputVal * avgCostUsdVal * liveFx).toFixed(2)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} @ {Number(liveFx.toFixed(2))})
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-sm pt-1">
                    <span className="text-ink-soft">Total THB Invested</span>
                    <span className="font-bold tnum text-sm text-ink">
                      ฿{totalThbInvestedVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-soft">Current Market Value (THB)</span>
                  <span className="font-bold tnum text-ink">
                    ฿{currentMarketValueThb.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-soft">Net Profit / Loss (THB)</span>
                  <span className={`font-bold tnum ${netPnlThb >= 0 ? 'text-gain' : 'text-loss'}`}>
                    {formattedNetPnlThb}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-soft">Net Return (%)</span>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${netPnlThb >= 0 ? 'bg-gain-soft text-gain' : 'bg-loss-soft text-loss'}`}>
                    {netPnlThb >= 0 ? '+' : ''}{netReturnPct.toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* Card B: USD Position Details (USD Focus - Editable) */}
              <div className="rounded-2xl border border-line p-4 space-y-4">
                <p className="text-xs font-bold uppercase tracking-wider text-brand">USD Position Details</p>
                
                <NumberField
                  label="Total Shares Held"
                  value={form.units}
                  suffix="shares"
                  error={showErrors && form.units === '' ? 'Shares held is required' : undefined}
                  onChange={handleSharesChange}
                  onBlur={handleSharesBlur}
                  placeholder="0"
                  step={0.0001}
                  allowString
                />

                <NumberField
                  label="Average Cost per Share (USD)"
                  prefix="$"
                  value={form.avgCost}
                  error={showErrors && form.avgCost === '' ? 'Average cost is required' : undefined}
                  onChange={handleAvgCostChange}
                  onBlur={handleAvgCostBlur}
                  placeholder="0"
                  step={0.01}
                  allowString
                />

                {editing ? (
                  <div>
                    <p className="mb-1.5 text-sm font-medium text-ink-muted">Live Market Price per Share (USD)</p>
                    <div className="flex h-10 items-center gap-2 rounded-xl bg-surface-muted px-3">
                      <span className="text-sm font-semibold tnum text-ink">
                        {livePriceUsd !== null ? `$${livePriceUsd.toFixed(2)}` : '—'}
                      </span>
                      <span className="ml-auto rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-bold text-brand">Live</span>
                    </div>
                  </div>
                ) : (
                  <NumberField
                    label="Live Market Price per Share (USD)"
                    prefix="$"
                    value={form.price}
                    hint="Auto-filled by ticker · optional"
                    onChange={(price) => { priceAutoFilled.current = false; setForm((f) => ({ ...f, price })) }}
                    placeholder="Auto"
                    step={0.01}
                  />
                )}

                <NumberField
                  label="Applied FX Rate (USD/THB)"
                  value={fxRateInput}
                  error={showErrors && fxRateInput === '' ? 'FX rate is required' : undefined}
                  onChange={handleFxRateChange}
                  onBlur={handleFxRateBlur}
                  placeholder="Your broker's rate"
                  step={0.0001}
                  allowString
                />
              </div>
            </>
          ) : (
            <>
              <NumberField
                label={isRealEstate ? "Properties / Units" : "Units held"}
                value={form.units}
                error={showErrors && form.units === '' && !isRealEstate ? 'Units are required' : undefined}
                onChange={(units) => setForm((f) => ({ ...f, units }))}
                placeholder={isRealEstate ? "1" : "0"}
                step={isRealEstate ? 1 : form.assetClass === 'crypto' ? 0.00000001 : 0.0001}
              />
              <div className="grid grid-cols-1 gap-3 ">
                <NumberField
                  label={isReceived
                    ? (isRealEstate ? 'Value when received (THB)' : 'Price / unit on the day received')
                    : isRealEstate ? "Purchase Cost (THB)" : form.assetClass === 'crypto' ? "Cost per Unit (THB)" : "Avg cost / unit"}
                  prefix="฿"
                  value={form.avgCost}
                  error={showErrors && form.avgCost === '' ? 'Cost is required' : undefined}
                  onChange={(avgCost) => setForm((f) => ({ ...f, avgCost }))}
                  placeholder="0"
                />
                <NumberField
                  label={isRealEstate ? "Current Valuation (THB)" : form.assetClass === 'crypto' ? "Current Price per Unit (THB)" : "Current price / unit"}
                  prefix="฿"
                  value={form.price}
                  error={showErrors && form.price === '' ? 'Price is required' : undefined}
                  onChange={(price) => setForm((f) => ({ ...f, price }))}
                  placeholder="0"
                />
              </div>
            </>
          )
        )}
            </div>
          )}
        </div>

        {/* Accordion 2: Dividend tracking (optional for funds and stocks) */}
        {(form.assetClass === 'fund' || form.assetClass === 'stock') && (
          <DividendSection
            isStock={form.assetClass === 'stock'}
            units={Number(form.units) || 0}
            expanded={isDividendExpanded}
            setExpanded={setIsDividendExpanded}
            paysDividend={paysDividend}
            setPaysDividend={setPaysDividend}
            dividendMonths={dividendMonths}
            setDividendMonths={setDividendMonths}
            payoutDpsMap={payoutDpsMap}
            setPayoutDpsMap={setPayoutDpsMap}
            cashAccounts={data.cashAccounts}
            defaultCashAccountId={defaultCashAccountId}
            setDefaultCashAccountId={setDefaultCashAccountId}
          />
        )}

        {/* Safe-Haven Lock Toggle */}
        <label className="flex items-center gap-3 rounded-2xl border border-line bg-surface-muted/50 p-3.5 sm:p-4 cursor-pointer hover:bg-surface-muted transition-colors">
          <input
            type="checkbox"
            checked={isLocked}
            onChange={(e) => setIsLocked(e.target.checked)}
            className="h-4 w-4 rounded border-line text-brand focus:ring-brand accent-brand cursor-pointer"
          />
          <div className="flex-1 text-xs">
            <span className="font-semibold text-ink flex items-center gap-1.5 text-sm">
              <LockClosedIcon className="h-4 w-4 text-amber-500" />
              Lock this asset
            </span>
            <p className="text-ink-muted mt-0.5">
              Protects it from being sold or deleted by accident
            </p>
          </div>
        </label>
      </div>
    </Modal>
  )
}

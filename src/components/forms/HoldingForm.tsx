import { useEffect, useRef, useState } from 'react'
import { Modal } from '../ui/Modal'
import { NumberField, SelectField, TextField } from '../ui/Field'
import { FormActions } from './FormActions'
import { Button } from '../ui/Button'
import { useData } from '../../store/DataContext'
import { useToast } from '../../store/ToastContext'
import { ASSET_META, GRAMS_PER_BAHT_GOLD, goldThbPerGramToXauUsd, upsert } from '../../lib/calc'
import type { AssetClass, DividendPayoutSchedule, Holding, PlannedAsset } from '../../lib/types'
import { dateStrToTimestamp, localDateStr, thb } from '../../lib/format'
import { searchSecurities, type Security } from '../../lib/securities'
import { ChevronDownIcon, PencilIcon } from '../icons'
import { TransactionDateField } from './TransactionDateField'

interface Props {
  open: boolean
  editing: Holding | null
  initialPlannedAsset?: PlannedAsset | null
  initialSection?: 'general' | 'dividend'
  onClose: () => void
}

const SATS_PER_BTC = 100_000_000

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]

const newId = () => crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

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
  assetClass: 'fund' as AssetClass,
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

  // Generic fields
  const [form, setForm] = useState(blank)
  const [showErrors, setShowErrors] = useState(false)

  // Applied FX Rate for stocks
  const [fxRateInput, setFxRateInput] = useState<number | string | ''>('')

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

  const isBtc = form.assetClass === 'crypto' && (
    form.ticker.trim().toUpperCase() === 'BTC' ||
    form.name.toLowerCase().includes('bitcoin')
  )
  const isUsd = form.assetClass === 'stock'
  const isGold = form.assetClass === 'gold'
  const isRealEstate = form.assetClass === 'real_estate'
  const rate = usdThb ?? 1

  // Guard: only reset form when modal freshly opens (false→true),
  // not when editing/price changes due to live price ticks.
  const wasOpen = useRef(false)

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

    if (initialSection === 'dividend') {
      setIsGeneralExpanded(false)
      setIsDividendExpanded(true)
    } else {
      setIsGeneralExpanded(true)
      setIsDividendExpanded(true)
    }

    if (editing) {
      const loadedAvgCost = editing.assetClass === 'stock'
        ? (editing.avgCostUsd ?? (rate > 1 ? Number((editing.avgCost / rate).toFixed(4)) : editing.avgCost))
        : editing.avgCost
      const loadedPrice = editing.assetClass === 'stock'
        ? (rate > 1 ? Number((editing.price / rate).toFixed(4)) : editing.price)
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
        const impliedRate = editing.avgCostThb && editing.avgCostUsd ? editing.avgCostThb / editing.avgCostUsd : (usdThb || 35)
        setFxRateInput(formatCostOrFx(impliedRate))

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
    const fxRate = Number(fxRateInput) || usdThb || 35
    const calculatedThb = Number((totalUsd * fxRate).toFixed(2))
    setThbInvestedInput(calculatedThb)
  }

  const handleAvgCostChange = (newAvgCost: number | string | '') => {
    setForm((f) => ({ ...f, avgCost: newAvgCost }))
    const shares = Number(form.units) || 0
    const avgCost = Number(newAvgCost) || 0
    const totalUsd = Number((shares * avgCost).toFixed(4))
    const fxRate = Number(fxRateInput) || usdThb || 35
    const calculatedThb = Number((totalUsd * fxRate).toFixed(2))
    setThbInvestedInput(calculatedThb)
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
      const fxRate = Number(fxRateInput) || usdThb || 35
      const calculatedThb = Number((totalUsd * fxRate).toFixed(2))
      setThbInvestedInput(calculatedThb)
    }
  }

  const handleAvgCostBlur = () => {
    if (form.assetClass === 'stock') {
      const formatted = formatCostOrFx(form.avgCost)
      setForm((f) => ({ ...f, avgCost: formatted }))
      
      const shares = Number(form.units) || 0
      const avgCost = Number(formatted) || 0
      const totalUsd = Number((shares * avgCost).toFixed(4))
      const fxRate = Number(fxRateInput) || usdThb || 35
      const calculatedThb = Number((totalUsd * fxRate).toFixed(2))
      setThbInvestedInput(calculatedThb)
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
        note: `${sats.toLocaleString()} sats · ฿${spent.toLocaleString()} spent · ${locName} (merged into existing)`,
        afterHoldingState: mergedHolding,
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
      price: editing?.price ?? avgCostThb,
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
      note: `${sats.toLocaleString()} sats · ฿${spent.toLocaleString()} spent · ${locName}`,
      afterHoldingState: savedHolding,
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
        note: `${g.toFixed(4)} g (${bahtAmount} บาททอง) · ฿${spent.toLocaleString()} spent · ${locName} (merged into existing)`,
        afterHoldingState: mergedHolding,
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
      price: avgCostThb,
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
      note: `${g.toFixed(4)} g (${bahtAmount} บาททอง) · ฿${spent.toLocaleString()} spent · ${locName}`,
      afterHoldingState: savedHolding,
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
      (useLivePrice || form.price !== '')
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
      updatedAt: localDateStr(),
    }

    if (isUsd) {
      const fxRateVal = Number(fxRateInput) || usdThb || 35
      const totalThbInvested = parseFloat((Number(thbInvestedInput) || 0).toFixed(2))
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
          changes.push(`Updated gold price to ฿${(currPrice * GRAMS_PER_BAHT_GOLD).toLocaleString()}/บาททอง`)
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
      logNote = `${unitsNum.toLocaleString(undefined, { maximumFractionDigits: 4 })} shares @ ${isUsd ? `$${avgCostInput.toLocaleString()}` : `฿${avgCostInput.toLocaleString()}`}/unit`
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
    })
    showToast(editing ? `Updated ${name}` : `Added ${name} to portfolio`, 'success')
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
  const fxRateVal = Number(fxRateInput) || usdThb || 35

  const totalThbInvestedVal = Number(Number(thbInvestedInput).toFixed(2)) || 0

  const livePriceUsd = editing ? Number((editing.price / (usdThb || 35)).toFixed(4)) : (Number(form.price) || 0)
  const currentMarketValueThb = Number((sharesInputVal * livePriceUsd * (usdThb || fxRateVal)).toFixed(2))
  const netPnlThb = Number((currentMarketValueThb - totalThbInvestedVal).toFixed(2))
  const netReturnPct = totalThbInvestedVal > 0 ? Number(((netPnlThb / totalThbInvestedVal) * 100).toFixed(2)) : 0

  const formattedNetPnlThb = netPnlThb > 0
    ? `+฿${netPnlThb.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : netPnlThb < 0
    ? `-฿${Math.abs(netPnlThb).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `฿0.00`

  // Dividend derived values & actions
  const isStock = form.assetClass === 'stock'
  const currencyPrefix = isStock ? '$' : '฿'
  const currencyUnit = isStock ? '$/share' : '฿/หุ้น'

  const totalAnnualDps = dividendMonths.reduce((sum, m) => {
    const raw = payoutDpsMap[m]
    const num = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''))
    return sum + (isNaN(num) ? 0 : num)
  }, 0)

  const currentUnits = Number(form.units) || 0
  const estAnnualGross = currentUnits * totalAnnualDps
  const estAnnualNet = estAnnualGross * 0.90 // 10% tax estimate

  const handleToggleMonth = (mNum: number) => {
    setDividendMonths((prev) => {
      const isSelected = prev.includes(mNum)
      if (isSelected) {
        setPayoutDpsMap((prevMap) => {
          const next = { ...prevMap }
          delete next[mNum]
          return next
        })
        return prev.filter((m) => m !== mNum)
      } else {
        const existingValues = Object.values(payoutDpsMap).filter((v) => v !== '' && Number(v) > 0)
        const defaultVal = existingValues.length > 0 ? existingValues[0] : ''
        setPayoutDpsMap((prevMap) => ({
          ...prevMap,
          [mNum]: prevMap[mNum] ?? defaultVal,
        }))
        return [...prev, mNum].sort((a, b) => a - b)
      }
    })
  }

  const handleApplyDpsToAll = () => {
    const sorted = dividendMonths.slice().sort((a, b) => a - b)
    const firstSelectedMonth = sorted.find((m) => {
      const v = payoutDpsMap[m]
      return v !== '' && !isNaN(Number(v)) && Number(v) > 0
    }) ?? sorted[0]
    const sourceVal = firstSelectedMonth ? (payoutDpsMap[firstSelectedMonth] ?? '') : ''
    if (sourceVal === '' || Number(sourceVal) <= 0) return

    setPayoutDpsMap(() => {
      const next: Record<number, number | string> = {}
      dividendMonths.forEach((m) => {
        next[m] = sourceVal
      })
      return next
    })
    showToast('คัดลอกยอดเงินปันผลไปยังทุกรอบเรียบร้อย', 'info')
  }

  const modalDescription = isBtc
    ? 'Log your first purchase in Satoshi.'
    : isGold
    ? 'Log your first gold purchase in grams.'
    : isUsd
    ? `Prices in USD, converted to THB at ${usdThb ? `฿${usdThb.toFixed(2)}/USD` : 'live rate'}.`
    : isRealEstate
    ? 'บันทึกบ้าน คอนโด หรือที่ดิน พร้อมราคาซื้อและมูลค่าประเมินปัจจุบัน'
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
          <Button onClick={saveBtc} className="w-full">
            Add holding
          </Button>
        ) : isGold && !editing ? (
          <Button onClick={saveGold} className="w-full">
            Add holding
          </Button>
        ) : (
          <FormActions
            editing={!!editing}
            canSave={true}
            onSave={save}
            onDelete={
              editing
                ? () => { removeHolding(editing.id); onClose() }
                : undefined
            }
          />
        )
      }
    >
      <div className="space-y-4">
        {/* Accordion 1: ข้อมูลทั่วไป (General Info) */}
        <div className="rounded-2xl border border-line bg-surface overflow-hidden shadow-2xs">
          <button
            type="button"
            onClick={() => setIsGeneralExpanded((v) => !v)}
            className="w-full flex items-center justify-between p-3.5 sm:p-4 text-left hover:bg-brand-soft/50 transition-colors cursor-pointer select-none"
            aria-expanded={isGeneralExpanded}
          >
            <div className="flex items-center gap-2 min-w-0 pr-2">
              <span className="text-sm">📦</span>
              <span className="text-sm font-bold text-ink truncate">
                ข้อมูลทั่วไป (General Info)
              </span>
              {!isGeneralExpanded && (form.name || form.ticker) && (
                <span className="hidden sm:inline-flex items-center rounded-md bg-surface-muted px-2 py-0.5 text-xs font-medium text-ink-muted truncate max-w-[200px]">
                  {form.ticker ? `${form.ticker} · ` : ''}{form.name || 'Holding'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!isGeneralExpanded && (
                <span className="text-xs text-brand font-medium">แตะเพื่อดู/แก้ไข</span>
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
            { value: 'fund', label: 'Thai Assets (Stocks, Funds, DR)' },
            { value: 'stock', label: 'US Stock' },
            { value: 'crypto', label: 'Crypto (BTC, ETH, and other tokens)' },
            { value: 'gold', label: 'Gold' },
            { value: 'real_estate', label: 'Real Estate (House / Condo / Land)' },
          ]}
        />

        {/* Transaction Date */}
        <TransactionDateField value={txDate} onChange={setTxDate} />

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
                  setSuggestions((!isBtc && !isGold && !isRealEstate) ? searchSecurities(name, form.assetClass) : [])
                }}
                onBlur={() => setTimeout(() => setSuggestions([]), 150)}
                placeholder={isBtc ? 'e.g. My Bitcoin' : isUsd ? 'e.g. Apple Inc.' : isGold ? 'e.g. My Gold' : isRealEstate ? 'e.g. Sukhumvit Condo, Modern House' : 'e.g. Kasikorn Fund'}
              />
              {suggestions.length > 0 && (
                <ul className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
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
                        <span className="min-w-[52px] rounded-md bg-surface-muted px-1.5 py-0.5 text-center text-xs font-bold tracking-wide text-ink-muted">
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
                          {isSelected ? '✓ ' : ''}{tag}
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
              <label className="text-sm font-medium text-ink-soft">Purchase Unit / หน่วยซื้อ</label>
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
                  กรัม (Grams)
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
                  บาททองคำ (15.244g)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {goldUnit === 'grams' ? (
                <NumberField
                  label="Grams bought (กรัม)"
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
                  label="Weight bought in บาททองคำ (ทองคำแท่ง)"
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
                label="THB spent (บาท)"
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
                  <span className="text-ink-soft">Implied cost / บาททองคำ</span>
                  <span className="font-semibold tnum text-brand">
                    {thb(goldImpliedPrice * GRAMS_PER_BAHT_GOLD)}
                    {rate > 1 && ` ($${Math.round(goldThbPerGramToXauUsd(goldImpliedPrice, rate)).toLocaleString()}/oz XAUUSD)`}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-soft">Total weight</span>
                  <span className="font-semibold tnum text-ink">{goldGrams.toFixed(4)} g ({(goldGrams / GRAMS_PER_BAHT_GOLD).toFixed(4)} บาททอง)</span>
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
                  ≈ {(Number(form.units) / GRAMS_PER_BAHT_GOLD).toFixed(4)} บาททองคำ
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
                    ≈ {thb(Number(form.avgCost) * GRAMS_PER_BAHT_GOLD)} / บาททองคำ
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
                    ≈ {thb(Number(form.price) * GRAMS_PER_BAHT_GOLD)} / บาททองคำ
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
              <div className="rounded-2xl border border-line-strong bg-surface-muted p-4 space-y-4 shadow-sm">
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
                    {isThbInvestedManuallyEdited && (
                      <div className="text-right -mt-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setIsThbInvestedManuallyEdited(false)
                            const shares = Number(form.units) || 0
                            const avgCost = Number(form.avgCost) || 0
                            const fxRate = usdThb || 35
                            const calculatedThb = Number((shares * avgCost * fxRate).toFixed(2))
                            setThbInvestedInput(calculatedThb)
                            setFxRateInput(formatCostOrFx(fxRate))
                          }}
                          aria-label="Reset THB cost basis to calculate from USD shares and cost"
                          className="text-xs font-semibold text-brand hover:underline cursor-pointer"
                        >
                          Reset to calculated (฿{Number((sharesInputVal * avgCostUsdVal * (usdThb || 35)).toFixed(2)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} @ {Number((usdThb || 35).toFixed(2))})
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
                        ${livePriceUsd.toFixed(2)}
                      </span>
                      <span className="ml-auto rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-bold text-brand">Live</span>
                    </div>
                  </div>
                ) : (
                  <NumberField
                    label="Live Market Price per Share (USD)"
                    prefix="$"
                    value={form.price}
                    error={showErrors && form.price === '' ? 'Price is required' : undefined}
                    onChange={(price) => setForm((f) => ({ ...f, price }))}
                    placeholder="0"
                    step={0.01}
                  />
                )}

                <NumberField
                  label="Applied FX Rate (USD/THB)"
                  value={fxRateInput}
                  error={showErrors && fxRateInput === '' ? 'FX rate is required' : undefined}
                  onChange={handleFxRateChange}
                  onBlur={handleFxRateBlur}
                  placeholder="e.g. 35.20"
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
                  label={isRealEstate ? "Purchase Cost (THB)" : form.assetClass === 'crypto' ? "Cost per Unit (THB)" : "Avg cost / unit"}
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

        {/* Accordion 2: ข้อมูลเงินปันผล (Dividend Tracking - Optional for Fund & Stock) */}
        {!isBtc && !isGold && !isRealEstate && (
          <div className="rounded-2xl border border-line bg-surface overflow-hidden shadow-2xs">
            <button
              type="button"
              onClick={() => setIsDividendExpanded((v) => !v)}
              className="w-full flex items-center justify-between p-3.5 sm:p-4 text-left hover:bg-surface-muted/50 transition-colors cursor-pointer select-none"
              aria-expanded={isDividendExpanded}
            >
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <span className="text-sm">💰</span>
                <span className="text-sm font-bold text-ink truncate">
                  ข้อมูลเงินปันผล (Dividend & Payouts)
                </span>
                <span
                  className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium shrink-0 ${
                    paysDividend
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold'
                      : 'bg-surface-muted text-ink-muted'
                  }`}
                >
                  {paysDividend ? `${dividendMonths.length} ครั้ง/ปี` : 'ไม่ได้เปิด'}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!isDividendExpanded && (
                  <span className="text-xs text-brand font-medium">แตะเพื่อดู/แก้ไข</span>
                )}
                <ChevronDownIcon
                  className={`h-4 w-4 text-ink-muted transition-transform duration-200 ${
                    isDividendExpanded ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </button>

            {isDividendExpanded && (
              <div className="p-3.5 sm:p-4 pt-1 space-y-3 border-t border-line/60">
                <div className="flex items-center justify-between gap-2 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none min-w-0">
                    <input
                      type="checkbox"
                      checked={paysDividend}
                      onChange={(e) => setPaysDividend(e.target.checked)}
                      className="h-4 w-4 rounded-md border-line text-emerald-600 focus:ring-emerald-500/30 shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="text-sm font-bold text-ink flex items-center gap-1.5 whitespace-nowrap">
                        เปิดบันทึกเงินปันผล
                      </span>
                      <p className="text-xs text-ink-muted truncate">
                        เปิดบันทึกเงินปันผลเพื่อคำนวณกระแสเงินสด
                      </p>
                    </div>
                  </label>
                  <span className="text-xs font-medium text-ink-muted whitespace-nowrap shrink-0">
                    (optional)
                  </span>
                </div>

            {paysDividend && (
              <div className="space-y-4 pt-2 border-t border-line/60">
                {/* 12 Months selection pills */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 whitespace-nowrap">
                    <label className="text-xs font-semibold text-ink-soft whitespace-nowrap">
                      เดือนที่จ่ายปันผล
                    </label>
                    {dividendMonths.length > 0 && (
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap shrink-0">
                        {dividendMonths.length} ครั้ง/ปี
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-6 sm:grid-cols-12 gap-1 text-xs">
                    {THAI_MONTHS_SHORT.map((mName, idx) => {
                      const mNum = idx + 1
                      const isSelected = dividendMonths.includes(mNum)

                      return (
                        <button
                          key={mNum}
                          type="button"
                          onClick={() => handleToggleMonth(mNum)}
                          className={`py-1.5 rounded-lg font-bold transition-all cursor-pointer border ${
                            isSelected
                              ? 'bg-emerald-500 text-white border-emerald-500 shadow-2xs scale-105'
                              : 'bg-surface text-ink-muted border-line hover:text-ink hover:border-line-strong'
                          }`}
                        >
                          {mName}
                        </button>
                      )
                    })}
                  </div>
                  {dividendMonths.length > 0 && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium pt-0.5">
                      📅 แจ้งเตือนรับเงินปันผลในเดือน: {dividendMonths.slice().sort((a, b) => a - b).map((m) => THAI_MONTHS_SHORT[m - 1]).join(', ')}
                    </p>
                  )}
                </div>

                {/* Per-round DPS input section */}
                {dividendMonths.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-line bg-surface/40 p-3 text-center">
                    <p className="text-xs text-ink-muted">
                      👆 แตะเลือกเดือนด้านบน เพื่อกำหนดงวดที่คาดว่าจะได้รับเงินปันผล
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                          💵 กำหนดเงินปันผลต่อหุ้น (DPS) ในแต่ละงวด
                        </span>
                        <p className="text-xs text-ink-muted">
                          ระบุยอดเงินปันผลต่อหุ้นแยกตามแต่ละรอบที่จ่ายจริง
                        </p>
                      </div>
                      {dividendMonths.length > 1 && (
                        <button
                          type="button"
                          onClick={handleApplyDpsToAll}
                          className="inline-flex items-center text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                        >
                          ⚡ ใช้ยอดเท่ากันทุกรอบ
                        </button>
                      )}
                    </div>

                    <div className={`grid gap-2.5 ${dividendMonths.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
                      {dividendMonths.slice().sort((a, b) => a - b).map((mNum, roundIdx) => (
                        <div key={mNum} className="rounded-xl border border-line bg-surface/80 p-2.5 shadow-2xs space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                                {roundIdx + 1}
                              </span>
                              รอบเดือน {THAI_MONTHS_SHORT[mNum - 1]}
                            </span>
                            <span className="text-xs font-medium text-ink-muted">
                              {currencyUnit}
                            </span>
                          </div>
                          <NumberField
                            label=""
                            prefix={currencyPrefix}
                            placeholder="0.00"
                            value={payoutDpsMap[mNum] ?? ''}
                            onChange={(val) => {
                              setPayoutDpsMap((prev) => ({ ...prev, [mNum]: val }))
                            }}
                          />
                        </div>
                      ))}
                    </div>

                    {/* Summary box */}
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div>
                        <span className="text-ink-muted block text-xs">รวมปันผลทั้งปี (Total Annual DPS):</span>
                        <span className="font-display font-extrabold text-sm text-emerald-600 dark:text-emerald-400 tnum">
                          {currencyPrefix}{totalAnnualDps.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                          <span className="text-xs font-normal text-ink-muted ml-1">/{isStock ? 'share' : 'หุ้น'}</span>
                        </span>
                      </div>
                      {currentUnits > 0 && estAnnualGross > 0 && (
                        <div className="text-right">
                          <span className="text-ink-muted block text-xs">ประมาณการปันผลต่อปี ({currentUnits.toLocaleString()} หุ้น):</span>
                          <span className="font-display font-bold text-sm text-ink tnum">
                            ~{currencyPrefix}{estAnnualNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            <span className="text-xs text-ink-muted ml-1 font-normal">(สุทธิหลังหักภาษี 10%)</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Default Cash Account */}
                <SelectField
                  label="Default Cash Account (เข้าบัญชีเริ่มต้น)"
                  value={defaultCashAccountId}
                  options={[
                    { value: '', label: 'None (ไม่ระบุ)' },
                    ...(data.cashAccounts ?? []).map((c) => ({
                      value: c.id,
                      label: `${c.name} (${c.currency === 'USD' ? '$' : '฿'}${c.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`,
                    })),
                  ]}
                  onChange={setDefaultCashAccountId}
                />
              </div>
            )}
            </div>
          )}
        </div>
        )}
      </div>
    </Modal>
  )
}

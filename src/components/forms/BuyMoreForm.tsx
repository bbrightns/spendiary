import { useEffect, useRef, useState } from 'react'
import { Modal } from '../ui/Modal'
import { SegmentedControl } from '../ui/SegmentedControl'
import { BUY_SELL_SEGMENT_OPTIONS } from './buySellOptions'
import { NumberField } from '../ui/Field'
import { FormActions } from './FormActions'
import { useData } from '../../store/DataContext'
import { useToast } from '../../store/ToastContext'
import { ASSET_META, GRAMS_PER_BAHT_GOLD, applyBuy, goldThbPerGramToXauUsd, hasRealPrice, holdingMetrics } from '../../lib/calc'
import { buyInto, hasLocations, initialLocationId, NEW_LOCATION } from '../../lib/locations'
import { LocationSelect } from './LocationSelect'
import type { AcquisitionSource, Holding } from '../../lib/types'
import { dateStrToTimestamp, money, thb, localDateStr } from '../../lib/format'
import { isValidRate, rateOrZero } from '../../lib/fx'
import { isValidPrice } from '../../lib/priceCache'
import { TransactionDateField } from './TransactionDateField'
import { AcquisitionSourceField } from './AcquisitionSourceField'
import { CashAccountField } from './CashAccountField'
import { UsdTradeFields } from './UsdTradeFields'
import { fieldNumber, resolveUsdTrade, type TradeCurrency } from '../../lib/usdTrade'
import { amountInAccountCurrency, type TradeAmount } from '../../lib/cashPayment'

interface Props {
  open: boolean
  holding: Holding | null
  onClose: () => void
  onSwitchToSell?: () => void
  /** When set, the form is locked to this storage location — the picker is hidden. */
  lockedLocationId?: string | null
}

const SATS_PER_BTC = 100_000_000

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

export function BuyMoreForm({ open, holding, onClose, onSwitchToSell, lockedLocationId }: Props) {
  const { buyMoreHolding, usdThb, data } = useData()
  const { showToast } = useToast()

  // Cash Account integration
  const [cashAccountId, setCashAccountId] = useState<string>('none')

  // Shared state
  const [units, setUnits] = useState<number | ''>('')
  const [price, setPrice] = useState<number | ''>('')
  const [showErrors, setShowErrors] = useState(false)

  // BTC-specific state
  const [satoshi, setSatoshi] = useState<number | ''>('')
  const [thbSpent, setThbSpent] = useState<number | ''>('')
  // Wallet, vault or broker the buy goes into (BTC, gold, and US stocks that have brokers)
  const [locationId, setLocationId] = useState('')
  const [newLocationName, setNewLocationName] = useState('')

  // Gold-specific state
  const [goldUnit, setGoldUnit] = useState<'grams' | 'baht'>('grams')
  const [goldGrams, setGoldGrams] = useState<number | ''>('')
  const [goldBaht, setGoldBaht] = useState<number | ''>('')
  const [goldThbSpent, setGoldThbSpent] = useState<number | ''>('')

  // US Stock-specific state
  const [amountSpentThb, setAmountSpentThb] = useState<number | string | ''>('')
  const [fxRate, setFxRate] = useState<number | string | ''>('')
  const [priceUsd, setPriceUsd] = useState<number | string | ''>('')
  const [sharesBought, setSharesBought] = useState<number | string | ''>('')
  // Without a paying account (or a USD/THB one deciding it): which currency the money moved in
  const [paidIn, setPaidIn] = useState<TradeCurrency>('USD')
  // USD buys: the broker's fee, paid on top of shares x price
  const [feeUsd, setFeeUsd] = useState<number | string | ''>('')

  // Backdated transaction date
  const [txDate, setTxDate] = useState<string>(localDateStr())

  // Bought with own money, or received as a gift / inheritance (no cash leaves, cost = market value)
  const [source, setSource] = useState<AcquisitionSource>('bought')
  const [receivedFrom, setReceivedFrom] = useState('')
  const isReceived = source === 'received'

  const isBtc = holding?.assetClass === 'crypto'
  const isGold = holding?.assetClass === 'gold'
  const isStock = holding?.assetClass === 'stock'
  // Real rate or 0 (never a stand-in value): the FX field is required, so USD maths waits for a typed rate
  const rate = rateOrZero(usdThb)
  const existingLocations = holding?.locations ?? []
  /** Where the buy goes: the picked location, or a new one by name */
  const buyTarget = locationId === NEW_LOCATION ? { name: newLocationName.trim() } : { id: locationId }

  // Guard: only reset form when modal *freshly opens* (false→true),
  // not when holding changes mid-session due to live price ticks.
  const wasOpen = useRef(false)

  const priceInThb = isStock && rate > 1 ? Number(price) * rate : Number(price)
  const valid = units !== '' && Number(units) > 0 && price !== '' && Number(price) > 0
  const preview = valid && holding ? applyBuy(holding, Number(units), priceInThb) : null
  const cost = valid ? Number(units) * priceInThb : 0
  const label = holding?.assetClass === 'fund' ? 'units' : 'shares'

  // ALL useEffects at top level — no hooks after conditional returns
  useEffect(() => {
    const justOpened = !wasOpen.current && open
    wasOpen.current = open
    if (!justOpened || !holding) return
    setTxDate(localDateStr())
    setUnits('')
    setShowErrors(false)
    setCashAccountId('none')
    setPaidIn('USD')
    setFeeUsd('')
    setSource('bought')
    setReceivedFrom('')
    setSatoshi('')
    setThbSpent('')
    setLocationId(initialLocationId(holding.locations ?? [], lockedLocationId, holding.assetClass))
    setNewLocationName('')
    setGoldUnit('grams')
    setGoldGrams('')
    setGoldBaht('')
    setGoldThbSpent('')
    // Pre-fill price: USD for stocks, THB for funds, not used for BTC.
    // Only a real price is offered; a cost stand-in (no price yet) leaves it for the user to type.
    if (!isBtc && !hasRealPrice(holding)) {
      setPrice('')
      if (isStock) {
        setFxRate('')
        setPriceUsd('')
        setAmountSpentThb('')
        setSharesBought('')
      }
    } else if (!isBtc) {
      if (isStock && rate > 1) {
        const usdPrice = Number((holding.price / rate).toFixed(4))
        setPrice(usdPrice)
        setFxRate('')
        setPriceUsd(formatCostOrFx(usdPrice))
        setAmountSpentThb('')
        setSharesBought('')
      } else {
        setPrice(holding.price)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resets only when the form opens or the holding changes; a live rate tick must not wipe what was typed
  }, [open, holding])

  if (!holding) return null

  // A gift never touches a cash account
  const payFromId = !isReceived && cashAccountId !== 'none' ? cashAccountId : undefined
  const payFrom = payFromId ? data.cashAccounts.find((c) => c.id === payFromId) : undefined
  /** What this buy takes out of the paying account, in that account's currency (null: a USD account and no rate) */
  const payAmount = (trade: TradeAmount) => amountInAccountCurrency(payFrom, trade, rate)

  // US stocks: the paying account's currency decides which numbers are asked for (a gift is valued in USD)
  const tradeCurrency: TradeCurrency = isReceived ? 'USD' : payFrom ? (payFrom.currency ?? 'THB') : paidIn
  const stockTrade = isStock
    ? resolveUsdTrade({
        currency: tradeCurrency,
        shares: fieldNumber(sharesBought),
        priceUsd: fieldNumber(priceUsd),
        amountThb: fieldNumber(amountSpentThb),
        fx: fieldNumber(fxRate),
        liveFx: rate,
        feeUsd: isReceived ? 0 : fieldNumber(feeUsd),
        side: 'buy',
      })
    : null
  const stockCurrentUnits = holding.units ?? holding.totalUnits ?? 0
  const stockPrevThbInvested = holding.totalThbInvested ?? stockCurrentUnits * (holding.avgCostThb ?? holding.avgCost ?? 0)
  const fromName = receivedFrom.trim()
  /** Note tail: who it came from, or which account paid */
  const noteSuffix = isReceived
    ? ` · Received${fromName ? ` from ${fromName}` : ''}`
    : (payFromId ? ` · Paid from ${data.cashAccounts.find((c) => c.id === payFromId)?.name ?? ''}` : '')
  const spentWord = isReceived ? 'worth' : 'spent'
  const sourceParams = isReceived ? { source: 'received' as const, receivedFrom: fromName || undefined } : {}
  const verb = isReceived ? 'Received' : 'Bought'
  const toastTitle = isReceived ? 'Gift recorded!' : 'Buy recorded!'
  // Short verb title; which holding (and where it goes) is in the description
  const modalTitle = isReceived ? 'Add gift' : 'Buy more'

  // Only a real price can value a gift; a cost stand-in (no price yet) leaves the value for the user to type
  const knowsPrice = hasRealPrice(holding) && isValidPrice(holding.price)
  /** Fills in the value of a received amount at today's price (THB), when there is one */
  const fillMarketValue = (set: (value: number) => void, amount: number) => {
    if (knowsPrice) set(Math.round(amount * holding.price * 100) / 100)
  }
  const receivedHint = knowsPrice ? 'Today’s price · editable' : 'No price yet · type the value on the day'

  const sourceField = (
    <AcquisitionSourceField
      source={source}
      onSourceChange={(next) => {
        setSource(next)
        if (next !== 'received') return
        // Pre-fill the cost with today's market value; the user can still change it
        if (isBtc && satoshi !== '' && Number(satoshi) > 0) fillMarketValue(setThbSpent, Number(satoshi) / SATS_PER_BTC)
        if (isGold && goldGrams !== '' && Number(goldGrams) > 0) fillMarketValue(setGoldThbSpent, Number(goldGrams))
      }}
      receivedFrom={receivedFrom}
      onReceivedFromChange={setReceivedFrom}
    />
  )

  const cashField = (trade: TradeAmount) => isReceived ? null : (
    <CashAccountField
      label="Take the payment from a cash account"
      accounts={data.cashAccounts ?? []}
      value={cashAccountId}
      onChange={setCashAccountId}
      direction="pay"
      amount={trade.thb > 0 ? payAmount(trade) : 0}
      showErrors={showErrors}
    />
  )

  // Brokers for a US stock only once it has some; BTC and gold always go into a location
  const stockUsesBroker = isStock && hasLocations(holding)
  const brokerMissing = stockUsesBroker && locationId === NEW_LOCATION && !newLocationName.trim()
  const locationPicker = (
    <LocationSelect
      assetClass={holding.assetClass}
      locations={existingLocations}
      value={locationId}
      onChange={setLocationId}
      newName={newLocationName}
      onNewNameChange={setNewLocationName}
      showQty
      error={showErrors && locationId === NEW_LOCATION && !newLocationName.trim() ? 'Required' : undefined}
    />
  )
  const lockedName = lockedLocationId ? existingLocations.find((l) => l.id === lockedLocationId)?.name : undefined

  // ── Gold path ──
  if (isGold) {
    const goldExistingLocations = existingLocations
    const isNewGoldLoc = locationId === NEW_LOCATION
    const goldLocName = isNewGoldLoc
      ? newLocationName.trim()
      : (goldExistingLocations.find((l) => l.id === locationId)?.name ?? '')
    const g = goldUnit === 'baht'
      ? (goldBaht !== '' ? Number(goldBaht) * GRAMS_PER_BAHT_GOLD : 0)
      : Number(goldGrams)
    const spent = Number(goldThbSpent)
    const goldValid =
      g > 0 &&
      goldThbSpent !== '' && spent > 0 &&
      goldLocName.length > 0
    const impliedPrice = g > 0 ? spent / g : 0
    const totalGrams = holding.units ?? 0
    const totalBaht = totalGrams / GRAMS_PER_BAHT_GOLD

    const lockedGoldLocName = lockedLocationId
      ? (goldExistingLocations.find((l) => l.id === lockedLocationId)?.name ?? '')
      : ''

    function saveGold() {
      const pay = payAmount({ thb: spent })
      if (!goldValid || (payFromId && pay === null)) { setShowErrors(true); return }
      const afterHoldingState = buyInto(holding!, buyTarget, g, spent).holding
      const bahtAmount = (g / GRAMS_PER_BAHT_GOLD).toFixed(4)
      buyMoreHolding({
        updatedHolding: afterHoldingState,
        cashAccountId: payFromId,
        cashDeductAmount: payFromId ? pay ?? undefined : undefined,
        note: `+${g.toFixed(4)} g (${bahtAmount} gold baht) · ฿${spent.toLocaleString()} ${spentWord} · ${goldLocName}${noteSuffix}`,
        timestamp: dateStrToTimestamp(txDate),
        ...sourceParams,
      })
      showToast(`${verb} ${g.toFixed(4)}g (${bahtAmount} gold baht) gold for ${holding!.name}`, 'success', undefined, { popup: true, title: toastTitle })
      onClose()
    }

    return (
      <Modal
        open={open}
        onClose={onClose}
        title={modalTitle}
        description={lockedGoldLocName
          ? `${holding.name} · goes into "${lockedGoldLocName}".`
          : `${holding.name} · in grams or gold baht (1 gold baht = 15.244 g). Choose or create a location.`}
        footer={<FormActions editing={false} canSave onSave={saveGold} submitLabel="Add to holding" />}
      >
        <div className="space-y-4">
          {onSwitchToSell && (
            <div className="mb-2">
              <SegmentedControl
                value="buy"
                onChange={(val) => {
                  if (val === 'sell') onSwitchToSell()
                }}
                options={BUY_SELL_SEGMENT_OPTIONS}
              />
            </div>
          )}

          {/* Transaction Date */}
          <TransactionDateField value={txDate} onChange={setTxDate} />

          {sourceField}

          <div className="rounded-2xl bg-surface-muted px-4 py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-muted">Currently holding</span>
              <span className="font-semibold tnum text-ink">
                {totalGrams.toFixed(2)} g ({totalBaht.toFixed(4)} gold baht)
              </span>
            </div>
          </div>

          {lockedLocationId && !isNewGoldLoc ? null : locationPicker}

          {/* Unit selector tab */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-ink-soft">{isReceived ? 'Unit' : 'Purchase unit'}</label>
            <SegmentedControl
              size="sm"
              value={goldUnit}
              onChange={setGoldUnit}
              options={[
                { value: 'grams', label: 'Grams' },
                { value: 'baht', label: 'Gold baht (15.244 g)' },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 gap-3">
            {goldUnit === 'grams' ? (
              <NumberField
                label={isReceived ? 'Grams received' : 'Grams bought'}
                value={goldGrams}
                error={showErrors && (goldGrams === '' || Number(goldGrams) <= 0) ? 'Required (> 0)' : undefined}
                onChange={(val) => {
                  setGoldGrams(val)
                  if (val !== '' && Number(val) > 0) {
                    setGoldBaht(Number((Number(val) / GRAMS_PER_BAHT_GOLD).toFixed(6)))
                    if (isReceived) fillMarketValue(setGoldThbSpent, Number(val))
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
                    setGoldGrams(Number((Number(val) * GRAMS_PER_BAHT_GOLD).toFixed(6)))
                    if (isReceived) fillMarketValue(setGoldThbSpent, Number(val) * GRAMS_PER_BAHT_GOLD)
                  } else {
                    setGoldGrams('')
                  }
                }}
                placeholder="e.g. 1.0"
                step={0.0001}
              />
            )}
            <NumberField
              label={isReceived ? 'Value when received (THB)' : 'THB spent'}
              hint={isReceived ? receivedHint : undefined}
              prefix="฿"
              value={goldThbSpent}
              error={showErrors && (goldThbSpent === '' || Number(goldThbSpent) <= 0) ? 'Required (> 0)' : undefined}
              onChange={setGoldThbSpent}
              placeholder="0"
            />
          </div>

          {cashField({ thb: spent })}

          {g > 0 && spent > 0 && (
            <div
              className="rounded-2xl border px-4 py-3 space-y-1.5"
              style={{
                borderColor: `color-mix(in srgb, ${ASSET_META[holding.assetClass].color} 35%, transparent)`,
                background: `color-mix(in srgb, ${ASSET_META[holding.assetClass].color} 10%, transparent)`,
              }}
            >
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-soft">Implied price / gram</span>
                <span className="font-semibold tnum text-ink">{thb(impliedPrice, true)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-soft">Implied cost / gold baht</span>
                <span className="font-semibold tnum text-link">
                  {thb(impliedPrice * GRAMS_PER_BAHT_GOLD)}
                  {rate > 1 && ` ($${Math.round(goldThbPerGramToXauUsd(impliedPrice, rate)).toLocaleString()}/oz XAUUSD)`}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-soft">Gold amount</span>
                <span className="font-semibold tnum text-ink">{g.toFixed(4)} g ({(g / GRAMS_PER_BAHT_GOLD).toFixed(4)} gold baht)</span>
              </div>
            </div>
          )}
        </div>
      </Modal>
    )
  }

  // ── BTC path ──
  if (isBtc) {
    const isNew = locationId === NEW_LOCATION
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
    const totalSats = Math.round((holding.units ?? 0) * SATS_PER_BTC)

    const lockedBtcLocName = lockedLocationId
      ? (existingLocations.find((l) => l.id === lockedLocationId)?.name ?? '')
      : ''

    function saveBtc() {
      const pay = payAmount({ thb: spent })
      if (!btcValid || (payFromId && pay === null)) { setShowErrors(true); return }
      const afterHoldingState = buyInto(holding!, buyTarget, sats / SATS_PER_BTC, spent).holding
      buyMoreHolding({
        updatedHolding: afterHoldingState,
        cashAccountId: payFromId,
        cashDeductAmount: payFromId ? pay ?? undefined : undefined,
        note: `+${sats.toLocaleString()} sats · ฿${spent.toLocaleString()} ${spentWord} · ${locName}${noteSuffix}`,
        timestamp: dateStrToTimestamp(txDate),
        ...sourceParams,
      })
      showToast(`${verb} ${sats.toLocaleString()} sats for ${holding!.name}`, 'success', undefined, { popup: true, title: toastTitle })
      onClose()
    }

    return (
      <Modal
        open={open}
        onClose={onClose}
        title={modalTitle}
        description={lockedBtcLocName
          ? `${holding.name} · goes into "${lockedBtcLocName}".`
          : `${holding.name} · ${isReceived ? 'the BTC you received' : 'a purchase'} in Satoshi. Choose or create a location.`}
        footer={<FormActions editing={false} canSave onSave={saveBtc} submitLabel="Add to holding" />}
      >
        <div className="space-y-4">
          {onSwitchToSell && (
            <div className="mb-2">
              <SegmentedControl
                value="buy"
                onChange={(val) => {
                  if (val === 'sell') onSwitchToSell()
                }}
                options={BUY_SELL_SEGMENT_OPTIONS}
              />
            </div>
          )}

          {/* Transaction Date */}
          <TransactionDateField value={txDate} onChange={setTxDate} />

          {sourceField}

          <div className="rounded-2xl bg-surface-muted px-4 py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-muted">Currently holding</span>
              <span className="font-semibold tnum text-ink">
                {totalSats.toLocaleString()} sats ({(totalSats / SATS_PER_BTC).toFixed(8)} BTC)
              </span>
            </div>
          </div>

          {lockedLocationId && !isNew ? null : locationPicker}

          <div className="grid grid-cols-1 gap-3 ">
            <NumberField
              label={isReceived ? 'Satoshi received' : 'Satoshi bought'}
              value={satoshi}
              error={showErrors && (satoshi === '' || Number(satoshi) <= 0) ? 'Required (> 0)' : undefined}
              onChange={(val) => {
                setSatoshi(val)
                if (isReceived && val !== '' && Number(val) > 0) fillMarketValue(setThbSpent, Number(val) / SATS_PER_BTC)
              }}
              placeholder="e.g. 500000"
              step={1}
            />
            <NumberField
              label={isReceived ? 'Value when received (THB)' : 'THB spent'}
              hint={isReceived ? receivedHint : undefined}
              prefix="฿"
              value={thbSpent}
              error={showErrors && (thbSpent === '' || Number(thbSpent) <= 0) ? 'Required (> 0)' : undefined}
              onChange={setThbSpent}
              placeholder="0"
            />
          </div>

          {cashField({ thb: spent })}

          {satoshi !== '' && Number(satoshi) > 0 && thbSpent !== '' && Number(thbSpent) > 0 && (
            <div
              className="rounded-2xl border px-4 py-3"
              style={{
                borderColor: `color-mix(in srgb, ${ASSET_META[holding.assetClass].color} 35%, transparent)`,
                background: `color-mix(in srgb, ${ASSET_META[holding.assetClass].color} 10%, transparent)`,
              }}
            >
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-soft">Implied price / BTC</span>
                <span className="font-semibold tnum text-ink">
                  {isValidRate(usdThb) ? <>{money(impliedPrice / usdThb, 'USD')} (≈ {thb(impliedPrice)})</> : thb(impliedPrice)}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-sm">
                <span className="text-ink-soft">BTC amount</span>
                <span className="font-semibold tnum text-ink">{btcAmount.toFixed(8)} BTC</span>
              </div>
            </div>
          )}
        </div>
      </Modal>
    )
  }

  // ── Fund / Stock path ──

  function save() {
    if (isStock) {
      const t = stockTrade
      const pay = t ? payAmount({ thb: t.thb, usd: t.usd }) : null
      if (!t || brokerMissing || (payFromId && pay === null)) { setShowErrors(true); return }
      const unitsBoughtNum = t.shares
      const priceUsdNum = t.priceUsd

      const currentUnits = holding!.units ?? holding!.totalUnits ?? 0
      const currentThbInvested = holding!.totalThbInvested ?? (currentUnits * (holding!.avgCostThb ?? holding!.avgCost ?? 0))
      const currentUsdInvested = holding!.totalUsdInvested ?? (currentUnits * (holding!.avgCostUsd ?? (rate > 0 ? (holding!.avgCost ?? 0) / rate : 0)))

      // Totals before this buy, with the USD cost filled in for holdings saved without it
      const base: Holding = { ...holding!, units: currentUnits, totalThbInvested: currentThbInvested, totalUsdInvested: currentUsdInvested }
      const bought = buyInto(base, stockUsesBroker ? buyTarget : undefined, unitsBoughtNum, t.thb, t.usd).holding
      // The market price in THB at today's rate (the trade's own rate when none is loaded)
      const updated: Holding = { ...bought, price: priceUsdNum * (rate > 0 ? rate : t.fx), updatedAt: localDateStr(new Date()) }
      const brokerName = stockUsesBroker ? (lockedName ?? (locationId === NEW_LOCATION ? newLocationName.trim() : existingLocations.find((l) => l.id === locationId)?.name)) : undefined
      buyMoreHolding({
        updatedHolding: updated,
        cashAccountId: payFromId,
        cashDeductAmount: payFromId ? pay ?? undefined : undefined,
        note: `+${unitsBoughtNum.toLocaleString(undefined, { maximumFractionDigits: 4 })} shares @ $${priceUsdNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/unit${t.feeUsd > 0 ? ` · Fee $${t.feeUsd.toFixed(2)}` : ''}${brokerName ? ` · ${brokerName}` : ''}${noteSuffix}`,
        timestamp: dateStrToTimestamp(txDate),
        ...sourceParams,
      })
      showToast(`${verb} ${unitsBoughtNum.toLocaleString(undefined, { maximumFractionDigits: 4 })} shares of ${holding!.name}`, 'success', undefined, { popup: true, title: toastTitle })
      onClose()
    } else {
      const pay = payAmount({ thb: Number(units) * priceInThb })
      if (!valid || (payFromId && pay === null)) { setShowErrors(true); return }
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
      buyMoreHolding({
        updatedHolding: updated,
        cashAccountId: payFromId,
        cashDeductAmount: payFromId ? pay ?? undefined : undefined,
        note: `+${Number(units).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${label} @ ฿${Number(price).toLocaleString()}/unit${noteSuffix}`,
        timestamp: dateStrToTimestamp(txDate),
        ...sourceParams,
      })
      showToast(`${verb} ${Number(units).toLocaleString(undefined, { maximumFractionDigits: 4 })} units of ${holding!.name}`, 'success', undefined, { popup: true, title: toastTitle })
      onClose()
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={modalTitle}
      description={`${holding.name}${lockedName && stockUsesBroker ? ` · at ${lockedName}` : ''} · ${
        isStock
          ? usdThb
            ? `price in USD, converted at ฿${rate.toFixed(2)}/USD.`
            : 'USD/THB rate loading…'
          : `${isReceived ? 'what you received' : 'a purchase'}. Units grow and your average cost is recalculated.`
      }`}
      footer={
        <FormActions
          editing={false}
          canSave={isStock ? stockTrade !== null : valid}
          onSave={save}
          submitLabel="Add to holding"
          hint={isStock ? (tradeCurrency === 'USD' ? 'Enter the shares and price' : 'Enter the amount and price') : 'Enter the units and price'}
        />
      }
    >
      <div className="space-y-4">
        {onSwitchToSell && (
          <div className="mb-2">
            <SegmentedControl
              value="buy"
              onChange={(val) => {
                if (val === 'sell') onSwitchToSell()
              }}
              options={BUY_SELL_SEGMENT_OPTIONS}
            />
          </div>
        )}

        {/* Transaction Date */}
        <TransactionDateField value={txDate} onChange={setTxDate} />

        {sourceField}

        {isStock && !usdThb && (
          <div className="rounded-xl bg-warn-soft px-4 py-3 text-sm font-medium text-warn-ink">
            USD/THB rate is loading. Please wait before saving to avoid wrong values.
          </div>
        )}
        <div className="rounded-2xl bg-surface-muted px-4 py-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-muted">Currently holding</span>
            <span className="font-semibold tnum text-ink">
              {holding.units.toLocaleString(undefined, { maximumFractionDigits: 4 })} {label}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-sm">
            <span className="text-ink-muted">Avg cost</span>
            <span className="font-semibold tnum text-ink">
              {isStock && rate > 1
                ? `$${(holding.avgCost / rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : thb(holding.avgCost, true)}
            </span>
          </div>
        </div>

        {stockUsesBroker && !lockedName && locationPicker}

        {cashField(isStock ? { thb: stockTrade?.thb ?? 0, usd: stockTrade?.usd } : { thb: cost })}

        {isStock ? (
          <UsdTradeFields
            kind="buy"
            currency={tradeCurrency}
            onCurrencyChange={!isReceived && !payFrom ? setPaidIn : undefined}
            shares={sharesBought}
            onSharesChange={setSharesBought}
            priceUsd={priceUsd}
            onPriceUsdChange={setPriceUsd}
            amountThb={amountSpentThb}
            onAmountThbChange={setAmountSpentThb}
            fx={fxRate}
            onFxChange={setFxRate}
            feeUsd={feeUsd}
            onFeeUsdChange={isReceived ? undefined : setFeeUsd}
            liveFx={rate}
            trade={stockTrade}
            showErrors={showErrors}
            sharesLabel={isReceived ? 'Shares received' : undefined}
            priceLabel={isReceived ? 'Price / share on the day (USD)' : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3">
            <NumberField
              label={`${label} ${isReceived ? 'received' : 'bought'}`}
              value={units}
              error={showErrors && (units === '' || Number(units) <= 0) ? 'Required (> 0)' : undefined}
              onChange={setUnits}
              placeholder="0"
              step={0.0001}
            />
            <NumberField
              label={isReceived ? 'Price / unit on the day received' : 'Price / unit'}
              hint={isReceived ? receivedHint : undefined}
              prefix="฿"
              value={price}
              error={showErrors && (price === '' || Number(price) <= 0) ? 'Required (> 0)' : undefined}
              onChange={setPrice}
              placeholder="0"
            />
          </div>
        )}

        {isStock && stockTrade && (
          <div
            className="rounded-2xl border px-4 py-3 space-y-1.5"
            style={{
              borderColor: `color-mix(in srgb, ${ASSET_META[holding.assetClass].color} 35%, transparent)`,
              background: `color-mix(in srgb, ${ASSET_META[holding.assetClass].color} 10%, transparent)`,
            }}
          >
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-soft">{isReceived ? 'Value received' : 'Transaction Cost'}</span>
              <span className="font-semibold tnum text-ink">
                {thb(stockTrade.thb, true)}{' '}
                <span className="text-ink-muted">({money(stockTrade.usd, 'USD', true)})</span>
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-soft">Shares added</span>
              <span className="font-semibold tnum text-ink">+{stockTrade.shares.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} shares</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-soft">New total shares</span>
              <span className="font-semibold tnum text-ink">{(stockCurrentUnits + stockTrade.shares).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} shares</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-soft">New total THB invested</span>
              <span className="font-semibold tnum text-ink">{thb(stockPrevThbInvested + stockTrade.thb, true)}</span>
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
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-soft">{isReceived ? 'Value received' : 'Cost of this buy'}</span>
              <span className="font-semibold tnum text-ink">{thb(cost)}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-sm">
              <span className="font-semibold text-ink">New total</span>
              <span className="font-bold tnum text-ink">
                {preview.units.toLocaleString(undefined, { maximumFractionDigits: 4 })} {label}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-ink-muted">New avg cost · value</span>
              <span className="tnum text-ink-soft">
                {thb(preview.avgCost, true)}{' '}
                · {thb(holdingMetrics({ ...holding, ...preview }).marketValue)}
              </span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}



import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { SegmentedControl } from '../ui/SegmentedControl'
import { NumberField, SelectField, TextField } from '../ui/Field'
import { AssetLogo } from '../ui/AssetLogo'
import { FormActions } from './FormActions'
import { useData } from '../../store/DataContext'
import { useToast } from '../../store/ToastContext'
import { ASSET_META } from '../../lib/calc'
import { searchSecurities, type Security } from '../../lib/securities'
import type { AssetClass, DcaFrequency, DcaPlan } from '../../lib/types'

interface Props {
  open: boolean
  editing: DcaPlan | null
  onClose: () => void
}

const WEEKDAY_OPTIONS = [
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
  { value: '7', label: 'Sunday' },
]

const blank = {
  source: 'portfolio' as 'portfolio' | 'cash' | 'custom',
  holdingId: '',
  cashAccountId: '',
  btcLocationId: '' as string,
  goldLocationId: '' as string,
  name: '',
  ticker: '',
  assetClass: 'fund' as AssetClass,
  frequency: 'monthly' as DcaFrequency,
  monthlyAmount: '' as number | '',
  dayOfMonth: 1 as number | '',
  weekday: '1',
}

export function DcaForm({ open, editing, onClose }: Props) {
  const { data, upsertPlan, removePlan } = useData()
  const { showToast } = useToast()
  const [form, setForm] = useState(blank)
  const [suggestions, setSuggestions] = useState<Security[]>([])
  const [showErrors, setShowErrors] = useState(false)

  // Build holding options for the dropdown
  const holdingOptions = data.holdings.map((h) => ({
    value: h.id,
    label: `${h.name} (${h.ticker})`,
    assetClass: h.assetClass,
    name: h.name,
    ticker: h.ticker,
  }))

  useEffect(() => {
    if (!open) return
    if (editing) {
      const freq = editing.frequency ?? 'monthly'
      const isCashPlan = editing.assetClass === 'cash' || !!editing.cashAccountId
      setForm({
        source: isCashPlan ? 'cash' : editing.holdingId ? 'portfolio' : 'custom',
        holdingId: editing.holdingId ?? '',
        cashAccountId: editing.cashAccountId ?? '',
        btcLocationId: editing.btcLocationId ?? '',
        goldLocationId: editing.goldLocationId ?? '',
        name: editing.name,
        ticker: editing.ticker ?? '',
        assetClass: editing.assetClass,
        frequency: freq,
        monthlyAmount: editing.monthlyAmount,
        dayOfMonth: editing.dayOfMonth,
        weekday: freq === 'weekly' ? String(editing.dayOfMonth) : '1',
      })
    } else {
      const hasHoldings = holdingOptions.length > 0
      const defaultSource = hasHoldings ? 'portfolio' : data.cashAccounts.length > 0 ? 'cash' : 'custom'
      const firstHoldingId = holdingOptions[0]?.value ?? ''
      const firstCash = data.cashAccounts[0]
      const firstHolding = data.holdings.find((h) => h.id === firstHoldingId)
      const firstLocId = firstHolding?.btcLocations?.[0]?.id ?? ''
      const firstGoldLocId = firstHolding?.goldLocations?.[0]?.id ?? ''
      setForm({
        ...blank,
        source: defaultSource,
        holdingId: firstHoldingId,
        cashAccountId: firstCash?.id ?? '',
        btcLocationId: firstLocId,
        goldLocationId: firstGoldLocId,
        name: defaultSource === 'portfolio' ? (firstHolding?.name ?? '') : defaultSource === 'cash' ? (firstCash?.name ?? '') : '',
        ticker: defaultSource === 'portfolio' ? (firstHolding?.ticker ?? '') : defaultSource === 'cash' ? 'CASH' : '',
        assetClass: defaultSource === 'portfolio' ? (firstHolding?.assetClass ?? 'fund') : defaultSource === 'cash' ? 'cash' : 'fund',
      })
    }
    setSuggestions([])
    setShowErrors(false)
  }, [open, editing])

  // When holding selection changes, sync name + ticker + assetClass + reset location
  function selectHolding(id: string) {
    const h = data.holdings.find((hh) => hh.id === id)
    const firstLocId = h?.btcLocations?.[0]?.id ?? ''
    const firstGoldLocId = h?.goldLocations?.[0]?.id ?? ''
    setForm((f) => ({
      ...f,
      holdingId: id,
      name: h?.name ?? '',
      ticker: h?.ticker ?? '',
      assetClass: h?.assetClass ?? 'fund',
      btcLocationId: firstLocId,
      goldLocationId: firstGoldLocId,
    }))
  }

  const freq = form.frequency
  const amountLabel =
    freq === 'daily' ? 'Amount / day' :
    freq === 'weekly' ? 'Amount / week' :
    'Amount / month'

  // Detect active asset class
  const selectedPortfolioHolding = form.source === 'portfolio'
    ? data.holdings.find((h) => h.id === form.holdingId)
    : undefined

  const activeAssetClass: AssetClass = editing
    ? editing.assetClass
    : form.source === 'cash'
      ? 'cash'
      : form.source === 'portfolio'
        ? (selectedPortfolioHolding?.assetClass ?? form.assetClass)
        : form.assetClass

  const isStock = activeAssetClass === 'stock'
  const isBtc = activeAssetClass === 'crypto'
  const isGold = activeAssetClass === 'gold'
  const isFund = activeAssetClass === 'fund'
  const isCash = activeAssetClass === 'cash'

  // Resolve BTC/Gold locations from portfolio
  const btcHolding = data.holdings.find((h) => h.assetClass === 'crypto')
  const goldHolding = data.holdings.find((h) => h.assetClass === 'gold')
  const btcLocations = (form.source === 'portfolio' ? selectedPortfolioHolding?.btcLocations : btcHolding?.btcLocations) ?? []
  const goldLocations = (form.source === 'portfolio' ? selectedPortfolioHolding?.goldLocations : goldHolding?.goldLocations) ?? []

  function save() {
    const isCashSource = form.source === 'cash' || activeAssetClass === 'cash'
    const selectedCashAcc = data.cashAccounts.find((a) => a.id === form.cashAccountId)

    const nameToUse = editing
      ? editing.name
      : isCashSource
        ? (selectedCashAcc?.name || form.name.trim())
        : form.source === 'portfolio'
          ? (selectedPortfolioHolding?.name ?? '')
          : isBtc ? 'Bitcoin' : isGold ? 'Gold' : form.name.trim()

    const tickerToUse = editing
      ? editing.ticker
      : isCashSource
        ? 'CASH'
        : form.source === 'portfolio'
          ? (selectedPortfolioHolding?.ticker ?? '')
          : isBtc ? 'BTC' : isGold ? 'GOLD' : (form.ticker.trim() || undefined)

    const amountNum = Number(form.monthlyAmount)
    if (!nameToUse || form.monthlyAmount === '' || isNaN(amountNum) || amountNum <= 0) {
      setShowErrors(true)
      return
    }

    const dayOfMonth =
      freq === 'daily' ? 1 :
      freq === 'weekly' ? Number(form.weekday) :
      Math.min(Math.max(Number(form.dayOfMonth || 1), 1), 28)

    upsertPlan({
      id: editing?.id,
      name: nameToUse,
      ticker: tickerToUse,
      assetClass: isCashSource ? 'cash' : activeAssetClass,
      frequency: freq,
      monthlyAmount: amountNum,
      dayOfMonth,
      holdingId: isCashSource ? undefined : (editing ? (editing.holdingId || selectedPortfolioHolding?.id) : (form.source === 'portfolio' ? form.holdingId : undefined)),
      cashAccountId: isCashSource ? (form.cashAccountId || editing?.cashAccountId || selectedCashAcc?.id) : undefined,
      btcLocationId: (isBtc && form.btcLocationId) ? form.btcLocationId : undefined,
      goldLocationId: (isGold && form.goldLocationId) ? form.goldLocationId : undefined,
      confirmedDates: editing?.confirmedDates,
      skippedDates: editing?.skippedDates,
    })
    showToast(editing ? `Updated DCA plan "${nameToUse}"` : `Created DCA plan "${nameToUse}"`, 'success')
    onClose()
  }

  const locationPicker = (
    <>
      {/* BTC location picker */}
      {isBtc && (
        <div className="space-y-2">
          <p className="text-[13px] font-semibold text-ink-soft">Buy into location</p>
          {btcLocations.length === 0 ? (
            <p className="rounded-xl bg-warn-soft px-4 py-3 text-[12.5px] text-warn">
              No BTC locations set up yet. You can choose or create a location when confirming a buy.
            </p>
          ) : (
            <div className="space-y-2">
              {btcLocations.map((loc) => (
                <label
                  key={loc.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                    form.btcLocationId === loc.id
                      ? 'border-brand bg-brand-soft'
                      : 'border-line bg-surface-muted hover:border-ink-faint'
                  }`}
                >
                  <input
                    type="radio"
                    name="btcLoc"
                    value={loc.id}
                    checked={form.btcLocationId === loc.id}
                    onChange={() => setForm((f) => ({ ...f, btcLocationId: loc.id }))}
                    className="accent-brand"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold text-ink">{loc.name}</p>
                    <p className="text-[11.5px] text-ink-muted">
                      {loc.satoshi.toLocaleString()} sats held
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Gold location picker */}
      {isGold && (
        <div className="space-y-2">
          <p className="text-[13px] font-semibold text-ink-soft">Buy into location</p>
          {goldLocations.length === 0 ? (
            <p className="rounded-xl bg-warn-soft px-4 py-3 text-[12.5px] text-warn">
              No Gold locations set up yet. You can choose or create a location when confirming a buy.
            </p>
          ) : (
            <div className="space-y-2">
              {goldLocations.map((loc) => (
                <label
                  key={loc.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                    form.goldLocationId === loc.id
                      ? 'border-brand bg-brand-soft'
                      : 'border-line bg-surface-muted hover:border-ink-faint'
                  }`}
                >
                  <input
                    type="radio"
                    name="goldLoc"
                    value={loc.id}
                    checked={form.goldLocationId === loc.id}
                    onChange={() => setForm((f) => ({ ...f, goldLocationId: loc.id }))}
                    className="accent-brand"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold text-ink">{loc.name}</p>
                    <p className="text-[11.5px] text-ink-muted">
                      {loc.grams.toFixed(4)} g held
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit DCA plan' : 'Add DCA plan'}
      description={editing ? 'Update recurring buy schedule for this holding.' : 'Set a recurring buy schedule for a portfolio holding or a new asset.'}
      footer={
        <FormActions
          editing={!!editing}
          canSave={true}
          onSave={save}
          onDelete={editing ? () => { removePlan(editing.id); onClose() } : undefined}
        />
      }
    >
      <div className="space-y-5">
        {/* ── ADD mode: Source toggle ── */}
        {!editing && (
          <SegmentedControl
            value={form.source}
            onChange={(s) => {
              const src = s as 'portfolio' | 'cash' | 'custom'
              const firstCash = data.cashAccounts[0]
              const targetCash = data.cashAccounts.find((a) => a.id === (form.cashAccountId || firstCash?.id))
              setForm((f) => ({
                ...f,
                source: src,
                cashAccountId: src === 'cash' ? (targetCash?.id ?? '') : '',
                assetClass: src === 'cash' ? 'cash' : (src === 'portfolio' ? (selectedPortfolioHolding?.assetClass ?? 'fund') : f.assetClass),
                name: src === 'portfolio' ? (selectedPortfolioHolding?.name ?? '') : src === 'cash' ? (targetCash?.name ?? '') : (f.assetClass === 'crypto' ? 'Bitcoin' : f.assetClass === 'gold' ? 'Gold' : ''),
                ticker: src === 'portfolio' ? (selectedPortfolioHolding?.ticker ?? '') : src === 'cash' ? 'CASH' : (f.assetClass === 'crypto' ? 'BTC' : f.assetClass === 'gold' ? 'GOLD' : ''),
              }))
              setSuggestions([])
            }}
            options={[
              { value: 'portfolio', label: 'Portfolio' },
              { value: 'cash', label: 'Cash / Savings' },
              { value: 'custom', label: 'Custom' },
            ]}
          />
        )}

        {/* ── EDIT mode: Header card ── */}
        {editing && (
          <div className="flex items-center gap-3.5 rounded-2xl bg-surface-muted p-3.5 border border-line">
            <AssetLogo assetClass={editing.assetClass} ticker={editing.ticker} name={editing.name} size="md" />
            <div className="min-w-0 flex-1">
              <span
                className="inline-block rounded px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider mb-0.5"
                style={{
                  color: ASSET_META[editing.assetClass]?.color ?? '#6366f1',
                  background: `color-mix(in srgb, ${ASSET_META[editing.assetClass]?.color ?? '#6366f1'} 15%, transparent)`,
                }}
              >
                {ASSET_META[editing.assetClass]?.label}
              </span>
              <p className="text-[15px] font-bold text-ink truncate leading-snug">{editing.name}</p>
              {editing.ticker && <p className="text-[12px] text-ink-muted font-medium">{editing.ticker}</p>}
            </div>
          </div>
        )}

        {/* ── Section A (Cash / Savings Account): Destination ── */}
        {!editing && form.source === 'cash' && (
          data.cashAccounts.length === 0 ? (
            <div className="rounded-xl bg-warn-soft p-4 text-[13px] text-warn space-y-2">
              <p className="font-semibold">No cash accounts added yet.</p>
              <p className="text-[12px] opacity-90">Please add a cash account in the Cash Accounts Hub first.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <SelectField
                label="Target Cash / Savings Account"
                value={form.cashAccountId}
                onChange={(id) => {
                  const acc = data.cashAccounts.find((a) => a.id === id)
                  setForm((f) => ({
                    ...f,
                    cashAccountId: id,
                    name: acc?.name ?? '',
                    ticker: 'CASH',
                    assetClass: 'cash',
                  }))
                }}
                options={data.cashAccounts.map((a) => {
                  const symbol = a.currency === 'USD' ? '$' : '฿'
                  return {
                    value: a.id,
                    label: `${a.name} (${symbol}${a.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })})`,
                  }
                })}
              />
              <div className="rounded-xl bg-surface-muted/70 p-3.5 border border-line/50 text-[12.5px] text-ink-muted leading-relaxed">
                💡 <strong>Automatic Savings DCA</strong>: When you confirm this plan each period, Spendiary will directly increment the balance of{' '}
                <span className="font-semibold text-ink">
                  {data.cashAccounts.find((a) => a.id === form.cashAccountId)?.name || 'the selected account'}
                </span>.
              </div>
            </div>
          )
        )}

        {/* ── Section A: Portfolio selection ── */}
        {!editing && form.source === 'portfolio' && (
          holdingOptions.length === 0 ? (
            <div className="rounded-xl bg-warn-soft p-4 text-[13px] text-warn space-y-2">
              <p className="font-semibold">No holdings in your portfolio yet.</p>
              <p className="text-[12px] opacity-90">Switch to <strong>Custom plan</strong> or <strong>Cash / Savings</strong> above to start DCAing.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <SelectField
                label="Holding"
                value={form.holdingId}
                onChange={selectHolding}
                options={holdingOptions}
              />
              {locationPicker}
            </div>
          )
        )}

        {/* ── Section A (Custom Plan): Asset Class First -> Specific Asset Details ── */}
        {!editing && form.source === 'custom' && (
          <div className="space-y-4">
            {/* 1. Asset Class always on top */}
            <SelectField
              label="Asset class"
              value={form.assetClass}
              onChange={(v) => {
                const ac = v as AssetClass
                setForm((f) => ({
                  ...f,
                  assetClass: ac,
                  name: ac === 'crypto' ? 'Bitcoin' : ac === 'gold' ? 'Gold' : (f.assetClass === 'crypto' || f.assetClass === 'gold' ? '' : f.name),
                  ticker: ac === 'crypto' ? 'BTC' : ac === 'gold' ? 'GOLD' : (f.assetClass === 'crypto' || f.assetClass === 'gold' ? '' : f.ticker),
                }))
                setSuggestions([])
              }}
              options={[
                { value: 'fund',   label: 'Thai Fund' },
                { value: 'stock',  label: 'US Stock' },
                { value: 'crypto', label: 'Bitcoin' },
                { value: 'gold',   label: 'Gold' },
              ]}
            />

            {/* 2. Dynamic fields based on Asset Class */}
            {(isFund || isStock) && (
              <>
                <div className="relative">
                  <TextField
                    label="Name"
                    value={form.name}
                    error={showErrors && form.name.trim() === '' ? 'Name is required' : undefined}
                    onChange={(name) => {
                      setForm((f) => ({ ...f, name }))
                      setSuggestions(searchSecurities(name, form.assetClass))
                    }}
                    onBlur={() => setTimeout(() => setSuggestions([]), 150)}
                    placeholder={isStock ? 'e.g. Apple Inc.' : 'e.g. SCB S&P 500 Index'}
                  />
                  {suggestions.length > 0 && (
                    <ul className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
                      {suggestions.map((s) => (
                        <li key={s.ticker}>
                          <button
                            type="button"
                            aria-label={`Select ${s.ticker} - ${s.name}`}
                            className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-surface-muted cursor-pointer transition-colors"
                            onMouseDown={() => {
                              setForm((f) => ({ ...f, name: s.name, ticker: s.ticker }))
                              setSuggestions([])
                            }}
                          >
                            <span className="min-w-[52px] rounded-md bg-surface-muted px-1.5 py-0.5 text-center text-[11px] font-bold tracking-wide text-ink-muted">
                              {s.ticker}
                            </span>
                            <span className="text-[13.5px] text-ink truncate">{s.name}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <TextField
                  label="Ticker / Symbol"
                  hint="optional"
                  value={form.ticker}
                  onChange={(ticker) => setForm((f) => ({ ...f, ticker: ticker.toUpperCase() }))}
                  placeholder={isStock ? 'e.g. AAPL' : 'e.g. SCBSP500'}
                />
              </>
            )}

            {isBtc && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface-muted p-3.5">
                  <AssetLogo assetClass="crypto" ticker="BTC" size="md" />
                  <div>
                    <p className="text-[14px] font-bold text-ink">Bitcoin (BTC)</p>
                    <p className="text-[12px] text-ink-muted">Recurring buy plan in Satoshis</p>
                  </div>
                </div>
                {locationPicker}
              </div>
            )}

            {isGold && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface-muted p-3.5">
                  <AssetLogo assetClass="gold" ticker="GOLD" size="md" />
                  <div>
                    <p className="text-[14px] font-bold text-ink">Gold (ทองคำ / XAU)</p>
                    <p className="text-[12px] text-ink-muted">Recurring buy plan for physical gold / grams</p>
                  </div>
                </div>
                {locationPicker}
              </div>
            )}
          </div>
        )}

        {/* ── Section B: DCA Schedule & Financial Parameters ── */}
        <div className="space-y-4 border-t border-line pt-4">
          {/* Frequency */}
          <SelectField
            label="Frequency"
            value={form.frequency}
            onChange={(v) => setForm((f) => ({ ...f, frequency: v as DcaFrequency }))}
            options={[
              { value: 'daily',   label: 'Every day' },
              { value: 'weekly',  label: 'Every week' },
              { value: 'monthly', label: 'Every month' },
            ]}
          />

          {/* Amount + day */}
          <div className="grid grid-cols-1 gap-3">
            <NumberField
              label={amountLabel}
              prefix="฿"
              value={form.monthlyAmount}
              error={showErrors && (form.monthlyAmount === '' || Number(form.monthlyAmount) <= 0) ? 'Amount is required (> 0)' : undefined}
              onChange={(monthlyAmount) => setForm((f) => ({ ...f, monthlyAmount }))}
              placeholder="0"
            />
            {freq === 'weekly' && (
              <SelectField
                label="Buy on"
                value={form.weekday}
                onChange={(v) => setForm((f) => ({ ...f, weekday: v }))}
                options={WEEKDAY_OPTIONS}
              />
            )}
            {freq === 'monthly' && (
              <NumberField
                label="Buy on day"
                hint="1–28"
                value={form.dayOfMonth}
                onChange={(dayOfMonth) => setForm((f) => ({ ...f, dayOfMonth }))}
                placeholder="1"
                min={1}
                step={1}
              />
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}


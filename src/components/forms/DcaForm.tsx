import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { NumberField, SelectField, TextField } from '../ui/Field'
import { FormActions } from './FormActions'
import { useData } from '../../store/DataContext'
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
  source: 'portfolio' as 'portfolio' | 'custom',
  holdingId: '',
  btcLocationId: '' as string,
  name: '',
  assetClass: 'fund' as AssetClass,
  frequency: 'monthly' as DcaFrequency,
  monthlyAmount: '' as number | '',
  dayOfMonth: 1 as number | '',
  weekday: '1',
}

export function DcaForm({ open, editing, onClose }: Props) {
  const { data, upsertPlan, removePlan } = useData()
  const [form, setForm] = useState(blank)
  const [showErrors, setShowErrors] = useState(false)

  // Build holding options for the dropdown
  const holdingOptions = data.holdings.map((h) => ({
    value: h.id,
    label: `${h.name} (${h.ticker})`,
    assetClass: h.assetClass,
    name: h.name,
  }))

  useEffect(() => {
    if (!open) return
    if (editing) {
      const freq = editing.frequency ?? 'monthly'
      setForm({
        source: 'portfolio',
        holdingId: editing.holdingId ?? '',
        btcLocationId: editing.btcLocationId ?? '',
        name: editing.name,
        assetClass: editing.assetClass,
        frequency: freq,
        monthlyAmount: editing.monthlyAmount,
        dayOfMonth: editing.dayOfMonth,
        weekday: freq === 'weekly' ? String(editing.dayOfMonth) : '1',
      })
    } else {
      const firstHoldingId = holdingOptions[0]?.value ?? ''
      const firstHolding = data.holdings.find((h) => h.id === firstHoldingId)
      const firstLocId = firstHolding?.btcLocations?.[0]?.id ?? ''
      setForm({
        ...blank,
        holdingId: firstHoldingId,
        btcLocationId: firstLocId,
      })
    }
    setShowErrors(false)
  }, [open, editing])

  // When holding selection changes, sync name + assetClass + reset btcLocation
  function selectHolding(id: string) {
    const h = data.holdings.find((hh) => hh.id === id)
    const firstLocId = h?.btcLocations?.[0]?.id ?? ''
    setForm((f) => ({
      ...f,
      holdingId: id,
      name: h?.name ?? '',
      assetClass: h?.assetClass ?? 'fund',
      btcLocationId: firstLocId,
    }))
  }

  const freq = form.frequency
  const amountLabel =
    freq === 'daily' ? 'Amount / day' :
    freq === 'weekly' ? 'Amount / week' :
    'Amount / month'

  // Detect if currently selected holding is BTC with locations
  const selectedHolding = data.holdings.find((h) => h.id === form.holdingId)
  const isBtcHolding = selectedHolding?.assetClass === 'crypto'
  const btcLocations = selectedHolding?.btcLocations ?? []

  function save() {
    const nameToUse = editing
      ? editing.name  // editing: keep existing name
      : form.source === 'portfolio'
        ? (data.holdings.find((h) => h.id === form.holdingId)?.name ?? '')
        : form.name.trim()

    if (!nameToUse || form.monthlyAmount === '') {
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
      assetClass: editing ? editing.assetClass : form.assetClass,
      frequency: freq,
      monthlyAmount: Number(form.monthlyAmount),
      dayOfMonth,
      holdingId: editing ? editing.holdingId : (form.source === 'portfolio' ? form.holdingId : undefined),
      btcLocationId: (isBtcHolding && form.btcLocationId) ? form.btcLocationId : undefined,
      confirmedDates: editing?.confirmedDates,
      skippedDates: editing?.skippedDates,
    })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit DCA plan' : 'Add DCA plan'}
      description="Set a recurring buy schedule for a holding."
    >
      <div className="space-y-5">

        {/* ── ADD mode ── */}
        {!editing && (
          <>
            {/* Source toggle */}
            <div className="flex rounded-xl bg-surface-muted p-1 gap-1">
              {(['portfolio', 'custom'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, source: s }))}
                  className={`flex-1 rounded-lg py-2 text-[13px] font-semibold transition-all ${
                    form.source === s
                      ? 'bg-surface text-ink shadow-sm'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  {s === 'portfolio' ? 'From my portfolio' : 'Custom plan'}
                </button>
              ))}
            </div>

            {/* From portfolio — holding picker */}
            {form.source === 'portfolio' && (
              holdingOptions.length === 0 ? (
                <p className="rounded-xl bg-warn-soft px-4 py-3 text-[13px] text-warn">
                  No holdings yet. Add holdings in Portfolio first, or use Custom plan.
                </p>
              ) : (
                <>
                  <SelectField
                    label="Holding"
                    value={form.holdingId}
                    onChange={selectHolding}
                    options={holdingOptions}
                  />

                  {/* BTC location picker */}
                  {isBtcHolding && (
                    <div>
                      <p className="mb-2 text-[13px] font-semibold text-ink">Buy into location</p>
                      {btcLocations.length === 0 ? (
                        <p className="rounded-xl bg-warn-soft px-4 py-3 text-[12.5px] text-warn">
                          No BTC locations set up yet. Add a location in Portfolio → Bitcoin first.
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
                                name="btcLocAdd"
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
                </>
              )
            )}

            {/* Custom plan — free text + asset class */}
            {form.source === 'custom' && (
              <>
                <TextField
                  label="Plan name"
                  value={form.name}
                  error={showErrors && form.name.trim() === '' ? 'Name is required' : undefined}
                  onChange={(name) => setForm((f) => ({ ...f, name }))}
                  placeholder="e.g. S&P 500 Index"
                />
                <SelectField
                  label="Asset class"
                  value={form.assetClass}
                  onChange={(v) => setForm((f) => ({ ...f, assetClass: v as AssetClass }))}
                  options={[
                    { value: 'fund',   label: 'Mutual Fund' },
                    { value: 'stock',  label: 'US Stock' },
                    { value: 'crypto', label: 'Bitcoin' },
                    { value: 'gold',   label: 'Gold' },
                  ]}
                />
              </>
            )}
          </>
        )}

        {/* ── EDIT mode: show plan name as read-only, no asset class ── */}
        {editing && (
          <div className="rounded-xl bg-surface-muted px-4 py-3">
            <p className="text-[11.5px] font-semibold uppercase tracking-wider text-ink-faint">Plan</p>
            <p className="mt-0.5 text-[15px] font-bold text-ink">{editing.name}</p>
          </div>
        )}

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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <NumberField
            label={amountLabel}
            prefix="฿"
            value={form.monthlyAmount}
            error={showErrors && form.monthlyAmount === '' ? 'Amount is required' : undefined}
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
            />
          )}
        </div>

        <FormActions
          editing={!!editing}
          canSave={true}
          onSave={save}
          onDelete={editing ? () => { removePlan(editing.id); onClose() } : undefined}
        />
      </div>
    </Modal>
  )
}

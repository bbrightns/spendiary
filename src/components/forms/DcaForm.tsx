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
      // Try to match to an existing holding by name
      const matched = data.holdings.find((h) => h.name === editing.name)
      setForm({
        source: matched ? 'portfolio' : 'custom',
        holdingId: matched?.id ?? '',
        name: editing.name,
        assetClass: editing.assetClass,
        frequency: freq,
        monthlyAmount: editing.monthlyAmount,
        dayOfMonth: editing.dayOfMonth,
        weekday: freq === 'weekly' ? String(editing.dayOfMonth) : '1',
      })
    } else {
      setForm({
        ...blank,
        holdingId: holdingOptions[0]?.value ?? '',
      })
    }
    setShowErrors(false)
  }, [open, editing])

  // When holding selection changes, sync name + assetClass
  function selectHolding(id: string) {
    const h = holdingOptions.find((o) => o.value === id)
    setForm((f) => ({
      ...f,
      holdingId: id,
      name: h?.name ?? '',
      assetClass: h?.assetClass ?? 'fund',
    }))
  }

  const freq = form.frequency
  const amountLabel =
    freq === 'daily' ? 'Amount / day' :
    freq === 'weekly' ? 'Amount / week' :
    'Amount / month'

  function save() {
    const nameToUse = form.source === 'portfolio'
      ? (holdingOptions.find((o) => o.value === form.holdingId)?.name ?? '')
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
      assetClass: form.assetClass,
      frequency: freq,
      monthlyAmount: Number(form.monthlyAmount),
      dayOfMonth,
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

        {/* Source toggle — only shown when adding new */}
        {!editing && (
          <div className="flex rounded-xl bg-surface-muted p-1 gap-1">
            {(['portfolio', 'custom'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setForm((f) => ({ ...f, source: s }))}
                className={`flex-1 rounded-lg py-2 text-[13px] font-semibold transition-all ${
                  form.source === s
                    ? 'bg-white text-ink shadow-sm'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                {s === 'portfolio' ? 'From my portfolio' : 'Custom plan'}
              </button>
            ))}
          </div>
        )}

        {/* From portfolio — holding picker */}
        {form.source === 'portfolio' && !editing && (
          holdingOptions.length === 0 ? (
            <p className="rounded-xl bg-warn-soft px-4 py-3 text-[13px] text-warn">
              No holdings yet. Add holdings in Portfolio first, or use Custom plan.
            </p>
          ) : (
            <SelectField
              label="Holding"
              value={form.holdingId}
              onChange={selectHolding}
              options={holdingOptions}
            />
          )
        )}

        {/* Custom plan — free text + asset class */}
        {(form.source === 'custom' || editing) && (
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

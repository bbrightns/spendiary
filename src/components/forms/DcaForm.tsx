import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { NumberField, SelectField, TextField } from '../ui/Field'
import { FormActions } from './FormActions'
import { useData } from '../../store/DataContext'
import type { AssetClass, DcaPlan } from '../../lib/types'

interface Props {
  open: boolean
  editing: DcaPlan | null
  onClose: () => void
}

const blank = {
  name: '',
  assetClass: 'fund' as AssetClass,
  monthlyAmount: '' as number | '',
  dayOfMonth: 1 as number | '',
}

export function DcaForm({ open, editing, onClose }: Props) {
  const { upsertPlan, removePlan } = useData()
  const [form, setForm] = useState(blank)
  const [showErrors, setShowErrors] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(
      editing
        ? {
            name: editing.name,
            assetClass: editing.assetClass,
            monthlyAmount: editing.monthlyAmount,
            dayOfMonth: editing.dayOfMonth,
          }
        : blank,
    )
    setShowErrors(false)
  }, [open, editing])

  const valid = form.name.trim() !== '' && form.monthlyAmount !== ''

  function save() {
    if (!valid) {
      setShowErrors(true)
      return
    }
    const day = form.dayOfMonth === '' ? 1 : Math.min(Math.max(Number(form.dayOfMonth), 1), 28)
    upsertPlan({
      id: editing?.id,
      name: form.name.trim(),
      assetClass: form.assetClass,
      monthlyAmount: Number(form.monthlyAmount),
      dayOfMonth: day,
    })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit DCA plan' : 'Add DCA plan'}
      description="A recurring monthly buy. The buy day drives this month's progress."
    >
      <div className="space-y-5">
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
            { value: 'fund', label: 'Mutual Fund' },
            { value: 'stock', label: 'US Stock' },
            { value: 'crypto', label: 'Bitcoin' },
          ]}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <NumberField
            label="Amount / month"
            prefix="฿"
            value={form.monthlyAmount}
            error={showErrors && form.monthlyAmount === '' ? 'Amount is required' : undefined}
            onChange={(monthlyAmount) => setForm((f) => ({ ...f, monthlyAmount }))}
            placeholder="0"
          />
          <NumberField
            label="Buy on day"
            hint="1–28"
            value={form.dayOfMonth}
            onChange={(dayOfMonth) => setForm((f) => ({ ...f, dayOfMonth }))}
            placeholder="1"
            min={1}
          />
        </div>

        <FormActions
          editing={!!editing}
          canSave={true}
          onSave={save}
          onDelete={
            editing
              ? () => {
                  removePlan(editing.id)
                  onClose()
                }
              : undefined
          }
        />
      </div>
    </Modal>
  )
}

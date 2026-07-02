import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { NumberField, SelectField, TextField } from '../ui/Field'
import { FormActions } from './FormActions'
import { useData } from '../../store/DataContext'
import type { Frequency, Transfer } from '../../lib/types'
import { localDateStr } from '../../lib/format'

interface Props {
  open: boolean
  editing: Transfer | null
  onClose: () => void
}

function defaultExpiry(): string {
  const d = new Date()
  d.setMonth(d.getMonth() + 3)
  return localDateStr(d)
}

const blank = () => ({
  recipient: '',
  note: '',
  amount: '' as number | '',
  frequency: 'monthly' as Frequency,
  completed: '' as number | '',
  total: '' as number | '',
  expiryDate: defaultExpiry(),
})

export function TransferForm({ open, editing, onClose }: Props) {
  const { upsertTransfer, removeTransfer } = useData()
  const [form, setForm] = useState(blank)
  const [showErrors, setShowErrors] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(
      editing
        ? {
            recipient: editing.recipient,
            note: editing.note ?? '',
            amount: editing.amount,
            frequency: editing.frequency,
            completed: editing.completed,
            total: editing.total,
            expiryDate: editing.expiryDate,
          }
        : blank(),
    )
    setShowErrors(false)
  }, [open, editing])

  const valid =
    form.recipient.trim() !== '' && form.amount !== '' && form.total !== '' && form.expiryDate !== ''

  function save() {
    if (!valid) {
      setShowErrors(true)
      return
    }
    const total = Number(form.total)
    const completed = form.completed === '' ? 0 : Math.min(Number(form.completed), total)
    upsertTransfer({
      id: editing?.id,
      recipient: form.recipient.trim(),
      note: form.note.trim() || undefined,
      amount: Number(form.amount),
      frequency: form.frequency,
      completed,
      total,
      expiryDate: form.expiryDate,
    })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit transfer' : 'Add transfer'}
      description="A recurring outgoing bank transfer schedule."
    >
      <div className="space-y-5">
        <TextField
          label="Recipient"
          value={form.recipient}
          error={showErrors && form.recipient.trim() === '' ? 'Recipient is required' : undefined}
          onChange={(recipient) => setForm((f) => ({ ...f, recipient }))}
          placeholder="e.g. Mom — Monthly Support"
        />
        <TextField
          label="Note"
          hint="optional"
          value={form.note}
          onChange={(note) => setForm((f) => ({ ...f, note }))}
          placeholder="Standing allowance"
        />
        <div className="grid grid-cols-1 gap-3 ">
          <NumberField
            label="Amount / transfer"
            prefix="฿"
            value={form.amount}
            error={showErrors && form.amount === '' ? 'Amount is required' : undefined}
            onChange={(amount) => setForm((f) => ({ ...f, amount }))}
            placeholder="0"
          />
          <SelectField
            label="Frequency"
            value={form.frequency}
            onChange={(v) => setForm((f) => ({ ...f, frequency: v as Frequency }))}
            options={[
              { value: 'weekly', label: 'Weekly' },
              { value: 'biweekly', label: 'Every 2 weeks' },
              { value: 'monthly', label: 'Monthly' },
              { value: 'quarterly', label: 'Quarterly' },
            ]}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 ">
          <NumberField
            label="Completed"
            value={form.completed}
            onChange={(completed) => setForm((f) => ({ ...f, completed }))}
            placeholder="0"
          />
          <NumberField
            label="Total transfers"
            value={form.total}
            error={showErrors && form.total === '' ? 'Total is required' : undefined}
            onChange={(total) => setForm((f) => ({ ...f, total }))}
            placeholder="0"
            min={1}
          />
        </div>
        <TextField
          label="Expiry date"
          type="date"
          value={form.expiryDate}
          error={showErrors && form.expiryDate === '' ? 'Expiry is required' : undefined}
          onChange={(expiryDate) => setForm((f) => ({ ...f, expiryDate }))}
        />

        <FormActions
          editing={!!editing}
          canSave={true}
          onSave={save}
          onDelete={
            editing
              ? () => {
                  removeTransfer(editing.id)
                  onClose()
                }
              : undefined
          }
        />
      </div>
    </Modal>
  )
}


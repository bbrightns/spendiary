import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { NumberField, SelectField, TextField } from '../ui/Field'
import { FormActions } from './FormActions'
import { useData } from '../../store/DataContext'
import type { AssetClass, Holding } from '../../lib/types'

interface Props {
  open: boolean
  editing: Holding | null
  onClose: () => void
}

const blank = {
  name: '',
  ticker: '',
  assetClass: 'fund' as AssetClass,
  units: '' as number | '',
  avgCost: '' as number | '',
  price: '' as number | '',
}

export function HoldingForm({ open, editing, onClose }: Props) {
  const { upsertHolding, removeHolding, usdThb } = useData()
  const [form, setForm] = useState(blank)
  const [showErrors, setShowErrors] = useState(false)

  const isUsd = form.assetClass === 'stock' || form.assetClass === 'crypto'
  const rate = usdThb ?? 1

  useEffect(() => {
    if (!open) return
    if (editing) {
      const divisor = (editing.assetClass === 'stock' || editing.assetClass === 'crypto') ? rate : 1
      setForm({
        name: editing.name,
        ticker: editing.ticker,
        assetClass: editing.assetClass,
        units: editing.units,
        avgCost: divisor > 1 ? parseFloat((editing.avgCost / divisor).toFixed(4)) : editing.avgCost,
        price: divisor > 1 ? parseFloat((editing.price / divisor).toFixed(4)) : editing.price,
      })
    } else {
      setForm(blank)
    }
    setShowErrors(false)
  }, [open, editing])

  const valid =
    form.name.trim() !== '' && form.units !== '' && form.avgCost !== '' && form.price !== ''

  function save() {
    if (!valid) { setShowErrors(true); return }
    const multiplier = isUsd && rate > 1 ? rate : 1
    upsertHolding({
      id: editing?.id,
      name: form.name.trim(),
      ticker: form.ticker.trim() || form.name.trim().slice(0, 4).toUpperCase(),
      assetClass: form.assetClass,
      units: Number(form.units),
      avgCost: Number(form.avgCost) * multiplier,
      price: Number(form.price) * multiplier,
      updatedAt: new Date().toISOString().slice(0, 10),
    })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit holding' : 'Add holding'}
      description={
        isUsd
          ? `Prices in USD — converted to THB at ${usdThb ? `฿${usdThb.toFixed(2)}/USD` : 'live rate'} for display.`
          : 'Mutual fund — valued in THB.'
      }
    >
      <div className="space-y-5">
        <TextField
          label="Name"
          value={form.name}
          error={showErrors && form.name.trim() === '' ? 'Name is required' : undefined}
          onChange={(name) => setForm((f) => ({ ...f, name }))}
          placeholder="e.g. Apple Inc."
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField
            label="Ticker"
            hint="optional"
            value={form.ticker}
            onChange={(ticker) => setForm((f) => ({ ...f, ticker }))}
            placeholder="AAPL"
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
        </div>
        <NumberField
          label={form.assetClass === 'crypto' ? 'BTC held (decimal)' : 'Units held'}
          value={form.units}
          error={showErrors && form.units === '' ? 'Units are required' : undefined}
          onChange={(units) => setForm((f) => ({ ...f, units }))}
          placeholder="0"
          step={form.assetClass === 'crypto' ? 0.00000001 : 0.0001}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <NumberField
            label="Avg cost / unit"
            prefix={isUsd ? '$' : '฿'}
            value={form.avgCost}
            error={showErrors && form.avgCost === '' ? 'Cost is required' : undefined}
            onChange={(avgCost) => setForm((f) => ({ ...f, avgCost }))}
            placeholder="0"
          />
          <NumberField
            label="Current price / unit"
            prefix={isUsd ? '$' : '฿'}
            value={form.price}
            error={showErrors && form.price === '' ? 'Price is required' : undefined}
            onChange={(price) => setForm((f) => ({ ...f, price }))}
            placeholder="0"
          />
        </div>

        {isUsd && usdThb && form.avgCost !== '' && Number(form.avgCost) > 0 && (
          <p className="text-[12px] text-ink-muted">
            Avg cost in THB: ฿{(Number(form.avgCost) * usdThb).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            {form.price !== '' && Number(form.price) > 0 && (
              <> · Price in THB: ฿{(Number(form.price) * usdThb).toLocaleString(undefined, { maximumFractionDigits: 0 })}</>
            )}
          </p>
        )}

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
      </div>
    </Modal>
  )
}

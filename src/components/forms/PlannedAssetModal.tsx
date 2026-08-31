import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { NumberField, SelectField, TextField } from '../ui/Field'
import { Button } from '../ui/Button'
import { useData } from '../../store/DataContext'
import { useToast } from '../../store/ToastContext'
import { searchSecurities, type Security } from '../../lib/securities'
import type { InvestAssetClass } from '../../lib/types'

interface Props {
  open: boolean
  onClose: () => void
  onAdded?: (assetId: string, targetPct?: number) => void
}

const blank = {
  name: '',
  ticker: '',
  assetClass: 'stock' as InvestAssetClass,
  targetPct: '' as number | '',
}

export function PlannedAssetModal({ open, onClose, onAdded }: Props) {
  const { upsertPlannedAsset } = useData()
  const { showToast } = useToast()

  const [form, setForm] = useState(blank)
  const [showErrors, setShowErrors] = useState(false)
  const [suggestions, setSuggestions] = useState<Security[]>([])

  useEffect(() => {
    if (open) {
      setForm(blank)
      setShowErrors(false)
      setSuggestions([])
    }
  }, [open])

  const isBtc = form.assetClass === 'crypto'
  const isGold = form.assetClass === 'gold'

  const handleSave = () => {
    const name = isBtc ? 'Bitcoin' : isGold ? 'Gold' : form.name.trim()
    const ticker = isBtc ? 'BTC' : isGold ? 'XAU' : (form.ticker.trim() || name.slice(0, 5).toUpperCase())

    if (!name) {
      setShowErrors(true)
      return
    }

    const newId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `plan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

    upsertPlannedAsset({
      id: newId,
      name,
      ticker,
      assetClass: form.assetClass,
    })

    const targetNum = Number(form.targetPct) || 0
    showToast(`Added "${name}" as a planned target asset`, 'success')
    onAdded?.(newId, targetNum > 0 ? targetNum : undefined)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Target Asset"
      description="Add a new position you plan to invest in to calculate target allocation and buy advice."
    >
      <div className="space-y-4">
        <SelectField
          label="Asset Class"
          value={form.assetClass}
          onChange={(v) => {
            const ac = v as InvestAssetClass
            setForm((f) => ({
              ...f,
              assetClass: ac,
              name: ac === 'crypto' ? 'Bitcoin' : ac === 'gold' ? 'Gold' : f.name,
              ticker: ac === 'crypto' ? 'BTC' : ac === 'gold' ? 'XAU' : f.ticker,
            }))
            setSuggestions([])
          }}
          options={[
            { value: 'stock', label: 'US Stock' },
            { value: 'fund', label: 'Mutual Fund' },
            { value: 'crypto', label: 'Bitcoin' },
            { value: 'gold', label: 'Gold' },
          ]}
        />

        {!isBtc && !isGold && (
          <>
            <div className="relative">
              <TextField
                label="Asset Name"
                value={form.name}
                error={showErrors && !form.name.trim() ? 'Name is required' : undefined}
                onChange={(name) => {
                  setForm((f) => ({ ...f, name }))
                  setSuggestions(searchSecurities(name, form.assetClass))
                }}
                onBlur={() => setTimeout(() => setSuggestions([]), 150)}
                placeholder={form.assetClass === 'stock' ? 'e.g. Nvidia Corp, Tesla Inc' : 'e.g. Kasikorn Fund, SCBS&P500'}
              />
              {suggestions.length > 0 && (
                <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-xl border border-line bg-surface shadow-lg">
                  {suggestions.map((s) => (
                    <li key={s.ticker}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 px-3.5 py-2 text-left hover:bg-surface-muted cursor-pointer"
                        onMouseDown={() => {
                          setForm((f) => ({ ...f, name: s.name, ticker: s.ticker }))
                          setSuggestions([])
                        }}
                      >
                        <span className="min-w-[50px] rounded bg-surface-muted px-1.5 py-0.5 text-center text-[11px] font-bold text-ink-muted">
                          {s.ticker}
                        </span>
                        <span className="text-[13px] text-ink truncate">{s.name}</span>
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
              placeholder={form.assetClass === 'stock' ? 'e.g. NVDA, TSLA' : 'e.g. SCBSP500'}
            />
          </>
        )}

        <NumberField
          label="Initial Target Allocation (%)"
          hint="optional (can adjust later)"
          value={form.targetPct}
          onChange={(targetPct) => setForm((f) => ({ ...f, targetPct }))}
          placeholder="e.g. 10"
          suffix="%"
        />

        <div className="pt-2 flex gap-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSave} className="flex-1">
            Add to Targets
          </Button>
        </div>
      </div>
    </Modal>
  )
}

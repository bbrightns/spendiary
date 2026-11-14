import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { NumberField, SelectField } from '../ui/Field'
import { FormActions } from './FormActions'
import { TransactionDateField } from './TransactionDateField'
import { useData } from '../../store/DataContext'
import { useToast } from '../../store/ToastContext'
import type { CashAccount } from '../../lib/types'
import { localDateStr, money } from '../../lib/format'
import { isValidRate } from '../../lib/fx'
import { resolveExchange } from '../../lib/fxExchange'
import { fieldNumber } from '../../lib/usdTrade'

type Value = number | string | ''

interface Props {
  open: boolean
  /** The USD account the dollars go into, as saved */
  account: CashAccount
  onClose: () => void
  /** After saving: what changed on the account, so a form showing it can follow */
  onDone?: (change: { usd: number; thb: number; thbCost: number | undefined }) => void
}

/**
 * Baht exchanged into a USD account: any two of baht paid, dollars received and the rate.
 * The account keeps what its dollars cost, so stocks bought from it cost the rate really paid.
 */
export function FxExchangeModal({ open, account, onClose, onDone }: Props) {
  const { data, usdThb, exchangeToUsd } = useData()
  const { showToast } = useToast()
  const [fromId, setFromId] = useState('none')
  const [thb, setThb] = useState<Value>('')
  const [usd, setUsd] = useState<Value>('')
  const [rate, setRate] = useState<Value>('')
  const [openingCost, setOpeningCost] = useState<Value>('')
  const [date, setDate] = useState(localDateStr())
  const [showErrors, setShowErrors] = useState(false)

  const ex = resolveExchange(fieldNumber(thb), fieldNumber(usd), fieldNumber(rate))
  const thbAccounts = (data.cashAccounts ?? []).filter((a) => (a.currency ?? 'THB') === 'THB' && (!a.archived || a.id === fromId))
  const from = thbAccounts.find((a) => a.id === fromId)
  // Dollars already in the account with no known cost: ask once, else they count at today's rate
  const needsOpening = account.thbCost === undefined && account.balance > 0
  const live = isValidRate(usdThb) ? usdThb : 0
  const openingFallback = live > 0 ? Math.round(account.balance * live * 100) / 100 : undefined
  const opening = needsOpening ? (fieldNumber(openingCost) > 0 ? fieldNumber(openingCost) : openingFallback) : undefined

  const save = () => {
    if (!ex) { setShowErrors(true); return }
    exchangeToUsd({ fromAccountId: from?.id, toAccountId: account.id, thb: ex.thb, usd: ex.usd, date, openingThbCost: opening })
    const base = account.thbCost ?? opening ?? (account.balance <= 0 ? 0 : undefined)
    onDone?.({ usd: ex.usd, thb: ex.thb, thbCost: base === undefined ? undefined : Math.round((base + ex.thb) * 100) / 100 })
    showToast(`Exchanged ${money(ex.thb, 'THB', true)} → ${money(ex.usd, 'USD', true)}`, 'success')
    onClose()
  }

  const placeholderFor = (field: 'thb' | 'usd' | 'rate') =>
    ex && ex.derived === field ? `≈ ${field === 'rate' ? ex.rate.toFixed(4) : ex[field].toFixed(2)}` : field === 'rate' ? (live > 0 ? live.toFixed(2) : '0.00') : '0.00'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Exchange THB → USD"
      description={`Into ${account.name}. Fill in any two; the third is worked out.`}
      size="sm"
      footer={<FormActions editing={false} canSave={ex !== null} onSave={save} submitLabel="Save exchange" hint="Enter any two of baht, dollars and rate" />}
    >
      <div className="space-y-4">
        <TransactionDateField value={date} onChange={setDate} />
        <SelectField
          label="Baht taken from"
          value={fromId}
          onChange={setFromId}
          options={[
            { value: 'none', label: 'None · Not tracked here' },
            ...thbAccounts.map((a) => ({ value: a.id, label: `${a.name} (${money(a.balance, 'THB', true)})` })),
          ]}
        />
        <NumberField label="Baht paid" prefix="฿" value={thb} onChange={setThb} placeholder={placeholderFor('thb')} step={0.01} />
        <div className="grid grid-cols-2 items-end gap-3">
          <NumberField label="Dollars received" prefix="$" value={usd} onChange={setUsd} placeholder={placeholderFor('usd')} step={0.01} />
          <NumberField label="Rate (THB per USD)" value={rate} onChange={setRate} placeholder={placeholderFor('rate')} step={0.0001} />
        </div>

        {needsOpening && (
          <NumberField
            label={`What the ${money(account.balance, 'USD', true)} already there cost`}
            hint="optional"
            prefix="฿"
            value={openingCost}
            onChange={setOpeningCost}
            placeholder={openingFallback !== undefined ? openingFallback.toFixed(2) : '0.00'}
            step={0.01}
          />
        )}

        {ex ? (
          <p className="rounded-xl bg-surface-muted px-3 py-2 text-xs text-ink-muted">
            <span className="font-semibold tnum text-ink">{money(ex.thb, 'THB', true)}</span>
            {' → '}
            <span className="font-semibold tnum text-ink">{money(ex.usd, 'USD', true)}</span>
            {` at ฿${ex.rate.toFixed(4).replace(/0{1,2}$/, '')}/USD`}
            {from && ` · ${from.name} after ${money(from.balance - ex.thb, 'THB', true)}`}
          </p>
        ) : (
          showErrors && <p className="text-xs text-loss-ink">Enter any two of baht paid, dollars received and the rate.</p>
        )}
        {needsOpening && !(fieldNumber(openingCost) > 0) && (
          <p className="text-xs text-ink-muted">
            {openingFallback !== undefined
              ? `Left empty, the dollars already there count at today's ${live.toFixed(2)}.`
              : 'Left empty, the dollars already there keep an unknown cost until you set it on the account.'}
          </p>
        )}
      </div>
    </Modal>
  )
}

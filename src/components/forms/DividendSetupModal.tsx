import { useEffect, useRef, useState } from 'react'
import { Modal } from '../ui/Modal'
import { SelectField } from '../ui/Field'
import { AssetLogo } from '../ui/AssetLogo'
import { FormActions } from './FormActions'
import { DividendScheduleFields } from './DividendScheduleFields'
import { useData } from '../../store/DataContext'
import { useToast } from '../../store/ToastContext'
import { canPayDividend, dividendFields, dpsMapFromHolding, type DpsMap } from '../../lib/dividendSchedule'
import type { Holding } from '../../lib/types'

interface Props {
  open: boolean
  /** The holding to set up; leave empty to pick one of the funds and stocks held */
  holding?: Holding | null
  onClose: () => void
}

/** Sets which months a fund or stock pays a dividend, how much per share, and where it lands. */
export function DividendSetupModal({ open, holding, onClose }: Props) {
  const { data, upsertHolding } = useData()
  const { showToast } = useToast()

  const candidates = data.holdings.filter(canPayDividend)
  // Not yet tracked first, so "Set up" opens on one that still needs it
  const pickable = [...candidates].sort((a, b) => Number(!!a.paysDividend) - Number(!!b.paysDividend))

  const [holdingId, setHoldingId] = useState('')
  const [months, setMonths] = useState<number[]>([])
  const [dpsMap, setDpsMap] = useState<DpsMap>({})
  const [cashAccountId, setCashAccountId] = useState('')
  const [showErrors, setShowErrors] = useState(false)

  const target = data.holdings.find((h) => h.id === holdingId) ?? null

  const loadFrom = (h: Holding | null) => {
    setHoldingId(h?.id ?? '')
    setMonths(h?.paysDividend ? [...(h.dividendMonths ?? [])].sort((a, b) => a - b) : [])
    setDpsMap(h?.paysDividend ? dpsMapFromHolding(h) : {})
    setCashAccountId(h?.defaultCashAccountId ?? data.cashAccounts[0]?.id ?? '')
    setShowErrors(false)
  }

  // Load only when the sheet opens, so live price ticks do not wipe what is being typed
  const wasOpen = useRef(false)
  useEffect(() => {
    const justOpened = open && !wasOpen.current
    wasOpen.current = open
    if (justOpened) loadFrom(holding ?? pickable[0] ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs on open only; holdings and cash accounts are read at that moment
  }, [open, holding])

  const alreadyTracked = !!target?.paysDividend

  function save() {
    if (!target) return
    if (months.length === 0) { setShowErrors(true); return }
    upsertHolding({ ...target, ...dividendFields(months, dpsMap, cashAccountId) })
    showToast(alreadyTracked ? `Updated dividends for ${target.ticker}` : `Tracking dividends for ${target.ticker}`, 'success')
    onClose()
  }

  function stopTracking() {
    if (!target) return
    upsertHolding({ ...target, ...dividendFields([], {}, '') })
    showToast(`Stopped tracking dividends for ${target.ticker}`, 'info')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={alreadyTracked ? 'Edit dividend' : 'Set up dividend'}
      description="Pick the months it pays and the dividend per share, to see what to expect."
      footer={
        <FormActions
          editing={alreadyTracked}
          canSave={!!target}
          onSave={save}
          onDelete={alreadyTracked ? stopTracking : undefined}
          submitLabel={alreadyTracked ? 'Save changes' : 'Start tracking'}
          hint={candidates.length === 0 ? 'Add a fund or stock on the Portfolio page first' : undefined}
        />
      }
    >
      {candidates.length === 0 ? (
        <p className="text-sm text-ink-muted">
          Dividends can be tracked for funds and stocks. Add one on the Portfolio page first.
        </p>
      ) : (
        <div className="space-y-4">
          {holding ? (
            <div className="flex items-center gap-3 rounded-2xl bg-surface-muted p-3">
              <AssetLogo name={holding.name} assetClass={holding.assetClass} size="md" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{holding.ticker}</p>
                <p className="truncate text-xs text-ink-muted">{holding.name}</p>
              </div>
            </div>
          ) : (
            <SelectField
              label="Holding"
              value={holdingId}
              onChange={(id) => loadFrom(data.holdings.find((h) => h.id === id) ?? null)}
              options={pickable.map((h) => ({
                value: h.id,
                label: `${h.ticker} · ${h.name}${h.paysDividend ? ' (tracked)' : ''}`,
              }))}
            />
          )}

          {target && (
            <>
              <DividendScheduleFields
                isStock={target.assetClass === 'stock'}
                units={target.units ?? target.totalUnits ?? 0}
                dividendMonths={months}
                setDividendMonths={setMonths}
                payoutDpsMap={dpsMap}
                setPayoutDpsMap={setDpsMap}
                cashAccounts={data.cashAccounts}
                defaultCashAccountId={cashAccountId}
                setDefaultCashAccountId={setCashAccountId}
              />
              {showErrors && months.length === 0 && (
                <p role="alert" className="text-xs font-medium text-loss-ink animate-fade-in">
                  {alreadyTracked ? 'Pick at least one month, or use the delete button to stop tracking' : 'Pick at least one month'}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  )
}

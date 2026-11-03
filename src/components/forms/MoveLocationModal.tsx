import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { NumberField, SelectField, TextField } from '../ui/Field'
import { SegmentedControl } from '../ui/SegmentedControl'
import { Button } from '../ui/Button'
import { useData } from '../../store/DataContext'
import { useToast } from '../../store/ToastContext'
import { GRAMS_PER_BAHT_GOLD } from '../../lib/calc'
import { isValidRate } from '../../lib/fx'
import type { Holding } from '../../lib/types'
import { locationNoun, toInputQty } from '../../lib/locations'

interface Props {
  open: boolean
  /** The holding whose coins / gold are being moved */
  holding: Holding | null
  /** Location the coins leave from */
  fromLocationId: string | null
  onClose: () => void
}

/** A location in the unit people type: sats for BTC, grams for gold, shares for stocks */
type Loc = { id: string; name: string; qty: number; thbSpent: number; usdSpent?: number }

const NEW_LOCATION = '__new__'

function fmtNum(n: number, maxDec = 4): string {
  if (!isFinite(n)) return '0'
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: maxDec })
}

export function MoveLocationModal({ open, holding, fromLocationId, onClose }: Props) {
  const { data, transferLocation, usdThb } = useData()
  const { showToast } = useToast()

  const [toId, setToId] = useState('')
  const [newName, setNewName] = useState('')
  const [amount, setAmount] = useState<number | ''>('')
  const [goldUnit, setGoldUnit] = useState<'grams' | 'baht'>('grams')
  const [fee, setFee] = useState<number | ''>('')
  const [showErrors, setShowErrors] = useState(false)

  // Always read the live holding so the preview matches what is stored right now
  const live = holding ? data.holdings.find((h) => h.id === holding.id) ?? holding : null
  const isBtc = live?.assetClass === 'crypto'
  const isStock = live?.assetClass === 'stock'
  const noun = locationNoun(live?.assetClass)
  const locs: Loc[] = (live?.locations ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    qty: toInputQty(live?.assetClass, l.qty),
    thbSpent: l.thbSpent,
    usdSpent: l.usdSpent,
  }))
  const from = locs.find((l) => l.id === fromLocationId)
  const others = locs.filter((l) => l.id !== fromLocationId)

  useEffect(() => {
    if (!open) return
    setToId(others[0]?.id ?? NEW_LOCATION)
    setNewName('')
    setAmount('')
    setFee('')
    setGoldUnit('grams')
    setShowErrors(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fromLocationId])

  if (!live || !from) return null

  // BTC cost shows in USD with the real rate; without one it stays in THB rather than use a guessed rate
  const rate = isValidRate(usdThb) ? usdThb : 0
  const unitLabel = isBtc ? 'sats' : isStock ? 'shares' : goldUnit === 'baht' ? 'gold baht' : 'g'
  // Gold can be typed in gold baht; everything below works in sats / grams / shares
  const toBase = (v: number) => (isBtc ? Math.round(v) : !isStock && goldUnit === 'baht' ? v * GRAMS_PER_BAHT_GOLD : v)
  const fromBase = (v: number) => (isBtc || isStock ? v : goldUnit === 'baht' ? v / GRAMS_PER_BAHT_GOLD : v)
  const round = (v: number) => (isBtc ? Math.round(v) : parseFloat(v.toFixed(isStock ? 6 : 4)))

  const amountBase = round(toBase(Number(amount) || 0))
  const feeBase = round(toBase(Number(fee) || 0))
  const received = Math.max(0, round(amountBase - feeBase))
  const eps = isBtc ? 0 : isStock ? 0.0000005 : 0.00005
  const movesAll = amountBase >= from.qty - eps && amountBase > 0
  const costMoved = movesAll ? from.thbSpent : (from.qty > 0 ? (from.thbSpent * amountBase) / from.qty : 0)
  const fromUsd = from.usdSpent ?? 0
  const usdMoved = movesAll ? fromUsd : (from.qty > 0 ? (fromUsd * amountBase) / from.qty : 0)

  const isNew = toId === NEW_LOCATION
  const dest = isNew ? null : others.find((l) => l.id === toId) ?? null
  const destName = isNew ? newName.trim() : dest?.name ?? ''

  const amountError =
    amountBase <= 0
      ? 'Enter an amount above 0'
      : amountBase > from.qty + eps
        ? `You only have ${fmtNum(fromBase(from.qty))} ${unitLabel} here`
        : undefined
  const feeError =
    feeBase < 0 ? 'Fee cannot be negative' : feeBase >= amountBase && amountBase > 0 ? 'Fee must be smaller than the amount moved' : undefined
  const destError = isNew && !newName.trim() ? `Give the new ${noun} a name` : undefined
  const valid = !amountError && !feeError && !destError

  // Average cost: coins carry their cost; a fee shrinks the coins so the destination average rises a little.
  // US stocks show their USD average per share
  const avgCost = (qty: number, thb: number, usd = 0) => {
    if (qty <= 0) return 0
    if (isStock) return usd / qty
    if (!isBtc) return (thb / qty) * GRAMS_PER_BAHT_GOLD
    const thbPerBtc = thb / (qty / 100_000_000)
    return rate > 0 ? thbPerBtc / rate : thbPerBtc
  }
  const avgLabel = (v: number) =>
    v <= 0
      ? '–'
      : isStock
        ? `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/share`
        : isBtc
          ? `${rate > 0 ? '$' : '฿'}${Math.round(v).toLocaleString()}/BTC`
          : `฿${Math.round(v).toLocaleString()}/gold baht`
  const showQty = (qty: number) => `${fmtNum(isBtc ? qty : fromBase(qty), isStock ? 6 : 4)} ${unitLabel}`

  const fromAfterQty = movesAll ? 0 : Math.max(0, round(from.qty - amountBase))
  const fromAfterThb = movesAll ? 0 : Math.max(0, from.thbSpent - costMoved)
  const fromAfterUsd = movesAll ? 0 : Math.max(0, fromUsd - usdMoved)
  const destBeforeQty = dest?.qty ?? 0
  const destBeforeThb = dest?.thbSpent ?? 0
  const destBeforeUsd = dest?.usdSpent ?? 0
  const destAfterQty = destBeforeQty + received
  const destAfterThb = destBeforeThb + costMoved
  const destAfterUsd = destBeforeUsd + usdMoved

  const setPercent = (pct: number) => {
    const base = pct >= 100 ? from.qty : round(from.qty * (pct / 100))
    setAmount(isBtc ? base : parseFloat(fromBase(base).toFixed(isStock ? 6 : 4)))
  }

  const submit = () => {
    if (!valid) {
      setShowErrors(true)
      return
    }
    transferLocation({
      holdingId: live.id,
      fromLocationId: from.id,
      toLocationId: isNew ? undefined : dest?.id,
      newLocationName: isNew ? newName.trim() : undefined,
      amount: amountBase,
      fee: feeBase,
    })
    showToast(
      `${showQty(amountBase)} moved from ${from.name} to ${destName}.`,
      'success',
      undefined,
      { popup: true, title: 'Moved!' },
    )
    onClose()
  }

  const locationOptions = [
    ...others.map((l) => ({ value: l.id, label: l.name })),
    { value: NEW_LOCATION, label: `+ New ${noun}…` },
  ]

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Move ${isBtc ? 'Bitcoin' : isStock ? `${live.ticker} shares` : 'gold'}`}
      description={`From ${from.name} · ${showQty(from.qty)} held`}
      footer={
        <Button data-modal-submit onClick={submit} className="w-full">
          Move {isBtc ? 'coins' : isStock ? 'shares' : 'gold'}
        </Button>
      }
    >
      <div className="space-y-4">
        <SelectField label="Move to" value={toId} onChange={setToId} options={locationOptions} />

        {isNew && (
          <TextField
            label={`New ${noun} name`}
            value={newName}
            onChange={setNewName}
            placeholder={isBtc ? 'e.g. Ledger, Binance' : isStock ? 'e.g. Webull, Dime, IBKR' : 'e.g. Home safe, Bank vault'}
            error={showErrors ? destError : undefined}
          />
        )}

        {!isBtc && !isStock && (
          <SegmentedControl
            size="sm"
            gridCols={2}
            value={goldUnit}
            onChange={(v) => {
              setGoldUnit(v)
              setAmount('')
              setFee('')
            }}
            options={[
              { value: 'grams', label: 'Grams' },
              { value: 'baht', label: 'Gold baht' },
            ]}
          />
        )}

        <div className="space-y-2">
          <NumberField
            label={`Amount to move (${unitLabel})`}
            value={amount}
            onChange={setAmount}
            placeholder={isBtc ? 'e.g. 5,000,000' : isStock ? 'e.g. 10' : 'e.g. 15.244'}
            step={isBtc ? 1 : isStock ? 0.000001 : 0.0001}
            autoFocus
            error={showErrors || (amountBase > from.qty + eps) ? amountError : undefined}
          />
          <div className="flex flex-wrap gap-1.5">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => setPercent(pct)}
                className="rounded-full border border-line bg-surface-muted px-3 py-1 text-xs font-semibold text-ink-soft transition-colors hover:border-brand/40 hover:text-link cursor-pointer"
              >
                {pct === 100 ? 'Max' : `${pct}%`}
              </button>
            ))}
          </div>
        </div>

        {/* Brokers charge transfer fees in cash, not in shares */}
        {!isStock && <NumberField
          label={`Network fee (${unitLabel}, optional)`}
          hint="Lost in transit"
          value={fee}
          onChange={setFee}
          placeholder="0"
          step={isBtc ? 1 : 0.0001}
          error={showErrors ? feeError : undefined}
        />}

        {/* Before → after preview */}
        <div className="rounded-2xl bg-surface-muted p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-line pb-2">
            <p className="text-xs font-bold text-link">Move preview (before → after)</p>
          </div>

          {amountBase > 0 && (
            <div className="space-y-1 rounded-xl bg-surface px-3 py-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">You send</span>
                <span className="tnum text-ink-soft">{showQty(amountBase)}</span>
              </div>
              {feeBase > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Network fee</span>
                  <span className="tnum text-loss-ink">−{showQty(feeBase)}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-line pt-1.5">
                <span className="font-semibold text-ink">{destName || 'Destination'} receives</span>
                <span className="tnum font-bold text-gain-ink">{showQty(received)}</span>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <p className="text-xs font-semibold text-ink-muted">{from.name}</p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-muted">Holding</span>
              <span className="tnum text-ink-soft">
                {showQty(from.qty)} → <strong className="text-ink">{showQty(amountBase > 0 ? fromAfterQty : from.qty)}</strong>
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-muted">Avg cost</span>
              <span className="tnum text-ink-soft">
                {avgLabel(avgCost(from.qty, from.thbSpent, fromUsd))}
                {fromAfterQty > 0 && amountBase > 0 && <> → <strong className="text-ink">{avgLabel(avgCost(fromAfterQty, fromAfterThb, fromAfterUsd))}</strong></>}
              </span>
            </div>
          </div>

          <div className="space-y-1 border-t border-line pt-3">
            <p className="text-xs font-semibold text-ink-muted">{destName || `New ${noun}`}</p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-muted">Holding</span>
              <span className="tnum text-ink-soft">
                {showQty(destBeforeQty)} → <strong className="text-ink">{showQty(amountBase > 0 ? destAfterQty : destBeforeQty)}</strong>
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-muted">Avg cost</span>
              <span className="tnum text-ink-soft">
                {avgLabel(avgCost(destBeforeQty, destBeforeThb, destBeforeUsd))}
                {amountBase > 0 && <> → <strong className="text-ink">{avgLabel(avgCost(destAfterQty, destAfterThb, destAfterUsd))}</strong></>}
              </span>
            </div>
          </div>

          <p className="border-t border-line pt-2.5 text-xs leading-relaxed text-ink-muted">
            Moving is not a sale, so your profit and loss do not change.
            {feeBase > 0 && ' The fee shrinks what you hold while your cost stays, so the average cost goes up slightly.'}
          </p>
        </div>
      </div>
    </Modal>
  )
}

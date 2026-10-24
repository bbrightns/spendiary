import type { RefObject } from 'react'
import { useData } from '../../store/DataContext'
import { useToast } from '../../store/ToastContext'
import type { BtcLocation, GoldLocation, Holding } from '../../lib/types'
import { Popover, PopoverDivider, PopoverOption } from '../../components/ui/Popover'
import { CashflowIcon, DividendIcon, LockClosedIcon, LockOpenIcon, MinusIcon, PencilIcon, PlusIcon, TrashIcon } from '../../components/icons'

const ICON = 'h-4 w-4'
/** Shown on an action while its holding or location is locked */
const LOCKED = 'Locked'

/** The ⋯ menu of a holding row: lock, buy, sell, record a dividend, edit. */
export function HoldingActionMenu({ holding, anchorRef, onClose, onBuy, onSell, onDividend, onEdit }: {
  holding: Holding
  anchorRef: RefObject<HTMLElement | null>
  onClose: () => void
  onBuy: (h: Holding) => void
  onSell: (h: Holding) => void
  onDividend: (h: Holding) => void
  onEdit: (h: Holding) => void
}) {
  const { toggleHoldingLock } = useData()
  const { showToast } = useToast()
  const locked = !!holding.isLocked
  // Close first, then act, so the next sheet opens on a clean stack
  const run = (fn: (h: Holding) => void) => () => {
    onClose()
    fn(holding)
  }
  const paysDividend = (holding.assetClass === 'fund' || holding.assetClass === 'stock') && holding.paysDividend

  return (
    <Popover open onClose={onClose} anchorRef={anchorRef} title={holding.name} align="right">
      <PopoverOption
        icon={locked ? <LockOpenIcon className={ICON} /> : <LockClosedIcon className={ICON} />}
        onClick={run((h) => {
          toggleHoldingLock(h.id)
          showToast(h.isLocked ? `"${h.name}" unlocked` : `"${h.name}" locked (protected from selling or deleting)`, 'info')
        })}
      >
        {locked ? 'Unlock' : 'Lock (protect from selling)'}
      </PopoverOption>
      <PopoverDivider />
      <PopoverOption icon={<PlusIcon className={ICON} />} disabled={locked} hint={locked ? LOCKED : undefined} onClick={run(onBuy)}>
        Buy more
      </PopoverOption>
      <PopoverOption icon={<MinusIcon className={ICON} />} disabled={locked} hint={locked ? LOCKED : undefined} onClick={run(onSell)}>
        Sell
      </PopoverOption>
      {paysDividend && (
        <PopoverOption icon={<DividendIcon className={ICON} />} disabled={locked} hint={locked ? LOCKED : undefined} onClick={run(onDividend)}>
          Record dividend
        </PopoverOption>
      )}
      <PopoverDivider />
      <PopoverOption icon={<PencilIcon className={ICON} />} disabled={locked} hint={locked ? LOCKED : undefined} onClick={run(onEdit)}>
        Edit
      </PopoverOption>
    </Popover>
  )
}

export interface PocketMenuTarget {
  holding: Holding
  locId: string
  locName: string
  isBtc: boolean
}

/** The ⋯ menu of one BTC / gold storage location: lock, buy, sell, move, edit, remove. */
export function PocketActionMenu({ menu, anchorRef, onClose, onBuy, onSell, onMove, onEditLocation, onRemoveLocation }: {
  menu: PocketMenuTarget
  anchorRef: RefObject<HTMLElement | null>
  onClose: () => void
  onBuy: (h: Holding, locId: string) => void
  onSell: (h: Holding, locId: string) => void
  onMove: (h: Holding, locId: string) => void
  onEditLocation: (holdingId: string, loc: BtcLocation | GoldLocation) => void
  onRemoveLocation: (target: { holdingId: string; locId: string; name: string; isBtc: boolean }) => void
}) {
  const { toggleLocationLock } = useData()
  const { showToast } = useToast()
  const locs = menu.isBtc ? (menu.holding.btcLocations ?? []) : (menu.holding.goldLocations ?? [])
  const loc = locs.find((l) => l.id === menu.locId)
  const locked = !!loc?.isLocked
  const hint = locked ? LOCKED : undefined
  const run = (fn: () => void) => () => {
    onClose()
    fn()
  }

  return (
    <Popover open onClose={onClose} anchorRef={anchorRef} title={menu.locName} align="right">
      <PopoverOption
        icon={locked ? <LockOpenIcon className={ICON} /> : <LockClosedIcon className={ICON} />}
        onClick={run(() => {
          toggleLocationLock(menu.holding.id, menu.locId, menu.isBtc)
          showToast(locked ? `"${menu.locName}" unlocked` : `"${menu.locName}" locked (protected from selling or deleting)`, 'info')
        })}
      >
        {locked ? 'Unlock location' : 'Lock location'}
      </PopoverOption>
      <PopoverDivider />
      <PopoverOption icon={<PlusIcon className={ICON} />} disabled={locked} hint={hint} onClick={run(() => onBuy(menu.holding, menu.locId))}>
        Buy into this location
      </PopoverOption>
      <PopoverOption icon={<MinusIcon className={ICON} />} disabled={locked} hint={hint} onClick={run(() => onSell(menu.holding, menu.locId))}>
        Sell from this location
      </PopoverOption>
      <PopoverOption icon={<CashflowIcon className={ICON} />} disabled={locked} hint={hint} onClick={run(() => onMove(menu.holding, menu.locId))}>
        Move to another location
      </PopoverOption>
      {loc && (
        <PopoverOption icon={<PencilIcon className={ICON} />} disabled={locked} hint={hint} onClick={run(() => onEditLocation(menu.holding.id, loc))}>
          Edit location
        </PopoverOption>
      )}
      <PopoverDivider />
      <PopoverOption
        icon={<TrashIcon className={ICON} />}
        disabled={locked}
        hint={hint}
        onClick={run(() => onRemoveLocation({ holdingId: menu.holding.id, locId: menu.locId, name: menu.locName, isBtc: menu.isBtc }))}
      >
        Remove location
      </PopoverOption>
    </Popover>
  )
}

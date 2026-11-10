import type { RefObject } from 'react'
import { useData } from '../../store/DataContext'
import { useToast } from '../../store/ToastContext'
import type { Holding, HoldingLocation } from '../../lib/types'
import { hasLocations, locationNoun, supportsLocations } from '../../lib/locations'
import { Popover, PopoverDivider, PopoverOption } from '../../components/ui/Popover'
import { BuyTrendIcon, CashflowIcon, DividendIcon, LockClosedIcon, LockOpenIcon, MinusIcon, PencilIcon, PlusIcon, TrashIcon } from '../../components/icons'

const ICON = 'h-4 w-4'
/** Shown on an action while its holding or location is locked */
const LOCKED = 'Locked'

/** The ⋯ menu of a holding row: lock, buy, sell, record a dividend, see the buy trend, edit. */
export function HoldingActionMenu({ holding, anchorRef, onClose, onBuy, onSell, onDividend, onTrend, onEdit, onSetLocation }: {
  holding: Holding
  anchorRef: RefObject<HTMLElement | null>
  onClose: () => void
  onBuy: (h: Holding) => void
  onSell: (h: Holding) => void
  onDividend: (h: Holding) => void
  /** Where each buy was made, against the average and today's price */
  onTrend: (h: Holding) => void
  onEdit: (h: Holding) => void
  /** Name the broker / wallet that holds this whole holding, before splitting it */
  onSetLocation?: (h: Holding) => void
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
      <PopoverOption icon={<BuyTrendIcon className={ICON} />} onClick={run(onTrend)}>
        Buy trend
      </PopoverOption>
      <PopoverDivider />
      {onSetLocation && supportsLocations(holding.assetClass) && !hasLocations(holding) && holding.units > 0 && (
        <PopoverOption icon={<CashflowIcon className={ICON} />} disabled={locked} hint={locked ? LOCKED : undefined} onClick={run(onSetLocation)}>
          {holding.assetClass === 'stock' ? 'Set broker' : 'Set storage location'}
        </PopoverOption>
      )}
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
}

/** The ⋯ menu of one wallet, vault or broker: lock, buy, sell, move, edit, remove. */
export function PocketActionMenu({ menu, anchorRef, onClose, onBuy, onSell, onMove, onEditLocation, onRemoveLocation }: {
  menu: PocketMenuTarget
  anchorRef: RefObject<HTMLElement | null>
  onClose: () => void
  onBuy: (h: Holding, locId: string) => void
  onSell: (h: Holding, locId: string) => void
  onMove: (h: Holding, locId: string) => void
  onEditLocation: (holdingId: string, loc: HoldingLocation) => void
  onRemoveLocation: (target: { holdingId: string; locId: string; name: string }) => void
}) {
  const { toggleLocationLock } = useData()
  const { showToast } = useToast()
  const loc = (menu.holding.locations ?? []).find((l) => l.id === menu.locId)
  const noun = locationNoun(menu.holding.assetClass)
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
          toggleLocationLock(menu.holding.id, menu.locId)
          showToast(locked ? `"${menu.locName}" unlocked` : `"${menu.locName}" locked (protected from selling or deleting)`, 'info')
        })}
      >
        {locked ? `Unlock ${noun}` : `Lock ${noun}`}
      </PopoverOption>
      <PopoverDivider />
      <PopoverOption icon={<PlusIcon className={ICON} />} disabled={locked} hint={hint} onClick={run(() => onBuy(menu.holding, menu.locId))}>
        {`Buy into this ${noun}`}
      </PopoverOption>
      <PopoverOption icon={<MinusIcon className={ICON} />} disabled={locked} hint={hint} onClick={run(() => onSell(menu.holding, menu.locId))}>
        {`Sell from this ${noun}`}
      </PopoverOption>
      <PopoverOption icon={<CashflowIcon className={ICON} />} disabled={locked} hint={hint} onClick={run(() => onMove(menu.holding, menu.locId))}>
        {`Move to another ${noun}`}
      </PopoverOption>
      {loc && (
        <PopoverOption icon={<PencilIcon className={ICON} />} disabled={locked} hint={hint} onClick={run(() => onEditLocation(menu.holding.id, loc))}>
          {`Edit ${noun}`}
        </PopoverOption>
      )}
      <PopoverDivider />
      <PopoverOption
        icon={<TrashIcon className={ICON} />}
        disabled={locked}
        hint={hint}
        onClick={run(() => onRemoveLocation({ holdingId: menu.holding.id, locId: menu.locId, name: menu.locName }))}
      >
        {`Remove ${noun}`}
      </PopoverOption>
    </Popover>
  )
}

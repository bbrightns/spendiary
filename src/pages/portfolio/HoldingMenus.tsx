import { createPortal } from 'react-dom'
import { useData } from '../../store/DataContext'
import { useToast } from '../../store/ToastContext'
import type { BtcLocation, GoldLocation, Holding } from '../../lib/types'
import { DividendIcon, LockClosedIcon, LockOpenIcon, MinusIcon, PencilIcon, PlusIcon, TrashIcon } from '../../components/icons'

/** Where a dropdown opens: below or above its ⋯ button, lined up with its right edge */
export interface MenuCoords {
  top?: number
  bottom?: number
  right: number
}

/** The ⋯ menu of a holding row: lock, buy, sell, record a dividend, edit. */
export function HoldingActionMenu({ holding, coords, direction, onClose, onBuy, onSell, onDividend, onEdit }: {
  holding: Holding
  coords: MenuCoords
  direction: 'up' | 'down'
  onClose: () => void
  onBuy: (h: Holding) => void
  onSell: (h: Holding) => void
  onDividend: (h: Holding) => void
  onEdit: (h: Holding) => void
}) {
  const { toggleHoldingLock } = useData()
  const { showToast } = useToast()
  if (typeof document === 'undefined') return null
  return createPortal(
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        style={{
          position: 'fixed',
          top: coords.top !== undefined ? `${coords.top}px` : undefined,
          bottom: coords.bottom !== undefined ? `${coords.bottom}px` : undefined,
          right: `${coords.right}px`,
        }}
        className={`z-50 min-w-[170px] max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 ${
          direction === 'up' ? 'origin-bottom-right' : 'origin-top-right'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Safe-Haven Lock / Unlock Toggle */}
        <button
          type="button"
          onClick={() => {
            const target = holding
            onClose()
            toggleHoldingLock(target.id)
            showToast(
              target.isLocked
                ? `"${target.name}" unlocked`
                : `"${target.name}" locked (protected from selling or deleting)`,
              'info'
            )
          }}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-ink hover:bg-surface-muted transition-colors cursor-pointer text-left"
        >
          {holding.isLocked ? (
            <>
              <LockOpenIcon className="h-4 w-4 text-amber-500 shrink-0" strokeWidth={2} />
              <span>Unlock</span>
            </>
          ) : (
            <>
              <LockClosedIcon className="h-4 w-4 text-amber-500 shrink-0" strokeWidth={2} />
              <span>Lock (protect from selling)</span>
            </>
          )}
        </button>
        <div className="my-1 border-t border-line/60" />

        {holding.isLocked ? (
          <div
            title="This asset is locked. Unlock it first to make changes."
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold text-ink-muted/50 bg-surface-muted/40 cursor-not-allowed select-none"
          >
            <div className="flex items-center gap-2.5">
              <PlusIcon className="h-4 w-4 text-ink-muted/40 shrink-0" strokeWidth={2.4} />
              <span>Buy more</span>
            </div>
            <span className="text-[11px] font-normal text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <LockClosedIcon className="h-3 w-3" /> Locked
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              const target = holding
              onClose()
              onBuy(target)
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-gain hover:bg-gain/10 transition-colors cursor-pointer text-left"
          >
            <PlusIcon className="h-4 w-4 text-gain shrink-0" strokeWidth={2.4} />
            <span>Buy more</span>
          </button>
        )}

        {holding.isLocked ? (
          <div
            title="This asset is locked. Unlock it first to sell."
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold text-ink-muted/50 bg-surface-muted/40 cursor-not-allowed select-none"
          >
            <div className="flex items-center gap-2.5">
              <MinusIcon className="h-4 w-4 text-ink-muted/40 shrink-0" strokeWidth={2.4} />
              <span>Sell</span>
            </div>
            <span className="text-[11px] font-normal text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <LockClosedIcon className="h-3 w-3" /> Locked
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              const target = holding
              onClose()
              onSell(target)
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer text-left"
          >
            <MinusIcon className="h-4 w-4 text-rose-500 shrink-0" strokeWidth={2.4} />
            <span>Sell</span>
          </button>
        )}

        {(holding.assetClass === 'fund' || holding.assetClass === 'stock') && holding.paysDividend && (
          holding.isLocked ? (
            <div
              title="This asset is locked. Unlock it first to record a dividend."
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold text-ink-muted/50 bg-surface-muted/40 cursor-not-allowed select-none"
            >
              <div className="flex items-center gap-2.5">
                <DividendIcon className="h-4 w-4 text-ink-muted/40 shrink-0" strokeWidth={2.2} />
                <span>Record dividend</span>
              </div>
              <span className="text-[11px] font-normal text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <LockClosedIcon className="h-3 w-3" /> Locked
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                const target = holding
                onClose()
                onDividend(target)
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer text-left"
            >
              <DividendIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={2.2} />
              <span>Record dividend</span>
            </button>
          )
        )}
        <div className="my-1 border-t border-line/60" />
        {holding.isLocked ? (
          <div
            title="This asset is locked. Unlock it first to edit."
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-medium text-ink-muted/50 bg-surface-muted/40 cursor-not-allowed select-none"
          >
            <div className="flex items-center gap-2.5">
              <PencilIcon className="h-3.5 w-3.5 text-ink-muted/40 shrink-0" />
              <span>Edit</span>
            </div>
            <span className="text-[11px] font-normal text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <LockClosedIcon className="h-3 w-3" /> Locked
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              const target = holding
              onClose()
              onEdit(target)
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted hover:text-ink transition-colors cursor-pointer text-left"
          >
            <PencilIcon className="h-3.5 w-3.5 shrink-0" />
            <span>Edit</span>
          </button>
        )}
      </div>
    </>,
    document.body
  )
}

export interface PocketMenuTarget {
  holding: Holding
  locId: string
  locName: string
  isBtc: boolean
}

/** The ⋯ menu of one BTC / gold storage location: lock, buy, sell, move, edit, remove. */
export function PocketActionMenu({ menu, coords, direction, onClose, onBuy, onSell, onMove, onEditLocation, onRemoveLocation }: {
  menu: PocketMenuTarget
  coords: MenuCoords
  direction: 'up' | 'down'
  onClose: () => void
  onBuy: (h: Holding, locId: string) => void
  onSell: (h: Holding, locId: string) => void
  onMove: (h: Holding, locId: string) => void
  onEditLocation: (holdingId: string, loc: BtcLocation | GoldLocation) => void
  onRemoveLocation: (target: { holdingId: string; locId: string; name: string; isBtc: boolean }) => void
}) {
  const { toggleLocationLock } = useData()
  const { showToast } = useToast()
  if (typeof document === 'undefined') return null
  const locs = menu.isBtc
    ? (menu.holding.btcLocations ?? [])
    : (menu.holding.goldLocations ?? [])
  const loc = locs.find((l) => l.id === menu.locId)
  const isLocLocked = !!loc?.isLocked

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        style={{
          position: 'fixed',
          top: coords.top !== undefined ? `${coords.top}px` : undefined,
          bottom: coords.bottom !== undefined ? `${coords.bottom}px` : undefined,
          right: `${coords.right}px`,
        }}
        className={`z-50 min-w-[190px] max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 ${
          direction === 'up' ? 'origin-bottom-right' : 'origin-top-right'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cold-Storage Lock / Unlock Toggle */}
        <button
          type="button"
          onClick={() => {
            const t = menu
            onClose()
            toggleLocationLock(t.holding.id, t.locId, t.isBtc)
            showToast(
              isLocLocked
                ? `"${t.locName}" unlocked`
                : `"${t.locName}" locked (protected from selling or deleting)`,
              'info'
            )
          }}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-ink hover:bg-surface-muted transition-colors cursor-pointer text-left"
        >
          {isLocLocked ? (
            <>
              <LockOpenIcon className="h-4 w-4 text-amber-500 shrink-0" strokeWidth={2} />
              <span>Unlock location</span>
            </>
          ) : (
            <>
              <LockClosedIcon className="h-4 w-4 text-amber-500 shrink-0" strokeWidth={2} />
              <span>Lock location</span>
            </>
          )}
        </button>
        <div className="my-1 border-t border-line/60" />

        {isLocLocked ? (
          <div
            title="This location is locked. Unlock it first to make changes."
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold text-ink-muted/50 bg-surface-muted/40 cursor-not-allowed select-none"
          >
            <div className="flex items-center gap-2.5">
              <PlusIcon className="h-4 w-4 text-ink-muted/40 shrink-0" strokeWidth={2.4} />
              <span>Buy into this location</span>
            </div>
            <span className="text-[11px] font-normal text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <LockClosedIcon className="h-3 w-3" /> Locked
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              const t = menu
              onClose()
              onBuy(t.holding, t.locId)
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-gain hover:bg-gain/10 transition-colors cursor-pointer text-left"
          >
            <PlusIcon className="h-4 w-4 text-gain shrink-0" strokeWidth={2.4} />
            <span>Buy into this location</span>
          </button>
        )}

        {isLocLocked ? (
          <div
            title="This location is locked. Unlock it first to sell."
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold text-ink-muted/50 bg-surface-muted/40 cursor-not-allowed select-none"
          >
            <div className="flex items-center gap-2.5">
              <MinusIcon className="h-4 w-4 text-ink-muted/40 shrink-0" strokeWidth={2.4} />
              <span>Sell from this location</span>
            </div>
            <span className="text-[11px] font-normal text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <LockClosedIcon className="h-3 w-3" /> Locked
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              const t = menu
              onClose()
              onSell(t.holding, t.locId)
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer text-left"
          >
            <MinusIcon className="h-4 w-4 text-rose-500 shrink-0" strokeWidth={2.4} />
            <span>Sell from this location</span>
          </button>
        )}

        {isLocLocked ? (
          <div
            title="This location is locked. Unlock it first to move coins out."
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold text-ink-muted/50 bg-surface-muted/40 cursor-not-allowed select-none"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-4 text-center text-base leading-none text-ink-muted/40">⇄</span>
              <span>Move to another location</span>
            </div>
            <span className="text-[11px] font-normal text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <LockClosedIcon className="h-3 w-3" /> Locked
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              const t = menu
              onClose()
              onMove(t.holding, t.locId)
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 transition-colors cursor-pointer text-left"
          >
            <span className="w-4 text-center text-base leading-none">⇄</span>
            <span>Move to another location</span>
          </button>
        )}

        {loc && (
          isLocLocked ? (
            <div
              title="This location is locked. Unlock it first to edit."
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-medium text-ink-muted/50 bg-surface-muted/40 cursor-not-allowed select-none"
            >
              <div className="flex items-center gap-2.5">
                <PencilIcon className="h-3.5 w-3.5 text-ink-muted/40 shrink-0" />
                <span>Edit location</span>
              </div>
              <span className="text-[11px] font-normal text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <LockClosedIcon className="h-3 w-3" /> Locked
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                const t = menu
                onClose()
                onEditLocation(t.holding.id, loc)
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted hover:text-ink transition-colors cursor-pointer text-left"
            >
              <PencilIcon className="h-3.5 w-3.5 shrink-0" />
              <span>Edit location</span>
            </button>
          )
        )}

        <div className="my-1 border-t border-line/60" />

        {isLocLocked ? (
          <div
            title="A locked location can't be removed. Unlock it first."
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold text-ink-muted/50 bg-surface-muted/40 cursor-not-allowed select-none"
          >
            <div className="flex items-center gap-2.5">
              <TrashIcon className="h-4 w-4 text-ink-muted/40 shrink-0" strokeWidth={2.2} />
              <span>Remove location</span>
            </div>
            <span className="text-[11px] font-normal text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <LockClosedIcon className="h-3 w-3" /> Locked
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              const t = menu
              onClose()
              onRemoveLocation({ holdingId: t.holding.id, locId: t.locId, name: t.locName, isBtc: t.isBtc })
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer text-left"
          >
            <TrashIcon className="h-4 w-4 text-rose-500 shrink-0" strokeWidth={2.2} />
            <span>Remove location</span>
          </button>
        )}
      </div>
    </>,
    document.body
  )
}

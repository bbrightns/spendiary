import { EntryRow } from '../../components/ui/EntryRow'
import { IconButton } from '../../components/ui/IconButton'
import { UndoIcon } from '../../components/icons'
import { ASSET_META } from '../../lib/calc'
import type { HoldingLog } from '../../lib/types'
import { canUndoLog } from '../../store/actions/holdingLogs'
import { getLogActionMeta } from './logMeta'
import { getTradeRow } from './tradeView'

/** The asset-tinted tile with the entry's action icon */
export function TradeTile({ log }: { log: HoldingLog }) {
  const { icon: Icon } = getLogActionMeta(log)
  const color = ASSET_META[log.assetClass]?.cssVar ?? 'var(--color-brand)'
  return (
    <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ color, background: `color-mix(in srgb, ${color} 11%, transparent)` }}>
      <Icon className="h-[18px] w-[18px]" />
    </span>
  )
}

interface Props {
  log: HoldingLog
  usdThb: number | null
  onOpen: () => void
  onUndo: () => void
  /** Choosing entries to delete: a checkbox takes the place of Undo */
  selecting: boolean
  selected: boolean
  onToggleSelected: () => void
}

/** One Trades entry, on Spend's history row: tap for details, the undo arrow to reverse it */
export function TradeRow({ log, usdThb, onOpen, onUndo, selecting, selected, onToggleSelected }: Props) {
  const view = getTradeRow(log, usdThb)
  const kind = getLogActionMeta(log)
  return (
    <EntryRow
      onClick={selecting ? onToggleSelected : onOpen}
      ariaLabel={`${view.title}, ${kind.label}${view.amount ? `, ${view.amount}` : ''}, ${selecting ? 'select' : 'open details'}`}
      icon={<TradeTile log={log} />}
      title={view.title}
      // The kind sits on the meta line, so a long asset name keeps the whole title line on phones
      meta={
        <span className="flex min-w-0 items-center gap-1.5">
          <span className={`shrink-0 rounded-full px-1.5 py-px text-2xs font-bold ${kind.style}`}>{kind.label}</span>
          <span className="truncate">{view.meta}</span>
        </span>
      }
      amount={view.amount}
      amountClass={view.amountClass}
      sub={view.sub}
      subClass={view.subClass}
      leading={
        selecting ? (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelected}
            aria-label={`Select ${view.title}`}
            className="h-4 w-4 shrink-0 rounded border-line-strong accent-brand"
          />
        ) : undefined
      }
      action={
        selecting ? undefined : canUndoLog(log) ? (
          <IconButton size="sm" icon={<UndoIcon className="h-4 w-4" />} label={`Undo ${view.title}`} onClick={onUndo} />
        ) : (
          // Keeps amounts lined up with the rows that have Undo
          <span aria-hidden className="w-8 shrink-0" />
        )
      }
    />
  )
}

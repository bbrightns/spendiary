import { pct, signedThb, signedThbCompact } from '../../lib/format'
import { ArrowDownRight, ArrowUpRight } from '../icons'

function cx(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

interface PnLPillProps {
  value: number
  /** Show as percentage instead of money */
  asPct?: boolean
  size?: 'sm' | 'md'
}

/** Compact gain/loss pill with directional arrow. */
export function PnLPill({ value, asPct = false, size = 'sm' }: PnLPillProps) {
  const up = value >= 0
  const Arrow = up ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={cx(
        // nowrap + shrink-0: the pill must stay on one line (arrow + amount) —
        // sibling truncate text absorbs the squeeze instead.
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full font-semibold tnum',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        up ? 'bg-gain-soft text-gain' : 'bg-loss-soft text-loss',
      )}
    >
      <Arrow className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} strokeWidth={2} />
      {asPct ? pct(value) : signedThb(value)}
    </span>
  )
}

interface PnLTextProps {
  value: number
  className?: string
  /** Format as compact currency e.g. +฿1.24M or -฿500K */
  compact?: boolean
}

export function PnLText({ value, className, compact = false }: PnLTextProps) {
  const up = value >= 0
  return (
    <span
      title={signedThb(value)}
      className={cx('tnum font-semibold cursor-default', up ? 'text-gain' : 'text-loss', className)}
    >
      {compact ? signedThbCompact(value) : signedThb(value)}
    </span>
  )
}

/**
 * Stands in for a P/L pill when a holding has no real price yet: its value is counted at cost,
 * so any P/L shown would be a made-up 0%.
 */
export function NoPricePill({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  return (
    <span
      title="No price yet: counted at cost, so there is no profit or loss to show"
      className={cx(
        'inline-flex shrink-0 items-center whitespace-nowrap rounded-full font-semibold bg-warn-soft text-warn',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
      )}
    >
      No price yet
    </span>
  )
}

/** Says which holdings a P/L total leaves out, so the total isn't read as covering everything */
export function UnpricedNote({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null
  return (
    <p className={cx('text-xs font-medium text-warn', className)}>
      Leaves out {count} {count === 1 ? 'holding' : 'holdings'} with no price yet
    </p>
  )
}

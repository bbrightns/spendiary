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

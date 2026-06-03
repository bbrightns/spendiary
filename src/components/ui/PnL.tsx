import { pct, signedThb } from '../../lib/format'
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
        'inline-flex items-center gap-1 rounded-full font-semibold tnum',
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
}

export function PnLText({ value, className }: PnLTextProps) {
  const up = value >= 0
  return (
    <span className={cx('tnum font-semibold', up ? 'text-gain' : 'text-loss', className)}>
      {signedThb(value)}
    </span>
  )
}

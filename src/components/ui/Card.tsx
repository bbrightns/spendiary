import type { HTMLAttributes, ReactNode } from 'react'

function cx(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  padded?: boolean
  /** Stat tiles in a grid: p-4 instead of p-5 */
  compact?: boolean
  hover?: boolean
}

export function Card({ children, padded = true, compact = false, hover = false, className, ...rest }: CardProps) {
  return (
    <div
      className={cx(
        'rounded-[var(--radius-card)] bg-surface border border-line shadow-[var(--shadow-soft)]',
        hover && 'transition-shadow duration-300 hover:shadow-[var(--shadow-lift)]',
        padded && (compact ? 'p-4' : 'p-5'),
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

/** A card's heading row: title on the left, one link or small button on the right. */
export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cx('flex justify-between gap-3', description ? 'items-start' : 'items-center', className)}>
      <div className="min-w-0">
        <h2 className="font-display text-lg font-extrabold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-ink-muted">{description}</p>}
      </div>
      {action && <div className={cx('shrink-0', description ? 'pt-0.5' : undefined)}>{action}</div>}
    </div>
  )
}

/** A group of figures inside a card. Never a bordered box: cards don't nest. */
export function Inset({ children, className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('rounded-2xl bg-surface-muted p-4', className)} {...rest}>
      {children}
    </div>
  )
}

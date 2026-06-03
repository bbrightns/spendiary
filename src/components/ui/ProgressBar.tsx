interface ProgressBarProps {
  /** 0–100 */
  value: number
  color?: string
  trackClassName?: string
  className?: string
  height?: number
}

export function ProgressBar({
  value,
  color = 'var(--color-brand)',
  trackClassName = 'bg-surface-muted',
  className,
  height = 8,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div
      className={`w-full overflow-hidden rounded-full ${trackClassName} ${className ?? ''}`}
      style={{ height }}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{
          width: `${clamped}%`,
          background: color,
        }}
      />
    </div>
  )
}

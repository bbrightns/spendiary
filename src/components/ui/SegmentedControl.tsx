import type { ReactNode } from 'react'

export interface SegmentOption<T extends string> {
  value: T
  label: ReactNode
  icon?: ReactNode
  title?: string
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  size?: 'sm' | 'md'
  fullWidth?: boolean
  gridCols?: 2 | 3 | 4
  className?: string
  ariaLabel?: string
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  fullWidth = true,
  gridCols,
  className = '',
  ariaLabel,
}: SegmentedControlProps<T>) {
  const sizeClasses = {
    sm: 'py-1.5 px-2.5 text-[12px]',
    md: 'py-2 px-3 text-[12.5px] sm:text-[13px]',
  }

  const gridClasses: Record<number, string> = {
    2: 'grid grid-cols-2 gap-1 rounded-xl bg-surface-muted p-1 border border-line-strong/30 w-full',
    3: 'grid grid-cols-3 gap-1 rounded-xl bg-surface-muted p-1 border border-line-strong/30 w-full',
    4: 'grid grid-cols-4 gap-1 rounded-xl bg-surface-muted p-1 border border-line-strong/30 w-full',
  }

  const containerClasses = gridCols && gridClasses[gridCols]
    ? gridClasses[gridCols]
    : `flex items-center rounded-xl bg-surface-muted p-1 gap-1 border border-line-strong/30 ${
        fullWidth ? 'w-full' : 'inline-flex'
      }`

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`${containerClasses} ${className}`}
    >
      {options.map((opt) => {
        const isSelected = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            title={opt.title}
            onClick={() => onChange(opt.value)}
            className={`${fullWidth ? 'flex-1' : ''} inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-all duration-200 cursor-pointer ${
              sizeClasses[size]
            } ${
              isSelected
                ? 'bg-surface text-ink shadow-sm'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            {opt.icon && <span className="shrink-0">{opt.icon}</span>}
            <span className="truncate">{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}

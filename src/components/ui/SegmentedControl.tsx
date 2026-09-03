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
  className?: string
  ariaLabel?: string
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  fullWidth = true,
  className = '',
  ariaLabel,
}: SegmentedControlProps<T>) {
  const sizeClasses = {
    sm: 'py-1.5 px-2.5 text-[12px]',
    md: 'py-2 px-3 text-[12.5px] sm:text-[13px]',
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`flex items-center rounded-xl bg-surface-muted p-1 gap-1 border border-line-strong/30 ${
        fullWidth ? 'w-full' : 'inline-flex'
      } ${className}`}
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

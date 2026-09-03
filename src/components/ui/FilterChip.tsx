import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface FilterChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active: boolean
  children: ReactNode
  count?: number
}

export function FilterChip({
  active,
  children,
  count,
  className = '',
  ...rest
}: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`shrink-0 inline-flex items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] leading-5 font-semibold transition-colors cursor-pointer select-none ${
        active
          ? 'bg-ink text-white dark:bg-brand shadow-xs'
          : 'bg-surface-muted text-ink-soft hover:text-ink'
      } ${className}`}
      {...rest}
    >
      <span>{children}</span>
      {count !== undefined && (
        <span
          className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none ${
            active ? 'bg-white/20 text-white' : 'bg-surface text-ink-muted'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  )
}

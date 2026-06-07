import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
  accent?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  accent = 'var(--color-brand)',
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div
        className="relative mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{
          color: accent,
          background: `color-mix(in srgb, ${accent} 10%, transparent)`,
          boxShadow: `0 12px 30px -16px color-mix(in srgb, ${accent} 60%, transparent)`,
        }}
      >
        <span
          aria-hidden
          className="absolute inset-0 rounded-2xl ring-1"
          style={{ '--tw-ring-color': `color-mix(in srgb, ${accent} 22%, transparent)` } as React.CSSProperties}
        />
        {icon}
      </div>
      <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
      <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-ink-muted">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

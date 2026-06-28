import type { ReactNode } from 'react'
import { Card } from './Card'
import { PencilIcon } from '../icons'

interface StatCardProps {
  label: string
  value: string
  icon: ReactNode
  accent?: string
  footer?: ReactNode
  emphasis?: boolean
  onClick?: () => void
  editable?: boolean
  className?: string
}

export function StatCard({
  label,
  value,
  icon,
  accent = 'var(--color-brand)',
  footer,
  emphasis = false,
  onClick,
  editable = false,
  className = '',
}: StatCardProps) {
  return (
    <Card
      hover
      onClick={onClick}
      className={`group flex flex-col justify-between animate-rise ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      <div className="flex items-start justify-between">
        <p className="flex items-center gap-2 text-[13px] font-medium text-ink-muted">
          {label}
          {editable && (
            <span className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] -my-3.5 -mx-3">
              <PencilIcon className="h-4 w-4 text-ink-muted opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200" />
            </span>
          )}
        </p>
        <span
          className="grid h-9 w-9 place-items-center rounded-xl"
          style={{
            color: accent,
            background: `color-mix(in srgb, ${accent} 11%, transparent)`,
          }}
        >
          {icon}
        </span>
      </div>
      <p
        className={`mt-4 font-display font-extrabold tracking-tight tnum text-ink ${
          emphasis ? 'text-[30px] ' : 'text-[24px] '
        }`}
      >
        {value}
      </p>
      {footer && <div className="mt-2.5">{footer}</div>}
    </Card>
  )
}


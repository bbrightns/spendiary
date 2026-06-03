import React, { type ReactNode } from 'react'

interface PageHeaderProps {
  eyebrow?: string
  title: string
  subtitle?: React.ReactNode
  action?: ReactNode
}

export function PageHeader({ eyebrow, title, subtitle, action }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
      <div>
        {eyebrow && (
          <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-brand">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-[27px] font-extrabold leading-none tracking-tight text-ink sm:text-[34px]">
          {title}
        </h1>
        {subtitle && <p className="mt-2 text-[14.5px] text-ink-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  )
}

import React, { type ReactNode } from 'react'
import { HelpCircleIcon } from '../icons'

interface PageHeaderProps {
  eyebrow?: string
  title: string
  subtitle?: React.ReactNode
  action?: ReactNode
  onStartGuide?: () => void
}

export function PageHeader({ eyebrow, title, subtitle, action, onStartGuide }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-brand">
            {eyebrow}
          </p>
        )}
        <div className="flex items-center gap-2.5">
          <h1 className="font-display text-[27px] font-extrabold leading-none tracking-tight text-ink [text-wrap:balance]">
            {title}
          </h1>
          {onStartGuide && (
            <button
              type="button"
              onClick={onStartGuide}
              title="แนะนำการใช้งานหน้านี้"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold text-brand bg-brand/10 hover:bg-brand/20 dark:bg-[#4f46e5]/20 dark:text-[#c7d2fe] dark:border-[#4f46e5]/40 active:scale-95 transition-all border border-brand/20 cursor-pointer shadow-xs"
            >
              <HelpCircleIcon className="w-3.5 h-3.5" />
              <span>แนะนำวิธีใช้</span>
            </button>
          )}
        </div>
        {subtitle && <p className="mt-2 text-[14.5px] text-ink-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  )
}



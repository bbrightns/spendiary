import React, { type ReactNode } from 'react'
import { HelpCircleIcon } from '../icons'
import { useSpendSide } from '../../hooks/side'
import { INVEST_ACCENT_TEXT, SPEND_ACCENT_TEXT } from '../tones'

interface PageHeaderProps {
  eyebrow?: string
  title: string
  subtitle?: React.ReactNode
  action?: ReactNode
  onStartGuide?: () => void
  className?: string
}

export function PageHeader({ eyebrow, title, subtitle, action, onStartGuide, className = '' }: PageHeaderProps) {
  // The eyebrow takes the color of its side, like the Invest/Spend switch
  const accent = useSpendSide() ? SPEND_ACCENT_TEXT : INVEST_ACCENT_TEXT
  return (
    <header className={`mb-6 flex flex-wrap items-end justify-between gap-4 ${className}`}>
      {/* A 16rem basis keeps one small action beside the title on phones; wider actions wrap below */}
      <div className="min-w-0 flex-[1_1_16rem]">
        {eyebrow && (
          <p className={`mb-1 text-xs font-semibold uppercase tracking-[0.08em] ${accent}`}>
            {eyebrow}
          </p>
        )}
        <div className="flex items-center gap-2.5">
          <h1 className="font-display text-2xl font-extrabold leading-tight tracking-tight text-ink [text-wrap:balance] sm:text-3xl">
            {title}
          </h1>
          {onStartGuide && (
            <button
              type="button"
              onClick={onStartGuide}
              title="Page guide"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-brand bg-brand/10 hover:bg-brand/20 dark:bg-brand/20 dark:text-brand-ink dark:border-brand/40 active:scale-95 transition-all border border-brand/20 cursor-pointer shadow-xs"
            >
              <HelpCircleIcon className="w-3.5 h-3.5" />
              <span>Guide</span>
            </button>
          )}
        </div>
        {subtitle && <div className="mt-2 text-sm text-ink-muted">{subtitle}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  )
}



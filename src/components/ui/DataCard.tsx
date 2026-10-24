import type { ReactNode } from 'react'
import { Card } from './Card'

/**
 * Settings → Data & backup: one card per kind of data (Spend, Invest, all of it), each a title,
 * a one-line summary of what's stored, and rows of actions written the same way.
 */
export function DataCard({ id, title, summary, children }: { id?: string; title: string; summary?: string; children: ReactNode }) {
  return (
    <Card id={id} className="animate-rise scroll-mt-24">
      <h2 className="font-display text-lg font-extrabold text-ink">{title}</h2>
      {summary && <p className="mt-0.5 text-sm text-ink-muted [text-wrap:pretty]">{summary}</p>}
      <div className="mt-3 divide-y divide-line">{children}</div>
    </Card>
  )
}

/** One action: what it does on the left (plus an optional status line), its button on the right. */
export function DataRow({ title, description, status, action }: { title: string; description: string; status?: ReactNode; action: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="mt-0.5 text-xs text-ink-muted [text-wrap:pretty]">{description}</p>
        {status}
      </div>
      {action}
    </div>
  )
}

const ACTION_BASE =
  'inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors active:scale-95 cursor-pointer disabled:pointer-events-none disabled:opacity-50'
const ACTION_TONE = {
  default: 'bg-surface-muted text-ink-soft hover:bg-primary hover:text-white',
  danger: 'bg-loss-soft text-loss-ink hover:bg-loss hover:text-white',
}

/** The pill button on a DataRow (or the account line); `danger` for deleting things. */
export function DataAction({
  label,
  icon,
  onClick,
  tone = 'default',
  disabled,
  id,
  ariaLabel,
}: {
  label: string
  icon?: ReactNode
  onClick: () => void
  tone?: keyof typeof ACTION_TONE
  disabled?: boolean
  id?: string
  ariaLabel?: string
}) {
  return (
    <button type="button" id={id} onClick={onClick} disabled={disabled} aria-label={ariaLabel} className={`${ACTION_BASE} ${ACTION_TONE[tone]}`}>
      {icon}
      {label}
    </button>
  )
}

import type { ReactNode } from 'react'
import { Modal } from '../../components/ui/Modal'
import { FormActions } from '../../components/forms/FormActions'
import { ChevronDownIcon } from '../../components/icons'

/** Two stacked bars with arrows: the "arrange" button. */
export function ArrangeIcon(p: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={p.className}>
      <rect x="3" y="4" width="12" height="6" rx="1.5" />
      <rect x="3" y="14" width="12" height="6" rx="1.5" />
      <path d="M19 4v16M16.5 6.5 19 4l2.5 2.5M16.5 17.5 19 20l2.5-2.5" />
    </svg>
  )
}

/** Round "arrange" button for a section header. */
export function ArrangeButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface text-ink-muted shadow-xs hover:text-ink cursor-pointer"
    >
      <ArrangeIcon className="h-[18px] w-[18px]" />
    </button>
  )
}

interface Props {
  open: boolean
  title: string
  description?: string
  /** In their current order */
  items: { id: string; label: string; leading?: ReactNode }[]
  onMove: (id: string, delta: -1 | 1) => void
  /** Back to the default order; the Reset link shows once something has moved */
  onReset: () => void
  canReset: boolean
  onClose: () => void
}

/** Reorder a list with up / down buttons; each move is saved right away. */
export function ReorderSheet({ open, title, description, items, onMove, onReset, canReset, onClose }: Props) {
  const btn =
    'grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line text-ink-soft transition-colors cursor-pointer hover:bg-surface-muted hover:text-ink disabled:cursor-default disabled:opacity-30'
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={<FormActions editing={false} canSave onSave={onClose} submitLabel="Done" />}
    >
      {canReset && (
        <div className="-mt-1 mb-2 flex justify-end">
          <button type="button" onClick={onReset} className="text-sm font-semibold text-link hover:underline cursor-pointer">
            Reset to default order
          </button>
        </div>
      )}
      <ol className="space-y-2">
        {items.map(({ id, label, leading }, i) => (
          <li key={id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-3 py-2">
            {leading ?? (
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-surface-muted text-xs font-bold text-ink-muted tnum">{i + 1}</span>
            )}
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{label}</span>
            <button type="button" className={btn} disabled={i === 0} onClick={() => onMove(id, -1)} aria-label={`Move ${label} up`}>
              <ChevronDownIcon className="h-4 w-4 rotate-180" strokeWidth={2} />
            </button>
            <button type="button" className={btn} disabled={i === items.length - 1} onClick={() => onMove(id, 1)} aria-label={`Move ${label} down`}>
              <ChevronDownIcon className="h-4 w-4" strokeWidth={2} />
            </button>
          </li>
        ))}
      </ol>
    </Modal>
  )
}

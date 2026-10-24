import { useState, useEffect, useRef, type ReactNode } from 'react'
import { Button } from '../ui/Button'
import { TrashIcon } from '../icons'

interface Props {
  editing: boolean
  canSave: boolean
  onSave: () => void
  onDelete?: () => void
  /** What the button does ("Pay ฿1,200", "Log buy"); defaults to "Save changes" / "Add" */
  submitLabel?: string
  /** Why the button is disabled, shown above it while canSave is false */
  hint?: ReactNode
}

export function FormActions({ editing, canSave, onSave, onDelete, submitLabel, hint }: Props) {
  const [confirm, setConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [])

  // Paint the spinner first, then run the (synchronous) save so the click feels instant and can't be double-fired
  function handleSave() {
    if (saving) return
    setSaving(true)
    requestAnimationFrame(() => {
      window.setTimeout(() => {
        try {
          onSave()
        } finally {
          setSaving(false)
        }
      }, 0)
    })
  }

  function handleDeleteClick(e: React.MouseEvent) {
    e.preventDefault()
    if (confirm) {
      if (timerRef.current) window.clearTimeout(timerRef.current)
      onDelete?.()
    } else {
      setConfirm(true)
      timerRef.current = window.setTimeout(() => {
        setConfirm(false)
      }, 3000)
    }
  }

  return (
    <div className="w-full">
      {!canSave && hint && (
        <p role="status" className="mb-2.5 text-center text-xs font-medium text-ink-muted">
          {hint}
        </p>
      )}
      <div className="flex items-center gap-3 w-full">
        {editing && onDelete && (
          <button
            type="button"
            onClick={handleDeleteClick}
            className={[
              'inline-flex h-11 shrink-0 items-center justify-center rounded-full transition-all duration-200 border text-sm font-semibold',
              confirm
                ? 'px-4 bg-danger border-danger text-white hover:bg-danger-hover'
                : 'w-11 border-loss/25 bg-loss-soft text-loss hover:bg-loss/15',
            ].join(' ')}
            aria-label={confirm ? 'Confirm delete' : 'Delete'}
          >
            {confirm ? (
              'Confirm delete'
            ) : (
              <TrashIcon className="h-[18px] w-[18px]" />
            )}
          </button>
        )}
        <Button data-modal-submit onClick={handleSave} disabled={!canSave} loading={saving} className="flex-1">
          {saving ? 'Saving…' : (submitLabel ?? (editing ? 'Save changes' : 'Add'))}
        </Button>
      </div>
    </div>
  )
}

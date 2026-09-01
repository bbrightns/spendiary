import { useState, useEffect, useRef } from 'react'
import { Button } from '../ui/Button'
import { TrashIcon } from '../icons'

interface Props {
  editing: boolean
  canSave: boolean
  onSave: () => void
  onDelete?: () => void
}

export function FormActions({ editing, canSave, onSave, onDelete }: Props) {
  const [confirm, setConfirm] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [])

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
    <div className="flex items-center gap-3 w-full">
      {editing && onDelete && (
        <button
          type="button"
          onClick={handleDeleteClick}
          className={[
            'inline-flex h-11 shrink-0 items-center justify-center rounded-full transition-all duration-200 border text-sm font-semibold',
            confirm
              ? 'px-4 bg-loss border-loss text-white dark:bg-rose-600 dark:border-rose-600 dark:text-white hover:opacity-90'
              : 'w-11 border-loss/25 bg-loss-soft text-loss hover:bg-loss/15',
          ].join(' ')}
          aria-label={confirm ? 'Confirm Delete' : 'Delete'}
        >
          {confirm ? (
            'Confirm Delete'
          ) : (
            <TrashIcon className="h-[18px] w-[18px]" />
          )}
        </button>
      )}
      <Button onClick={onSave} disabled={!canSave} className="flex-1">
        {editing ? 'Save changes' : 'Add'}
      </Button>
    </div>
  )
}

import { useEffect, useRef, type ReactNode } from 'react'
import { CloseIcon } from '../icons'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
}

export function Modal({ open, onClose, title, description, children, footer }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useRef(`modal-title-${Math.random().toString(36).substring(2, 9)}`).current
  const descId = useRef(`modal-desc-${Math.random().toString(36).substring(2, 9)}`).current

  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusableSelector = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',')

    const focusFirstElement = () => {
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector)
      if (focusable && focusable.length > 0) {
        focusable[0].focus()
      } else {
        dialogRef.current?.focus()
      }
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }

      if (e.key !== 'Tab') return

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
      ).filter((el) => el.offsetParent !== null)

      if (focusable.length === 0) {
        e.preventDefault()
        dialogRef.current?.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    window.requestAnimationFrame(focusFirstElement)

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      previouslyFocused?.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-ink/35 dark:bg-black/60 backdrop-blur-sm"
        style={{ animation: 'fadeIn 0.2s ease both' }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-surface shadow-[var(--shadow-lift)] sm:max-w-[440px] sm:rounded-[28px] sm:max-h-[85dvh]"
        style={{ animation: 'sheetUp 0.32s cubic-bezier(0.16,1,0.3,1) both' }}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 px-6 pb-3 pt-7">
          <div>
            <h2 id={titleId} className="font-display text-[20px] font-extrabold tracking-tight text-ink">{title}</h2>
            {description && <p id={descId} className="mt-0.5 text-[13px] text-ink-muted">{description}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface-muted text-ink-soft transition-colors hover:bg-line-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <CloseIcon className="h-[18px] w-[18px]" />
          </button>
        </div>
        <div className="no-scrollbar flex-1 min-h-0 overflow-y-auto px-6 pt-3">
          {children}
          {!footer && <div className="h-8 safe-bottom" />}
        </div>
        {footer && (
          <div className="shrink-0 border-t border-line bg-surface px-6 pb-6 pt-3.5 safe-bottom">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}


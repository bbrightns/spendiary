import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { CheckIcon } from '../icons'
import { Modal } from './Modal'

interface PopoverProps {
  open: boolean
  onClose: () => void
  /** The button that opened it: the popover lines up under it and focus returns to it on close */
  anchorRef: RefObject<HTMLElement | null>
  /** Heading shown on the phone bottom sheet (screen-reader label on desktop) */
  title: string
  /** Line the desktop popover up with the anchor's left or right edge */
  align?: 'left' | 'right'
  children: ReactNode
}

const MOBILE_QUERY = '(max-width: 639px)'
const GAP = 6
const EDGE = 12

/**
 * A small floating panel: a dropdown under its button on desktop, the standard Modal sheet on phones.
 * Closes on Escape, on a tap outside and on scroll/resize (desktop), and gives focus back to its button.
 */
export function Popover({ open, onClose, anchorRef, title, align = 'left', children }: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches,
  )
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number } | null>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY)
    const update = () => setIsMobile(mq.matches)
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  // Place the desktop dropdown under its button
  useLayoutEffect(() => {
    if (!open || isMobile) return
    const rect = anchorRef.current?.getBoundingClientRect()
    if (!rect) return
    setPos(
      align === 'right'
        ? { top: rect.bottom + GAP, right: Math.max(EDGE, window.innerWidth - rect.right) }
        : { top: rect.bottom + GAP, left: Math.max(EDGE, rect.left) },
    )
  }, [open, isMobile, align, anchorRef])

  useEffect(() => {
    if (!open) return
    const anchor = anchorRef.current
    // On phones the sheet is a Modal: it owns Escape, scroll lock, the focus trap and first focus
    if (isMobile) return () => anchor?.focus()

    // Start on the picked option
    window.requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>('[aria-checked="true"], button, input')?.focus()
    })

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
      }
    }
    // A fixed dropdown would drift away from its button, so scrolling closes it
    const onScroll = (e: Event) => {
      if (panelRef.current && e.target instanceof Node && panelRef.current.contains(e.target)) return
      onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
      anchor?.focus()
    }
  }, [open, isMobile, anchorRef])

  if (!open || typeof document === 'undefined') return null

  if (isMobile) {
    // Same sheet, header and close button as every other dialog
    return createPortal(
      <Modal open onClose={onClose} title={title} size="sm" enterToSubmit={false}>
        <div ref={panelRef} className="-mx-3">
          {children}
        </div>
      </Modal>,
      document.body,
    )
  }

  return createPortal(
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-label={title}
        style={{ position: 'fixed', top: pos?.top, left: pos?.left, right: pos?.right, visibility: pos ? 'visible' : 'hidden' }}
        className={`z-50 min-w-[200px] max-w-[calc(100vw-24px)] max-h-[70vh] overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 shadow-[var(--shadow-lift)] animate-pop-in ${
          align === 'right' ? 'origin-top-right' : 'origin-top-left'
        }`}
      >
        {children}
      </div>
    </>,
    document.body,
  )
}

/** One choice in a Popover list: a check mark shows the picked one */
export function PopoverOption({
  selected,
  onClick,
  children,
  icon,
  disabled,
  hint,
}: {
  selected?: boolean
  onClick: () => void
  children: ReactNode
  icon?: ReactNode
  disabled?: boolean
  hint?: string
}) {
  return (
    <button
      type="button"
      role={selected === undefined ? undefined : 'menuitemradio'}
      aria-checked={selected === undefined ? undefined : selected}
      data-autofocus={selected || undefined}
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full min-h-[44px] sm:min-h-[36px] items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
        disabled
          ? 'cursor-not-allowed text-ink-faint'
          : selected
            ? 'cursor-pointer bg-brand/10 font-semibold text-brand-ink'
            : 'cursor-pointer font-medium text-ink hover:bg-surface-muted'
      }`}
    >
      {icon && <span className="shrink-0 text-ink-muted">{icon}</span>}
      <span className="flex-1 min-w-0 truncate">{children}</span>
      {hint && <span className="shrink-0 text-xs font-normal text-ink-faint">{hint}</span>}
      {selected && (
        <CheckIcon className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
      )}
    </button>
  )
}

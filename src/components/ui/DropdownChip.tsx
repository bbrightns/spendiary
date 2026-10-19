import { useRef, useState, type ReactNode } from 'react'
import { ChevronDownIcon, CloseIcon } from '../icons'
import { Popover } from './Popover'

interface DropdownChipProps {
  /** What the chip shows: the picked value, or the "all" label when nothing is picked */
  label: ReactNode
  /** A filter is applied: the chip turns solid and shows a ✕ to clear it */
  active: boolean
  /** Heading of the sheet / screen-reader name of the chip, e.g. "Asset type" */
  title: string
  onClear?: () => void
  icon?: ReactNode
  align?: 'left' | 'right'
  /** The panel's contents; call close() after a pick to shut it */
  children: (close: () => void) => ReactNode
}

/**
 * A filter chip that opens a dropdown (desktop) or bottom sheet (phone) of choices.
 * Several fit on one row where a row of plain chips would scroll off the screen.
 */
export function DropdownChip({ label, active, title, onClear, icon, align, children }: DropdownChipProps) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const close = () => setOpen(false)
  const showClear = active && onClear

  return (
    <>
      <span
        className={`inline-flex h-[30px] shrink-0 items-center rounded-full text-xs font-semibold leading-none transition-colors ${
          active
            ? 'bg-ink text-white dark:bg-[#4f46e5] shadow-xs'
            : 'bg-surface-muted text-ink-soft hover:text-ink'
        }`}
      >
        <button
          ref={btnRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={typeof label === 'string' ? `${title}: ${label}` : title}
          className={`inline-flex h-full max-w-[160px] items-center gap-1 rounded-full pl-3 cursor-pointer select-none ${showClear ? 'pr-1' : 'pr-2'}`}
        >
          {icon && <span className="shrink-0">{icon}</span>}
          <span className="min-w-0 truncate">{label}</span>
          {!showClear && <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 opacity-70" />}
        </button>
        {showClear && (
          <button
            type="button"
            onClick={onClear}
            aria-label={`Clear ${title.toLowerCase()} filter`}
            className="relative mr-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/20 hover:bg-white/30 cursor-pointer after:absolute after:-inset-1.5 after:content-['']"
          >
            <CloseIcon className="h-3 w-3" strokeWidth={2.4} />
          </button>
        )}
      </span>
      <Popover open={open} onClose={close} anchorRef={btnRef} title={title} align={align}>
        {children(close)}
      </Popover>
    </>
  )
}

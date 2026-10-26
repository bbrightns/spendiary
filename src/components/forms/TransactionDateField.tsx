import { localDateStr } from '../../lib/format'

/** Quick picks above the date: compact filter chips (DESIGN.md §6.4) */
const CHIP = 'rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors cursor-pointer'
const CHIP_ON = 'bg-primary text-white'
const CHIP_OFF = 'bg-surface-muted text-ink-soft hover:text-ink'

interface Props {
  value: string
  onChange: (date: string) => void
  label?: string
  hint?: string
  /** With `onTimeChange`, a time-of-day field (HH:mm) sits beside the date, or below it on narrow screens */
  time?: string
  onTimeChange?: (time: string) => void
}

export function TransactionDateField({
  value,
  onChange,
  label = 'Date',
  hint,
  time,
  onTimeChange,
}: Props) {
  const today = localDateStr()
  const yesterday = localDateStr(new Date(Date.now() - 86_400_000))

  const fieldClass =
    'h-11 w-full rounded-xl border border-line-strong bg-surface-muted focus:bg-surface px-3.5 text-base text-ink outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/15'

  return (
    <div className={onTimeChange ? 'grid gap-x-3 gap-y-3 sm:grid-cols-[minmax(0,1fr)_9.5rem]' : undefined}>
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-ink-soft">{label}</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onChange(today)}
              aria-pressed={value === today}
              className={`${CHIP} ${value === today ? CHIP_ON : CHIP_OFF}`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => onChange(yesterday)}
              aria-pressed={value === yesterday}
              className={`${CHIP} ${value === yesterday ? CHIP_ON : CHIP_OFF}`}
            >
              Yesterday
            </button>
          </div>
        </div>
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={fieldClass}
        />
        {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
      </div>
      {onTimeChange && (
        <div>
          <div className="mb-1.5 flex h-[22px] items-center">
            <span className="text-sm font-semibold text-ink-soft">Time</span>
          </div>
          <input type="time" value={time ?? ''} onChange={(e) => onTimeChange(e.target.value)} aria-label="Time of day" className={fieldClass} />
        </div>
      )}
    </div>
  )
}

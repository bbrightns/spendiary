import { ChevronRightIcon } from '../../components/icons'
import { monthKey, monthLabel, shiftMonth } from './logic'

export function MonthStepper({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  const isCurrent = value === monthKey()
  const btn =
    'grid h-9 w-9 place-items-center rounded-full text-ink-soft hover:bg-surface-muted hover:text-ink transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand'
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-1 py-0.5 shadow-xs">
      <button type="button" className={btn} onClick={() => onChange(shiftMonth(value, -1))} aria-label="Previous month">
        <ChevronRightIcon className="h-4 w-4 rotate-180" strokeWidth={2} />
      </button>
      <span className="min-w-[9.5rem] text-center text-sm font-bold text-ink tnum">{monthLabel(value)}</span>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(shiftMonth(value, 1))}
        disabled={isCurrent}
        aria-label="Next month"
      >
        <ChevronRightIcon className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  )
}

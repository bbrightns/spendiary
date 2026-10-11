import type { PayCycle } from '../../lib/types'
import { localDateStr } from '../../lib/format'
import { ChevronRightIcon } from '../../components/icons'
import { inPeriod, periodLabel, shiftPeriod, type Period } from './logic'

interface Props {
  value: Period
  cycle?: PayCycle
  onChange: (p: Period) => void
  /** Custom step (e.g. by week or year); defaults to spending months */
  step?: (p: Period, delta: 1 | -1) => Period
  /** Custom label; defaults to the spending month's name */
  label?: string
}

/** Steps through spending months — calendar months or pay cycles, per settings — or any custom range. */
export function MonthStepper({ value, cycle, onChange, step, label }: Props) {
  const isCurrent = inPeriod(value, localDateStr())
  const move = (delta: 1 | -1) => onChange(step ? step(value, delta) : shiftPeriod(value, delta, cycle))
  const btn =
    'grid h-9 w-9 place-items-center rounded-full text-ink-soft hover:bg-surface-muted hover:text-ink transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand'
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-1 py-0.5 shadow-xs">
      <button type="button" className={btn} onClick={() => move(-1)} aria-label="Previous period">
        <ChevronRightIcon className="h-4 w-4 rotate-180" strokeWidth={2} />
      </button>
      <span className="min-w-[9.5rem] text-center text-sm font-bold text-ink tnum">{label ?? periodLabel(value, cycle)}</span>
      <button type="button" className={btn} onClick={() => move(1)} disabled={isCurrent} aria-label="Next period">
        <ChevronRightIcon className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  )
}

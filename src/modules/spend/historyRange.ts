import type { PayCycle } from '../../lib/types'
import { periodFor, shiftDate, weekOf, type Period } from './logic'

export type Range = 'day' | 'week' | 'month' | 'year' | 'all'

export const RANGES: { value: Range; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'all', label: 'All' },
]

export const EMPTY_TITLE: Record<Range, string> = {
  day: 'Nothing logged this day',
  week: 'Nothing logged this week',
  month: 'Nothing logged this month',
  year: 'Nothing logged this year',
  all: 'Nothing logged yet',
}

/** Calendar year (Jan–Dec) containing `date` */
const yearOf = (date: string): Period => ({ start: `${date.slice(0, 4)}-01-01`, end: `${date.slice(0, 4)}-12-31` })

/** The days a range covers around `anchor`; null for everything */
export function rangePeriod(range: Range, anchor: string, cycle?: PayCycle): Period | null {
  if (range === 'all') return null
  if (range === 'day') return { start: anchor, end: anchor }
  if (range === 'week') return weekOf(anchor)
  if (range === 'year') return yearOf(anchor)
  return periodFor(anchor, cycle)
}

/** Step a day, week or year; months go through MonthStepper's own pay-cycle aware step */
export function stepRange(range: Range, p: Period, delta: 1 | -1): Period {
  if (range === 'day') {
    const d = shiftDate(p.start, delta)
    return { start: d, end: d }
  }
  if (range === 'week') return weekOf(shiftDate(p.start, 7 * delta))
  return yearOf(`${Number(p.start.slice(0, 4)) + delta}-01-01`)
}

export function rangeLabel(range: Range, p: Period): string | undefined {
  const short = (s: string, opts: Intl.DateTimeFormatOptions) => {
    const [y, m, d] = s.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', opts)
  }
  if (range === 'day') return short(p.start, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  if (range === 'week')
    return `${short(p.start, { day: 'numeric', month: 'short' })} – ${short(p.end, { day: 'numeric', month: 'short', year: 'numeric' })}`
  if (range === 'year') return p.start.slice(0, 4)
  return undefined
}

export function dayLabel(date: string, withYear = false): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const today = new Date()
  const yesterday = new Date(Date.now() - 86_400_000)
  if (dt.toDateString() === today.toDateString()) return 'Today'
  if (dt.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) })
}

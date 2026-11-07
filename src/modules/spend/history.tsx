import { useState, type ReactNode } from 'react'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { CloseIcon, SearchIcon } from '../../components/icons'
import type { PayCycle } from '../../lib/types'
import { periodFor, shiftDate, weekOf, type Period } from './logic'
import { MonthStepper } from './MonthStepper'

/**
 * What every history page shares: the Day / Week / Month / Year / All range, day headers and the
 * search sheet. Spend's Transactions set the pattern; Invest's Trades reuse it.
 */

export type Range = 'day' | 'week' | 'month' | 'year' | 'all'

const RANGES: { value: Range; label: string }[] = [
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
function stepRange(range: Range, p: Period, delta: 1 | -1): Period {
  if (range === 'day') {
    const d = shiftDate(p.start, delta)
    return { start: d, end: d }
  }
  if (range === 'week') return weekOf(shiftDate(p.start, 7 * delta))
  return yearOf(`${Number(p.start.slice(0, 4)) + delta}-01-01`)
}

function rangeLabel(range: Range, p: Period): string | undefined {
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

/** Magnifier with filter lines, so it reads differently from the header's command search */
function SearchFilterIcon(p: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className={p.className}>
      <circle cx="10" cy="10" r="6" />
      <path d="m19 19-4.2-4.2" />
      <path d="M7.5 8.5h5M8.5 11.5h3" />
    </svg>
  )
}

/** The range switch, its stepper and the search button */
export function HistoryRangeBar({
  range,
  period,
  cycle,
  onRangeChange,
  onAnchorChange,
  onSearch,
  searchLabel,
}: {
  range: Range
  period: Period | null
  cycle?: PayCycle
  onRangeChange: (r: Range) => void
  onAnchorChange: (date: string) => void
  onSearch: () => void
  searchLabel: string
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SegmentedControl ariaLabel="Range" size="sm" shape="pill" fullWidth={false} value={range} onChange={onRangeChange} options={RANGES} />
      {period &&
        (range === 'month' ? (
          <MonthStepper value={period} cycle={cycle} onChange={(p) => onAnchorChange(p.start)} />
        ) : (
          <MonthStepper
            value={period}
            label={rangeLabel(range, period)}
            step={(p, delta) => stepRange(range, p, delta)}
            onChange={(p) => onAnchorChange(p.start)}
          />
        ))}
      <button
        type="button"
        onClick={onSearch}
        aria-label={searchLabel}
        className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface text-ink-muted shadow-xs hover:text-ink cursor-pointer"
      >
        <SearchFilterIcon className="h-[18px] w-[18px]" />
      </button>
    </div>
  )
}

/** An active search takes the range's place: it looks across every month */
export function ActiveSearch({ label, onOpen, onClear }: { label: string; onOpen: () => void; onClear: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex max-w-[16rem] items-center gap-2 rounded-full border border-brand/40 bg-brand-soft px-3.5 py-2 text-sm font-bold text-brand-ink cursor-pointer"
      >
        <SearchIcon className="h-4 w-4 shrink-0" />
        <span className="truncate">{label}</span>
      </button>
      <button
        type="button"
        onClick={onClear}
        aria-label="Clear search"
        className="grid h-9 w-9 place-items-center rounded-full border border-line bg-surface text-ink-muted hover:text-ink cursor-pointer"
      >
        <CloseIcon className="h-4 w-4" />
      </button>
    </div>
  )
}

function readRecent(key: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 5) : []
  } catch {
    return []
  }
}

function saveRecent(key: string, q: string) {
  try {
    localStorage.setItem(key, JSON.stringify([q, ...readRecent(key).filter((x) => x !== q)].slice(0, 5)))
  } catch {
    // storage unavailable — recent searches just won't be remembered
  }
}

/** What a page's own suggestions need from the search sheet */
export interface SearchContext {
  q: string
  words: string[]
  /** The word being typed; empty right after a space (e.g. once a tag was picked) */
  last: string
  setQ: (q: string) => void
  apply: (value: string) => void
}

export function HistorySearchSheet({
  open,
  initial,
  recentKey,
  placeholder,
  ariaLabel,
  countFor,
  onClose,
  onApply,
  children,
}: {
  open: boolean
  initial: string
  /** localStorage key for this page's recent searches */
  recentKey: string
  placeholder: string
  ariaLabel: string
  /** How many entries these words find */
  countFor: (words: string[]) => number
  onClose: () => void
  onApply: (q: string) => void
  /** The page's own suggestions, under Recent */
  children?: (search: SearchContext) => ReactNode
}) {
  const [q, setQ] = useState('')
  const [recent, setRecent] = useState<string[]>([])
  const [lastOpen, setLastOpen] = useState(false)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setQ(initial)
      setRecent(readRecent(recentKey))
    }
  }

  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  const last = /\s$/.test(q) ? '' : words[words.length - 1] ?? ''
  const count = words.length ? countFor(words) : 0

  const apply = (value: string) => {
    const v = value.trim()
    if (v) saveRecent(recentKey, v)
    onApply(v)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Search"
      size="md"
      footer={
        <Button data-modal-submit className="w-full" onClick={() => apply(q)}>
          {words.length ? `Show ${count} ${count === 1 ? 'result' : 'results'}` : 'Show all'}
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="flex h-12 items-center gap-2 rounded-xl border border-line-strong bg-surface-muted focus-within:bg-surface px-3.5 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15">
          <SearchIcon className="h-4 w-4 shrink-0 text-ink-faint" />
          <input
            type="text"
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            aria-label={ariaLabel}
            className="w-full bg-transparent text-base text-ink outline-none placeholder:text-ink-faint"
          />
          {q && (
            <button type="button" onClick={() => setQ('')} aria-label="Clear" className="text-ink-muted hover:text-ink cursor-pointer">
              <CloseIcon className="h-4 w-4" />
            </button>
          )}
        </div>

        {recent.length > 0 && !q && (
          <div>
            <p className="mb-2 text-sm font-semibold text-ink-soft">Recent</p>
            <div className="flex flex-wrap gap-1.5">
              {recent.map((r) => (
                <button key={r} type="button" onClick={() => apply(r)} className="rounded-full bg-surface-muted px-3 py-1.5 text-xs font-semibold text-ink-soft hover:text-ink cursor-pointer">
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}

        {children?.({ q, words, last, setQ, apply })}
      </div>
    </Modal>
  )
}

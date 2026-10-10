/**
 * Pastel tones for the Spend module. Class strings are written out in full so
 * Tailwind can see them at build time.
 */
export type Tone =
  | 'orange'
  | 'amber'
  | 'sky'
  | 'pink'
  | 'violet'
  | 'teal'
  | 'rose'
  | 'indigo'
  | 'lime'
  | 'slate'
  | 'emerald'
  | 'yellow'
  | 'cyan'

export interface ToneClasses {
  /** Selected tile */
  active: string
  /** Small icon badge (list rows) */
  chip: string
  /** Solid bar for charts / progress */
  bar: string
}

export const TONES: Record<Tone, ToneClasses> = {
  orange: {
    active: 'border-orange-300 bg-orange-100 text-orange-800 ring-2 ring-orange-200/70 dark:border-orange-400/50 dark:bg-orange-400/25 dark:text-orange-100 dark:ring-orange-400/20',
    chip: 'bg-orange-100 text-orange-600 dark:bg-orange-400/15 dark:text-orange-300',
    bar: 'bg-orange-300 dark:bg-orange-400/70',
  },
  amber: {
    active: 'border-amber-300 bg-amber-100 text-amber-800 ring-2 ring-amber-200/70 dark:border-amber-400/50 dark:bg-amber-400/25 dark:text-amber-100 dark:ring-amber-400/20',
    chip: 'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300',
    bar: 'bg-amber-300 dark:bg-amber-400/70',
  },
  sky: {
    active: 'border-sky-300 bg-sky-100 text-sky-800 ring-2 ring-sky-200/70 dark:border-sky-400/50 dark:bg-sky-400/25 dark:text-sky-100 dark:ring-sky-400/20',
    chip: 'bg-sky-100 text-sky-600 dark:bg-sky-400/15 dark:text-sky-300',
    bar: 'bg-sky-300 dark:bg-sky-400/70',
  },
  pink: {
    active: 'border-pink-300 bg-pink-100 text-pink-800 ring-2 ring-pink-200/70 dark:border-pink-400/50 dark:bg-pink-400/25 dark:text-pink-100 dark:ring-pink-400/20',
    chip: 'bg-pink-100 text-pink-600 dark:bg-pink-400/15 dark:text-pink-300',
    bar: 'bg-pink-300 dark:bg-pink-400/70',
  },
  violet: {
    active: 'border-violet-300 bg-violet-100 text-violet-800 ring-2 ring-violet-200/70 dark:border-violet-400/50 dark:bg-violet-400/25 dark:text-violet-100 dark:ring-violet-400/20',
    chip: 'bg-violet-100 text-violet-600 dark:bg-violet-400/15 dark:text-violet-300',
    bar: 'bg-violet-300 dark:bg-violet-400/70',
  },
  teal: {
    active: 'border-teal-300 bg-teal-100 text-teal-800 ring-2 ring-teal-200/70 dark:border-teal-400/50 dark:bg-teal-400/25 dark:text-teal-100 dark:ring-teal-400/20',
    chip: 'bg-teal-100 text-teal-600 dark:bg-teal-400/15 dark:text-teal-300',
    bar: 'bg-teal-300 dark:bg-teal-400/70',
  },
  rose: {
    active: 'border-rose-300 bg-rose-100 text-rose-800 ring-2 ring-rose-200/70 dark:border-rose-400/50 dark:bg-rose-400/25 dark:text-rose-100 dark:ring-rose-400/20',
    chip: 'bg-rose-100 text-rose-600 dark:bg-rose-400/15 dark:text-rose-300',
    bar: 'bg-rose-300 dark:bg-rose-400/70',
  },
  indigo: {
    active: 'border-indigo-300 bg-indigo-100 text-indigo-800 ring-2 ring-indigo-200/70 dark:border-indigo-400/50 dark:bg-indigo-400/25 dark:text-indigo-100 dark:ring-indigo-400/20',
    chip: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-400/15 dark:text-indigo-300',
    bar: 'bg-indigo-300 dark:bg-indigo-400/70',
  },
  lime: {
    active: 'border-lime-300 bg-lime-100 text-lime-800 ring-2 ring-lime-200/70 dark:border-lime-400/50 dark:bg-lime-400/25 dark:text-lime-100 dark:ring-lime-400/20',
    chip: 'bg-lime-100 text-lime-700 dark:bg-lime-400/15 dark:text-lime-300',
    bar: 'bg-lime-300 dark:bg-lime-400/70',
  },
  slate: {
    active: 'border-slate-300 bg-slate-100 text-slate-800 ring-2 ring-slate-200/70 dark:border-slate-400/50 dark:bg-slate-400/25 dark:text-slate-100 dark:ring-slate-400/20',
    chip: 'bg-slate-100 text-slate-600 dark:bg-slate-400/15 dark:text-slate-300',
    bar: 'bg-slate-300 dark:bg-slate-400/70',
  },
  emerald: {
    active: 'border-emerald-300 bg-emerald-100 text-emerald-800 ring-2 ring-emerald-200/70 dark:border-emerald-400/50 dark:bg-emerald-400/25 dark:text-emerald-100 dark:ring-emerald-400/20',
    chip: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300',
    bar: 'bg-emerald-300 dark:bg-emerald-400/70',
  },
  yellow: {
    active: 'border-yellow-300 bg-yellow-100 text-yellow-800 ring-2 ring-yellow-200/70 dark:border-yellow-400/50 dark:bg-yellow-400/25 dark:text-yellow-100 dark:ring-yellow-400/20',
    chip: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-400/15 dark:text-yellow-300',
    bar: 'bg-yellow-300 dark:bg-yellow-400/70',
  },
  cyan: {
    active: 'border-cyan-300 bg-cyan-100 text-cyan-800 ring-2 ring-cyan-200/70 dark:border-cyan-400/50 dark:bg-cyan-400/25 dark:text-cyan-100 dark:ring-cyan-400/20',
    chip: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-400/15 dark:text-cyan-300',
    bar: 'bg-cyan-300 dark:bg-cyan-400/70',
  },
}

/** Type switch colors: expense rose, income emerald, transfer sky. */
export const TYPE_ACTIVE = {
  expense: 'bg-rose-100 text-rose-700 dark:bg-rose-400/20 dark:text-rose-200',
  income: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-200',
  transfer: 'bg-sky-100 text-sky-700 dark:bg-sky-400/20 dark:text-sky-200',
} as const

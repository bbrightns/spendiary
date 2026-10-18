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
  /** Tinted panel that holds a category's subcategories */
  tray: string
  /** Unpicked subcategory chip inside the tray */
  subChip: string
  /** Text in the category's color (tray heading) */
  ink: string
}

export const TONES: Record<Tone, ToneClasses> = {
  orange: {
    active: 'border-orange-300 bg-orange-100 text-orange-800 ring-2 ring-orange-200/70 dark:border-orange-400/50 dark:bg-orange-400/25 dark:text-orange-100 dark:ring-orange-400/20',
    chip: 'bg-orange-100 text-orange-600 dark:bg-orange-400/15 dark:text-orange-300',
    bar: 'bg-orange-300 dark:bg-orange-400/70',
    tray: 'border-orange-200 bg-orange-50 dark:border-orange-400/25 dark:bg-orange-400/10',
    subChip: 'border-orange-200 bg-surface text-orange-800 hover:bg-orange-100 dark:border-orange-400/30 dark:bg-transparent dark:text-orange-200 dark:hover:bg-orange-400/15',
    ink: 'text-orange-700 dark:text-orange-300',
  },
  amber: {
    active: 'border-amber-300 bg-amber-100 text-amber-800 ring-2 ring-amber-200/70 dark:border-amber-400/50 dark:bg-amber-400/25 dark:text-amber-100 dark:ring-amber-400/20',
    chip: 'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300',
    bar: 'bg-amber-300 dark:bg-amber-400/70',
    tray: 'border-amber-200 bg-amber-50 dark:border-amber-400/25 dark:bg-amber-400/10',
    subChip: 'border-amber-200 bg-surface text-amber-800 hover:bg-amber-100 dark:border-amber-400/30 dark:bg-transparent dark:text-amber-200 dark:hover:bg-amber-400/15',
    ink: 'text-amber-700 dark:text-amber-300',
  },
  sky: {
    active: 'border-sky-300 bg-sky-100 text-sky-800 ring-2 ring-sky-200/70 dark:border-sky-400/50 dark:bg-sky-400/25 dark:text-sky-100 dark:ring-sky-400/20',
    chip: 'bg-sky-100 text-sky-600 dark:bg-sky-400/15 dark:text-sky-300',
    bar: 'bg-sky-300 dark:bg-sky-400/70',
    tray: 'border-sky-200 bg-sky-50 dark:border-sky-400/25 dark:bg-sky-400/10',
    subChip: 'border-sky-200 bg-surface text-sky-800 hover:bg-sky-100 dark:border-sky-400/30 dark:bg-transparent dark:text-sky-200 dark:hover:bg-sky-400/15',
    ink: 'text-sky-700 dark:text-sky-300',
  },
  pink: {
    active: 'border-pink-300 bg-pink-100 text-pink-800 ring-2 ring-pink-200/70 dark:border-pink-400/50 dark:bg-pink-400/25 dark:text-pink-100 dark:ring-pink-400/20',
    chip: 'bg-pink-100 text-pink-600 dark:bg-pink-400/15 dark:text-pink-300',
    bar: 'bg-pink-300 dark:bg-pink-400/70',
    tray: 'border-pink-200 bg-pink-50 dark:border-pink-400/25 dark:bg-pink-400/10',
    subChip: 'border-pink-200 bg-surface text-pink-800 hover:bg-pink-100 dark:border-pink-400/30 dark:bg-transparent dark:text-pink-200 dark:hover:bg-pink-400/15',
    ink: 'text-pink-700 dark:text-pink-300',
  },
  violet: {
    active: 'border-violet-300 bg-violet-100 text-violet-800 ring-2 ring-violet-200/70 dark:border-violet-400/50 dark:bg-violet-400/25 dark:text-violet-100 dark:ring-violet-400/20',
    chip: 'bg-violet-100 text-violet-600 dark:bg-violet-400/15 dark:text-violet-300',
    bar: 'bg-violet-300 dark:bg-violet-400/70',
    tray: 'border-violet-200 bg-violet-50 dark:border-violet-400/25 dark:bg-violet-400/10',
    subChip: 'border-violet-200 bg-surface text-violet-800 hover:bg-violet-100 dark:border-violet-400/30 dark:bg-transparent dark:text-violet-200 dark:hover:bg-violet-400/15',
    ink: 'text-violet-700 dark:text-violet-300',
  },
  teal: {
    active: 'border-teal-300 bg-teal-100 text-teal-800 ring-2 ring-teal-200/70 dark:border-teal-400/50 dark:bg-teal-400/25 dark:text-teal-100 dark:ring-teal-400/20',
    chip: 'bg-teal-100 text-teal-600 dark:bg-teal-400/15 dark:text-teal-300',
    bar: 'bg-teal-300 dark:bg-teal-400/70',
    tray: 'border-teal-200 bg-teal-50 dark:border-teal-400/25 dark:bg-teal-400/10',
    subChip: 'border-teal-200 bg-surface text-teal-800 hover:bg-teal-100 dark:border-teal-400/30 dark:bg-transparent dark:text-teal-200 dark:hover:bg-teal-400/15',
    ink: 'text-teal-700 dark:text-teal-300',
  },
  rose: {
    active: 'border-rose-300 bg-rose-100 text-rose-800 ring-2 ring-rose-200/70 dark:border-rose-400/50 dark:bg-rose-400/25 dark:text-rose-100 dark:ring-rose-400/20',
    chip: 'bg-rose-100 text-rose-600 dark:bg-rose-400/15 dark:text-rose-300',
    bar: 'bg-rose-300 dark:bg-rose-400/70',
    tray: 'border-rose-200 bg-rose-50 dark:border-rose-400/25 dark:bg-rose-400/10',
    subChip: 'border-rose-200 bg-surface text-rose-800 hover:bg-rose-100 dark:border-rose-400/30 dark:bg-transparent dark:text-rose-200 dark:hover:bg-rose-400/15',
    ink: 'text-rose-700 dark:text-rose-300',
  },
  indigo: {
    active: 'border-indigo-300 bg-indigo-100 text-indigo-800 ring-2 ring-indigo-200/70 dark:border-indigo-400/50 dark:bg-indigo-400/25 dark:text-indigo-100 dark:ring-indigo-400/20',
    chip: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-400/15 dark:text-indigo-300',
    bar: 'bg-indigo-300 dark:bg-indigo-400/70',
    tray: 'border-indigo-200 bg-indigo-50 dark:border-indigo-400/25 dark:bg-indigo-400/10',
    subChip: 'border-indigo-200 bg-surface text-indigo-800 hover:bg-indigo-100 dark:border-indigo-400/30 dark:bg-transparent dark:text-indigo-200 dark:hover:bg-indigo-400/15',
    ink: 'text-indigo-700 dark:text-indigo-300',
  },
  lime: {
    active: 'border-lime-300 bg-lime-100 text-lime-800 ring-2 ring-lime-200/70 dark:border-lime-400/50 dark:bg-lime-400/25 dark:text-lime-100 dark:ring-lime-400/20',
    chip: 'bg-lime-100 text-lime-700 dark:bg-lime-400/15 dark:text-lime-300',
    bar: 'bg-lime-300 dark:bg-lime-400/70',
    tray: 'border-lime-200 bg-lime-50 dark:border-lime-400/25 dark:bg-lime-400/10',
    subChip: 'border-lime-200 bg-surface text-lime-800 hover:bg-lime-100 dark:border-lime-400/30 dark:bg-transparent dark:text-lime-200 dark:hover:bg-lime-400/15',
    ink: 'text-lime-700 dark:text-lime-300',
  },
  slate: {
    active: 'border-slate-300 bg-slate-100 text-slate-800 ring-2 ring-slate-200/70 dark:border-slate-400/50 dark:bg-slate-400/25 dark:text-slate-100 dark:ring-slate-400/20',
    chip: 'bg-slate-100 text-slate-600 dark:bg-slate-400/15 dark:text-slate-300',
    bar: 'bg-slate-300 dark:bg-slate-400/70',
    tray: 'border-slate-200 bg-slate-50 dark:border-slate-400/25 dark:bg-slate-400/10',
    subChip: 'border-slate-200 bg-surface text-slate-800 hover:bg-slate-100 dark:border-slate-400/30 dark:bg-transparent dark:text-slate-200 dark:hover:bg-slate-400/15',
    ink: 'text-slate-700 dark:text-slate-300',
  },
  emerald: {
    active: 'border-emerald-300 bg-emerald-100 text-emerald-800 ring-2 ring-emerald-200/70 dark:border-emerald-400/50 dark:bg-emerald-400/25 dark:text-emerald-100 dark:ring-emerald-400/20',
    chip: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300',
    bar: 'bg-emerald-300 dark:bg-emerald-400/70',
    tray: 'border-emerald-200 bg-emerald-50 dark:border-emerald-400/25 dark:bg-emerald-400/10',
    subChip: 'border-emerald-200 bg-surface text-emerald-800 hover:bg-emerald-100 dark:border-emerald-400/30 dark:bg-transparent dark:text-emerald-200 dark:hover:bg-emerald-400/15',
    ink: 'text-emerald-700 dark:text-emerald-300',
  },
  yellow: {
    active: 'border-yellow-300 bg-yellow-100 text-yellow-800 ring-2 ring-yellow-200/70 dark:border-yellow-400/50 dark:bg-yellow-400/25 dark:text-yellow-100 dark:ring-yellow-400/20',
    chip: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-400/15 dark:text-yellow-300',
    bar: 'bg-yellow-300 dark:bg-yellow-400/70',
    tray: 'border-yellow-200 bg-yellow-50 dark:border-yellow-400/25 dark:bg-yellow-400/10',
    subChip: 'border-yellow-200 bg-surface text-yellow-800 hover:bg-yellow-100 dark:border-yellow-400/30 dark:bg-transparent dark:text-yellow-200 dark:hover:bg-yellow-400/15',
    ink: 'text-yellow-700 dark:text-yellow-300',
  },
  cyan: {
    active: 'border-cyan-300 bg-cyan-100 text-cyan-800 ring-2 ring-cyan-200/70 dark:border-cyan-400/50 dark:bg-cyan-400/25 dark:text-cyan-100 dark:ring-cyan-400/20',
    chip: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-400/15 dark:text-cyan-300',
    bar: 'bg-cyan-300 dark:bg-cyan-400/70',
    tray: 'border-cyan-200 bg-cyan-50 dark:border-cyan-400/25 dark:bg-cyan-400/10',
    subChip: 'border-cyan-200 bg-surface text-cyan-800 hover:bg-cyan-100 dark:border-cyan-400/30 dark:bg-transparent dark:text-cyan-200 dark:hover:bg-cyan-400/15',
    ink: 'text-cyan-700 dark:text-cyan-300',
  },
}

/** Type switch colors: expense rose, income emerald, transfer sky. */
export const TYPE_ACTIVE = {
  expense: 'bg-rose-100 text-rose-700 dark:bg-rose-400/20 dark:text-rose-200',
  income: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-200',
  transfer: 'bg-sky-100 text-sky-700 dark:bg-sky-400/20 dark:text-sky-200',
} as const

/** Spend's accent for small text (page eyebrows), matching the green of the Invest/Spend switch */
export const SPEND_ACCENT_TEXT = 'text-emerald-700 dark:text-emerald-400'
/** Invest's accent for small text, the blue of the switch */
export const INVEST_ACCENT_TEXT = 'text-invest dark:text-invest-ink'

/**
 * The selected nav item takes its side's colour: Spend green, Invest blue (the same as the
 * Spend/Invest switch), so it's always clear which side you're on.
 */
export const SIDE_ACTIVE = {
  spend: { text: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-100 dark:bg-emerald-400/15', line: 'border-emerald-600 dark:border-emerald-400' },
  invest: { text: 'text-invest-ink', bg: 'bg-invest-soft', line: 'border-invest' },
} as const

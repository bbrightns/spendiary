import type { SpendCard } from '../../lib/types'

export type CardFilterMode = 'all' | 'starred' | 'balance'

export interface CardFilter {
  mode: CardFilterMode
  /** Also hides cards sitting at ฿0.00, on top of the chip */
  hideZero: boolean
}

export const DEFAULT_CARD_FILTER: CardFilter = { mode: 'all', hideZero: false }

const KEY = 'spendiary.cardFilter'

export function isFiltering(f: CardFilter): boolean {
  return f.mode !== 'all' || f.hideZero
}

/** An overpaid card sits below zero, which still counts as having a balance */
export function filterCards(cards: SpendCard[], f: CardFilter, favoriteIds: string[]): SpendCard[] {
  return cards.filter((c) => {
    if (f.mode === 'starred' && !favoriteIds.includes(c.id)) return false
    if ((f.mode === 'balance' || f.hideZero) && c.balance === 0) return false
    return true
  })
}

/** Per-device preference, so it lives in localStorage and not in the saved data */
export function readCardFilter(): CardFilter {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (v && ['all', 'starred', 'balance'].includes(v.mode)) return { mode: v.mode, hideZero: v.hideZero === true }
  } catch {
    /* private mode or bad JSON: fall back to showing everything */
  }
  return DEFAULT_CARD_FILTER
}

export function writeCardFilter(f: CardFilter) {
  try {
    localStorage.setItem(KEY, JSON.stringify(f))
  } catch {
    /* storage unavailable: the filter just won't survive a reload */
  }
}

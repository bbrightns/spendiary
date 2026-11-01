export { CARD_COLORS, CARD_PALETTE } from '../../lib/palette'

export const FALLBACK_CARD_COLOR = '#0f172a'

/**
 * How much of the card's own color shows, mixed into the card surface: pastel in light, muted in dark,
 * so the stack sits beside the wallets instead of shouting over them. The card in front is a little
 * stronger, which also says which one is picked.
 */
export const CARD_TINT = { front: 55, behind: 40 } as const

/** The card's color as a pastel with a soft sheen, so it still reads as a physical card. */
export const cardFace = (hex: string, tint: number = CARD_TINT.front) =>
  `linear-gradient(160deg, rgba(255,255,255,0.18), rgba(255,255,255,0) 55%), color-mix(in srgb, ${hex} ${tint}%, var(--color-surface))`

/** Text on a card face: the pastel is always light in light mode and dark in dark mode, so the ink tokens read on it. */
export const CARD_INK = { text: 'text-ink', soft: 'text-ink-muted' } as const

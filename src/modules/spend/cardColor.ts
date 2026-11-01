import type { CSSProperties } from 'react'
export { CARD_COLORS, CARD_PALETTE } from '../../lib/palette'

export const FALLBACK_CARD_COLOR = '#0f172a'

/**
 * A card face: the card's hue as a pastel (muted in dark) with a soft sheen, from the .card-face classes in
 * index.css. Every color gets the same lightness there, so the text on it reads the same on all of them.
 * `back` is the softer face of the tabs peeking out behind the front card.
 */
export const cardFace = (hex: string, back = false) => ({
  className: back ? 'card-face-back' : 'card-face',
  style: { '--card': hex } as CSSProperties,
})

/** Text on a card face: the name in ink, the digits in ink-soft (ink-muted is too faint on the tint). */
export const CARD_INK = { text: 'text-ink', soft: 'text-ink-soft' } as const

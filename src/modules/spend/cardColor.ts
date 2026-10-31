export { CARD_COLORS, CARD_PALETTE } from '../../lib/palette'

export const FALLBACK_CARD_COLOR = '#0f172a'

/** The card's color with a soft sheen, so it reads as a physical card (and a dark one still shows on a dark page). */
export const cardFace = (hex: string) => `linear-gradient(160deg, rgba(255,255,255,0.18), rgba(255,255,255,0) 55%), ${hex}`

/** WCAG relative luminance of a #rrggbb color. */
function luminance(hex: string): number {
  const n = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
}

/** White or near-black text, whichever reads better on the card's color. */
export function inkOn(hex: string): { light: boolean; text: string; soft: string } {
  const l = luminance(hex)
  const light = 1.05 / (l + 0.05) >= (l + 0.05) / 0.059
  return light ? { light, text: 'text-white', soft: 'text-white/70' } : { light, text: 'text-black/90', soft: 'text-black/60' }
}

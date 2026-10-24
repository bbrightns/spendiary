/** Card colors offered in the card sheet: three rows of eight, so each row fits a phone (375px). */
export const CARD_PALETTE: { name: string; colors: { hex: string; name: string }[] }[] = [
  {
    name: 'Metal & deep',
    colors: [
      { hex: '#0f172a', name: 'Midnight' },
      { hex: '#374151', name: 'Graphite' },
      { hex: '#94a3b8', name: 'Silver' },
      { hex: '#d6c3a5', name: 'Champagne' },
      { hex: '#b8860b', name: 'Gold' },
      { hex: '#b76e79', name: 'Rose gold' },
      { hex: '#1e3a8a', name: 'Navy' },
      { hex: '#6b21a8', name: 'Plum' },
    ],
  },
  {
    name: 'Cool',
    colors: [
      { hex: '#1d4ed8', name: 'Royal blue' },
      { hex: '#4f46e5', name: 'Indigo' },
      { hex: '#0ea5e9', name: 'Sky' },
      { hex: '#06b6d4', name: 'Cyan' },
      { hex: '#0d9488', name: 'Teal' },
      { hex: '#059669', name: 'Emerald' },
      { hex: '#16a34a', name: 'Green' },
      { hex: '#65a30d', name: 'Lime' },
    ],
  },
  {
    name: 'Warm',
    colors: [
      { hex: '#f59e0b', name: 'Amber' },
      { hex: '#ea580c', name: 'Orange' },
      { hex: '#dc2626', name: 'Red' },
      { hex: '#e11d48', name: 'Crimson' },
      { hex: '#db2777', name: 'Pink' },
      { hex: '#c026d3', name: 'Fuchsia' },
      { hex: '#9333ea', name: 'Purple' },
      { hex: '#7c3aed', name: 'Violet' },
    ],
  },
]

export const CARD_COLORS = CARD_PALETTE.flatMap((g) => g.colors.map((c) => c.hex))

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

/** Colors offered for cards and wallets: three rows of eight, so each row fits a phone (375px). */
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

/** Cards on Spend's Home that can be reordered, in their default order. */
export const HOME_CARDS = [
  { id: 'allowance', label: "Today's allowance" },
  { id: 'month', label: 'This month' },
  { id: 'recurring', label: 'Bills and recurring' },
  { id: 'days', label: 'Day by day' },
] as const

export type HomeCardId = (typeof HOME_CARDS)[number]['id']

const DEFAULT_ORDER: HomeCardId[] = HOME_CARDS.map((c) => c.id)

/** The saved order, cleaned up: unknown ids dropped, duplicates removed, new cards added at the end. */
export function homeOrder(saved?: string[]): HomeCardId[] {
  const known = (saved ?? []).filter((id, i, all): id is HomeCardId => DEFAULT_ORDER.includes(id as HomeCardId) && all.indexOf(id) === i)
  return [...known, ...DEFAULT_ORDER.filter((id) => !known.includes(id))]
}

/** Move one card up (-1) or down (+1); unchanged at the ends. */
export function moveCard(order: HomeCardId[], id: HomeCardId, delta: -1 | 1): HomeCardId[] {
  const i = order.indexOf(id)
  const j = i + delta
  if (i < 0 || j < 0 || j >= order.length) return order
  const next = [...order]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

export const isDefaultOrder = (order: HomeCardId[]) => order.every((id, i) => id === DEFAULT_ORDER[i])

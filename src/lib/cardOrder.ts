/** The saved order, cleaned up: unknown ids dropped, duplicates removed, cards added since then at the end. */
export function cardOrder<T extends string>(defaults: readonly T[], saved?: readonly string[]): T[] {
  const known = (saved ?? []).filter((id, i, all): id is T => defaults.includes(id as T) && all.indexOf(id) === i)
  return [...known, ...defaults.filter((id) => !known.includes(id))]
}

/** Move one card up (-1) or down (+1); unchanged at the ends or when the id isn't there. */
export function moveInOrder<T extends string>(order: readonly T[], id: T, delta: -1 | 1): T[] {
  const i = order.indexOf(id)
  const j = i + delta
  if (i < 0 || j < 0 || j >= order.length) return [...order]
  const next = [...order]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

export const isDefaultOrder = <T extends string>(defaults: readonly T[], order: readonly T[]) =>
  order.length === defaults.length && order.every((id, i) => id === defaults[i])

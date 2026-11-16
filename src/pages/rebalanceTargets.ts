/** A target in percent, to two decimals */
export const roundPct = (pct: number) => Math.round(pct * 100) / 100

/**
 * Sum of rebalance targets in percent, to two decimals. Targets may be typed with decimals, and plain
 * addition of 16.6 + 16.6 + 16.7 + 16.7 + 16.7 + 16.7 is 100.00000000000001: never "exactly 100", so
 * the targets were not saved and no actions were shown.
 */
export function targetsTotal(targets: number[] | Record<string, number>): number {
  const values = Array.isArray(targets) ? targets : Object.values(targets)
  const sum = values.reduce((s, x) => s + (Number.isFinite(x) ? x : 0), 0)
  return roundPct(sum)
}

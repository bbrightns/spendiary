import { describe, expect, it } from 'vitest'
import { STORAGE_KEYS, clearPersonalTraces } from './storageKeys'

/** Just enough of localStorage for the test */
function fakeStorage(entries: Record<string, string>) {
  const map = new Map(Object.entries(entries))
  return { removeItem: (key: string) => void map.delete(key), keys: () => [...map.keys()].sort() }
}

describe('clearPersonalTraces', () => {
  it('removes what one person typed or opened, and keeps device preferences and price caches', () => {
    const storage = fakeStorage({
      [STORAGE_KEYS.spendRecentSearches]: '["rent","doctor"]',
      [STORAGE_KEYS.tradesRecentSearches]: '["BTC"]',
      [STORAGE_KEYS.paletteRecent]: '["salary"]',
      [STORAGE_KEYS.paletteUsage]: '{"holding:h1":{"count":3,"last":1}}',
      [STORAGE_KEYS.theme]: 'dark',
      [STORAGE_KEYS.usdThb]: '33.1',
      [STORAGE_KEYS.goldSellUnit]: 'baht',
    })
    clearPersonalTraces(storage)
    expect(storage.keys()).toEqual([STORAGE_KEYS.usdThb, STORAGE_KEYS.goldSellUnit, STORAGE_KEYS.theme].sort())
  })

  it('does not throw when storage is unavailable', () => {
    expect(() =>
      clearPersonalTraces({
        removeItem: () => {
          throw new Error('SecurityError')
        },
      }),
    ).not.toThrow()
  })
})

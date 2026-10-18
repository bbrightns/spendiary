import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isValidRate, readCachedUsdThb, writeCachedUsdThb } from './fx'

// Vitest runs in Node here, so give the module a minimal localStorage
const store = new Map<string, string>()
beforeEach(() => {
  store.clear()
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as Storage
})
afterEach(() => {
  delete (globalThis as { localStorage?: Storage }).localStorage
})

describe('isValidRate', () => {
  it.each([[33.5, true], [0, false], [-1, false], [Number.NaN, false], [Infinity, false], ['34', false], [null, false]])('%s → %s', (v, ok) => {
    expect(isValidRate(v)).toBe(ok)
  })
})

describe('cached USD/THB rate', () => {
  it('is null when nothing was ever fetched', () => {
    expect(readCachedUsdThb()).toBeNull()
  })

  it('reads back what was written, with its date', () => {
    const at = new Date('2026-10-18T03:00:00Z')
    writeCachedUsdThb(33.42, at)
    expect(readCachedUsdThb()).toEqual({ rate: 33.42, asOf: at })
  })

  it('ignores a corrupt saved rate instead of returning NaN', () => {
    store.set('spendiary.cached_usd_thb', 'abc')
    expect(readCachedUsdThb()).toBeNull()
  })

  it('uses the old price-refresh time when the rate has no date of its own', () => {
    store.set('spendiary.cached_usd_thb', '34.1')
    store.set('spendiary.cached_prices_last_updated', '2026-10-01T00:00:00.000Z')
    expect(readCachedUsdThb()).toEqual({ rate: 34.1, asOf: new Date('2026-10-01T00:00:00.000Z') })
  })

  it('keeps the rate even when no date is known', () => {
    store.set('spendiary.cached_usd_thb', '34.1')
    expect(readCachedUsdThb()).toEqual({ rate: 34.1, asOf: null })
  })
})

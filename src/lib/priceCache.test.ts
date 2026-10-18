import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readCachedGoldThbPerGram, readPricesUpdatedAt, writeCachedGoldThbPerGram } from './priceCache'

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

const GOLD_KEY = 'spendiary.cached_gold_thb_gram'

describe('cached gold price', () => {
  it('is null when nothing was ever fetched', () => {
    expect(readCachedGoldThbPerGram()).toBeNull()
  })

  it('reads a saved price back', () => {
    writeCachedGoldThbPerGram(2345.6789)
    expect(readCachedGoldThbPerGram()).toBe(2345.6789)
  })

  it.each(['NaN', '', 'abc', '0', '-5', 'Infinity'])('treats %j as no price and drops it', (raw) => {
    store.set(GOLD_KEY, raw)
    expect(readCachedGoldThbPerGram()).toBeNull()
    expect(store.has(GOLD_KEY)).toBe(false)
  })

  it('never saves an invalid price over a good one', () => {
    writeCachedGoldThbPerGram(2000)
    writeCachedGoldThbPerGram(Number.NaN)
    writeCachedGoldThbPerGram(0)
    expect(readCachedGoldThbPerGram()).toBe(2000)
  })
})

describe('prices last updated', () => {
  it('is null when missing or unreadable', () => {
    expect(readPricesUpdatedAt()).toBeNull()
    store.set('spendiary.cached_prices_last_updated', 'garbage')
    expect(readPricesUpdatedAt()).toBeNull()
  })

  it('reads a saved date back', () => {
    store.set('spendiary.cached_prices_last_updated', '2026-10-01T00:00:00.000Z')
    expect(readPricesUpdatedAt()?.toISOString()).toBe('2026-10-01T00:00:00.000Z')
  })
})

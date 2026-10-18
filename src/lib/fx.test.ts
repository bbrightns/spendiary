import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isValidRate, rateOrZero, readCachedUsdThb, writeCachedUsdThb } from './fx'
import { sortCashAccounts, totalCash } from './calc'
import { emptyData } from '../store/migrate'

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

describe('rateOrZero', () => {
  it('passes a real rate through and turns anything else into 0', () => {
    expect(rateOrZero(33.2)).toBe(33.2)
    expect(rateOrZero(null)).toBe(0)
    expect(rateOrZero(undefined)).toBe(0)
    expect(rateOrZero(Number.NaN)).toBe(0)
  })
})

describe('cash totals never use a made-up rate', () => {
  const data = {
    ...emptyData,
    cashAccounts: [
      { id: 'thb', name: 'Bank', balance: 1000 },
      { id: 'usd', name: 'Dollar account', balance: 100, currency: 'USD' as const },
    ],
  }

  it('converts USD with the real rate', () => {
    expect(totalCash(data, 33)).toBe(4300)
  })

  it('leaves USD out when there is no rate', () => {
    expect(totalCash(data, null)).toBe(1000)
  })

  it('sorts a USD account after THB ones when its THB value is unknown', () => {
    const accounts = [{ name: 'Dollar account', balance: 999999, currency: 'USD' }, { name: 'Bank', balance: 10 }]
    expect(sortCashAccounts(accounts, null).map((a) => a.name)).toEqual(['Bank', 'Dollar account'])
    expect(sortCashAccounts(accounts, 33).map((a) => a.name)).toEqual(['Dollar account', 'Bank'])
  })
})

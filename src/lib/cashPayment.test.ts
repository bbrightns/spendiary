import { describe, expect, it } from 'vitest'
import { amountInAccountCurrency } from './cashPayment'

describe('amountInAccountCurrency', () => {
  it('uses the THB amount for a THB account, even when the trade has a USD figure', () => {
    expect(amountInAccountCurrency({ currency: 'THB' }, { thb: 35_000, usd: 1_000 }, 35)).toBe(35_000)
  })

  it('treats an account with no currency as THB', () => {
    expect(amountInAccountCurrency({}, { thb: 1_234.567 }, 35)).toBe(1_234.57)
    expect(amountInAccountCurrency(undefined, { thb: 500 }, null)).toBe(500)
  })

  it('uses the trade USD figure for a USD account, not the THB converted at today\'s rate', () => {
    // 10 shares x $100 bought at 34.5; today's rate is 36
    expect(amountInAccountCurrency({ currency: 'USD' }, { thb: 34_500, usd: 1_000 }, 36)).toBe(1_000)
  })

  it('converts a THB-priced trade at the rate for a USD account', () => {
    expect(amountInAccountCurrency({ currency: 'USD' }, { thb: 3_500 }, 35)).toBe(100)
    expect(amountInAccountCurrency({ currency: 'USD' }, { thb: 1_000 }, 33.33)).toBe(30)
  })

  it('returns null for a USD account when it must convert and no rate is known', () => {
    expect(amountInAccountCurrency({ currency: 'USD' }, { thb: 3_500 }, null)).toBeNull()
    expect(amountInAccountCurrency({ currency: 'USD' }, { thb: 3_500 }, 0)).toBeNull()
    expect(amountInAccountCurrency({ currency: 'USD' }, { thb: 3_500, usd: 0 }, undefined)).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import { logTookCash, noteForSource } from './acquisition'
import type { HoldingLog } from './types'

describe('noteForSource', () => {
  const bought = '+5,000,000 sats · ฿136,235 spent · ColdCard'

  it('marks a purchase as received', () => {
    expect(noteForSource(bought, 'received', 'Brother')).toBe('+5,000,000 sats · ฿136,235 worth · ColdCard · Received from Brother')
  })

  it('leaves out the giver when none is given', () => {
    expect(noteForSource(bought, 'received', '  ')).toBe('+5,000,000 sats · ฿136,235 worth · ColdCard · Received')
  })

  it('updates the giver without repeating the suffix', () => {
    const gift = noteForSource(bought, 'received', 'Brother')
    expect(noteForSource(gift, 'received', 'Mom')).toBe('+5,000,000 sats · ฿136,235 worth · ColdCard · Received from Mom')
  })

  it('turns a gift back into a purchase', () => {
    expect(noteForSource(noteForSource(bought, 'received', 'Brother'), 'bought')).toBe(bought)
  })

  it('handles notes without a THB amount', () => {
    expect(noteForSource('+10 shares @ $150.00/unit', 'received')).toBe('+10 shares @ $150.00/unit · Received')
  })
})

describe('logTookCash', () => {
  const base = { id: 'l', timestamp: '', action: 'buy_more', holdingName: 'BTC', ticker: 'BTC', assetClass: 'crypto', note: '' } as HoldingLog

  it('is false for a plain buy', () => {
    expect(logTookCash(base)).toBe(false)
  })

  it('is true when a cash account paid', () => {
    expect(logTookCash({ ...base, cashAccountId: 'c1' })).toBe(true)
    expect(logTookCash({ ...base, note: '+1 sats · Paid from KBank' })).toBe(true)
    expect(logTookCash({ ...base, dcaPlanId: 'p1' })).toBe(true)
    expect(logTookCash({ ...base, note: 'DCA Buy: 800 units @ ฿22.50' })).toBe(true)
  })
})

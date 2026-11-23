import { describe, expect, it } from 'vitest'
import { getLogActionMeta } from './logMeta'
import type { HoldingLog } from '../../lib/types'

const log = (over: Partial<HoldingLog>): HoldingLog => ({
  id: 'l1',
  timestamp: '2026-11-11T03:57:00.000Z',
  action: 'buy_more',
  holdingName: 'Kept by krungsri',
  ticker: '',
  assetClass: 'cash',
  note: '',
  ...over,
})

describe('getLogActionMeta', () => {
  it('calls money put into a cash account a deposit', () => {
    expect(getLogActionMeta(log({ assetClass: 'cash' })).label).toBe('Deposit')
  })

  it('keeps Bought more for an asset and DCA buy for a plan', () => {
    expect(getLogActionMeta(log({ assetClass: 'stock' })).label).toBe('Bought more')
    expect(getLogActionMeta(log({ assetClass: 'cash', dcaPlanId: 'p1' })).label).toBe('DCA buy')
  })
})

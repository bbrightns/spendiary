import { describe, expect, it } from 'vitest'
import { SPEND_CASH, isMovedToSpend, isSpendPath } from './routes'

describe('routes', () => {
  it('puts the Cash view on the Spend side', () => {
    expect(isSpendPath(SPEND_CASH.split('?')[0])).toBe(true)
  })

  it('knows which old Invest paths now redirect into Spend', () => {
    expect(isMovedToSpend('/cash')).toBe(true)
    expect(isMovedToSpend('/cashflow/cash')).toBe(true)
    expect(isMovedToSpend('/debts')).toBe(true)
    expect(isMovedToSpend('/portfolio')).toBe(false)
    expect(isMovedToSpend('/logs')).toBe(false)
  })
})

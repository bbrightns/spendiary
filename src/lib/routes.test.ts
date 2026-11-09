import { describe, expect, it } from 'vitest'
import { SPEND_CASH, isInvestPage, isSpendPath } from './routes'

describe('routes', () => {
  it('puts the Cash view on the Spend side', () => {
    expect(isSpendPath(SPEND_CASH.split('?')[0])).toBe(true)
  })

  it('only counts pages that still exist on the Invest side', () => {
    expect(isInvestPage('/invest')).toBe(true)
    expect(isInvestPage('/portfolio')).toBe(true)
    expect(isInvestPage('/logs/summary')).toBe(true)
    // Moved to Spend, removed, Settings or Spend's own pages
    expect(isInvestPage('/cash')).toBe(false)
    expect(isInvestPage('/cashflow/cash')).toBe(false)
    expect(isInvestPage('/debts')).toBe(false)
    expect(isInvestPage('/cashflow')).toBe(false)
    expect(isInvestPage('/settings')).toBe(false)
    expect(isInvestPage('/')).toBe(false)
    expect(isInvestPage('/spend/txns')).toBe(false)
  })

  it('lists every Invest route App.tsx serves', async () => {
    // Guards against adding an Invest page to the router but not to the list (switching would skip it)
    const { readFileSync } = await import('node:fs')
    const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8')
    const routed = [...app.matchAll(/<Route path="([^"]+)" element=\{<(\w+)/g)]
      .filter(([, path, el]) => path !== '*' && !path.startsWith('/settings') && !el.endsWith('Redirect') && el !== 'Navigate')
      .map(([, path]) => path)
      .filter((path) => !isSpendPath(path))
    expect(routed.length).toBeGreaterThan(0)
    for (const path of routed) expect(isInvestPage(path), path).toBe(true)
  })
})

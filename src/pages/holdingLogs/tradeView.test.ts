import { describe, expect, it } from 'vitest'
import type { HoldingLog } from '../../lib/types'
import { getTradeRow, matchesTrade, tradeTotals } from './tradeView'

const log = (over: Partial<HoldingLog>): HoldingLog =>
  ({ id: 'l', timestamp: '2026-11-07T08:33:00.000Z', action: 'buy_more', holdingId: 'b', holdingName: 'Bitcoin', ticker: 'BTC', assetClass: 'crypto', note: '', ...over }) as HoldingLog

const btcBuy = log({
  dcaPlanId: 'p',
  dcaDate: '2026-11-07',
  note: '฿108.00 spent',
  delta: { units: 0.00004223, thb: 108, location: { id: 'x', name: 'Bitkub', qty: 0.00004223, thb: 108 }, before: { units: 0.1, thb: 1000, price: 2557424 }, after: { units: 0.10004223, thb: 1108, price: 2557424 } },
})

describe('getTradeRow', () => {
  it('shows a buy with what it cost and what it added', () => {
    const row = getTradeRow(btcBuy, null)
    expect(row).toMatchObject({ title: 'Bitcoin', sub: '+4,223 sats' })
    expect(row.amount).toContain('108.00')
    expect(row.meta).toContain('BTC')
    expect(row.meta).toContain('Bitkub')
  })

  it('names the account on a cash edit, with the signed change in its currency', () => {
    const before = { id: 'a', name: 'Dime FCD', balance: 540.32, currency: 'USD' as const }
    const row = getTradeRow(
      log({
        action: 'edit', holdingId: undefined, holdingName: 'Cash Accounts', ticker: 'CASH', assetClass: 'cash',
        note: 'Updated "Dime FCD" balance to $421.06 (-$119.26)',
        previousCashAccountsState: [before], afterCashAccountsState: [{ ...before, balance: 421.06 }],
      }),
      null,
    )
    expect(row).toMatchObject({ title: 'Dime FCD', amount: '−$119.26', amountClass: 'text-ink' })
    expect(row.meta).toContain('Balance now $421.06')
  })

  it('shows a sale as money in, with its profit or loss underneath', () => {
    const row = getTradeRow(log({ action: 'sell', proceeds: 5000, realizedPnL: -200, soldUnits: 0.001, note: 'Sold 100,000 sats' }), null)
    expect(row.amount).toContain('5,000.00')
    expect(row.sub).toContain('−')
    expect(row.subClass).toBe('text-loss-ink')
  })

  it('shows a dividend as money in', () => {
    const row = getTradeRow(log({ action: 'dividend', netDividend: 90, note: 'Received dividend ฿90.00 into Bank' }), null)
    expect(row.amountClass).toBe('text-gain-ink')
    expect(row.meta).toContain('Dividend paid into Bank')
  })

  it('gives a record such as a DCA plan change no amount, even with money in its note', () => {
    const row = getTradeRow(log({ action: 'edit', holdingId: undefined, holdingName: 'DCA Plan: BTC', ticker: 'DCA', note: 'Updated DCA plan of ฿5,000/month' }), null)
    expect(row.amount).toBeUndefined()
    expect(row.meta).toContain('Updated DCA plan')
  })
})

describe('matchesTrade', () => {
  it('needs every word, across asset, kind and location', () => {
    expect(matchesTrade(btcBuy, [])).toBe(true)
    expect(matchesTrade(btcBuy, ['btc', 'bitkub'])).toBe(true)
    expect(matchesTrade(btcBuy, ['btc', 'dime'])).toBe(false)
  })
})

describe('tradeTotals', () => {
  it('adds buys, sales and dividends; gifts and debt entries stay out', () => {
    const totals = tradeTotals(
      [
        btcBuy,
        log({ source: 'received', note: '฿50.00 worth', delta: { units: 1, thb: 50 } }),
        log({ action: 'sell', proceeds: 300 }),
        log({ action: 'sell', holdingId: undefined, holdingName: 'Liability: Car', ticker: 'DEBT', assetClass: 'cash', note: 'Paid off (฿900)' }),
        log({ action: 'dividend', netDividend: 90 }),
      ],
      null,
    )
    expect(totals).toEqual({ bought: 108, sold: 300, dividends: 90 })
  })
})

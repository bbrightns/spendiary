import { describe, expect, it } from 'vitest'
import type { SpendiaryData } from '../lib/types'
import { makeBackup, parseBackup } from './backup'
import { emptyData } from './migrate'
import { recordDividend } from './actions/dividends'
import { undoHoldingLog } from './actions/holdingLogs'

const data: SpendiaryData = { ...emptyData, cashAccounts: [{ id: 'bank', name: 'Bank', balance: 1000 }] }

describe('backups', () => {
  it('round-trips data and preferences', () => {
    const json = JSON.stringify(makeBackup(data, { theme: 'dark' }))
    const parsed = parseBackup(json)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.data.cashAccounts).toEqual(data.cashAccounts)
    expect(parsed.data.lastUpdatedAt).toBeGreaterThan(0)
    expect(parsed.preferences).toEqual({ theme: 'dark' })
  })

  it('still reads an old export that is just the data', () => {
    const parsed = parseBackup(JSON.stringify(data))
    expect(parsed).toMatchObject({ ok: true, preferences: undefined })
  })

  it('explains what is wrong with a bad file', () => {
    expect(parseBackup('{oops')).toMatchObject({ ok: false, error: expect.stringContaining('not valid JSON') })
    expect(parseBackup(JSON.stringify({ hello: 1 }))).toMatchObject({ ok: false, error: expect.stringContaining('does not match') })
  })
})

describe('recordDividend', () => {
  const record = {
    holdingId: 'h1', holdingName: 'PTT', ticker: 'PTT', assetClass: 'stock' as const, paymentDate: '2026-05-01',
    dps: 1, shares: 100, grossAmount: 100, taxRate: 0.1, taxAmount: 10, netAmount: 90, cashAccountId: 'bank',
  }

  it('pays into the account and keeps the record and a log under the given id', () => {
    const out = recordDividend(data, record, 'r1')
    expect(out.cashAccounts[0].balance).toBe(1090)
    expect(out.dividendRecords?.[0]).toMatchObject({ id: 'r1', cashAccountName: 'Bank', netAmount: 90 })
    expect(out.holdingLogs?.[0]).toMatchObject({ action: 'dividend', dividendRecordId: 'r1', netDividend: 90 })
  })

  it('can be undone from the log', () => {
    const out = recordDividend(data, record, 'r1')
    const undone = undoHoldingLog(out, out.holdingLogs![0].id)
    expect(undone.cashAccounts[0].balance).toBe(1000)
    expect(undone.dividendRecords).toEqual([])
  })

  it('records without paying in when no account was chosen', () => {
    const out = recordDividend(data, { ...record, cashAccountId: undefined }, 'r2')
    expect(out.cashAccounts).toEqual(data.cashAccounts)
    expect(out.dividendRecords).toHaveLength(1)
  })
})

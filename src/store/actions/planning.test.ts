import { describe, expect, it } from 'vitest'
import type { DividendRecord, SpendiaryData, Transfer } from '../../lib/types'
import { localDateStr } from '../../lib/format'
import { emptyData } from '../migrate'
import { removeDividendRecord } from './dividends'
import {
  recordNetWorthSnapshot,
  recordPortfolioSnapshot,
  removePlannedAsset,
  removeTransfer,
  setRebalanceMode,
  setRebalanceTargets,
  upsertPlannedAsset,
  upsertTransfer,
} from './planning'

const transfer: Transfer = { id: 't1', recipient: 'Mum', amount: 8000, frequency: 'monthly', total: 12, completed: 3, expiryDate: '2027-10-01' }

describe('transfers', () => {
  it('adds, updates and removes', () => {
    const added = upsertTransfer(emptyData, transfer)
    expect(added.transfers).toEqual([transfer])
    expect(upsertTransfer(added, { ...transfer, completed: 4 }).transfers[0].completed).toBe(4)
    expect(removeTransfer(added, 't1').transfers).toEqual([])
  })
})

describe('rebalancing', () => {
  it('sets the mode and targets', () => {
    expect(setRebalanceMode(emptyData, 'holding').rebalanceMode).toBe('holding')
    const targets = { fund: 60, stock: 40, crypto: 0, gold: 0, real_estate: 0 }
    expect(setRebalanceTargets(emptyData, targets).rebalanceTargets).toEqual(targets)
  })

  it('removes a planned asset together with its target', () => {
    const withAsset = upsertPlannedAsset({ ...emptyData, rebalanceHoldingTargets: { a1: 10, h1: 90 } }, { id: 'a1', name: 'Gold ETF', assetClass: 'gold' } as never)
    expect(withAsset.plannedAssets).toHaveLength(1)
    const out = removePlannedAsset(withAsset, 'a1')
    expect(out.plannedAssets).toEqual([])
    expect(out.rebalanceHoldingTargets).toEqual({ h1: 90 })
  })
})

describe('history snapshots', () => {
  const today = localDateStr()

  it('ignores zero or negative values', () => {
    expect(recordNetWorthSnapshot(emptyData, 0)).toBe(emptyData)
    expect(recordPortfolioSnapshot(emptyData, -5)).toBe(emptyData)
  })

  it("replaces today's entry and keeps the list sorted", () => {
    const before = { ...emptyData, netWorthHistory: [{ date: today, value: 1 }, { date: '2020-01-01', value: 5 }] }
    expect(recordNetWorthSnapshot(before, 100).netWorthHistory).toEqual([{ date: '2020-01-01', value: 5 }, { date: today, value: 100 }])
  })

  it('keeps only the last 365 days', () => {
    const old = Array.from({ length: 400 }, (_, i) => ({ date: `2000-01-01-${String(i).padStart(3, '0')}`, value: i + 1 }))
    const out = recordPortfolioSnapshot({ ...emptyData, portfolioHistory: old }, 7).portfolioHistory!
    expect(out).toHaveLength(365)
    expect(out[364]).toEqual({ date: today, value: 7 })
  })
})

describe('removeDividendRecord', () => {
  const record = { id: 'r1', holdingName: 'PTT', ticker: 'PTT', assetClass: 'stock', paymentDate: '2026-05-01', dps: 1, shares: 100, grossAmount: 100, taxRate: 0.1, taxAmount: 10, netAmount: 90, cashAccountId: 'bank' } as DividendRecord
  const state: SpendiaryData = {
    ...emptyData,
    cashAccounts: [{ id: 'bank', name: 'Bank', balance: 1000 }],
    dividendRecords: [record],
    holdingLogs: [
      { id: 'l1', timestamp: '', action: 'dividend', holdingName: 'PTT', ticker: 'PTT', assetClass: 'stock', note: '', dividendRecordId: 'r1' },
      { id: 'l2', timestamp: '', action: 'note', holdingName: 'PTT', ticker: 'PTT', assetClass: 'stock', note: '' },
    ],
  }

  it('takes the deposit back out and removes the record and its log', () => {
    const out = removeDividendRecord(state, 'r1')
    expect(out.cashAccounts[0].balance).toBe(910)
    expect(out.dividendRecords).toEqual([])
    expect(out.holdingLogs?.map((l) => l.id)).toEqual(['l2'])
  })

  it('never takes the balance below zero', () => {
    const poor = { ...state, cashAccounts: [{ id: 'bank', name: 'Bank', balance: 50 }] }
    expect(removeDividendRecord(poor, 'r1').cashAccounts[0].balance).toBe(0)
  })

  it('changes nothing for an unknown record', () => {
    expect(removeDividendRecord(state, 'nope')).toBe(state)
  })
})

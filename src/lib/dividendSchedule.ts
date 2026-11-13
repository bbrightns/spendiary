import type { DividendPayoutSchedule, Holding } from './types'

export type DpsMap = Record<number, number | string>

/** Only funds and stocks can be set up to pay dividends. */
export function canPayDividend(h: Pick<Holding, 'assetClass'>): boolean {
  return h.assetClass === 'fund' || h.assetClass === 'stock'
}

/** The per-month dividend per share a holding is set up with, reading the older single-DPS shape too. */
export function dpsMapFromHolding(h: Holding): DpsMap {
  const map: DpsMap = {}
  if (h.dividendPayouts && h.dividendPayouts.length > 0) {
    h.dividendPayouts.forEach((p) => { map[p.month] = p.dps })
  } else if (h.dividendMonths && h.dividendMonths.length > 0) {
    const legacy = typeof h.expectedDps === 'number' && h.expectedDps > 0
      ? h.expectedDps
      : (parseFloat(String(h.expectedDps ?? '')) || '')
    h.dividendMonths.forEach((m) => { map[m] = legacy })
  } else if (typeof h.expectedDps === 'number' && h.expectedDps > 0) {
    map[1] = h.expectedDps
  }
  return map
}

type DividendFields = Pick<Holding, 'paysDividend' | 'dividendMonths' | 'dividendPayouts' | 'expectedDps' | 'defaultCashAccountId'>

/** The holding fields to save for a schedule. No months means the holding stops being tracked. */
export function dividendFields(months: number[], dpsMap: DpsMap, defaultCashAccountId: string): DividendFields {
  if (months.length === 0) {
    return { paysDividend: false, dividendMonths: undefined, dividendPayouts: undefined, expectedDps: undefined, defaultCashAccountId: undefined }
  }
  const sorted = [...new Set(months)].sort((a, b) => a - b)
  const payouts: DividendPayoutSchedule[] = sorted.map((month) => {
    const raw = dpsMap[month]
    const num = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''))
    return { month, dps: isNaN(num) ? 0 : Math.max(0, num) }
  })
  const avg = Number((payouts.reduce((s, p) => s + p.dps, 0) / payouts.length).toFixed(4))
  return {
    paysDividend: true,
    dividendMonths: sorted,
    dividendPayouts: payouts,
    expectedDps: avg > 0 ? avg : undefined,
    defaultCashAccountId: defaultCashAccountId || undefined,
  }
}

import { GRAMS_PER_BAHT_GOLD, SATS_PER_BTC } from './calc'
import { localDateStr } from './format'
import type { AssetClass, HoldingLog, NetWorthSnapshot } from './types'

/* ────────────────────────────────────────────────────────────────────────────
 * Shared log parsing
 *
 * These helpers used to live inside pages/HoldingLogs.tsx. They are the single
 * source of truth for reading amounts, proceeds and cash-account diffs out of a
 * HoldingLog (including notes written by older app versions), and are shared by
 * the Activity Logs page and the Activity Summary page.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface CashDiffItem {
  accountName: string
  prevName?: string
  currName?: string
  prevBalance?: number
  currBalance?: number
  diff?: number
  currencySymbol: string
  actionType: 'add' | 'update' | 'rename' | 'remove' | 'deposit'
}

export function getCashDiffItems(log: HoldingLog): CashDiffItem[] {
  if (log.assetClass !== 'cash' && log.ticker !== 'CASH' && log.holdingName !== 'Cash Accounts') {
    return []
  }

  const items: CashDiffItem[] = []
  const oldAccounts = log.previousCashAccountsState ?? []
  const newAccounts = log.afterCashAccountsState ?? []

  // 1. Check if both before and after states exist
  if (oldAccounts.length > 0 && newAccounts.length > 0) {
    for (const newAcc of newAccounts) {
      const oldAcc = oldAccounts.find((a) => a.id === newAcc.id)
      const sym = (newAcc.currency ?? 'THB') === 'USD' ? '$' : '฿'
      if (!oldAcc) {
        items.push({
          accountName: newAcc.name,
          currName: newAcc.name,
          prevBalance: 0,
          currBalance: newAcc.balance,
          diff: newAcc.balance,
          currencySymbol: sym,
          actionType: 'add',
        })
      } else if (
        newAcc.balance !== oldAcc.balance ||
        newAcc.name !== oldAcc.name ||
        newAcc.currency !== oldAcc.currency
      ) {
        items.push({
          accountName: newAcc.name,
          prevName: oldAcc.name,
          currName: newAcc.name,
          prevBalance: oldAcc.balance,
          currBalance: newAcc.balance,
          diff: newAcc.balance - oldAcc.balance,
          currencySymbol: sym,
          actionType: newAcc.name !== oldAcc.name ? 'rename' : 'update',
        })
      }
    }
    for (const oldAcc of oldAccounts) {
      if (!newAccounts.some((a) => a.id === oldAcc.id)) {
        const sym = (oldAcc.currency ?? 'THB') === 'USD' ? '$' : '฿'
        items.push({
          accountName: oldAcc.name,
          prevName: oldAcc.name,
          prevBalance: oldAcc.balance,
          currBalance: 0,
          diff: -oldAcc.balance,
          currencySymbol: sym,
          actionType: 'remove',
        })
      }
    }
    if (items.length > 0) return items
  }

  // 2. Parse from note (for historical logs)
  // "Added \"SCB EZ\" with balance ฿6.2"
  const addMatches = [...log.note.matchAll(/Added\s*"([^"]+)"\s*with\s*balance\s*([฿$])([0-9,.]+)/g)]
  for (const m of addMatches) {
    const sym = m[2]
    const bal = parseFloat(m[3].replace(/,/g, ''))
    items.push({
      accountName: m[1],
      currName: m[1],
      prevBalance: 0,
      currBalance: bal,
      diff: bal,
      currencySymbol: sym,
      actionType: 'add',
    })
  }

  // "Updated \"Kept\" balance to ฿259,915.93 (+฿10,000)" or without diff suffix
  const updateMatches = [...log.note.matchAll(/Updated\s*"([^"]+)"\s*balance\s*to\s*([฿$])([0-9,.]+)(?:\s*\(([+-][฿$]?)([0-9,.]+)\))?/g)]
  for (const m of updateMatches) {
    const accName = m[1]
    const sym = m[2]
    const currBal = parseFloat(m[3].replace(/,/g, ''))
    let diff: number | undefined
    let prevBal: number | undefined

    if (m[4] && m[5]) {
      const sign = m[4].includes('-') ? -1 : 1
      diff = sign * parseFloat(m[5].replace(/,/g, ''))
      prevBal = currBal - diff
    } else {
      const oldAcc = oldAccounts.find((a) => a.name === accName)
      if (oldAcc) {
        prevBal = oldAcc.balance
        diff = currBal - prevBal
      }
    }

    items.push({
      accountName: accName,
      currName: accName,
      prevBalance: prevBal,
      currBalance: currBal,
      diff,
      currencySymbol: sym,
      actionType: 'update',
    })
  }

  // "Renamed \"Click\" to \"Click 2%\" and set balance to ฿300,230.14 (-฿5,000)"
  const renameBalMatches = [...log.note.matchAll(/Renamed\s*"([^"]+)"\s*to\s*"([^"]+)"\s*and\s*set\s*balance\s*to\s*([฿$])([0-9,.]+)(?:\s*\(([+-][฿$]?)([0-9,.]+)\))?/g)]
  for (const m of renameBalMatches) {
    const prevName = m[1]
    const currName = m[2]
    const sym = m[3]
    const currBal = parseFloat(m[4].replace(/,/g, ''))
    let diff: number | undefined
    let prevBal: number | undefined

    if (m[5] && m[6]) {
      const sign = m[5].includes('-') ? -1 : 1
      diff = sign * parseFloat(m[6].replace(/,/g, ''))
      prevBal = currBal - diff
    } else {
      const oldAcc = oldAccounts.find((a) => a.name === prevName)
      if (oldAcc) {
        prevBal = oldAcc.balance
        diff = currBal - prevBal
      }
    }

    items.push({
      accountName: currName,
      prevName,
      currName,
      prevBalance: prevBal,
      currBalance: currBal,
      diff,
      currencySymbol: sym,
      actionType: 'rename',
    })
  }

  // "Renamed \"Click\" to \"Click 2%\"" (no balance change)
  const renameOnlyMatches = [...log.note.matchAll(/Renamed\s*"([^"]+)"\s*to\s*"([^"]+)"(?!\s*and\s*set)/g)]
  for (const m of renameOnlyMatches) {
    items.push({
      accountName: m[2],
      prevName: m[1],
      currName: m[2],
      currencySymbol: '฿',
      actionType: 'rename',
    })
  }

  // "Removed \"Old Wallet\" (฿500.00)"
  const removeMatches = [...log.note.matchAll(/Removed\s*"([^"]+)"\s*\(([฿$])([0-9,.]+)\)/g)]
  for (const m of removeMatches) {
    const bal = parseFloat(m[3].replace(/,/g, ''))
    items.push({
      accountName: m[1],
      prevName: m[1],
      prevBalance: bal,
      currBalance: 0,
      diff: -bal,
      currencySymbol: m[2],
      actionType: 'remove',
    })
  }

  // "Deposited ฿2,500 via DCA into Kept"
  const dcaDepositMatch = log.note.match(/Deposited\s*([฿$])([0-9,.]+)\s*via\s*DCA\s*into\s*([^·\n]+)/)
  if (dcaDepositMatch) {
    const sym = dcaDepositMatch[1]
    const amount = parseFloat(dcaDepositMatch[2].replace(/,/g, ''))
    const accName = dcaDepositMatch[3].trim()
    items.push({
      accountName: accName,
      currName: accName,
      diff: amount,
      currencySymbol: sym,
      actionType: 'deposit',
    })
  }

  return items
}

export function getLogTransactionDetails(log: HoldingLog, usdThb?: number | null): {
  priceDisplay: string
  sharesDisplay: string
  amountThbDisplay: string
  amountThbValue: number | null
} {
  const prev = log.previousHoldingState
  const curr = log.afterHoldingState
  const fx = usdThb && usdThb > 0 ? usdThb : 34

  // Check if it is a cash log
  if (log.assetClass === 'cash' || log.ticker === 'CASH' || log.holdingName === 'Cash Accounts') {
    const cashItems = getCashDiffItems(log)
    if (cashItems.length > 0) {
      const diffStrings: string[] = []
      let totalChangeThb = 0
      for (const item of cashItems) {
        if (item.diff !== undefined && Math.abs(item.diff) > 0.001) {
          const sign = item.diff > 0 ? '+' : '-'
          const formatted = `${sign}${item.currencySymbol}${Math.abs(item.diff).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          diffStrings.push(formatted)
          totalChangeThb += Math.abs(item.diff) * (item.currencySymbol === '$' ? fx : 1)
        } else if (item.currBalance !== undefined && item.actionType === 'add') {
          const formatted = `+${item.currencySymbol}${item.currBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          diffStrings.push(formatted)
          totalChangeThb += item.currBalance * (item.currencySymbol === '$' ? fx : 1)
        }
      }

      const sharesDisplay = diffStrings.length > 0 ? diffStrings.join(', ') : '-'
      const amountThbDisplay = totalChangeThb > 0
        ? `฿${totalChangeThb.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : '-'

      return {
        priceDisplay: '-',
        sharesDisplay,
        amountThbDisplay,
        amountThbValue: totalChangeThb > 0 ? totalChangeThb : null,
      }
    }
  }

  if (log.action === 'sell') {
    const prevUnits = prev ? (prev.units ?? prev.totalUnits ?? 0) : 0
    const currUnits = curr ? (curr.units ?? curr.totalUnits ?? 0) : 0
    const soldUnits = log.soldUnits ?? (prevUnits > 0 ? prevUnits - currUnits : 0)

    let sharesDisplay = '-'
    if (soldUnits > 0) {
      if (log.assetClass === 'crypto') {
        const sats = Math.round(soldUnits * SATS_PER_BTC)
        sharesDisplay = `-${sats.toLocaleString()} sats`
      } else if (log.assetClass === 'gold') {
        sharesDisplay = `-${soldUnits.toFixed(4)} g`
      } else if (log.assetClass === 'stock') {
        sharesDisplay = `-${soldUnits.toLocaleString(undefined, { maximumFractionDigits: 4 })} shares`
      } else {
        sharesDisplay = `-${soldUnits.toLocaleString(undefined, { maximumFractionDigits: 4 })} units`
      }
    }

    let priceDisplay = '-'
    if (log.assetClass === 'stock') {
      const notePriceMatch = log.note.match(/@\s*\$([0-9,.]+)/)
      if (notePriceMatch) {
        priceDisplay = `$${notePriceMatch[1]}`
      } else if (log.soldPrice && log.soldPrice > 0) {
        priceDisplay = `$${(log.soldPrice / fx).toFixed(2)}`
      }
    } else {
      const notePriceMatch = log.note.match(/(?:@|ที่ราคา)\s*฿([0-9,.]+)/)
      if (notePriceMatch) {
        priceDisplay = `฿${notePriceMatch[1]}`
      } else if (log.soldPrice && log.soldPrice > 0) {
        priceDisplay = `฿${Math.round(log.soldPrice).toLocaleString()}`
      }
    }

    let proceedsThb = log.proceeds ?? null
    if (proceedsThb === null) {
      const proceedsMatch = log.note.match(/(?:Proceeds|ได้รับเงิน):\s*฿([0-9,.]+)/)
      if (proceedsMatch) {
        proceedsThb = parseFloat(proceedsMatch[1].replace(/,/g, ''))
      }
    }

    const amountThbDisplay = proceedsThb !== null
      ? `฿${proceedsThb.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : '-'

    return {
      priceDisplay,
      sharesDisplay,
      amountThbDisplay,
      amountThbValue: proceedsThb,
    }
  }

  if (curr) {
    const prevUnits = prev ? (prev.units ?? prev.totalUnits ?? 0) : 0
    const currUnits = curr.units ?? curr.totalUnits ?? 0
    const unitDiff = log.action === 'add' ? currUnits : (currUnits - prevUnits)

    const prevBasis = prev ? (prev.totalThbInvested ?? (prevUnits * (prev.avgCostThb ?? prev.avgCost ?? 0))) : 0
    const currBasis = curr.totalThbInvested ?? (currUnits * (curr.avgCostThb ?? curr.avgCost ?? 0))
    let costDiff = log.action === 'add' ? currBasis : (currBasis - prevBasis)

    // Format units
    let sharesDisplay = '-'
    if (Math.abs(unitDiff) > 0.00001) {
      const sign = unitDiff > 0 ? '+' : ''
      if (log.assetClass === 'crypto') {
        const sats = Math.round(unitDiff * SATS_PER_BTC)
        sharesDisplay = `${sign}${sats.toLocaleString()} sats`
      } else if (log.assetClass === 'gold') {
        sharesDisplay = `${sign}${unitDiff.toFixed(4)} g`
      } else if (log.assetClass === 'stock') {
        sharesDisplay = `${sign}${unitDiff.toLocaleString(undefined, { maximumFractionDigits: 4 })} shares`
      } else {
        sharesDisplay = `${sign}${unitDiff.toLocaleString(undefined, { maximumFractionDigits: 4 })} units`
      }
    }

    // Format price
    let priceDisplay = '-'
    if (log.action === 'buy_more' || log.action === 'add') {
      if (log.assetClass === 'stock') {
        const notePriceMatch = log.note.match(/@\s*\$([0-9,.]+)/)
        if (notePriceMatch) {
          priceDisplay = `$${notePriceMatch[1]}`
        } else if (curr.avgCostUsd && curr.avgCostUsd > 0) {
          priceDisplay = `$${curr.avgCostUsd.toFixed(2)}`
        } else if (curr.price && curr.price > 0) {
          priceDisplay = `$${(curr.price / fx).toFixed(2)}`
        }
      } else if (log.assetClass === 'crypto') {
        const noteSpentMatch = log.note.match(/฿([0-9,.]+)\s*spent/)
        if (noteSpentMatch && Math.abs(unitDiff) > 0) {
          const spent = parseFloat(noteSpentMatch[1].replace(/,/g, ''))
          costDiff = spent
          const pricePerBtc = spent / unitDiff
          priceDisplay = `฿${Math.round(pricePerBtc).toLocaleString()}`
        } else if (curr.price && curr.price > 0) {
          priceDisplay = `฿${Math.round(curr.price).toLocaleString()}`
        }
      } else if (log.assetClass === 'gold') {
        const noteSpentMatch = log.note.match(/฿([0-9,.]+)\s*spent/)
        if (noteSpentMatch && Math.abs(unitDiff) > 0) {
          const spent = parseFloat(noteSpentMatch[1].replace(/,/g, ''))
          costDiff = spent
          const pricePerGram = spent / unitDiff
          const pricePerBaht = Math.round(pricePerGram * GRAMS_PER_BAHT_GOLD)
          priceDisplay = `฿${pricePerBaht.toLocaleString()}/บาททอง`
        } else if (curr.price && curr.price > 0) {
          const pricePerBaht = Math.round((curr.price < 10000 ? curr.price * GRAMS_PER_BAHT_GOLD : curr.price))
          priceDisplay = `฿${pricePerBaht.toLocaleString()}/บาททอง`
        }
      } else {
        const notePriceMatch = log.note.match(/@\s*฿([0-9,.]+)/)
        if (notePriceMatch) {
          priceDisplay = `฿${notePriceMatch[1]}`
        } else if (unitDiff > 0 && costDiff > 0) {
          priceDisplay = `฿${(costDiff / unitDiff).toFixed(2)}`
        } else if (curr.price && curr.price > 0) {
          priceDisplay = `฿${curr.price.toFixed(2)}`
        }
      }
    } else if (log.action === 'edit') {
      const prevPrice = prev?.price ?? 0
      const currPrice = curr.price ?? 0
      if (Math.abs(currPrice - prevPrice) > 0.001) {
        if (log.assetClass === 'stock') {
          priceDisplay = `$${(currPrice / fx).toFixed(2)}`
        } else if (log.assetClass === 'crypto') {
          priceDisplay = `฿${Math.round(currPrice).toLocaleString()}`
        } else {
          priceDisplay = `฿${currPrice.toFixed(2)}`
        }
      }
    }

    // Format amount THB
    let amountThbDisplay = '-'
    let amountThbValue: number | null = null

    const spentMatch = log.note.match(/฿([0-9,.]+)\s*spent/)
    const depositMatch = log.note.match(/Deposited\s*฿([0-9,.]+)/)
    const costMatch = log.note.match(/\(\+฿([0-9,.]+)\)/)

    if (spentMatch) {
      amountThbValue = parseFloat(spentMatch[1].replace(/,/g, ''))
    } else if (depositMatch) {
      amountThbValue = parseFloat(depositMatch[1].replace(/,/g, ''))
    } else if (costMatch) {
      amountThbValue = parseFloat(costMatch[1].replace(/,/g, ''))
    } else if (Math.abs(costDiff) > 1) {
      amountThbValue = Math.abs(costDiff)
    } else if (log.assetClass === 'stock' && Math.abs(unitDiff) > 0) {
      const notePriceMatch = log.note.match(/@\s*\$([0-9,.]+)/)
      if (notePriceMatch) {
        const pUsd = parseFloat(notePriceMatch[1].replace(/,/g, ''))
        amountThbValue = Math.abs(unitDiff) * pUsd * fx
      }
    }

    if (amountThbValue !== null && amountThbValue > 0) {
      amountThbDisplay = `฿${amountThbValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }

    return {
      priceDisplay,
      sharesDisplay,
      amountThbDisplay,
      amountThbValue,
    }
  }

  // Fallback for logs without holding state
  const depositMatch = log.note.match(/฿([0-9,.]+)/)
  const amountThbValue = depositMatch ? parseFloat(depositMatch[1].replace(/,/g, '')) : null
  const amountThbDisplay = amountThbValue ? `฿${amountThbValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'

  return {
    priceDisplay: '-',
    sharesDisplay: '-',
    amountThbDisplay,
    amountThbValue,
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Period selection
 * ──────────────────────────────────────────────────────────────────────────── */

export const MONTH_LABELS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

const MONTH_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

/** Which slice of history the Summary page is looking at. */
export interface LogPeriod {
  /** `'all'` means every year on record */
  year: number | 'all'
  /** 1–12, or `'all'` for the whole year */
  month: number | 'all'
}

export const ALL_TIME_PERIOD: LogPeriod = { year: 'all', month: 'all' }

export function isAllTime(period: LogPeriod): boolean {
  return period.year === 'all'
}

/** Local-time bounds for a period. `null` means unbounded (all time). */
export function resolvePeriodRange(period: LogPeriod): { start: Date; end: Date } | null {
  if (period.year === 'all') return null
  const year = period.year
  if (period.month === 'all') {
    return {
      start: new Date(year, 0, 1, 0, 0, 0, 0),
      end: new Date(year, 11, 31, 23, 59, 59, 999),
    }
  }
  const month = period.month - 1
  return {
    start: new Date(year, month, 1, 0, 0, 0, 0),
    // Day 0 of the next month = last day of this month
    end: new Date(year, month + 1, 0, 23, 59, 59, 999),
  }
}

export function describePeriod(period: LogPeriod): string {
  if (period.year === 'all') return 'ทั้งหมด'
  if (period.month === 'all') return `ปี ${period.year}`
  return `${MONTH_LABELS[period.month - 1]} ${period.year}`
}

export function isLogInPeriod(log: HoldingLog, period: LogPeriod): boolean {
  const range = resolvePeriodRange(period)
  if (!range) return true
  const t = new Date(log.timestamp).getTime()
  return t >= range.start.getTime() && t <= range.end.getTime()
}

export interface AvailablePeriods {
  /** Descending, only years that actually have logs */
  years: number[]
  /** Ascending month numbers (1–12) per year */
  monthsByYear: Record<number, number[]>
}

export function availablePeriods(logs: HoldingLog[]): AvailablePeriods {
  const monthsByYear: Record<number, Set<number>> = {}
  for (const log of logs) {
    if (!isInvestmentLog(log)) continue
    const d = new Date(log.timestamp)
    if (isNaN(d.getTime())) continue
    const year = d.getFullYear()
    if (!monthsByYear[year]) monthsByYear[year] = new Set()
    monthsByYear[year].add(d.getMonth() + 1)
  }

  const years = Object.keys(monthsByYear)
    .map(Number)
    .sort((a, b) => b - a)

  const sorted: Record<number, number[]> = {}
  for (const year of years) {
    sorted[year] = Array.from(monthsByYear[year]).sort((a, b) => a - b)
  }

  return { years, monthsByYear: sorted }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Aggregation
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Cash accounts and fixed-cost entries move money around rather than generating
 * profit, so they are kept out of the P/L numbers.
 */
export function isInvestmentLog(log: HoldingLog): boolean {
  if (log.assetClass === 'cash' || log.ticker === 'CASH' || log.holdingName === 'Cash Accounts') return false
  if (log.ticker === 'FIXED' || log.holdingName.startsWith('Fixed Cost:')) return false
  return true
}

/** Realized P/L recorded on a sell, falling back to the legacy note format. */
export function resolveRealizedPnL(log: HoldingLog): { value: number; percent: number } | null {
  if (log.realizedPnL !== undefined && log.realizedPnL !== null) {
    return { value: log.realizedPnL, percent: log.realizedPnLPercent ?? 0 }
  }
  // "· กำไร: +฿12,500.00 (+35.8%)" / "· Realized PnL: -฿1,200 (‑5.8%)"
  const m = log.note.match(/(?:Realized PnL|กำไร|ขาดทุน)\s*:\s*([+-]?)\s*฿\s*([0-9,.]+)\s*(?:\(\s*([+-]?[0-9.]+)\s*%\))?/)
  if (!m) return null
  const raw = parseFloat(m[2].replace(/,/g, ''))
  if (!isFinite(raw)) return null
  const isLossWord = m[0].startsWith('ขาดทุน')
  const sign = m[1] === '-' || isLossWord ? -1 : 1
  return { value: sign * raw, percent: m[3] ? parseFloat(m[3]) : 0 }
}

/** Cash received from a sell, falling back to the legacy note format. */
export function resolveProceeds(log: HoldingLog): number | null {
  if (log.proceeds !== undefined && log.proceeds !== null) return log.proceeds
  const m = log.note.match(/(?:Proceeds|ได้รับเงิน)\s*:\s*฿\s*([0-9,.]+)/)
  if (!m) return null
  const value = parseFloat(m[1].replace(/,/g, ''))
  return isFinite(value) ? value : null
}

/**
 * Dividend totals. Older logs only carry the text note
 * "Received dividend ฿3,024.00 (DPS: ฿0.28, Tax 10%: -฿336.00)", where the first
 * amount is what actually landed in the account (net) and the tax is withheld.
 */
export function resolveDividend(log: HoldingLog): { gross: number; tax: number; net: number } {
  let gross = log.grossDividend
  let tax = log.withholdingTax
  let net = log.netDividend

  if (net === undefined) {
    const m = log.note.match(/Received dividend\s*฿\s*([0-9,.]+)/)
    if (m) net = parseFloat(m[1].replace(/,/g, ''))
  }
  if (tax === undefined) {
    const m = log.note.match(/Tax\s*[^:]*:\s*-?\s*฿\s*([0-9,.]+)/)
    if (m) tax = parseFloat(m[1].replace(/,/g, ''))
  }

  const netValue = net ?? (gross !== undefined ? gross - (tax ?? 0) : 0)
  const taxValue = tax ?? 0
  const grossValue = gross ?? netValue + taxValue

  return { gross: grossValue, tax: taxValue, net: netValue }
}

export interface AssetPnlRow {
  key: string
  name: string
  ticker: string
  assetClass: AssetClass
  trades: number
  invested: number
  proceeds: number
  costBasisSold: number
  realizedPnL: number
  dividendsGross: number
  withholdingTax: number
  dividendsNet: number
  /** Realized P/L plus dividends actually received */
  net: number
}

export interface MonthlyPnlBucket {
  /** `YYYY-MM` */
  key: string
  label: string
  realizedPnL: number
  dividendsNet: number
  net: number
}

export interface ActivitySummaryTotals {
  transactionCount: number
  buyCount: number
  sellCount: number
  dividendCount: number
  editCount: number
  invested: number
  proceeds: number
  costBasisSold: number
  realizedPnL: number
  realizedPnLPercent: number
  dividendsGross: number
  withholdingTax: number
  dividendsNet: number
  /** Realized P/L + net dividends — the headline "did I make money?" number */
  netProfit: number
  rows: AssetPnlRow[]
  months: MonthlyPnlBucket[]
  firstLogAt: string | null
  lastLogAt: string | null
}

export function summarizeActivity(
  logs: HoldingLog[],
  period: LogPeriod,
  usdThb?: number | null,
): ActivitySummaryTotals {
  const rowsByAsset = new Map<string, AssetPnlRow>()
  const monthsByKey = new Map<string, MonthlyPnlBucket>()

  let transactionCount = 0
  let buyCount = 0
  let sellCount = 0
  let dividendCount = 0
  let editCount = 0
  let invested = 0
  let proceeds = 0
  let costBasisSold = 0
  let realizedPnL = 0
  let dividendsGross = 0
  let withholdingTax = 0
  let dividendsNet = 0
  let firstLogAt: string | null = null
  let lastLogAt: string | null = null

  for (const log of logs) {
    if (!isInvestmentLog(log)) continue
    if (!isLogInPeriod(log, period)) continue

    const when = new Date(log.timestamp)
    if (isNaN(when.getTime())) continue

    transactionCount += 1
    if (!firstLogAt || when.getTime() < new Date(firstLogAt).getTime()) firstLogAt = log.timestamp
    if (!lastLogAt || when.getTime() > new Date(lastLogAt).getTime()) lastLogAt = log.timestamp

    const assetKey = log.holdingId ?? `${log.assetClass}:${log.ticker || log.holdingName}`
    let row = rowsByAsset.get(assetKey)
    if (!row) {
      row = {
        key: assetKey,
        name: log.holdingName,
        ticker: log.ticker,
        assetClass: log.assetClass,
        trades: 0,
        invested: 0,
        proceeds: 0,
        costBasisSold: 0,
        realizedPnL: 0,
        dividendsGross: 0,
        withholdingTax: 0,
        dividendsNet: 0,
        net: 0,
      }
      rowsByAsset.set(assetKey, row)
    }
    row.trades += 1

    const monthKey = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}`
    let bucket = monthsByKey.get(monthKey)
    if (!bucket) {
      bucket = {
        key: monthKey,
        label: `${MONTH_SHORT[when.getMonth()]} ${String(when.getFullYear()).slice(2)}`,
        realizedPnL: 0,
        dividendsNet: 0,
        net: 0,
      }
      monthsByKey.set(monthKey, bucket)
    }

    if (log.action === 'sell') {
      sellCount += 1
      const pnl = resolveRealizedPnL(log)
      const saleProceeds = resolveProceeds(log)
      const costBasis =
        pnl && saleProceeds !== null ? Math.max(0, saleProceeds - pnl.value) : null

      if (saleProceeds !== null) {
        proceeds += saleProceeds
        row.proceeds += saleProceeds
      }
      if (costBasis !== null) {
        costBasisSold += costBasis
        row.costBasisSold += costBasis
      }
      if (pnl) {
        realizedPnL += pnl.value
        row.realizedPnL += pnl.value
        bucket.realizedPnL += pnl.value
        bucket.net += pnl.value
      }
    } else if (log.action === 'dividend') {
      dividendCount += 1
      const dividend = resolveDividend(log)
      dividendsGross += dividend.gross
      withholdingTax += dividend.tax
      dividendsNet += dividend.net
      row.dividendsGross += dividend.gross
      row.withholdingTax += dividend.tax
      row.dividendsNet += dividend.net
      bucket.dividendsNet += dividend.net
      bucket.net += dividend.net
    } else if (log.action === 'buy_more' || log.action === 'add') {
      buyCount += 1
      const amount = getLogTransactionDetails(log, usdThb).amountThbValue ?? 0
      invested += amount
      row.invested += amount
    } else {
      editCount += 1
    }
  }

  const rows = Array.from(rowsByAsset.values())
  for (const row of rows) {
    row.net = row.realizedPnL + row.dividendsNet
  }
  rows.sort((a, b) => Math.abs(b.net) - Math.abs(a.net) || b.trades - a.trades)

  const months = Array.from(monthsByKey.values()).sort((a, b) => a.key.localeCompare(b.key))

  return {
    transactionCount,
    buyCount,
    sellCount,
    dividendCount,
    editCount,
    invested,
    proceeds,
    costBasisSold,
    realizedPnL,
    realizedPnLPercent: costBasisSold > 0 ? (realizedPnL / costBasisSold) * 100 : 0,
    dividendsGross,
    withholdingTax,
    dividendsNet,
    netProfit: realizedPnL + dividendsNet,
    rows,
    months,
    firstLogAt,
    lastLogAt,
  }
}

export interface PortfolioValueChange {
  startValue: number
  endValue: number
  change: number
  /** YYYY-MM-DD of the snapshot used as the baseline */
  startDate: string
  endDate: string
}

/**
 * Change in total portfolio value between the start and end of the period, based
 * on the daily snapshots the app records. `null` when the period predates the
 * snapshot window (history is kept for the last 365 days) or when there is no
 * baseline to measure from — the caller should render "—" rather than a guess.
 */
export function portfolioValueChange(
  history: NetWorthSnapshot[] | undefined,
  period: LogPeriod,
): PortfolioValueChange | null {
  const snaps = [...(history ?? [])].sort((a, b) => a.date.localeCompare(b.date))
  if (snaps.length < 2) return null

  const range = resolvePeriodRange(period)
  const lastAtOrBefore = (bound: string | null) => {
    if (bound === null) return snaps[snaps.length - 1]
    let found: NetWorthSnapshot | null = null
    for (const snap of snaps) {
      if (snap.date <= bound) found = snap
      else break
    }
    return found
  }

  const baseline = range
    ? lastAtOrBefore(localDateStr(range.start))
    : snaps[0]
  if (!baseline) return null

  const latest = lastAtOrBefore(range ? localDateStr(range.end) : null)
  if (!latest || latest.date <= baseline.date) return null

  return {
    startValue: baseline.value,
    endValue: latest.value,
    change: latest.value - baseline.value,
    startDate: baseline.date,
    endDate: latest.date,
  }
}

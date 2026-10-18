import type { BtcLocation, CashAccount, DebtCategory, GoldLocation, Holding, HoldingLog, Liability, SpendiaryData } from '../../lib/types'
import type { DataContextValue, ImportPortfolioAndCashResult } from '../DataContext'
import { newId } from '../migrate'
import { parseCleanNumber } from '../validate'
import { localDateStr } from '../../lib/format'
import { isValidRate } from '../../lib/fx'
import { detectBankPreset, inferCashCategory } from '../../lib/calc'
import { inferAssetClass } from '../../lib/assetClass'
import { roundMoney } from '../../lib/money'

/**
 * Importing holdings, cash accounts and debts from the AI / JSON assistant: first clean up what
 * was pasted (prepareImport), then merge it into or replace the user's data (applyImport).
 */
type ImportArgs = Parameters<DataContextValue['importPortfolioAndCash']>

export interface PreparedImport {
  sanitizedHoldings: Holding[]
  sanitizedCash: CashAccount[]
  sanitizedLiabilities: Liability[]
  logEntry: HoldingLog
}

/** Clean up the pasted items; an error when nothing usable is there or a value can't be worked out. */
export function prepareImport(
  ...[payload, mode, usdThb]: [...ImportArgs, usdThb: number | null]
): { ok: true; prepared: PreparedImport } | Extract<ImportPortfolioAndCashResult, { ok: false }> {
  const rawHoldings = Array.isArray(payload.holdings) ? payload.holdings : []
  const rawCash = Array.isArray(payload.cashAccounts) ? payload.cashAccounts : []

  if (rawHoldings.length === 0 && rawCash.length === 0) {
    return { ok: false, error: 'No holdings or cash accounts found in the provided data.' }
  }

  const today = localDateStr(new Date())

  const sanitizedHoldings: Holding[] = []
  for (const item of rawHoldings) {
    if (typeof item !== 'object' || item === null) continue
    const r = item as Record<string, unknown>
    const rawTicker = typeof r.ticker === 'string' ? r.ticker.trim() : ''
    const rawName = typeof r.name === 'string' ? r.name.trim() : ''
    if (!rawTicker && !rawName) continue

    const rawCurr = typeof r.currency === 'string' ? r.currency.toUpperCase().trim() : ''
    const cleanTicker = (rawTicker || rawName).toUpperCase().replace(/\.(BK|SET|TB)$/i, '')
    const ticker = cleanTicker
    const name = rawName || rawTicker
    const assetClass = inferAssetClass(ticker, name, typeof r.assetClass === 'string' ? r.assetClass : undefined, rawCurr)
    if (!assetClass) {
      return {
        ok: false,
        error: `Couldn't tell what kind of asset "${name}" is. Add its assetClass (fund, stock, crypto, gold or real_estate) or its currency (THB or USD), then import again.`,
      }
    }
    const units = Math.max(0, parseCleanNumber(r.units ?? r.totalUnits, 0))
    const rawCost = Math.max(0, parseCleanNumber(r.avgCost ?? r.avgCostThb ?? r.avgCostUsd ?? r.price, 0))
    const rawPrice = parseCleanNumber(r.price, 0)

    // If currency is explicitly USD, or if assetClass is 'stock' and currency is not explicitly 'THB'
    const isUsd = rawCurr === 'USD' || (assetClass === 'stock' && rawCurr !== 'THB')
    // US stocks keep both a THB and a USD cost, so they need a real rate; never import with a guessed one
    if ((isUsd || assetClass === 'stock') && !isValidRate(usdThb)) {
      return {
        ok: false,
        error: `"${name}" needs a USD/THB exchange rate, and none has loaded yet. Check your internet connection, then try again.`,
      }
    }
    const fx = usdThb ?? 0

    let avgCostThb: number
    let avgCostUsd: number | undefined
    let totalThbInvested: number
    let totalUsdInvested: number | undefined
    let price: number

    const suppliedThbInvested = typeof r.totalThbInvested === 'number' && r.totalThbInvested > 0
      ? r.totalThbInvested
      : undefined
    const suppliedUsdInvested = typeof r.totalUsdInvested === 'number' && r.totalUsdInvested > 0
      ? r.totalUsdInvested
      : undefined

    if (isUsd) {
      avgCostUsd = rawCost
      avgCostThb = parseFloat((rawCost * fx).toFixed(4))
      totalUsdInvested = suppliedUsdInvested ?? parseFloat((units * rawCost).toFixed(4))
      totalThbInvested = suppliedThbInvested ?? roundMoney(units * avgCostThb)
      price = rawPrice > 0 ? roundMoney(rawPrice * fx) : avgCostThb
    } else {
      avgCostThb = rawCost
      totalThbInvested = suppliedThbInvested ?? roundMoney(units * avgCostThb)
      if (assetClass === 'stock') {
        avgCostUsd = fx > 0 ? parseFloat((rawCost / fx).toFixed(4)) : rawCost
        totalUsdInvested = suppliedUsdInvested ?? (fx > 0 ? parseFloat((totalThbInvested / fx).toFixed(4)) : 0)
      }
      price = rawPrice > 0 ? rawPrice : avgCostThb
    }

    const btcLocations = Array.isArray(r.btcLocations) ? (r.btcLocations as BtcLocation[]) : undefined
    const goldLocations = Array.isArray(r.goldLocations) ? (r.goldLocations as GoldLocation[]) : undefined

    sanitizedHoldings.push({
      id: typeof r.id === 'string' && r.id && r.id !== 'optional' ? r.id : newId(),
      ticker,
      name,
      assetClass,
      units,
      totalUnits: units,
      avgCost: avgCostThb,
      avgCostThb,
      avgCostUsd,
      totalThbInvested,
      totalUsdInvested,
      price,
      // No price in the file: counted at cost, marked as having no real price
      ...(rawPrice > 0 ? {} : { placeholderPrice: price }),
      updatedAt: today,
      ...(btcLocations ? { btcLocations } : {}),
      ...(goldLocations ? { goldLocations } : {}),
    })
  }

  const sanitizedCash: CashAccount[] = []
  for (const item of rawCash) {
    if (typeof item !== 'object' || item === null) continue
    const r = item as Record<string, unknown>
    const rawName = typeof r.name === 'string' ? r.name.trim() : ''
    if (!rawName) continue

    const balance = parseCleanNumber(r.balance, 0)
    const rawCurr = typeof r.currency === 'string' ? r.currency.toUpperCase().trim() : 'THB'
    const currency: 'THB' | 'USD' = rawCurr === 'USD' ? 'USD' : 'THB'
    const preset = detectBankPreset(rawName)
    const rawCat = typeof r.category === 'string' ? r.category.toLowerCase().trim() : ''
    const category = (rawCat === 'locked'
      ? 'locked'
      : rawCat === 'spending'
        ? 'spending'
        : inferCashCategory(rawName)) as CashAccount['category']

    sanitizedCash.push({
      id: typeof r.id === 'string' && r.id && r.id !== 'optional' ? r.id : newId(),
      name: rawName,
      balance,
      currency,
      bankPreset: preset?.id,
      category,
    })
  }

  const rawLiabilities = Array.isArray(payload.liabilities) ? payload.liabilities : []
  const sanitizedLiabilities: Liability[] = []
  for (const item of rawLiabilities) {
    if (typeof item !== 'object' || item === null) continue
    const r = item as Record<string, unknown>
    const rawName = typeof r.name === 'string' ? r.name.trim() : ''
    if (!rawName) continue

    const balance = parseCleanNumber(r.balance, 0)
    const rawCat = typeof r.category === 'string' ? r.category.toLowerCase().trim() : 'other'
    const validCategories: DebtCategory[] = ['installment', 'credit_card', 'mortgage', 'auto_loan', 'personal_loan', 'student_loan', 'other']
    const category: DebtCategory = validCategories.includes(rawCat as DebtCategory) ? (rawCat as DebtCategory) : 'other'

    sanitizedLiabilities.push({
      id: typeof r.id === 'string' && r.id && r.id !== 'optional' ? r.id : newId(),
      name: rawName,
      category,
      balance,
      interestRate: typeof r.interestRate === 'number' ? r.interestRate : undefined,
      monthlyPayment: typeof r.monthlyPayment === 'number' ? r.monthlyPayment : undefined,
      lender: typeof r.lender === 'string' ? r.lender : undefined,
      dueDay: typeof r.dueDay === 'number' ? r.dueDay : undefined,
      note: typeof r.note === 'string' ? r.note : undefined,
      isInstallment: typeof r.isInstallment === 'boolean' ? r.isInstallment : (category === 'installment'),
      totalInstallments: typeof r.totalInstallments === 'number' ? r.totalInstallments : undefined,
      paidInstallments: typeof r.paidInstallments === 'number' ? r.paidInstallments : undefined,
      createdAt: today,
      updatedAt: today,
    })
  }

  if (sanitizedHoldings.length === 0 && sanitizedCash.length === 0 && sanitizedLiabilities.length === 0) {
    return { ok: false, error: 'Could not extract any valid holdings, cash accounts, or liabilities. Please check your JSON format.' }
  }

  const summaryParts = [
    sanitizedHoldings.length > 0 ? `${sanitizedHoldings.length} holdings` : '',
    sanitizedCash.length > 0 ? `${sanitizedCash.length} cash accounts` : '',
    sanitizedLiabilities.length > 0 ? `${sanitizedLiabilities.length} liabilities` : '',
  ].filter(Boolean).join(', ')

  const logEntry: HoldingLog = {
    id: newId(),
    timestamp: new Date().toISOString(),
    action: 'add',
    holdingName: `AI Import (${summaryParts})`,
    ticker: 'IMPORT',
    assetClass: 'stock',
    note: `Imported via AI/JSON Assistant (${mode === 'replace' ? 'Replaced' : 'Merged'})`,
  }

  return { ok: true, prepared: { sanitizedHoldings, sanitizedCash, sanitizedLiabilities, logEntry } }
}

/** Merge the cleaned-up items into the data (matching by ticker / name), or replace them. */
export function applyImport(
  prev: SpendiaryData,
  { sanitizedHoldings, sanitizedCash, sanitizedLiabilities, logEntry }: PreparedImport,
  mode: ImportArgs[1],
): SpendiaryData {
  let nextHoldings: Holding[] = []
  if (mode === 'replace') {
    nextHoldings = sanitizedHoldings
  } else {
    const existing = [...prev.holdings]
    for (const h of sanitizedHoldings) {
      const idx = existing.findIndex(
        (e) => e.ticker.toUpperCase() === h.ticker.toUpperCase() && e.assetClass === h.assetClass,
      )
      if (idx >= 0) {
        existing[idx] = { ...existing[idx], ...h, id: existing[idx].id }
      } else {
        existing.push(h)
      }
    }
    nextHoldings = existing
  }

  let nextCash: CashAccount[] = []
  if (mode === 'replace') {
    nextCash = sanitizedCash
  } else {
    const existing = [...prev.cashAccounts]
    for (const c of sanitizedCash) {
      const idx = existing.findIndex((e) => e.name.toLowerCase() === c.name.toLowerCase())
      if (idx >= 0) {
        existing[idx] = { ...existing[idx], ...c, id: existing[idx].id }
      } else {
        existing.push(c)
      }
    }
    nextCash = existing
  }

  let nextLiabilities: Liability[] = []
  if (mode === 'replace') {
    nextLiabilities = sanitizedLiabilities
  } else {
    const existing = [...(prev.liabilities ?? [])]
    for (const l of sanitizedLiabilities) {
      const idx = existing.findIndex((e) => e.name.toLowerCase() === l.name.toLowerCase())
      if (idx >= 0) {
        existing[idx] = { ...existing[idx], ...l, id: existing[idx].id }
      } else {
        existing.push(l)
      }
    }
    nextLiabilities = existing
  }

  return {
    ...prev,
    holdings: nextHoldings,
    cashAccounts: nextCash,
    liabilities: (sanitizedLiabilities.length > 0 || mode === 'replace') ? nextLiabilities : (prev.liabilities ?? []),
    holdingLogs: [logEntry, ...(prev.holdingLogs ?? [])],
  }
}

import type { CashAccount, DebtCategory, Holding, HoldingLocation, HoldingLog, Liability, SpendiaryData } from '../../lib/types'
import { addToLocation, hasLocations, roundQty, sumQty, withLocations } from '../../lib/locations'
import { upgradeHolding } from '../legacyLocations'
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

    const holding: Holding = {
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
    }
    const locations = importedLocations(r, holding)
    const withLocs = locations ? withLocations(holding, locations) : holding

    // The same ticker held at several brokers / wallets: one holding with one location per row
    const twin = locations
      ? sanitizedHoldings.findIndex((e) => e.assetClass === assetClass && e.ticker.toUpperCase() === ticker.toUpperCase() && hasLocations(e))
      : -1
    if (twin >= 0) {
      const merged = (withLocs.locations ?? []).reduce(
        (acc, l) => addToLocation(assetClass, acc, { name: l.name }, l.qty, l.thbSpent, l.usdSpent).locations,
        sanitizedHoldings[twin].locations ?? [],
      )
      sanitizedHoldings[twin] = withLocations(sanitizedHoldings[twin], merged)
    } else {
      sanitizedHoldings.push(withLocs)
    }
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
        const merged: Holding = { ...existing[idx], ...h, id: existing[idx].id }
        // Locations kept from before must still add up to the imported units, or they would contradict them
        if (!h.locations && hasLocations(merged) && Math.abs(sumQty(merged.assetClass, merged.locations ?? []) - merged.units) > 1e-6) {
          delete merged.locations
        }
        existing[idx] = merged
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

/**
 * Where an imported holding is kept, when the row says so:
 * `locations` [{ name, qty, thbSpent, usdSpent }], the old `btcLocations` / `goldLocations`,
 * or a single `broker` / `location` name holding the whole row.
 * Only kept when the quantities add up to the row's units; otherwise the units win and locations are dropped.
 */
function importedLocations(r: Record<string, unknown>, h: Holding): HoldingLocation[] | undefined {
  const ac = h.assetClass
  let locs: HoldingLocation[] | undefined
  if (Array.isArray(r.locations)) {
    locs = r.locations
      .filter((l): l is Record<string, unknown> => typeof l === 'object' && l !== null && typeof (l as { name?: unknown }).name === 'string')
      .map((l) => {
        const qty = roundQty(ac, parseCleanNumber(l.qty ?? l.units ?? l.shares, 0))
        const share = h.units > 0 ? qty / h.units : 0
        const usd = typeof l.usdSpent === 'number' ? l.usdSpent : h.totalUsdInvested !== undefined ? h.totalUsdInvested * share : undefined
        return {
          id: newId(),
          name: String(l.name).trim(),
          qty,
          thbSpent: typeof l.thbSpent === 'number' ? l.thbSpent : roundMoney((h.totalThbInvested ?? 0) * share),
          ...(ac === 'stock' && usd !== undefined ? { usdSpent: usd } : {}),
        }
      })
      .filter((l) => l.name && l.qty > 0)
  } else if (Array.isArray(r.btcLocations) || Array.isArray(r.goldLocations)) {
    locs = upgradeHolding({ ...h, btcLocations: r.btcLocations, goldLocations: r.goldLocations } as Holding).locations
  } else {
    const name = typeof r.broker === 'string' ? r.broker.trim() : typeof r.location === 'string' ? r.location.trim() : ''
    if (name && h.units > 0) {
      locs = [{
        id: newId(),
        name,
        qty: roundQty(ac, h.units),
        thbSpent: h.totalThbInvested ?? 0,
        ...(ac === 'stock' && h.totalUsdInvested !== undefined ? { usdSpent: h.totalUsdInvested } : {}),
      }]
    }
  }
  if (!locs || locs.length === 0) return undefined
  return Math.abs(sumQty(ac, locs) - h.units) <= Math.max(1e-6, h.units * 1e-6) ? locs : undefined
}

import type { AssetClass, CashAccount, CashAccountCategory, CashPayoutSchedule, DcaPlan, Holding, SpendiaryData, Transfer } from './types'
import { daysUntil, localDateStr } from './format'

export interface HoldingMetrics extends Holding {
  marketValue: number
  costBasis: number
  pnl: number
  pnlPct: number
}

/**
 * Apply a "buy more" purchase to a holding: units grow and the average cost
 * becomes the weighted average of the old basis and the new lot. The purchase
 * price also becomes the latest filled price.
 */
export function applyBuy(
  h: Holding,
  unitsBought: number,
  pricePerUnit: number,
  on = new Date(),
): Pick<Holding, 'units' | 'avgCost' | 'price' | 'updatedAt'> {
  const newUnits = h.units + unitsBought
  const newBasis = h.units * h.avgCost + unitsBought * pricePerUnit
  return {
    units: newUnits,
    avgCost: newUnits > 0 ? newBasis / newUnits : pricePerUnit,
    price: pricePerUnit,
    updatedAt: localDateStr(on),
  }
}

export function holdingMetrics(h: Holding): HoldingMetrics {
  const marketValue = h.units * h.price
  const costBasis = h.totalThbInvested ?? (h.units * h.avgCost)
  const pnl = marketValue - costBasis
  const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0
  return { ...h, marketValue, costBasis, pnl, pnlPct }
}

export const ASSET_META: Record<
  AssetClass,
  { label: string; plural: string; color: string; cssVar: string }
> = {
  fund: { label: 'Thai Fund', plural: 'Thai Funds', color: '#6366f1', cssVar: 'var(--color-funds)' },
  stock: { label: 'US Stock', plural: 'US Stocks', color: '#0ea5e9', cssVar: 'var(--color-stocks)' },
  crypto: { label: 'Bitcoin', plural: 'Bitcoin', color: '#f59e0b', cssVar: 'var(--color-crypto)' },
  gold: { label: 'Gold', plural: 'Gold', color: '#ca8a04', cssVar: 'var(--color-gold)' },
  cash: { label: 'Cash', plural: 'Cash', color: '#10b981', cssVar: 'var(--color-cash)' },
}

export interface Allocation {
  assetClass: AssetClass
  value: number
  pct: number
}

export function portfolioValue(holdings: Holding[]): number {
  return holdings.reduce((sum, h) => sum + h.units * h.price, 0)
}

export function portfolioCost(holdings: Holding[]): number {
  return holdings.reduce((sum, h) => sum + (h.totalThbInvested ?? (h.units * h.avgCost)), 0)
}

export function allocations(holdings: Holding[]): Allocation[] {
  const total = portfolioValue(holdings)
  const byClass: Record<string, number> = {}
  for (const h of holdings) {
    byClass[h.assetClass] = (byClass[h.assetClass] ?? 0) + h.units * h.price
  }
  return (Object.keys(byClass) as AssetClass[])
    .map((assetClass) => ({
      assetClass,
      value: byClass[assetClass],
      pct: total > 0 ? (byClass[assetClass] / total) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value)
}

export interface PortfolioSummary {
  value: number
  cost: number
  pnl: number
  pnlPct: number
}

export function portfolioSummary(holdings: Holding[]): PortfolioSummary {
  const value = portfolioValue(holdings)
  const cost = portfolioCost(holdings)
  const pnl = value - cost
  return { value, cost, pnl, pnlPct: cost > 0 ? (pnl / cost) * 100 : 0 }
}

/* ----------------------------- Gold Calculations ----------------------------- */

/** 1 บาททองคำ (ทองคำแท่ง 96.5%) = 15.244 กรัม */
export const GRAMS_PER_BAHT_GOLD = 15.244

/** 1 Troy Ounce = 31.1035 กรัม (ทองคำสากล 99.99% 24K) */
export const TROY_OUNCE_GRAMS = 31.1035

/** ความบริสุทธิ์ทองคำมาตรฐานไทย (96.5%) */
export const THAI_GOLD_PURITY = 0.965

export function gramsToBahtGold(grams: number): number {
  return grams / GRAMS_PER_BAHT_GOLD
}

export function bahtGoldToGrams(baht: number): number {
  return baht * GRAMS_PER_BAHT_GOLD
}

export function goldCostPerBaht(thbSpent: number, grams: number): number {
  if (grams <= 0) return 0
  return (thbSpent / grams) * GRAMS_PER_BAHT_GOLD
}

export function goldPricePerGramFromBaht(pricePerBaht: number): number {
  return pricePerBaht / GRAMS_PER_BAHT_GOLD
}

export function goldPricePerBahtFromGram(pricePerGram: number): number {
  return pricePerGram * GRAMS_PER_BAHT_GOLD
}

/**
 * แปลงต้นทุนหรือราคาทองคำไทย 96.5% (THB/g) เป็นราคาทองคำโลก Spot XAU/USD ($/oz 99.99%)
 */
export function goldThbPerGramToXauUsd(thbPerGram965: number, usdThbRate: number): number {
  if (thbPerGram965 <= 0 || usdThbRate <= 0) return 0
  const thbPerGramPure = thbPerGram965 / THAI_GOLD_PURITY
  const thbPerOz = thbPerGramPure * TROY_OUNCE_GRAMS
  return thbPerOz / usdThbRate
}

/**
 * แปลงต้นทุนหรือราคาทองคำไทย 96.5% (THB/บาททองคำ) เป็นราคาทองคำโลก Spot XAU/USD ($/oz 99.99%)
 */
export function goldThbPerBahtToXauUsd(thbPerBaht: number, usdThbRate: number): number {
  if (thbPerBaht <= 0 || usdThbRate <= 0) return 0
  return goldThbPerGramToXauUsd(thbPerBaht / GRAMS_PER_BAHT_GOLD, usdThbRate)
}

/**
 * แปลงราคาทองคำโลก Spot XAU/USD ($/oz) เป็นราคาทองคำไทย 96.5% (THB/บาททองคำ)
 */
export function xauUsdToThaiGoldPricePerBaht(xauUsd: number, usdThbRate: number): number {
  if (xauUsd <= 0 || usdThbRate <= 0) return 0
  const pricePerGramPureThb = (xauUsd * usdThbRate) / TROY_OUNCE_GRAMS
  const pricePerGram965Thb = pricePerGramPureThb * THAI_GOLD_PURITY
  return pricePerGram965Thb * GRAMS_PER_BAHT_GOLD
}

/* ----------------------------- Bitcoin Calculations ----------------------------- */

export const SATS_PER_BTC = 100_000_000

export function satsToBtc(sats: number): number {
  return sats / SATS_PER_BTC
}

export function btcToSats(btc: number): number {
  return Math.round(btc * SATS_PER_BTC)
}

export function btcCostPerCoin(thbSpent: number, satoshi: number): number {
  if (satoshi <= 0) return 0
  return (thbSpent / satoshi) * SATS_PER_BTC
}

/* ----------------------------- DCA ----------------------------- */

/** Normalise a plan's per-period amount to a monthly equivalent for summary stats. */
export function planMonthlyEquivalent(plan: DcaPlan, now = new Date()): number {
  const freq = plan.frequency ?? 'monthly'
  if (freq === 'monthly') return plan.monthlyAmount
  if (freq === 'daily') {
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    return plan.monthlyAmount * daysInMonth
  }
  // weekly — ~4.33 weeks per month
  return plan.monthlyAmount * 4.33
}

/** Total monthly-equivalent DCA across all plans. */
export function dcaPerMonth(plans: DcaPlan[], now = new Date()): number {
  return plans.reduce((s, p) => s + planMonthlyEquivalent(p, now), 0)
}

/** How many times this plan has executed so far this calendar month. */
export function planExecutionsThisMonth(plan: DcaPlan, now = new Date()): number {
  const freq = plan.frequency ?? 'monthly'
  const today = now.getDate()

  if (freq === 'daily') return today  // once per day

  if (freq === 'weekly') {
    // dayOfMonth stores 1=Mon…7=Sun; count occurrences in month so far
    const targetDow = plan.dayOfMonth % 7  // convert to JS 0=Sun…6=Sat (7→0)
    let count = 0
    for (let d = 1; d <= today; d++) {
      const dow = new Date(now.getFullYear(), now.getMonth(), d).getDay()
      if (dow === targetDow) count++
    }
    return count
  }

  // monthly — 1 if buy day has passed
  return plan.dayOfMonth <= today ? 1 : 0
}

/** Total executions planned for the full calendar month. */
export function planTotalExecutionsInMonth(plan: DcaPlan, now = new Date()): number {
  const freq = plan.frequency ?? 'monthly'
  if (freq === 'daily') {
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  }
  if (freq === 'weekly') {
    const targetDow = plan.dayOfMonth % 7
    const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    let count = 0
    for (let d = 1; d <= days; d++) {
      if (new Date(now.getFullYear(), now.getMonth(), d).getDay() === targetDow) count++
    }
    return count
  }
  return 1
}

/** Has the user already confirmed OR skipped a buy for the current period? */
export function isConfirmedForPeriod(plan: DcaPlan, now = new Date()): boolean {
  const allDates = [...(plan.confirmedDates ?? []), ...(plan.skippedDates ?? [])]
  if (allDates.length === 0) return false
  const freq = plan.frequency ?? 'monthly'
  if (freq === 'daily') {
    const todayStr = localDateStr(now)
    return allDates.some((d) => (d.includes('T') ? d.slice(0, 10) : d) === todayStr)
  }
  if (freq === 'weekly') {
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7))
    weekStart.setHours(0, 0, 0, 0)
    return allDates.some((d) => new Date(d) >= weekStart)
  }
  // monthly
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return allDates.some((d) => (d.includes('T') ? d.slice(0, 10) : d).startsWith(ym))
}

/** Was this period explicitly skipped (not confirmed)? */
export function isSkippedForPeriod(plan: DcaPlan, now = new Date()): boolean {
  const dates = plan.skippedDates ?? []
  if (dates.length === 0) return false
  const freq = plan.frequency ?? 'monthly'
  if (freq === 'daily') {
    const todayStr = localDateStr(now)
    return dates.some((d) => (d.includes('T') ? d.slice(0, 10) : d) === todayStr)
  }
  if (freq === 'weekly') {
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7))
    weekStart.setHours(0, 0, 0, 0)
    return dates.some((d) => new Date(d) >= weekStart)
  }
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return dates.some((d) => (d.includes('T') ? d.slice(0, 10) : d).startsWith(ym))
}

/**
 * Has the current period's buy day actually arrived yet?
 * - daily:   always true
 * - weekly:  today's DOW >= target DOW within the current Mon–Sun week
 * - monthly: today's date >= dayOfMonth
 */
export function buyDayPassedThisPeriod(plan: DcaPlan, now = new Date()): boolean {
  const freq = plan.frequency ?? 'monthly'
  if (freq === 'daily') return true
  if (freq === 'weekly') {
    const targetDow = plan.dayOfMonth % 7   // 0=Sun … 6=Sat (JS convention)
    const todayDow  = now.getDay()
    // Convert both to Mon=0 scale so Mon<Tue<…<Sun
    const toMonScale = (d: number) => (d + 6) % 7
    return toMonScale(todayDow) >= toMonScale(targetDow)
  }
  return plan.dayOfMonth <= now.getDate()
}

/**
 * Is today the scheduled buy day for this plan?
 * - daily:   always true
 * - weekly:  today's DOW equals the target DOW
 * - monthly: today's date equals dayOfMonth
 */
export function isBuyDayToday(plan: DcaPlan, now = new Date()): boolean {
  const freq = plan.frequency ?? 'monthly'
  if (freq === 'daily') return true
  if (freq === 'weekly') {
    const targetDow = plan.dayOfMonth % 7
    return now.getDay() === targetDow
  }
  return plan.dayOfMonth === now.getDate()
}

/**
 * Has the buy day strictly passed before today within the current period?
 * - daily:   never overdue from prior days in current period
 * - weekly:  today's DOW strictly after target DOW (within Mon–Sun week)
 * - monthly: today's date strictly after dayOfMonth
 */
export function isBuyDayOverdue(plan: DcaPlan, now = new Date()): boolean {
  const freq = plan.frequency ?? 'monthly'
  if (freq === 'daily') return false
  if (freq === 'weekly') {
    const targetDow = plan.dayOfMonth % 7
    const todayDow = now.getDay()
    const toMonScale = (d: number) => (d + 6) % 7
    return toMonScale(todayDow) > toMonScale(targetDow)
  }
  return plan.dayOfMonth < now.getDate()
}

/** Should the "Confirm buy" button be shown? Buy day passed THIS period + not yet confirmed/skipped. */
export function shouldConfirmBuy(plan: DcaPlan, now = new Date()): boolean {
  return buyDayPassedThisPeriod(plan, now) && !isConfirmedForPeriod(plan, now)
}

/** @deprecated use planExecutionsThisMonth — kept for compatibility */
export function planBoughtThisMonth(plan: DcaPlan, now = new Date()): boolean {
  return planExecutionsThisMonth(plan, now) > 0
}

/** Next date this plan will execute. */
export function nextBuyDate(plan: DcaPlan, now = new Date()): Date {
  const freq = plan.frequency ?? 'monthly'
  if (freq === 'daily') {
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow
  }
  if (freq === 'weekly') {
    const targetDow = plan.dayOfMonth % 7
    const d = new Date(now)
    d.setDate(d.getDate() + 1)
    while (d.getDay() !== targetDow) d.setDate(d.getDate() + 1)
    return d
  }
  // monthly
  const day = Math.min(Math.max(plan.dayOfMonth, 1), 28)
  const next = new Date(now.getFullYear(), now.getMonth(), day)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (next.getTime() <= today.getTime()) next.setMonth(next.getMonth() + 1)
  return next
}

export interface DcaMonth {
  total: number
  /** Amount whose buy day has already passed this month */
  invested: number
  /** Amount still scheduled to buy later this month */
  upcoming: number
  pct: number
  count: number
}

/** Date-aware view of the current month's DCA progress. */
export function dcaThisMonth(plans: DcaPlan[], now = new Date()): DcaMonth {
  let total = 0, invested = 0
  for (const p of plans) {
    const execTotal = planTotalExecutionsInMonth(p, now)
    const execDone  = planExecutionsThisMonth(p, now)
    total    += p.monthlyAmount * execTotal
    invested += p.monthlyAmount * execDone
  }
  return {
    total,
    invested,
    upcoming: Math.max(total - invested, 0),
    pct: total > 0 ? (invested / total) * 100 : 0,
    count: plans.length,
  }
}

/**
 * Sort DCA plans by priority:
 * 1. Actionable plans (strictly overdue, then due today):
 *    - Strictly overdue plans (buy day passed before today and not confirmed/skipped) come first.
 *    - Followed by plans due today.
 *    - Followed by upcoming plans sorted by days until due ascending (tomorrow, in 2 days, etc.).
 * 2. Value:
 *    - When urgency is tied (both overdue, both due today, or same days until due), sort by monthly amount descending.
 */
export function sortDcaPlans(plans: DcaPlan[], now = new Date()): DcaPlan[] {
  return [...plans].sort((a, b) => {
    const actionableA = shouldConfirmBuy(a, now)
    const actionableB = shouldConfirmBuy(b, now)

    // 1. Actionable plans come first
    if (actionableA && !actionableB) return -1
    if (!actionableA && actionableB) return 1

    if (actionableA && actionableB) {
      const overdueA = isBuyDayOverdue(a, now)
      const overdueB = isBuyDayOverdue(b, now)
      if (overdueA && !overdueB) return -1
      if (!overdueA && overdueB) return 1

      if (b.monthlyAmount !== a.monthlyAmount) {
        return b.monthlyAmount - a.monthlyAmount
      }
      return a.name.localeCompare(b.name)
    }

    // Neither is actionable -> near to the due (days until due date ascending)
    const daysA = daysUntil(localDateStr(nextBuyDate(a, now)), now)
    const daysB = daysUntil(localDateStr(nextBuyDate(b, now)), now)

    if (daysA !== daysB) {
      return daysA - daysB
    }

    // Same days until due -> priority 2: Value (monthlyAmount descending)
    if (b.monthlyAmount !== a.monthlyAmount) {
      return b.monthlyAmount - a.monthlyAmount
    }

    return a.name.localeCompare(b.name)
  })
}

/* --------------------------- Transfers -------------------------- */

export function remainingTransfers(t: Transfer): number {
  return Math.max(t.total - t.completed, 0)
}

export function transferProgress(t: Transfer): number {
  return t.total > 0 ? (t.completed / t.total) * 100 : 0
}

export const FREQUENCY_LABEL: Record<Transfer['frequency'], string> = {
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
}

/* ----------------------------- Cash ---------------------------- */

export const CASH_CATEGORIES: Record<
  CashAccountCategory,
  { label: string; labelTh: string; color: string; icon: string; desc: string }
> = {
  spending: { label: 'Spending & Bills', labelTh: 'ใช้จ่าย/หมุนเวียน', color: '#10b981', icon: '🟢', desc: 'เงินใช้จ่ายประจำวัน และตัดบิล' },
  emergency: { label: 'Emergency Fund', labelTh: 'สำรองฉุกเฉิน', color: '#f59e0b', icon: '🛡️', desc: 'เงินสำรอง 3-12 เดือน ยามฉุกเฉิน' },
  invest: { label: 'Investment Powder', labelTh: 'เงินรอลงทุน', color: '#3b82f6', icon: '🎯', desc: 'เงินพักรอซื้อหุ้น กองทุน หรือเหรียญ' },
  locked: { label: 'Committed / Locked', labelTh: 'ออมระยะยาว/มีเงื่อนไข', color: '#8b5cf6', icon: '🔒', desc: 'สหกรณ์, กองทุนสำรองเลี้ยงชีพ (PVD), ฝากประจำ' },
}

export interface BankPreset {
  id: string
  name: string
  color: string
  bg: string
  keywords: string[]
}

export const BANK_PRESETS: BankPreset[] = [
  { id: 'kept', name: 'Kept', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', keywords: ['kept', 'grow', 'fun', 'together'] },
  { id: 'dime', name: 'Dime', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', keywords: ['dime', 'kkp', 'fcd'] },
  { id: 'truemoney', name: 'TrueMoney', color: '#ea580c', bg: 'rgba(234, 88, 12, 0.15)', keywords: ['true', 'truemoney', 'tmn'] },
  { id: 'kbank', name: 'KBank', color: '#16a34a', bg: 'rgba(22, 163, 74, 0.15)', keywords: ['kbank', 'กสิกร', 'make'] },
  { id: 'scb', name: 'SCB', color: '#7c3aed', bg: 'rgba(124, 58, 237, 0.15)', keywords: ['scb', 'ไทยพาณิชย์', 'easy'] },
  { id: 'ttb', name: 'ttb', color: '#2563eb', bg: 'rgba(37, 99, 235, 0.15)', keywords: ['ttb', 'ทีทีบี', 'me'] },
  { id: 'ktb', name: 'Krungthai', color: '#0284c7', bg: 'rgba(2, 132, 199, 0.15)', keywords: ['ktb', 'กรุงไทย', 'เป๋าตัง'] },
  { id: 'bbl', name: 'BBL', color: '#1e3a8a', bg: 'rgba(30, 58, 138, 0.15)', keywords: ['bbl', 'กรุงเทพ', 'bangkok'] },
  { id: 'sahakorn', name: 'สหกรณ์', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.15)', keywords: ['สหกรณ์', 'sahakorn', 'coop'] },
  { id: 'pvd', name: 'PVD / กองทุนสำรองฯ', color: '#64748b', bg: 'rgba(100, 116, 139, 0.15)', keywords: ['สำรองเลี้ยงชีพ', 'pvd', 'provident'] },
]

export function detectBankPreset(name: string): BankPreset | undefined {
  const s = name.toLowerCase().trim()
  if (!s) return undefined
  for (const p of BANK_PRESETS) {
    if (p.keywords.some((k) => s.includes(k))) {
      return p
    }
  }
  return undefined
}

export function inferCashCategory(name: string): CashAccountCategory {
  const s = name.toLowerCase().trim()
  if (s.includes('สำรองเลี้ยงชีพ') || s.includes('pvd') || s.includes('สหกรณ์') || s.includes('ประจำ') || s.includes('locked')) {
    return 'locked'
  }
  if (s.includes('dime') || s.includes('หุ้น') || s.includes('fcd') || s.includes('invest') || s.includes('crypto')) {
    return 'invest'
  }
  if (s.includes('kept') || s.includes('ฉุกเฉิน') || s.includes('emergency') || s.includes('click') || s.includes('reserve')) {
    return 'emergency'
  }
  return 'spending'
}

export function totalCash(data: SpendiaryData, usdThb?: number | null): number {
  const rate = usdThb && usdThb > 0 ? usdThb : 35
  return data.cashAccounts.reduce((sum, a) => {
    const isUsd = a.currency === 'USD'
    const thbVal = isUsd ? a.balance * rate : a.balance
    return sum + thbVal
  }, 0)
}

export function calculateAnnualCashInterest(accounts: CashAccount[], usdThb?: number | null): number {
  const rate = usdThb && usdThb > 0 ? usdThb : 35
  return accounts.reduce((sum, a) => {
    if (!a.interestRate || a.interestRate <= 0) return sum
    const thbVal = a.currency === 'USD' ? a.balance * rate : a.balance
    return sum + (thbVal * (a.interestRate / 100))
  }, 0)
}

export function calculateMonthlyCashInterest(
  accounts: CashAccount[],
  usdThb?: number | null,
): {
  totalAnnual: number
  byMonth: Record<number, number>
} {
  const rate = usdThb && usdThb > 0 ? usdThb : 35
  const byMonth: Record<number, number> = {
    1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0,
  }
  let totalAnnual = 0

  for (const a of accounts) {
    if (!a.interestRate || a.interestRate <= 0) continue
    const thbVal = a.currency === 'USD' ? a.balance * rate : a.balance
    const annualInterest = thbVal * (a.interestRate / 100)
    totalAnnual += annualInterest

    const schedule = a.payoutSchedule ?? (a.payoutMonths && a.payoutMonths.length > 0 ? 'custom' : 'monthly')
    let months: number[] = []

    if (schedule === 'monthly') {
      months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    } else if (schedule === 'semi_annual') {
      months = [6, 12]
    } else if (schedule === 'annual') {
      months = [a.payoutMonths?.[0] ?? 12]
    } else if (schedule === 'custom') {
      months = a.payoutMonths && a.payoutMonths.length > 0 ? a.payoutMonths : [12]
    }

    if (months.length > 0) {
      const perPayout = annualInterest / months.length
      for (const m of months) {
        if (m >= 1 && m <= 12) {
          byMonth[m] = (byMonth[m] ?? 0) + perPayout
        }
      }
    }
  }

  return { totalAnnual, byMonth }
}

export function getCashLiquidityBreakdown(
  accounts: CashAccount[],
  usdThb?: number | null,
): {
  spending: number
  emergency: number
  invest: number
  locked: number
  total: number
} {
  const rate = usdThb && usdThb > 0 ? usdThb : 35
  const res = { spending: 0, emergency: 0, invest: 0, locked: 0, total: 0 }

  for (const a of accounts) {
    const thbVal = a.currency === 'USD' ? a.balance * rate : a.balance
    const cat = a.category ?? inferCashCategory(a.name)
    res[cat] = (res[cat] ?? 0) + thbVal
    res.total += thbVal
  }

  return res
}

/* --------------------------- Net worth -------------------------- */

/** Net worth is always derived — cash on hand plus the live portfolio value. */
export function netWorth(data: SpendiaryData, usdThb?: number | null): number {
  return totalCash(data, usdThb) + portfolioValue(data.holdings)
}

/** Helper to match a DCA plan to an existing holding in the portfolio */
export function findMatchingHolding(
  holdings: Holding[],
  plan: { holdingId?: string; name: string; assetClass?: AssetClass },
): Holding | null {
  if (plan.holdingId) {
    const byId = holdings.find((h) => h.id === plan.holdingId)
    if (byId) return byId
  }

  const pName = plan.name.toLowerCase().trim()
  const pNorm = pName.replace(/[^a-z0-9]/g, '')

  // 1. Exact match on ticker (case insensitive) or name
  const exact = holdings.find(
    (h) => h.ticker.toLowerCase() === pName || h.name.toLowerCase() === pName,
  )
  if (exact) return exact

  // 2. Normalized string match (handles symbols like S&P vs SP, hyphens, spaces)
  const normMatch = holdings.find((h) => {
    const hNameNorm = h.name.toLowerCase().replace(/[^a-z0-9]/g, '')
    const hTickerNorm = h.ticker.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (!pNorm || (!hNameNorm && !hTickerNorm)) return false

    if (hNameNorm === pNorm || hTickerNorm === pNorm) return true
    if (pNorm.length >= 3 && (hNameNorm.includes(pNorm) || hTickerNorm.includes(pNorm))) return true
    if (hTickerNorm.length >= 3 && pNorm.includes(hTickerNorm)) return true
    return false
  })
  if (normMatch) return normMatch

  // 3. Fallback to single holding in same assetClass if specified
  if (plan.assetClass) {
    const sameClass = holdings.filter((h) => h.assetClass === plan.assetClass)
    if (sameClass.length === 1) return sameClass[0]
  }

  return null
}

export function upsert<T extends { id: string }>(list: T[], item: Omit<T, 'id'> & { id?: string }): T[] {
  const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
  const id = item.id ?? newId()
  const exists = list.some((x) => x.id === id)
  const fullItem = { ...item, id } as T
  return exists ? list.map((x) => (x.id === id ? fullItem : x)) : [...list, fullItem]
}

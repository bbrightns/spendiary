import { describe, expect, it } from 'vitest'
import {
  allocations,
  applyBuy,
  bahtGoldToGrams,
  btcCostPerCoin,
  btcToSats,
  buyDayPassedThisPeriod,
  calculateAnnualCashInterest,
  calculateMonthlyCashInterest,
  dcaThisMonth,
  findMatchingHolding,
  getCashLiquidityBreakdown,
  getEffectiveDayOfMonth,
  getLiabilityDueStatus,
  goldCostPerBaht,
  goldThbPerBahtToXauUsd,
  gramsToBahtGold,
  holdingMetrics,
  isBuyDayOverdue,
  isBuyDayToday,
  isConfirmedForPeriod,
  netWorth,
  nextBuyDate,
  planExecutionsThisMonth,
  planMonthlyEquivalent,
  planTotalExecutionsInMonth,
  portfolioCost,
  portfolioValue,
  satsToBtc,
  shouldConfirmBuy,
  sortDcaPlans,
  totalLiabilities,
  totalMonthlyDebtPayment,
  upsert,
  xauUsdToThaiGoldPricePerBaht,
} from './calc'
import type { CashAccount, DcaPlan, Holding, Liability, SpendiaryData } from './types'

// Wednesday 14 Oct 2026. Mondays that month: 5, 12, 19, 26. Fridays: 2, 9, 16, 23, 30.
const NOW = new Date(2026, 9, 14, 10, 0)

const holding = (over: Partial<Holding>): Holding =>
  ({ id: 'h', name: 'H', ticker: 'H', assetClass: 'fund', units: 10, avgCost: 100, price: 100, ...over }) as Holding

const plan = (over: Partial<DcaPlan>): DcaPlan =>
  ({ id: 'p', name: 'P', assetClass: 'fund', frequency: 'monthly', monthlyAmount: 1000, dayOfMonth: 1, ...over }) as DcaPlan

const debt = (over: Partial<Liability>): Liability =>
  ({ id: 'l', name: 'L', category: 'personal_loan', balance: 10_000, monthlyPayment: 1000, ...over }) as Liability

const account = (over: Partial<CashAccount>): CashAccount =>
  ({ id: 'c', name: 'Acc', balance: 0, currency: 'THB', category: 'spending', ...over }) as CashAccount

const data = (over: Partial<SpendiaryData>): SpendiaryData =>
  ({ holdings: [], cashAccounts: [], liabilities: [], spendCards: [], ...over }) as unknown as SpendiaryData

/* ----------------------------- Holdings ----------------------------- */

describe('holdingMetrics', () => {
  it('uses units × avgCost as the cost when nothing else is recorded', () => {
    const m = holdingMetrics(holding({ units: 10, avgCost: 100, price: 150 }))
    expect(m.marketValue).toBe(1500)
    expect(m.costBasis).toBe(1000)
    expect(m.pnl).toBe(500)
    expect(m.pnlPct).toBe(50)
    expect(m.priced).toBe(true)
  })

  it('prefers the THB really paid over units × avgCost', () => {
    const m = holdingMetrics(holding({ units: 10, avgCost: 100, price: 150, totalThbInvested: 1200 }))
    expect(m.costBasis).toBe(1200)
    expect(m.pnl).toBe(300)
    expect(m.pnlPct).toBeCloseTo(25)
  })

  it('reports 0% instead of dividing by a zero cost', () => {
    const m = holdingMetrics(holding({ units: 10, avgCost: 0, price: 5 }))
    expect(m.pnl).toBe(50)
    expect(m.pnlPct).toBe(0)
  })
})

describe('applyBuy', () => {
  it('averages the cost over the old and new lots and takes the new price', () => {
    const next = applyBuy(holding({ units: 10, avgCost: 100, price: 120 }), 10, 200, NOW)
    expect(next).toEqual({ units: 20, avgCost: 150, price: 200, updatedAt: '2026-10-14' })
  })

  it('uses the purchase price when nothing is held', () => {
    expect(applyBuy(holding({ units: 0, avgCost: 0 }), 0, 50, NOW).avgCost).toBe(50)
  })
})

describe('portfolioValue / portfolioCost / allocations', () => {
  const holdings = [
    holding({ id: 'f', assetClass: 'fund', units: 10, price: 100, avgCost: 90 }),
    holding({ id: 's', assetClass: 'stock', units: 3, price: 1000, avgCost: 800, totalThbInvested: 2500 }),
    holding({ id: 'g', assetClass: 'gold', units: 0, price: 40_000, avgCost: 40_000 }),
  ]

  it('sums value and cost', () => {
    expect(portfolioValue(holdings)).toBe(4000)
    expect(portfolioCost(holdings)).toBe(900 + 2500)
  })

  it('splits the value by asset class, largest first, keeping held classes worth 0', () => {
    expect(allocations(holdings)).toEqual([
      { assetClass: 'stock', value: 3000, pct: 75 },
      { assetClass: 'fund', value: 1000, pct: 25 },
      { assetClass: 'gold', value: 0, pct: 0 },
    ])
  })

  it('returns no classes for an empty portfolio', () => {
    expect(allocations([])).toEqual([])
  })
})

describe('findMatchingHolding', () => {
  const holdings = [
    holding({ id: 'a', name: 'SCB S&P 500', ticker: 'SCBS&P500', assetClass: 'fund' }),
    holding({ id: 'b', name: 'Bitcoin', ticker: 'BTC', assetClass: 'crypto' }),
  ]

  it('matches by id first, then ticker or name', () => {
    expect(findMatchingHolding(holdings, { holdingId: 'b', name: 'whatever' })?.id).toBe('b')
    expect(findMatchingHolding(holdings, { name: 'btc' })?.id).toBe('b')
  })

  it('ignores symbols and spacing', () => {
    expect(findMatchingHolding(holdings, { name: 'SCB SP500' })?.id).toBe('a')
  })

  it('falls back to the only holding of the same class, and otherwise finds nothing', () => {
    expect(findMatchingHolding(holdings, { name: 'Satoshi stack', assetClass: 'crypto' })?.id).toBe('b')
    expect(findMatchingHolding(holdings, { name: 'Unknown', assetClass: 'stock' })).toBeNull()
  })
})

describe('upsert', () => {
  it('replaces an item with the same id and appends a new one', () => {
    const list = [{ id: 'a', v: 1 }]
    expect(upsert(list, { id: 'a', v: 2 })).toEqual([{ id: 'a', v: 2 }])
    const added = upsert(list, { v: 3 })
    expect(added).toHaveLength(2)
    expect(added[1].id).toBeTruthy()
  })
})

/* ----------------------------- Gold / BTC ----------------------------- */

describe('gold and bitcoin units', () => {
  it('converts grams and baht-weight both ways', () => {
    expect(gramsToBahtGold(15.244)).toBeCloseTo(1)
    expect(bahtGoldToGrams(2)).toBeCloseTo(30.488)
  })

  it('works out the cost per baht-weight, and 0 for no grams', () => {
    expect(goldCostPerBaht(42_000, 15.244)).toBeCloseTo(42_000)
    expect(goldCostPerBaht(1000, 0)).toBe(0)
  })

  it('round-trips the Thai gold price through XAU/USD', () => {
    const xau = goldThbPerBahtToXauUsd(45_000, 33)
    expect(xauUsdToThaiGoldPricePerBaht(xau, 33)).toBeCloseTo(45_000)
    expect(goldThbPerBahtToXauUsd(45_000, 0)).toBe(0)
  })

  it('converts sats and the cost per coin', () => {
    expect(btcToSats(0.1)).toBe(10_000_000)
    expect(satsToBtc(50_000_000)).toBe(0.5)
    expect(btcCostPerCoin(1_000_000, 1_000_000)).toBe(100_000_000)
    expect(btcCostPerCoin(1000, 0)).toBe(0)
  })
})

/* ----------------------------- DCA periods ----------------------------- */

describe('getEffectiveDayOfMonth', () => {
  it('moves days past the month end to the last day', () => {
    expect(getEffectiveDayOfMonth(31, 2026, 1)).toBe(28)
    expect(getEffectiveDayOfMonth(31, 2028, 1)).toBe(29)
    expect(getEffectiveDayOfMonth(15, 2026, 1)).toBe(15)
    expect(getEffectiveDayOfMonth(0, 2026, 1)).toBe(1)
  })
})

describe('planMonthlyEquivalent', () => {
  it('scales daily and weekly amounts to a month', () => {
    expect(planMonthlyEquivalent(plan({ monthlyAmount: 100 }), NOW)).toBe(100)
    expect(planMonthlyEquivalent(plan({ frequency: 'daily', monthlyAmount: 100 }), NOW)).toBe(3100)
    expect(planMonthlyEquivalent(plan({ frequency: 'weekly', monthlyAmount: 100 }), NOW)).toBeCloseTo(433)
  })

  it('treats a plan without a frequency as monthly', () => {
    expect(planMonthlyEquivalent(plan({ frequency: undefined, monthlyAmount: 700 }), NOW)).toBe(700)
  })
})

describe('plan executions in the month', () => {
  it('counts weekly buys so far and in the whole month', () => {
    const mondays = plan({ frequency: 'weekly', dayOfMonth: 1 })
    expect(planExecutionsThisMonth(mondays, NOW)).toBe(2)
    expect(planTotalExecutionsInMonth(mondays, NOW)).toBe(4)
    const fridays = plan({ frequency: 'weekly', dayOfMonth: 5 })
    expect(planExecutionsThisMonth(fridays, NOW)).toBe(2)
    expect(planTotalExecutionsInMonth(fridays, NOW)).toBe(5)
  })

  it('counts daily and monthly buys', () => {
    expect(planExecutionsThisMonth(plan({ frequency: 'daily' }), NOW)).toBe(14)
    expect(planTotalExecutionsInMonth(plan({ frequency: 'daily' }), NOW)).toBe(31)
    expect(planExecutionsThisMonth(plan({ dayOfMonth: 14 }), NOW)).toBe(1)
    expect(planExecutionsThisMonth(plan({ dayOfMonth: 15 }), NOW)).toBe(0)
  })
})

describe('buy day checks', () => {
  it('monthly: passed, today, overdue', () => {
    const before = plan({ dayOfMonth: 10 })
    const today = plan({ dayOfMonth: 14 })
    const later = plan({ dayOfMonth: 20 })
    expect([buyDayPassedThisPeriod(before, NOW), isBuyDayToday(before, NOW), isBuyDayOverdue(before, NOW)]).toEqual([true, false, true])
    expect([buyDayPassedThisPeriod(today, NOW), isBuyDayToday(today, NOW), isBuyDayOverdue(today, NOW)]).toEqual([true, true, false])
    expect([buyDayPassedThisPeriod(later, NOW), isBuyDayToday(later, NOW), isBuyDayOverdue(later, NOW)]).toEqual([false, false, false])
  })

  it('weekly: compares within the Monday–Sunday week', () => {
    const monday = plan({ frequency: 'weekly', dayOfMonth: 1 })
    const wednesday = plan({ frequency: 'weekly', dayOfMonth: 3 })
    const sunday = plan({ frequency: 'weekly', dayOfMonth: 7 })
    expect(isBuyDayOverdue(monday, NOW)).toBe(true)
    expect(isBuyDayToday(wednesday, NOW)).toBe(true)
    expect(buyDayPassedThisPeriod(sunday, NOW)).toBe(false)
  })

  it('daily: always due, never overdue', () => {
    const daily = plan({ frequency: 'daily' })
    expect(buyDayPassedThisPeriod(daily, NOW)).toBe(true)
    expect(isBuyDayToday(daily, NOW)).toBe(true)
    expect(isBuyDayOverdue(daily, NOW)).toBe(false)
  })
})

describe('shouldConfirmBuy', () => {
  it('asks once the buy day has passed until this period is confirmed or skipped', () => {
    expect(shouldConfirmBuy(plan({ dayOfMonth: 10 }), NOW)).toBe(true)
    expect(shouldConfirmBuy(plan({ dayOfMonth: 10, confirmedDates: ['2026-10-10'] }), NOW)).toBe(false)
    expect(shouldConfirmBuy(plan({ dayOfMonth: 10, skippedDates: ['2026-10-11'] }), NOW)).toBe(false)
    expect(shouldConfirmBuy(plan({ dayOfMonth: 10, confirmedDates: ['2026-09-10'] }), NOW)).toBe(true)
    expect(shouldConfirmBuy(plan({ dayOfMonth: 20 }), NOW)).toBe(false)
  })

  it('weekly: a buy from last week does not count for this week', () => {
    const monday = plan({ frequency: 'weekly', dayOfMonth: 1 })
    expect(isConfirmedForPeriod({ ...monday, confirmedDates: ['2026-10-12T09:00:00'] }, NOW)).toBe(true)
    expect(isConfirmedForPeriod({ ...monday, confirmedDates: ['2026-10-11T09:00:00'] }, NOW)).toBe(false)
  })
})

describe('nextBuyDate', () => {
  const ymd = (d: Date) => [d.getFullYear(), d.getMonth() + 1, d.getDate()]

  it('monthly: later this month, or next month once today has passed', () => {
    expect(ymd(nextBuyDate(plan({ dayOfMonth: 20 }), NOW))).toEqual([2026, 10, 20])
    expect(ymd(nextBuyDate(plan({ dayOfMonth: 14 }), NOW))).toEqual([2026, 11, 14])
    expect(ymd(nextBuyDate(plan({ dayOfMonth: 31 }), new Date(2026, 0, 31)))).toEqual([2026, 2, 28])
    expect(ymd(nextBuyDate(plan({ dayOfMonth: 5 }), new Date(2026, 11, 20)))).toEqual([2027, 1, 5])
  })

  it('weekly and daily: the next matching day after today', () => {
    expect(ymd(nextBuyDate(plan({ frequency: 'weekly', dayOfMonth: 1 }), NOW))).toEqual([2026, 10, 19])
    expect(ymd(nextBuyDate(plan({ frequency: 'weekly', dayOfMonth: 3 }), NOW))).toEqual([2026, 10, 21])
    expect(ymd(nextBuyDate(plan({ frequency: 'daily' }), NOW))).toEqual([2026, 10, 15])
  })
})

describe('dcaThisMonth', () => {
  it('splits the month into bought so far and still to come', () => {
    const m = dcaThisMonth([
      plan({ id: 'a', monthlyAmount: 1000, dayOfMonth: 10 }),
      plan({ id: 'b', monthlyAmount: 500, dayOfMonth: 20 }),
      plan({ id: 'c', monthlyAmount: 100, frequency: 'weekly', dayOfMonth: 1 }),
    ], NOW)
    expect(m).toEqual({ total: 1900, invested: 1200, upcoming: 700, pct: (1200 / 1900) * 100, count: 3 })
  })

  it('is all zeros without plans', () => {
    expect(dcaThisMonth([], NOW)).toEqual({ total: 0, invested: 0, upcoming: 0, pct: 0, count: 0 })
  })
})

describe('sortDcaPlans', () => {
  it('puts overdue first, then due today, then the soonest upcoming', () => {
    const sorted = sortDcaPlans([
      plan({ id: 'later', name: 'Later', dayOfMonth: 20, monthlyAmount: 9000 }),
      plan({ id: 'today', name: 'Today', dayOfMonth: 14, monthlyAmount: 5000 }),
      plan({ id: 'soon', name: 'Soon', dayOfMonth: 16, monthlyAmount: 100 }),
      plan({ id: 'overdue', name: 'Overdue', dayOfMonth: 10, monthlyAmount: 1000 }),
    ], NOW)
    expect(sorted.map((p) => p.id)).toEqual(['overdue', 'today', 'soon', 'later'])
  })

  it('breaks ties by the larger amount, then by name', () => {
    const sorted = sortDcaPlans([
      plan({ id: 'b', name: 'B', dayOfMonth: 20, monthlyAmount: 100 }),
      plan({ id: 'big', name: 'Z', dayOfMonth: 20, monthlyAmount: 900 }),
      plan({ id: 'a', name: 'A', dayOfMonth: 20, monthlyAmount: 100 }),
    ], NOW)
    expect(sorted.map((p) => p.id)).toEqual(['big', 'a', 'b'])
  })
})

/* ----------------------------- Cash ----------------------------- */

describe('cash interest and breakdown', () => {
  const accounts = [
    account({ id: 'thb', balance: 100_000, interestRate: 2, payoutSchedule: 'monthly' }),
    account({
      id: 'usd', currency: 'USD', balance: 1000, maxEligibleBalance: 500, interestRate: 4,
      category: 'locked', payoutSchedule: 'annual', payoutMonths: [6],
    }),
    account({ id: 'none', balance: 5000 }),
  ]

  it('caps interest at the eligible balance and converts USD with the rate', () => {
    expect(calculateAnnualCashInterest(accounts, 35)).toBeCloseTo(2000 + 700)
  })

  it('leaves USD interest out when no real rate is known', () => {
    expect(calculateAnnualCashInterest(accounts, null)).toBeCloseTo(2000)
  })

  it('spreads interest over the payout months', () => {
    const r = calculateMonthlyCashInterest(accounts, 35)
    expect(r.totalAnnual).toBeCloseTo(2700)
    expect(r.byMonth[1]).toBeCloseTo(2000 / 12)
    expect(r.byMonth[6]).toBeCloseTo(2000 / 12 + 700)
    expect(r.totalCompounded).toBeCloseTo(100_000 * (Math.pow(1 + 2 / 1200, 12) - 1) + 700)
  })

  it('splits cash into everyday and locked', () => {
    expect(getCashLiquidityBreakdown(accounts, 35)).toEqual({ spending: 105_000, locked: 35_000, total: 140_000 })
    expect(getCashLiquidityBreakdown(accounts, null)).toEqual({ spending: 105_000, locked: 0, total: 105_000 })
  })
})

/* ----------------------------- Liabilities ----------------------------- */

describe('totalLiabilities / totalMonthlyDebtPayment / netWorth', () => {
  const d = data({
    holdings: [holding({ units: 10, price: 1000 })],
    cashAccounts: [account({ balance: 20_000 }), account({ id: 'u', currency: 'USD', balance: 100 })],
    liabilities: [debt({ balance: 1000, monthlyPayment: 300 }), debt({ id: 'm', balance: 500, monthlyPayment: undefined })],
    spendCards: [
      { id: 'c1', balance: 300 },
      { id: 'c2', balance: -50 },
      { id: 'c3', balance: 200, excludeFromNetWorth: true },
    ] as SpendiaryData['spendCards'],
  })

  it('adds debts and card balances, skipping credits and cards already tracked as debts', () => {
    expect(totalLiabilities(d)).toBe(1800)
  })

  it('adds up the monthly payments', () => {
    expect(totalMonthlyDebtPayment(d)).toBe(300)
  })

  it('is cash plus portfolio minus debts, with USD only when a rate is known', () => {
    expect(netWorth(d, 35)).toBe(20_000 + 3500 + 10_000 - 1800)
    expect(netWorth(d, null)).toBe(20_000 + 10_000 - 1800)
  })
})

describe('getLiabilityDueStatus', () => {
  it('reports a finished installment plan', () => {
    const l = debt({ isInstallment: true, totalInstallments: 10, paidInstallments: 10, balance: 0 })
    expect(getLiabilityDueStatus(l, NOW).status).toBe('completed')
  })

  it('reports this month as paid', () => {
    expect(getLiabilityDueStatus(debt({ dueDay: 5, lastPaidDate: '2026-10-02' }), NOW).status).toBe('paid')
  })

  it('waits for payment when there is no due day', () => {
    expect(getLiabilityDueStatus(debt({}), NOW).status).toBe('pending')
  })

  it('counts down to the due day', () => {
    expect(getLiabilityDueStatus(debt({ dueDay: 14 }), NOW)).toMatchObject({ status: 'due_today', daysLeft: 0 })
    expect(getLiabilityDueStatus(debt({ dueDay: 16 }), NOW)).toMatchObject({ status: 'due_soon', daysLeft: 2 })
    expect(getLiabilityDueStatus(debt({ dueDay: 25 }), NOW)).toMatchObject({ status: 'pending', daysLeft: 11 })
  })

  it('is overdue once the due day has passed unpaid', () => {
    expect(getLiabilityDueStatus(debt({ dueDay: 5, createdAt: '2026-01-01' }), NOW).status).toBe('overdue')
  })

  it('points at next month when the first payment starts then', () => {
    const l = debt({ dueDay: 5, firstPaymentMonth: 'next', createdAt: '2026-10-10' })
    expect(getLiabilityDueStatus(l, NOW)).toMatchObject({ status: 'pending', daysLeft: 22, label: 'In 22 days (Nov 5)' })
  })
})

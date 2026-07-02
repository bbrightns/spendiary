export type AssetClass = 'fund' | 'stock' | 'crypto' | 'gold' | 'cash'

export interface BtcLocation {
  id: string
  /** e.g. "Binance", "Ledger", "Coinbase" */
  name: string
  /** Satoshi held at this location */
  satoshi: number
  /** Total THB spent at this location */
  thbSpent: number
}

export interface GoldLocation {
  id: string
  name: string
  /** Grams held at this location */
  grams: number
  /** Total THB spent at this location */
  thbSpent: number
}

export interface Holding {
  id: string
  name: string
  ticker: string
  assetClass: AssetClass
  /** Units / shares / coins held */
  units: number
  /** Average cost per unit, in THB */
  avgCost: number
  /** Latest market price / NAV per unit you filled in, in THB */
  price: number
  /** ISO date the price was last updated */
  updatedAt?: string
  /** BTC sub-breakdown by location (only for assetClass === 'crypto') */
  btcLocations?: BtcLocation[]
  /** Gold sub-breakdown by location (only for assetClass === 'gold') */
  goldLocations?: GoldLocation[]
}

export interface RetirementSettings {
  /** Monthly spend after retirement, in THB (in today's money) */
  monthlySpend: number
  /** Target age to retire */
  retireAge: number
  /** Age at which you expect to die */
  deadAge: number
  /** Expected annual inflation rate, e.g. 0.03 for 3% */
  inflationRate?: number
  /** Expected annual portfolio return, e.g. 0.08 for 8% */
  expectedReturn?: number
  /** Date of birth, YYYY-MM-DD */
  birthDate?: string
  /** Monthly investment override — defaults to sum of DCA plans if not set */
  monthlyInvest?: number
  /** Annual growth rate for savings/investment, as decimal (e.g. 0.05 for 5%) */
  annualSavingsGrowth?: number
  /** Post-retirement withdrawal strategy: lump_sum (withdraw all) or drawdown (keep invested) */
  withdrawalStrategy?: 'lump_sum' | 'drawdown'
}

export type DcaFrequency = 'daily' | 'weekly' | 'monthly'

export interface DcaPlan {
  id: string
  name: string
  assetClass: AssetClass
  /** How often the buy executes */
  frequency?: DcaFrequency   // defaults to 'monthly' for legacy plans
  /** Amount per frequency period, in THB */
  monthlyAmount: number
  /**
   * Monthly: day of month (1–28)
   * Weekly:  day of week (1=Mon … 7=Sun)
   * Daily:   unused
   */
  dayOfMonth: number
  /** Linked portfolio holding id — set when created from "From my portfolio" */
  holdingId?: string
  /** For BTC plans: preferred location id to add sats to when confirming */
  btcLocationId?: string
  /** For Gold plans: preferred location id to add grams to when confirming */
  goldLocationId?: string
  /** ISO date strings of confirmed buys, newest first */
  confirmedDates?: string[]
  /** ISO date strings of skipped periods, newest first */
  skippedDates?: string[]
}

export type Frequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly'

export interface Transfer {
  id: string
  recipient: string
  note?: string
  /** Amount per transfer, in THB */
  amount: number
  frequency: Frequency
  /** Transfers already sent */
  completed: number
  /** Total transfers in the schedule */
  total: number
  /** ISO date the schedule expires */
  expiryDate: string
}

export interface CashAccount {
  id: string
  /** Where the cash sits, e.g. "KBank", "SCB" */
  name: string
  /** Balance in THB */
  balance: number
}

export interface HoldingLog {
  id: string
  timestamp: string        // ISO datetime
  action: 'add' | 'buy_more' | 'edit'
  holdingName: string
  ticker: string
  assetClass: AssetClass
  note: string             // human-readable detail line
  holdingId?: string
  previousHoldingState?: Holding
  previousCashAccountsState?: CashAccount[]
  dcaPlanId?: string
  dcaDate?: string
}

export interface FixedCostItem {
  id: string
  /** Label, e.g. "Rent", "Mom + Dad" */
  name: string
  /** Amount in THB */
  amount: number
}

export interface NetWorthSnapshot {
  /** YYYY-MM-DD in local timezone */
  date: string
  /** Total net worth in THB at this point */
  value: number
}

export interface SpendiaryData {
  /** Display name shown in the Dashboard greeting */
  userName?: string
  /** Liquid cash, broken down by where it's stored. Total cash = sum of balances. */
  cashAccounts: CashAccount[]
  /** Monthly take-home salary in THB, used to compute the savings/invest rate. */
  monthlyIncome: number
  /** Monthly fixed costs broken down by category */
  fixedCostItems?: FixedCostItem[]
  /** Legacy single fixed-cost number — migrated to fixedCostItems on load */
  monthlyFixedCost?: number
  /** Monthly personal / wants budget in THB (shopping, travel, fun) */
  monthlyPersonal?: number
  /** Daily net worth snapshots — one per day, auto-recorded, last 365 */
  netWorthHistory?: NetWorthSnapshot[]
  /** Daily portfolio-value-only snapshots — one per day, auto-recorded, last 365 */
  portfolioHistory?: NetWorthSnapshot[]
  holdings: Holding[]
  holdingLogs?: HoldingLog[]
  dcaPlans: DcaPlan[]
  transfers: Transfer[]
  retirement?: RetirementSettings
  rebalanceTargets?: Record<AssetClass, number>
  /** Timestamp in ms when this data was last modified locally */
  lastUpdatedAt?: number
}

export type AssetClass = 'fund' | 'stock' | 'crypto'

export interface BtcLocation {
  id: string
  /** e.g. "Binance", "Ledger", "Coinbase" */
  name: string
  /** Satoshi held at this location */
  satoshi: number
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
}

export interface RetirementSettings {
  /** Monthly spend after retirement, in THB */
  monthlySpend: number
  /** Target age to retire */
  retireAge: number
  /** Age at which you expect to die */
  deadAge: number
}

export interface DcaPlan {
  id: string
  name: string
  assetClass: AssetClass
  /** Amount bought every month, in THB */
  monthlyAmount: number
  /** Day of month the buy executes (1–28) */
  dayOfMonth: number
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

export interface SpendiaryData {
  /** Liquid cash, broken down by where it's stored. Total cash = sum of balances. */
  cashAccounts: CashAccount[]
  /** Monthly take-home salary in THB, used to compute the savings/invest rate. */
  monthlyIncome: number
  holdings: Holding[]
  dcaPlans: DcaPlan[]
  transfers: Transfer[]
  retirement?: RetirementSettings
}

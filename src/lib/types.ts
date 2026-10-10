export type AssetClass = 'fund' | 'stock' | 'crypto' | 'gold' | 'real_estate' | 'cash'
export type InvestAssetClass = 'fund' | 'stock' | 'crypto' | 'gold' | 'real_estate'

export interface BtcLocation {
  id: string
  /** e.g. "Binance", "Ledger", "Coinbase" */
  name: string
  /** Satoshi held at this location */
  satoshi: number
  /** Total THB spent at this location */
  thbSpent: number
  /** Whether this cold-storage pocket is locked to prevent accidental sales */
  isLocked?: boolean
}

export interface GoldLocation {
  id: string
  name: string
  /** Grams held at this location */
  grams: number
  /** Total THB spent at this location */
  thbSpent: number
  /** Whether this cold-storage pocket is locked to prevent accidental sales */
  isLocked?: boolean
}

export interface Holding {
  id: string
  name: string
  ticker: string
  assetClass: AssetClass
  /** Optional custom tag or category (e.g. "อสังหา", "หุ้นเมกา", "หุ้นเทค", "ตราสารหนี้", "ปันผล") */
  tag?: string
  /** Units / shares / coins held (totalUnits) */
  units: number
  /** Total units held */
  totalUnits?: number
  /** Total THB actually spent/invested */
  totalThbInvested?: number
  /** Total USD actually spent/invested */
  totalUsdInvested?: number
  /** Average cost per unit in USD */
  avgCostUsd?: number
  /** Average cost per unit in THB */
  avgCostThb?: number
  /** Average cost per unit, in THB (for backwards compatibility) */
  avgCost: number
  /** Latest market price / NAV per unit you filled in, in THB */
  price: number
  /** ISO date the price was last updated */
  updatedAt?: string
  /** BTC sub-breakdown by location (only for assetClass === 'crypto') */
  btcLocations?: BtcLocation[]
  /** Gold sub-breakdown by location (only for assetClass === 'gold') */
  goldLocations?: GoldLocation[]
  /** Whether this holding pays dividends */
  paysDividend?: boolean
  /** Expected dividend per share (in THB or USD based on holding) */
  expectedDps?: number
  /** Specific months (1-12) when dividend is expected to be paid */
  dividendMonths?: number[]
  /** Month-specific expected DPS schedule (supports varying DPS across payout rounds) */
  dividendPayouts?: DividendPayoutSchedule[]
  /** Default cash account ID to deposit dividends into */
  defaultCashAccountId?: string
  /** Whether this holding is locked in Safe-Haven to prevent accidental sales or deletion */
  isLocked?: boolean
}

export interface DividendPayoutSchedule {
  month: number // 1-12
  dps: number   // Dividend per share for this round
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
  ticker?: string
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
  /** For Cash plans: linked cash account id to deposit funds into when confirming */
  cashAccountId?: string
  /** ISO date strings of confirmed buys, newest first */
  confirmedDates?: string[]
  /** ISO date strings of skipped periods, newest first */
  skippedDates?: string[]
}

export type Frequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly'
export type CashAccountCategory = 'spending' | 'locked'
export type CashPayoutSchedule = 'monthly' | 'semi_annual' | 'annual' | 'custom'

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
  /** Balance amount */
  balance: number
  /** Currency of the account: THB or USD (defaults to THB if undefined) */
  currency?: 'THB' | 'USD'
  /** Purpose / Liquidity bucket */
  category?: CashAccountCategory
  /** Bank / institution preset key */
  bankPreset?: string
  /** Optional custom color */
  color?: string
  /** Annual interest rate in percentage (e.g. 2.22 or 5.50) */
  interestRate?: number
  /** Maximum principal amount eligible for the interest rate (e.g. 10000 for Dime 3%) */
  maxEligibleBalance?: number
  /** Payout schedule pattern */
  payoutSchedule?: CashPayoutSchedule
  /** Specific months (1-12) when interest is paid */
  payoutMonths?: number[]
}

export interface DividendRecord {
  id: string
  holdingId?: string
  holdingName: string
  ticker: string
  assetClass: AssetClass
  /** ISO date string YYYY-MM-DD */
  paymentDate: string
  /** Dividend Per Share in THB (or USD for US stocks) */
  dps: number
  /** Number of shares eligible on record date */
  shares: number
  /** Total gross dividend (dps * shares) */
  grossAmount: number
  /** Tax rate as decimal (e.g. 0.10 for 10%) */
  taxRate: number
  /** Withholding tax amount */
  taxAmount: number
  /** Net cash received (grossAmount - taxAmount) */
  netAmount: number
  /** Destination cash account id */
  cashAccountId?: string
  /** Destination cash account name snapshot */
  cashAccountName?: string
  note?: string
  /** ISO timestamp when record was created */
  createdAt: string
}

export interface HoldingLog {
  id: string
  timestamp: string        // ISO datetime
  action: 'add' | 'buy_more' | 'edit' | 'sell' | 'dividend' | 'note' | 'transfer'
  holdingName: string
  ticker: string
  assetClass: AssetClass
  note: string             // human-readable detail line
  holdingId?: string
  previousHoldingState?: Holding
  afterHoldingState?: Holding
  previousCashAccountsState?: CashAccount[]
  afterCashAccountsState?: CashAccount[]
  dcaPlanId?: string
  dcaDate?: string
  soldUnits?: number
  soldPrice?: number
  proceeds?: number
  realizedPnL?: number
  realizedPnLPercent?: number
  fee?: number
  cashAccountId?: string
  dividendPerShare?: number
  grossDividend?: number
  withholdingTax?: number
  netDividend?: number
  dividendRecordId?: string
  /** Set on 'transfer' logs: coins / grams moved between two storage locations of one holding */
  transfer?: LocationTransfer
}

/** Details of moving a holding between its own storage locations (units are sats for BTC, grams for gold). */
export interface LocationTransfer {
  fromLocationId: string
  fromName: string
  toLocationId: string
  toName: string
  /** True when the destination location was created by this transfer */
  destCreated: boolean
  unit: 'sats' | 'grams'
  /** Amount that left the source location */
  amount: number
  /** Network / handling fee that disappeared in transit (same unit) */
  fee: number
  /** Amount that arrived at the destination (amount - fee) */
  received: number
  /** Cost basis (THB) that travelled with the coins */
  costMoved: number
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

export type RebalanceMode = 'class' | 'holding'

export interface PlannedAsset {
  id: string
  name: string
  ticker: string
  assetClass: InvestAssetClass
}

export type DebtCategory = 'installment' | 'credit_card' | 'mortgage' | 'auto_loan' | 'personal_loan' | 'student_loan' | 'other'

export interface Liability {
  id: string
  name: string
  category: DebtCategory
  balance: number
  interestRate?: number
  monthlyPayment?: number
  lender?: string
  dueDay?: number
  note?: string
  createdAt?: string
  updatedAt?: string
  /** Whether the first due payment cycle starts in 'current' or 'next' month */
  firstPaymentMonth?: 'current' | 'next'
  /** Whether this liability is an installment plan (e.g. 0% 10-month phone, goods financing) */
  isInstallment?: boolean
  /** Total number of installments (e.g. 10) */
  totalInstallments?: number
  /** Number of installments paid so far (e.g. 4) */
  paidInstallments?: number
  /** ISO date string YYYY-MM-DD of the most recent payment confirmed */
  lastPaidDate?: string
  /** Original total cost/balance of the installment purchase (used for progress tracking) */
  originalBalance?: number
}

export type SpendTxnType = 'expense' | 'income' | 'transfer'

export interface SpendTransaction {
  id: string
  type: SpendTxnType
  /** Always positive, in THB */
  amount: number
  /** Category id (expense / income only) */
  categoryId?: string
  /** Wallet the money leaves (expense, transfer) or lands in (income) */
  accountId?: string
  /** Destination wallet for transfers */
  toAccountId?: string
  /** YYYY-MM-DD, local timezone */
  date: string
  note?: string
  /** Lowercase hashtags parsed from the note, without the leading # */
  tags?: string[]
  /** ISO timestamp */
  createdAt: string
  updatedAt?: string
  /**
   * Set only on read-only rows derived from the Invest side (never stored):
   * dividends received and DCA buys. Their cash moves are already applied there.
   */
  source?: 'dividend' | 'dca'
}

export interface SpendSettings {
  /** Monthly spending budget in THB, drives the "per day left" readout */
  monthlyBudget?: number
  /** Payment method (cash account or card id) preselected in Quick Add */
  defaultAccountId?: string
  /** Payment methods pinned as one-tap chips in Quick Add */
  favoriteAccountIds?: string[]
  /** How a spending "month" is counted; calendar month when unset */
  cycle?: PayCycle
  /** Remind about a card bill this many days before it's due (default 5) */
  billReminderDays?: number
  /** Spending limit per expense category id, in THB per spending month */
  categoryBudgets?: Record<string, number>
  /** Set once the old Invest-side fixed cost list has been copied into Spend recurring */
  fixedCostsImported?: boolean
}

export type RecurringFrequency = 'weekly' | 'monthly' | 'yearly'

/** A bill or income that repeats; each occurrence waits for you to confirm or skip it. */
export interface SpendRecurring {
  id: string
  name: string
  type: 'expense' | 'income'
  /** Usual amount in THB (editable when confirming) */
  amount: number
  categoryId: string
  /** Wallet or card it's paid with / paid into */
  accountId?: string
  frequency: RecurringFrequency
  /** Weekly: 1 = Mon … 7 = Sun. Monthly / yearly: day of month (clamped to short months) */
  day: number
  /** Yearly only: 1–12 */
  month?: number
  /** No occurrences before this date (YYYY-MM-DD) */
  startDate: string
  note?: string
  /**
   * Expense only: count toward fixed costs (DCA Plans salary split). Unset = yes,
   * so bills are fixed costs unless you opt one out.
   */
  fixedCost?: boolean
  /** Occurrence dates already logged */
  doneDates?: string[]
  /** Occurrence dates skipped */
  skippedDates?: string[]
  paused?: boolean
}

/** When the payday rule lands on Sat/Sun: move to Friday before, Monday after, or keep it */
export type WeekendShift = 'before' | 'after' | 'keep'

export type PayDayRule =
  /** A fixed day of the month, e.g. 25 (clamped to short months) */
  | { kind: 'day'; day: number }
  /** Counted back from the month's last day: 0 = last day, 1 = the day before, … */
  | { kind: 'fromEnd'; daysBefore: number }

export interface PayCycle {
  /** calendar: 1st → last day. payday: from one payday up to the day before the next */
  mode: 'calendar' | 'payday'
  rule?: PayDayRule
  weekend?: WeekendShift
}

export interface SpendCard {
  id: string
  name: string
  /** Last 4 digits, display only */
  last4?: string
  color?: string
  /** Credit limit in THB */
  creditLimit: number
  /** Amount currently owed in THB */
  balance: number
  /** Statement closing day of month (วันตัดรอบ), 1–31 */
  statementDay: number
  /** Payment due day of month (วันครบกำหนดชำระ), 1–31 */
  dueDay: number
}

export interface SpendiaryData {
  /** Display name shown in the Dashboard greeting */
  userName?: string
  /** Liquid cash, broken down by where it's stored. Total cash = sum of balances. */
  cashAccounts: CashAccount[]
  /** Monthly take-home salary in THB, used to compute the savings/invest rate. */
  monthlyIncome: number
  /**
   * @deprecated Kept as a backup after the move to Spend: fixed costs now live in
   * `spendRecurring` (expense items with `fixedCost` not false). Copied over once on load.
   */
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
  rebalanceMode?: RebalanceMode
  rebalanceTargets?: Record<InvestAssetClass, number>
  rebalanceHoldingTargets?: Record<string, number>
  plannedAssets?: PlannedAsset[]
  dividendRecords?: DividendRecord[]
  liabilities?: Liability[]
  /** Spend module: day-to-day income / expense / transfer records */
  spendTransactions?: SpendTransaction[]
  /** Spend module: user settings such as the monthly spending budget */
  spendSettings?: SpendSettings
  /** Spend module: credit cards usable as a payment method */
  spendCards?: SpendCard[]
  /** Spend module: repeating bills and income */
  spendRecurring?: SpendRecurring[]
  /** Timestamp in ms when this data was last modified locally */
  lastUpdatedAt?: number
}

export interface SpendiaryBackupPreferences {
  theme?: 'light' | 'dark' | 'system'
  pnlDisplay?: 'pct' | 'thb'
  logsViewMode?: 'table' | 'timeline'
  goldSellUnit?: 'grams' | 'baht'
}

export interface SpendiaryBackup {
  schemaVersion: 1
  exportedAt: string
  data: SpendiaryData
  preferences: SpendiaryBackupPreferences
}

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
  /**
   * Set when no real price was known and `price` was filled with the average cost instead.
   * While `price` still equals it the holding has no real price: it counts at cost, with no P/L.
   * Any real price (live quote, a buy, a sale, one typed in) replaces `price` and ends that.
   */
  placeholderPrice?: number
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
  /** Cash account each buy is paid from by default (balance goes down on confirm); unset = not tracked */
  payFromAccountId?: string
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
  /** DCA buys: the cash account the money came out of, and how much (THB) */
  paidFromAccountId?: string
  paidAmount?: number
  dividendPerShare?: number
  grossDividend?: number
  withholdingTax?: number
  netDividend?: number
  dividendRecordId?: string
  /** Set on 'transfer' logs: coins / grams moved between two storage locations of one holding */
  transfer?: LocationTransfer
  /** 'add' / 'buy_more' logs: how the units were acquired (unset = bought) */
  source?: AcquisitionSource
  /** Who gave the units, when source is 'received' (e.g. "Brother") */
  receivedFrom?: string
}

/** Bought with own money, or received for free (gift / inheritance) at the market value on that day. */
export type AcquisitionSource = 'bought' | 'received'

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
  /** What that payment took off the balance, so Undo puts back exactly the same */
  lastPaidAmount?: number
  /** Wallet or card it's usually paid from (Spend); preselected when paying */
  payFromId?: string
  /** YYYY-MM-DD of the first payment, when it's known exactly (e.g. a card installment bills on the next statement) */
  firstDueDate?: string
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
  /** HH:mm, local timezone; unset when the time of day wasn't recorded */
  time?: string
  /** Label of one subcategory under `categoryId` (see SpendSettings.subcategories) */
  subcategory?: string
  note?: string
  /**
   * Backdated entry already reflected in the wallet / card balance: recorded for history
   * and totals, but never moves a balance (on add, edit or delete).
   */
  alreadyInBalance?: boolean
  /**
   * A one-off kept out of the daily budget (a trip, a big purchase): it still counts in totals,
   * Analysis and category budgets, but not in "left today" or the month's budget bar. Expenses only.
   */
  outsideBudget?: boolean
  /**
   * Income that is someone paying you back (your half of a shared meal, a shop's refund): it lowers
   * `categoryId`'s spending (an expense category) instead of counting as income. Wallets still go up.
   */
  paidBack?: boolean
  /** Lowercase hashtags parsed from the note, without the leading # */
  tags?: string[]
  /** ISO timestamp */
  createdAt: string
  updatedAt?: string
  /**
   * Set only on read-only rows derived from the Invest side (never stored):
   * dividends received, DCA buys and Buy more. Their cash moves are already applied there.
   */
  source?: 'dividend' | 'dca' | 'buy'
  /** A loan / installment payment: the liability it paid toward */
  liabilityId?: string
  /** Logged from a recurring item's occurrence; deleting it puts that occurrence back as due */
  recurring?: { id: string; date: string }
}

export interface RemovedAccount {
  name: string
  removedAt: string
  pending?: number
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
  /** Order of the cards on Spend's Home, by card id; unknown or missing ids fall back to the default order */
  homeOrder?: string[]
  /** Order of credit cards on Accounts and in pickers, by card id; cards not listed follow in their saved order */
  cardOrder?: string[]
  /** Order of wallets on Accounts and in pickers, by account id; wallets not listed follow in their saved order */
  walletOrder?: string[]
  /** Categories the user added (expense or income) */
  customCategories?: SpendCustomCategory[]
  /** Changes to built-in categories, by id */
  categoryEdits?: Record<string, SpendCategoryEdit>
  /** Subcategory labels per category id (built-in or custom), in the order they're offered */
  subcategories?: Record<string, string[]>
  /** How categories are offered in Quick add and recurring: a grid of tiles (default) or compact chips */
  categoryLayout?: 'chips' | 'tiles'
  /** Order of categories in the pickers, by id, per type; unlisted ones follow, and "Other" stays last */
  categoryOrder?: Partial<Record<'expense' | 'income', string[]>>
  /**
   * Deleted wallets and cards by id: the name, so past transactions still say where the money went,
   * and `pending`, the money edits to those transactions would have moved (+ in, − out), put on the
   * balance if the account comes back through an undo
   */
  removedAccounts?: Record<string, RemovedAccount>
}

/** A user-made Spend category. `tone` and `icon` are keys from the Spend module's palettes. */
export interface SpendCustomCategory {
  id: string
  label: string
  type: 'expense' | 'income'
  tone: string
  icon: string
  /** Kept for old transactions but no longer offered in pickers */
  hidden?: boolean
}

/** Something to save up for. Progress follows a linked wallet's balance, or a typed amount. */
export interface SpendGoal {
  id: string
  name: string
  /** THB */
  target: number
  /** Cash wallet whose balance counts as saved */
  walletId?: string
  /** Saved so far, when no wallet is linked */
  saved?: number
  /** YYYY-MM-DD */
  deadline?: string
  /** Key from the Spend category icon set */
  icon?: string
  tone?: string
  createdAt: string
}

export type SpendCategoryEdit = Partial<Pick<SpendCustomCategory, 'label' | 'tone' | 'icon' | 'hidden'>>

export type RecurringFrequency = 'weekly' | 'monthly' | 'yearly'

/** A bill, income or transfer that repeats; each occurrence waits for you to confirm or skip it. */
export interface SpendRecurring {
  id: string
  name: string
  type: 'expense' | 'income' | 'transfer'
  /** Usual amount in THB (editable when confirming) */
  amount: number
  /** Empty for transfers */
  categoryId: string
  /** Wallet or card it's paid with / paid into; for a transfer, the wallet the money leaves */
  accountId?: string
  /** Transfer only: the wallet the money goes to */
  toAccountId?: string
  frequency: RecurringFrequency
  /** Weekly: 1 = Mon … 7 = Sun. Monthly / yearly: day of month (clamped to short months) */
  day: number
  /** Yearly only: 1–12 */
  month?: number
  /** No occurrences before this date (YYYY-MM-DD) */
  startDate: string
  /** Name first, then #tags, like a transaction's note; `name` is its title */
  note?: string
  /** Label of one subcategory under `categoryId`, carried onto each logged occurrence */
  subcategory?: string
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
  /** Set when the app paused it because its wallet or card was deleted; it resumes once they're all back */
  pausedReason?: 'accountRemoved'
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
  /** Also move payday off Thai public holidays (fixed-date ones, with substitution days) */
  holidays?: boolean
  /** Extra days off to move payday off (YYYY-MM-DD), e.g. Buddhist holidays or special days */
  extraHolidays?: string[]
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
  /** Leave out of net worth / total debts (e.g. it's already tracked in Debts) */
  excludeFromNetWorth?: boolean
  /** Minimum payment as a % of the amount due (Thai cards: 8%); default 8 */
  minPaymentPercent?: number
  /** Shares this card's limit (id of the main card); its own creditLimit is kept for if it's ever unlinked */
  sharedLimitWith?: string
  /**
   * Part of the owed amount typed in by hand that isn't on a statement yet. It counts as this
   * cycle's charges until the statement closing on `statement` (YYYY-MM-DD), then it's simply
   * part of that bill. Never a transaction, so it isn't spending.
   */
  unbilled?: { amount: number; statement: string }
}

export interface SpendiaryData {
  /** Display name shown in the Dashboard greeting */
  userName?: string
  /** Liquid cash, broken down by where it's stored. Total cash = sum of balances. */
  cashAccounts: CashAccount[]
  /** Monthly take-home salary in THB, used to compute the savings/invest rate. */
  monthlyIncome: number
  /**
   * @deprecated Read only from old data / backups: fixed costs now live in `spendRecurring`
   * (expense items with `fixedCost` not false). Copied over on load, then removed.
   */
  fixedCostItems?: FixedCostItem[]
  /** Legacy single fixed-cost number — migrated to fixedCostItems on load */
  monthlyFixedCost?: number
  /** @deprecated Unused; replaced by Spend's monthly budget. Removed from data on load. */
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
  /** Spend module: savings goals */
  spendGoals?: SpendGoal[]
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

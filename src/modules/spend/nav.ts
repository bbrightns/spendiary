import type { NavSection, NavSubItem } from '../../components/layout/nav'
import { DebtIcon, HomeIcon, PieChartIcon, SettingsIcon, WalletIcon } from '../../components/icons'
import { ListBulletIcon, RepeatIcon } from './categories'
import { SPEND_HOME, SPEND_ROOT } from '../../lib/routes'

// The paths live in lib/routes so layout code can use them; re-exported for the Spend screens
export { SPEND_HOME, SPEND_ROOT, isSpendPath } from '../../lib/routes'

export const spendOverviewItem: NavSubItem = {
  to: SPEND_HOME,
  label: 'Home',
  short: 'Home',
  description: "Today's allowance, bills due and today's spending",
  icon: HomeIcon,
  exact: true,
}

export const spendTxnsItem: NavSubItem = {
  to: `${SPEND_ROOT}/txns`,
  label: 'Transactions',
  short: 'History',
  description: 'Every income, expense and transfer, with search',
  icon: ListBulletIcon,
}

export const spendAccountsItem: NavSubItem = {
  to: `${SPEND_ROOT}/accounts`,
  label: 'Accounts',
  short: 'Accounts',
  description: 'Credit cards and cash wallets you pay with',
  icon: WalletIcon,
}

export const spendAnalysisItem: NavSubItem = {
  to: `${SPEND_ROOT}/analysis`,
  label: 'Analysis',
  short: 'Analysis',
  description: 'Income, spending and trends by week, month or year',
  icon: PieChartIcon,
}

export const spendRecurringItem: NavSubItem = {
  to: `${SPEND_ROOT}/recurring`,
  label: 'Bills & recurring',
  short: 'Bills',
  description: 'Bills and income that repeat, waiting for a one-tap log',
  icon: RepeatIcon,
}

export const spendLoansItem: NavSubItem = {
  to: `${SPEND_ROOT}/loans`,
  label: 'Loans & installments',
  short: 'Loans',
  description: 'What you owe and pay back each month',
  icon: DebtIcon,
}

/** The one Settings page (opens at the top, like the gear) */
export const spendSettingsItem: NavSubItem = {
  to: '/settings',
  label: 'Settings',
  short: 'Settings',
  description: 'Theme, spending month, budgets, backup and sync',
  icon: SettingsIcon,
}

/** Spend's mobile "More" sheet: pages used less often than the four tabs. */
export const spendMoreItems: NavSubItem[] = [spendRecurringItem, spendLoansItem, spendAnalysisItem, spendSettingsItem]

export const spendNavSections: NavSection[] = [
  { title: 'Spend', items: [spendOverviewItem, spendTxnsItem, spendAnalysisItem] },
  { title: 'Money', items: [spendAccountsItem, spendRecurringItem, spendLoansItem] },
]

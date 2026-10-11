import type { NavSection, NavSubItem } from '../../components/layout/nav'
import { DashboardIcon, PieChartIcon, SettingsIcon, WalletIcon } from '../../components/icons'
import { ListBulletIcon, RepeatIcon } from './categories'

export const SPEND_ROOT = '/spend'

export function isSpendPath(pathname: string): boolean {
  return pathname === SPEND_ROOT || pathname.startsWith(`${SPEND_ROOT}/`)
}

export const spendOverviewItem: NavSubItem = {
  to: SPEND_ROOT,
  label: 'Home',
  short: 'Home',
  description: "Today's allowance, bills due and today's spending",
  icon: DashboardIcon,
  exact: true,
}

export const spendTxnsItem: NavSubItem = {
  to: `${SPEND_ROOT}/txns`,
  label: 'Transactions',
  short: 'History',
  description: 'Every income, expense and transfer, searchable by #tag',
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

export const spendSettingsItem: NavSubItem = {
  to: `${SPEND_ROOT}/settings`,
  label: 'Spend settings',
  short: 'Settings',
  description: 'Pay cycle, monthly budget and Quick add defaults',
  icon: SettingsIcon,
}

/** Spend's mobile "More" sheet: pages used less often than the four tabs. */
export const spendMoreItems: NavSubItem[] = [spendRecurringItem, spendAnalysisItem, spendSettingsItem]

export const spendNavSections: NavSection[] = [
  { title: 'Spend', items: [spendOverviewItem, spendTxnsItem, spendAnalysisItem] },
  { title: 'Money', items: [spendAccountsItem, spendRecurringItem] },
]

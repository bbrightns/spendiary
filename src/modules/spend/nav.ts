import type { NavSection, NavSubItem } from '../../components/layout/nav'
import { DashboardIcon, SettingsIcon, WalletIcon } from '../../components/icons'
import { ListBulletIcon } from './categories'

export const SPEND_ROOT = '/spend'

export function isSpendPath(pathname: string): boolean {
  return pathname === SPEND_ROOT || pathname.startsWith(`${SPEND_ROOT}/`)
}

export const spendOverviewItem: NavSubItem = {
  to: SPEND_ROOT,
  label: 'Overview',
  short: 'Home',
  description: 'This month: income, spending and what is left',
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

export const spendSettingsItem: NavSubItem = {
  to: `${SPEND_ROOT}/settings`,
  label: 'Spend settings',
  short: 'Settings',
  description: 'Pay cycle, monthly budget and Quick add defaults',
  icon: SettingsIcon,
}

export const spendNavSections: NavSection[] = [
  { title: 'Spend', items: [spendOverviewItem, spendTxnsItem] },
  { title: 'Money', items: [spendAccountsItem, spendSettingsItem] },
]

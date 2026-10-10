import type { NavSection, NavSubItem } from '../../components/layout/nav'
import { DashboardIcon, WalletIcon } from '../../components/icons'
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
  short: 'Txns',
  description: 'Every income, expense and transfer, searchable by #tag',
  icon: ListBulletIcon,
}

export const spendWalletsItem: NavSubItem = {
  to: `${SPEND_ROOT}/wallets`,
  label: 'Wallets',
  short: 'Wallets',
  description: 'Cash wallets shared with Invest, with this month in and out',
  icon: WalletIcon,
}

export const spendNavSections: NavSection[] = [
  { title: 'Spend', items: [spendOverviewItem, spendTxnsItem] },
  { title: 'Money', items: [spendWalletsItem] },
]

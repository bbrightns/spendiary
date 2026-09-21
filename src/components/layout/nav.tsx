import type { ComponentType, SVGProps } from 'react'
import {
  DashboardIcon,
  DcaIcon,
  DebtIcon,
  PortfolioIcon,
  RetirementIcon,
  SettingsIcon,
  ClockIcon,
  ScaleIcon,
  StrategyIcon,
  CashflowIcon,
  DividendIcon,
  WalletIcon,
  PieChartIcon,
} from '../icons'

export interface NavSubItem {
  to: string
  label: string
  short: string
  description: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  /**
   * Match the route exactly instead of by prefix.
   * Needed when one sub-item path is a prefix of a sibling (e.g. `/logs` vs `/logs/summary`).
   */
  exact?: boolean
}

export type StrategySubItem = NavSubItem

export interface NavItem {
  to?: string
  label: string
  short: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  /** Match the route exactly instead of by prefix (needed for `/logs` vs `/logs/summary`) */
  exact?: boolean
  subItems?: NavSubItem[]
}

export interface MobileNavItem {
  id: 'home' | 'portfolio' | 'cashflow' | 'strategies' | 'summary'
  to?: string
  label: string
  short: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  isAction?: boolean
}

export const cashflowSubItems: NavSubItem[] = [
  {
    to: '/cash',
    label: 'Cash & Liquidity',
    short: 'Cash',
    description: 'Liquid reserves, emergency runway & yield booster',
    icon: WalletIcon,
  },
  {
    to: '/dca',
    label: 'DCA Plans',
    short: 'DCA',
    description: 'Monthly salary allocation & recurring investments',
    icon: DcaIcon,
  },
  {
    to: '/dividends',
    label: 'Dividends',
    short: 'Dividends',
    description: 'Passive income tracker, payouts & withholding tax',
    icon: DividendIcon,
  },
  {
    to: '/debts',
    label: 'Debts & Installments',
    short: 'Debts',
    description: 'Track loans, BNPL, 0% installments & payoff schedule',
    icon: DebtIcon,
  },
]

export const strategySubItems: NavSubItem[] = [
  {
    to: '/rebalance',
    label: 'Portfolio Rebalancing',
    short: 'Rebalance',
    description: 'Re-align target asset weights & drift',
    icon: ScaleIcon,
  },
  {
    to: '/retirement',
    label: 'Retirement Simulator',
    short: 'Retirement',
    description: 'Simulate FIRE goals & nest egg projections',
    icon: RetirementIcon,
  },
]

export const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', short: 'Home', icon: DashboardIcon },
  { to: '/portfolio', label: 'Portfolio', short: 'Portfolio', icon: PortfolioIcon },
  {
    label: 'Cashflow',
    short: 'Flow',
    icon: CashflowIcon,
    subItems: cashflowSubItems,
  },
  {
    label: 'Strategies',
    short: 'Strategies',
    icon: StrategyIcon,
    subItems: strategySubItems,
  },
  // `exact` keeps Activity Logs from lighting up while its sibling Summary is open
  { to: '/logs', label: 'Activity Logs', short: 'Logs', icon: ClockIcon, exact: true },
  { to: '/logs/summary', label: 'Summary', short: 'Summary', icon: PieChartIcon },
]

/** True when a destination should be shown as active for the current route. */
export function isNavPathActive(to: string, pathname: string, exact?: boolean): boolean {
  if (exact) return pathname === to
  return to === '/' ? pathname === '/' : pathname.startsWith(to)
}

/** True when `pathname` should light up `sub` in any navigation surface. */
export function isSubItemActive(sub: NavSubItem, pathname: string): boolean {
  return isNavPathActive(sub.to, pathname, sub.exact)
}

export const mobileNavItems: MobileNavItem[] = [
  { id: 'home', to: '/', label: 'Dashboard', short: 'Home', icon: DashboardIcon },
  { id: 'portfolio', to: '/portfolio', label: 'Portfolio', short: 'Port', icon: PortfolioIcon },
  { id: 'cashflow', label: 'Cashflow', short: 'Flow', icon: CashflowIcon, isAction: true },
  { id: 'strategies', label: 'Strategies', short: 'Strategies', icon: StrategyIcon, isAction: true },
  { id: 'summary', to: '/logs/summary', label: 'Summary', short: 'Summary', icon: PieChartIcon },
]

export const settingsItem: NavItem = {
  to: '/settings',
  label: 'Settings',
  short: 'Settings',
  icon: SettingsIcon,
}




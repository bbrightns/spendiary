import type { ComponentType, SVGProps } from 'react'
import {
  DashboardIcon,
  DcaIcon,
  PortfolioIcon,
  RetirementIcon,
  SettingsIcon,
  ClockIcon,
  ScaleIcon,
  DividendIcon,
  DotsHorizontalIcon,
  PieChartIcon,
} from '../icons'
import { INVEST_HOME } from '../../lib/routes'

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
  id: 'home' | 'portfolio' | 'dca' | 'history' | 'more'
  to?: string
  label: string
  short: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  /** Match the route exactly instead of by prefix (e.g. `/logs` vs `/logs/summary`) */
  exact?: boolean
  isAction?: boolean
}

// Cash & liquidity moved to Spend → Accounts (one home for every wallet); Invest links there from its Cash card
export const cashflowSubItems: NavSubItem[] = [
  {
    to: '/dca',
    label: 'DCA plans',
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
]

export const strategySubItems: NavSubItem[] = [
  {
    to: '/rebalance',
    label: 'Rebalancing',
    short: 'Rebalance',
    description: 'Re-align target asset weights & drift',
    icon: ScaleIcon,
  },
  {
    to: '/retirement',
    label: 'Retirement planner',
    short: 'Retirement',
    description: 'Simulate FIRE goals & nest egg projections',
    icon: RetirementIcon,
  },
]

export interface NavSection {
  title: string
  items: NavSubItem[]
}


const dashboardItem: NavSubItem = {
  to: INVEST_HOME,
  label: 'Dashboard',
  short: 'Home',
  description: 'Net worth, allocation & monthly overview',
  icon: DashboardIcon,
}

const portfolioItem: NavSubItem = {
  to: '/portfolio',
  label: 'Portfolio',
  short: 'Portfolio',
  description: 'All holdings, allocation & profit / loss',
  icon: PortfolioIcon,
}

// `exact` keeps Trades from lighting up while its sibling P&L summary is open.
// Named "Trades", not "History": Spend's Transactions is the money history
const logsItem: NavSubItem = {
  to: '/logs',
  label: 'Trades',
  short: 'Trades',
  description: 'Every buy, sell, dividend & edit on your holdings',
  icon: ClockIcon,
  exact: true,
}

const summaryItem: NavSubItem = {
  to: '/logs/summary',
  label: 'P&L summary',
  short: 'P&L',
  description: 'Profit & loss from your trades by month or year',
  icon: PieChartIcon,
}

/** Desktop sidebar: flat, grouped by intent (frequent actions first, mirrors the mobile bottom nav). */
export const desktopNavSections: NavSection[] = [
  { title: 'Overview', items: [dashboardItem, portfolioItem] },
  { title: 'Plan', items: cashflowSubItems },
  { title: 'Analyze', items: strategySubItems },
  { title: 'Records', items: [logsItem, summaryItem] },
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
  { id: 'home', to: INVEST_HOME, label: 'Dashboard', short: 'Home', icon: DashboardIcon },
  { id: 'portfolio', to: '/portfolio', label: 'Portfolio', short: 'Port', icon: PortfolioIcon },
  { id: 'dca', to: '/dca', label: 'DCA plans', short: 'DCA', icon: DcaIcon },
  { id: 'history', to: '/logs', label: 'Trades', short: 'Trades', icon: ClockIcon, exact: true },
  { id: 'more', label: 'More', short: 'More', icon: DotsHorizontalIcon, isAction: true },
]

/**
 * Bottom-sheet contents behind the mobile "More" tab: everything that is not
 * worth a top-level slot but must stay reachable (each keeps its own badge).
 */
// Loans & installments live in Spend now (/spend/loans)
const [, dividendItem] = cashflowSubItems
const [rebalanceItem, retirementItem] = strategySubItems

export const moreSheetItems: NavSubItem[] = [
  dividendItem,
  rebalanceItem,
  retirementItem,
  summaryItem,
]

export const settingsItem: NavItem = {
  to: '/settings',
  label: 'Settings',
  short: 'Settings',
  icon: SettingsIcon,
}




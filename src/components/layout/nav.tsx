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
  id: 'home' | 'portfolio' | 'dca' | 'history' | 'more'
  to?: string
  label: string
  short: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  /** Match the route exactly instead of by prefix (e.g. `/logs` vs `/logs/summary`) */
  exact?: boolean
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

export interface NavSection {
  title: string
  items: NavSubItem[]
}

const dashboardItem: NavSubItem = {
  to: '/',
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

// `exact` keeps Activity Logs from lighting up while its sibling Summary is open
const logsItem: NavSubItem = {
  to: '/logs',
  label: 'Activity Logs',
  short: 'Logs',
  description: 'History of every buy, sell, dividend & edit',
  icon: ClockIcon,
  exact: true,
}

const summaryItem: NavSubItem = {
  to: '/logs/summary',
  label: 'Summary',
  short: 'Summary',
  description: 'Monthly activity summary & spending reports',
  icon: PieChartIcon,
}

/** Desktop sidebar: flat, grouped by intent (frequent actions first, mirrors the mobile bottom nav). */
export const desktopNavSections: NavSection[] = [
  { title: 'Overview', items: [dashboardItem, portfolioItem] },
  { title: 'Plan', items: [cashflowSubItems[1], cashflowSubItems[2], cashflowSubItems[0]] },
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
  { id: 'home', to: '/', label: 'Dashboard', short: 'Home', icon: DashboardIcon },
  { id: 'portfolio', to: '/portfolio', label: 'Portfolio', short: 'Port', icon: PortfolioIcon },
  { id: 'dca', to: '/dca', label: 'DCA Plans', short: 'DCA', icon: DcaIcon },
  { id: 'history', to: '/logs', label: 'Activity Logs', short: 'History', icon: ClockIcon, exact: true },
  { id: 'more', label: 'More', short: 'More', icon: DotsHorizontalIcon, isAction: true },
]

/**
 * Bottom-sheet contents behind the mobile "More" tab: everything that is not
 * worth a top-level slot but must stay reachable (each keeps its own badge).
 */
// Loans & installments live in Spend now (/spend/loans)
const [cashItem, , dividendItem] = cashflowSubItems
const [rebalanceItem, retirementItem] = strategySubItems

export const moreSheetItems: NavSubItem[] = [
  dividendItem,
  cashItem,
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




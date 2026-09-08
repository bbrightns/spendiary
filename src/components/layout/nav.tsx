import type { ComponentType, SVGProps } from 'react'
import {
  DashboardIcon,
  DcaIcon,
  PortfolioIcon,
  RetirementIcon,
  SettingsIcon,
  ClockIcon,
  ScaleIcon,
  StrategyIcon,
  CashflowIcon,
  DividendIcon,
} from '../icons'

export interface NavSubItem {
  to: string
  label: string
  short: string
  description: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}

export type StrategySubItem = NavSubItem

export interface NavItem {
  to?: string
  label: string
  short: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  subItems?: NavSubItem[]
}

export interface MobileNavItem {
  id: 'home' | 'portfolio' | 'cashflow' | 'strategies'
  to?: string
  label: string
  short: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  isAction?: boolean
}

export const cashflowSubItems: NavSubItem[] = [
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
  { to: '/logs', label: 'Activity Logs', short: 'Logs', icon: ClockIcon },
]

export const mobileNavItems: MobileNavItem[] = [
  { id: 'home', to: '/', label: 'Dashboard', short: 'Home', icon: DashboardIcon },
  { id: 'portfolio', to: '/portfolio', label: 'Portfolio', short: 'Port', icon: PortfolioIcon },
  { id: 'cashflow', label: 'Cashflow', short: 'Flow', icon: CashflowIcon, isAction: true },
  { id: 'strategies', label: 'Strategies', short: 'Strategies', icon: StrategyIcon, isAction: true },
]

export const settingsItem: NavItem = {
  to: '/settings',
  label: 'Settings',
  short: 'Settings',
  icon: SettingsIcon,
}




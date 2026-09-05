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
} from '../icons'

export interface StrategySubItem {
  to: string
  label: string
  short: string
  description: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}

export interface NavItem {
  to?: string
  label: string
  short: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  subItems?: StrategySubItem[]
}

export interface MobileNavItem {
  id: 'home' | 'portfolio' | 'dca' | 'strategies'
  to?: string
  label: string
  short: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  isAction?: boolean
}

export const strategySubItems: StrategySubItem[] = [
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
  { to: '/dca', label: 'DCA Planner', short: 'DCA', icon: DcaIcon },
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
  { id: 'dca', to: '/dca', label: 'DCA Planner', short: 'DCA', icon: DcaIcon },
  { id: 'strategies', label: 'Strategies', short: 'Strategies', icon: StrategyIcon, isAction: true },
]

export const settingsItem: NavItem = {
  to: '/settings',
  label: 'Settings',
  short: 'Settings',
  icon: SettingsIcon,
}



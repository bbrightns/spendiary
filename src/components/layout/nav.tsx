import type { ComponentType, SVGProps } from 'react'
import { DashboardIcon, DcaIcon, PortfolioIcon, RetirementIcon, SettingsIcon, ClockIcon } from '../icons'

export interface NavItem {
  to: string
  label: string
  short: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}

export const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', short: 'Home', icon: DashboardIcon },
  { to: '/portfolio', label: 'Portfolio', short: 'Portfolio', icon: PortfolioIcon },
  { to: '/logs', label: 'Activity Logs', short: 'Logs', icon: ClockIcon },
  { to: '/dca', label: 'DCA Planner', short: 'DCA', icon: DcaIcon },
  { to: '/retirement', label: 'Retirement', short: 'Retire', icon: RetirementIcon },
]

export const settingsItem: NavItem = {
  to: '/settings',
  label: 'Settings',
  short: 'Settings',
  icon: SettingsIcon,
}


import type { FC, SVGProps } from 'react'
import type { LucideIcon } from 'lucide-react'

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'ref'>

/** The app's line weight: Lucide's default (2) looks heavier than the rest of the app */
export const ICON_STROKE = 1.6

/** A Lucide icon with the app's defaults; props passed in (className, strokeWidth, …) still win */
export function appIcon(Icon: LucideIcon, name: string): FC<IconProps> {
  const AppIcon = (p: IconProps) => <Icon strokeWidth={ICON_STROKE} {...p} />
  AppIcon.displayName = name
  return AppIcon
}

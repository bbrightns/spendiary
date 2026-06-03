import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  viewBox: '0 0 24 24',
}

export function DashboardIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <rect x="3" y="3" width="7.5" height="9" rx="2" />
      <rect x="13.5" y="3" width="7.5" height="6" rx="2" />
      <rect x="13.5" y="13" width="7.5" height="8" rx="2" />
      <rect x="3" y="15" width="7.5" height="6" rx="2" />
    </svg>
  )
}

export function PortfolioIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M3 17.5 9 11l4 3.5L21 6" />
      <path d="M21 11V6h-5" />
    </svg>
  )
}

export function DcaIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M12 21a9 9 0 1 0-9-9" />
      <path d="M3 12 5.5 9.5M3 12l2.5 2.5" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

export function TransferIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M4 8h13M14 5l3 3-3 3" />
      <path d="M20 16H7M10 19l-3-3 3-3" />
    </svg>
  )
}

export function WalletIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H17a2 2 0 0 1 2 2v.5" />
      <path d="M3 7.5V17a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5.5A2.5 2.5 0 0 1 3 7.5Z" />
      <circle cx="16.5" cy="13" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function ArrowUpRight(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  )
}

export function ArrowDownRight(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M7 7l10 10M17 8v9H8" />
    </svg>
  )
}

export function ClockIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

export function AlertIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M10.3 3.8 2.5 17.5A2 2 0 0 0 4.2 20.5h15.6a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 16.5h.01" />
    </svg>
  )
}

export function PlusIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function SparkleIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M12 3.5 13.6 9 19 10.5 13.6 12 12 17.5 10.4 12 5 10.5 10.4 9 12 3.5Z" />
      <path d="M19 4v3M20.5 5.5h-3" />
    </svg>
  )
}

export function CheckIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M5 12.5 10 17 19 7" />
    </svg>
  )
}

export function TargetIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function PencilIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M14 5.5 18.5 10M4 20l1-4L16 5a2.1 2.1 0 0 1 3 3L8 19l-4 1Z" />
    </svg>
  )
}

export function TrashIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M4 7h16M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2" />
      <path d="M6 7l1 12a2 2 0 0 0 2 1.8h6a2 2 0 0 0 2-1.8L18 7" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  )
}

export function CloseIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

export function CoinsIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <ellipse cx="9" cy="7" rx="6" ry="3" />
      <path d="M3 7v5c0 1.7 2.7 3 6 3" />
      <path d="M15 9.5c3.3 0 6 1.3 6 3v5c0 1.7-2.7 3-6 3s-6-1.3-6-3v-5" />
    </svg>
  )
}

export function SettingsIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <line x1="3" y1="6" x2="12" y2="6" />
      <circle cx="14" cy="6" r="2" />
      <line x1="16" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="6" y2="12" />
      <circle cx="8" cy="12" r="2" />
      <line x1="10" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="15" y2="18" />
      <circle cx="17" cy="18" r="2" />
      <line x1="19" y1="18" x2="21" y2="18" />
    </svg>
  )
}

export function DownloadIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M12 3v12M8 11l4 4 4-4" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  )
}

export function UploadIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M12 15V3M8 7l4-4 4 4" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  )
}

export function RetirementIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M3 20h18" />
      <path d="M5 20V10l7-7 7 7v10" />
      <path d="M9 20v-5h6v5" />
      <circle cx="12" cy="9" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

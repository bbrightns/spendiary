import type { ReactNode } from 'react'
import { useReducedMotion } from '../../lib/useReducedMotion'

interface ProgressRingProps {
  /** 0–100 */
  value: number
  size?: number
  thickness?: number
  color?: string
  trackColor?: string
  ariaLabel?: string
  children?: ReactNode
}

export function ProgressRing({
  value,
  size = 120,
  thickness = 12,
  color = 'var(--color-brand)',
  trackColor = 'var(--color-surface-muted)',
  ariaLabel,
  children,
}: ProgressRingProps) {
  const reducedMotion = useReducedMotion()
  const clamped = Math.max(0, Math.min(100, value))
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const dash = (clamped / 100) * circumference

  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        role="img"
        aria-label={ariaLabel ?? `Progress chart showing ${clamped}%`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={thickness}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          style={{
            transition: reducedMotion
              ? 'none'
              : 'stroke-dasharray 0.9s cubic-bezier(0.16,1,0.3,1)',
          }}
        />
      </svg>
      {children && <div className="absolute inset-0 flex items-center justify-center">{children}</div>}
    </div>
  )
}

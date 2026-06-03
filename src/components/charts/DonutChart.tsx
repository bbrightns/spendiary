import { useReducedMotion } from '../../lib/useReducedMotion'

interface Segment {
  label: string
  value: number
  color: string
}

interface DonutChartProps {
  segments: Segment[]
  size?: number
  thickness?: number
  ariaLabel?: string
  /** Rendered in the middle of the ring */
  centerLabel?: string
  centerValue?: string
}

/** A minimal, premium donut built from stroked SVG arcs. */
export function DonutChart({
  segments,
  size = 200,
  thickness = 22,
  ariaLabel,
  centerLabel,
  centerValue,
}: DonutChartProps) {
  const reducedMotion = useReducedMotion()
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const gap = segments.length > 1 ? 0.012 * circumference : 0

  let offset = 0
  const arcs = segments.map((seg) => {
    const fraction = total > 0 ? seg.value / total : 0
    const len = Math.max(fraction * circumference - gap, 0)
    const arc = {
      ...seg,
      dasharray: `${len} ${circumference - len}`,
      dashoffset: -offset,
    }
    offset += fraction * circumference
    return arc
  })

  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        role="img"
        aria-label={
          ariaLabel ??
          `Donut chart showing ${segments.map((seg) => `${seg.label}: ${seg.value}`).join(', ')}`
        }
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-surface-muted)"
          strokeWidth={thickness}
        />
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={arc.color}
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={arc.dasharray}
            strokeDashoffset={arc.dashoffset}
            style={{
              transition: reducedMotion
                ? 'none'
                : 'stroke-dasharray 0.9s cubic-bezier(0.16,1,0.3,1)',
            }}
          />
        ))}
      </svg>
      {(centerLabel || centerValue) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {centerLabel && (
            <span className="text-[12.5px] font-medium text-ink-soft">
              {centerLabel}
            </span>
          )}
          {centerValue && (
            <span className="font-display text-xl font-bold tnum text-ink">{centerValue}</span>
          )}
        </div>
      )}
    </div>
  )
}

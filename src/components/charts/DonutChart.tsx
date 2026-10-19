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
  /** Draw "label pct%" callouts around the ring for slices of at least `labelMinPct` percent */
  showLabels?: boolean
  labelMinPct?: number
}

/** Room left beside and above the ring for callout text */
const LABEL_PAD_X = 96
const LABEL_PAD_Y = 22
/** Smallest vertical distance between two callouts on the same side */
const LABEL_GAP = 13
const LABEL_MAX_CHARS = 7
/** Slices below this share of the ring count as the small tail that gets turned to the left side */
const SMALL_SLICE = 0.1

interface Callout {
  key: number
  text: string
  color: string
  right: boolean
  /** Point on the ring edge */
  ax: number
  ay: number
  /** Where the text sits once spread apart */
  y: number
}

/** Push callouts on one side apart so their text never overlaps, staying inside [minY, maxY] */
function spread(callouts: Callout[], minY: number, maxY: number) {
  callouts.sort((a, b) => a.y - b.y)
  for (let i = 0; i < callouts.length; i++) {
    const floor = i === 0 ? minY : callouts[i - 1].y + LABEL_GAP
    callouts[i].y = Math.max(callouts[i].y, floor)
  }
  for (let i = callouts.length - 1; i >= 0; i--) {
    const ceiling = i === callouts.length - 1 ? maxY : callouts[i + 1].y - LABEL_GAP
    callouts[i].y = Math.min(callouts[i].y, ceiling)
  }
}

const shorten = (s: string) => (s.length > LABEL_MAX_CHARS ? `${s.slice(0, LABEL_MAX_CHARS - 1)}…` : s)

/** A minimal, premium donut built from stroked SVG arcs. */
export function DonutChart({
  segments,
  size = 200,
  thickness = 22,
  ariaLabel,
  centerLabel,
  centerValue,
  showLabels = false,
  labelMinPct = 3,
}: DonutChartProps) {
  const reducedMotion = useReducedMotion()
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const gap = segments.length > 1 ? 0.012 * circumference : 0

  const padX = showLabels ? LABEL_PAD_X : 0
  const padY = showLabels ? LABEL_PAD_Y : 0
  const width = size + padX * 2
  const height = size + padY * 2
  const cx = width / 2
  const cy = height / 2

  // With callouts, turn the ring so the run of small trailing slices centres on 9 o'clock:
  // that's where a side has the most height, so their labels spread out instead of piling up at the top
  let turn = 0
  if (showLabels && total > 0) {
    let tail = 0
    for (let i = segments.length - 1; i >= 0 && segments[i].value / total < SMALL_SLICE; i--) {
      tail += segments[i].value / total
    }
    if (tail > 0 && tail < 1) turn = tail / 2 - 0.25
  }

  let offset = 0
  const callouts: Callout[] = []
  const arcs = segments.map((seg, i) => {
    const fraction = total > 0 ? seg.value / total : 0
    const len = Math.max(fraction * circumference - gap, 0)
    const arc = {
      ...seg,
      dasharray: `${len} ${circumference - len}`,
      dashoffset: -offset,
    }
    if (showLabels && fraction * 100 >= labelMinPct) {
      // Arcs start at 12 o'clock (plus the turn) and run clockwise
      const mid = -Math.PI / 2 + ((offset + (fraction * circumference) / 2) / circumference + turn) * 2 * Math.PI
      const edge = radius + thickness / 2 + 2
      const ax = cx + edge * Math.cos(mid)
      const ay = cy + edge * Math.sin(mid)
      callouts.push({
        key: i,
        text: `${shorten(seg.label)} ${(fraction * 100).toFixed(1)}%`,
        color: seg.color,
        right: Math.cos(mid) >= 0,
        ax,
        ay,
        y: cy + (edge + 8) * Math.sin(mid),
      })
    }
    offset += fraction * circumference
    return arc
  })

  const minY = 6
  const maxY = height - 6
  spread(callouts.filter((c) => c.right), minY, maxY)
  spread(callouts.filter((c) => !c.right), minY, maxY)
  // Text hugs the ring: it starts on a circle just outside it, at the callout's height,
  // so leader lines stay short and the text never runs back over the ring
  const textRadius = radius + thickness / 2 + 12
  const textX = (c: Callout) => {
    const dy = c.y - cy
    const dx = Math.sqrt(Math.max(textRadius * textRadius - dy * dy, 0))
    return c.right ? cx + dx : cx - dx
  }

  return (
    <div
      className="relative inline-grid place-items-center max-w-full"
      style={{ width, aspectRatio: `${width} / ${height}` }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={
          ariaLabel ??
          `Donut chart showing ${segments.map((seg) => `${seg.label}: ${seg.value}`).join(', ')}`
        }
        className="overflow-visible"
      >
        <g transform={`rotate(${-90 + turn * 360} ${cx} ${cy})`}>
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="var(--color-surface-muted)"
            strokeWidth={thickness}
          />
          {arcs.map((arc, i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
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
            >
              <title>{arc.label}</title>
            </circle>
          ))}
        </g>
        {callouts.map((c) => {
          const tx = textX(c)
          return (
            <g key={c.key} aria-hidden="true">
              <polyline
                points={`${c.ax},${c.ay} ${c.right ? tx - 4 : tx + 4},${c.y} ${tx - (c.right ? 1 : -1)},${c.y}`}
                fill="none"
                stroke={c.color}
                strokeWidth={1}
                opacity={0.8}
              />
              <text
                x={c.right ? tx + 2 : tx - 2}
                y={c.y}
                dominantBaseline="middle"
                textAnchor={c.right ? 'start' : 'end'}
                fontSize={10}
                fontWeight={600}
                fill="var(--color-ink-soft)"
                className="tnum"
              >
                {c.text}
              </text>
            </g>
          )
        })}
      </svg>
      {(centerLabel || centerValue) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {centerLabel && (
            <span className="text-xs font-medium text-ink-soft">
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

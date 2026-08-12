import { useMemo, useState } from 'react'
import type { NetWorthSnapshot } from '../../lib/types'
import { thb, thbCompact } from '../../lib/format'

type TimeFrame = '1M' | '3M' | '6M' | '1Y' | 'ALL'

interface InteractiveNetWorthChartProps {
  history: NetWorthSnapshot[]
}

export function InteractiveNetWorthChart({ history }: InteractiveNetWorthChartProps) {
  const [timeframe, setTimeframe] = useState<TimeFrame>('ALL')
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  // Filter history based on timeframe
  const filteredHistory = useMemo(() => {
    if (!history || history.length === 0) return []
    if (timeframe === 'ALL') return history

    const now = new Date()
    const daysMap: Record<TimeFrame, number> = {
      '1M': 30,
      '3M': 90,
      '6M': 180,
      '1Y': 365,
      ALL: Infinity,
    }
    const cutoff = new Date(now.getTime() - daysMap[timeframe] * 24 * 60 * 60 * 1000)

    const subset = history.filter((s) => {
      const [y, m, d] = s.date.split('-').map(Number)
      return new Date(y, m - 1, d) >= cutoff
    })

    // If filtering results in < 2 points, fallback to at least the available history
    return subset.length >= 2 ? subset : history
  }, [history, timeframe])

  // Chart dimensions & calculations
  const W = 800
  const H = 200
  const PAD_X = 16
  const PAD_Y = 24
  const iW = W - PAD_X * 2
  const iH = H - PAD_Y * 2

  const vals = filteredHistory.map((s) => s.value)
  const minV = Math.min(...vals)
  const maxV = Math.max(...vals)
  const range = maxV - minV || 1

  const pts = useMemo(() => {
    return filteredHistory.map((s, i) => ({
      x: PAD_X + (i / Math.max(1, filteredHistory.length - 1)) * iW,
      y: PAD_Y + (1 - (s.value - minV) / range) * iH,
      ...s,
    }))
  }, [filteredHistory, minV, range, iW, iH])

  const linePath = useMemo(() => {
    if (pts.length === 0) return ''
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  }, [pts])

  const areaPath = useMemo(() => {
    if (pts.length === 0) return ''
    return `${linePath} L${pts[pts.length - 1].x.toFixed(1)},${H} L${pts[0].x.toFixed(1)},${H}Z`
  }, [linePath, pts, H])

  if (filteredHistory.length < 2) {
    return null
  }

  const first = filteredHistory[0]
  const last = filteredHistory[filteredHistory.length - 1]
  const change = last.value - first.value
  const isUp = change >= 0
  const colorVar = isUp ? 'var(--color-cash)' : 'var(--color-loss)'

  const [y0, mo0, d0] = first.date.split('-').map(Number)
  const startDate = new Date(y0, mo0 - 1, d0).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const [y1, mo1, d1] = last.date.split('-').map(Number)
  const endDate = new Date(y1, mo1 - 1, d1).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

  const activePoint = hoveredIndex !== null ? pts[hoveredIndex] : pts[pts.length - 1]
  const activeChangeFromStart = activePoint ? activePoint.value - first.value : 0
  const activeChangePct = first.value > 0 ? (activeChangeFromStart / first.value) * 100 : 0

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const clientX = e.clientX - rect.left
    const normalizedX = (clientX / rect.width) * W
    const clampedX = Math.max(PAD_X, Math.min(W - PAD_X, normalizedX))
    
    // Find nearest point
    let nearestIdx = 0
    let minDiff = Infinity
    pts.forEach((p, idx) => {
      const diff = Math.abs(p.x - clampedX)
      if (diff < minDiff) {
        minDiff = diff
        nearestIdx = idx
      }
    })
    setHoveredIndex(nearestIdx)
  }

  const handleMouseLeave = () => {
    setHoveredIndex(null)
  }

  return (
    <div className="relative flex flex-col justify-between h-full">
      {/* Header with Title, Stats & Timeframe Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-[16px] font-bold text-ink">Net Worth Performance</h2>
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold text-ink-muted">
              {filteredHistory.length} snapshots
            </span>
          </div>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">
            {hoveredIndex !== null ? (
              <span>
                Inspecting: <strong className="text-ink font-semibold">{activePoint.date}</strong>
              </span>
            ) : (
              <span>{startDate} — {endDate}</span>
            )}
          </p>
        </div>

        {/* Right side: Gain / Value badge & Timeframe filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div
            className={`flex items-baseline gap-1 rounded-full px-3 py-1 text-[13px] font-bold ${
              isUp ? 'bg-gain-soft text-gain' : 'bg-loss-soft text-loss'
            }`}
          >
            <span>{isUp ? '▲' : '▼'} {Math.abs(activeChangePct).toFixed(1)}%</span>
            <span className="text-[11px] font-medium opacity-75">
              ({isUp ? '+' : ''}{thbCompact(activeChangeFromStart)})
            </span>
          </div>

          <div className="flex items-center rounded-xl bg-surface-muted p-0.5 border border-line/60">
            {(['1M', '3M', '6M', '1Y', 'ALL'] as TimeFrame[]).map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1 text-[11.5px] font-semibold rounded-lg transition-all cursor-pointer ${
                  timeframe === tf
                    ? 'bg-surface text-ink shadow-xs font-bold'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SVG Chart Surface */}
      <div className="relative px-4 pt-2 pb-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full overflow-visible"
          style={{ height: '150px', display: 'block', cursor: 'crosshair' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          aria-label="Net worth history interactive performance chart"
        >
          <defs>
            <linearGradient id="nwInteractiveGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: colorVar, stopOpacity: 0.28 }} />
              <stop offset="60%" style={{ stopColor: colorVar, stopOpacity: 0.08 }} />
              <stop offset="100%" style={{ stopColor: colorVar, stopOpacity: 0 }} />
            </linearGradient>
          </defs>

          {/* Horizontal grid lines */}
          <line
            x1={PAD_X}
            y1={PAD_Y}
            x2={W - PAD_X}
            y2={PAD_Y}
            stroke="var(--color-line)"
            strokeDasharray="4 4"
            strokeWidth={1}
            opacity={0.6}
          />
          <line
            x1={PAD_X}
            y1={PAD_Y + iH / 2}
            x2={W - PAD_X}
            y2={PAD_Y + iH / 2}
            stroke="var(--color-line)"
            strokeDasharray="4 4"
            strokeWidth={1}
            opacity={0.6}
          />
          <line
            x1={PAD_X}
            y1={H - PAD_Y}
            x2={W - PAD_X}
            y2={H - PAD_Y}
            stroke="var(--color-line)"
            strokeDasharray="4 4"
            strokeWidth={1}
            opacity={0.6}
          />

          {/* Area & Line */}
          <path d={areaPath} fill="url(#nwInteractiveGrad)" className="transition-all duration-300" />
          <path
            d={linePath}
            fill="none"
            style={{ stroke: colorVar }}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-all duration-300"
          />

          {/* Active Hover Guide & Point */}
          {activePoint && (
            <g className="transition-transform duration-100 ease-out">
              {/* Vertical dotted guide */}
              <line
                x1={activePoint.x}
                y1={PAD_Y}
                x2={activePoint.x}
                y2={H - 8}
                stroke={colorVar}
                strokeWidth={1.5}
                strokeDasharray="3 3"
                opacity={0.7}
              />
              {/* Glow ring & solid center */}
              <circle cx={activePoint.x} cy={activePoint.y} r={7} fill={colorVar} opacity={0.25} />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r={4.5}
                fill={colorVar}
                stroke="var(--color-surface)"
                strokeWidth={2}
              />
            </g>
          )}
        </svg>

        {/* Dynamic Tooltip Bar */}
        <div className="mt-1 flex items-center justify-between border-t border-line/60 px-2 pt-2 text-[11.5px]">
          <span className="text-ink-muted">
            Min: <strong className="font-semibold tnum text-ink">{thbCompact(minV)}</strong>
          </span>
          <span className="font-display font-bold tnum text-[13px] text-ink">
            {activePoint ? thb(activePoint.value) : thb(last.value)}
          </span>
          <span className="text-ink-muted">
            Peak: <strong className="font-semibold tnum text-ink">{thbCompact(maxV)}</strong>
          </span>
        </div>
      </div>
    </div>
  )
}

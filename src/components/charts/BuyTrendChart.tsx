import { useEffect, useMemo, useRef, useState } from 'react'
import type { TrendPoint, TrendSell } from '../../lib/buyTrend'
import { axisPrice, unitPrice } from '../../lib/buyTrendFormat'

interface BuyTrendChartProps {
  points: TrendPoint[]
  sells: TrendSell[]
  /** Average buy price now */
  avg: number | null
  /** Market price now; null when the holding has no real price */
  current: number | null
  /** Index of the dot being inspected, or null */
  active: number | null
  onActive: (index: number | null) => void
}

const H = 220
const PAD = { top: 16, right: 56, bottom: 26, left: 12 }

function dayNum(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / 86_400_000
}

function shortDate(date: string, withYear: boolean): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', withYear ? { month: 'short', year: '2-digit' } : { day: 'numeric', month: 'short' })
}

/**
 * Each buy as a dot at the price paid (filled = DCA, ring = bought by hand), the average buy price
 * as a step line, today's price as a dashed line, and sales as small down-pointing marks.
 * Drawn in real pixels (the width is measured) so dots and text never stretch.
 */
export function BuyTrendChart({ points, sells, avg, current, active, onActive }: BuyTrendChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(600)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => setW(Math.max(260, el.clientWidth))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const geo = useMemo(() => {
    const days = [...points.map((p) => p.date), ...sells.map((s) => s.date)].map(dayNum)
    let x0 = Math.min(...days)
    let x1 = Math.max(...days)
    if (x1 - x0 < 1) { x0 -= 1; x1 += 1 }
    const prices = [
      ...points.map((p) => p.price),
      ...points.map((p) => p.avgAfter),
      ...sells.map((s) => s.price),
      ...(current ? [current] : []),
    ]
    let y0 = Math.min(...prices)
    let y1 = Math.max(...prices)
    const span = y1 - y0 || Math.abs(y1) * 0.1 || 1
    y0 -= span * 0.1
    y1 += span * 0.1
    const iW = W - PAD.left - PAD.right
    const iH = H - PAD.top - PAD.bottom
    const x = (date: string) => PAD.left + ((dayNum(date) - x0) / (x1 - x0)) * iW
    const y = (price: number) => PAD.top + (1 - (price - y0) / (y1 - y0)) * iH
    const maxThb = Math.max(...points.map((p) => p.thb))
    // 2.5–5px: big enough to tap near, small enough that a busy month stays readable
    const r = (thbAmount: number) => 2.5 + 2.5 * Math.sqrt(thbAmount / (maxThb || 1))
    return { x, y, r, y0, y1 }
  }, [points, sells, current, W])

  // The average holds from one buy to the next, then steps; it runs on to the right edge
  const avgPath = useMemo(() => {
    if (!points.length) return ''
    let d = ''
    points.forEach((p, i) => {
      const px = geo.x(p.date).toFixed(1)
      const py = geo.y(p.avgAfter).toFixed(1)
      d += i === 0 ? `M${px},${py}` : ` H${px} V${py}`
    })
    return `${d} H${(W - PAD.right).toFixed(1)}`
  }, [points, geo, W])

  const nearest = (clientX: number) => {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect || !points.length) return null
    const px = clientX - rect.left
    let best = 0
    let bestDiff = Infinity
    points.forEach((p, i) => {
      const diff = Math.abs(geo.x(p.date) - px)
      if (diff < bestDiff) { bestDiff = diff; best = i }
    })
    return best
  }

  const colorOf = (price: number) =>
    current === null ? 'var(--color-invest)' : price <= current ? 'var(--color-gain)' : 'var(--color-loss)'

  const gridPrices = [geo.y1, (geo.y0 + geo.y1) / 2, geo.y0]
  const first = points[0]?.date
  const last = points[points.length - 1]?.date
  const multiYear = first && last ? first.slice(0, 4) !== last.slice(0, 4) : false
  const activePoint = active !== null ? points[active] : undefined

  return (
    <div ref={wrapRef} className="relative w-full select-none">
      <svg
        width={W}
        height={H}
        className="block touch-pan-y"
        role="img"
        aria-label={`Buy prices from ${first ?? ''} to ${last ?? ''}${avg ? `, average ${unitPrice(avg)}` : ''}${current ? `, now ${unitPrice(current)}` : ''}`}
        onPointerMove={(e) => onActive(nearest(e.clientX))}
        onPointerDown={(e) => onActive(nearest(e.clientX))}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse') onActive(null) }}
      >
        {gridPrices.map((p, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={W - PAD.right} y1={geo.y(p)} y2={geo.y(p)} stroke="var(--color-line)" strokeDasharray="4 4" />
            <text x={W - PAD.right + 6} y={geo.y(p) + 4} fontSize={12} fill="var(--color-ink-muted)" className="tnum">
              {axisPrice(p)}
            </text>
          </g>
        ))}

        {activePoint && (
          <line
            x1={geo.x(activePoint.date)}
            x2={geo.x(activePoint.date)}
            y1={PAD.top}
            y2={H - PAD.bottom}
            stroke="var(--color-line-strong)"
            strokeWidth={1.5}
          />
        )}

        {current !== null && (
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={geo.y(current)}
            y2={geo.y(current)}
            stroke="var(--color-invest)"
            strokeWidth={1.5}
            strokeDasharray="6 4"
          />
        )}

        <path d={avgPath} fill="none" stroke="var(--color-ink-soft)" strokeWidth={2} strokeLinejoin="round" />

        {sells.map((s) => {
          const sx = geo.x(s.date)
          const sy = geo.y(s.price)
          return (
            <path
              key={s.id}
              d={`M${sx - 5},${sy - 4} L${sx + 5},${sy - 4} L${sx},${sy + 4}Z`}
              fill="var(--color-ink-muted)"
            />
          )
        })}

        {points.map((p, i) => {
          const c = colorOf(p.price)
          const isActive = i === active
          return (
            <circle
              key={p.key}
              cx={geo.x(p.date)}
              cy={geo.y(p.price)}
              r={geo.r(p.thb) + (isActive ? 2 : 0)}
              fill={p.dca ? c : 'var(--color-surface)'}
              fillOpacity={p.dca ? (isActive ? 1 : 0.75) : 1}
              stroke={p.dca ? 'var(--color-surface)' : c}
              strokeWidth={p.dca ? 1.5 : 2}
            />
          )
        })}

        {first && (
          <text x={PAD.left} y={H - 6} fontSize={12} fill="var(--color-ink-muted)">{shortDate(first, multiYear)}</text>
        )}
        {last && last !== first && (
          <text x={W - PAD.right} y={H - 6} fontSize={12} fill="var(--color-ink-muted)" textAnchor="end">{shortDate(last, multiYear)}</text>
        )}
      </svg>
    </div>
  )
}

import { useState } from 'react'
import { useReducedMotion } from '../../lib/useReducedMotion'

export interface AllocationItem {
  id: string
  label: string
  value: number
  color: string
  changePct?: string
}

interface AssetAllocationDonutCardProps {
  title?: string
  totalValue?: number
  items?: AllocationItem[]
  currencySymbol?: string
}

const DEFAULT_ITEMS: AllocationItem[] = [
  { id: '1', label: 'Mutual Funds', value: 350100, color: '#818cf8', changePct: '+57%' },
  { id: '2', label: 'US Stocks', value: 215500, color: '#38bdf8', changePct: '+35%' },
  { id: '3', label: 'Bitcoin', value: 36600, color: '#f59e0b', changePct: '+6%' },
  { id: '4', label: 'Gold', value: 15200, color: '#d97706', changePct: '+2%' },
]

function formatCompactBaht(val: number, symbol = '฿'): string {
  if (val >= 1_000_000) {
    return `${symbol}${(val / 1_000_000).toFixed(1)}M`
  }
  if (val >= 1_000) {
    return `${symbol}${(val / 1_000).toFixed(1)}K`
  }
  return `${symbol}${val.toLocaleString()}`
}

export function AssetAllocationDonutCard({
  title = 'Asset Allocation',
  totalValue,
  items = DEFAULT_ITEMS,
  currencySymbol = '฿',
}: AssetAllocationDonutCardProps) {
  const reducedMotion = useReducedMotion()
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const calcTotal = totalValue ?? items.reduce((acc, item) => acc + item.value, 0)

  // SVG ring setup
  const size = 220
  const strokeWidth = 24
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius

  let accumulatedPercent = 0
  const arcs = items.map((item) => {
    const fraction = calcTotal > 0 ? item.value / calcTotal : 0
    const strokeDasharray = `${fraction * circumference} ${circumference}`
    const strokeDashoffset = -accumulatedPercent * circumference
    accumulatedPercent += fraction

    return {
      ...item,
      fraction,
      strokeDasharray,
      strokeDashoffset,
    }
  })

  return (
    <div className="relative overflow-hidden rounded-3xl bg-[#0d101d] p-6 text-white shadow-2xl ring-1 ring-white/10">
      {/* Background glow effects */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-sky-600/15 blur-3xl" />

      {/* Card Header */}
      <div className="relative z-10 mb-6 flex items-center justify-between">
        <h3 className="font-display text-lg font-bold tracking-tight text-slate-100">{title}</h3>
        <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-slate-300 backdrop-blur-md">
          Live Portfolio
        </span>
      </div>

      {/* Main Content Layout */}
      <div className="relative z-10 flex flex-col items-center gap-8 md:flex-row md:items-center md:justify-around">
        {/* Donut Ring Container */}
        <div className="relative inline-flex items-center justify-center">
          <svg
            width={size}
            height={size}
            className="-rotate-90 transform drop-shadow-[0_0_12px_rgba(99,102,241,0.25)]"
          >
            {/* Background Ring Track */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#1e2438"
              strokeWidth={strokeWidth}
            />

            {/* Arc Segments */}
            {arcs.map((arc) => {
              const isHovered = hoveredId === arc.id
              return (
                <circle
                  key={arc.id}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={arc.color}
                  strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                  strokeDasharray={arc.strokeDasharray}
                  strokeDashoffset={arc.strokeDashoffset}
                  strokeLinecap="round"
                  onMouseEnter={() => setHoveredId(arc.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className="cursor-pointer transition-all duration-300"
                  style={{
                    opacity: hoveredId && !isHovered ? 0.35 : 1,
                    transition: reducedMotion
                      ? 'none'
                      : 'stroke-width 0.25s ease, opacity 0.25s ease, stroke-dasharray 0.8s ease',
                  }}
                />
              )
            })}
          </svg>

          {/* Center Label inside Donut Ring */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[12px] font-medium text-slate-400 uppercase tracking-wider">
              {hoveredId
                ? items.find((i) => i.id === hoveredId)?.label ?? 'Total'
                : 'Total'}
            </span>
            <span className="font-display text-2xl font-extrabold tracking-tight text-white drop-shadow-sm">
              {hoveredId
                ? formatCompactBaht(
                    items.find((i) => i.id === hoveredId)?.value ?? calcTotal,
                    currencySymbol
                  )
                : formatCompactBaht(calcTotal, currencySymbol)}
            </span>
          </div>
        </div>

        {/* Legend / Breakdown List */}
        <div className="w-full flex-1 space-y-3.5 md:max-w-xs">
          {items.map((item) => {
            const isHovered = hoveredId === item.id
            const fraction = calcTotal > 0 ? (item.value / calcTotal) * 100 : 0

            return (
              <div
                key={item.id}
                onMouseEnter={() => setHoveredId(item.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={`flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 transition-all duration-200 ${
                  isHovered ? 'bg-white/10 scale-[1.02]' : 'hover:bg-white/5'
                }`}
              >
                {/* Left: Dot & Name */}
                <div className="flex items-center gap-3">
                  <span
                    className="h-3 w-3 rounded-full transition-transform duration-300"
                    style={{
                      backgroundColor: item.color,
                      transform: isHovered ? 'scale(1.25)' : 'scale(1)',
                      boxShadow: `0 0 8px ${item.color}80`,
                    }}
                  />
                  <span className="text-[14px] font-semibold text-slate-200">{item.label}</span>
                </div>

                {/* Right: Change Badge & Value */}
                <div className="flex items-center gap-4">
                  {item.changePct ? (
                    <span className="text-[12px] font-semibold text-slate-400">
                      {item.changePct}
                    </span>
                  ) : (
                    <span className="text-[12px] font-semibold text-slate-400">
                      {fraction.toFixed(0)}%
                    </span>
                  )}
                  <span className="font-display text-[15px] font-bold text-white tnum">
                    {formatCompactBaht(item.value, currencySymbol)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

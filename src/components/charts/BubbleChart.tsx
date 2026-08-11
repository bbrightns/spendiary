import { thbCompact, pct } from '../../lib/format'

export interface BubbleItem {
  id: string
  label: string
  value: number
  pct: number
  color: string
  icon?: string
}

interface BubbleChartProps {
  items: BubbleItem[]
  totalValue: number
  size?: number
}

// Default icons for asset classes
const DEFAULT_ICONS: Record<string, string> = {
  fund: '📊',
  stock: '📈',
  crypto: '₿',
  gold: '🪙',
  cash: '💵',
}

export function BubbleChart({
  items,
  totalValue,
  size = 320,
}: BubbleChartProps) {
  // Filter items with value > 0 and sort by value descending
  const validItems = items.filter((item) => item.value > 0).sort((a, b) => b.value - a.value)

  if (validItems.length === 0) {
    return (
      <div className="flex h-64 w-full items-center justify-center text-ink-muted text-sm font-medium">
        No asset data available
      </div>
    )
  }

  // The largest item is ALWAYS in the center
  const centerItem = validItems[0]
  const otherItems = validItems.slice(1)

  // Initial center position reference
  const centerPos = size / 2

  // Determine radii proportional to sqrt of value percentage
  const centerRadius = Math.max(52, Math.min(75, Math.sqrt(centerItem.value / (totalValue || 1)) * 95))

  // Calculate satellite bubble positions without any overlap
  const satellites = otherItems.map((item, idx) => {
    const itemRatio = Math.sqrt(item.value / (totalValue || 1))
    const r = Math.max(28, Math.min(50, itemRatio * 95))

    // Distance from center = centerRadius + satelliteRadius + gap (10px gap between circles)
    const dist = centerRadius + r + 10

    // Distribute angles evenly around center circle
    const angleStep = (2 * Math.PI) / Math.max(otherItems.length, 1)
    const angle = -Math.PI / 2 + idx * angleStep

    const cx = centerPos + Math.cos(angle) * dist
    const cy = centerPos + Math.sin(angle) * dist

    return {
      ...item,
      r,
      cx,
      cy,
    }
  })

  // Determine actual container size needed
  const maxExtent = Math.max(
    centerRadius,
    ...satellites.map((s) => Math.hypot(s.cx - centerPos, s.cy - centerPos) + s.r)
  )
  const containerSize = Math.max(size, Math.ceil(maxExtent * 2 + 16))
  const finalCenterPos = containerSize / 2
  const offset = finalCenterPos - centerPos

  return (
    <div className="relative flex flex-col items-center justify-center select-none w-full my-2">
      <div
        className="relative"
        style={{ width: containerSize, height: containerSize, maxWidth: '100%' }}
      >
        {/* Central Bubble (Always the largest item) */}
        <div
          className="absolute transform -translate-x-1/2 -translate-y-1/2 rounded-full flex flex-col items-center justify-center p-3 text-center border-2 border-white/20 dark:border-white/10 shadow-md"
          style={{
            left: finalCenterPos,
            top: finalCenterPos,
            width: centerRadius * 2,
            height: centerRadius * 2,
            backgroundColor: centerItem.color,
            color: '#ffffff',
          }}
        >
          <span className="text-xl sm:text-2xl mb-0.5 filter drop-shadow-sm">
            {centerItem.icon || DEFAULT_ICONS[centerItem.id] || '💰'}
          </span>
          <span className="text-[12px] font-bold opacity-90 line-clamp-1 leading-tight">
            {centerItem.label}
          </span>
          <span className="font-display text-[16px] sm:text-[18px] font-extrabold tnum mt-0.5 leading-none">
            {thbCompact(centerItem.value)}
          </span>
          <span className="mt-1 inline-block rounded-full bg-black/20 px-2 py-0.5 text-[10.5px] font-bold tnum">
            {pct(centerItem.pct, 0)}
          </span>
        </div>

        {/* Satellite Bubbles */}
        {satellites.map((sat) => (
          <div
            key={sat.id}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 rounded-full flex flex-col items-center justify-center p-2 text-center border border-white/20 dark:border-white/10 shadow-sm"
            style={{
              left: sat.cx + offset,
              top: sat.cy + offset,
              width: sat.r * 2,
              height: sat.r * 2,
              backgroundColor: sat.color,
              color: '#ffffff',
            }}
          >
            <span className="text-sm sm:text-base filter drop-shadow-xs">
              {sat.icon || DEFAULT_ICONS[sat.id] || '🪙'}
            </span>
            {sat.r >= 38 && (
              <span className="text-[11px] font-bold opacity-90 line-clamp-1 leading-tight px-1">
                {sat.label}
              </span>
            )}
            <span className="font-display text-[12px] sm:text-[13.5px] font-bold tnum leading-tight mt-0.5">
              {thbCompact(sat.value)}
            </span>
            {sat.r >= 44 && (
              <span className="text-[9.5px] font-semibold opacity-85 mt-0.5">
                {pct(sat.pct, 0)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

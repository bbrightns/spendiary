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

  const centerPos = size / 2

  // Center bubble size proportional to percentage (min radius 65, max 95)
  const centerRadius = Math.max(65, Math.min(95, Math.sqrt(centerItem.value / (totalValue || 1)) * 125))

  // Satellite bubbles placement around center
  const orbitRadius = centerRadius + 42

  const satellites = otherItems.map((item, idx) => {
    // Distribute satellites evenly around the circle starting from top-right
    const angleStep = (2 * Math.PI) / Math.max(otherItems.length, 1)
    const angle = -Math.PI / 3 + idx * angleStep

    // Radius proportional to sqrt of percentage relative to total
    const itemRatio = Math.sqrt(item.value / (totalValue || 1))
    const r = Math.max(34, Math.min(65, itemRatio * 125))

    const cx = centerPos + Math.cos(angle) * orbitRadius
    const cy = centerPos + Math.sin(angle) * orbitRadius

    return {
      ...item,
      r,
      cx: Math.max(r + 8, Math.min(size - r - 8, cx)),
      cy: Math.max(r + 8, Math.min(size - r - 8, cy)),
    }
  })

  return (
    <div className="relative flex flex-col items-center justify-center select-none w-full my-2">
      <div
        className="relative"
        style={{ width: size, height: size, maxWidth: '100%' }}
      >
        {/* Central Bubble (Always the largest item) */}
        <div
          className="absolute transform -translate-x-1/2 -translate-y-1/2 rounded-full flex flex-col items-center justify-center p-3 text-center border-2 border-white/20 dark:border-white/10 shadow-md"
          style={{
            left: centerPos,
            top: centerPos,
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
              left: sat.cx,
              top: sat.cy,
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

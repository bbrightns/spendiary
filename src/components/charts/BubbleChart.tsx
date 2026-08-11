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

// Asset class icons (charming and clean)
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

  // The largest asset class is ALWAYS in the dead center
  const centerItem = validItems[0]
  const otherItems = validItems.slice(1)

  // Central Bubble dimensions (diameter between 120px and 144px)
  const centerDiameter = Math.max(120, Math.min(144, 110 + (centerItem.pct / 100) * 40))
  const centerRadius = centerDiameter / 2

  // Satellite bubble dimensions and balanced angle distribution
  const N = otherItems.length
  const satellites = otherItems.map((item, idx) => {
    // Proportional radius (diameter between 64px and 88px)
    const ratio = Math.sqrt(item.value / (totalValue || 1))
    const diameter = Math.max(64, Math.min(88, 56 + ratio * 48))
    const satRadius = diameter / 2

    // Symmetric angle distribution for balanced visual appearance
    let angle = 0
    if (N === 1) {
      angle = -Math.PI / 2 // Top
    } else if (N === 2) {
      angle = idx === 0 ? -Math.PI / 2 : Math.PI / 2 // Top & Bottom
    } else if (N === 3) {
      // Top, Bottom-Right, Bottom-Left
      const angles = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6]
      angle = angles[idx]
    } else if (N === 4) {
      // 4 corners: Top-Right, Bottom-Right, Bottom-Left, Top-Left
      const angles = [-Math.PI / 4, Math.PI / 4, (3 * Math.PI) / 4, (-3 * Math.PI) / 4]
      angle = angles[idx]
    } else {
      // Evenly spaced starting from top
      const angleStep = (2 * Math.PI) / N
      angle = -Math.PI / 2 + idx * angleStep
    }

    // Distance from center = centerRadius + satRadius + safe gap (10px)
    const dist = centerRadius + satRadius + 10

    // Coordinate offsets in pixels from center (0, 0)
    const offsetX = Math.cos(angle) * dist
    const offsetY = Math.sin(angle) * dist

    return {
      ...item,
      diameter,
      offsetX,
      offsetY,
    }
  })

  return (
    <div className="relative flex items-center justify-center w-full py-4 select-none">
      {/* Fixed square canvas container for 100% guaranteed centering */}
      <div className="relative w-[330px] h-[330px] max-w-full flex items-center justify-center">
        {/* Central Bubble (Centered at 50%, 50%) */}
        <div
          className="absolute rounded-full flex flex-col items-center justify-center p-2.5 text-center transition-transform z-10"
          style={{
            width: centerDiameter,
            height: centerDiameter,
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            background: `radial-gradient(circle at 35% 30%, color-mix(in srgb, ${centerItem.color} 80%, white) 0%, ${centerItem.color} 100%)`,
            border: '3px solid rgba(255, 255, 255, 0.85)',
            boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.25), inset 0 2px 4px rgba(255, 255, 255, 0.4)',
          }}
        >
          <span className="text-2xl mb-0.5 filter drop-shadow-sm leading-none">
            {centerItem.icon || DEFAULT_ICONS[centerItem.id] || '💰'}
          </span>
          <span className="text-[12.5px] font-bold text-white leading-tight tracking-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)] line-clamp-1 max-w-[90%]">
            {centerItem.label}
          </span>
          <span className="font-display text-[17px] font-extrabold text-white tnum tracking-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] my-0.5 leading-none">
            {thbCompact(centerItem.value)}
          </span>
          <span className="mt-1 inline-block rounded-full bg-black/25 px-2 py-0.5 text-[10.5px] font-bold tnum text-white drop-shadow-xs">
            {pct(centerItem.pct, 0)}
          </span>
        </div>

        {/* Satellite Bubbles (Orbiting center) */}
        {satellites.map((sat) => (
          <div
            key={sat.id}
            className="absolute rounded-full flex flex-col items-center justify-center p-1.5 text-center z-20"
            style={{
              width: sat.diameter,
              height: sat.diameter,
              left: `calc(50% + ${sat.offsetX}px)`,
              top: `calc(50% + ${sat.offsetY}px)`,
              transform: 'translate(-50%, -50%)',
              background: `radial-gradient(circle at 35% 30%, color-mix(in srgb, ${sat.color} 80%, white) 0%, ${sat.color} 100%)`,
              border: '2.5px solid rgba(255, 255, 255, 0.85)',
              boxShadow: '0 4px 16px -2px rgba(0, 0, 0, 0.2), inset 0 2px 4px rgba(255, 255, 255, 0.35)',
            }}
          >
            <span className="text-base filter drop-shadow-xs leading-none mb-0.5">
              {sat.icon || DEFAULT_ICONS[sat.id] || '🪙'}
            </span>
            {sat.diameter >= 70 && (
              <span className="text-[10.5px] font-bold text-white leading-tight tracking-tight drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)] line-clamp-1 max-w-[90%]">
                {sat.label}
              </span>
            )}
            <span className="font-display text-[12.5px] font-extrabold text-white tnum leading-tight drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)] my-0.5">
              {thbCompact(sat.value)}
            </span>
            <span className="text-[9.5px] font-bold text-white/90 tnum leading-none">
              {pct(sat.pct, 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}


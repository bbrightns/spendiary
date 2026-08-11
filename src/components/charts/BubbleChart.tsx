import { thbCompact, pct } from '../../lib/format'
import { useReducedMotion } from '../../lib/useReducedMotion'

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

// Icon mapping for asset classes
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
  const reducedMotion = useReducedMotion()

  // Filter items with value > 0 and sort by value desc
  const validItems = items.filter((item) => item.value > 0).sort((a, b) => b.value - a.value)

  if (validItems.length === 0) {
    return (
      <div className="flex h-64 w-full items-center justify-center text-ink-muted text-sm font-medium">
        No asset data available
      </div>
    )
  }

  // Find max value to normalize main central bubble vs surround bubbles
  const maxItem = validItems[0]
  const otherItems = validItems.slice(1)

  // Layout geometry calculations (packing around center)
  const centerRadius = Math.max(68, Math.min(92, Math.sqrt(maxItem.value / totalValue) * 110))

  // Calculate satellite bubble positions in a circular orbit around center
  const centerPos = size / 2
  const orbitRadius = centerRadius + 46

  const satellites = otherItems.map((item, idx) => {
    // Determine angle spaced evenly
    const angleStep = (2 * Math.PI) / Math.max(otherItems.length, 1)
    const angle = -Math.PI / 2 + idx * angleStep + (otherItems.length > 2 ? 0.3 : 0)

    // Radius proportional to square root of value relative to total
    const itemRatio = Math.sqrt(item.value / totalValue)
    const r = Math.max(34, Math.min(62, itemRatio * 110))

    const dist = orbitRadius + (idx % 2 === 0 ? 4 : -4)
    const cx = centerPos + Math.cos(angle) * dist
    const cy = centerPos + Math.sin(angle) * dist

    return {
      ...item,
      r,
      cx: Math.max(r + 10, Math.min(size - r - 10, cx)),
      cy: Math.max(r + 10, Math.min(size - r - 10, cy)),
    }
  })

  return (
    <div className="relative flex flex-col items-center justify-center select-none w-full my-2">
      <div
        className="relative"
        style={{ width: size, height: size, maxWidth: '100%' }}
      >
        {/* SVG background soft glowing halos */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={`0 0 ${size} ${size}`}>
          <defs>
            <radialGradient id="center-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={maxItem.color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={maxItem.color} stopOpacity="0" />
            </radialGradient>
            {satellites.map((sat) => (
              <radialGradient id={`glow-${sat.id}`} key={`glow-${sat.id}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={sat.color} stopOpacity="0.2" />
                <stop offset="100%" stopColor={sat.color} stopOpacity="0" />
              </radialGradient>
            ))}
          </defs>
          <circle cx={centerPos} cy={centerPos} r={centerRadius * 1.3} fill="url(#center-glow)" />
          {satellites.map((sat) => (
            <circle key={`bg-glow-${sat.id}`} cx={sat.cx} cy={sat.cy} r={sat.r * 1.3} fill={`url(#glow-${sat.id})`} />
          ))}
        </svg>

        {/* Central Bubble (Main Asset / Top Class) */}
        <div
          className="absolute transform -translate-x-1/2 -translate-y-1/2 rounded-full flex flex-col items-center justify-center p-3 text-center shadow-lg backdrop-blur-md transition-all duration-300 hover:scale-105 group cursor-pointer border border-white/30 dark:border-white/10"
          style={{
            left: centerPos,
            top: centerPos,
            width: centerRadius * 2,
            height: centerRadius * 2,
            background: `radial-gradient(135deg, ${maxItem.color}33 0%, ${maxItem.color}15 70%, ${maxItem.color}40 100%)`,
            boxShadow: `0 12px 32px ${maxItem.color}25, inset 0 2px 6px rgba(255,255,255,0.4)`,
            animation: reducedMotion ? 'none' : 'float 6s ease-in-out infinite',
          }}
        >
          <span className="text-xl sm:text-2xl mb-0.5 filter drop-shadow-sm transition-transform duration-200 group-hover:scale-110">
            {maxItem.icon || DEFAULT_ICONS[maxItem.id] || '💰'}
          </span>
          <span className="text-[12px] font-bold text-ink-soft line-clamp-1 leading-tight">
            {maxItem.label}
          </span>
          <span className="font-display text-[15px] sm:text-[17px] font-extrabold tnum text-ink mt-0.5 leading-none">
            {thbCompact(maxItem.value)}
          </span>
          <span className="mt-1 inline-block rounded-full bg-white/40 dark:bg-black/20 px-2 py-0.5 text-[10px] font-bold tnum text-ink-muted">
            {pct(maxItem.pct, 0)}
          </span>
        </div>

        {/* Satellite Bubbles */}
        {satellites.map((sat, i) => (
          <div
            key={sat.id}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 rounded-full flex flex-col items-center justify-center p-2 text-center shadow-md backdrop-blur-md transition-all duration-300 hover:scale-110 hover:z-20 group cursor-pointer border border-white/30 dark:border-white/10"
            style={{
              left: sat.cx,
              top: sat.cy,
              width: sat.r * 2,
              height: sat.r * 2,
              background: `radial-gradient(135deg, ${sat.color}35 0%, ${sat.color}18 70%, ${sat.color}45 100%)`,
              boxShadow: `0 8px 24px ${sat.color}20, inset 0 2px 4px rgba(255,255,255,0.35)`,
              animation: reducedMotion
                ? 'none'
                : `float ${5 + (i % 3)}s ease-in-out ${i * 0.7}s infinite alternate`,
            }}
          >
            <span className="text-sm sm:text-base filter drop-shadow-xs transition-transform duration-200 group-hover:scale-110">
              {sat.icon || DEFAULT_ICONS[sat.id] || '🪙'}
            </span>
            {sat.r >= 40 && (
              <span className="text-[10.5px] font-bold text-ink-soft line-clamp-1 leading-tight px-1">
                {sat.label}
              </span>
            )}
            <span className="font-display text-[12px] sm:text-[13px] font-bold tnum text-ink leading-tight">
              {thbCompact(sat.value)}
            </span>
            {sat.r >= 45 && (
              <span className="text-[9.5px] font-semibold tnum text-ink-muted">
                {pct(sat.pct, 0)}
              </span>
            )}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes float {
          0% { transform: translate(-50%, -50%) translateY(0px); }
          50% { transform: translate(-50%, -50%) translateY(-6px); }
          100% { transform: translate(-50%, -50%) translateY(0px); }
        }
      `}</style>
    </div>
  )
}

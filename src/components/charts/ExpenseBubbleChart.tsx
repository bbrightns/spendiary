import { useState } from 'react'

export interface ExpenseBubble {
  id: string
  label?: string
  amount: number
  icon?: string
  bgGradient: string
  textColor?: string
  borderColor?: string
  isCenter?: boolean
}

interface ExpenseBubbleChartProps {
  monthYear?: string
  totalExpense?: number
  currencyText?: string
  bubbles?: ExpenseBubble[]
}

const DEFAULT_BUBBLES: ExpenseBubble[] = [
  {
    id: 'center-savings',
    label: 'เงินออม',
    amount: 20280,
    icon: '🐷',
    bgGradient: 'radial-gradient(circle at 35% 35%, #ffb3a7 0%, #ff8a75 50%, #f76b55 100%)',
    textColor: '#ffffff',
    borderColor: '#ffffff',
    isCenter: true,
  },
  {
    id: 'shopping',
    label: 'ช้อปปิ้ง',
    amount: 7032.41,
    icon: '🛍️',
    bgGradient: 'radial-gradient(circle at 35% 35%, #fff3d1 0%, #ffe29a 60%, #ffd066 100%)',
    textColor: '#7c4a03',
    borderColor: '#ffffff',
  },
  {
    id: 'parents',
    label: 'ส่งเงินพ่อแม่',
    amount: 7000,
    icon: '👵',
    bgGradient: 'radial-gradient(circle at 35% 35%, #e6e6fa 0%, #d8b4fe 60%, #c084fc 100%)',
    textColor: '#4c1d95',
    borderColor: '#ffffff',
  },
  {
    id: 'food',
    label: 'อาหาร',
    amount: 3446.09,
    icon: '🍜',
    bgGradient: 'radial-gradient(circle at 35% 35%, #dcfce7 0%, #86efac 60%, #4ade80 100%)',
    textColor: '#14532d',
    borderColor: '#ffffff',
  },
  {
    id: 'drinks',
    label: 'เครื่องดื่ม',
    amount: 1043.75,
    icon: '🍹',
    bgGradient: 'radial-gradient(circle at 35% 35%, #ffedd5 0%, #fed7aa 60%, #fb923c 100%)',
    textColor: '#7c2d12',
    borderColor: '#ffffff',
  },
  {
    id: 'fuel',
    label: 'ค่าน้ำมัน',
    amount: 1010,
    icon: '⛽',
    bgGradient: 'radial-gradient(circle at 35% 35%, #ffe4e6 0%, #fecdd3 60%, #fda4af 100%)',
    textColor: '#881337',
    borderColor: '#ffffff',
  },
  {
    id: 'phone',
    amount: 753.63,
    icon: '📱',
    bgGradient: 'radial-gradient(circle at 35% 35%, #ccfbf1 0%, #99f6e4 60%, #2dd4bf 100%)',
    textColor: '#134e4a',
    borderColor: '#ffffff',
  },
  {
    id: 'gift',
    amount: 500,
    icon: '🎁',
    bgGradient: 'radial-gradient(circle at 35% 35%, #ffe4e6 0%, #fecdd3 100%)',
    textColor: '#9f1239',
    borderColor: '#ffffff',
  },
  {
    id: 'bus',
    amount: 300,
    icon: '🚌',
    bgGradient: 'radial-gradient(circle at 35% 35%, #fef3c7 0%, #fde047 100%)',
    textColor: '#713f12',
    borderColor: '#ffffff',
  },
  {
    id: 'sub',
    amount: 249,
    icon: '🧃',
    bgGradient: 'radial-gradient(circle at 35% 35%, #e2e8f0 0%, #cbd5e1 100%)',
    textColor: '#334155',
    borderColor: '#ffffff',
  },
  {
    id: 'beauty',
    amount: 119,
    icon: '💄',
    bgGradient: 'radial-gradient(circle at 35% 35%, #d1fae5 0%, #a7f3d0 100%)',
    textColor: '#065f46',
    borderColor: '#ffffff',
  },
  {
    id: 'game',
    amount: 104,
    icon: '🎮',
    bgGradient: 'radial-gradient(circle at 35% 35%, #fae8ff 0%, #f5d0fe 100%)',
    textColor: '#701a75',
    borderColor: '#ffffff',
  },
]

export function ExpenseBubbleChart({
  monthYear = 'สิงหาคม',
  totalExpense = 41837.88,
  currencyText = 'บาท',
  bubbles = DEFAULT_BUBBLES,
}: ExpenseBubbleChartProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  // Layout calculations for placing bubbles around center
  const centerBubble = bubbles.find((b) => b.isCenter) ?? bubbles[0]
  const outerBubbles = bubbles.filter((b) => b.id !== centerBubble.id)

  // Container dimensions
  const viewWidth = 500
  const viewHeight = 440
  const cx = viewWidth / 2
  const cy = viewHeight / 2 + 15

  // Radii mapping based on amount
  const maxAmount = Math.max(...bubbles.map((b) => b.amount))
  const centerRadius = 88

  // Pre-calculated orbital positions around center for surround bubbles
  const angles = [
    -50,  // shopping (top right)
    10,   // parents (right)
    65,   // food (bottom right)
    115,  // game (bottom right-ish)
    145,  // sub (bottom)
    180,  // drinks (bottom left)
    215,  // beauty (bottom left-ish)
    250,  // fuel (left)
    285,  // bus (top left-ish)
    315,  // phone (top left)
    345,  // gift (top)
  ]

  const positionedBubbles = outerBubbles.map((b, idx) => {
    const angleDeg = angles[idx % angles.length]
    const angleRad = (angleDeg * Math.PI) / 180

    // Scale radius between 22px and 62px
    const ratio = Math.pow(b.amount / maxAmount, 0.45)
    const radius = Math.max(22, Math.min(62, ratio * 64))

    // Orbit distance from center
    const orbitDistance = centerRadius + radius + 14

    const x = cx + Math.cos(angleRad) * orbitDistance
    const y = cy + Math.sin(angleRad) * orbitDistance

    return {
      ...b,
      x,
      y,
      radius,
      animationDelay: `${(idx % 5) * 0.4}s`,
    }
  })

  return (
    <div className="relative overflow-hidden rounded-3xl bg-[#fffaf3] dark:bg-[#151722] p-6 text-slate-800 dark:text-slate-100 shadow-xl ring-1 ring-amber-900/5 dark:ring-white/10">
      {/* Header section matching user's Image 2 */}
      <div className="flex flex-col items-center justify-center text-center">
        <h3 className="flex items-center gap-1.5 font-serif text-lg font-bold text-[#7c4d38] dark:text-amber-200">
          <span>รายจ่าย</span>
          <span className="text-xs text-amber-600/70 dark:text-amber-400/70">☘</span>
          <span>{monthYear}</span>
        </h3>
        <p className="mt-1 font-display text-3xl font-extrabold tracking-tight text-[#f95738] dark:text-[#ff785a] drop-shadow-xs">
          {totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          <span className="ml-2 text-lg font-semibold text-[#f95738]/80 dark:text-[#ff785a]/80">
            {currencyText}
          </span>
        </p>
      </div>

      {/* Bubble Canvas Container */}
      <div className="relative mx-auto mt-2 h-[420px] w-full max-w-[500px]">
        {/* Central Savings Bubble */}
        <div
          onMouseEnter={() => setHoveredId(centerBubble.id)}
          onMouseLeave={() => setHoveredId(null)}
          style={{
            left: `${cx}px`,
            top: `${cy}px`,
            width: `${centerRadius * 2}px`,
            height: `${centerRadius * 2}px`,
            background: centerBubble.bgGradient,
            boxShadow:
              hoveredId === centerBubble.id
                ? '0 12px 32px rgba(247, 107, 85, 0.45), 0 0 0 5px rgba(255, 255, 255, 0.9)'
                : '0 8px 24px rgba(247, 107, 85, 0.3), 0 0 0 4px rgba(255, 255, 255, 0.9)',
          }}
          className={`absolute flex -translate-x-1/2 -translate-y-1/2 cursor-pointer flex-col items-center justify-center rounded-full text-center transition-all duration-300 ${
            hoveredId === centerBubble.id ? 'scale-105 z-20' : 'z-10 hover:scale-102'
          }`}
        >
          {centerBubble.icon && <span className="text-2xl drop-shadow-sm">{centerBubble.icon}</span>}
          {centerBubble.label && (
            <span className="mt-1 font-serif text-sm font-semibold tracking-wide text-white drop-shadow-xs">
              {centerBubble.label}
            </span>
          )}
          <span className="font-display text-xl font-extrabold leading-tight text-white drop-shadow-sm tnum">
            {centerBubble.amount.toLocaleString()}
          </span>
        </div>

        {/* Surrounding Category Bubbles */}
        {positionedBubbles.map((b) => {
          const isHovered = hoveredId === b.id
          const diameter = b.radius * 2
          const showLabel = b.radius >= 32 && b.label
          const showIcon = b.radius >= 20 && b.icon

          return (
            <div
              key={b.id}
              onMouseEnter={() => setHoveredId(b.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                left: `${b.x}px`,
                top: `${b.y}px`,
                width: `${diameter}px`,
                height: `${diameter}px`,
                background: b.bgGradient,
                color: b.textColor ?? '#1e293b',
                boxShadow: isHovered
                  ? '0 10px 24px rgba(0,0,0,0.18), 0 0 0 3.5px #ffffff'
                  : '0 4px 14px rgba(0,0,0,0.08), 0 0 0 2.5px #ffffff',
              }}
              className={`absolute flex -translate-x-1/2 -translate-y-1/2 cursor-pointer flex-col items-center justify-center rounded-full text-center transition-all duration-300 ${
                isHovered ? 'scale-115 z-30' : 'z-10 hover:scale-108'
              }`}
            >
              {showIcon && (
                <span style={{ fontSize: `${Math.max(12, b.radius * 0.42)}px` }}>
                  {b.icon}
                </span>
              )}
              {showLabel && (
                <span className="font-serif font-bold leading-tight" style={{ fontSize: `${Math.max(10, b.radius * 0.26)}px` }}>
                  {b.label}
                </span>
              )}
              <span
                className="font-display font-extrabold leading-tight tnum"
                style={{ fontSize: `${Math.max(10, b.radius * 0.28)}px` }}
              >
                {b.amount >= 1000 ? b.amount.toLocaleString() : b.amount}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

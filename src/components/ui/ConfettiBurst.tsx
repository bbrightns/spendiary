import { useEffect, useMemo, type CSSProperties } from 'react'

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6']
const PIECE_COUNT = 44
const DURATION_MS = 1900

interface Props {
  onDone: () => void
}

/** One-shot, dependency-free confetti burst. Renders nothing when the user prefers reduced motion. */
export function ConfettiBurst({ onDone }: Props) {
  const reduceMotion =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  const pieces = useMemo(
    () =>
      Array.from({ length: PIECE_COUNT }, (_, i) => {
        const angle = ((-90 + (Math.random() - 0.5) * 150) * Math.PI) / 180
        const dist = 150 + Math.random() * 230
        return {
          id: i,
          color: COLORS[i % COLORS.length],
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist,
          rot: Math.round(Math.random() * 720 - 360),
          size: 6 + Math.random() * 6,
          delay: Math.round(Math.random() * 90),
          round: Math.random() > 0.55,
        }
      }),
    [],
  )

  useEffect(() => {
    const t = window.setTimeout(onDone, reduceMotion ? 0 : DURATION_MS)
    return () => window.clearTimeout(t)
  }, [onDone, reduceMotion])

  if (reduceMotion) return null

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[70] overflow-hidden">
      <div className="absolute left-1/2 top-[58%]">
        {pieces.map((p) => (
          <span
            key={p.id}
            className="confetti-piece"
            style={
              {
                '--dx': `${p.dx}px`,
                '--dy': `${p.dy}px`,
                '--rot': `${p.rot}deg`,
                width: p.size,
                height: p.round ? p.size : p.size * 0.6,
                background: p.color,
                borderRadius: p.round ? '9999px' : '2px',
                animationDelay: `${p.delay}ms`,
              } as CSSProperties
            }
          />
        ))}
      </div>
    </div>
  )
}

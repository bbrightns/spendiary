import { useState, useRef, useLayoutEffect, useEffect, type ReactNode } from 'react'

export interface SegmentOption<T extends string> {
  value: T
  label: ReactNode
  icon?: ReactNode
  title?: string
  activeClassName?: string
  inactiveClassName?: string
}

interface SegmentedControlProps<T extends string> {
  options: readonly SegmentOption<T>[] | SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  size?: 'xs' | 'sm' | 'md'
  shape?: 'rounded' | 'pill'
  fullWidth?: boolean
  gridCols?: 2 | 3 | 4
  className?: string
  ariaLabel?: string
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  shape = 'rounded',
  fullWidth = true,
  gridCols,
  className = '',
  ariaLabel,
}: SegmentedControlProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isFirstRender = useRef(true)
  const [canAnimate, setCanAnimate] = useState(false)
  const [gliderStyle, setGliderStyle] = useState<{
    left: number
    top: number
    width: number
    height: number
    ready: boolean
  }>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    ready: false,
  })

  // Measure and position the glider over the active button
  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const activeBtn = container.querySelector<HTMLButtonElement>('[data-active="true"]')
    if (!activeBtn) return

    const left = activeBtn.offsetLeft
    const top = activeBtn.offsetTop
    const width = activeBtn.offsetWidth
    const height = activeBtn.offsetHeight

    setGliderStyle({ left, top, width, height, ready: true })

    if (isFirstRender.current) {
      const raf = requestAnimationFrame(() => {
        isFirstRender.current = false
        setCanAnimate(true)
      })
      return () => cancelAnimationFrame(raf)
    }
  }, [value, options])

  // Re-measure on window or container resize
  useEffect(() => {
    const container = containerRef.current
    if (!container || typeof ResizeObserver === 'undefined') return

    const ro = new ResizeObserver(() => {
      const activeBtn = container.querySelector<HTMLButtonElement>('[data-active="true"]')
      if (!activeBtn) return
      setGliderStyle({
        left: activeBtn.offsetLeft,
        top: activeBtn.offsetTop,
        width: activeBtn.offsetWidth,
        height: activeBtn.offsetHeight,
        ready: true,
      })
    })

    ro.observe(container)
    return () => ro.disconnect()
  }, [])

  const sizeClasses = {
    xs: 'py-1 px-2.5 text-xs',
    sm: 'py-1.5 px-2.5 text-xs',
    md: 'py-2 px-3 text-xs sm:text-sm',
  }

  const shapeClasses = {
    rounded: {
      container: 'rounded-xl',
      item: 'rounded-lg',
    },
    pill: {
      container: 'rounded-full',
      item: 'rounded-full',
    },
  }

  const currentShape = shapeClasses[shape]
  const containerPadding = size === 'xs' ? 'p-0.5' : 'p-1'
  const containerBorder = 'border border-line-strong/30'

  const effectiveGridCols =
    gridCols ??
    (fullWidth && options.length >= 2 && options.length <= 4
      ? (options.length as 2 | 3 | 4)
      : undefined)

  const gridClasses: Record<number, string> = {
    2: `grid grid-cols-2 gap-1 ${currentShape.container} bg-surface-muted ${containerPadding} ${containerBorder} w-full`,
    3: `grid grid-cols-3 gap-1 ${currentShape.container} bg-surface-muted ${containerPadding} ${containerBorder} w-full`,
    4: `grid grid-cols-4 gap-1 ${currentShape.container} bg-surface-muted ${containerPadding} ${containerBorder} w-full`,
  }

  const containerClasses = effectiveGridCols && gridClasses[effectiveGridCols]
    ? gridClasses[effectiveGridCols]
    : `flex items-center ${currentShape.container} bg-surface-muted ${containerPadding} gap-0.5 ${containerBorder} ${
        fullWidth ? 'w-full' : 'inline-flex'
      }`

  const activeOption = options.find((opt) => opt.value === value)
  const gliderBgClass = activeOption?.activeClassName
    ? activeOption.activeClassName.split(' ').filter((c) => !c.startsWith('text-')).join(' ')
    : 'bg-surface shadow-xs'

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label={ariaLabel}
      className={`relative ${containerClasses} ${className}`}
    >
      {/* Sliding Glider */}
      {gliderStyle.ready && (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute z-0 ${currentShape.item} ${gliderBgClass}`}
          style={{
            transform: `translate3d(${gliderStyle.left}px, ${gliderStyle.top}px, 0)`,
            width: `${gliderStyle.width}px`,
            height: `${gliderStyle.height}px`,
            transition: canAnimate
              ? 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), width 0.25s cubic-bezier(0.16, 1, 0.3, 1), height 0.25s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.2s ease'
              : 'none',
          }}
        />
      )}

      {/* Buttons */}
      {options.map((opt) => {
        const isSelected = opt.value === value
        const showFallbackBg = !gliderStyle.ready && isSelected
        const textColorClass = isSelected
          ? (opt.activeClassName
              ? (opt.activeClassName.split(' ').find((c) => c.startsWith('text-')) ?? 'text-ink font-bold')
              : 'text-ink font-bold')
          : (opt.inactiveClassName ?? 'text-ink-muted hover:text-ink font-semibold')

        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            data-active={isSelected ? 'true' : 'false'}
            title={opt.title}
            onClick={() => onChange(opt.value)}
            className={`${fullWidth ? 'flex-1 min-w-0' : 'min-w-0'} relative z-10 inline-flex items-center justify-center gap-1.5 ${currentShape.item} transition-colors duration-150 cursor-pointer select-none ${
              sizeClasses[size]
            } ${textColorClass} ${showFallbackBg ? (opt.activeClassName ?? 'bg-surface shadow-xs') : 'bg-transparent'}`}
          >
            {opt.icon && <span className="shrink-0">{opt.icon}</span>}
            {typeof opt.label === 'string' ? (
              <span className="min-w-0 truncate text-center">{opt.label}</span>
            ) : (
              <span className="min-w-0 text-center leading-snug">{opt.label}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { TourStep } from './guideSteps'

interface GuideTourProps {
  isOpen: boolean
  steps: TourStep[]
  currentStepIndex: number
  onNext: () => void
  onPrev: () => void
  onClose: () => void
  onFinish: () => void
}

interface TargetRect {
  top: number
  left: number
  width: number
  height: number
}

export function GuideTour({
  isOpen,
  steps,
  currentStepIndex,
  onNext,
  onPrev,
  onClose,
  onFinish,
}: GuideTourProps) {
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const currentStep = steps[currentStepIndex]
  const isFirstStep = currentStepIndex === 0
  const isLastStep = currentStepIndex === steps.length - 1

  // Update target bounding box
  const updateTargetRect = useCallback(() => {
    if (!isOpen || !currentStep) return

    const targetEl =
      document.getElementById(currentStep.targetId) ||
      document.querySelector(`[data-tour="${currentStep.targetId}"]`)

    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
      const r = targetEl.getBoundingClientRect()
      setTargetRect({
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
      })
    } else {
      // If target element is not present on DOM (e.g. empty list), fallback to center
      setTargetRect(null)
    }
  }, [isOpen, currentStep])

  useEffect(() => {
    updateTargetRect()

    // Recalculate on window resize or scroll
    const handleRecalc = () => {
      if (!currentStep) return
      const targetEl =
        document.getElementById(currentStep.targetId) ||
        document.querySelector(`[data-tour="${currentStep.targetId}"]`)
      if (targetEl) {
        const r = targetEl.getBoundingClientRect()
        setTargetRect({
          top: r.top,
          left: r.left,
          width: r.width,
          height: r.height,
        })
      }
    }

    window.addEventListener('resize', handleRecalc)
    window.addEventListener('scroll', handleRecalc, true)
    return () => {
      window.removeEventListener('resize', handleRecalc)
      window.removeEventListener('scroll', handleRecalc, true)
    }
  }, [updateTargetRect, currentStep])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (isLastStep) onFinish()
        else onNext()
      } else if (e.key === 'ArrowLeft') {
        if (!isFirstStep) onPrev()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isFirstStep, isLastStep, onNext, onPrev, onClose, onFinish])

  if (!isOpen || !currentStep) return null

  // Calculate Popover Position
  const padding = 8
  const popoverWidth = Math.min(380, typeof window !== 'undefined' ? window.innerWidth - 32 : 380)

  let popoverTop = 0
  let popoverLeft = 0
  let showCentered = !targetRect

  if (targetRect && typeof window !== 'undefined') {
    const spaceBelow = window.innerHeight - (targetRect.top + targetRect.height)
    const spaceAbove = targetRect.top
    const preferBottom = currentStep.position === 'bottom' || spaceBelow > 230

    // Vertical placement
    if (preferBottom && spaceBelow > 180) {
      popoverTop = targetRect.top + targetRect.height + padding + 12
    } else if (spaceAbove > 180) {
      popoverTop = Math.max(16, targetRect.top - padding - 220)
    } else {
      // Fallback center if screen is too small
      showCentered = true
    }

    // Horizontal placement
    popoverLeft = targetRect.left + targetRect.width / 2 - popoverWidth / 2
    // Clamp to window edges
    popoverLeft = Math.max(16, Math.min(popoverLeft, window.innerWidth - popoverWidth - 16))
  }

  const content = (
    <div className="fixed inset-0 z-[9999] overflow-hidden select-none">
      {/* SVG Spotlight Mask */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <mask id="spendiary-spotlight-mask">
            {/* White covers everything (opaque backdrop) */}
            <rect width="100%" height="100%" fill="white" />
            {/* Black cuts out the spotlight area */}
            {targetRect && (
              <rect
                x={Math.max(0, targetRect.left - padding)}
                y={Math.max(0, targetRect.top - padding)}
                width={targetRect.width + padding * 2}
                height={targetRect.height + padding * 2}
                rx="14"
                ry="14"
                fill="black"
              />
            )}
          </mask>
        </defs>
        {/* Semi-transparent dark overlay with the mask applied */}
        <rect
          width="100%" height="100%"
          fill="rgba(15, 23, 42, 0.72)"
          mask="url(#spendiary-spotlight-mask)"
        />
      </svg>

      {/* Target Focus Border Highlight */}
      {targetRect && (
        <div
          style={{
            top: `${Math.max(0, targetRect.top - padding)}px`,
            left: `${Math.max(0, targetRect.left - padding)}px`,
            width: `${targetRect.width + padding * 2}px`,
            height: `${targetRect.height + padding * 2}px`,
          }}
          className="absolute rounded-[14px] border-2 border-brand/90 shadow-[0_0_24px_rgba(99,102,241,0.45)] pointer-events-none transition-all duration-300 animate-pulse"
        />
      )}

      {/* Floating Popover Card */}
      <div
        ref={popoverRef}
        style={
          showCentered
            ? {
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: `${popoverWidth}px`,
              }
            : {
                top: `${popoverTop}px`,
                left: `${popoverLeft}px`,
                width: `${popoverWidth}px`,
              }
        }
        className="absolute bg-surface dark:bg-[#1c1f26] border border-line dark:border-white/10 rounded-2xl p-5 shadow-2xl backdrop-blur-xl transition-all duration-300 z-10"
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-brand/10 text-brand border border-brand/20">
              {currentStep.badge || 'แนะนำ'}
            </span>
            <span className="text-[12px] font-medium text-ink-muted">
              {currentStepIndex + 1} จาก {steps.length}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดคำแนะนำ"
            className="p-1 text-ink-muted hover:text-ink hover:bg-surface-muted rounded-lg transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Title */}
        <h3 className="font-display font-bold text-base text-ink mb-1.5 leading-snug">
          {currentStep.title}
        </h3>

        {/* Description */}
        <p className="text-[13.5px] leading-relaxed text-ink-muted mb-5">
          {currentStep.description}
        </p>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-line/60 dark:border-white/5">
          {/* Skip button */}
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-ink-muted hover:text-ink transition-colors cursor-pointer px-1 py-1"
          >
            ข้ามทั้งหมด
          </button>

          {/* Prev / Next Buttons */}
          <div className="flex items-center gap-2">
            {!isFirstStep && (
              <button
                type="button"
                onClick={onPrev}
                className="px-3 py-1.5 rounded-xl border border-line text-xs font-semibold text-ink hover:bg-surface-muted active:scale-95 transition-all cursor-pointer"
              >
                ย้อนกลับ
              </button>
            )}

            <button
              type="button"
              onClick={isLastStep ? onFinish : onNext}
              className="px-4 py-1.5 rounded-xl bg-brand text-white text-xs font-bold shadow-md shadow-brand/25 hover:bg-brand/90 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>{isLastStep ? 'เข้าใจแล้ว' : 'ถัดไป'}</span>
              {!isLastStep && (
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null
}

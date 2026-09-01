import { useState, useEffect, useCallback } from 'react'
import { PAGE_GUIDES, type PageGuideKey } from '../components/guide/guideSteps'

const GUIDE_STORAGE_PREFIX = 'spendiary_guide_seen_'

export function hasSeenPageGuide(key: PageGuideKey): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(`${GUIDE_STORAGE_PREFIX}${key}`) === 'true'
}

export function markPageGuideSeen(key: PageGuideKey): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(`${GUIDE_STORAGE_PREFIX}${key}`, 'true')
}

export function resetAllPageGuides(): void {
  if (typeof window === 'undefined') return
  const keys: PageGuideKey[] = [
    'dashboard',
    'portfolio',
    'dca',
    'rebalance',
    'retirement',
    'logs',
    'settings',
  ]
  keys.forEach((k) => localStorage.removeItem(`${GUIDE_STORAGE_PREFIX}${k}`))
}

export function usePageGuide(key: PageGuideKey, autoStart = true) {
  const guideData = PAGE_GUIDES[key]
  const [isRunning, setIsRunning] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)

  // Auto-start on first-time visit
  useEffect(() => {
    if (!autoStart) return

    const seen = hasSeenPageGuide(key)
    if (!seen && guideData && guideData.steps.length > 0) {
      const timer = setTimeout(() => {
        setIsRunning(true)
        setCurrentStepIndex(0)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [key, autoStart, guideData])

  const startTour = useCallback(() => {
    setCurrentStepIndex(0)
    setIsRunning(true)
  }, [])

  const endTour = useCallback(() => {
    setIsRunning(false)
    markPageGuideSeen(key)
  }, [key])

  const finishTour = useCallback(() => {
    setIsRunning(false)
    markPageGuideSeen(key)
  }, [key])

  const nextStep = useCallback(() => {
    if (guideData && currentStepIndex < guideData.steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1)
    } else {
      finishTour()
    }
  }, [guideData, currentStepIndex, finishTour])

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1)
    }
  }, [currentStepIndex])

  return {
    guideTitle: guideData?.title ?? '',
    steps: guideData?.steps ?? [],
    isRunning,
    currentStepIndex,
    startTour,
    endTour,
    finishTour,
    nextStep,
    prevStep,
  }
}

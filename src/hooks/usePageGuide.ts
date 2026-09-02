import { useState, useCallback } from 'react'
import { PAGE_GUIDES, type PageGuideKey } from '../components/guide/guideSteps'

export function usePageGuide(key: PageGuideKey) {
  const guideData = PAGE_GUIDES[key]
  const [isRunning, setIsRunning] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)

  const startTour = useCallback(() => {
    setCurrentStepIndex(0)
    setIsRunning(true)
  }, [])

  const endTour = useCallback(() => {
    setIsRunning(false)
  }, [])

  const finishTour = useCallback(() => {
    setIsRunning(false)
  }, [])

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

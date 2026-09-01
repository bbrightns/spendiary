import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Custom hook to control mobile header and bottom navigation bar visibility based on scroll direction.
 * 
 * Rules:
 * - Shows when user scrolls down
 * - Hides when user scrolls up
 * - Always visible when at top of page (scrollY <= 10)
 * - Resets to visible on route/pathname change
 */
export function useScrollVisibility(): boolean {
  const [isVisible, setIsVisible] = useState(true)
  const lastScrollY = useRef(0)
  const location = useLocation()

  // Reset visibility when route changes
  useEffect(() => {
    setIsVisible(true)
    lastScrollY.current = window.scrollY || 0
  }, [location.pathname])

  useEffect(() => {
    let ticking = false

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY || document.documentElement.scrollTop || 0

          // At top of page (or overscroll top on iOS), keep visible
          if (currentScrollY <= 10) {
            setIsVisible(true)
            lastScrollY.current = Math.max(0, currentScrollY)
            ticking = false
            return
          }

          const diff = currentScrollY - lastScrollY.current

          // Threshold of 8px to prevent flickering on touch micro-jitter
          if (Math.abs(diff) > 8) {
            if (diff > 0) {
              // Scrolling down -> show
              setIsVisible(true)
            } else {
              // Scrolling up -> hide
              setIsVisible(false)
            }
            lastScrollY.current = currentScrollY
          }

          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  return isVisible
}

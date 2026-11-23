import { useEffect, useState } from 'react'

/** Below Tailwind's `sm` breakpoint: where modals turn into bottom sheets and charts draw narrower */
const PHONE_QUERY = '(max-width: 639px)'

/** True on phone widths, and follows the window as it resizes */
export function useIsPhone(): boolean {
  const [isPhone, setIsPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia(PHONE_QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(PHONE_QUERY)
    const update = () => setIsPhone(mq.matches)
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return isPhone
}

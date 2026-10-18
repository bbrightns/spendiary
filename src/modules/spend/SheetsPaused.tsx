import { useEffect } from 'react'
import { useToast } from '../../store/ToastContext'
import { SHEET_EVENTS } from './sheetEvents'

/**
 * Stands in for the Spend sheets while the data isn't loaded (still loading, failed, or changed on
 * another device). Anything added then would be replaced once the real data arrives, so the sheets
 * stay closed and a tap on "+" or "Pay bill" says why instead of doing nothing.
 */
export function SheetsPaused({ reason }: { reason: 'loading' | 'problem' }) {
  const { showToast } = useToast()

  useEffect(() => {
    const onOpen = () =>
      showToast(
        reason === 'loading'
          ? 'Your data is still loading. Try again in a moment.'
          : "Your data isn't loaded, so adding is paused to keep anything from being lost.",
        'warn',
      )
    const events = Object.values(SHEET_EVENTS)
    events.forEach((e) => window.addEventListener(e, onOpen))
    return () => events.forEach((e) => window.removeEventListener(e, onOpen))
  }, [reason, showToast])

  return null
}

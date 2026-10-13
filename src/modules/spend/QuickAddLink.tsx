import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { openQuickAdd } from './QuickAddSheet'

/** The query that opens Quick Add on load; the installed app's "Quick add" shortcut points here (see manifest). */
export const QUICK_ADD_PARAM = 'add'

/** Opens Quick Add when the URL carries `?add=1`, then clears it so a refresh doesn't reopen the sheet. */
export function QuickAddLink() {
  const [params, setParams] = useSearchParams()
  const wanted = params.get(QUICK_ADD_PARAM) === '1'

  useEffect(() => {
    if (!wanted) return
    openQuickAdd()
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete(QUICK_ADD_PARAM)
        return next
      },
      { replace: true },
    )
  }, [wanted, setParams])

  return null
}

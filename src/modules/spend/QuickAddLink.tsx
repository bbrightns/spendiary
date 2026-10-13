import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { SpendTxnType } from '../../lib/types'
import { openQuickAdd } from './QuickAddSheet'

/** The query that opens Quick Add on load; the installed app's shortcuts point here (see manifest). */
export const QUICK_ADD_PARAM = 'add'

const TYPES: SpendTxnType[] = ['expense', 'income', 'transfer']

/** Opens Quick Add for `?add=1` (the usual entry) or `?add=expense|income|transfer`, then clears the query so a refresh doesn't reopen it. */
export function QuickAddLink() {
  const [params, setParams] = useSearchParams()
  const raw = params.get(QUICK_ADD_PARAM)

  useEffect(() => {
    if (raw === null) return
    const type = TYPES.find((t) => t === raw)
    if (type || raw === '1') openQuickAdd(type ? { type } : {})
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete(QUICK_ADD_PARAM)
        return next
      },
      { replace: true },
    )
  }, [raw, setParams])

  return null
}

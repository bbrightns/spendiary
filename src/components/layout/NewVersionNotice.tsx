import { useNewVersion } from '../../hooks/useNewVersion'
import { Button } from '../ui/Button'
import { RefreshIcon } from '../icons'

/** Shown when a newer version of the app has been deployed than the one open in this tab. */
export function NewVersionNotice() {
  const available = useNewVersion()
  if (!available) return null

  return (
    <div role="status" className="mb-5 flex items-center gap-3 rounded-2xl border border-brand/30 bg-brand-soft px-4 py-3 text-sm">
      <RefreshIcon className="h-4 w-4 shrink-0 text-link" />
      <p className="min-w-0 flex-1 text-ink-soft">
        <span className="font-semibold text-ink">A new version of Spendiary is out.</span>{' '}
        Refresh to get the latest fixes and features.
      </p>
      <Button size="sm" onClick={() => window.location.reload()} className="shrink-0">
        Refresh
      </Button>
    </div>
  )
}

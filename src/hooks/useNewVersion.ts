import { useEffect, useState } from 'react'
import { isNewerDeploy, readDeployedVersion } from '../lib/appVersion'

/** How often an open tab checks for a newer deploy */
const CHECK_EVERY_MS = 15 * 60 * 1000

/**
 * True once a newer version of the app has been deployed than the one running in this tab.
 * Checks /version.json when the tab opens, when it comes back into view, and every 15 minutes.
 * Off in development, where there is no version file.
 */
export function useNewVersion(): boolean {
  const [available, setAvailable] = useState(false)

  useEffect(() => {
    if (import.meta.env.DEV || available) return
    let cancelled = false
    const check = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) return
        const deployed = readDeployedVersion(await res.json().catch(() => null))
        if (!cancelled && isNewerDeploy(deployed, __BUILD_TIME__)) setAvailable(true)
      } catch {
        // Offline or blocked: try again later
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }
    check()
    document.addEventListener('visibilitychange', onVisible)
    const timer = window.setInterval(check, CHECK_EVERY_MS)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(timer)
    }
  }, [available])

  return available
}

/** What /version.json says about the deployed build (written at build time by vite.config.ts) */
export interface DeployedVersion {
  version: string
  commit: string
  builtAt: string
}

/** A valid /version.json, or null (missing, or the app page served in its place) */
export function readDeployedVersion(raw: unknown): DeployedVersion | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (typeof r.version !== 'string' || typeof r.commit !== 'string' || typeof r.builtAt !== 'string') return null
  if (Number.isNaN(Date.parse(r.builtAt))) return null
  return { version: r.version, commit: r.commit, builtAt: r.builtAt }
}

/** The deploy is newer than this page: built later (an older file served from a cache never counts) */
export function isNewerDeploy(deployed: DeployedVersion | null, runningBuiltAt: string): boolean {
  if (!deployed) return false
  const running = Date.parse(runningBuiltAt)
  return !Number.isNaN(running) && Date.parse(deployed.builtAt) > running
}

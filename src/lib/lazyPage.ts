import { lazy, type ComponentType } from 'react'

/**
 * A page that loads with its own file. A failed load goes to PageErrorBoundary, which reloads the
 * app: browsers remember a failed module, so trying the same file again fails again.
 */
export function lazyPage<T extends ComponentType<object>>(load: () => Promise<T>) {
  return lazy(() => load().then((Page) => ({ default: Page })))
}

/**
 * True for the error a browser gives when a page's file can't be loaded. Older tabs and the
 * home-screen app hit this after a deploy: the file they ask for no longer exists.
 */
export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /dynamically imported module|module script failed|Unable to preload CSS/i.test(message)
}

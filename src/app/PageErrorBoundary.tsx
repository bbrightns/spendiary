import { Component, useEffect, type ReactNode } from 'react'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Button } from '../components/ui/Button'
import { useData } from '../store/DataContext'
import { isChunkLoadError } from '../lib/lazyPage'

/** When the app last reloaded itself for a missing page file, so a file that stays missing can't loop */
const RELOADED_AT_KEY = 'spendiary.chunk_reload_at'

function reloadedRecently(): boolean {
  try {
    return Date.now() - Number(sessionStorage.getItem(RELOADED_AT_KEY) ?? 0) < 30_000
  } catch {
    return true
  }
}

function reload() {
  try {
    sessionStorage.setItem(RELOADED_AT_KEY, String(Date.now()))
  } catch {
    // storage unavailable — still reload; the button stays as the way out
  }
  window.location.reload()
}

/**
 * Keeps a page that fails to load or render from blanking the whole app: the header and nav stay,
 * and this card takes the page's place. Moving to another page clears it.
 */
export class PageErrorBoundary extends Component<{ resetKey: string; children: ReactNode }, { error: unknown; resetKey: string }> {
  state = { error: null as unknown, resetKey: this.props.resetKey }

  static getDerivedStateFromError(error: unknown) {
    return { error }
  }

  static getDerivedStateFromProps(props: { resetKey: string }, state: { error: unknown; resetKey: string }) {
    return props.resetKey === state.resetKey ? null : { error: null, resetKey: props.resetKey }
  }

  componentDidCatch(error: unknown) {
    console.error('Page failed:', error)
  }

  render() {
    return this.state.error ? <PageProblem chunk={isChunkLoadError(this.state.error)} /> : this.props.children
  }
}

function PageProblem({ chunk }: { chunk: boolean }) {
  const { syncStatus, user } = useData()
  // A deploy removed this page's file: reload to get the new version, but only once nothing is
  // waiting to save (a reload would drop it) and not in Test Mode (its data lives in memory)
  const autoReload = chunk && (syncStatus === 'synced' || syncStatus === 'idle') && user?.id !== 'test-user-local' && !reloadedRecently()
  useEffect(() => {
    if (autoReload) reload()
  }, [autoReload])

  return (
    <Card className="mx-auto mt-6 max-w-md animate-rise">
      <EmptyState
        accent="var(--color-loss)"
        icon={
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <path d="M21 3v6h-6" />
          </svg>
        }
        title={chunk ? 'Spendiary was updated' : "This page couldn't open"}
        description={
          chunk
            ? 'Reload to get the latest version. Your data is safe.'
            : 'Something went wrong showing this page. Your data is safe. Reload, or open another page.'
        }
        action={<Button onClick={reload}>Reload</Button>}
      />
    </Card>
  )
}

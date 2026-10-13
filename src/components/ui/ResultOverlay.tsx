import { useCallback, useEffect, useRef, useState } from 'react'
import { useToast, type ResultState } from '../../store/ToastContext'
import { ConfettiBurst } from './ConfettiBurst'

/** Keep the "working…" state visible long enough to read, even when the work is instant. */
const MIN_LOADING_MS = 650
const AUTO_CLOSE_MS = 2600
/** Longer when there's a button (Undo) to reach */
const AUTO_CLOSE_WITH_ACTION_MS = 5000
const EXIT_MS = 180

function StatusIcon({ status, small = false }: { status: ResultState['status']; small?: boolean }) {
  if (status === 'loading') {
    return (
      <div className="relative grid h-[72px] w-[72px] place-items-center">
        <div className="absolute inset-0 rounded-full bg-brand/15 blur-xl animate-pulse" />
        <div className="relative h-14 w-14 animate-spin rounded-full border-[3px] border-brand/20 border-t-brand" />
      </div>
    )
  }

  const tone = {
    success: 'bg-gain-soft text-gain',
    error: 'bg-loss-soft text-loss',
    warn: 'bg-warn-soft text-warn',
    info: 'bg-brand-soft text-brand-ink',
  }[status]

  return (
    <div
      className={`success-ring grid place-items-center rounded-full animate-pop ${small ? 'h-[52px] w-[52px]' : 'h-[72px] w-[72px]'} ${tone} ${
        status === 'error' ? 'animate-shake' : ''
      }`}
    >
      <svg viewBox="0 0 24 24" className={small ? 'h-7 w-7' : 'h-9 w-9'} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {status === 'success' && <path className="result-draw" d="M5 12.5l4.5 4.5L19 7.5" />}
        {status === 'error' && <path className="result-draw" d="M7 7l10 10M17 7L7 17" />}
        {status === 'warn' && <path className="result-draw" d="M12 7v6m0 4h.01" />}
        {status === 'info' && <path className="result-draw" d="M5 12.5l4.5 4.5L19 7.5" />}
      </svg>
    </div>
  )
}

/**
 * Centered, theme-aware popup for the life of an action: working → success / error.
 * Driven by `showToast(..., { celebrate | popup })`, error toasts and `showResult`.
 */
export function ResultOverlay() {
  const { result, hideResult } = useToast()
  const [shown, setShown] = useState<ResultState | null>(null)
  const [closing, setClosing] = useState(false)
  const loadingSince = useRef(0)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // Mirror `result` into `shown`, holding back the finish of a very short loading state
  useEffect(() => {
    if (!result) {
      if (shown) {
        setClosing(true)
        const t = window.setTimeout(() => {
          setShown(null)
          setClosing(false)
        }, EXIT_MS)
        return () => window.clearTimeout(t)
      }
      return
    }

    setClosing(false)
    if (result.status === 'loading') {
      loadingSince.current = Date.now()
      setShown(result)
      return
    }
    if (shown?.status === 'loading') {
      const wait = Math.max(0, MIN_LOADING_MS - (Date.now() - loadingSince.current))
      const t = window.setTimeout(() => setShown(result), wait)
      return () => window.clearTimeout(t)
    }
    setShown(result)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result])

  const finished = shown && shown.status !== 'loading'
  const autoCloses = finished && (shown.status === 'success' || shown.status === 'info')
  const closeAfter = shown?.action ? AUTO_CLOSE_WITH_ACTION_MS : AUTO_CLOSE_MS

  // Auto-dismiss happy outcomes; errors and warnings wait for the user
  useEffect(() => {
    if (!autoCloses) return
    const t = window.setTimeout(() => hideResult(), closeAfter)
    return () => window.clearTimeout(t)
  }, [autoCloses, shown?.id, hideResult, closeAfter])

  useEffect(() => {
    if (finished && !autoCloses) closeButtonRef.current?.focus()
  }, [finished, autoCloses, shown?.id])

  useEffect(() => {
    if (!finished) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') hideResult()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [finished, hideResult])

  const clearConfetti = useCallback(() => undefined, [])

  if (!shown) return null

  return (
    <>
      {shown.status === 'success' && shown.confetti && <ConfettiBurst key={shown.id} onDone={clearConfetti} />}
      <div
        className={`fixed inset-0 z-[65] grid place-items-center px-6 ${closing ? 'result-backdrop-out' : 'result-backdrop-in'}`}
        onClick={() => finished && hideResult()}
      >
        <div className="absolute inset-0 bg-ink/25 backdrop-blur-[3px] dark:bg-black/50" />
        <div
          role={shown.status === 'error' ? 'alertdialog' : 'status'}
          aria-live={shown.status === 'error' ? 'assertive' : 'polite'}
          aria-busy={shown.status === 'loading'}
          aria-label={shown.detail ? `${shown.title} ${shown.detail.amount}, ${shown.detail.name}` : shown.title}
          onClick={(e) => e.stopPropagation()}
          className={`relative w-full max-w-[340px] overflow-hidden rounded-[28px] border border-line bg-surface px-7 pb-7 pt-8 text-center shadow-[var(--shadow-lift)] ${
            closing ? 'result-card-out' : 'result-card-in'
          }`}
        >
          {shown.detail && finished ? (
            // Receipt: the amount leads, then what it was for
            <>
              <div className="mb-2 flex justify-center">
                <StatusIcon status={shown.status} small />
              </div>
              <h2 className={`text-sm font-bold ${shown.status === 'success' ? 'text-gain' : 'text-ink-muted'}`}>{shown.title}</h2>
              <p className="mt-1 font-display text-4xl font-extrabold tracking-tight tnum text-ink">{shown.detail.amount}</p>
              <p className="mt-1.5 truncate text-base font-bold text-ink">{shown.detail.name}</p>
              {shown.detail.meta && <p className="mt-0.5 truncate text-xs text-ink-muted">{shown.detail.meta}</p>}
              {shown.detail.footnote && (
                <p className="mt-4 rounded-xl bg-surface-muted px-3 py-2 text-xs font-semibold text-ink-soft">{shown.detail.footnote}</p>
              )}
            </>
          ) : (
            <>
              <div className="mb-5 flex justify-center">
                <StatusIcon status={shown.status} />
              </div>
              <h2 className="font-display text-xl font-extrabold tracking-tight text-ink [text-wrap:balance]">{shown.title}</h2>
              {shown.message && <p className="mt-2 text-sm leading-relaxed text-ink-muted [text-wrap:pretty]">{shown.message}</p>}
            </>
          )}

          {finished && shown.action && (
            <button
              type="button"
              onClick={() => {
                shown.action!.onClick()
                hideResult()
              }}
              className="mt-5 inline-flex h-10 items-center justify-center rounded-full border border-line-strong px-5 text-sm font-semibold text-ink transition-all hover:bg-surface-muted active:scale-[0.98] cursor-pointer"
            >
              {shown.action.label}
            </button>
          )}

          {finished && !autoCloses && (
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => hideResult()}
              className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-full bg-ink px-5 text-sm font-semibold text-white shadow-[var(--shadow-soft)] transition-all hover:bg-ink-hover active:scale-[0.98] dark:bg-[#4f46e5] dark:hover:bg-[#4338ca] cursor-pointer"
            >
              Got it
            </button>
          )}

          {autoCloses && (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-surface-muted">
              <div
                key={shown.id}
                className={`result-progress h-full ${shown.status === 'success' ? 'bg-gain' : 'bg-brand'}`}
                style={{ animationDuration: `${closeAfter}ms` }}
              />
            </div>
          )}
        </div>
      </div>
    </>
  )
}

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

export type ToastType = 'success' | 'info' | 'error' | 'warn'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastItem {
  id: string
  message: string
  type: ToastType
  action?: ToastAction
}

export type ResultStatus = 'loading' | 'success' | 'error' | 'info' | 'warn'

/** State of the centered result popup (loading → success / error). */
export interface ResultState {
  id: string
  status: ResultStatus
  title: string
  message?: string
  /** Fire a confetti burst when the popup reaches a success state. */
  confetti?: boolean
}

export interface ToastOptions {
  /** Show the centered success popup with a confetti burst (use for milestones like a completed buy). */
  celebrate?: boolean
  /** Show the centered popup instead of a small toast (no confetti unless `celebrate`). */
  popup?: boolean
  /** Override the popup headline (defaults depend on the status). */
  title?: string
}

interface ToastContextValue {
  toasts: ToastItem[]
  result: ResultState | null
  /**
   * Small corner toast for minor feedback. Errors, `celebrate` and `popup` open the centered
   * result popup instead, replacing a running "loading" popup in place.
   */
  showToast: (message: string, type?: ToastType, action?: ToastAction, options?: ToastOptions) => void
  dismissToast: (id: string) => void
  /** Open (or replace) the centered result popup directly. */
  showResult: (result: Omit<ResultState, 'id'>) => void
  /** Close the result popup. With `onlyIfLoading`, a popup that already finished is left alone. */
  hideResult: (onlyIfLoading?: boolean) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DEFAULT_TITLES: Record<Exclude<ResultStatus, 'loading'>, string> = {
  success: 'Done!',
  error: 'Something went wrong',
  info: 'All set',
  warn: 'Heads up',
}

const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [result, setResult] = useState<ResultState | null>(null)

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showResult = useCallback((next: Omit<ResultState, 'id'>) => {
    setResult({ ...next, id: newId('result') })
  }, [])

  const hideResult = useCallback((onlyIfLoading = false) => {
    setResult((prev) => (onlyIfLoading && prev && prev.status !== 'loading' ? prev : null))
  }, [])

  const showToast = useCallback(
    (message: string, type: ToastType = 'success', action?: ToastAction, options?: ToastOptions) => {
      if (type === 'error' || options?.celebrate || options?.popup) {
        const status: ResultStatus = type
        setResult({
          id: newId('result'),
          status,
          title: options?.title ?? DEFAULT_TITLES[status],
          message,
          confetti: !!options?.celebrate && status === 'success',
        })
        return
      }

      const id = newId('toast')
      setToasts((prev) => [...prev, { id, message, type, action }])
      setTimeout(() => dismissToast(id), action ? 6000 : 3500)
    },
    [dismissToast],
  )

  return (
    <ToastContext.Provider value={{ toasts, result, showToast, dismissToast, showResult, hideResult }}>
      {children}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return ctx
}

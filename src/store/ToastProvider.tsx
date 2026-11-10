import { useCallback, useState, type ReactNode } from 'react'
import { newId } from '../lib/id'
import { toastContext, type ResultState, type ResultStatus, type ToastAction, type ToastItem, type ToastOptions, type ToastType } from './ToastContext'

const DEFAULT_TITLES: Record<Exclude<ResultStatus, 'loading'>, string> = {
  success: 'Done!',
  error: 'Something went wrong',
  info: 'All set',
  warn: 'Heads up',
}

const newToastId = (prefix: string) => `${prefix}-${newId()}`

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [result, setResult] = useState<ResultState | null>(null)

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showResult = useCallback((next: Omit<ResultState, 'id'>) => {
    setResult({ ...next, id: newToastId('result') })
  }, [])

  const hideResult = useCallback((onlyIfLoading = false) => {
    setResult((prev) => (onlyIfLoading && prev && prev.status !== 'loading' ? prev : null))
  }, [])

  const showToast = useCallback(
    (message: string, type: ToastType = 'success', action?: ToastAction, options?: ToastOptions) => {
      if (type === 'error' || options?.celebrate || options?.popup) {
        const status: ResultStatus = type
        setResult({
          id: newToastId('result'),
          status,
          title: options?.title ?? DEFAULT_TITLES[status],
          message,
          confetti: !!options?.celebrate && status === 'success',
          action,
          detail: options?.detail,
        })
        return
      }

      const id = newToastId('toast')
      setToasts((prev) => [...prev, { id, message, type, action }])
      setTimeout(() => dismissToast(id), action ? 6000 : 3500)
    },
    [dismissToast],
  )

  return (
    <toastContext.Provider value={{ toasts, result, showToast, dismissToast, showResult, hideResult }}>
      {children}
    </toastContext.Provider>
  )
}

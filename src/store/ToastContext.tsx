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

export interface ToastOptions {
  /** Fire a confetti burst together with the toast (use for milestones like a completed buy). */
  celebrate?: boolean
}

interface ToastContextValue {
  toasts: ToastItem[]
  /** Increments on every celebration; the container plays one burst per value. */
  celebrationId: number
  showToast: (message: string, type?: ToastType, action?: ToastAction, options?: ToastOptions) => void
  dismissToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [celebrationId, setCelebrationId] = useState(0)

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback((message: string, type: ToastType = 'success', action?: ToastAction, options?: ToastOptions) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const newToast: ToastItem = { id, message, type, action }
    setToasts((prev) => [...prev, newToast])
    if (options?.celebrate) setCelebrationId((n) => n + 1)

    const duration = action ? 6000 : 3500
    setTimeout(() => {
      dismissToast(id)
    }, duration)
  }, [dismissToast])

  return (
    <ToastContext.Provider value={{ toasts, celebrationId, showToast, dismissToast }}>
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

import { createContext, useContext } from 'react'

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
  /** A button under the message (e.g. Undo); the popup stays a little longer to reach it */
  action?: ToastAction
  /** A receipt-like layout instead of title + message: the amount leads, then what it was for */
  detail?: ResultDetail
}

export interface ResultDetail {
  /** e.g. "฿899" — the biggest line */
  amount: string
  /** What it was for, e.g. the bill's name */
  name: string
  /** e.g. "KTC Visa · Bills" */
  meta?: string
  /** A boxed line at the bottom, e.g. "Next due Fri 13 Nov" */
  footnote?: string
}

export interface ToastOptions {
  /** Show the centered success popup with a confetti burst (milestones only: a loan paid off, a goal reached). */
  celebrate?: boolean
  /** Show the centered popup instead of a small toast (no confetti unless `celebrate`). */
  popup?: boolean
  /** Override the popup headline (defaults depend on the status). */
  title?: string
  /** Popup only: show it as a receipt (amount first) instead of title + message */
  detail?: ResultDetail
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

/** Filled in by ToastProvider (ToastProvider.tsx) */
export const toastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(toastContext)
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return ctx
}

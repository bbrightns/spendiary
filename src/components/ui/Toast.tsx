import { useToast, type ToastItem } from '../../store/ToastContext'
import { CheckIcon, AlertIcon, SparkleIcon, CloseIcon } from '../icons'

const TYPE_CONFIG = {
  success: {
    icon: <CheckIcon className="h-4 w-4 shrink-0 text-gain" strokeWidth={2.4} />,
    style: 'border-gain/30 bg-surface dark:bg-surface text-ink',
    badge: 'bg-gain-soft text-gain',
  },
  error: {
    icon: <AlertIcon className="h-4 w-4 shrink-0 text-loss" />,
    style: 'border-loss/30 bg-surface dark:bg-surface text-ink',
    badge: 'bg-loss-soft text-loss',
  },
  warn: {
    icon: <AlertIcon className="h-4 w-4 shrink-0 text-warn" />,
    style: 'border-warn/30 bg-surface dark:bg-surface text-ink',
    badge: 'bg-warn-soft text-warn',
  },
  info: {
    icon: <SparkleIcon className="h-4 w-4 shrink-0 text-brand" strokeWidth={2} />,
    style: 'border-brand/30 bg-surface dark:bg-surface text-ink',
    badge: 'bg-brand-soft text-brand-ink',
  },
}

function ToastElement({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const config = TYPE_CONFIG[toast.type] || TYPE_CONFIG.info

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-auto flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-[var(--shadow-lift)] transition-all duration-300 animate-rise ${config.style}`}
    >
      <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-xl ${config.badge}`}>
        {config.icon}
      </div>
      <p className="min-w-0 flex-1 text-[13.5px] font-semibold text-ink leading-snug">
        {toast.message}
      </p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink cursor-pointer"
      >
        <CloseIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

export function ToastContainer() {
  const { toasts, dismissToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <div
      aria-label="Notifications"
      className="pointer-events-none fixed bottom-20 left-4 right-4 z-50 flex flex-col gap-2.5 sm:bottom-6 sm:left-auto sm:right-6 sm:w-96"
    >
      {toasts.map((toast) => (
        <ToastElement
          key={toast.id}
          toast={toast}
          onDismiss={() => dismissToast(toast.id)}
        />
      ))}
    </div>
  )
}

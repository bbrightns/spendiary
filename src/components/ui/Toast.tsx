import { useToast, type ToastItem } from '../../store/ToastContext'
import { ResultOverlay } from './ResultOverlay'
import { CheckIcon, AlertIcon, SparkleIcon, CloseIcon } from '../icons'

const TYPE_CONFIG = {
  success: {
    icon: <CheckIcon className="h-4 w-4 shrink-0 text-gain-ink" strokeWidth={2.4} />,
    style: 'border-gain/30 bg-surface text-ink',
    badge: 'bg-gain-soft text-gain-ink',
  },
  error: {
    icon: <AlertIcon className="h-4 w-4 shrink-0 text-loss-ink" />,
    style: 'border-loss/30 bg-surface text-ink',
    badge: 'bg-loss-soft text-loss-ink',
  },
  warn: {
    icon: <AlertIcon className="h-4 w-4 shrink-0 text-warn-ink" />,
    style: 'border-warn/30 bg-surface text-ink',
    badge: 'bg-warn-soft text-warn-ink',
  },
  info: {
    icon: <SparkleIcon className="h-4 w-4 shrink-0 text-link" strokeWidth={2} />,
    style: 'border-brand/30 bg-surface text-ink',
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
      <div
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-xl ${config.badge} ${
          toast.type === 'success' ? 'animate-pop success-ring' : ''
        }`}
      >
        {config.icon}
      </div>
      <p className="min-w-0 flex-1 text-sm font-semibold text-ink leading-snug">
        {toast.message}
      </p>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action?.onClick()
            onDismiss()
          }}
          className="shrink-0 rounded-xl bg-primary text-white hover:bg-primary-hover px-3 py-1 text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
        >
          {toast.action.label}
        </button>
      )}
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

  return (
    <>
      <ResultOverlay />
      {toasts.length > 0 && (
        <div
          aria-label="Notifications"
          className="pointer-events-none fixed bottom-20 left-4 right-4 z-[60] flex flex-col gap-2.5 sm:bottom-6 sm:left-auto sm:right-6 sm:w-96"
        >
          {toasts.map((toast) => (
            <ToastElement
              key={toast.id}
              toast={toast}
              onDismiss={() => dismissToast(toast.id)}
            />
          ))}
        </div>
      )}
    </>
  )
}

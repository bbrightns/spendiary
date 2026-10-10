import type { ButtonHTMLAttributes, ReactNode } from 'react'

function cx(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
  size?: 'sm' | 'md'
  /** Shows a spinner and blocks clicks (e.g. while a save is being applied). */
  loading?: boolean
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  disabled,
  ...rest
}: ButtonProps) {
  const variants = {
    primary:
      'bg-ink text-white hover:bg-ink-hover dark:bg-[#4f46e5] dark:hover:bg-[#4338ca] shadow-[var(--shadow-soft)] active:scale-[0.98]',
    secondary:
      'bg-surface text-ink border border-line-strong hover:bg-surface-muted active:scale-[0.98]',
    ghost: 'text-ink-soft hover:bg-surface-muted',
    danger: 'bg-loss text-white dark:bg-rose-600 dark:hover:bg-rose-700 hover:opacity-90 active:scale-[0.98]',
    success: 'bg-gain text-white dark:bg-emerald-600 dark:hover:bg-emerald-700 hover:opacity-90 active:scale-[0.98]',
  }
  const sizes = {
    sm: 'h-9 px-3.5 text-sm gap-1.5',
    md: 'h-11 px-5 text-sm gap-2',
  }
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center rounded-full font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:opacity-50',
        loading && 'cursor-progress',
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden
          className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  )
}

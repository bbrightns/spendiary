import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode
  label: string
  variant?: 'ghost' | 'danger' | 'brand'
  size?: 'sm' | 'md'
}

export function IconButton({
  icon,
  label,
  variant = 'ghost',
  size = 'md',
  className = '',
  ...rest
}: IconButtonProps) {
  const variantClasses = {
    ghost: 'text-ink-muted hover:bg-surface-muted hover:text-ink',
    danger: 'text-ink-muted hover:bg-loss-soft hover:text-loss',
    brand: 'bg-brand-soft text-brand hover:bg-brand hover:text-white',
  }

  const sizeClasses = {
    sm: 'h-8 w-8 min-h-[32px] min-w-[32px]',
    md: 'h-9 w-9 min-h-[36px] min-w-[36px]',
  }

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center rounded-lg transition-colors cursor-pointer active:scale-95 ${
        sizeClasses[size]
      } ${variantClasses[variant]} ${className}`}
      {...rest}
    >
      {icon}
    </button>
  )
}

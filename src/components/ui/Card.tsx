import type { HTMLAttributes, ReactNode } from 'react'

function cx(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  padded?: boolean
  hover?: boolean
}

export function Card({ children, padded = true, hover = false, className, ...rest }: CardProps) {
  return (
    <div
      className={cx(
        'rounded-[var(--radius-card)] bg-surface border border-line shadow-[var(--shadow-soft)]',
        hover && 'transition-shadow duration-300 hover:shadow-[var(--shadow-lift)]',
        padded && 'p-5 sm:p-6',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

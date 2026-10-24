import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

const LINK = 'text-sm font-semibold text-link hover:underline'

/** The one text-link style: names where it goes ("Manage", "See analysis →"). */
export function TextLink({ to, children, className = '' }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link to={to} className={`${LINK} ${className}`}>
      {children}
    </Link>
  )
}

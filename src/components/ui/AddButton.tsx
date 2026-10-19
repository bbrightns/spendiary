import { Button } from './Button'
import { PlusIcon } from '../icons'

interface Props {
  onClick: () => void
  label?: string
  className?: string
  /** Only the + on phones, the label from sm up */
  compact?: boolean
}

export function AddButton({ onClick, label = 'Add', className = '', compact = false }: Props) {
  return (
    <Button
      variant="primary"
      size="sm"
      onClick={onClick}
      aria-label={label}
      title={compact ? label : undefined}
      className={`h-9 text-xs sm:text-sm gap-1.5 cursor-pointer ${compact ? 'w-9 px-0! sm:w-auto sm:px-3.5!' : 'px-3.5'} ${className}`}
    >
      <PlusIcon className="h-4 w-4 shrink-0" strokeWidth={2.2} />
      <span className={compact ? 'hidden sm:inline' : undefined}>{label}</span>
    </Button>
  )
}

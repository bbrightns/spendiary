import { Button } from './Button'
import { PlusIcon } from '../icons'

interface Props {
  onClick: () => void
  label?: string
  className?: string
}

export function AddButton({ onClick, label = 'Add', className = '' }: Props) {
  return (
    <Button
      variant="primary"
      size="sm"
      onClick={onClick}
      aria-label={label}
      className={`h-9 px-3.5 text-xs sm:text-sm gap-1.5 cursor-pointer ${className}`}
    >
      <PlusIcon className="h-4 w-4" strokeWidth={2.2} />
      <span>{label}</span>
    </Button>
  )
}

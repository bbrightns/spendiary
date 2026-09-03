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
      className={`h-10 px-4 text-[14px] gap-1.5 cursor-pointer ${className}`}
    >
      <PlusIcon className="h-[18px] w-[18px]" strokeWidth={2.2} />
      <span>{label}</span>
    </Button>
  )
}

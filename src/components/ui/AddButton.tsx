import { PlusIcon } from '../icons'

interface Props {
  onClick: () => void
  label?: string
}

export function AddButton({ onClick, label = 'Add' }: Props) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="inline-flex h-10 items-center gap-1.5 rounded-full bg-ink px-4 text-[14px] font-semibold text-white shadow-[var(--shadow-soft)] transition-all duration-200 hover:bg-ink-hover dark:bg-[#4f46e5] dark:hover:bg-[#4338ca] active:scale-95 cursor-pointer"
    >
      <PlusIcon className="h-[18px] w-[18px]" strokeWidth={2.2} />
      {label}
    </button>
  )
}

interface EditButtonProps {
  onClick: () => void
  label?: string
}

/** Small ghost edit affordance for list rows. */
export function EditButton({ onClick, label = 'Edit' }: EditButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink after:absolute after:-inset-1.5 after:content-['']"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-[17px] w-[17px]"
      >
        <path d="M14 5.5 18.5 10M4 20l1-4L16 5a2.1 2.1 0 0 1 3 3L8 19l-4 1Z" />
      </svg>
    </button>
  )
}

import type { ReactNode } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'

interface ConfirmModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description?: string
  confirmText?: string
  confirmVariant?: 'danger' | 'primary'
  confirmIcon?: ReactNode
  cancelText?: string
  children?: ReactNode
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  confirmVariant = 'danger',
  confirmIcon,
  cancelText = 'Cancel',
  children,
}: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <div className="flex flex-col gap-2.5 w-full">
          <Button
            variant={confirmVariant}
            onClick={onConfirm}
            className="w-full flex items-center justify-center gap-2 cursor-pointer"
          >
            {confirmIcon}
            <span>{confirmText}</span>
          </Button>
          <Button
            variant="ghost"
            onClick={onClose}
            className="w-full cursor-pointer text-ink-muted hover:text-ink"
          >
            {cancelText}
          </Button>
        </div>
      }
    >
      {children && <div className="space-y-4 pb-1">{children}</div>}
    </Modal>
  )
}

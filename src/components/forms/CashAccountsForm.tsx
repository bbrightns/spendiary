import { useEffect, useRef, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { DragHandleIcon, PlusIcon, TrashIcon, WalletIcon } from '../icons'
import { useData } from '../../store/DataContext'
import { useToast } from '../../store/ToastContext'
import type { CashAccount } from '../../lib/types'
import { thb } from '../../lib/format'

interface Props {
  open: boolean
  onClose: () => void
  initialAccountId?: string | null
}

interface Draft {
  id: string
  name: string
  balance: string
  currency: 'THB' | 'USD'
}

function tempId(): string {
  return `tmp-${Math.random().toString(36).slice(2, 9)}`
}

function formatWithCommas(value: string | number): string {
  const s = String(value)
  let clean = s.replace(/[^0-9.]/g, '')
  const parts = clean.split('.')
  if (parts.length > 2) {
    clean = parts[0] + '.' + parts.slice(1).join('')
  }
  const cleanParts = clean.split('.')
  const integerPart = cleanParts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  if (cleanParts.length > 1) {
    return `${integerPart}.${cleanParts[1].slice(0, 2)}`
  }
  return integerPart
}

export function CashAccountsForm({ open, onClose, initialAccountId }: Props) {
  const { data, setCashAccounts, usdThb } = useData()
  const { showToast } = useToast()
  const [rows, setRows] = useState<Draft[]>([])
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const [dropPosition, setDropPosition] = useState<'top' | 'bottom' | null>(null)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)

  const balanceInputRefs = useRef<Map<string, HTMLInputElement>>(new Map())
  const nameInputRefs = useRef<Map<string, HTMLInputElement>>(new Map())

  useEffect(() => {
    if (!open) {
      setHighlightedId(null)
      return
    }
    setRows(
      data.cashAccounts.length > 0
        ? data.cashAccounts.map((a) => ({
            id: a.id,
            name: a.name,
            balance: formatWithCommas(a.balance),
            currency: a.currency ?? 'THB',
          }))
        : [{ id: tempId(), name: '', balance: '', currency: 'THB' }],
    )

    if (initialAccountId) {
      setHighlightedId(initialAccountId)
      const timer = setTimeout(() => {
        const input = balanceInputRefs.current.get(initialAccountId)
        if (input) {
          input.focus()
          input.select()
          input.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
      }, 80)
      const clearTimer = setTimeout(() => {
        setHighlightedId(null)
      }, 2200)
      return () => {
        clearTimeout(timer)
        clearTimeout(clearTimer)
      }
    }
  }, [open, data.cashAccounts, initialAccountId])

  const rate = usdThb && usdThb > 0 ? usdThb : 35

  const totalThb = rows.reduce((sum, r) => {
    const clean = r.balance.replace(/[^0-9.]/g, '')
    const val = clean === '' ? 0 : Number(clean)
    return sum + (r.currency === 'USD' ? val * rate : val)
  }, 0)

  const update = (id: string, patch: Partial<Draft>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const remove = (id: string) => setRows((rs) => rs.filter((r) => r.id !== id))
  const add = () => {
    const id = tempId()
    setRows((rs) => [...rs, { id, name: '', balance: '', currency: 'THB' }])
    setTimeout(() => {
      const nameInput = nameInputRefs.current.get(id)
      if (nameInput) {
        nameInput.focus()
        nameInput.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }, 50)
  }

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    
    const rect = e.currentTarget.getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    const pos = e.clientY < midY ? 'top' : 'bottom'

    if (dragOverIdx !== index || dropPosition !== pos) {
      setDragOverIdx(index)
      setDropPosition(pos)
    }
  }

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault()
    if (draggedIdx === null) {
      setDraggedIdx(null)
      setDragOverIdx(null)
      setDropPosition(null)
      return
    }

    let insertIndex = targetIndex
    if (dropPosition === 'bottom') {
      insertIndex += 1
    }
    if (draggedIdx < insertIndex) {
      insertIndex -= 1
    }

    if (draggedIdx !== insertIndex) {
      setRows((prev) => {
        const next = [...prev]
        const [moved] = next.splice(draggedIdx, 1)
        next.splice(insertIndex, 0, moved)
        return next
      })
    }

    setDraggedIdx(null)
    setDragOverIdx(null)
    setDropPosition(null)
  }

  const handleDragEnd = () => {
    setDraggedIdx(null)
    setDragOverIdx(null)
    setDropPosition(null)
  }

  function save() {
    const cleaned: CashAccount[] = rows
      .filter((r) => r.name.trim() !== '')
      .map((r) => {
        const clean = r.balance.replace(/[^0-9.]/g, '')
        return {
          id: r.id.startsWith('tmp-') ? tempId().replace('tmp-', 'cash-') : r.id,
          name: r.name.trim(),
          balance: clean === '' ? 0 : Number(clean),
          currency: r.currency,
        }
      })
    setCashAccounts(cleaned)
    showToast('Cash accounts updated', 'success')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cash accounts"
      description="Track where your cash sits. Total cash is the sum of all accounts."
      footer={
        <div className="space-y-2.5">
          <div className="flex items-center justify-between rounded-xl bg-surface-muted px-4 py-2.5 border border-line/40">
            <span className="flex items-center gap-2 text-[13px] font-semibold text-ink-soft">
              <WalletIcon className="h-[17px] w-[17px] text-cash" />
              Total cash (THB)
            </span>
            <span className="font-display text-[17px] font-extrabold tnum text-ink">{thb(totalThb)}</span>
          </div>

          <Button onClick={save} className="w-full">
            Save accounts
          </Button>
        </div>
      }
    >
      <div className="space-y-3.5 pb-2">
        {rows.map((r, index) => {
          const isDragging = draggedIdx === index
          const isOver = dragOverIdx === index
          const showTopLine = isOver && dropPosition === 'top' && !isDragging
          const showBottomLine = isOver && dropPosition === 'bottom' && !isDragging
          const isHighlighted = highlightedId === r.id

          return (
            <div
              key={r.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`relative flex items-center gap-2 rounded-xl p-1 transition-all duration-300 ${
                isDragging ? 'opacity-30 scale-[0.98]' : ''
              } ${
                isHighlighted
                  ? 'ring-2 ring-brand/70 bg-brand-soft/50 dark:bg-brand-soft/30 shadow-xs'
                  : ''
              }`}
            >
              {/* Insertion line indicator above */}
              {showTopLine && (
                <div className="absolute -top-2 left-0 right-0 z-10 flex items-center">
                  <div className="h-2 w-2 rounded-full bg-brand shadow-sm shadow-brand" />
                  <div className="h-0.5 flex-1 bg-brand shadow-sm shadow-brand" />
                  <div className="h-2 w-2 rounded-full bg-brand shadow-sm shadow-brand" />
                </div>
              )}

              {/* Insertion line indicator below */}
              {showBottomLine && (
                <div className="absolute -bottom-2 left-0 right-0 z-10 flex items-center">
                  <div className="h-2 w-2 rounded-full bg-brand shadow-sm shadow-brand" />
                  <div className="h-0.5 flex-1 bg-brand shadow-sm shadow-brand" />
                  <div className="h-2 w-2 rounded-full bg-brand shadow-sm shadow-brand" />
                </div>
              )}
              <div
                className="grid h-11 w-6 shrink-0 cursor-grab active:cursor-grabbing place-items-center text-ink-muted hover:text-ink select-none"
                title="Drag to reorder"
              >
                <DragHandleIcon className="h-5 w-5" />
              </div>
              <input
                ref={(el) => {
                  if (el) nameInputRefs.current.set(r.id, el)
                  else nameInputRefs.current.delete(r.id)
                }}
                className="h-11 w-[38%] rounded-xl border border-line-strong bg-surface px-3.5 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-brand focus:ring-2 focus:ring-brand/15"
                placeholder="Bank / location"
                value={r.name}
                onChange={(e) => update(r.id, { name: e.target.value })}
              />
              <div className="relative flex-1">
                <button
                  type="button"
                  onClick={() =>
                    update(r.id, { currency: r.currency === 'USD' ? 'THB' : 'USD' })
                  }
                  aria-label={`Toggle currency for ${r.name || 'account'}, currently ${r.currency}`}
                  className={`absolute left-1.5 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1 text-[13px] font-extrabold transition-all select-none cursor-pointer ${
                    r.currency === 'USD'
                      ? 'bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/30 hover:bg-sky-500/25'
                      : 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30 hover:bg-emerald-500/25'
                  }`}
                  title="Click to toggle currency (THB / USD)"
                >
                  {r.currency === 'USD' ? '$' : '฿'}
                </button>
                <input
                  ref={(el) => {
                    if (el) balanceInputRefs.current.set(r.id, el)
                    else balanceInputRefs.current.delete(r.id)
                  }}
                  type="text"
                  inputMode="decimal"
                  className="h-11 w-full rounded-xl border border-line-strong bg-surface pl-10 pr-3 text-[15px] tnum text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-brand focus:ring-2 focus:ring-brand/15"
                  placeholder="0"
                  value={r.balance}
                  onChange={(e) =>
                    update(r.id, { balance: formatWithCommas(e.target.value) })
                  }
                />
              </div>
              <button
                type="button"
                onClick={() => remove(r.id)}
                aria-label={`Remove account ${r.name || ''}`}
                className="grid h-11 w-10 shrink-0 place-items-center rounded-xl text-ink-muted transition-colors hover:bg-loss-soft hover:text-loss cursor-pointer"
              >
                <TrashIcon className="h-[18px] w-[18px]" />
              </button>
            </div>
          )
        })}

        <button
          type="button"
          onClick={add}
          className="mt-1 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[13.5px] font-semibold text-brand transition-colors hover:text-brand-ink cursor-pointer"
        >
          <PlusIcon className="h-4 w-4" strokeWidth={2.2} />
          Add account
        </button>
      </div>
    </Modal>
  )
}

import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { PlusIcon, TrashIcon, WalletIcon } from '../icons'
import { useData } from '../../store/DataContext'
import type { CashAccount } from '../../lib/types'
import { thb } from '../../lib/format'

interface Props {
  open: boolean
  onClose: () => void
}

interface Draft {
  id: string
  name: string
  balance: string
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

export function CashAccountsForm({ open, onClose }: Props) {
  const { data, setCashAccounts } = useData()
  const [rows, setRows] = useState<Draft[]>([])

  useEffect(() => {
    if (!open) return
    setRows(
      data.cashAccounts.length > 0
        ? data.cashAccounts.map((a) => ({ id: a.id, name: a.name, balance: formatWithCommas(a.balance) }))
        : [{ id: tempId(), name: '', balance: '' }],
    )
  }, [open, data.cashAccounts])

  const total = rows.reduce((sum, r) => {
    const clean = r.balance.replace(/[^0-9.]/g, '')
    return sum + (clean === '' ? 0 : Number(clean))
  }, 0)

  const update = (id: string, patch: Partial<Draft>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const remove = (id: string) => setRows((rs) => rs.filter((r) => r.id !== id))
  const add = () => setRows((rs) => [...rs, { id: tempId(), name: '', balance: '' }])

  function save() {
    const cleaned: CashAccount[] = rows
      .filter((r) => r.name.trim() !== '')
      .map((r) => {
        const clean = r.balance.replace(/[^0-9.]/g, '')
        return {
          id: r.id.startsWith('tmp-') ? tempId().replace('tmp-', 'cash-') : r.id,
          name: r.name.trim(),
          balance: clean === '' ? 0 : Number(clean),
        }
      })
    setCashAccounts(cleaned)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cash accounts"
      description="Track where your cash sits. Total cash is the sum of all accounts."
    >
      <div className="space-y-3.5">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-2">
            <input
              className="h-11 w-[42%] rounded-xl border border-line-strong bg-surface px-3.5 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-brand focus:ring-2 focus:ring-brand/15"
              placeholder="Bank / location"
              value={r.name}
              onChange={(e) => update(r.id, { name: e.target.value })}
            />
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] font-medium text-ink-muted">
                ฿
              </span>
              <input
                type="text"
                inputMode="decimal"
                className="h-11 w-full rounded-xl border border-line-strong bg-surface pl-8 pr-3 text-[15px] tnum text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-brand focus:ring-2 focus:ring-brand/15"
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
              aria-label="Remove account"
              className="grid h-11 w-10 shrink-0 place-items-center rounded-xl text-ink-muted transition-colors hover:bg-loss-soft hover:text-loss"
            >
              <TrashIcon className="h-[18px] w-[18px]" />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={add}
          className="mt-1 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[13.5px] font-semibold text-brand transition-colors hover:text-brand-ink"
        >
          <PlusIcon className="h-4 w-4" strokeWidth={2.2} />
          Add account
        </button>

        <div className="mt-3 flex items-center justify-between rounded-2xl bg-surface-muted px-4 py-3">
          <span className="flex items-center gap-2 text-[13.5px] font-semibold text-ink-soft">
            <WalletIcon className="h-[18px] w-[18px] text-cash" />
            Total cash
          </span>
          <span className="font-display text-[18px] font-extrabold tnum text-ink">{thb(total)}</span>
        </div>

        <div className="pt-4">
          <Button onClick={save} className="w-full">
            Save accounts
          </Button>
        </div>
      </div>
    </Modal>
  )
}

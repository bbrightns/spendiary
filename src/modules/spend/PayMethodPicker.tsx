import { useId } from 'react'
import { ChevronDownIcon, CreditCardIcon, WalletIcon } from '../../components/icons'
import { thb } from '../../lib/format'
import type { PayMethod } from './useSpend'

export const NOT_TRACKED = ''

interface Props {
  label: string
  methods: PayMethod[]
  value: string
  onChange: (id: string) => void
  favoriteIds: string[]
  defaultId?: string
  /** Offer "Not tracked" (no balance moves) */
  allowNone?: boolean
  /** Hide one method (e.g. the "from" side of a transfer) */
  excludeId?: string
}

export function MethodIcon({ method, className = 'h-4 w-4' }: { method: Pick<PayMethod, 'kind' | 'color'>; className?: string }) {
  const Icon = method.kind === 'card' ? CreditCardIcon : WalletIcon
  return <Icon className={className} style={method.color ? { color: method.color } : undefined} />
}

/** One-tap chips for favorites + default, everything else under "Other". */
export function PayMethodPicker({ label, methods, value, onChange, favoriteIds, defaultId, allowNone, excludeId }: Props) {
  const selectId = useId()
  const usable = methods.filter((m) => m.id !== excludeId)
  const byId = (id?: string) => usable.find((m) => m.id === id)

  const pinnedIds: string[] = []
  const pin = (id?: string) => {
    if (id && byId(id) && !pinnedIds.includes(id)) pinnedIds.push(id)
  }
  pin(defaultId)
  favoriteIds.forEach(pin)
  if (pinnedIds.length === 0) usable.filter((m) => !m.locked).slice(0, 3).forEach((m) => pin(m.id))
  pin(value) // keep whatever is selected visible
  const pinned = pinnedIds.map((id) => byId(id)!)

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-ink-soft">{label}</span>
        {value === NOT_TRACKED && allowNone && <span className="text-xs text-ink-muted">Not tracked: no balance changes</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        {pinned.map((m) => {
          const active = m.id === value
          return (
            <button
              key={m.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(m.id)}
              className={`flex max-w-full items-center gap-2 rounded-2xl border px-3 py-2 text-left transition-all cursor-pointer active:scale-[0.98] ${
                active
                  ? 'border-brand/50 bg-brand-soft ring-2 ring-brand/15'
                  : 'border-line bg-surface hover:bg-surface-muted/60'
              }`}
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-surface-muted">
                <MethodIcon method={m} />
              </span>
              <span className="min-w-0">
                <span className={`block max-w-[9.5rem] truncate text-xs font-bold ${active ? 'text-brand-ink' : 'text-ink'}`}>
                  {m.name}
                </span>
                <span className="block text-[11px] font-medium text-ink-muted tnum">
                  {m.id === defaultId && <span className="font-bold text-brand-ink">Default · </span>}
                  {m.kind === 'card'
                    ? `${thb(Math.max(0, (m.creditLimit ?? 0) - m.balance), true)} left`
                    : thb(m.balance, true)}
                </span>
              </span>
            </button>
          )
        })}

        {/* Everything else */}
        <label
          htmlFor={selectId}
          className="relative flex items-center gap-1.5 rounded-2xl border border-dashed border-line-strong px-3 py-2 text-xs font-semibold text-ink-soft hover:bg-surface-muted/60 cursor-pointer"
        >
          {value === NOT_TRACKED && allowNone ? 'Not tracked' : 'Other'}
          <ChevronDownIcon className="h-3.5 w-3.5" />
          <select
            id={selectId}
            aria-label={`${label}: choose another`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          >
            {allowNone && <option value={NOT_TRACKED}>Not tracked</option>}
            {!allowNone && value === NOT_TRACKED && <option value={NOT_TRACKED}>Choose…</option>}
            {usable.some((m) => m.kind === 'card') && (
              <optgroup label="Credit cards">
                {usable.filter((m) => m.kind === 'card').map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </optgroup>
            )}
            <optgroup label="Wallets">
              {usable.filter((m) => m.kind === 'cash').map((m) => (
                <option key={m.id} value={m.id}>{`${m.name} · ${thb(m.balance, true)}`}</option>
              ))}
            </optgroup>
          </select>
        </label>
      </div>
    </div>
  )
}

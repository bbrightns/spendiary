import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { FormActions } from '../../components/forms/FormActions'
import { useToast } from '../../store/ToastContext'
import { thb } from '../../lib/format'
import type { SpendCard } from '../../lib/types'
import { useSpend, type PayMethod } from './useSpend'

export const CARD_COLORS = ['#0f172a', '#4f46e5', '#0ea5e9', '#16a34a', '#e11d48', '#f59e0b', '#7c3aed', '#db2777']

export function StarIcon({ filled, className = 'h-4 w-4' }: { filled?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round">
      <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
    </svg>
  )
}

/** The look of an on/off switch; the parent button carries role="switch". */
export function SwitchVisual({ on }: { on: boolean }) {
  return (
    <span className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${on ? 'bg-brand' : 'bg-line-strong'}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-xs transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
    </span>
  )
}

/** Favorite + default switches, shared by the card and wallet sheets. */
function QuickAddPrefs({ id }: { id: string }) {
  const { settings, toggleFavorite, setDefaultAccount } = useSpend()
  const fav = (settings.favoriteAccountIds ?? []).includes(id)
  const isDefault = settings.defaultAccountId === id
  const row = 'flex w-full items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3 text-left cursor-pointer hover:bg-surface-muted/50'
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-ink-soft">Quick add</p>
      <button type="button" role="switch" aria-checked={fav} onClick={() => toggleFavorite(id)} className={row}>
        <span>
          <span className="flex items-center gap-1.5 text-sm font-bold text-ink">
            <StarIcon filled={fav} className="h-4 w-4 text-amber-500" /> Favorite
          </span>
          <span className="block text-xs text-ink-muted">Show as a one-tap choice</span>
        </span>
        <SwitchVisual on={fav} />
      </button>
      <button type="button" role="switch" aria-checked={isDefault} onClick={() => setDefaultAccount(isDefault ? undefined : id)} className={row}>
        <span>
          <span className="block text-sm font-bold text-ink">Default</span>
          <span className="block text-xs text-ink-muted">Preselected when you add an expense</span>
        </span>
        <SwitchVisual on={isDefault} />
      </button>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-ink-soft">{label}</span>
        {hint && <span className="text-xs text-ink-muted">{hint}</span>}
      </div>
      {children}
    </label>
  )
}

const inputClass =
  'h-11 w-full rounded-xl border border-line-strong bg-surface px-3.5 text-base text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-brand focus:ring-2 focus:ring-brand/15 tnum'

const digits = (v: string) => v.replace(/[^\d.,]/g, '')
const num = (v: string) => Number(v.replace(/,/g, ''))

interface CardSheetProps {
  open: boolean
  /** Card to edit; omit to add a new one */
  card?: SpendCard
  onClose: () => void
}

export function CardSheet({ open, card, onClose }: CardSheetProps) {
  const { upsertCard, removeCard } = useSpend()
  const { showToast } = useToast()
  const [form, setForm] = useState({ name: '', last4: '', limit: '', owed: '', statementDay: '25', dueDay: '10', color: CARD_COLORS[0] })
  const [inNetWorth, setInNetWorth] = useState(true)
  const [lastOpen, setLastOpen] = useState(false)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) setInNetWorth(!card?.excludeFromNetWorth)
    if (open)
      setForm(
        card
          ? {
              name: card.name,
              last4: card.last4 ?? '',
              limit: String(card.creditLimit),
              owed: String(card.balance),
              statementDay: String(card.statementDay),
              dueDay: String(card.dueDay),
              color: card.color ?? CARD_COLORS[0],
            }
          : { name: '', last4: '', limit: '', owed: '0', statementDay: '25', dueDay: '10', color: CARD_COLORS[(Math.random() * CARD_COLORS.length) | 0] },
      )
  }

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }))
  const dayOk = (v: string) => Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 31
  const canSave =
    form.name.trim() !== '' && num(form.limit) > 0 && Number.isFinite(num(form.owed || '0')) && dayOk(form.statementDay) && dayOk(form.dueDay)

  const save = () => {
    upsertCard({
      id: card?.id,
      name: form.name.trim(),
      last4: form.last4.trim() || undefined,
      color: form.color,
      creditLimit: num(form.limit),
      balance: num(form.owed || '0'),
      statementDay: Number(form.statementDay),
      excludeFromNetWorth: inNetWorth ? undefined : true,
      dueDay: Number(form.dueDay),
    })
    showToast(card ? 'Card updated' : 'Card added')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={card ? 'Edit card' : 'Add credit card'}
      size="md"
      footer={
        <FormActions
          editing={!!card}
          canSave={canSave}
          onSave={save}
          onDelete={() => {
            if (!card) return
            removeCard(card.id)
            showToast('Card removed', 'info')
            onClose()
          }}
        />
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-3">
          <Field label="Card name">
            <input className={inputClass} value={form.name} onChange={(e) => set('name')(e.target.value)} placeholder="KBank Platinum" />
          </Field>
          <Field label="Last 4">
            <input
              className={inputClass}
              inputMode="numeric"
              maxLength={4}
              value={form.last4}
              onChange={(e) => set('last4')(e.target.value.replace(/\D/g, ''))}
              placeholder="1234"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Credit limit">
            <input className={inputClass} inputMode="decimal" value={form.limit} onChange={(e) => set('limit')(digits(e.target.value))} placeholder="100,000" />
          </Field>
          <Field label="Owed now">
            <input className={inputClass} inputMode="decimal" value={form.owed} onChange={(e) => set('owed')(digits(e.target.value))} placeholder="0" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Statement day" hint="วันตัดรอบ">
            <input className={inputClass} inputMode="numeric" maxLength={2} value={form.statementDay} onChange={(e) => set('statementDay')(e.target.value.replace(/\D/g, ''))} />
          </Field>
          <Field label="Due day" hint="วันจ่าย">
            <input className={inputClass} inputMode="numeric" maxLength={2} value={form.dueDay} onChange={(e) => set('dueDay')(e.target.value.replace(/\D/g, ''))} />
          </Field>
        </div>
        {(!dayOk(form.statementDay) || !dayOk(form.dueDay)) && <p className="text-xs font-semibold text-loss">Days go from 1 to 31.</p>}

        <div>
          <p className="mb-2 text-sm font-semibold text-ink-soft">Color</p>
          <div className="flex flex-wrap gap-2">
            {CARD_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                aria-pressed={form.color === c}
                onClick={() => set('color')(c)}
                className={`h-8 w-8 rounded-full transition-transform cursor-pointer ${form.color === c ? 'scale-110 ring-2 ring-brand ring-offset-2 ring-offset-surface' : ''}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={inNetWorth}
          onClick={() => setInNetWorth((v) => !v)}
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3 text-left cursor-pointer hover:bg-surface-muted/50"
        >
          <span>
            <span className="block text-sm font-bold text-ink">Count in net worth</span>
            <span className="block text-xs text-ink-muted">Turn off if this card is already in Debts, so it isn't counted twice</span>
          </span>
          <SwitchVisual on={inNetWorth} />
        </button>

        {card && <QuickAddPrefs id={card.id} />}
      </div>
    </Modal>
  )
}

export function WalletSheet({ wallet, onClose }: { wallet?: PayMethod; onClose: () => void }) {
  const navigate = useNavigate()
  return (
    <Modal open={!!wallet} onClose={onClose} title={wallet?.name ?? 'Wallet'} description={wallet ? `Balance ${thb(wallet.balance)}` : undefined} size="sm">
      {wallet && (
        <div className="space-y-4">
          <QuickAddPrefs id={wallet.id} />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" size="sm" onClick={() => navigate(`/spend/txns?q=${encodeURIComponent(wallet.name.toLowerCase())}`)}>
              Transactions
            </Button>
            <Button variant="secondary" size="sm" onClick={() => navigate('/cash')}>
              Manage in Cash
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

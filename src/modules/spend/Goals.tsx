import { useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { Card } from '../../components/ui/Card'
import { AddButton } from '../../components/ui/AddButton'
import { FormActions } from '../../components/forms/FormActions'
import { useToast } from '../../store/ToastContext'
import { localDateStr, thb } from '../../lib/format'
import type { SpendGoal } from '../../lib/types'
import { CATEGORY_ICONS, CATEGORY_TONES } from './categories'
import { goalProgress } from './logic'
import { TONES, type Tone } from './tones'
import { useSpend } from './useSpend'

const GOAL_ICONS = ['plane', 'home', 'car', 'gift', 'grad', 'heart', 'phone', 'shield', 'sparkles', 'coins', 'wallet', 'tag']

const inputClass =
  'h-11 w-full rounded-xl border border-line-strong bg-surface px-3.5 text-base text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-brand focus:ring-2 focus:ring-brand/15'

const toneOf = (t?: string): Tone => (t && t in TONES ? (t as Tone) : 'emerald')
const num = (v: string) => Number(v.replace(/,/g, ''))
const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Savings goals for the Accounts page: progress bars, and what to save each month. */
export function GoalsSection() {
  const { goals, wallets } = useSpend()
  const [sheet, setSheet] = useState<{ open: boolean; goal?: SpendGoal }>({ open: false })

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="font-display text-lg font-extrabold text-ink">Savings goals</h2>
        <AddButton onClick={() => setSheet({ open: true })} label="Add goal" />
      </div>
      {goals.length === 0 ? (
        <Card className="text-sm text-ink-muted">
          Saving for a trip, a laptop or an emergency fund? Add a goal and link the wallet you keep it in.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {goals.map((g) => {
            const p = goalProgress(g, wallets)
            const tone = TONES[toneOf(g.tone)]
            const Icon = CATEGORY_ICONS[g.icon ?? 'sparkles'] ?? CATEGORY_ICONS.sparkles
            const wallet = wallets.find((w) => w.id === g.walletId)
            return (
              <Card
                key={g.id}
                padded={false}
                className="min-w-0 cursor-pointer p-4 transition-shadow hover:shadow-[var(--shadow-lift)] sm:p-5"
                onClick={() => setSheet({ open: true, goal: g })}
              >
                <div className="flex items-start gap-3">
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tone.chip}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">{g.name}</p>
                    <p className="truncate text-xs text-ink-muted">
                      {wallet ? `In ${wallet.name}` : 'Tracked by hand'}
                      {g.deadline ? ` · by ${fmtDate(g.deadline)}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-ink tnum">{Math.round(p.pct)}%</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-muted">
                  <div className={`h-full rounded-full ${p.done ? 'bg-gain' : tone.bar}`} style={{ width: `${p.pct}%` }} />
                </div>
                <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs tnum">
                  <span className="text-ink-muted">
                    <b className="font-bold text-ink">{thb(p.saved, true)}</b> of {thb(g.target, true)}
                  </span>
                  <span className={p.overdue ? 'font-semibold text-loss' : p.done ? 'font-semibold text-gain' : 'text-ink-muted'}>
                    {p.done
                      ? 'Reached 🎉'
                      : p.overdue
                        ? `${thb(p.left, true)} short, past the date`
                        : p.perMonth !== undefined
                          ? `${thb(p.perMonth, true)}/mo for ${p.monthsLeft} ${p.monthsLeft === 1 ? 'month' : 'months'}`
                          : `${thb(p.left, true)} to go`}
                  </span>
                </div>
              </Card>
            )
          })}
        </div>
      )}
      <GoalSheet open={sheet.open} goal={sheet.goal} onClose={() => setSheet({ open: false })} />
    </section>
  )
}

function GoalSheet({ open, goal, onClose }: { open: boolean; goal?: SpendGoal; onClose: () => void }) {
  const { wallets, upsertGoal, removeGoal } = useSpend()
  const { showToast } = useToast()
  const blank = { name: '', target: '', walletId: '', saved: '', deadline: '', icon: 'sparkles', tone: 'emerald' as Tone }
  const [form, setForm] = useState(blank)
  const [lastOpen, setLastOpen] = useState(false)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open)
      setForm(
        goal
          ? {
              name: goal.name,
              target: String(goal.target),
              walletId: goal.walletId ?? '',
              saved: goal.saved ? String(goal.saved) : '',
              deadline: goal.deadline ?? '',
              icon: goal.icon ?? 'sparkles',
              tone: toneOf(goal.tone),
            }
          : blank,
      )
  }
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))
  const savedOk = form.walletId !== '' || form.saved === '' || (Number.isFinite(num(form.saved)) && num(form.saved) >= 0)
  const canSave = form.name.trim() !== '' && num(form.target) > 0 && savedOk
  const Icon = CATEGORY_ICONS[form.icon] ?? CATEGORY_ICONS.sparkles

  const save = () => {
    if (!canSave) return
    upsertGoal({
      id: goal?.id,
      name: form.name.trim(),
      target: Math.round(num(form.target) * 100) / 100,
      walletId: form.walletId || undefined,
      saved: form.walletId ? undefined : form.saved ? num(form.saved) : undefined,
      deadline: form.deadline || undefined,
      icon: form.icon,
      tone: form.tone,
    })
    showToast(goal ? 'Goal updated' : 'Goal added')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={goal ? 'Edit goal' : 'New savings goal'}
      size="md"
      footer={
        <FormActions
          editing={!!goal}
          canSave={canSave}
          onSave={save}
          onDelete={() => {
            if (!goal) return
            removeGoal(goal.id)
            showToast('Goal removed', 'info')
            onClose()
          }}
        />
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-end gap-3">
          <span className={`grid h-11 w-11 place-items-center rounded-xl ${TONES[form.tone].chip}`}>
            <Icon className="h-5 w-5" />
          </span>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Name</span>
            <input className={inputClass} value={form.name} maxLength={40} onChange={(e) => set('name', e.target.value)} placeholder="Japan trip" />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Target</span>
            <input className={`${inputClass} tnum`} inputMode="decimal" value={form.target} onChange={(e) => set('target', e.target.value.replace(/[^\d.,]/g, ''))} placeholder="60,000" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-ink-soft">By (optional)</span>
            <input className={inputClass} type="date" min={localDateStr()} value={form.deadline} onChange={(e) => set('deadline', e.target.value)} />
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Saved in</span>
          <select className={inputClass} value={form.walletId} onChange={(e) => set('walletId', e.target.value)}>
            <option value="">No wallet — I'll type how much is saved</option>
            {wallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} · {thb(w.balance, true)}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-ink-muted">A linked wallet's balance counts as saved and updates by itself.</span>
        </label>

        {form.walletId === '' && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Saved so far</span>
            <input className={`${inputClass} tnum`} inputMode="decimal" value={form.saved} onChange={(e) => set('saved', e.target.value.replace(/[^\d.,]/g, ''))} placeholder="0" />
          </label>
        )}

        <div>
          <p className="mb-2 text-sm font-semibold text-ink-soft">Icon and color</p>
          <div className="flex flex-wrap gap-2">
            {GOAL_ICONS.map((key) => {
              const I = CATEGORY_ICONS[key]
              const on = form.icon === key
              return (
                <button
                  key={key}
                  type="button"
                  aria-label={`Icon ${key}`}
                  aria-pressed={on}
                  onClick={() => set('icon', key)}
                  className={`grid h-10 w-10 place-items-center rounded-xl border cursor-pointer ${on ? TONES[form.tone].active : 'border-line text-ink-soft hover:bg-surface-muted/60'}`}
                >
                  <I className="h-5 w-5" />
                </button>
              )
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {CATEGORY_TONES.map((t) => (
              <button
                key={t}
                type="button"
                aria-label={`Color ${t}`}
                aria-pressed={form.tone === t}
                onClick={() => set('tone', t)}
                className={`h-7 w-7 rounded-full cursor-pointer ${TONES[t].bar} ${form.tone === t ? 'ring-2 ring-brand ring-offset-2 ring-offset-surface' : ''}`}
              />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

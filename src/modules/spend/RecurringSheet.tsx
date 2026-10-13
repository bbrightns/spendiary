import { useState, type ReactNode } from 'react'
import { Modal } from '../../components/ui/Modal'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { FormActions } from '../../components/forms/FormActions'
import { useToast } from '../../store/ToastContext'
import { localDateStr } from '../../lib/format'
import type { RecurringFrequency, SpendRecurring } from '../../lib/types'
import { categoriesFor, type SpendCategory } from './categories'
import { CategorySheet } from './CategorySheet'
import { KEEP_CATEGORY, useRemoveCategory } from './useRemoveCategory'
import { frequencyLabel, nextOccurrence } from './logic'
import { NOT_TRACKED, PayMethodPicker } from './PayMethodPicker'
import { shortDay } from './RecurringDue'
import { TONES, TYPE_ACTIVE } from './tones'
import { useSpend } from './useSpend'
import { SwitchVisual } from './AccountSheets'

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString('en-GB', { month: 'long' }))

const inputClass =
  'h-11 w-full rounded-xl border border-line-strong bg-surface px-3.5 text-base text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-brand focus:ring-2 focus:ring-brand/15'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink-soft">{label}</span>
      {children}
    </label>
  )
}

interface Form {
  name: string
  type: 'expense' | 'income'
  amount: string
  categoryId: string
  accountId: string
  frequency: RecurringFrequency
  day: string
  weekday: number
  month: number
  startDate: string
  note: string
  paused: boolean
  fixedCost: boolean
}

const blank = (): Form => ({
  name: '',
  type: 'expense',
  amount: '',
  categoryId: 'bills',
  accountId: NOT_TRACKED,
  frequency: 'monthly',
  day: String(new Date().getDate()),
  weekday: ((new Date().getDay() + 6) % 7) + 1,
  month: new Date().getMonth() + 1,
  startDate: localDateStr(),
  note: '',
  paused: false,
  fixedCost: true,
})

export function RecurringSheet({ open, rec, onClose }: { open: boolean; rec?: SpendRecurring; onClose: () => void }) {
  const { methods, settings, upsertRecurring, removeRecurring } = useSpend()
  const { showToast } = useToast()
  const [form, setForm] = useState<Form>(blank)
  const [lastOpen, setLastOpen] = useState(false)
  const [editingCats, setEditingCats] = useState(false)
  const [catSheet, setCatSheet] = useState<{ open: boolean; category?: SpendCategory }>({ open: false })
  const removeCategory = useRemoveCategory()
  if (open !== lastOpen) {
    setLastOpen(open)
    setEditingCats(false)
    if (open)
      setForm(
        rec
          ? {
              name: rec.name,
              type: rec.type,
              amount: String(rec.amount),
              categoryId: rec.categoryId,
              accountId: rec.accountId ?? NOT_TRACKED,
              frequency: rec.frequency,
              day: rec.frequency === 'weekly' ? '1' : String(rec.day),
              weekday: rec.frequency === 'weekly' ? rec.day : 1,
              month: rec.month ?? 1,
              startDate: rec.startDate,
              note: rec.note ?? '',
              paused: !!rec.paused,
              fixedCost: rec.fixedCost !== false,
            }
          : { ...blank(), accountId: settings.defaultAccountId ?? NOT_TRACKED },
      )
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))
  const amount = Number(form.amount.replace(/,/g, ''))
  const day = Number(form.day)
  const dayOk = form.frequency === 'weekly' || (Number.isInteger(day) && day >= 1 && day <= 31)
  const canSave = form.name.trim() !== '' && amount > 0 && dayOk && form.startDate !== ''

  const draft: Omit<SpendRecurring, 'id'> = {
    name: form.name.trim(),
    type: form.type,
    amount,
    categoryId: form.categoryId,
    accountId: form.accountId || undefined,
    frequency: form.frequency,
    day: form.frequency === 'weekly' ? form.weekday : day,
    month: form.frequency === 'yearly' ? form.month : undefined,
    startDate: form.startDate,
    note: form.note.trim() || undefined,
    paused: form.paused || undefined,
    fixedCost: form.type === 'expense' ? form.fixedCost : undefined,
    doneDates: rec?.doneDates,
    skippedDates: rec?.skippedDates,
  }
  const next = canSave ? nextOccurrence(draft, localDateStr(new Date(Date.now() - 86_400_000))) : undefined

  /** Take a category out of the picker; if it was picked, fall back to the usual one for this type. */
  const removeCat = (c: SpendCategory) => {
    removeCategory(c)
    if (c.id === form.categoryId) {
      const usual = form.type === 'expense' ? 'bills' : 'salary'
      const left = categoriesFor(form.type).filter((x) => x.id !== c.id)
      set('categoryId', (left.find((x) => x.id === usual) ?? left[0])?.id ?? '')
    }
  }

  const save = () => {
    upsertRecurring({ ...draft, id: rec?.id })
    showToast(rec ? 'Recurring updated' : `${draft.name} added`)
    onClose()
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={rec ? 'Edit recurring' : 'New recurring'}
        size="md"
        footer={
          <FormActions
            editing={!!rec}
            canSave={canSave}
            onSave={save}
            onDelete={() => {
              if (!rec) return
              removeRecurring(rec.id)
              showToast(`${rec.name} removed`, 'info')
              onClose()
            }}
          />
        }
      >
        <div className="space-y-4">
          <SegmentedControl
            ariaLabel="Type"
            value={form.type}
            onChange={(t) => {
              set('type', t)
              // Recurring expenses are mostly bills; recurring income is mostly salary
              set('categoryId', t === 'expense' ? 'bills' : 'salary')
            }}
            options={[
              { value: 'expense', label: 'Bill / expense', activeClassName: TYPE_ACTIVE.expense },
              { value: 'income', label: 'Income', activeClassName: TYPE_ACTIVE.income },
            ]}
          />
  
          <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-3">
            <Field label="Name">
              <input className={inputClass} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Netflix" />
            </Field>
            <Field label="Amount">
              <input
                className={`${inputClass} tnum`}
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => set('amount', e.target.value.replace(/[^\d.,]/g, ''))}
                placeholder="419"
              />
            </Field>
          </div>
  
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-ink-soft">Category</p>
              <button
                type="button"
                aria-pressed={editingCats}
                onClick={() => setEditingCats((v) => !v)}
                className="-my-1 rounded-full px-2.5 py-1 text-xs font-semibold text-brand cursor-pointer hover:bg-brand-soft"
              >
                {editingCats ? 'Done' : 'Edit'}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {categoriesFor(form.type, form.categoryId).map((c) => {
                const on = c.id === form.categoryId
                const removable = editingCats && !KEEP_CATEGORY.has(c.id)
                return (
                  <span
                    key={c.id}
                    className={`inline-flex items-center rounded-full border text-xs font-semibold ${on ? TONES[c.tone].active : 'border-line text-ink-soft'} ${
                      editingCats ? 'border-dashed' : ''
                    }`}
                  >
                    <button
                      type="button"
                      aria-pressed={editingCats ? undefined : on}
                      aria-label={editingCats ? `Edit ${c.label}` : undefined}
                      onClick={() => (editingCats ? setCatSheet({ open: true, category: c }) : set('categoryId', c.id))}
                      className={`flex items-center gap-1.5 rounded-full py-1.5 pl-2.5 cursor-pointer ${removable ? 'pr-1' : 'pr-2.5'} ${on ? '' : 'hover:bg-surface-muted/60'}`}
                    >
                      <c.icon className="h-3.5 w-3.5" />
                      {c.label}
                    </button>
                    {removable && (
                      <button
                        type="button"
                        aria-label={`Remove ${c.label}`}
                        onClick={() => removeCat(c)}
                        className="mr-0.5 grid h-6 w-6 place-items-center rounded-full text-sm leading-none text-ink-muted cursor-pointer hover:bg-loss/15 hover:text-loss"
                      >
                        ×
                      </button>
                    )}
                  </span>
                )
              })}
              <button
                type="button"
                onClick={() => setCatSheet({ open: true })}
                className="flex items-center gap-1 rounded-full border border-dashed border-line-strong px-2.5 py-1.5 text-xs font-semibold text-ink-muted cursor-pointer hover:bg-surface-muted/60 hover:text-ink"
              >
                <span className="leading-none">+</span> New
              </button>
            </div>
          </div>
  
          <PayMethodPicker
            label={form.type === 'income' ? 'Paid into' : 'Paid with'}
            methods={methods}
            value={form.accountId}
            onChange={(id) => set('accountId', id)}
            favoriteIds={settings.favoriteAccountIds ?? []}
            defaultId={settings.defaultAccountId}
            allowNone
          />
  
          <div className="space-y-3">
            <p className="text-sm font-semibold text-ink-soft">Repeats</p>
            <SegmentedControl
              ariaLabel="Frequency"
              value={form.frequency}
              onChange={(f) => set('frequency', f)}
              options={[
                { value: 'weekly', label: 'Weekly' },
                { value: 'monthly', label: 'Monthly' },
                { value: 'yearly', label: 'Yearly' },
              ]}
            />
            {form.frequency === 'weekly' ? (
              <Field label="On">
                <select className={inputClass} value={form.weekday} onChange={(e) => set('weekday', Number(e.target.value))}>
                  {WEEKDAYS.map((w, i) => (
                    <option key={w} value={i + 1}>
                      {w}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Day of month">
                  <input
                    className={`${inputClass} tnum`}
                    inputMode="numeric"
                    maxLength={2}
                    value={form.day}
                    onChange={(e) => set('day', e.target.value.replace(/\D/g, ''))}
                  />
                </Field>
                {form.frequency === 'yearly' && (
                  <Field label="Month">
                    <select className={inputClass} value={form.month} onChange={(e) => set('month', Number(e.target.value))}>
                      {MONTHS.map((m, i) => (
                        <option key={m} value={i + 1}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
              </div>
            )}
            {!dayOk && <p className="text-xs font-semibold text-loss">Pick a day from 1 to 31.</p>}
            <p className="text-xs text-ink-muted">
              {canSave ? `${frequencyLabel(draft)}${next ? ` · next ${shortDay(next)}` : ''}` : 'Days past the end of a short month land on its last day.'}
            </p>
          </div>
  
          <div className="grid grid-cols-2 gap-3">
            <Field label="Starts">
              <input type="date" className={inputClass} value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
            </Field>
            <Field label="Note (optional)">
              <input className={inputClass} value={form.note} onChange={(e) => set('note', e.target.value)} placeholder="#subscription" />
            </Field>
          </div>
  
          {form.type === 'expense' && (
            <button
              type="button"
              role="switch"
              aria-checked={form.fixedCost}
              onClick={() => set('fixedCost', !form.fixedCost)}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3 text-left cursor-pointer hover:bg-surface-muted/50"
            >
              <span>
                <span className="block text-sm font-bold text-ink">Count as a fixed cost</span>
                <span className="block text-xs text-ink-muted">Subtracted from your salary on DCA Plans</span>
              </span>
              <SwitchVisual on={form.fixedCost} />
            </button>
          )}
  
          {rec && (
            <button
              type="button"
              role="switch"
              aria-checked={form.paused}
              onClick={() => set('paused', !form.paused)}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3 text-left cursor-pointer hover:bg-surface-muted/50"
            >
              <span>
                <span className="block text-sm font-bold text-ink">Paused</span>
                <span className="block text-xs text-ink-muted">Stop asking until you turn it back on</span>
              </span>
              <SwitchVisual on={form.paused} />
            </button>
          )}
        </div>
      </Modal>
      <CategorySheet
        open={catSheet.open}
        category={catSheet.category}
        type={form.type}
        onClose={() => setCatSheet({ open: false })}
        // A new category is picked right away; editing one leaves the pick as it is
        onSaved={catSheet.category ? undefined : (id) => set('categoryId', id)}
      />
    </>
  )
}

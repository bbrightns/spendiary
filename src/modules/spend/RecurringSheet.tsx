import { useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { FormActions } from '../../components/forms/FormActions'
import { useToast } from '../../store/ToastContext'
import { localDateStr } from '../../lib/format'
import type { RecurringFrequency, SpendRecurring } from '../../lib/types'
import { getCategory } from './categories'
import { CategoryPicker } from './CategoryPicker'
import { frequencyLabel, nextOccurrence, noteTitle, recurringNote } from './logic'
import { NoteField } from './NoteField'
import { NOT_TRACKED, PayMethodPicker } from './PayMethodPicker'
import { shortDay } from './RecurringDue'
import { TYPE_ACTIVE } from './tones'
import { useSpend } from './useSpend'
import { SwitchVisual } from '../../components/ui/SwitchVisual'
import { FieldWrap } from '../../components/ui/Field'
import { fieldClass } from '../../components/ui/fieldClasses'

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString('en-GB', { month: 'long' }))
/** Recurring expenses are mostly bills; recurring income is mostly salary */
const USUAL_CATEGORY = { expense: 'bills', income: 'salary' } as const



interface Form {
  type: SpendRecurring['type']
  amount: string
  categoryId: string
  subcategory: string
  /** Paid with / paid into; for a transfer, the wallet it leaves */
  accountId: string
  /** Transfer only: the wallet it goes to */
  toAccountId: string
  frequency: RecurringFrequency
  day: string
  weekday: number
  month: number
  startDate: string
  /** The note; its first words are the title */
  note: string
  paused: boolean
  fixedCost: boolean
}

const blank = (): Form => ({
  type: 'expense',
  amount: '',
  categoryId: USUAL_CATEGORY.expense,
  subcategory: '',
  accountId: NOT_TRACKED,
  toAccountId: NOT_TRACKED,
  frequency: 'monthly',
  day: String(new Date().getDate()),
  weekday: ((new Date().getDay() + 6) % 7) + 1,
  month: new Date().getMonth() + 1,
  startDate: localDateStr(),
  note: '',
  paused: false,
  fixedCost: true,
})

/** What a transfer is called when no note was typed */
const transferName = (toName: string | undefined) => (toName ? `Transfer to ${toName}` : 'Transfer')

/** The note field for a saved item; one named only after its category or destination (no note typed) starts empty. */
const noteOf = (rec: SpendRecurring) =>
  !rec.note && (rec.type === 'transfer' ? /^Transfer( to |$)/.test(rec.name) : rec.name === getCategory(rec.categoryId)?.label) ? '' : recurringNote(rec)

export function RecurringSheet({ open, rec, onClose }: { open: boolean; rec?: SpendRecurring; onClose: () => void }) {
  const { methods, settings, upsertRecurring, removeRecurring } = useSpend()
  const { showToast } = useToast()
  const [form, setForm] = useState<Form>(blank)
  const [lastOpen, setLastOpen] = useState(false)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open)
      setForm(
        rec
          ? {
              type: rec.type,
              amount: String(rec.amount),
              categoryId: rec.categoryId,
              subcategory: rec.subcategory ?? '',
              accountId: rec.accountId ?? NOT_TRACKED,
              toAccountId: rec.toAccountId ?? NOT_TRACKED,
              frequency: rec.frequency,
              day: rec.frequency === 'weekly' ? '1' : String(rec.day),
              weekday: rec.frequency === 'weekly' ? rec.day : 1,
              month: rec.month ?? 1,
              startDate: rec.startDate,
              note: noteOf(rec),
              // Paused because a wallet was deleted: picking a new one resumes it
              paused: !!rec.paused && rec.pausedReason !== 'accountRemoved',
              fixedCost: rec.fixedCost !== false,
            }
          : { ...blank(), accountId: settings.defaultAccountId ?? NOT_TRACKED },
      )
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))
  const amount = Number(form.amount.replace(/,/g, ''))
  const day = Number(form.day)
  const dayOk = form.frequency === 'weekly' || (Number.isInteger(day) && day >= 1 && day <= 31)
  const transfer = form.type === 'transfer'
  // A transfer moves money between your own wallets (a card bill is paid from Accounts)
  const wallets = methods.filter((m) => m.kind === 'cash')
  const live = (id: string) => (transfer ? wallets : methods).some((m) => m.id === id)
  // A saved wallet or card that has since been deleted, by the name it had
  const goneName = (id: string) => (id !== NOT_TRACKED && !live(id) ? settings.removedAccounts?.[id]?.name ?? 'That account' : undefined)
  const goneFrom = goneName(form.accountId)
  const goneTo = transfer ? goneName(form.toAccountId) : undefined
  const accountHint = transfer
    ? form.accountId === NOT_TRACKED || goneFrom
      ? 'Pick the wallet it leaves'
      : form.toAccountId === NOT_TRACKED || goneTo
        ? 'Pick the wallet it goes to'
        : form.accountId === form.toAccountId
          ? 'Pick two different wallets'
          : undefined
    : goneFrom
      ? `Pick a wallet or card in place of ${goneFrom}`
      : undefined
  const amountOk = Number.isFinite(amount) && amount > 0
  const canSave = amountOk && dayOk && form.startDate !== '' && !accountHint
  const saveHint = !amountOk ? 'Enter an amount' : !dayOk ? 'Pick a day from 1 to 31' : form.startDate === '' ? 'Pick a start date' : accountHint
  const categoryLabel = getCategory(form.categoryId)?.label ?? 'Other'

  const draft: Omit<SpendRecurring, 'id'> = {
    // The name is the note's title, like a transaction's; with no note, the category's (or where a transfer goes)
    name: noteTitle(form.note) || (transfer ? transferName(wallets.find((m) => m.id === form.toAccountId)?.name) : categoryLabel),
    type: form.type,
    amount: Math.round(amount * 100) / 100,
    categoryId: transfer ? '' : form.categoryId,
    subcategory: transfer ? undefined : form.subcategory || undefined,
    accountId: form.accountId || undefined,
    toAccountId: transfer ? form.toAccountId || undefined : undefined,
    frequency: form.frequency,
    day: form.frequency === 'weekly' ? form.weekday : day,
    month: form.frequency === 'yearly' ? form.month : undefined,
    startDate: form.startDate,
    note: form.note.trim() || undefined,
    paused: form.paused || undefined,
    // Saving with live accounts takes it over from the app's pause
    pausedReason: undefined,
    fixedCost: form.type === 'expense' ? form.fixedCost : undefined,
    doneDates: rec?.doneDates,
    skippedDates: rec?.skippedDates,
  }
  const next = canSave ? nextOccurrence(draft, localDateStr(new Date(Date.now() - 86_400_000))) : undefined

  const save = () => {
    if (!canSave) return
    upsertRecurring({ ...draft, id: rec?.id })
    showToast(rec ? 'Recurring updated' : `${draft.name} added`)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={rec ? 'Edit recurring' : 'New recurring'}
      size="md"
      footer={
        <FormActions
          hint={saveHint}
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
      <div className="space-y-5">
        <SegmentedControl
          ariaLabel="Type"
          value={form.type}
          onChange={(t) =>
            setForm((f) => {
              if (t !== 'transfer') return { ...f, type: t, categoryId: USUAL_CATEGORY[t], subcategory: '' }
              // A transfer starts from a wallet (not a card) and goes to another one
              const from = wallets.some((m) => m.id === f.accountId) ? f.accountId : wallets[0]?.id ?? NOT_TRACKED
              const to = wallets.some((m) => m.id === f.toAccountId && m.id !== from) ? f.toAccountId : wallets.find((m) => m.id !== from)?.id ?? NOT_TRACKED
              return { ...f, type: t, categoryId: '', subcategory: '', accountId: from, toAccountId: to }
            })
          }
          options={[
            { value: 'expense', label: 'Bill', activeClassName: TYPE_ACTIVE.expense },
            { value: 'income', label: 'Income', activeClassName: TYPE_ACTIVE.income },
            { value: 'transfer', label: 'Transfer', activeClassName: TYPE_ACTIVE.transfer },
          ]}
        />

        {/* Amount, the same way Quick add takes it */}
        <label className="block text-center">
          <span className="sr-only">Usual amount in baht</span>
          <div className="flex items-baseline justify-center gap-1.5">
            <span className={`font-display text-3xl font-extrabold ${form.amount ? 'text-ink-muted' : 'text-ink-faint'}`}>฿</span>
            <input
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={form.amount}
              onChange={(e) => set('amount', e.target.value.replace(/[^\d.,]/g, ''))}
              className={`w-full max-w-[14ch] bg-transparent text-center font-display text-5xl font-extrabold tracking-tight tnum outline-none placeholder:text-ink-faint/50 ${
                form.type === 'income' ? 'text-gain-ink' : transfer ? 'text-brand-ink' : 'text-ink'
              }`}
              style={{ width: `${Math.max(2, form.amount.length + 1)}ch` }}
            />
          </div>
          <span className="mt-0.5 block text-xs text-ink-muted">Usual amount; you can change it each time</span>
        </label>

        {form.type !== 'transfer' && (
          <CategoryPicker
            type={form.type}
            value={form.categoryId}
            onChange={(id) => set('categoryId', id)}
            subcategory={form.subcategory}
            onSubcategoryChange={(s) => set('subcategory', s)}
            fallback={(left) => (left.find((c) => c.id === USUAL_CATEGORY[form.type as 'expense' | 'income']) ?? left[0])?.id}
          />
        )}

        {transfer ? (
          <>
            <PayMethodPicker
              label="From"
              methods={wallets}
              value={form.accountId}
              onChange={(id) => set('accountId', id)}
              favoriteIds={settings.favoriteAccountIds ?? []}
              defaultId={settings.defaultAccountId}
            />
            {goneFrom && <p className="-mt-3 text-xs font-semibold text-loss-ink">{goneFrom} was deleted. Pick the wallet it leaves.</p>}
            <PayMethodPicker
              label="To"
              methods={wallets}
              value={form.toAccountId}
              onChange={(id) => set('toAccountId', id)}
              favoriteIds={settings.favoriteAccountIds ?? []}
              excludeId={form.accountId}
            />
            {goneTo && <p className="-mt-3 text-xs font-semibold text-loss-ink">{goneTo} was deleted. Pick the wallet it goes to.</p>}
            {wallets.length < 2 && <p className="-mt-3 text-xs text-ink-muted">Add a second wallet in Accounts to set up a transfer.</p>}
          </>
        ) : (
          <>
            <PayMethodPicker
              label={form.type === 'income' ? 'Paid into' : 'Paid with'}
              methods={methods}
              value={form.accountId}
              onChange={(id) => set('accountId', id)}
              favoriteIds={settings.favoriteAccountIds ?? []}
              defaultId={settings.defaultAccountId}
              allowNone
            />
            {goneFrom && <p className="-mt-3 text-xs font-semibold text-loss-ink">{goneFrom} was deleted. Pick another one, or Not tracked.</p>}
          </>
        )}

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
          <div className="grid items-end grid-cols-2 gap-3">
            {form.frequency === 'weekly' ? (
              <FieldWrap label="On">
                <select className={fieldClass} value={form.weekday} onChange={(e) => set('weekday', Number(e.target.value))}>
                  {WEEKDAYS.map((w, i) => (
                    <option key={w} value={i + 1}>
                      {w}
                    </option>
                  ))}
                </select>
              </FieldWrap>
            ) : (
              <FieldWrap label="Day of month">
                <input
                  className={`${fieldClass} tnum`}
                  inputMode="numeric"
                  maxLength={2}
                  value={form.day}
                  onChange={(e) => set('day', e.target.value.replace(/\D/g, ''))}
                />
              </FieldWrap>
            )}
            {form.frequency === 'yearly' ? (
              <FieldWrap label="Month">
                <select className={fieldClass} value={form.month} onChange={(e) => set('month', Number(e.target.value))}>
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </FieldWrap>
            ) : (
              <FieldWrap label="Starts">
                <input type="date" className={fieldClass} value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
              </FieldWrap>
            )}
          </div>
          {form.frequency === 'yearly' && (
            <FieldWrap label="Starts">
              <input type="date" className={fieldClass} value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
            </FieldWrap>
          )}
          {!dayOk && <p className="text-xs font-semibold text-loss-ink">Pick a day from 1 to 31.</p>}
          <p className="text-xs text-ink-muted">
            {canSave ? `${frequencyLabel(draft)}${next ? ` · next ${shortDay(next)}` : ''}` : 'Days past the end of a short month land on its last day.'}
          </p>
        </div>

        <NoteField value={form.note} onChange={(note) => set('note', note)} placeholder="Netflix" />

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
              <span className="block text-xs text-ink-muted">Subtracted from your salary on DCA plans</span>
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
  )
}

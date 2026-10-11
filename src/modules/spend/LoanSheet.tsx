import { useState, type ReactNode } from 'react'
import { Modal } from '../../components/ui/Modal'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { FormActions } from '../../components/forms/FormActions'
import { ChevronDownIcon } from '../../components/icons'
import { useData } from '../../store/DataContext'
import { useToast } from '../../store/ToastContext'
import { localDateStr, thb } from '../../lib/format'
import type { DebtCategory, Liability } from '../../lib/types'
import { DebtCategoryIcon } from './DebtCategoryIcon'
import { NOT_TRACKED, PayMethodPicker } from './PayMethodPicker'
import { useSpend } from './useSpend'
import { firstDueForRunning, firstInstallmentDue } from './loans'

type Kind = 'installment' | 'loan'

const KIND_OPTIONS = [
  { value: 'installment' as const, label: 'Installment' },
  { value: 'loan' as const, label: 'Loan' },
]

/** Loan types; credit-card debt lives with the cards in Accounts, so it's only kept for old entries. */
const LOAN_TYPES: { value: DebtCategory; label: string }[] = [
  { value: 'mortgage', label: 'Home' },
  { value: 'auto_loan', label: 'Car' },
  { value: 'personal_loan', label: 'Personal' },
  { value: 'student_loan', label: 'Student' },
  { value: 'other', label: 'Other' },
]

const inputClass =
  'h-11 w-full rounded-xl border border-line-strong bg-surface px-3.5 text-base text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-brand focus:ring-2 focus:ring-brand/15 tnum'

const digits = (v: string) => v.replace(/[^\d.,]/g, '')
const num = (v: string) => Number(v.replace(/,/g, '')) || 0
const str = (n?: number) => (n !== undefined && n > 0 ? String(n) : '')

function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
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

/** "3 of 10" payments, as two small number inputs in one field. */
function PaymentsInput({ paid, total, onPaid, onTotal }: { paid: string; total: string; onPaid: (v: string) => void; onTotal: (v: string) => void }) {
  return (
    <div className="flex h-11 items-center gap-2 rounded-xl border border-line-strong bg-surface px-3.5 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15">
      <input
        inputMode="numeric"
        value={paid}
        onChange={(e) => onPaid(e.target.value.replace(/\D/g, ''))}
        placeholder="0"
        aria-label="Payments made so far"
        className="w-full min-w-0 bg-transparent text-base text-ink outline-none tnum placeholder:text-ink-faint"
      />
      <span className="shrink-0 text-sm text-ink-muted">of</span>
      <input
        inputMode="numeric"
        value={total}
        onChange={(e) => onTotal(e.target.value.replace(/\D/g, ''))}
        placeholder="—"
        aria-label="Total payments"
        className="w-full min-w-0 bg-transparent text-right text-base font-semibold text-ink outline-none tnum placeholder:text-ink-faint"
      />
    </div>
  )
}

const blank = {
  kind: 'installment' as Kind,
  category: 'installment' as DebtCategory,
  name: '',
  owed: '',
  monthly: '',
  total: '10',
  paid: '0',
  dueDay: '',
  payFromId: NOT_TRACKED,
  lender: '',
  rate: '',
  original: '',
  note: '',
}

interface Props {
  open: boolean
  /** Loan to edit; omit or null to add one */
  loanId?: string | null
  onClose: () => void
}

/** Add or edit a loan or installment plan: the few things that matter up front, the rest folded away. */
export function LoanSheet({ open, loanId, onClose }: Props) {
  const { data, setLiabilities, removeLiability } = useData()
  const { methods, cards, settings } = useSpend()
  const { showToast } = useToast()
  const [form, setForm] = useState(blank)
  const [more, setMore] = useState(false)
  const [lastOpen, setLastOpen] = useState(false)

  const loans = data.liabilities ?? []
  const existing = loanId ? loans.find((l) => l.id === loanId) : undefined

  // Fill the form each time the sheet opens
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      const l = existing
      setForm(
        l
          ? {
              kind: l.category === 'installment' ? 'installment' : 'loan',
              category: l.category,
              name: l.name,
              owed: str(l.balance),
              monthly: str(l.monthlyPayment),
              total: str(l.totalInstallments),
              paid: l.paidInstallments !== undefined ? String(l.paidInstallments) : '',
              dueDay: str(l.dueDay),
              payFromId: l.payFromId && methods.some((m) => m.id === l.payFromId) ? l.payFromId : NOT_TRACKED,
              lender: l.lender ?? '',
              rate: str(l.interestRate),
              original: str(l.originalBalance),
              note: l.note ?? '',
            }
          : blank,
      )
      setMore(!!l && !!(l.lender || l.interestRate || l.note || (l.category !== 'installment' && l.totalInstallments)))
    }
  }

  const set = (key: keyof typeof blank) => (v: string) => setForm((f) => ({ ...f, [key]: v }))
  const installment = form.kind === 'installment'
  const owed = num(form.owed)
  const left = Math.max(1, num(form.total) - num(form.paid))
  // What a payment comes to when no monthly amount is set: the balance over the payments left
  const suggested = owed > 0 && num(form.total) > 0 ? Math.round(owed / left) : 0
  const canSave = form.name.trim() !== '' && owed > 0

  const changeKind = (k: Kind) =>
    setForm((f) => {
      const keepTerms = !!existing?.totalInstallments
      return {
        ...f,
        kind: k,
        category: k === 'installment' ? 'installment' : f.category === 'installment' ? 'mortgage' : f.category,
        // Installments usually come in 10; a loan has no payment count unless it already had one
        total: k === 'installment' ? f.total || '10' : keepTerms ? f.total : '',
        paid: k === 'installment' ? f.paid || '0' : keepTerms ? f.paid : '',
      }
    })

  const save = () => {
    if (!canSave) return
    const today = localDateStr()
    const due = form.dueDay ? Math.min(31, Math.max(1, Math.round(num(form.dueDay)))) : undefined
    // A payment count can sit on any debt (a car loan's 60 terms), not only installments
    const total = num(form.total) > 0 ? Math.round(num(form.total)) : undefined
    const billCard = installment ? cards.find((c) => c.id === form.payFromId) : undefined
    const paidNow = total ? Math.min(total, Math.max(0, Math.round(num(form.paid)))) : 0
    const loan: Liability = {
      // Keep what this form doesn't show (payment history, last paid date…) so editing never resets it
      ...existing,
      id: existing?.id ?? `lib-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: form.name.trim(),
      category: form.category,
      balance: owed,
      monthlyPayment: num(form.monthly) > 0 ? num(form.monthly) : suggested > 0 ? suggested : undefined,
      dueDay: due,
      isInstallment: installment || total ? true : undefined,
      totalInstallments: total,
      paidInstallments: total ? Math.min(total, Math.max(0, Math.round(num(form.paid)))) : undefined,
      payFromId: form.payFromId || undefined,
      // An installment on a card is billed to it each statement; a loan or a wallet stays a manual Pay
      autoBillToCard: billCard ? true : undefined,
      // When a card bills it, the first due date says which statements carry which payment:
      // a new plan starts on the next statement, a running one picks up after the payments made
      firstDueDate: existing?.firstDueDate ?? (billCard ? (existing ? firstDueForRunning(billCard, paidNow, today) : firstInstallmentDue(billCard, today)) : undefined),
      lender: form.lender.trim() || undefined,
      interestRate: num(form.rate) > 0 ? num(form.rate) : undefined,
      originalBalance: num(form.original) > 0 ? num(form.original) : existing?.originalBalance ?? owed,
      note: form.note.trim() || undefined,
      // A new loan whose due day has already passed this month starts next month
      firstPaymentMonth: existing ? existing.firstPaymentMonth : due !== undefined && due < new Date().getDate() ? 'next' : undefined,
      createdAt: existing?.createdAt ?? today,
      updatedAt: today,
    }
    setLiabilities(existing ? loans.map((l) => (l.id === existing.id ? loan : l)) : [...loans, loan])
    showToast(existing ? `Updated ${loan.name}` : `Added ${loan.name}`)
    onClose()
  }

  const remove = () => {
    if (!existing) return
    removeLiability(existing.id)
    showToast(`Deleted ${existing.name}`, 'info')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={existing ? 'Edit loan' : 'Add loan'}
      size="md"
      footer={<FormActions editing={!!existing} canSave={canSave} onSave={save} onDelete={existing ? remove : undefined} />}
    >
      <div className="space-y-5">
        <div>
          <SegmentedControl options={KIND_OPTIONS} value={form.kind} onChange={changeKind} ariaLabel="Kind of debt" />
          <p className="mt-1.5 text-xs text-ink-muted">
            {installment ? 'Bought something and pay it off in parts, like a 0% phone plan.' : 'Borrowed money you pay back, like a home or car loan.'}
          </p>
        </div>

        {!installment && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Loan type">
            {[...LOAN_TYPES, ...(form.category === 'credit_card' ? [{ value: 'credit_card' as DebtCategory, label: 'Card debt' }] : [])].map((t) => {
              const active = form.category === t.value
              return (
                <button
                  key={t.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => set('category')(t.value)}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition-colors cursor-pointer ${
                    active ? 'border-brand bg-brand-soft text-brand-ink' : 'border-line text-ink-soft hover:bg-surface-muted/60'
                  }`}
                >
                  <DebtCategoryIcon category={t.value} className="h-4 w-4" />
                  {t.label}
                </button>
              )
            })}
          </div>
        )}

        <Field label="Name">
          <input
            value={form.name}
            onChange={(e) => set('name')(e.target.value)}
            placeholder={installment ? 'iPhone 16 Pro' : 'Condo loan'}
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Still owed">
            <input inputMode="decimal" value={form.owed} onChange={(e) => set('owed')(digits(e.target.value))} placeholder="0" className={inputClass} />
          </Field>
          <Field label="Each month" hint={suggested > 0 && !form.monthly ? `≈ ${thb(suggested)}` : undefined}>
            <input
              inputMode="decimal"
              value={form.monthly}
              onChange={(e) => set('monthly')(digits(e.target.value))}
              placeholder={suggested > 0 ? String(suggested) : '0'}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {installment ? (
            <Field label="Payments made">
              <PaymentsInput paid={form.paid} total={form.total} onPaid={set('paid')} onTotal={set('total')} />
            </Field>
          ) : (
            <Field label="Interest" hint="optional">
              <div className="flex h-11 items-center rounded-xl border border-line-strong bg-surface px-3.5 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15">
                <input
                  inputMode="decimal"
                  value={form.rate}
                  onChange={(e) => set('rate')(digits(e.target.value))}
                  placeholder="3.75"
                  className="w-full min-w-0 bg-transparent text-base text-ink outline-none tnum placeholder:text-ink-faint"
                />
                <span className="shrink-0 text-xs font-semibold text-ink-muted">% / yr</span>
              </div>
            </Field>
          )}
          <Field label="Due day" hint="1–31">
            <input
              inputMode="numeric"
              value={form.dueDay}
              onChange={(e) => set('dueDay')(e.target.value.replace(/\D/g, '').slice(0, 2))}
              placeholder="25"
              className={inputClass}
            />
          </Field>
        </div>

        <PayMethodPicker
          label="Usually paid from"
          methods={methods}
          value={form.payFromId}
          onChange={set('payFromId')}
          favoriteIds={settings.favoriteAccountIds ?? []}
          defaultId={settings.defaultAccountId}
          allowNone
        />
        <p className="-mt-3 text-xs text-ink-muted">
          {installment && methods.find((m) => m.id === form.payFromId)?.kind === 'card'
            ? 'Each payment goes on this card by itself on its statement day.'
            : installment
              ? 'Pay starts from this one. Pick the card if the installment is billed to it.'
              : 'Pay starts from this one.'}
        </p>

        <div className="rounded-2xl border border-line">
          <button
            type="button"
            onClick={() => setMore((v) => !v)}
            aria-expanded={more}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer"
          >
            <span>
              <span className="block text-sm font-bold text-ink">More details</span>
              <span className="block text-xs text-ink-muted">{installment ? 'Lender, interest, price, note' : 'Lender, amount borrowed, payments, note'}</span>
            </span>
            <ChevronDownIcon className={`h-4 w-4 shrink-0 text-ink-muted transition-transform ${more ? 'rotate-180' : ''}`} strokeWidth={2} />
          </button>
          {more && (
            <div className="space-y-4 border-t border-line px-4 pb-4 pt-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Lender">
                  <input value={form.lender} onChange={(e) => set('lender')(e.target.value)} placeholder={installment ? 'Apple, SPayLater' : 'SCB, KBank'} className={inputClass} />
                </Field>
                {installment ? (
                  <Field label="Interest" hint="% / yr">
                    <input inputMode="decimal" value={form.rate} onChange={(e) => set('rate')(digits(e.target.value))} placeholder="0" className={inputClass} />
                  </Field>
                ) : (
                  <Field label="Borrowed">
                    <input inputMode="decimal" value={form.original} onChange={(e) => set('original')(digits(e.target.value))} placeholder={form.owed || '0'} className={inputClass} />
                  </Field>
                )}
              </div>
              {!installment && (
                <Field label="Payments made" hint="optional, e.g. 14 of 60">
                  <PaymentsInput paid={form.paid} total={form.total} onPaid={set('paid')} onTotal={set('total')} />
                </Field>
              )}
              {installment && (
                <Field label="Full price">
                  <input inputMode="decimal" value={form.original} onChange={(e) => set('original')(digits(e.target.value))} placeholder={form.owed || '0'} className={inputClass} />
                </Field>
              )}
              <Field label="Note">
                <input value={form.note} onChange={(e) => set('note')(e.target.value)} placeholder="Optional" className={inputClass} />
              </Field>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

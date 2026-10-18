import { useEffect, useRef, useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { FormActions } from '../../components/forms/FormActions'
import { TransactionDateField } from '../../components/forms/TransactionDateField'
import { useToast } from '../../store/ToastContext'
import { useData } from '../../store/DataContext'
import { localDateStr, thb } from '../../lib/format'
import type { SpendSettings, SpendTransaction, SpendTxnType } from '../../lib/types'
import { categoriesFor, getCategory } from './categories'
import { noteTitle } from './logic'
import { TYPE_ACTIVE } from './tones'
import { useSpend, type PayMethod, type SpendTxnInput } from './useSpend'
import { NOT_TRACKED, PayMethodPicker } from './PayMethodPicker'
import { SwitchVisual } from './AccountSheets'
import { CategoryPicker } from './CategoryPicker'
import { NoteField } from './NoteField'
import { paidDetail } from './billPaid'
import { firstInstallmentDue, installmentAmount } from './loans'
import { SHEET_EVENTS } from './sheetEvents'

const OPEN_EVENT = SHEET_EVENTS.quickAdd

interface OpenDetail {
  type?: SpendTxnType
  /** Edit an existing transaction */
  editId?: string
  /** Start a new entry from these values (e.g. a recurring bill) */
  prefill?: SpendTxnInput
  /** A new entry with some fields filled in (the rest use the usual defaults), e.g. from the command palette */
  draft?: Partial<Pick<SpendTxnInput, 'type' | 'amount' | 'note' | 'categoryId' | 'accountId'>>
  /** A line under the title explaining why the sheet opened (new entries only) */
  hint?: string
  /** Saving marks this recurring occurrence as done */
  recurring?: { id: string; date: string; name: string }
}

/** Open the Quick Add sheet from anywhere in the app. */
export function openQuickAdd(detail: OpenDetail = {}) {
  window.dispatchEvent(new CustomEvent<OpenDetail>(OPEN_EVENT, { detail }))
}

const TYPE_OPTIONS = [
  { value: 'expense' as const, label: 'Expense', activeClassName: TYPE_ACTIVE.expense },
  { value: 'income' as const, label: 'Income', activeClassName: TYPE_ACTIVE.income },
  { value: 'transfer' as const, label: 'Transfer', activeClassName: TYPE_ACTIVE.transfer },
]

const AMOUNT_COLOR: Record<SpendTxnType, string> = {
  expense: 'text-ink',
  income: 'text-emerald-600 dark:text-emerald-300',
  transfer: 'text-sky-600 dark:text-sky-300',
}

const NO_WALLET = NOT_TRACKED

/** Current local time as HH:mm */
const nowTime = () => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const shortDue = (iso: string) => {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

/** Preselected "from" / "to" for a new entry: the default method first, then habit. */
function pickDefaults(type: SpendTxnType, txns: SpendTransaction[], methods: PayMethod[], settings: SpendSettings) {
  const valid = (id?: string) => (id && methods.some((m) => m.id === id) ? id : undefined)
  const isCash = (id?: string) => methods.find((m) => m.id === id)?.kind === 'cash'
  const cash = methods.filter((m) => m.kind === 'cash')
  const firstCash = cash.find((m) => !m.locked)?.id ?? cash[0]?.id
  const def = valid(settings.defaultAccountId)
  const lastUsed = (t: SpendTxnType) => valid(txns.find((x) => x.type === t && x.accountId)?.accountId)

  if (type === 'expense') {
    return { from: def ?? lastUsed('expense') ?? methods.find((m) => !m.locked)?.id ?? NO_WALLET, to: NO_WALLET }
  }
  if (type === 'income') {
    return { from: (isCash(def) ? def : undefined) ?? lastUsed('income') ?? firstCash ?? NO_WALLET, to: NO_WALLET }
  }
  const from = (isCash(def) ? def : undefined) ?? firstCash ?? NO_WALLET
  // Paying a card bill is the most common transfer, so suggest a card first
  const to = methods.find((m) => m.kind === 'card')?.id ?? cash.find((m) => m.id !== from)?.id ?? NO_WALLET
  return { from, to }
}

export function QuickAddSheet() {
  const { transactions, methods, cards, settings, recurring, addTransaction, updateTransaction, removeTransaction } = useSpend()
  const { data, setLiabilities, removeLiability } = useData()
  const { showToast } = useToast()

  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [fromRecurring, setFromRecurring] = useState<OpenDetail['recurring'] | null>(null)
  const [type, setType] = useState<SpendTxnType>('expense')
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('food')
  const [accountId, setAccountId] = useState(NO_WALLET)
  const [toAccountId, setToAccountId] = useState(NO_WALLET)
  const [date, setDate] = useState(localDateStr())
  const [time, setTime] = useState('')
  const [subcategory, setSubcategory] = useState('')
  const [note, setNote] = useState('')
  const [alreadyIn, setAlreadyIn] = useState(false)
  // Card purchase paid off in monthly installments (off unless picked)
  const [split, setSplit] = useState(false)
  const [months, setMonths] = useState(10)
  const [hint, setHint] = useState<string | undefined>()
  // Editing a loan payment: its transfer goes to the loan, so there's no "to" wallet to pick
  const [loanPayment, setLoanPayment] = useState(false)
  const amountRef = useRef<HTMLInputElement>(null)

  // Latest values for the event listener without re-subscribing on every keystroke
  const stateRef = useRef({ transactions, methods, settings })
  stateRef.current = { transactions, methods, settings }

  useEffect(() => {
    function onOpen(e: Event) {
      const detail = (e as CustomEvent<OpenDetail>).detail ?? {}
      const { transactions: txns, methods: ms, settings: st } = stateRef.current
      const existing = detail.editId ? txns.find((t) => t.id === detail.editId) : undefined
      // Editing fills from the saved transaction; a recurring occurrence fills from its template
      const source = existing ?? detail.prefill
      setFromRecurring(existing ? null : detail.recurring ?? null)
      setLoanPayment(!!existing?.liabilityId)
      setHint(existing ? undefined : detail.hint)

      if (source) {
        setEditId(existing?.id ?? null)
        setType(source.type)
        setAmount(String(source.amount))
        setCategoryId(source.categoryId ?? categoriesFor(source.type)[0]?.id ?? '')
        setAccountId(source.accountId ?? NO_WALLET)
        setToAccountId(source.toAccountId ?? NO_WALLET)
        setDate(source.date)
        setTime(source.time ?? '')
        setSubcategory(source.subcategory ?? '')
        setNote(source.note ?? '')
        setAlreadyIn(!!existing?.alreadyInBalance)
        setSplit(false)
      } else {
        const draft = detail.draft ?? {}
        const t = draft.type ?? detail.type ?? 'expense'
        const d = pickDefaults(t, txns, ms, st)
        setEditId(null)
        setType(t)
        setAmount(draft.amount ? String(draft.amount) : '')
        setCategoryId(draft.categoryId ?? categoriesFor(t)[0]?.id ?? '')
        // Started from a wallet: it's the "from" side; a transfer then goes to another wallet first
        const from = draft.accountId && ms.some((m) => m.id === draft.accountId) ? draft.accountId : d.from
        const otherCash = ms.filter((m) => m.kind === 'cash' && m.id !== from).sort((a, b) => Number(!!a.locked) - Number(!!b.locked))[0]?.id
        setAccountId(from)
        setToAccountId(t === 'transfer' && draft.accountId ? otherCash ?? (d.to !== from ? d.to : NO_WALLET) : d.to === from ? NO_WALLET : d.to)
        setDate(localDateStr())
        setTime(nowTime())
        setSubcategory('')
        setNote(draft.note ?? '')
        setAlreadyIn(false)
        setSplit(false)
        setMonths(10)
      }
      setOpen(true)
    }
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_EVENT, onOpen)
  }, [])

  // The modal focuses its close button first; the amount is what you type, so take focus
  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => amountRef.current?.focus(), 60)
    return () => window.clearTimeout(t)
  }, [open])

  const value = Number(amount.replace(/,/g, ''))
  const amountValid = Number.isFinite(value) && value > 0
  const transferValid =
    type !== 'transfer' || (loanPayment ? accountId !== NO_WALLET : accountId !== NO_WALLET && toAccountId !== NO_WALLET && accountId !== toAccountId)
  const canSave = amountValid && transferValid
  // Installments: a new card expense of ฿1,000 or more (not editing, not a recurring bill)
  const card = cards.find((c) => c.id === accountId)
  const canSplit = !editId && !fromRecurring && type === 'expense' && !!card && amountValid && value >= 1000
  const splitting = canSplit && split
  const perMonth = splitting ? installmentAmount(value, months) : 0
  const firstDue = splitting && card ? firstInstallmentDue(card, date) : ''
  // A past date may already be in the balance the wallet / card shows today
  const backdated = date < localDateStr()
  const touchesBalance = accountId !== NO_WALLET || (type === 'transfer' && toAccountId !== NO_WALLET)

  const changeType = (t: SpendTxnType) => {
    setType(t)
    if (t !== 'transfer' && getCategory(categoryId)?.type !== t) {
      setCategoryId(categoriesFor(t)[0]?.id ?? '')
      setSubcategory('')
    }
    // New entries follow the defaults for the new type; edits keep what was recorded
    if (!editId) {
      const d = pickDefaults(t, transactions, methods, settings)
      setAccountId(d.from)
      setToAccountId(d.to)
    }
  }

  /** Bought on installment: nothing is spent today, so it becomes an installment plan paid each month from the card. */
  const saveInstallment = () => {
    if (!card) return
    const total = Math.round(value * 100) / 100
    const today = localDateStr()
    const id = `lib-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const name = noteTitle(note) || getCategory(categoryId)?.label || 'Installment'
    setLiabilities([
      ...(data.liabilities ?? []),
      {
        id,
        name,
        category: 'installment',
        balance: total,
        originalBalance: total,
        monthlyPayment: perMonth,
        isInstallment: true,
        totalInstallments: months,
        paidInstallments: 0,
        dueDay: card.dueDay,
        firstDueDate: firstDue,
        payFromId: card.id,
        lender: card.name,
        note: note.trim() || undefined,
        createdAt: today,
        updatedAt: today,
      },
    ])
    showToast(`${thb(total)} split into ${months} × ${thb(perMonth, true)} on ${card.name}`, 'success', {
      label: 'Undo',
      onClick: () => removeLiability(id),
    })
    setOpen(false)
  }

  const save = () => {
    if (!canSave) return
    if (splitting) return saveInstallment()
    const input = {
      type,
      amount: Math.round(value * 100) / 100,
      categoryId: type === 'transfer' ? undefined : categoryId,
      accountId: accountId || undefined,
      toAccountId: type === 'transfer' ? toAccountId || undefined : undefined,
      date,
      time: time || undefined,
      subcategory: type === 'transfer' ? undefined : subcategory || undefined,
      note: note.trim() || undefined,
      alreadyInBalance: backdated && touchesBalance && alreadyIn ? true : undefined,
    }
    if (editId) {
      updateTransaction(editId, input)
      showToast('Transaction updated')
    } else {
      const txn = addTransaction(input, fromRecurring ? { id: fromRecurring.id, date: fromRecurring.date } : undefined)
      const label = type === 'transfer' ? 'Transfer' : getCategory(categoryId)?.label ?? ''
      const sign = type === 'income' ? '+' : type === 'expense' ? '−' : ''
      if (fromRecurring) {
        // Like marking it paid from the bills card: Undo puts the bill back as due
        showToast(
          `${sign}${thb(input.amount)} · ${fromRecurring.name}`,
          'success',
          { label: 'Undo', onClick: () => removeTransaction(txn.id) },
          {
            popup: true,
            title: type === 'income' ? 'Received' : 'Paid',
            // What was actually logged, which may differ from the bill's usual amount or wallet
            detail: paidDetail({
              rec: recurring.find((r) => r.id === fromRecurring.id),
              date: fromRecurring.date,
              name: fromRecurring.name,
              amount: input.amount,
              accountName: methods.find((m) => m.id === input.accountId)?.name,
              categoryId: input.categoryId,
              subcategory: input.subcategory,
            }),
          },
        )
      } else showToast(`${sign}${thb(input.amount)} · ${label}`)
    }
    setOpen(false)
  }

  const remove = () => {
    if (!editId) return
    removeTransaction(editId)
    showToast('Transaction deleted', 'info')
    setOpen(false)
  }

  const pickerProps = {
    methods,
    favoriteIds: settings.favoriteAccountIds ?? [],
    defaultId: settings.defaultAccountId,
  }

  return (
    <>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editId ? 'Edit transaction' : fromRecurring ? fromRecurring.name : 'Quick add'}
        description={fromRecurring ? `Mark as ${type === 'income' ? 'received' : 'paid'}. Adjust the amount if this one was different.` : hint}
        size="md"
        footer={<FormActions editing={!!editId} canSave={canSave} onSave={save} onDelete={remove} />}
      >
        <div className="space-y-5">
          <SegmentedControl options={TYPE_OPTIONS} value={type} onChange={changeType} ariaLabel="Transaction type" />

          {/* Amount */}
          <label className="block text-center">
            <span className="sr-only">Amount in baht</span>
            <div className="flex items-baseline justify-center gap-1.5">
              <span className={`font-display text-3xl font-extrabold ${amount ? 'text-ink-muted' : 'text-ink-faint'}`}>฿</span>
              <input
                ref={amountRef}
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
                className={`w-full max-w-[14ch] bg-transparent text-center font-display text-5xl font-extrabold tracking-tight tnum outline-none placeholder:text-ink-faint/50 ${AMOUNT_COLOR[type]}`}
                style={{ width: `${Math.max(2, amount.length + 1)}ch` }}
              />
            </div>
          </label>

          {/* Category */}
          {type !== 'transfer' && (
            <CategoryPicker
              type={type}
              value={categoryId}
              onChange={setCategoryId}
              subcategory={subcategory}
              onSubcategoryChange={setSubcategory}
            />
          )}

          {/* Pay with / into */}
          {type === 'transfer' ? (
            <>
              <PayMethodPicker {...pickerProps} label="From" value={accountId} onChange={setAccountId} />
              {loanPayment ? (
                <p className="-mt-2 text-xs text-ink-muted">Paid toward a loan. Change the loan itself in Loans & installments.</p>
              ) : (
                <PayMethodPicker
                  {...pickerProps}
                  label="To (a card here pays its bill)"
                  value={toAccountId}
                  onChange={setToAccountId}
                  excludeId={accountId}
                />
              )}
            </>
          ) : (
            <PayMethodPicker
              {...pickerProps}
              label={type === 'income' ? 'Into' : 'Pay with'}
              value={accountId}
              onChange={setAccountId}
              allowNone
            />
          )}

          {canSplit && (
            <div className={`-mt-2 rounded-2xl border transition-colors ${split ? 'border-brand/40 bg-brand-soft/40' : 'border-line'}`}>
              <button
                type="button"
                role="switch"
                aria-checked={split}
                onClick={() => setSplit((v) => !v)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer"
              >
                <span>
                  <span className="block text-sm font-bold text-ink">Pay in installments</span>
                  <span className="block text-xs text-ink-muted">
                    {split ? `${thb(perMonth, true)} × ${months} months · 0%` : `Split this ${card!.name} purchase into monthly payments`}
                  </span>
                </span>
                <SwitchVisual on={split} />
              </button>
              {split && (
                <div className="space-y-2.5 border-t border-line/70 px-4 pb-3.5 pt-3">
                  <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Number of months">
                    {[3, 4, 6, 10, 12].map((n) => (
                      <button
                        key={n}
                        type="button"
                        aria-pressed={months === n}
                        onClick={() => setMonths(n)}
                        className={`h-9 rounded-xl border text-sm font-bold tnum transition-colors cursor-pointer ${
                          months === n ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-ink-soft hover:bg-surface-muted/60'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs leading-relaxed text-ink-muted">
                    First payment due <span className="font-semibold text-ink-soft">{shortDue(firstDue)}</span>. Each one counts as spending
                    when you pay it. Nothing is spent today. It's added to Loans &amp; installments.
                  </p>
                </div>
              )}
            </div>
          )}

          <TransactionDateField value={date} onChange={setDate} time={time} onTimeChange={setTime} />

          {backdated && touchesBalance && (
            <button
              type="button"
              role="switch"
              aria-checked={alreadyIn}
              onClick={() => setAlreadyIn((v) => !v)}
              className="-mt-2 flex w-full items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3 text-left cursor-pointer hover:bg-surface-muted/50"
            >
              <span>
                <span className="block text-sm font-bold text-ink">Already in my balance</span>
                <span className="block text-xs text-ink-muted">
                  {alreadyIn ? 'Recorded for history only; balances stay as they are' : 'Turn on if the balance shown today already includes this'}
                </span>
              </span>
              <SwitchVisual on={alreadyIn} />
            </button>
          )}

          {/* Note + hashtags */}
          <NoteField value={note} onChange={setNote} fallbackTitle={type === 'transfer' ? 'Transfer' : getCategory(categoryId)?.label ?? 'Other'} />
        </div>
      </Modal>
    </>
  )
}

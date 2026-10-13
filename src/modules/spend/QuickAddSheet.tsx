import { useEffect, useMemo, useRef, useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { FormActions } from '../../components/forms/FormActions'
import { TransactionDateField } from '../../components/forms/TransactionDateField'
import { useToast } from '../../store/ToastContext'
import { useData } from '../../store/DataContext'
import { localDateStr, thb } from '../../lib/format'
import type { SpendSettings, SpendTransaction, SpendTxnType } from '../../lib/types'
import { categoriesFor, getCategory } from './categories'
import { activeTagQuery, noteTitle, parseTags, recentTags, suggestTags, topTags } from './logic'
import { TONES, TYPE_ACTIVE } from './tones'
import { useSpend, type PayMethod, type SpendTxnInput } from './useSpend'
import { NOT_TRACKED, PayMethodPicker } from './PayMethodPicker'
import { SwitchVisual } from './AccountSheets'
import { CategorySheet } from './CategorySheet'
import { firstInstallmentDue, installmentAmount } from './loans'

const OPEN_EVENT = 'spendiary:open-quick-add'

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
  const { transactions, methods, cards, settings, addTransaction, updateTransaction, removeTransaction, subcategories, addSubcategory } = useSpend()
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
  const [newSub, setNewSub] = useState('')
  const [addingSub, setAddingSub] = useState(false)
  const [note, setNote] = useState('')
  const [alreadyIn, setAlreadyIn] = useState(false)
  // Card purchase paid off in monthly installments (off unless picked)
  const [split, setSplit] = useState(false)
  const [months, setMonths] = useState(10)
  const [newCategory, setNewCategory] = useState(false)
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
        setTime(existing?.time ?? '')
        setSubcategory(existing?.subcategory ?? '')
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
      setAddingSub(false)
      setNewSub('')
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

  const recent = useMemo(() => recentTags(transactions, 3), [transactions])
  const frequent = useMemo(() => topTags(transactions, 8).filter((t) => !recent.includes(t)).slice(0, 5), [transactions, recent])
  const noteTokens = note.toLowerCase().split(/\s+/)
  // While typing `#ta…`, offer tags used before that start with it
  const tagQuery = activeTagQuery(note)
  const suggestions = useMemo(() => (tagQuery === null ? [] : suggestTags(transactions, note, tagQuery)), [transactions, note, tagQuery])
  const previewTags = parseTags(note)
  const previewTitle = noteTitle(note) || (type === 'transfer' ? 'Transfer' : getCategory(categoryId)?.label ?? 'Other')
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

  // Offered subcategories for the chosen category, plus the one already on this entry if it was since removed
  const subChoices = useMemo(() => {
    const list = subcategories(categoryId)
    return subcategory && !list.includes(subcategory) ? [...list, subcategory] : list
  }, [subcategories, categoryId, subcategory])

  /** Save the typed subcategory under the chosen category and select it. */
  const commitSub = () => {
    const label = newSub.trim()
    if (label) {
      addSubcategory(categoryId, label)
      setSubcategory(label)
    }
    setAddingSub(false)
    setNewSub('')
  }

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

  const appendTag = (tag: string) => {
    const token = `#${tag}`
    if (noteTokens.includes(token)) return
    setNote((n) => (n.trim() ? `${n.trimEnd()} ${token}` : token))
  }

  /** Finish the `#ta…` being typed with a tag used before. */
  const completeTag = (tag: string) => setNote((n) => n.replace(/#[^\s#]*$/u, `#${tag} `))

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
      addTransaction(input, fromRecurring ? { id: fromRecurring.id, date: fromRecurring.date } : undefined)
      const label = type === 'transfer' ? 'Transfer' : getCategory(categoryId)?.label ?? ''
      showToast(`${type === 'income' ? '+' : type === 'expense' ? '−' : ''}${thb(input.amount)} · ${label}`)
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
            <div>
              <p className="mb-2 text-sm font-semibold text-ink-soft">Category</p>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                {categoriesFor(type, categoryId).map((c) => {
                  const active = c.id === categoryId
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        if (c.id !== categoryId) setSubcategory('')
                        setCategoryId(c.id)
                      }}
                      className={`flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-2xl border px-1 py-2 text-xs transition-all cursor-pointer active:scale-95 ${
                        active ? `${TONES[c.tone].active} font-bold` : 'border-line bg-surface font-semibold text-ink-soft hover:bg-surface-muted/60'
                      }`}
                    >
                      <span className={`grid h-8 w-8 place-items-center rounded-xl transition-colors ${active ? 'bg-white/70 dark:bg-white/10' : TONES[c.tone].chip}`}>
                        <c.icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.1 : 1.7} />
                      </span>
                      <span className="w-full truncate text-center leading-tight">{c.label}</span>
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={() => setNewCategory(true)}
                  className="flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-line-strong px-1 py-2 text-xs font-semibold text-ink-muted transition-all cursor-pointer hover:bg-surface-muted/60 hover:text-ink active:scale-95"
                >
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-surface-muted text-lg leading-none">+</span>
                  <span>New</span>
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Subcategory">
                {subChoices.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={s === subcategory}
                    onClick={() => setSubcategory(s === subcategory ? '' : s)}
                    className={`h-8 rounded-full border px-3 text-xs font-semibold transition-colors cursor-pointer ${
                      s === subcategory ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-ink-soft hover:bg-surface-muted/60'
                    }`}
                  >
                    {s}
                  </button>
                ))}
                {addingSub ? (
                  <input
                    autoFocus
                    value={newSub}
                    onChange={(e) => setNewSub(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        commitSub()
                      } else if (e.key === 'Escape') {
                        e.stopPropagation()
                        setAddingSub(false)
                        setNewSub('')
                      }
                    }}
                    onBlur={commitSub}
                    placeholder="Subcategory"
                    maxLength={30}
                    aria-label="New subcategory"
                    className="h-8 w-32 rounded-full border border-brand bg-surface px-3 text-xs font-semibold text-ink outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setAddingSub(true)}
                    className="h-8 rounded-full border border-dashed border-line-strong px-3 text-xs font-semibold text-ink-muted transition-colors cursor-pointer hover:bg-surface-muted/60 hover:text-ink"
                  >
                    + Sub
                  </button>
                )}
              </div>
            </div>
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
          <div>
            <label className="block">
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-ink-soft">Note</span>
                <span className="text-xs text-ink-muted">Name first, then #tags to find it later</span>
              </div>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Brown sugar milk tea #nosetea"
                autoComplete="off"
                className="h-11 w-full rounded-xl border border-line-strong bg-surface px-3.5 text-base text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-brand focus:ring-2 focus:ring-brand/15"
              />
            </label>
            {suggestions.length > 0 && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5" role="listbox" aria-label="Tag suggestions">
                {suggestions.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    role="option"
                    aria-selected={false}
                    // keep focus in the note field so typing can continue
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => completeTag(tag)}
                    className="rounded-full bg-violet-100 px-3 py-1.5 text-xs font-bold text-violet-700 transition-all cursor-pointer hover:bg-violet-200 active:scale-95 dark:bg-violet-400/15 dark:text-violet-200"
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}
            {note.trim() && (
              <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-surface-muted/60 px-3 py-2 text-xs">
                <span className="font-semibold text-ink-muted">Shows as</span>
                <span className="min-w-0 truncate font-bold text-ink">{previewTitle}</span>
                {previewTags.map((tag) => (
                  <span key={tag} className="rounded-full bg-brand-soft px-2 py-0.5 font-semibold text-brand-ink">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
            {recent.length + frequent.length > 0 && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {recent.length > 0 && <span className="mr-0.5 text-xs font-semibold text-ink-muted">Recent</span>}
                {recent.map((tag) => {
                  const added = noteTokens.includes(`#${tag}`)
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => appendTag(tag)}
                      aria-pressed={added}
                      className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                        added
                          ? 'bg-violet-200 text-violet-800 dark:bg-violet-400/30 dark:text-violet-100'
                          : 'bg-violet-100 text-violet-700 hover:bg-violet-200 dark:bg-violet-400/15 dark:text-violet-200'
                      }`}
                    >
                      #{tag}
                    </button>
                  )
                })}
                {frequent.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => appendTag(tag)}
                    className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold text-ink-soft hover:text-ink cursor-pointer"
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>
      <CategorySheet
        open={newCategory}
        type={type === 'income' ? 'income' : 'expense'}
        onClose={() => setNewCategory(false)}
        onSaved={setCategoryId}
      />
    </>
  )
}

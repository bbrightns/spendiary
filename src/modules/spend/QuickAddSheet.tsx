import { useEffect, useMemo, useRef, useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { SelectField } from '../../components/ui/Field'
import { FormActions } from '../../components/forms/FormActions'
import { TransactionDateField } from '../../components/forms/TransactionDateField'
import { useToast } from '../../store/ToastContext'
import { localDateStr, thb } from '../../lib/format'
import type { SpendTxnType } from '../../lib/types'
import { categoriesFor, getCategory } from './categories'
import { recentTags, topTags } from './logic'
import { TONES, TYPE_ACTIVE } from './tones'
import { useSpend } from './useSpend'

const OPEN_EVENT = 'spendiary:open-quick-add'

interface OpenDetail {
  type?: SpendTxnType
  /** Edit an existing transaction */
  editId?: string
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

const NO_WALLET = ''

export function QuickAddSheet() {
  const { transactions, wallets, addTransaction, updateTransaction, removeTransaction } = useSpend()
  const { showToast } = useToast()

  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [type, setType] = useState<SpendTxnType>('expense')
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('food')
  const [accountId, setAccountId] = useState(NO_WALLET)
  const [toAccountId, setToAccountId] = useState(NO_WALLET)
  const [date, setDate] = useState(localDateStr())
  const [note, setNote] = useState('')
  const amountRef = useRef<HTMLInputElement>(null)

  // Latest values for the event listener without re-subscribing on every keystroke
  const stateRef = useRef({ transactions, wallets })
  stateRef.current = { transactions, wallets }

  useEffect(() => {
    function onOpen(e: Event) {
      const detail = (e as CustomEvent<OpenDetail>).detail ?? {}
      const { transactions: txns, wallets: ws } = stateRef.current
      const existing = detail.editId ? txns.find((t) => t.id === detail.editId) : undefined
      // Default wallet: the one used last, else the first spending wallet
      const lastWallet = txns.find((t) => t.accountId && ws.some((w) => w.id === t.accountId))?.accountId
      const defaultWallet = lastWallet ?? ws.find((w) => w.category !== 'locked')?.id ?? ws[0]?.id ?? NO_WALLET

      if (existing) {
        setEditId(existing.id)
        setType(existing.type)
        setAmount(String(existing.amount))
        setCategoryId(existing.categoryId ?? categoriesFor(existing.type)[0]?.id ?? '')
        setAccountId(existing.accountId ?? NO_WALLET)
        setToAccountId(existing.toAccountId ?? NO_WALLET)
        setDate(existing.date)
        setNote(existing.note ?? '')
      } else {
        const t = detail.type ?? 'expense'
        setEditId(null)
        setType(t)
        setAmount('')
        setCategoryId(categoriesFor(t)[0]?.id ?? '')
        setAccountId(defaultWallet)
        setToAccountId(ws.find((w) => w.id !== defaultWallet)?.id ?? NO_WALLET)
        setDate(localDateStr())
        setNote('')
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

  const recent = useMemo(() => recentTags(transactions, 3), [transactions])
  const frequent = useMemo(() => topTags(transactions, 8).filter((t) => !recent.includes(t)).slice(0, 5), [transactions, recent])
  const noteTokens = note.toLowerCase().split(/\s+/)
  const value = Number(amount.replace(/,/g, ''))
  const amountValid = Number.isFinite(value) && value > 0
  const transferValid = type !== 'transfer' || (accountId !== NO_WALLET && toAccountId !== NO_WALLET && accountId !== toAccountId)
  const canSave = amountValid && transferValid

  const changeType = (t: SpendTxnType) => {
    setType(t)
    if (t !== 'transfer' && getCategory(categoryId)?.type !== t) setCategoryId(categoriesFor(t)[0]?.id ?? '')
  }

  const appendTag = (tag: string) => {
    const token = `#${tag}`
    if (noteTokens.includes(token)) return
    setNote((n) => (n.trim() ? `${n.trimEnd()} ${token}` : token))
  }

  const save = () => {
    if (!canSave) return
    const input = {
      type,
      amount: Math.round(value * 100) / 100,
      categoryId: type === 'transfer' ? undefined : categoryId,
      accountId: accountId || undefined,
      toAccountId: type === 'transfer' ? toAccountId || undefined : undefined,
      date,
      note: note.trim() || undefined,
    }
    if (editId) {
      updateTransaction(editId, input)
      showToast('Transaction updated')
    } else {
      addTransaction(input)
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

  const walletOptions = [
    ...(type === 'transfer' ? [] : [{ value: NO_WALLET, label: 'No wallet (not tracked)' }]),
    ...wallets.map((w) => ({ value: w.id, label: `${w.name} · ${thb(w.balance)}` })),
  ]
  const pickWalletOption = [{ value: NO_WALLET, label: 'Choose a wallet' }]

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title={editId ? 'Edit transaction' : 'Quick add'}
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
              {categoriesFor(type).map((c) => {
                const active = c.id === categoryId
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setCategoryId(c.id)}
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
            </div>
          </div>
        )}

        {/* Wallets */}
        {type === 'transfer' ? (
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="From" value={accountId} onChange={setAccountId} options={[...pickWalletOption, ...walletOptions]} />
            <SelectField
              label="To"
              value={toAccountId}
              onChange={setToAccountId}
              error={accountId && accountId === toAccountId ? 'Pick another wallet' : undefined}
              options={[...pickWalletOption, ...walletOptions]}
            />
          </div>
        ) : (
          <SelectField
            label={type === 'income' ? 'Into wallet' : 'From wallet'}
            value={accountId}
            onChange={setAccountId}
            options={walletOptions}
          />
        )}

        <TransactionDateField value={date} onChange={setDate} />

        {/* Note + hashtags */}
        <div>
          <label className="block">
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-ink-soft">Note</span>
              <span className="text-xs text-ink-muted">Add #tags to find it later</span>
            </div>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Brown sugar milk tea #nosetea"
              className="h-11 w-full rounded-xl border border-line-strong bg-surface px-3.5 text-base text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-brand focus:ring-2 focus:ring-brand/15"
            />
          </label>
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
  )
}

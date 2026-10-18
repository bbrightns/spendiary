import { useEffect, useMemo, useRef, useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { useData } from '../../store/DataContext'
import { useToast } from '../../store/ToastContext'
import { localDateStr, thb } from '../../lib/format'
import { SwitchVisual } from './AccountSheets'
import { loanPaymentAmount, paymentIsSpending } from './loans'
import { loanPaidDetail } from './billPaid'
import { NOT_TRACKED, PayMethodPicker } from './PayMethodPicker'
import { useSpend } from './useSpend'
import { SHEET_EVENTS } from './sheetEvents'

const OPEN_EVENT = SHEET_EVENTS.payLoan

/** Open the "Pay" sheet for a loan or installment plan from anywhere in the app. */
export function openPayLoan(liabilityId: string) {
  window.dispatchEvent(new CustomEvent<string>(OPEN_EVENT, { detail: liabilityId }))
}

/**
 * Undo a loan's latest payment: its balance and installment count go back, and the Spend
 * transaction it logged (if any) is removed so the wallet gets the money back too.
 */
export function useUndoLoanPayment() {
  const { data, undoLiabilityPayment } = useData()
  const { transactions, removeTransaction } = useSpend()
  return (liabilityId: string) => {
    // Only the transaction from that payment's day: one paid outside the app logged nothing,
    // and an older month's payment must stay
    const paidOn = (data.liabilities ?? []).find((l) => l.id === liabilityId)?.lastPaidDate
    const logged = paidOn ? transactions.find((t) => t.liabilityId === liabilityId && t.date === paidOn) : undefined
    if (logged) removeTransaction(logged.id)
    undoLiabilityPayment(liabilityId)
  }
}

/**
 * One step to pay a loan: the amount, the wallet it came from, done. The loan's balance and the
 * wallet move together, and one Undo reverses both. An installment purchase counts as spending;
 * paying back a loan is a transfer out of the wallet (switchable per payment).
 */
export function PayLoanSheet() {
  const { data, payLiabilityInstallment, undoLiabilityPayment } = useData()
  const { methods, settings, addTransaction, removeTransaction } = useSpend()
  const { showToast } = useToast()
  const [loanId, setLoanId] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [fromId, setFromId] = useState('')
  const [spending, setSpending] = useState(false)

  const loans = useMemo(() => data.liabilities ?? [], [data.liabilities])
  const stateRef = useRef({ loans, methods, settings })
  stateRef.current = { loans, methods, settings }

  useEffect(() => {
    function onOpen(e: Event) {
      const { loans: ls, methods: ms, settings: st } = stateRef.current
      const loan = ls.find((l) => l.id === (e as CustomEvent<string>).detail)
      if (!loan) return
      const wallets = ms.filter((m) => m.kind === 'cash')
      const def = wallets.find((w) => w.id === st.defaultAccountId)?.id
      const fav = wallets.find((w) => (st.favoriteAccountIds ?? []).includes(w.id))?.id
      // The loan's usual account first; an installment billed to a card is a card expense
      const usual = ms.find((m) => m.id === loan.payFromId)
      setFromId(usual?.id ?? def ?? fav ?? wallets.find((w) => !w.locked)?.id ?? NOT_TRACKED)
      setAmount(String(loanPaymentAmount(loan)))
      setSpending(usual?.kind === 'card' || paymentIsSpending(loan))
      setLoanId(loan.id)
    }
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_EVENT, onOpen)
  }, [])

  const loan = loans.find((l) => l.id === loanId)
  const close = () => setLoanId(null)
  const value = Math.round(Number(amount.replace(/,/g, '')) * 100) / 100
  const valid = Number.isFinite(value) && value > 0
  const outside = fromId === NOT_TRACKED
  // A loan payment is a transfer, which needs a wallet to come out of; a card can pay an installment but not a transfer
  const usable = spending ? methods : methods.filter((m) => m.kind === 'cash')
  const n = (loan?.paidInstallments ?? 0) + 1
  const step = loan?.isInstallment && loan.totalInstallments ? ` ${n}/${loan.totalInstallments}` : ''

  // Switching to a transfer drops a card that was picked
  useEffect(() => {
    if (!spending && methods.find((m) => m.id === fromId)?.kind === 'card') setFromId(NOT_TRACKED)
  }, [spending, fromId, methods])

  const pay = () => {
    if (!loan || !valid) return
    const note = `${loan.name} payment${step}`
    // Paid outside the app as a transfer: nothing to log, only the loan goes down
    const txn =
      spending || !outside
        ? addTransaction({
            type: spending ? 'expense' : 'transfer',
            amount: value,
            categoryId: spending ? 'bills' : undefined,
            accountId: outside ? undefined : fromId,
            date: localDateStr(),
            note,
            liabilityId: loan.id,
          })
        : undefined
    // Before paying: the popup reads the loan as it was
    const { detail, paidOff } = loanPaidDetail({ loan, amount: value, accountName: methods.find((m) => m.id === fromId)?.name })
    payLiabilityInstallment(loan.id, value)
    const id = loan.id
    showToast(
      `Paid ${thb(value, true)} toward ${loan.name}`,
      'success',
      {
        label: 'Undo',
        onClick: () => {
          if (txn) removeTransaction(txn.id)
          undoLiabilityPayment(id)
        },
      },
      // Confetti only for the last payment
      { popup: true, celebrate: paidOff, title: paidOff ? 'Paid off' : 'Paid', detail },
    )
    close()
  }

  return (
    <Modal
      open={!!loan}
      onClose={close}
      title={loan ? `Pay ${loan.name}` : 'Pay'}
      description={loan ? `${step ? `Payment${step} · ` : ''}${thb(loan.balance)} left` : undefined}
      size="md"
      footer={
        <Button data-modal-submit className="w-full" disabled={!valid} onClick={pay}>
          Pay {thb(valid ? value : 0, true)}
        </Button>
      }
    >
      {loan && (
        <div className="space-y-5">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Amount</span>
            <div className="flex h-12 items-center rounded-xl border border-line-strong bg-surface focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15">
              <span className="pl-3.5 text-lg font-bold text-ink-muted">฿</span>
              <input
                inputMode="decimal"
                autoComplete="off"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
                className="min-w-0 flex-1 bg-transparent px-2 text-lg font-bold tnum text-ink outline-none"
              />
            </div>
          </label>

          <PayMethodPicker
            label="Paid from"
            methods={usable}
            value={fromId}
            onChange={setFromId}
            favoriteIds={settings.favoriteAccountIds ?? []}
            defaultId={settings.defaultAccountId}
            allowNone
          />

          <button
            type="button"
            role="switch"
            aria-checked={spending}
            onClick={() => setSpending((v) => !v)}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3 text-left cursor-pointer hover:bg-surface-muted/50"
          >
            <span>
              <span className="block text-sm font-bold text-ink">Count as spending</span>
              <span className="block text-xs text-ink-muted">
                {spending
                  ? 'Logged as a Bills expense, like buying it'
                  : 'Logged as a transfer: paying back a loan moves money, it isn\'t spending'}
              </span>
            </span>
            <SwitchVisual on={spending} />
          </button>

          {outside && !spending && <p className="-mt-2 text-xs text-ink-muted">Only the loan goes down. Nothing is logged in Spend.</p>}
        </div>
      )}
    </Modal>
  )
}

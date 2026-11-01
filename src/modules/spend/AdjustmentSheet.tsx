import { useEffect, useState } from 'react'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { thbSigned } from '../../lib/format'
import { useToast } from '../../store/ToastContext'
import { txnFlow } from './logic'
import { useSpend } from './useSpend'

const OPEN_EVENT = 'spendiary:open-adjustment'

/** Ask to undo a "Balance adjusted" entry (rows open this instead of Quick add). */
export function openAdjustment(id: string) {
  window.dispatchEvent(new CustomEvent<string>(OPEN_EVENT, { detail: id }))
}

/**
 * Undo a balance typed in on Edit wallet: the entry goes and the wallet moves back by the same
 * difference, so a mistyped balance can be taken back from the wallet's history.
 */
export function AdjustmentSheet() {
  const { transactions, methods, accountName, removeTransaction } = useSpend()
  const { showToast } = useToast()
  const [id, setId] = useState<string | null>(null)

  useEffect(() => {
    const open = (e: Event) => setId((e as CustomEvent<string>).detail)
    window.addEventListener(OPEN_EVENT, open)
    return () => window.removeEventListener(OPEN_EVENT, open)
  }, [])

  const txn = id ? transactions.find((t) => t.id === id && t.adjustment) : undefined
  const walletId = txn ? txn.toAccountId ?? txn.accountId : undefined
  const wallet = methods.find((m) => m.id === walletId)
  const change = txn && walletId ? txnFlow(txn, walletId) : 0
  const name = accountName(walletId) ?? 'The wallet'

  return (
    <ConfirmModal
      open={!!txn}
      onClose={() => setId(null)}
      onConfirm={() => {
        if (!txn) return
        removeTransaction(txn.id)
        setId(null)
        showToast(`${name} is back to ${wallet ? thbSigned(wallet.balance - change, true) : 'its earlier balance'}`, 'info')
      }}
      title="Undo balance change?"
      description={
        wallet
          ? `${name} goes from ${thbSigned(wallet.balance, true)} back to ${thbSigned(wallet.balance - change, true)}, and this entry is removed.`
          : 'This entry is removed.'
      }
      confirmText="Undo change"
      confirmVariant="primary"
    />
  )
}

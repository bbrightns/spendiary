import type { SpendTxnType } from '../../lib/types'
import type { SpendTxnInput } from './useSpend'

/** Window events that open the Spend sheets from anywhere in the app */
export const SHEET_EVENTS = {
  quickAdd: 'spendiary:open-quick-add',
  import: 'spendiary:open-import',
  payBill: 'spendiary:open-pay-bill',
  payLoan: 'spendiary:open-pay-loan',
  adjustment: 'spendiary:open-adjustment',
  matchStatement: 'spendiary:open-match-statement',
} as const

// The open functions live here, not in the sheet files, so those files export only components
// (React Fast Refresh can then swap a sheet in place while developing)

export interface QuickAddDetail {
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
export function openQuickAdd(detail: QuickAddDetail = {}) {
  window.dispatchEvent(new CustomEvent<QuickAddDetail>(SHEET_EVENTS.quickAdd, { detail }))
}

/** Open the statement import sheet from anywhere. */
export function openImport() {
  window.dispatchEvent(new CustomEvent(SHEET_EVENTS.import))
}

/** Open the "Pay bill" sheet for a credit card from anywhere in the app. */
export function openPayBill(cardId: string) {
  window.dispatchEvent(new CustomEvent<string>(SHEET_EVENTS.payBill, { detail: cardId }))
}

/** Open the "Pay" sheet for a loan or installment plan from anywhere in the app. */
export function openPayLoan(liabilityId: string) {
  window.dispatchEvent(new CustomEvent<string>(SHEET_EVENTS.payLoan, { detail: liabilityId }))
}

/** Ask to undo a "Balance adjusted" entry (rows open this instead of Quick add). */
export function openAdjustment(id: string) {
  window.dispatchEvent(new CustomEvent<string>(SHEET_EVENTS.adjustment, { detail: id }))
}

/** Check a card's last bill against the total on the bank's statement. */
export function openMatchStatement(cardId: string) {
  window.dispatchEvent(new CustomEvent<string>(SHEET_EVENTS.matchStatement, { detail: cardId }))
}

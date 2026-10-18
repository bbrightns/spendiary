/** Window events that open the Spend sheets from anywhere in the app (see each sheet's open function) */
export const SHEET_EVENTS = {
  quickAdd: 'spendiary:open-quick-add',
  import: 'spendiary:open-import',
  payBill: 'spendiary:open-pay-bill',
  payLoan: 'spendiary:open-pay-loan',
} as const

import type { SpendTransaction } from '../../lib/types'
import { localDateStr } from '../../lib/format'

/** Columns written; Date, Description and a signed Amount are what the importer reads back. */
export const EXPORT_HEADER = ['Date', 'Time', 'Type', 'Category', 'Subcategory', 'Account', 'To account', 'Description', 'Tags', 'Amount']

const field = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)

/**
 * Spend transactions as CSV, oldest first. Amounts are signed: money out (expenses and
 * transfers) negative, income positive. Starts with a byte-order mark so Excel shows Thai.
 */
export function toCsv(
  txns: SpendTransaction[],
  names: { category: (id?: string) => string; account: (id?: string) => string },
): string {
  const rows = [...txns]
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? '') || a.createdAt.localeCompare(b.createdAt))
    .map((t) => {
      const signed = t.type === 'income' ? t.amount : -t.amount
      return [
        t.date,
        t.time ?? '',
        t.type,
        t.type === 'transfer' ? '' : names.category(t.categoryId),
        t.subcategory ?? '',
        names.account(t.accountId),
        t.type === 'transfer' ? names.account(t.toAccountId) : '',
        t.note ?? '',
        (t.tags ?? []).map((x) => `#${x}`).join(' '),
        signed.toFixed(2),
      ]
        .map(field)
        .join(',')
    })
  return String.fromCharCode(0xfeff) + [EXPORT_HEADER.join(','), ...rows].join('\r\n') + '\r\n'
}

/** Save the CSV through the browser. */
export function downloadCsv(csv: string, name = `spendiary-spend-${localDateStr()}.csv`) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

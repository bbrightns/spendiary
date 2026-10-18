/** CSV files the app exports (Spend transactions, holdings, the activity log). */

type Cell = string | number | null | undefined

/** One cell: empty for no value, quoted when it holds a comma, quote or line break. */
export function csvCell(value: Cell): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** A whole file: header and rows with Windows line ends, starting with a byte-order mark so Excel shows Thai. */
export function buildCsv(header: string[], rows: Cell[][]): string {
  return String.fromCharCode(0xfeff) + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

/** Save the CSV through the browser. */
export function downloadCsv(csv: string, name: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

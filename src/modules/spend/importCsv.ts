/**
 * Reading bank / card statement CSVs into Spend transactions. Pure functions (tested).
 * Handles quoted fields, comma / semicolon / tab separators, Thai and English headers,
 * one signed amount column or separate withdrawal / deposit columns, and dates written
 * as YYYY-MM-DD or DD/MM/YYYY (Buddhist years like 2569 are converted).
 */

export type Row = string[]

/** Split CSV text into rows, honoring quotes ("a, b" stays one field; "" is a quote). */
export function parseCsv(text: string): Row[] {
  const BOM = String.fromCharCode(0xfeff)
  const clean = text.startsWith(BOM) ? text.slice(1) : text
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? ''
  const counts = { ',': 0, ';': 0, '\t': 0 } as Record<string, number>
  for (const ch of firstLine) if (ch in counts) counts[ch]++
  const [best, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  const sep = n > 0 ? best : ','

  const rows: Row[] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === sep) {
      row.push(field.trim())
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++
      row.push(field.trim())
      if (row.some((f) => f !== '')) rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  row.push(field.trim())
  if (row.some((f) => f !== '')) rows.push(row)
  return rows
}

export interface ColumnMap {
  date: number
  /** One signed amount column (negative = money out), or… */
  amount?: number
  /** …separate money-out / money-in columns */
  out?: number
  in?: number
  description?: number
  /** Time of day (H:mm); a time inside the date cell is read too */
  time?: number
  /** Category / subcategory names, e.g. from Spendiary's own export or another money app */
  category?: number
  subcategory?: number
  /** Spendiary's own export: "transfer" rows move money between two accounts */
  type?: number
  /** Account names (from / to) as written in the file; used for transfers */
  account?: number
  toAccount?: number
}

const HEADER_HINTS: Record<keyof ColumnMap, RegExp> = {
  date: /date|วันที่|วัน|transaction date|posting/i,
  amount: /^amount$|amount \(thb\)|จำนวนเงิน|ยอดเงิน|^thb$/i,
  out: /withdraw|debit|ถอน|จ่าย|เดบิต|money out|paid out|spent/i,
  in: /deposit|credit|ฝาก|รับ|เครดิต|money in|paid in|received/i,
  description: /desc|detail|รายการ|รายละเอียด|note|memo|merchant|payee|narrative|บันทึก/i,
  time: /^time$|^เวลา$/i,
  category: /^category$|^หมวด(หมู่)?$/i,
  subcategory: /^sub[- ]?category$|^หมวดย่อย$/i,
  type: /^type$|^ประเภท$/i,
  account: /^account$|^บัญชี$/i,
  toAccount: /^to[- ]?account$|^บัญชีปลายทาง$/i,
}

/** Guess which column is which from the header row; undefined if no date or amount is found. */
export function guessColumns(header: Row): ColumnMap | undefined {
  const find = (key: keyof ColumnMap, skip: number[] = []) => header.findIndex((h, i) => !skip.includes(i) && HEADER_HINTS[key].test(h.trim()))
  const date = find('date')
  if (date < 0) return undefined
  const out = find('out', [date])
  const inn = find('in', [date, out])
  const amount = find('amount', [date, out, inn])
  const description = find('description', [date, out, inn, amount])
  const map: ColumnMap = { date, description: description >= 0 ? description : undefined }
  for (const key of ['time', 'category', 'subcategory', 'type', 'account', 'toAccount'] as const) {
    const i = find(key, [date, out, inn, amount, description])
    if (i >= 0) map[key] = i
  }
  if (out >= 0 || inn >= 0) {
    if (out >= 0) map.out = out
    if (inn >= 0) map.in = inn
  } else if (amount >= 0) map.amount = amount
  else return undefined
  return map
}

/** A header row has no parseable date in it. */
export const looksLikeHeader = (row: Row) => !row.some((f) => parseDate(f))

/** "1,234.50", "(500)", "-500", "฿ 99" → number; blank / text → undefined. */
export function parseAmount(s: string | undefined): number | undefined {
  if (!s) return undefined
  const t = s.replace(/[฿,\s]|THB/gi, '')
  if (!t) return undefined
  const neg = /^\(.*\)$/.test(t) || t.startsWith('-') || t.endsWith('-')
  const n = Number(t.replace(/[()+-]/g, ''))
  if (!Number.isFinite(n)) return undefined
  return neg ? -n : n
}

/** YYYY-MM-DD, DD/MM/YYYY, DD-MM-YY, DD.MM.YYYY (Buddhist years converted) → YYYY-MM-DD. */
export function parseDate(s: string | undefined): string | undefined {
  if (!s) return undefined
  const t = s.trim().split(/[ T]/)[0]
  let y: number, m: number, d: number
  let match = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  if (match) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])]
  else {
    match = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/)
    if (!match) return undefined
    ;[d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])]
    if (y < 100) y += y >= 43 ? 2500 : 2000 // 2-digit: 69 → 2569 (BE), 26 → 2026
  }
  if (y > 2400) y -= 543
  const date = new Date(y, m - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return undefined
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** "4:48", "16:43:10", "4.48 PM" → "HH:mm"; undefined when it isn't a time. */
export function parseTime(s: string | undefined): string | undefined {
  const m = s?.trim().match(/^(\d{1,2})[:.](\d{2})(?:[:.]\d{2})?\s*([ap]\.?m\.?)?$/i)
  if (!m) return undefined
  let h = Number(m[1])
  const min = Number(m[2])
  const pm = m[3]?.toLowerCase().startsWith('p')
  if (m[3]) {
    if (h < 1 || h > 12) return undefined
    h = (h % 12) + (pm ? 12 : 0)
  }
  if (h > 23 || min > 59) return undefined
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

export interface ImportRow {
  date: string
  /** HH:mm when the file has a time */
  time?: string
  type: 'expense' | 'income' | 'transfer'
  /** Account names as written in the file (transfers: from → to) */
  account?: string
  toAccount?: string
  /** Positive */
  amount: number
  description: string
  /** Names as written in the file, matched to the app's categories by the importer */
  category?: string
  subcategory?: string
}

/** An entry already in the app that an import row may be the same as. */
export interface MatchCandidate {
  id: string
  date: string
  type: string
  amount: number
  note?: string
  time?: string
  categoryId?: string
  subcategory?: string
  accountId?: string
  /** Set when the entry comes from the Invest side (read-only here) */
  source?: string
}

/**
 * Invest-side rows that moved money on `accountId`, as a statement would show them: a buy paid
 * from it (or a savings DCA out of it) is money out, a dividend or savings DCA into it is money in.
 */
export function investCandidates(txns: (MatchCandidate & { toAccountId?: string })[], accountId: string): MatchCandidate[] {
  const out: MatchCandidate[] = []
  for (const t of txns) {
    if (!t.source) continue
    if (t.accountId === accountId) out.push({ ...t, type: t.type === 'income' ? 'income' : 'expense' })
    else if (t.type === 'transfer' && t.toAccountId === accountId) out.push({ ...t, type: 'income', accountId })
  }
  return out
}

/** Notes compared the way the importer reads them: spacing and line breaks collapsed, any letter case. */
export const sameNote = (a: string | undefined, b: string | undefined) =>
  (a ?? '').replace(/\s+/g, ' ').trim().toLowerCase() === (b ?? '').replace(/\s+/g, ' ').trim().toLowerCase()

/**
 * Pair import rows with entries already in the app: same day, direction and amount, and the
 * same time of day when both have one. Each entry is used once. Same text (any wallet) is paired
 * first, then the same time, then file order; the last two only on `accountId` when one is given.
 * Returns row index → entry.
 */
export function pairExisting(rows: ImportRow[], existing: MatchCandidate[], accountId?: string): Map<number, MatchCandidate> {
  const key = (date: string, type: string, amount: number) => `${date}|${type}|${amount.toFixed(2)}`
  const pool = new Map<string, MatchCandidate[]>()
  for (const e of existing) {
    const k = key(e.date, e.type, e.amount)
    pool.set(k, [...(pool.get(k) ?? []), e])
  }
  const timesAgree = (r: ImportRow, e: MatchCandidate) => !r.time || !e.time || r.time === e.time
  const onAccount = (e: MatchCandidate) => !accountId || e.accountId === accountId
  const passes: ((r: ImportRow, e: MatchCandidate) => boolean)[] = [
    (r, e) => sameNote(e.note, r.description) && (r.time ?? '') === (e.time ?? ''),
    (r, e) => sameNote(e.note, r.description),
    (r, e) => !!r.time && r.time === e.time && onAccount(e),
    (_, e) => onAccount(e),
  ]
  const out = new Map<number, MatchCandidate>()
  for (const fits of passes) {
    rows.forEach((r, i) => {
      if (out.has(i)) return
      const candidates = pool.get(key(r.date, r.type, r.amount))
      const at = candidates?.findIndex((e) => timesAgree(r, e) && fits(r, e)) ?? -1
      if (at >= 0) out.set(i, candidates!.splice(at, 1)[0])
    })
  }
  return out
}

/** Turn CSV rows into transactions; rows without a date or amount are counted as skipped. */
export function toImportRows(rows: Row[], map: ColumnMap): { rows: ImportRow[]; skipped: number } {
  const out: ImportRow[] = []
  let skipped = 0
  for (const r of rows) {
    const date = parseDate(r[map.date])
    let signed: number | undefined
    if (map.amount !== undefined) signed = parseAmount(r[map.amount])
    else {
      const o = map.out !== undefined ? parseAmount(r[map.out]) : undefined
      const i = map.in !== undefined ? parseAmount(r[map.in]) : undefined
      if (o) signed = -Math.abs(o)
      else if (i) signed = Math.abs(i)
    }
    if (!date || signed === undefined || signed === 0) {
      skipped++
      continue
    }
    const cell = (i?: number) => (i !== undefined ? r[i]?.trim() || undefined : undefined)
    out.push({
      date,
      time: parseTime(cell(map.time)) ?? parseTime(r[map.date]?.trim().split(/[ T]/).slice(1).join(' ')),
      category: cell(map.category),
      subcategory: cell(map.subcategory),
      type: cell(map.type)?.toLowerCase() === 'transfer' ? 'transfer' : signed < 0 ? 'expense' : 'income',
      account: cell(map.account),
      toAccount: cell(map.toAccount),
      amount: Math.round(Math.abs(signed) * 100) / 100,
      description: (map.description !== undefined ? r[map.description] : '')?.replace(/\s+/g, ' ').trim() ?? '',
    })
  }
  return { rows: out, skipped }
}

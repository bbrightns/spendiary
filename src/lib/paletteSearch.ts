/**
 * Matching and parsing for the command palette. Pure functions, so they're unit tested.
 *
 * Every word of the query must match somewhere in an item (title, keywords or subtitle).
 * A word matches by prefix, by substring, by letters in order (e.g. "dcap" → "DCA Planner"),
 * or with a typo (one edit for 4+ letters, two for 8+). Better kinds of match score higher.
 */

export interface Searchable {
  title: string
  subtitle?: string
  keywords?: string[]
}

const norm = (s: string) => s.normalize('NFC').toLowerCase()

/** Words in a string; Thai has no spaces, so a whole Thai run stays one word. */
const words = (s: string) => norm(s).split(/[^\p{L}\p{N}\p{M}#]+/u).filter(Boolean)

/** Edit distance with transpositions, capped: returns max + 1 once it can't be ≤ max. */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  const prev2: number[] = []
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1)
      cur.push(v)
      rowMin = Math.min(rowMin, v)
    }
    if (rowMin > max) return max + 1
    prev2.splice(0, prev2.length, ...prev)
    prev = cur
  }
  return prev[b.length]
}

const isSubsequence = (q: string, t: string) => {
  let i = 0
  for (const ch of t) if (ch === q[i]) i++
  return i === q.length
}

/** How well one query word matches a text, 0 (no match) to 1. */
export function termScore(term: string, text: string): number {
  const t = norm(text)
  if (!t) return 0
  const ws = words(t)
  if (ws.some((w) => w === term)) return 1
  if (ws.some((w) => w.startsWith(term))) return 0.9
  if (t.includes(term)) return 0.75
  // Numbers only match as written: "1000" mustn't fuzzy-match "000"
  if (/^[\d.,]+$/.test(term)) return 0
  if (term.length >= 3 && ws.some((w) => w.length >= term.length && isSubsequence(term, w))) return 0.5
  // Letters in order across words ("dcap" → "DCA Planner"), only on short text starting at a word
  const joined = ws.join('')
  if (term.length >= 3 && joined.length <= term.length * 3 && ws.some((w) => w[0] === term[0]) && isSubsequence(term, joined)) return 0.4
  if (term.length >= 4) {
    const allowed = term.length >= 8 ? 2 : 1
    // Compare with whole words and with word starts of the same length (a typo while still typing)
    if (ws.some((w) => editDistance(term, w, allowed) <= allowed || (w.length > term.length && editDistance(term, w.slice(0, term.length), allowed) <= allowed)))
      return 0.45
  }
  return 0
}

/** Item score for the query's words (0 = some word didn't match). Title counts most. */
export function scoreItem(terms: string[], item: Searchable): number {
  if (terms.length === 0) return 0
  let total = 0
  for (const term of terms) {
    const best = Math.max(
      termScore(term, item.title),
      ...(item.keywords ?? []).map((k) => termScore(term, k) * 0.85),
      item.subtitle ? termScore(term, item.subtitle) * 0.7 : 0,
    )
    if (best === 0) return 0
    total += best
  }
  return total / terms.length
}

export const queryTerms = (q: string) => words(q)

// ── Amounts ──────────────────────────────────────────────────────────────────

export interface AmountFilter {
  min?: number
  max?: number
  /** A plain number: match it exactly (to the baht) */
  exact?: number
}

/** `65`, `>1000`, `<=200`, `100-500`, `1,200` → a filter; anything else → undefined. */
export function parseAmountFilter(token: string): AmountFilter | undefined {
  const t = token.replace(/,/g, '').replace(/^฿/, '')
  let m = t.match(/^(>=|<=|>|<)(\d+(?:\.\d+)?)$/)
  if (m) {
    const n = Number(m[2])
    if (m[1] === '>') return { min: n + 0.005 }
    if (m[1] === '>=') return { min: n }
    if (m[1] === '<') return { max: n - 0.005 }
    return { max: n }
  }
  m = t.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/)
  if (m) return { min: Math.min(Number(m[1]), Number(m[2])), max: Math.max(Number(m[1]), Number(m[2])) }
  if (/^\d+(?:\.\d+)?$/.test(t)) return { exact: Number(t) }
  return undefined
}

export function amountMatches(f: AmountFilter, amount: number): boolean {
  if (f.exact !== undefined) return Math.abs(amount - f.exact) < 1
  return (f.min === undefined || amount >= f.min) && (f.max === undefined || amount <= f.max)
}

// ── Commands with arguments ──────────────────────────────────────────────────

export interface QuickAddIntent {
  type: 'expense' | 'income'
  amount: number
  /** The rest of the query, kept as typed so #tags survive */
  note: string
}

/**
 * "65 ชานม #nosetea" → expense 65 with that note; "+500 bonus" → income.
 * The amount may come first or last. Needs a number plus at least one other word.
 */
export function parseQuickAdd(query: string): QuickAddIntent | undefined {
  const parts = query.trim().split(/\s+/)
  if (parts.length < 2) return undefined
  const num = (s: string) => {
    const m = s.replace(/,/g, '').match(/^([+-]?)฿?(\d+(?:\.\d{1,2})?)$/)
    return m ? { sign: m[1], value: Number(m[2]) } : undefined
  }
  let hit = num(parts[0])
  let rest = parts.slice(1)
  if (!hit) {
    hit = num(parts[parts.length - 1])
    rest = parts.slice(0, -1)
  }
  if (!hit || hit.value <= 0) return undefined
  // A leading word like "pay" or "budget" is a command, not a note
  if (/^(pay|budget|จ่าย|งบ)$/i.test(rest[0] ?? '')) return undefined
  return { type: hit.sign === '+' ? 'income' : 'expense', amount: hit.value, note: rest.join(' ') }
}

/** "pay ktc" → "ktc"; "budget food" → "food". */
export function parseVerb(query: string, verbs: string[]): string | undefined {
  const m = query.trim().match(/^(\S+)\s+(.+)$/)
  if (!m) return undefined
  return verbs.includes(m[1].toLowerCase()) ? m[2].trim() : undefined
}

// ── Usage memory ─────────────────────────────────────────────────────────────

export type Usage = Record<string, { n: number; last: number }>

/** Bonus for items picked often and lately: up to ~0.25. */
export function usageBoost(u: Usage[string] | undefined, now = Date.now()): number {
  if (!u) return 0
  const days = (now - u.last) / 86_400_000
  return Math.min(0.15, Math.log2(1 + u.n) * 0.04) + (days < 1 ? 0.1 : days < 7 ? 0.05 : 0)
}

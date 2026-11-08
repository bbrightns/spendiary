/**
 * The amount field takes simple sums ("120+45+30", "450−50", "3×120", "900÷3"), so a split bill or a
 * discount doesn't need a calculator. Only the result is ever saved.
 *
 * The field keeps its own operator glyphs (+ − × ÷); `cleanAmountInput` maps what a keyboard sends
 * ("-", "*", "x", "/") onto them. Commas are thousands separators and are ignored.
 */

export const OPERATORS = ['+', '−', '×', '÷'] as const
export type Operator = (typeof OPERATORS)[number]

const OP_SET = new Set<string>(OPERATORS)
const KEY_MAP: Record<string, Operator> = { '-': '−', '–': '−', '*': '×', x: '×', X: '×', '/': '÷' }

/** True when the text holds at least one operator, i.e. it's a sum and not a plain amount. */
export function hasOperator(text: string): boolean {
  return [...text].some((ch) => OP_SET.has(ch))
}

/**
 * What the field keeps from a keystroke or a paste: digits, `.`, `,` and the four operators.
 * No operator at the start (amounts are never negative; the type picks the sign), and two in a row
 * become the last one typed, so "12+−" reads "12−".
 */
export function cleanAmountInput(raw: string): string {
  let out = ''
  for (const ch of raw) {
    const c = KEY_MAP[ch] ?? ch
    if (/[\d.,]/.test(c)) out += c
    else if (OP_SET.has(c)) {
      if (!out) continue
      out = OP_SET.has(out[out.length - 1]) ? out.slice(0, -1) + c : out + c
    }
  }
  return out
}

/** Adds an operator at the end of the field (the buttons under the amount). Same rules as typing. */
export function appendOperator(text: string, op: Operator): string {
  return cleanAmountInput(text + op)
}

/**
 * The value of the field, rounded to satang. A trailing operator is ignored ("120+" is 120), so the
 * preview stays steady while typing. Null when it isn't a number: empty, "1.2.3", "5÷0", a lone ".".
 */
export function evalAmount(text: string): number | null {
  let s = text.replace(/,/g, '').trim()
  while (s && OP_SET.has(s[s.length - 1])) s = s.slice(0, -1)
  if (!s) return null

  const parts = s.split(/([+−×÷])/)
  // Numbers sit at even indexes, operators at odd ones
  const nums: number[] = []
  const ops: string[] = []
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) {
      ops.push(parts[i])
      continue
    }
    if (!/^(\d+\.?\d*|\.\d+)$/.test(parts[i])) return null
    nums.push(Number(parts[i]))
  }

  // × and ÷ first, then + and − left to right
  const terms = [nums[0]]
  const signs: string[] = []
  for (let i = 0; i < ops.length; i++) {
    const n = nums[i + 1]
    if (ops[i] === '×') terms[terms.length - 1] *= n
    else if (ops[i] === '÷') {
      if (n === 0) return null
      terms[terms.length - 1] /= n
    } else {
      signs.push(ops[i])
      terms.push(n)
    }
  }
  let total = terms[0]
  signs.forEach((sign, i) => {
    total = sign === '+' ? total + terms[i + 1] : total - terms[i + 1]
  })
  if (!Number.isFinite(total)) return null
  // Drop float noise (0.1+0.2, 1.005×100) before rounding to satang
  return Math.round(Number((total * 100).toFixed(6))) / 100
}

/**
 * The field's text after a sum is worked out: the result. A sum that isn't valid or comes to zero or
 * less stays as typed, so it can be fixed instead of turning into a number the field can't hold.
 */
export function settleAmount(text: string): string {
  if (!hasOperator(text)) return text
  const v = evalAmount(text)
  return v === null || v <= 0 ? text : String(v)
}

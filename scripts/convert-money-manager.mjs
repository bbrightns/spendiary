#!/usr/bin/env node
/**
 * One-off converter: a "Money Manager" .xlsx export -> a Spendiary backup JSON.
 *
 *   node scripts/convert-money-manager.mjs <export.xlsx> [--base backup.json] [--wallet "Cash"] [--out file.json]
 *
 * Without --base the result is a minimal backup holding only the converted spending
 * (restoring any backup REPLACES the app's data, so start from a fresh app or pass a
 * backup exported from it with --base so everything already there is kept).
 * Restore the output in the app via Settings -> import backup.
 *
 * Rows are written as "already in balance": they are history and totals only and
 * never move a wallet balance. Reads the .xlsx with Node's zlib (no dependencies).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'

const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const xlsxPath = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'))
if (!xlsxPath) {
  console.error('Usage: node scripts/convert-money-manager.mjs <export.xlsx> [--base backup.json] [--wallet "Cash"] [--out file.json]')
  process.exit(1)
}

// ── Minimal .xlsx reader: zip central directory + inflate + XML text ──
function unzip(buf) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  if (eocd < 0) throw new Error('Not a zip / .xlsx file')
  const count = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)
  const files = {}
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Bad zip directory')
    const method = buf.readUInt16LE(p + 10)
    const size = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const local = buf.readUInt32LE(p + 42)
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen)
    const dataStart = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
    const raw = buf.subarray(dataStart, dataStart + size)
    files[name] = method === 0 ? raw : inflateRawSync(raw)
    p += 46 + nameLen + extraLen + commentLen
  }
  return files
}

const unescapeXml = (s) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
const textOf = (xml) => unescapeXml([...xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(''))

function readSheet(files) {
  const shared = files['xl/sharedStrings.xml']
    ? [...files['xl/sharedStrings.xml'].toString('utf8').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]))
    : []
  const sheetName = Object.keys(files).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort()[0]
  if (!sheetName) throw new Error('No worksheet found')
  const xml = files[sheetName].toString('utf8')
  return [...xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map((r) => {
    const row = []
    for (const c of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const col = /r="([A-Z]+)\d+"/.exec(c[1])?.[1]
      if (!col) continue
      const idx = [...col].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1
      const type = /t="(\w+)"/.exec(c[1])?.[1]
      const body = c[2] ?? ''
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1]
      row[idx] = type === 's' ? shared[Number(v)] ?? '' : type === 'inlineStr' ? textOf(body) : v === undefined ? '' : unescapeXml(v)
    }
    return row
  })
}

// ── Category mapping: Money Manager name (emoji stripped) -> Spendiary category ──
const EMOJI_LEAD = /^[^\p{L}\p{N}]+/u
const clean = (s) => (s ?? '').replace(EMOJI_LEAD, '').trim()

/** Built-ins keep their own id; the rest become custom categories with an icon and color. */
const BUILT_IN = { food: 'food', transport: 'transport', shopping: 'shopping', utilities: 'bills', health: 'health' }
const CUSTOM_STYLE = {
  gift: { icon: 'gift', tone: 'pink' },
  generousness: { icon: 'heart', tone: 'rose' },
  haircut: { icon: 'scissors', tone: 'violet' },
  maintenance: { icon: 'shield', tone: 'teal' },
  'fees & fares': { icon: 'receipt', tone: 'amber' },
  travel: { icon: 'plane', tone: 'sky' },
}
const INCOME_BUILT_IN = { salary: 'salary', bonus: 'bonus', interest: 'interest', dividend: 'dividend', dividends: 'dividend' }

// ── Dates: Excel serial (days since 1899-12-30, fraction = time, no timezone) ──
function fromSerial(serial) {
  const ms = Math.round((Number(serial) - 25569) * 86400) * 1000
  const d = new Date(ms) // read back as UTC fields = the wall-clock values that were typed
  const p = (n) => String(n).padStart(2, '0')
  const date = `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`
  const time = `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`
  const local = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds())
  return { date, time, createdMs: local.getTime() }
}

// ── Convert ──
const rows = readSheet(unzip(readFileSync(xlsxPath)))
const header = rows[0].map((h) => (h ?? '').trim().toLowerCase())
const col = (name) => header.indexOf(name)
const C = {
  date: col('date'),
  category: col('category'),
  sub: col('subcategory'),
  note: col('note'),
  kind: col('income/expense'),
  desc: col('description'),
  amount: col('amount'),
}
for (const [k, v] of Object.entries(C)) if (v < 0) throw new Error(`Missing column for ${k}; this does not look like a Money Manager export`)

const baseRaw = flag('--base') ? JSON.parse(readFileSync(flag('--base'), 'utf8')) : undefined
const baseData = baseRaw?.schemaVersion === 1 && baseRaw.data ? baseRaw.data : baseRaw
const data = baseData ?? { cashAccounts: [], holdings: [], dcaPlans: [], transfers: [], monthlyIncome: 0 }
const settings = { ...(data.spendSettings ?? {}) }
const customCategories = [...(settings.customCategories ?? [])]
const subcategories = { ...(settings.subcategories ?? {}) }

const wanted = (flag('--wallet') ?? 'Cash').toLowerCase()
const wallet = (data.cashAccounts ?? []).find((a) => a.id === flag('--wallet') || a.name.toLowerCase() === wanted) ?? (data.cashAccounts ?? [])[0]

const categoryId = (rawName, kind) => {
  const name = clean(rawName) || 'Other'
  const key = name.toLowerCase()
  const builtIn = kind === 'income' ? INCOME_BUILT_IN[key] ?? 'other_in' : BUILT_IN[key]
  if (builtIn) return builtIn
  const found = customCategories.find((c) => c.type === kind && c.label.toLowerCase() === key)
  if (found) return found.id
  const style = CUSTOM_STYLE[key] ?? { icon: 'tag', tone: 'slate' }
  const id = `cat-mm-${key.replace(/[^\p{L}\p{N}]+/gu, '-')}-${kind}`
  customCategories.push({ id, type: kind, label: name, ...style })
  return id
}

const existing = data.spendTransactions ?? []
const seen = new Set(existing.map((t) => `${t.date}|${t.time ?? ''}|${t.amount}|${t.note ?? ''}`))
const created = []
let skipped = 0
let lastMs = 0
for (const r of rows.slice(1)) {
  if (!r[C.date] || !r[C.amount]) continue
  const kind = /income/i.test(r[C.kind] ?? '') ? 'income' : 'expense'
  const amount = Math.abs(Number(r[C.amount]))
  if (!Number.isFinite(amount) || amount <= 0) continue
  const { date, time, createdMs } = fromSerial(r[C.date])
  const note = [r[C.note]?.trim(), r[C.desc]?.trim()].filter(Boolean).join('\n') || undefined
  const sig = `${date}|${time}|${amount}|${note ?? ''}`
  if (seen.has(sig)) {
    skipped++
    continue
  }
  seen.add(sig)
  const catId = categoryId(r[C.category], kind)
  const sub = r[C.sub]?.trim() || undefined
  if (sub) {
    const list = subcategories[catId] ?? []
    if (!list.includes(sub)) subcategories[catId] = [...list, sub]
  }
  // Distinct, ordered createdAt (the sheet only has minute-level precision for ties)
  lastMs = Math.max(createdMs, lastMs + 1)
  created.push({
    id: `mm-${created.length + 1}-${createdMs.toString(36)}`,
    type: kind,
    amount,
    categoryId: catId,
    ...(wallet ? { accountId: wallet.id } : {}),
    date,
    time,
    ...(sub ? { subcategory: sub } : {}),
    ...(note ? { note } : {}),
    alreadyInBalance: true,
    tags: [...new Set([...(note ?? '').matchAll(/#([^\s#]+)/gu)].map((m) => m[1].toLowerCase()))],
    createdAt: new Date(lastMs).toISOString(),
  })
}

const out = {
  schemaVersion: 1,
  exportedAt: new Date().toISOString(),
  data: {
    ...data,
    spendTransactions: [...existing, ...created],
    spendSettings: { ...settings, customCategories, subcategories },
  },
  preferences: baseRaw?.preferences ?? {},
}
const outPath = flag('--out') ?? 'spendiary-money-manager-import.json'
writeFileSync(outPath, JSON.stringify(out, null, 2))

const dates = created.map((t) => t.date).sort()
console.log(`Converted ${created.length} rows (${skipped} duplicates skipped) ${dates[0] ?? ''} -> ${dates.at(-1) ?? ''}`)
console.log(`Wallet: ${wallet ? `${wallet.name} (${wallet.id})` : 'none (rows are not tied to a wallet)'}`)
console.log(`New custom categories: ${customCategories.length}; categories with subcategories: ${Object.keys(subcategories).length}; subcategories: ${Object.values(subcategories).flat().length}`)
console.log(`Wrote ${outPath}`)

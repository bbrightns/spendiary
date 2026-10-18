import type { ComponentType } from 'react'
import { ArrowRightLeft, List, Repeat } from 'lucide-react'
import type { SpendSettings, SpendTxnType } from '../../lib/types'
import { TONES, type Tone } from './tones'
import { queryTerms, scoreItem, termScore } from '../../lib/paletteSearch'
import { applyOrder } from './logic'
import { DotsHorizontalIcon } from '../../components/icons'
import { CATEGORY_ICONS } from '../../components/categoryIcons'
import { appIcon, type IconProps } from '../../components/appIcon'

// Category icons live in components/categoryIcons (Lucide); re-exported for the Spend screens
export { CATEGORY_ICONS }

export const TransferIcon = appIcon(ArrowRightLeft, 'TransferIcon')
export const ListBulletIcon = appIcon(List, 'ListBulletIcon')
export const RepeatIcon = appIcon(Repeat, 'RepeatIcon')

/**
 * Colors offered in the pickers, in hue order. Yellow, cyan and teal still render
 * (shipped categories use them) but look like amber, sky and emerald, so they aren't offered.
 */
export const CATEGORY_TONES: Tone[] = ['rose', 'orange', 'amber', 'lime', 'emerald', 'sky', 'indigo', 'violet', 'pink', 'slate']

const TONE_LOOKALIKE: Partial<Record<Tone, Tone>> = { yellow: 'amber', cyan: 'sky', teal: 'emerald' }

/** The picker swatch that shows a tone as selected */
export const pickerTone = (t: Tone): Tone => TONE_LOOKALIKE[t] ?? t

export interface SpendCategory {
  id: string
  label: string
  type: Exclude<SpendTxnType, 'transfer'>
  icon: ComponentType<IconProps>
  /** Key in CATEGORY_ICONS */
  iconKey: string
  tone: Tone
  /** Extra search words (Thai included) so "อาหาร" finds Food */
  keywords: string[]
  /** Not offered in pickers (archived by the user) */
  hidden?: boolean
  /** Filled in automatically (e.g. dividends from Invest); never shown in pickers or settings */
  system?: boolean
  /** Made by the user (can be removed); built-ins can only be edited or hidden */
  custom?: boolean
}

type BuiltIn = Omit<SpendCategory, 'icon'>

const BUILT_IN: BuiltIn[] = [
  { id: 'food', label: 'Food', type: 'expense', tone: 'orange', iconKey: 'food', keywords: ['อาหาร', 'กิน', 'ข้าว', 'meal', 'lunch', 'dinner', 'breakfast', 'restaurant'] },
  { id: 'drinks', label: 'Drinks', type: 'expense', tone: 'amber', iconKey: 'coffee', keywords: ['กาแฟ', 'ชา', 'ชานม', 'coffee', 'tea', 'cafe'] },
  { id: 'desserts', label: 'Desserts', type: 'expense', tone: 'yellow', iconKey: 'dessert', keywords: ['ของหวาน', 'ขนม', 'เค้ก', 'ไอติม', 'ไอศกรีม', 'เบเกอรี่', 'dessert', 'cake', 'bakery', 'ice cream'] },
  { id: 'transport', label: 'Transport', type: 'expense', tone: 'sky', iconKey: 'car', keywords: ['เดินทาง', 'รถ', 'น้ำมัน', 'bts', 'mrt', 'grab', 'bolt', 'taxi', 'fuel'] },
  { id: 'shopping', label: 'Shopping', type: 'expense', tone: 'pink', iconKey: 'bag', keywords: ['ช้อปปิ้ง', 'ของใช้'] },
  { id: 'bills', label: 'Bills', type: 'expense', tone: 'violet', iconKey: 'receipt', keywords: ['บิล', 'ค่าน้ำ', 'ค่าไฟ', 'เน็ต', 'โทรศัพท์'] },
  { id: 'housing', label: 'Housing', type: 'expense', tone: 'teal', iconKey: 'home', keywords: ['ที่พัก', 'ค่าเช่า', 'บ้าน', 'คอนโด'] },
  { id: 'health', label: 'Health', type: 'expense', tone: 'rose', iconKey: 'heart', keywords: ['สุขภาพ', 'ยา', 'หมอ', 'ฟิตเนส'] },
  { id: 'fun', label: 'Fun', type: 'expense', tone: 'indigo', iconKey: 'sparkle', keywords: ['บันเทิง', 'หนัง', 'เที่ยว', 'เกม'] },
  { id: 'family', label: 'Family', type: 'expense', tone: 'lime', iconKey: 'family', keywords: ['ครอบครัว', 'พ่อแม่', 'ลูก', 'family'] },
  { id: 'other', label: 'Other', type: 'expense', tone: 'slate', iconKey: 'dots', keywords: ['อื่นๆ'] },

  { id: 'salary', label: 'Salary', type: 'income', tone: 'emerald', iconKey: 'wallet', keywords: ['เงินเดือน', 'salary', 'payroll'] },
  { id: 'bonus', label: 'Bonus', type: 'income', tone: 'yellow', iconKey: 'award', keywords: ['โบนัส'] },
  { id: 'side', label: 'Side income', type: 'income', tone: 'teal', iconKey: 'coins', keywords: ['รายได้เสริม', 'ฟรีแลนซ์'] },
  { id: 'interest', label: 'Interest', type: 'income', tone: 'cyan', iconKey: 'growth', keywords: ['ดอกเบี้ย'] },
  { id: 'gift_in', label: 'Gift received', type: 'income', tone: 'pink', iconKey: 'gift', keywords: ['ได้รับ', 'อั่งเปา'] },
  { id: 'other_in', label: 'Other', type: 'income', tone: 'slate', iconKey: 'dots', keywords: ['อื่นๆ'] },
  { id: 'dividend', label: 'Dividends', type: 'income', tone: 'indigo', iconKey: 'dividend', keywords: ['ปันผล', 'dividend'], system: true },
]

/** The built-in "Other" categories, kept at the end of their lists. */
const CATCH_ALL = new Set(['other', 'other_in'])

const toneOf = (t: string | undefined, fallback: Tone): Tone => (t && t in TONES ? (t as Tone) : fallback)
const withIcon = (c: BuiltIn): SpendCategory => ({ ...c, icon: CATEGORY_ICONS[c.iconKey] ?? DotsHorizontalIcon })

/** Built-in categories as shipped (before the user's edits). */
export const SPEND_CATEGORIES: SpendCategory[] = BUILT_IN.map(withIcon)

// The live list: built-ins with the user's edits, then the user's own categories.
// Synced from Spend settings by the data provider, so plain lookups stay synchronous.
let live: SpendCategory[] = SPEND_CATEGORIES
let byId = new Map(live.map((c) => [c.id, c]))
let syncedFrom: [unknown, unknown, unknown] = [undefined, undefined, undefined]

export function syncCategories(settings?: Pick<SpendSettings, 'customCategories' | 'categoryEdits' | 'categoryOrder'>) {
  const custom = settings?.customCategories
  const edits = settings?.categoryEdits
  const order = settings?.categoryOrder
  if (syncedFrom[0] === custom && syncedFrom[1] === edits && syncedFrom[2] === order) return
  syncedFrom = [custom, edits, order]
  const builtIns = BUILT_IN.map((c) => {
    const e = c.system ? undefined : edits?.[c.id]
    if (!e) return withIcon(c)
    return withIcon({
      ...c,
      label: e.label?.trim() || c.label,
      tone: toneOf(e.tone, c.tone),
      iconKey: e.icon && e.icon in CATEGORY_ICONS ? e.icon : c.iconKey,
      hidden: e.hidden || undefined,
    })
  })
  const mine = (custom ?? []).map((c) =>
    withIcon({
      id: c.id,
      label: c.label,
      type: c.type,
      tone: toneOf(c.tone, 'slate'),
      iconKey: c.icon in CATEGORY_ICONS ? c.icon : 'tag',
      keywords: [],
      hidden: c.hidden || undefined,
      custom: true,
    }),
  )
  // "Other" is the catch-all, so it always stays last — the user's own categories slot in before it.
  // The user's saved order (per type) comes first; categories not in it follow in their usual place.
  const all = [...builtIns, ...mine]
  const ordered = applyOrder(
    all.filter((c) => !CATCH_ALL.has(c.id)),
    [...(order?.expense ?? []), ...(order?.income ?? [])],
  )
  live = [...ordered, ...all.filter((c) => CATCH_ALL.has(c.id))]
  byId = new Map(live.map((c) => [c.id, c]))
}

export function getCategory(id?: string): SpendCategory | undefined {
  return id ? byId.get(id) : undefined
}

/** Categories offered in pickers. `keep` stays listed even if hidden (e.g. the one already chosen). */
export function categoriesFor(type: SpendTxnType, keep?: string): SpendCategory[] {
  return live.filter((c) => c.type === type && !c.system && (!c.hidden || c.id === keep))
}

/** Every category the user can manage, hidden ones included. */
export function manageableCategories(type: 'expense' | 'income'): SpendCategory[] {
  return live.filter((c) => c.type === type && !c.system)
}

/** The category a note most likely belongs to, by name or keyword (Thai or English). */
export function guessCategory(note: string, type: 'expense' | 'income'): SpendCategory | undefined {
  const terms = queryTerms(note).filter((t) => !t.startsWith('#'))
  const text = note.toLowerCase()
  let best: { c: SpendCategory; s: number } | undefined
  for (const c of manageableCategories(type)) {
    if (c.hidden) continue
    for (const t of terms) {
      // A one- or two-letter Latin word ("C", "ID") is too short to be the start of a word: only a whole-word match counts
      if (t.length < 3 && !/\p{Script=Thai}/u.test(t) && ![c.label, ...c.keywords].some((x) => termScore(t, x) === 1)) continue
      const s = scoreItem([t], { title: c.label, keywords: c.keywords })
      if (s >= 0.75 && (!best || s > best.s)) best = { c, s }
    }
    // Thai is written without spaces, so a keyword can sit inside a longer word (ค่ากาแฟ → กาแฟ)
    for (const k of c.keywords) {
      if (/\p{Script=Thai}/u.test(k) && k.length >= 2 && text.includes(k) && (!best || 0.8 > best.s)) best = { c, s: 0.8 }
    }
  }
  return best?.c
}

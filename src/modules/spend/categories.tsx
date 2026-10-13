import type { ComponentType, SVGProps } from 'react'
import type { SpendSettings, SpendTxnType } from '../../lib/types'
import { TONES, type Tone } from './tones'
import { queryTerms, scoreItem, termScore } from '../../lib/paletteSearch'
import {
  CarIcon,
  CoinsIcon,
  DotsHorizontalIcon,
  HomeIcon,
  ReceiptPercentIcon,
  ShoppingBagIcon,
  SparkleIcon,
  SparklesIcon,
  WalletIcon,
  DividendIcon,
  ArrowUpRightIcon,
} from '../../components/icons'

type IconProps = SVGProps<SVGSVGElement>

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  viewBox: '0 0 24 24',
}

export function FoodIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
      <path d="M7 2v20" />
      <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
    </svg>
  )
}

export function CoffeeIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M10 2v2" />
      <path d="M14 2v2" />
      <path d="M6 2v2" />
      <path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1" />
    </svg>
  )
}

export function HeartPulseIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  )
}

export function GiftIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M20 12v10H4V12" />
      <path d="M2 7h20v5H2z" />
      <path d="M12 22V7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  )
}

export function TransferIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="m17 3 4 4-4 4" />
      <path d="M3 7h18" />
      <path d="m7 21-4-4 4-4" />
      <path d="M21 17H3" />
    </svg>
  )
}

export function ListBulletIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3.5 6h.01" />
      <path d="M3.5 12h.01" />
      <path d="M3.5 18h.01" />
    </svg>
  )
}

export function RepeatIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </svg>
  )
}

// More icons for user-made categories (Lucide-style, 24px, stroke)

function PlaneIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
    </svg>
  )
}

function BookIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  )
}

function PhoneIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <path d="M12 18h.01" />
    </svg>
  )
}

function ShirtIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
    </svg>
  )
}

function BriefcaseIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      <rect x="2" y="6" width="20" height="14" rx="2" />
    </svg>
  )
}

function MusicIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  )
}

function DumbbellIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="m6.5 6.5 11 11" />
      <path d="m21 21-1-1" />
      <path d="m3 3 1 1" />
      <path d="m18 22 4-4" />
      <path d="m2 6 4-4" />
      <path d="m3 10 7-7" />
      <path d="m14 21 7-7" />
    </svg>
  )
}

function GradCapIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M22 10 12 5 2 10l10 5 10-5Z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
      <path d="M22 10v6" />
    </svg>
  )
}

function GamepadIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 12h4" />
      <path d="M8 10v4" />
      <path d="M15 13h.01" />
      <path d="M18 11h.01" />
    </svg>
  )
}

function FilmIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <rect x="2" y="2" width="20" height="20" rx="2.2" />
      <path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5" />
    </svg>
  )
}

function WifiIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M5 12.55a11 11 0 0 1 14.08 0" />
      <path d="M1.42 9a16 16 0 0 1 21.16 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <path d="M12 20h.01" />
    </svg>
  )
}

function ScissorsIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M20 4 8.12 15.88" />
      <path d="M14.47 14.48 20 20" />
      <path d="M8.12 8.12 12 12" />
    </svg>
  )
}

function ShieldIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

function TagIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
      <path d="M7 7h.01" />
    </svg>
  )
}

/** Icons a category can use, by stored key; the order is the picker's order. */
export const CATEGORY_ICONS: Record<string, ComponentType<IconProps>> = {
  food: FoodIcon,
  coffee: CoffeeIcon,
  car: CarIcon,
  plane: PlaneIcon,
  bag: ShoppingBagIcon,
  shirt: ShirtIcon,
  receipt: ReceiptPercentIcon,
  wifi: WifiIcon,
  phone: PhoneIcon,
  home: HomeIcon,
  heart: HeartPulseIcon,
  shield: ShieldIcon,
  dumbbell: DumbbellIcon,
  scissors: ScissorsIcon,
  sparkle: SparkleIcon,
  film: FilmIcon,
  music: MusicIcon,
  game: GamepadIcon,
  book: BookIcon,
  grad: GradCapIcon,
  gift: GiftIcon,
  wallet: WalletIcon,
  briefcase: BriefcaseIcon,
  coins: CoinsIcon,
  sparkles: SparklesIcon,
  growth: ArrowUpRightIcon,
  dividend: DividendIcon,
  tag: TagIcon,
  dots: DotsHorizontalIcon,
}

export const CATEGORY_TONES = Object.keys(TONES) as Tone[]

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
  { id: 'transport', label: 'Transport', type: 'expense', tone: 'sky', iconKey: 'car', keywords: ['เดินทาง', 'รถ', 'น้ำมัน', 'bts', 'mrt', 'grab', 'bolt', 'taxi', 'fuel'] },
  { id: 'shopping', label: 'Shopping', type: 'expense', tone: 'pink', iconKey: 'bag', keywords: ['ช้อปปิ้ง', 'ของใช้'] },
  { id: 'bills', label: 'Bills', type: 'expense', tone: 'violet', iconKey: 'receipt', keywords: ['บิล', 'ค่าน้ำ', 'ค่าไฟ', 'เน็ต', 'โทรศัพท์'] },
  { id: 'housing', label: 'Housing', type: 'expense', tone: 'teal', iconKey: 'home', keywords: ['ที่พัก', 'ค่าเช่า', 'บ้าน', 'คอนโด'] },
  { id: 'health', label: 'Health', type: 'expense', tone: 'rose', iconKey: 'heart', keywords: ['สุขภาพ', 'ยา', 'หมอ', 'ฟิตเนส'] },
  { id: 'fun', label: 'Fun', type: 'expense', tone: 'indigo', iconKey: 'sparkle', keywords: ['บันเทิง', 'หนัง', 'เที่ยว', 'เกม'] },
  { id: 'family', label: 'Family', type: 'expense', tone: 'lime', iconKey: 'gift', keywords: ['ครอบครัว', 'ของขวัญ', 'พ่อแม่'] },
  { id: 'other', label: 'Other', type: 'expense', tone: 'slate', iconKey: 'dots', keywords: ['อื่นๆ'] },

  { id: 'salary', label: 'Salary', type: 'income', tone: 'emerald', iconKey: 'wallet', keywords: ['เงินเดือน', 'salary', 'payroll'] },
  { id: 'bonus', label: 'Bonus', type: 'income', tone: 'yellow', iconKey: 'sparkles', keywords: ['โบนัส'] },
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
let syncedFrom: [unknown, unknown] = [undefined, undefined]

export function syncCategories(settings?: Pick<SpendSettings, 'customCategories' | 'categoryEdits'>) {
  const custom = settings?.customCategories
  const edits = settings?.categoryEdits
  if (syncedFrom[0] === custom && syncedFrom[1] === edits) return
  syncedFrom = [custom, edits]
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
  // "Other" is the catch-all, so it always stays last — the user's own categories slot in before it
  const all = [...builtIns, ...mine]
  live = [...all.filter((c) => !CATCH_ALL.has(c.id)), ...all.filter((c) => CATCH_ALL.has(c.id))]
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

import type { ComponentType, SVGProps } from 'react'
import type { SpendTxnType } from '../../lib/types'
import type { Tone } from './tones'
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

export interface SpendCategory {
  id: string
  label: string
  type: Exclude<SpendTxnType, 'transfer'>
  icon: ComponentType<IconProps>
  tone: Tone
  /** Extra search words (Thai included) so "อาหาร" finds Food */
  keywords: string[]
}

export const SPEND_CATEGORIES: SpendCategory[] = [
  { id: 'food', label: 'Food', type: 'expense', tone: 'orange', icon: FoodIcon, keywords: ['อาหาร', 'กิน', 'meal'] },
  { id: 'drinks', label: 'Drinks', type: 'expense', tone: 'amber', icon: CoffeeIcon, keywords: ['กาแฟ', 'ชา', 'ชานม', 'coffee'] },
  { id: 'transport', label: 'Transport', type: 'expense', tone: 'sky', icon: CarIcon, keywords: ['เดินทาง', 'รถ', 'น้ำมัน', 'bts', 'grab'] },
  { id: 'shopping', label: 'Shopping', type: 'expense', tone: 'pink', icon: ShoppingBagIcon, keywords: ['ช้อปปิ้ง', 'ของใช้'] },
  { id: 'bills', label: 'Bills', type: 'expense', tone: 'violet', icon: ReceiptPercentIcon, keywords: ['บิล', 'ค่าน้ำ', 'ค่าไฟ', 'เน็ต', 'โทรศัพท์'] },
  { id: 'housing', label: 'Housing', type: 'expense', tone: 'teal', icon: HomeIcon, keywords: ['ที่พัก', 'ค่าเช่า', 'บ้าน', 'คอนโด'] },
  { id: 'health', label: 'Health', type: 'expense', tone: 'rose', icon: HeartPulseIcon, keywords: ['สุขภาพ', 'ยา', 'หมอ', 'ฟิตเนส'] },
  { id: 'fun', label: 'Fun', type: 'expense', tone: 'indigo', icon: SparkleIcon, keywords: ['บันเทิง', 'หนัง', 'เที่ยว', 'เกม'] },
  { id: 'family', label: 'Family', type: 'expense', tone: 'lime', icon: GiftIcon, keywords: ['ครอบครัว', 'ของขวัญ', 'พ่อแม่'] },
  { id: 'other', label: 'Other', type: 'expense', tone: 'slate', icon: DotsHorizontalIcon, keywords: ['อื่นๆ'] },

  { id: 'salary', label: 'Salary', type: 'income', tone: 'emerald', icon: WalletIcon, keywords: ['เงินเดือน'] },
  { id: 'bonus', label: 'Bonus', type: 'income', tone: 'yellow', icon: SparklesIcon, keywords: ['โบนัส'] },
  { id: 'side', label: 'Side income', type: 'income', tone: 'teal', icon: CoinsIcon, keywords: ['รายได้เสริม', 'ฟรีแลนซ์'] },
  { id: 'interest', label: 'Interest', type: 'income', tone: 'cyan', icon: ArrowUpRightIcon, keywords: ['ดอกเบี้ย'] },
  { id: 'gift_in', label: 'Gift received', type: 'income', tone: 'pink', icon: GiftIcon, keywords: ['ได้รับ', 'อั่งเปา'] },
  { id: 'other_in', label: 'Other', type: 'income', tone: 'slate', icon: DotsHorizontalIcon, keywords: ['อื่นๆ'] },
]

const byId = new Map(SPEND_CATEGORIES.map((c) => [c.id, c]))

export function getCategory(id?: string): SpendCategory | undefined {
  return id ? byId.get(id) : undefined
}

export function categoriesFor(type: SpendTxnType): SpendCategory[] {
  return SPEND_CATEGORIES.filter((c) => c.type === type)
}

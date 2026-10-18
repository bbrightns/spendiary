import type { ComponentType, SVGProps } from 'react'
import {
  Apple, Award, Baby, BadgePercent, Banknote, Beef, Beer, Bike, Bird, Bitcoin, BookOpen, Bone, Briefcase, Building2,
  Bus, CakeSlice, Camera, Car, CarTaxiFront, Cat, ChartLine, Church, Clapperboard, Coffee, Coins, Cookie, CreditCard,
  Croissant, CupSoda, Dices, Dog, Donut, Droplet, Dumbbell, Ellipsis, Film, Fish, Flame, Flower2, Fuel, Gamepad2, Gem,
  Gift, Glasses, GraduationCap, HandCoins, HandHeart, Headphones, HeartHandshake, HeartPulse, House, IceCreamCone,
  Landmark, Laptop, Lightbulb, type LucideIcon, Milk, Motorbike, Mountain, Music, Package, Palette, PartyPopper,
  PawPrint, PiggyBank, Pill, Pizza, Plane, Plug, Popcorn, Rabbit, Receipt, Repeat, Router, Salad, Sandwich, School,
  Scissors, Shield, ShieldCheck, Ship, Shirt, ShoppingBag, ShoppingCart, Smartphone, Smile, Sofa, Soup, Sparkles,
  SquareParking, Stethoscope, Syringe, Tag, Tent, Ticket, ToyBrick, TrainFront, TrendingUp, Trophy, Truck, Tv,
  Umbrella, Users, Utensils, Wallet, Watch, Wifi, Wine, Wrench, Zap,
} from 'lucide-react'

type IconProps = Omit<SVGProps<SVGSVGElement>, 'ref'>

/** The app's line weight: Lucide's default (2) looks heavier than the rest of the app (1.6) */
export const ICON_STROKE = 1.6

/** A Lucide icon with the app's defaults, used like the hand-drawn icons in icons.tsx */
export function appIcon(Icon: LucideIcon, name: string): ComponentType<IconProps> {
  const AppIcon = (p: IconProps) => <Icon strokeWidth={ICON_STROKE} {...p} />
  AppIcon.displayName = name
  return AppIcon
}

export type CategoryIconGroup =
  | 'food' | 'transport' | 'home' | 'family' | 'pets' | 'health' | 'shopping' | 'fun' | 'money' | 'work' | 'other'

export const CATEGORY_ICON_GROUPS: { id: CategoryIconGroup; label: string }[] = [
  { id: 'food', label: 'Food & drinks' },
  { id: 'transport', label: 'Getting around' },
  { id: 'home', label: 'Home & bills' },
  { id: 'family', label: 'Family' },
  { id: 'pets', label: 'Pets' },
  { id: 'health', label: 'Health & beauty' },
  { id: 'shopping', label: 'Shopping' },
  { id: 'fun', label: 'Fun & travel' },
  { id: 'money', label: 'Money' },
  { id: 'work', label: 'Work & study' },
  { id: 'other', label: 'Other' },
]

export interface CategoryIconDef {
  /**
   * Saved in the user's data (a category's `icon`), so it never changes. It is our own name, not
   * Lucide's: if Lucide renames an icon, only the mapping below changes.
   */
  key: string
  Icon: ComponentType<IconProps>
  /** The Lucide icon behind it (tests use it to keep the picker free of look-alikes) */
  source: LucideIcon
  group: CategoryIconGroup
  /** Search words, Thai and English, so "หมา" finds the paw */
  keywords: string[]
  /** Kept so saved data still shows its icon, but not offered in the picker */
  hidden?: true
}

const def = (key: string, Icon: LucideIcon, group: CategoryIconGroup, keywords: string[], hidden?: true): CategoryIconDef => ({
  key,
  Icon: appIcon(Icon, `CategoryIcon(${key})`),
  source: Icon,
  group,
  keywords,
  ...(hidden ? { hidden } : {}),
})

/** Every category icon, in picker order. The first 29 keys are the ones saved before Lucide; keep them all. */
export const CATEGORY_ICON_LIST: CategoryIconDef[] = [
  // Food & drinks
  def('food', Utensils, 'food', ['อาหาร', 'กิน', 'ข้าว', 'food', 'meal', 'restaurant']),
  def('coffee', Coffee, 'food', ['กาแฟ', 'ชา', 'คาเฟ่', 'coffee', 'tea', 'cafe']),
  def('dessert', CakeSlice, 'food', ['ของหวาน', 'ขนม', 'เค้ก', 'เบเกอรี่', 'dessert', 'cake', 'bakery']),
  def('icecream', IceCreamCone, 'food', ['ไอติม', 'ไอศกรีม', 'ice cream']),
  def('donut', Donut, 'food', ['โดนัท', 'ขนม', 'donut', 'snack']),
  def('cookie', Cookie, 'food', ['คุกกี้', 'ขนม', 'cookie', 'snack']),
  def('croissant', Croissant, 'food', ['ครัวซองต์', 'ขนมปัง', 'bread', 'bakery']),
  def('drink', CupSoda, 'food', ['น้ำ', 'น้ำหวาน', 'ชานม', 'soda', 'drink', 'bubble tea']),
  def('milk', Milk, 'food', ['นม', 'milk']),
  def('beer', Beer, 'food', ['เบียร์', 'เหล้า', 'beer', 'bar']),
  def('wine', Wine, 'food', ['ไวน์', 'wine']),
  def('pizza', Pizza, 'food', ['พิซซ่า', 'pizza', 'fast food']),
  def('sandwich', Sandwich, 'food', ['แซนด์วิช', 'อาหารเช้า', 'sandwich', 'breakfast']),
  def('soup', Soup, 'food', ['ก๋วยเตี๋ยว', 'ซุป', 'ราเมน', 'noodles', 'soup']),
  def('salad', Salad, 'food', ['สลัด', 'ผัก', 'salad', 'healthy']),
  def('meat', Beef, 'food', ['เนื้อ', 'หมูกระทะ', 'ปิ้งย่าง', 'bbq', 'meat']),
  def('grocery', Apple, 'food', ['ผลไม้', 'ของสด', 'ตลาด', 'grocery', 'fruit']),

  // Getting around
  def('car', Car, 'transport', ['รถ', 'รถยนต์', 'car']),
  def('taxi', CarTaxiFront, 'transport', ['แท็กซี่', 'แกร็บ', 'taxi', 'grab', 'bolt']),
  def('motorbike', Motorbike, 'transport', ['มอเตอร์ไซค์', 'วิน', 'motorbike']),
  def('bus', Bus, 'transport', ['รถเมล์', 'รถทัวร์', 'bus']),
  def('train', TrainFront, 'transport', ['รถไฟ', 'บีทีเอส', 'เอ็มอาร์ที', 'bts', 'mrt', 'train']),
  def('fuel', Fuel, 'transport', ['น้ำมัน', 'ปั๊ม', 'fuel', 'gas']),
  def('parking', SquareParking, 'transport', ['ที่จอดรถ', 'parking']),
  def('bike', Bike, 'transport', ['จักรยาน', 'bike']),
  def('ship', Ship, 'transport', ['เรือ', 'boat', 'ferry']),
  def('delivery', Truck, 'transport', ['ขนส่ง', 'ส่งของ', 'delivery', 'shipping']),

  // Home & bills
  def('home', House, 'home', ['บ้าน', 'ค่าเช่า', 'คอนโด', 'home', 'rent']),
  def('receipt', Receipt, 'home', ['บิล', 'ใบเสร็จ', 'bill', 'receipt']),
  def('electric', Zap, 'home', ['ค่าไฟ', 'ไฟฟ้า', 'electricity']),
  def('water', Droplet, 'home', ['ค่าน้ำ', 'น้ำประปา', 'water']),
  def('wifi', Wifi, 'home', ['เน็ต', 'อินเทอร์เน็ต', 'wifi', 'internet']),
  def('phone', Smartphone, 'home', ['โทรศัพท์', 'มือถือ', 'phone', 'mobile']),
  def('router', Router, 'home', ['เน็ตบ้าน', 'router', 'fiber']),
  def('tv', Tv, 'home', ['ทีวี', 'สตรีมมิ่ง', 'tv', 'streaming']),
  def('gas', Flame, 'home', ['แก๊ส', 'แก๊สหุงต้ม', 'gas']),
  def('furniture', Sofa, 'home', ['เฟอร์นิเจอร์', 'ของแต่งบ้าน', 'furniture']),
  def('repair', Wrench, 'home', ['ซ่อม', 'ช่าง', 'repair', 'maintenance']),
  def('utility', Lightbulb, 'home', ['สาธารณูปโภค', 'หลอดไฟ', 'utilities']),
  def('plug', Plug, 'home', ['ชาร์จ', 'ปลั๊ก', 'ev', 'charging']),
  def('subscription', Repeat, 'home', ['สมาชิก', 'รายเดือน', 'subscription']),

  // Family
  def('family', Users, 'family', ['ครอบครัว', 'พ่อแม่', 'ญาติ', 'family', 'parents']),
  def('baby', Baby, 'family', ['ลูก', 'เด็ก', 'ทารก', 'baby', 'kids']),
  def('toys', ToyBrick, 'family', ['ของเล่น', 'toys']),
  def('school', School, 'family', ['โรงเรียน', 'ค่าเทอม', 'school', 'tuition']),
  def('care', HeartHandshake, 'family', ['ดูแล', 'เลี้ยงดู', 'care', 'support']),
  def('donate', HandHeart, 'family', ['บริจาค', 'ทำบุญ', 'donation', 'charity']),
  def('temple', Church, 'family', ['วัด', 'ทำบุญ', 'temple', 'religion']),

  // Pets
  def('pets', PawPrint, 'pets', ['สัตว์เลี้ยง', 'หมา', 'แมว', 'pets']),
  def('dog', Dog, 'pets', ['หมา', 'สุนัข', 'dog']),
  def('cat', Cat, 'pets', ['แมว', 'cat']),
  def('fish', Fish, 'pets', ['ปลา', 'fish']),
  def('bird', Bird, 'pets', ['นก', 'bird']),
  def('rabbit', Rabbit, 'pets', ['กระต่าย', 'rabbit']),
  def('petfood', Bone, 'pets', ['อาหารสัตว์', 'ขนมหมา', 'pet food']),

  // Health & beauty
  def('heart', HeartPulse, 'health', ['สุขภาพ', 'หมอ', 'health']),
  def('medicine', Pill, 'health', ['ยา', 'ร้านยา', 'medicine', 'pharmacy']),
  def('doctor', Stethoscope, 'health', ['โรงพยาบาล', 'คลินิก', 'หมอ', 'hospital', 'doctor']),
  def('vaccine', Syringe, 'health', ['ฉีดยา', 'วัคซีน', 'vaccine']),
  def('dumbbell', Dumbbell, 'health', ['ฟิตเนส', 'ยิม', 'ออกกำลังกาย', 'gym', 'fitness']),
  def('scissors', Scissors, 'health', ['ตัดผม', 'ร้านเสริมสวย', 'haircut', 'salon']),
  def('beauty', Flower2, 'health', ['ความงาม', 'สปา', 'นวด', 'beauty', 'spa']),
  def('dental', Smile, 'health', ['ทำฟัน', 'หมอฟัน', 'dentist']),
  def('glasses', Glasses, 'health', ['แว่นตา', 'คอนแทคเลนส์', 'glasses']),
  def('shield', Shield, 'health', ['ประกัน', 'insurance']),
  def('insured', ShieldCheck, 'health', ['ประกันสุขภาพ', 'ประกันชีวิต', 'health insurance']),

  // Shopping
  def('bag', ShoppingBag, 'shopping', ['ช้อปปิ้ง', 'ของใช้', 'shopping']),
  def('cart', ShoppingCart, 'shopping', ['ซูเปอร์มาร์เก็ต', 'ของใช้ในบ้าน', 'supermarket']),
  def('shirt', Shirt, 'shopping', ['เสื้อผ้า', 'แฟชั่น', 'clothes']),
  def('gift', Gift, 'shopping', ['ของขวัญ', 'gift']),
  def('package', Package, 'shopping', ['พัสดุ', 'ช้อปออนไลน์', 'online shopping', 'parcel']),
  def('gadget', Laptop, 'shopping', ['ไอที', 'คอมพิวเตอร์', 'gadget', 'electronics']),
  def('headphones', Headphones, 'shopping', ['หูฟัง', 'headphones']),
  def('watch', Watch, 'shopping', ['นาฬิกา', 'watch']),
  def('jewelry', Gem, 'shopping', ['เครื่องประดับ', 'jewelry']),

  // Fun & travel
  def('sparkle', Sparkles, 'fun', ['บันเทิง', 'สนุก', 'fun']),
  def('film', Film, 'fun', ['หนัง', 'ดูหนัง', 'movie']),
  def('cinema', Clapperboard, 'fun', ['โรงหนัง', 'cinema']),
  def('popcorn', Popcorn, 'fun', ['ป๊อปคอร์น', 'popcorn']),
  def('music', Music, 'fun', ['เพลง', 'คอนเสิร์ต', 'music', 'concert']),
  def('game', Gamepad2, 'fun', ['เกม', 'game']),
  def('ticket', Ticket, 'fun', ['ตั๋ว', 'บัตร', 'ticket', 'event']),
  def('party', PartyPopper, 'fun', ['ปาร์ตี้', 'ฉลอง', 'โบนัส', 'party', 'bonus']),
  def('plane', Plane, 'fun', ['เที่ยว', 'ตั๋วเครื่องบิน', 'travel', 'flight']),
  def('camping', Tent, 'fun', ['แคมป์', 'camping']),
  def('trip', Mountain, 'fun', ['ทริป', 'เดินป่า', 'trip', 'hiking']),
  def('beach', Umbrella, 'fun', ['ทะเล', 'beach']),
  def('camera', Camera, 'fun', ['กล้อง', 'ถ่ายรูป', 'camera']),
  def('art', Palette, 'fun', ['ศิลปะ', 'งานอดิเรก', 'art', 'hobby']),
  def('lottery', Dices, 'fun', ['หวย', 'ลอตเตอรี่', 'lottery']),
  def('trophy', Trophy, 'fun', ['รางวัล', 'แข่งขัน', 'prize']),

  // Money
  def('wallet', Wallet, 'money', ['กระเป๋าเงิน', 'เงินเดือน', 'wallet', 'salary']),
  def('coins', Coins, 'money', ['เหรียญ', 'รายได้เสริม', 'coins', 'side income']),
  def('cash', Banknote, 'money', ['เงินสด', 'cash']),
  def('card', CreditCard, 'money', ['บัตรเครดิต', 'credit card']),
  def('savings', PiggyBank, 'money', ['ออมเงิน', 'เก็บเงิน', 'savings']),
  def('growth', TrendingUp, 'money', ['ดอกเบี้ย', 'ผลตอบแทน', 'interest', 'return']),
  def('chart', ChartLine, 'money', ['หุ้น', 'กองทุน', 'stocks', 'funds']),
  def('bank', Landmark, 'money', ['ธนาคาร', 'ภาษี', 'bank', 'tax']),
  def('bitcoin', Bitcoin, 'money', ['คริปโต', 'บิตคอยน์', 'crypto', 'bitcoin']),
  def('fee', BadgePercent, 'money', ['ค่าธรรมเนียม', 'ส่วนลด', 'fee', 'discount']),
  def('award', Award, 'money', ['โบนัส', 'รางวัล', 'bonus', 'award']),

  // Work & study
  def('briefcase', Briefcase, 'work', ['งาน', 'ธุรกิจ', 'work', 'business']),
  def('office', Building2, 'work', ['ออฟฟิศ', 'บริษัท', 'office']),
  def('grad', GraduationCap, 'work', ['การศึกษา', 'มหาลัย', 'education']),
  def('book', BookOpen, 'work', ['หนังสือ', 'คอร์ส', 'book', 'course']),

  // Other
  def('tag', Tag, 'other', ['ป้าย', 'อื่นๆ', 'tag']),
  def('dots', Ellipsis, 'other', ['อื่นๆ', 'other']),

  // Saved before; kept so old data shows an icon, but no longer offered
  def('sparkles', Sparkles, 'other', [], true), // was a near copy of `sparkle`
  def('dividend', HandCoins, 'money', [], true), // the system Dividends category; was a copy of `coins`
]

/** Icon by saved key (every key, including hidden ones) */
export const CATEGORY_ICONS: Record<string, ComponentType<IconProps>> = Object.fromEntries(
  CATEGORY_ICON_LIST.map((d) => [d.key, d.Icon]),
)

/** Icons offered in the picker, optionally matching a search (Thai or English, any part of a word) */
export function pickableCategoryIcons(query = ''): CategoryIconDef[] {
  const q = query.trim().toLowerCase()
  return CATEGORY_ICON_LIST.filter(
    (d) => !d.hidden && (!q || d.key.includes(q) || d.keywords.some((k) => k.toLowerCase().includes(q))),
  )
}

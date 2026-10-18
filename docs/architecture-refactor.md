# Spendiary: แผน Architecture & Refactor

> สถานะ ณ 18 ต.ค. 2026 · main = **1.29.1** (`9c23cf9`) + งานเฟส B5–D ในเครื่อง (ยังไม่ push)
> เอกสารนี้รวมงานที่เหลือทั้งหมด จัดเป็นเฟส เรียงตามลำดับที่แนะนำ และระบุว่าแต่ละงานต้องรออะไร

---

## 0. หลักที่ใช้ทุกเฟส

| หลัก | แปลว่า |
|---|---|
| **ห้ามเดาค่า** | ถ้าไม่รู้ค่าจริง ให้บอกว่าไม่รู้ (ป้าย / ข้อความ / หยุดถาม) ห้ามใส่ 0, ราคาทุน หรือค่าคงที่แทน |
| **ข้อมูลผู้ใช้ห้ามพัง** | ค่าที่บันทึกลง `user_data.payload` ต้องอ่านได้ทุกเวอร์ชัน ถ้าเปลี่ยนรูปแบบต้องผ่าน `migrate()` |
| **เปลี่ยนข้างใน ไม่เปลี่ยนชื่อข้างนอก** | refactor แล้วชื่อที่ไฟล์อื่นเรียกใช้ (`useData()`, `PlusIcon`) ต้องเหมือนเดิม จะได้ไม่ต้องแก้หลายสิบไฟล์พร้อมกัน |
| **ทดสอบก่อน push** | `build` + `lint` (0 error) + `test` และเปิดเบราว์เซอร์ดู ธีมมืด/สว่าง × จอคอม ≥1280px / มือถือ 375–430px |
| **ห้ามแตะ database จริงตอนทดสอบ** | จำลอง Supabase ด้วย Playwright `route()` ส่วน SQL ใช้ PGlite ในเครื่อง |

---

## 1. ที่ทำเสร็จแล้ว (อ้างอิง)

| # | งาน | เวอร์ชัน |
|---|---|---|
| 1 | RLS ตรวจแล้ว เพิ่ม DELETE policy | (Supabase) |
| 2 | Server-side write lock: โค้ดฝั่งแอปเสร็จแล้ว **รอรัน SQL** | 1.28.0 |
| 3 | ลบ `console.log` ที่ทำอีเมล/token รั่ว + กฎ lint `no-console` | 1.27.2 |
| 4 | เลิก track `.env` และ `*.tsbuildinfo` | 1.27.2 |
| 5 | ผู้ใช้ข้อมูลน้อย 2 คน: น่าจะแค่เข้ามาลองแล้วออก | — |
| 6 | วันที่เป็นเวลาท้องถิ่น ไม่ใช่ UTC | 1.28.0 |
| 11 / 11b | ระหว่างที่ข้อมูลยังไม่พร้อม Quick add และหน้าต่างๆ จะถูกปิดไว้ | 1.27.2 / 1.28.0 |
| 15 / 16 | ป้าย "No price yet" / AI import ไม่เดาประเภทสินทรัพย์ | 1.28.0 |
| 22 / 24 | CI บน GitHub / README + AGENTS.md | 1.27.2 / 1.28.0 |
| — | ข้อความแจ้งเตือนแสดงสตางค์ (฿45.50) | 1.28.0 |

---

## 2. ภาพรวมลำดับงาน

```
เฟส A  ไอคอน Lucide + หมวดหมู่ใหม่   ← ทำได้เลย ไม่ต้องรองานอื่น
  A1 ติดตั้ง + wrapper
  A2 ทะเบียนไอคอนหมวดหมู่ (registry) ── A3 ลบไอคอนซ้ำ ── A4 หมวดใหม่
  A5 หน้าเลือกไอคอน (กลุ่ม + ค้นหา)
  A6 เปลี่ยนไอคอนทั้งเว็บ ── A7 เทียบภาพก่อน/หลัง

เฟส B  Bug ที่รู้แล้ว
  B1 (#8 types จริง) ──▶ B2 (#7 ระบบ login)        ← #8 ต้องเสร็จก่อน
  B3 #14 · B4 #10 · B5 #12 · B6 #13 · B7 #9 · B8 #15b  (แต่ละข้อทำแยกกันได้)

เฟส C  Test   C1 #23 calc.ts + actions        ← ต้องเสร็จก่อนเฟส D

เฟส D  จัดโค้ด  D1 #19 → D2 #21 → D3 #17 → D4 #20 → (D5 #18 ถ้าแอปช้า)

เฟส E  งานฝั่ง Supabase / Vercel (คุณทำเอง)   E1 → E2 (+1 สัปดาห์) · E3 · E4
```

**ทำไมต้องเรียงแบบนี้**
- **A ทำก่อน:** ผู้ใช้เห็นผลทันที และไม่ต้องรองานอื่น
- **#8 ก่อน #7:** ถ้ายังใช้ type ปลอม ตอนเขียนระบบ login ใหม่ TypeScript จะจับ bug ให้ไม่ได้
- **C ก่อน D:** test เป็นตาข่ายรองรับ ถ้าย้ายโค้ดชิ้นใหญ่ (D3, D4) โดยไม่มี test จะไม่รู้ว่าทำอะไรพังไป
- **D2 (#21) ต้องสัมพันธ์กับ A2:** ทะเบียนไอคอนควรอยู่ที่ `src/components/icons/` ไม่ใช่ `modules/spend/` เพื่อไม่สร้างทิศทาง import ผิดเพิ่ม

---

## 3. เฟส A: ไอคอน Lucide + หมวดหมู่ใหม่ ✅ เสร็จแล้ว (`2381a2b`, `6622bab`)

> ผลจริง: ไอคอนหมวดหมู่ 108 ตัวใน 11 กลุ่ม ค้นหาได้ทั้งไทยและอังกฤษ ไม่มีไอคอนซ้ำ (มี test กันไว้) เพิ่มหมวด Desserts, Family มีไอคอนของตัวเอง ไอคอนทั้งแอปเป็น Lucide หมดแล้ว bundle ใหญ่ขึ้น +18 KB gzip
> หมวด "ลงทุน": **ตัดออกตามที่ตัดสินใจ** (เหลือแค่กลุ่มไอคอนการเงินให้เลือกใช้)
> ไอคอนที่วาดเอง: เลือกตามที่แนะนำทุกตัว (layout-grid, trending-up, calendar-sync, arrow-left-right, hand-coins, layers, tree-palm, receipt, receipt-text, coins, sparkles/sparkle)
> ผลข้างเคียง: Quick add มีหมวดเพิ่ม 1 อัน ทำให้ Family และ Other ไปอยู่ใต้ "+2 more" ถ้าต้องการ เรียงลำดับใหม่ได้ที่ Settings → Spend

### ทำไม
- หน้า New category มีไอคอนให้เลือกแค่ **29 ตัว** ผู้ใช้อยากได้มากกว่านี้
- ไอคอนในแอปเป็น SVG ที่เขียนเอง 68 ตัว (`src/components/icons.tsx` 475 บรรทัด + บางส่วนใน `categories.tsx`) ตอนวาดเลียนแบบ Lucide อยู่แล้ว
- ผลเทียบกับ `lucide-static` 0.460.0 (มี 1,539 ไอคอน):

| กลุ่ม | จำนวน | ตัวอย่าง |
|---|---|---|
| ตรงกับ Lucide ทุกเส้น | 20 | Car, Coffee, Lock, Settings, Plane, Shirt, Music |
| เกือบเหมือน (Lucide รุ่นเก่า / วาดเพี้ยนเล็กน้อย) | ~30 | Plus, Home, Trash, Search, Check, Gift |
| วาดเองเฉพาะแอปนี้ | ~18 | Dashboard, Portfolio, DCA, Cashflow, Dividend, Retirement, Debt |

- ⚠️ **ความหนาเส้นต่างกัน:** แอปใช้ `strokeWidth 1.6` แต่ Lucide ใช้ค่าเริ่มต้น `2` ถ้าไม่ตั้งค่า ไอคอนใหม่จะดูหนากว่าของเดิม

### A1. ติดตั้ง + wrapper
- `npm i lucide-react@<เวอร์ชันตายตัว>` ห้ามใช้ `^` เพราะ Lucide เคยเปลี่ยนชื่อไอคอนข้ามเวอร์ชัน
- สร้าง `src/components/icons/lucide.tsx` ให้ห่อไอคอนทุกตัวด้วยค่าเริ่มต้นของแอป: `strokeWidth={1.6}`, `aria-hidden`, รับ `className` แบบเดิม
- ❌ ห้ามใช้ `import * as icons` / `DynamicIcon` / `icons` object จะลากไอคอนทั้งหมดเข้า bundle (+หลายร้อย KB)
- ✅ import ตามชื่อทีละตัว (tree-shaking) ประมาณ 0.3–0.5 KB ต่อไอคอน

### A2. ทะเบียนไอคอนหมวดหมู่ (registry)
- ย้าย `CATEGORY_ICONS` ไปที่ `src/components/icons/categoryIcons.ts`
- โครงสร้างของแต่ละไอคอน: `{ key, Icon, group, keywords: ['ไทย', 'english'] }`
- **`key` คือชื่อย่อของเราเอง** (`'pets'`, `'dessert'`) ห้ามเก็บชื่อของ Lucide ลงข้อมูลผู้ใช้ ถ้า Lucide เปลี่ยนชื่อ เราแก้แค่ registry
- **key เดิม 29 ตัวต้องอยู่ครบ** (`food`, `coffee`, `car`, …, `tag`, `dots`) หมวดหมู่ที่ผู้ใช้สร้างไว้แล้วจะยังแสดงไอคอนเดิม ถ้า key ไม่รู้จัก ใช้ `tag` แทน (`categories.tsx` ทำแบบนี้อยู่แล้ว)
- กลุ่มไอคอน (ร่าง):

| กลุ่ม | ตัวอย่าง key → Lucide |
|---|---|
| อาหาร & เครื่องดื่ม | food→Utensils, coffee→Coffee, **dessert→CakeSlice**, icecream→IceCreamCone, cookie→Cookie, beer→Beer, pizza→Pizza |
| เดินทาง | car→Car, plane→Plane, bus→Bus, train→TrainFront, fuel→Fuel, bike→Bike, parking→SquareParking |
| บ้าน & บิล | home→House, receipt→Receipt, wifi→Wifi, phone→Smartphone, zap→Zap (ค่าไฟ), droplet→Droplet (ค่าน้ำ) |
| **ครอบครัว** | **family→Users**, baby→Baby, heartHandshake→HeartHandshake, school→School |
| สัตว์เลี้ยง | pets→PawPrint, dog→Dog, cat→Cat, fish→Fish |
| สุขภาพ & ความงาม | heart→HeartPulse, pill→Pill, stethoscope→Stethoscope, dumbbell→Dumbbell, scissors→Scissors |
| ช้อปปิ้ง | bag→ShoppingBag, cart→ShoppingCart, shirt→Shirt, gift→Gift |
| บันเทิง | film→Film, music→Music, game→Gamepad2, ticket→Ticket, book→BookOpen |
| **การเงิน & ลงทุน** | wallet→Wallet, coins→Coins, **invest→TrendingUp**, piggy→PiggyBank, landmark→Landmark, chart→ChartLine, bitcoin→Bitcoin |
| งาน & การศึกษา | briefcase→Briefcase, grad→GraduationCap, laptop→Laptop |
| อื่นๆ | sparkle→Sparkles, tag→Tag, dots→Ellipsis |

> ชื่อไอคอนของ Lucide ต้องตรวจกับเวอร์ชันที่ติดตั้งจริงอีกครั้งตอน A1 เพราะบางชื่ออาจต่างกันในแต่ละเวอร์ชัน

### A3. ลบไอคอนซ้ำ (จากภาพหน้า New category)
ตรวจจากโค้ดแล้ว พบว่าซ้ำจริง 3 คู่:

| ซ้ำ | หลักฐาน | แก้ |
|---|---|---|
| `coins` กับ `dividend` | `CoinsIcon` และ `DividendIcon` มี path **เหมือนกันทุกเส้น** (`icons.tsx:55` กับ `:188`) | `dividend` เป็นหมวดของระบบ (`system: true`) ไม่ควรอยู่ในตัวเลือกของผู้ใช้ ให้ซ่อนจากหน้าเลือก และให้ dividend ใช้ไอคอนของตัวเอง เช่น `HandCoins` |
| `sparkle` กับ `sparkles` | ทั้งคู่เป็นดาวประกาย ต่างกันแค่จุดเล็กมุมขวา | รวมเหลือ `sparkle` ตัวเดียว ให้ key `sparkles` ชี้ไปที่ไอคอนเดียวกัน (key เดิมต้องยังใช้ได้) |
| หมวด **Family** ใช้ไอคอน `gift` | ไอคอนเดียวกับ **Gift received** (`categories.tsx:311`, `:318`) | เปลี่ยน Family เป็น `family → Users` |

กันไม่ให้เกิดซ้ำอีก: เพิ่ม unit test ที่เช็กว่าไอคอนทุกตัวในหน้าเลือกเป็นคนละ component กัน และ key ไม่ซ้ำกัน

### A4. หมวดหมู่ใหม่
| หมวด | ประเภท | ไอคอน | คำค้น | สถานะ |
|---|---|---|---|---|
| **ของหวาน** (Desserts) | expense | `dessert → CakeSlice` | ของหวาน, ขนม, เค้ก, ไอติม, bakery | ✅ เพิ่มเป็นหมวดในตัวแอปได้เลย |
| **ครอบครัว** (Family) | expense | `family → Users` | ครอบครัว, พ่อแม่, ลูก | ✅ **มีอยู่แล้ว** แค่เปลี่ยนไอคอน (A3) |
| **ลงทุน** (Investing) | ? | `invest → TrendingUp` | ลงทุน, หุ้น, กองทุน, DCA | ⚠️ **ต้องตัดสินใจก่อน** ดูด้านล่าง |

**⚠️ เรื่อง "ลงทุน" ต้องตัดสินใจก่อนทำ**
- ฝั่ง Spend **นับเงินลงทุนให้อยู่แล้ว**: ทุกครั้งที่ confirm DCA หรือ Buy more ฝั่ง Invest แอปจะสร้างรายการแบบ **invested transfer** ขึ้นมาเอง (`src/modules/spend/invest.ts`) และ**ไม่นับเป็นรายจ่าย** เพราะเงินไม่ได้หายไป แค่ย้ายไปเป็นสินทรัพย์
- ถ้าทำ "ลงทุน" เป็นหมวด**รายจ่ายธรรมดา** จะเกิด 2 ปัญหา:
  1. ยอดใช้จ่ายและงบประมาณจะสูงเกินจริง เพราะนับเงินลงทุนเป็นค่าใช้จ่าย
  2. ถ้าบันทึกฝั่ง Invest ด้วย จะนับซ้ำ 2 ครั้ง
- ทางเลือก:

| ทาง | ทำอะไร | ข้อดี | ข้อเสีย |
|---|---|---|---|
| **ก. แค่ไอคอน** (แนะนำ) | เพิ่มไอคอนกลุ่ม "การเงิน & ลงทุน" ไว้ให้เลือกใช้ ไม่สร้างหมวดในตัวแอป | ไม่นับซ้ำ และไม่ทำให้ยอดเพี้ยน | ถ้าผู้ใช้สร้างหมวดลงทุนเองเป็นรายจ่าย ก็ยังนับเป็นรายจ่ายอยู่ดี |
| ข. หมวดพิเศษ | หมวด "Investing" ที่ไม่ถูกนับในยอดใช้จ่าย/งบประมาณ เหมือน transfer | บันทึกเงินลงทุนที่ทำนอกแอปได้ | ต้องแก้ logic สรุปยอด (`logic.ts`) และต้องมี test |
| ค. ให้ไปบันทึกฝั่ง Invest | ไม่ทำหมวด แต่ทำปุ่มลัดไปหน้า Buy more | ข้อมูลอยู่ที่เดียว ไม่ซ้ำ | ทำงานเพิ่ม |

- การเพิ่มหมวดในตัวแอป: ผู้ใช้เดิมจะเห็นหมวดใหม่ทันทีหลังอัปเดต ต้องเช็กว่าไม่ชนกับหมวดที่ผู้ใช้สร้างไว้เองแล้วชื่อเดียวกัน (ชื่อซ้ำเตือนได้ แต่ห้ามรวมหรือลบของผู้ใช้เอง)

### A5. หน้าเลือกไอคอน (`src/modules/spend/CategorySheet.tsx`)
- จากตารางเดียว 29 ช่อง เปลี่ยนเป็น**หัวข้อตามกลุ่ม** (A2) และมี**ช่องค้นหา**ด้านบน ค้นได้ทั้งไทยและอังกฤษ เช่นพิมพ์ "หมา" แล้วเจอ PawPrint และ Dog
- ซ่อนไอคอนของหมวดระบบ (`dividend`)
- ไอคอนที่เลือกอยู่ยังเห็นได้ แม้จะไม่อยู่ในผลค้นหา
- ทดสอบที่ iPhone 13 ว่าปุ่มไอคอนกดง่าย (≥ 40px) และไม่มีแถบเลื่อนแนวนอน

### A6. เปลี่ยนไอคอนทั้งเว็บ
- ไฟล์ `src/components/icons.tsx` ยัง export ชื่อเดิม (`PlusIcon`, `TrashIcon`, …) แต่ข้างในเปลี่ยนไปใช้ Lucide ผ่าน wrapper (A1)
- **46 ไฟล์ที่ import ไอคอนอยู่ไม่ต้องแก้**
- ไอคอน 20 ตัวที่ตรงทุกเส้น: เปลี่ยนได้ทันที
- ~30 ตัวที่เกือบเหมือน: เปลี่ยนได้ เห็นความต่างเล็กน้อย
- ~18 ตัวที่วาดเอง: ทำหน้าเทียบภาพเดิม/ใหม่ (artifact หรือ storybook-lite) ให้คุณเลือกทีละตัว **ถ้าไม่มีตัวไหนสื่อความหมายเดียวกัน ให้เก็บของเดิมไว้** แต่ปรับเส้นให้เป็น 1.6 และ stroke-cap/join เดียวกัน
- ลบ SVG ที่ไม่ใช้แล้ว (ต้องขออนุญาตก่อนลบไฟล์ ตาม AGENTS.md)

### A7. ตรวจผล
- ถ่าย screenshot ก่อน/หลัง ทุกหน้าหลัก: Spend Home, Transactions, Accounts, Portfolio, Dashboard, DCA, Settings และทุก sheet
- เทียบทั้งธีมมืด/สว่าง × จอคอม 1280px / iPhone 13
- เช็กขนาด bundle ก่อน/หลัง (`npm run build`) ไม่ควรเพิ่มเกิน ~20 KB (gzip)

**เกณฑ์ว่าเฟส A เสร็จ:** หน้าเลือกไอคอนมี ≥ 80 ตัวแบ่งตามกลุ่ม ค้นหาภาษาไทยได้ ไม่มีไอคอนซ้ำ (มี test กัน) หมวดเดิมแสดงไอคอนเดิม Family มีไอคอนของตัวเอง มีหมวด Desserts และไอคอนทั้งแอปมาจากแหล่งเดียว

---

## 4. เฟส B: Bug ที่รู้แล้ว

| # | งาน | วิธีแก้ (ร่าง) | ต้องรอ |
|---|---|---|---|
| ~~B1 · 8~~ ✅ | `src/vite-env.d.ts` ประกาศ type ปลอมของ `@supabase/supabase-js` ทำให้ type จริงถูกซ่อน | **เสร็จแล้ว (`a881b12`):** ลบ stub แล้วโค้ดผ่าน type จริงได้เลย ไม่ต้องแก้อะไรเพิ่ม | — |
| ~~B2 · 7~~ ✅ | ระบบ login เขียนเอง: ถอด JWT จาก URL hash และ hardcode `sb-dgxjifbsdpggoyyzhpeb-auth-token` | **เสร็จแล้ว (`a079a8b`):** ใช้ `signInWithOAuth` + `detectSessionInUrl` (implicit flow เหมือนเดิม) ลบตัวถอด JWT และ REST fallback "ไม่มีแถว" นับเป็นผู้ใช้ใหม่เฉพาะตอนถามด้วย session ของผู้ใช้ session เก่าใช้ต่อได้ (ทดสอบด้วย Playwright route() รวมกรณีหมดอายุแล้ว refresh) ยกเลิกที่ Google จะเห็น "Sign-in failed" | — |
| ~~B3 · 14~~ ✅ | ราคาทองใน cache เสียแล้วกลายเป็น NaN (`useLivePrices.ts`) | **เสร็จแล้ว (`e36eaf3`):** อ่าน/เขียน cache ผ่าน `lib/priceCache.ts` รับแค่ตัวเลขบวกจำกัด ค่าเสียถูกลบทิ้ง และไม่เขียนค่าเสียลงไปอีก ราคา BTC/หุ้น/ทองที่ดึงมาก็ตรวจก่อนบันทึก ราคาทองสำรองไม่ใช้ราคาทุนที่ใส่แทน | — |
| ~~B4 · 10~~ ✅ | side effect ระหว่าง render: `syncCategories()` ใน body ของ DataProvider และ `setErrorMsg` ใน `useMemo` ของ AiImportModal | **เสร็จแล้ว (`8f90aa3`):** AiImportModal ล้าง error ตอนข้อความเปลี่ยนแทน ส่วน `syncCategories` **คงไว้ใน render** เพราะลูกๆ อ่านหมวดระหว่าง render ถ้าย้ายไป effect จะเห็นรายการเก่า 1 รอบ (เป็น cache ที่ key ด้วย settings อยู่แล้ว) และเพิ่ม `useLayoutEffect` sync จากข้อมูลที่ commit แล้ว กัน render ที่ถูกทิ้ง | — |
| B5 · 12 ⚠️ | เมนู ··· ใน Portfolio คลิกด้วยเมาส์ไม่ได้ตอนจอแคบ (แตะนิ้วได้) | **ยังทำซ้ำไม่ได้:** Playwright 390/768/900/1024/1280px × เมาส์/แตะ ทั้งเมนูรายการและเมนูที่เก็บ (BTC/ทอง) และแบบมี scrollbar เปิดได้และกดเมนูได้ทุกกรณี ต้องการข้อมูลเพิ่ม: เบราว์เซอร์/OS, ความกว้างจอ, เมนูไหน, กดแล้วเกิดอะไร<br>**ลองซ้ำรอบ 2 (1.29.1, โหมด Demo):** คลิกเมาส์จริงในเบราว์เซอร์ที่ 420/800/1280px เปิดเมนูและกด Edit ได้ปกติ มีครั้งเดียวที่เมนูไม่ขึ้น คือคลิกระหว่างที่หน้ายังเลื่อนอยู่ (เมนูปิดตัวเองเมื่อมี event `scroll`) แต่เกิดได้ทุกความกว้างจอ ไม่ใช่เฉพาะจอแคบ จึงยังไม่แก้ ถ้าอาการตรงกับ "คลิกทันทีหลังเลื่อนหน้าด้วยล้อเมาส์/ทัชแพด" แก้ได้โดยให้เมนูไม่ปิดจาก scroll ที่เกิดภายใน ~150ms หลังเปิด | ข้อมูลจากคุณ |
| ~~B6 · 13~~ ✅ | Restore backup แล้ว save ซ้ำ 2 รอบ (ไม่อันตราย) | **เสร็จแล้ว (`dc2dea8`):** `pushNow` ตั้ง `lastSynced` ทันที และ timer เช็กซ้ำก่อน save ถ้า save แบบ force ล้มเหลว จะลองอีกครั้งแบบปกติ (มี lock) เพราะ save ครั้งที่ 2 เดิมทำหน้าที่ retry โดยบังเอิญ | — |
| ~~B7 · 9~~ ✅ | โหมด Guest เป็นโค้ดที่ไม่มีใครเรียก (`loginAsGuest`) และ Sidebar เช็ก id ผิด (`guest-local`) | **เสร็จแล้ว (`d31e9d6`): ลบออกตามที่ตัดสินใจ** เอา `loginAsGuest`, กรณี `guest-user-local` ใน `useCloudSync.ts`/`DataContext.tsx` และ key `guestData` ออก Sidebar เดิมแสดง "User / Cloud Sync" เสมออยู่แล้ว (เช็ก id ไม่เคยตรง) ตอนนี้เขียนแบบนั้นตรงๆ ลองเข้า/ออกโหมด Demo แล้วปกติ | — |
| ~~B8 · 15b~~ ✅ | ฟอร์มบันทึก gift (Buy more) คิดมูลค่าจาก `holding.price` แม้จะเป็นราคาทุนที่ใส่แทน | **เสร็จแล้ว (`0fe4ffa`):** เติมมูลค่าให้เฉพาะเมื่อมีราคาจริง ถ้าไม่มี ช่องว่างให้กรอกเอง และ hint บอก "No price yet" | — |

---

## 5. เฟส C: Test (ตาข่ายก่อน refactor)

| # | งาน | ขอบเขต |
|---|---|---|
| ~~C1 · 23~~ ✅ | test ให้ `src/lib/calc.ts` (~1,300 บรรทัด ตอนนี้ test แค่บางฟังก์ชัน) | **เสร็จแล้ว (`5bacf66`):** `calc.test.ts` 45 test: holdingMetrics, applyBuy, allocations, findMatchingHolding, ทอง/BTC, รอบ DCA ทั้ง daily/weekly/monthly (วันที่ 31, ข้ามปี), sortDcaPlans, ดอกเบี้ยเงินสด (มี/ไม่มี USD rate), หนี้, netWorth, สถานะครบกำหนดหนี้ |
| ~~C2 · 23~~ ✅ | test ให้ actions อีก 34 ตัวใน `src/store/actions/` | **เสร็จแล้ว (`5564a92`):** ทุก action ใน cash/dca/dividends/holdingLogs/holdings/liabilities/planning มี test รวมถึง undo แบบไป-กลับ (ขาย, ซื้อเพิ่ม, ย้ายที่เก็บ, ปันผล, ยืนยัน DCA, แก้บัญชีเงินสดแล้วมีรายการ Spend ตามมา) |
| C3 | (ไม่บังคับ) component test | ไม่ได้ทำ: ไม่บังคับ และต้องเพิ่ม jsdom + Testing Library |

**เกณฑ์ว่าเสร็จ:** ฟังก์ชันทุกตัวที่เฟส D จะย้าย มี test ครอบอยู่ก่อนย้าย

---

## 6. เฟส D: จัดโครงสร้างโค้ด

| ลำดับ | # | งาน | หมายเหตุ |
|---|---|---|---|
| ~~D1~~ ✅ | 19 | รวม `newId` ที่ซ้ำอยู่ 6 ที่ให้เหลือที่เดียว, เพิ่ม `lib/money.ts`, รวม localStorage keys ไว้ใน `lib/storageKeys.ts` | **เสร็จแล้ว (`7b4e0d3`):** `lib/id.ts` (`store/migrate` ยัง export `newId` ชื่อเดิม), `roundMoney` ใช้แทนการปัดเศษใน store และ logic ของ Spend (ฟอร์มใหญ่ HoldingForm/BuyMoreForm/SellHoldingModal ยังใช้ `toFixed(2)` อยู่ จะเปลี่ยนตอนแตกไฟล์ใน D4) และ `STORAGE_KEYS` ครบทุก key โดยค่าเดิมไม่เปลี่ยน การตั้งค่าที่บันทึกไว้จึงยังอ่านได้ |
| ~~D2~~ ✅ | 21 | แก้ทิศทาง import: `lib/` และ `components/` ห้าม import จาก `modules/spend` | **เสร็จแล้ว (`a49aa8f`):** ส่วนที่ประกอบ Spend กับ Invest เข้าด้วยกัน (Layout, Sidebar, CommandPalette) ย้ายไป `src/app/`, path ไป `lib/routes`, `useSpendSide` ไป `hooks/side`, tones ไป `components/tones` (`modules/spend/side` และ `tones` ยัง export ชื่อเดิม), `SwitchVisual` ไป `components/ui`, ข้อมูล Demo (`seed.ts`) ไป `store/` และมีกฎ eslint `no-restricted-imports` ครอบ `lib/`, `hooks/`, `components/` ตรวจในเบราว์เซอร์แล้ว: 1280px สว่าง, 375px มืด, Command palette, Quick add, Settings → Spend |
| ~~D3~~ ✅ | 17 | ย้ายส่วนที่เหลือออกจาก `DataContext.tsx`: `confirmDcaBuy` (~365 บรรทัด), `recordDividend`, import/export | **เสร็จแล้ว (`2726edc`):** `confirmDcaBuy` → `actions/dca.ts`, `recordDividend` → `actions/dividends.ts`, AI/JSON import → `actions/importPortfolio.ts` (`prepareImport` + `applyImport`), ไฟล์ backup → `store/backup.ts` และ `useData()` เหมือนเดิม DataContext เหลือ 489 บรรทัด (จาก 1,190) differential: ใช้สคริปต์ยกโค้ดออกมาทั้งบรรทัด แล้วเทียบกับไฟล์เดิมว่าทุกบรรทัดตรงกัน ต่างแค่การเยื้อง (แทนการเทียบ JSON ที่ export เพราะเทียบ build เก่ากับใหม่ไม่ได้โดยไม่แตะข้อมูลจริง) มี test ใหม่ 22 ตัว และลองยืนยัน DCA ทองในโหมด Demo ผ่าน |
| ~~D4~~ ✅ | 20 | แตกไฟล์ใหญ่ (`HoldingLogs`, `Portfolio`, `HoldingForm`) และรวม CSV exporter 3 ตัวเป็นตัวเดียว | **เสร็จแล้ว:** CSV ใช้ `lib/csv.ts` ตัวเดียว (`21c779a`; ไฟล์ของ Spend ได้ byte เดิมทุกตัว ส่วนของ Invest ตอนนี้มีบรรทัดว่างท้ายไฟล์และไม่ตัดช่องว่างในค่า) · HoldingLogs 2,336 → 1,070 บรรทัด (`29ac145`: `holdingLogs/logMeta.ts`, `holdingLogs/logDetails.tsx`) · Portfolio 1,995 → 1,526 (`a74d706`: `portfolio/HoldingMenus.tsx`, `portfolio/portfolioCsv.ts`) · HoldingForm 1,798 → 1,554 (`8422909`: `holdingForm/DividendSection.tsx`) โค้ดที่ย้ายยกมาทั้งบรรทัด แต่ละไฟล์ทดสอบในเบราว์เซอร์แล้ว (สว่าง/มืด, จอคอม/390px) ทำทีละ commit ไม่ใช่ทีละ PR เพราะงานนี้ยังไม่ push<br>ยังแตกต่อได้ถ้าต้องการ: `renderHoldingRow` ใน Portfolio (~320 บรรทัด), ตาราง/timeline ใน HoldingLogs, ฟังก์ชัน save และฟอร์มแยกตามประเภทสินทรัพย์ใน HoldingForm (ต้องมี test ของ save ก่อน) |
| D5 | 18 | แยก context เป็น data และ actions | **ทำเมื่อแอปช้าเท่านั้น** วัดด้วย React Profiler ก่อน<br>**⏸ ยังไม่ทำ (เงื่อนไขยังไม่เกิด):** ไม่มีรายงานว่าแอปช้า และตอนลองในโหมด Demo ทุกหน้าตอบสนองปกติ ถ้าวันหนึ่งรู้สึกช้า ให้วัดด้วย Profiler ก่อนแล้วค่อยทำ |

---

## 7. เฟส E: งานฝั่ง Supabase / Vercel (คุณทำเอง)

> **⏸ ทุกข้อรอคุณทำเอง:** เป็นงานใน Supabase dashboard / Vercel ซึ่ง AI ไม่แตะ (AGENTS.md: SQL รันด้วยมือ และห้ามแตะ database จริง) ตอนนี้ main คือ 1.29.1 แล้ว เงื่อนไขของ E1 จึงอ่านเป็น "หลังเช็กว่าสถานะขึ้น Synced บนเวอร์ชันล่าสุด"

| # | งาน | เมื่อไหร่ | วิธี |
|---|---|---|---|
| E1 | รัน write lock **Step 1** (lenient) | **ตอนนี้** หลังเช็กว่าสถานะขึ้น Synced บน 1.28.0 แล้ว | Supabase → SQL Editor → `supabase/sql/user_data_write_lock.sql` ส่วน Step 1 แล้วเช็ก Synced อีกรอบ |
| E2 | เปลี่ยนเป็น **strict mode** | ~1 สัปดาห์หลัง E1 | เปลี่ยน `strict_mode` เป็น `true` แล้วรัน Step 1 ซ้ำ ⚠️ หลังจากนี้แก้ข้อมูลด้วยมือใน SQL Editor ไม่ได้ ต้องรัน Undo ก่อน |
| E3 · 25 | ลบ `backup.user_data_20261017` | เมื่อ 1.28.x ใช้งานนิ่ง ≥ 2 สัปดาห์ | `drop table backup.user_data_20261017;` |
| E4 | ตัวแปร Preview ใน Vercel (ไม่บังคับ) | เมื่ออยากใช้ลิงก์ preview | ลบตัวแปรแบบ Secret แล้วสร้างใหม่แบบ **Config** ให้ใช้ได้ทั้ง Production และ Preview |

---

## 8. เรื่องที่ต้องตัดสินใจ

| เรื่อง | ทางเลือก | แนะนำ |
|---|---|---|
| ~~หมวด "ลงทุน" (A4)~~ | ตัดสินใจแล้ว: ไม่ทำ | — |
| ~~ไอคอนที่วาดเอง (A6)~~ | ตัดสินใจแล้ว: ใช้ตามที่แนะนำ | — |
| ~~โหมด Guest (B7)~~ | ตัดสินใจแล้ว: ลบ | — |

---

## 9. ความเสี่ยง

| ความเสี่ยง | ป้องกัน |
|---|---|
| Lucide เปลี่ยนชื่อไอคอนในเวอร์ชันใหม่ | กำหนดเวอร์ชันตายตัว และให้ key ของเราเป็นตัวแปลอีกชั้น (A2) |
| bundle ใหญ่ขึ้นจาก import ทั้งชุด | import ตามชื่อเท่านั้น และเทียบขนาด bundle ใน A7 |
| หมวดเดิมของผู้ใช้แสดงผิดไอคอน | key เดิม 29 ตัวต้องอยู่ครบ + test ว่าทุก key เดิมมีไอคอน |
| ระบบ login ใหม่ (B2) ทำให้ผู้ใช้ถูก logout | ทดสอบ flow ด้วย Playwright route() ก่อน และแจ้งผู้ใช้ว่าอาจต้อง login ใหม่ครั้งเดียว |
| ย้าย `confirmDcaBuy` แล้วผลลัพธ์เปลี่ยน | test ใน C1/C2 ก่อน และ differential test (export JSON แล้วเทียบ) |

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Keep } from './Keep'

/** Plain facts about the data, in Thai. Every line must stay true of the code: update it when storage or a
 *  third-party call changes (lib/prices.ts, store/useCloudSync.ts, index.html fonts). */
const SECTIONS: { title: string; body: ReactNode }[] = [
  {
    title: 'เก็บข้อมูลอะไรบ้าง',
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>ข้อมูลบัญชี: อีเมล และถ้าเข้าด้วย Google จะมีชื่อกับรูปโปรไฟล์จาก Google ด้วย</li>
        <li>ข้อมูลที่คุณกรอก: รายการรับจ่าย บัญชีและบัตร งบประมาณ บิล หนี้ พอร์ตลงทุน แผน DCA ปันผล และการตั้งค่า</li>
        <li>ในเบราว์เซอร์ของคุณ: การตั้งค่าบางอย่างของเครื่องนั้น เช่นธีม และราคาที่ดึงมาล่าสุด</li>
        <li>ไม่มีระบบเก็บสถิติการใช้งาน ไม่มีโฆษณา และไม่มี cookie ติดตาม</li>
      </ul>
    ),
  },
  {
    title: 'เก็บที่ไหน',
    body: (
      <p>
        ข้อมูลที่คุณกรอกเก็บบน Supabase (ฐานข้อมูลบนคลาวด์) บัญชีละหนึ่งแถว และเปิด Row Level Security ไว้
        แต่ละบัญชีจึงอ่านและแก้ได้แค่แถวของตัวเอง ข้อมูลส่งผ่าน HTTPS แต่ไม่ได้เข้ารหัสจากเครื่องของคุณก่อนส่ง
      </p>
    ),
  },
  {
    title: 'ใครเห็นได้บ้าง',
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>คุณ</li>
        <li>
          ผู้ดูแลระบบ (คนที่ส่งคำเชิญให้คุณ) เข้าระบบหลังบ้านของ Supabase ได้ จึงเห็นข้อมูลทุกบัญชีได้ในทางเทคนิค
          เราบอกไว้ตรงนี้เพื่อให้คุณตัดสินใจเองว่าจะกรอกอะไรลงไป
        </li>
      </ul>
    ),
  },
  {
    title: 'บริการภายนอกที่แอปใช้',
    body: (
      <>
        <ul className="list-disc space-y-2 pl-5">
          <li>Supabase: เก็บข้อมูล ระบบล็อกอิน และส่งอีเมลรหัสเข้าสู่ระบบ</li>
          <li>Google: เข้าสู่ระบบ (ถ้าคุณเลือก) และฟอนต์ของหน้าเว็บ ซึ่ง Google จะเห็น IP ของคุณตอนโหลดฟอนต์</li>
          <li>Vercel: โฮสต์หน้าเว็บนี้</li>
          <li>ราคาหุ้น: ส่งแค่ชื่อหุ้น (เช่น AAPL) หรือคำที่พิมพ์ค้นหา ไปที่ Edge Function ของ Supabase ซึ่งดึงราคาจาก Yahoo Finance ต่อ</li>
          <li>ราคา<Keep>คริปโต</Keep>และอัตรา USD/THB: เบราว์เซอร์ของคุณขอราคาจาก Binance และ Binance TH โดยตรง ส่งไปแค่ชื่อเหรียญ</li>
        </ul>
        <p className="mt-3">บริการเหล่านี้ไม่ได้รับยอดเงินหรือรายการของคุณ</p>
      </>
    ),
  },
  {
    title: 'ลบข้อมูล',
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>
          ลบข้อมูลทั้งหมด: ในแอปไปที่ Settings → Data and backup → Reset everything ระบบจะลบข้อมูลของคุณใน Supabase
          แล้วออกจากระบบ ย้อนกลับไม่ได้ ถ้าอยากเก็บไว้ ให้กด Export ในหน้าเดียวกันก่อน
        </li>
        <li>ลบบัญชี (อีเมลที่ใช้เข้าสู่ระบบ): ลบเองในแอปไม่ได้ ขอให้ผู้ดูแลระบบลบให้</li>
        <li>โหมด Demo ไม่บันทึกอะไรเลย ปิดหน้าแล้วข้อมูลตัวอย่างหายไป</li>
      </ul>
    ),
  },
  {
    title: 'ติดต่อ',
    body: <p>ติดต่อผู้ดูแลระบบ คือคนที่ส่งคำเชิญให้คุณ</p>,
  },
]

/** /privacy: opens with or without signing in. Light only, like the landing page (landing-* tokens). */
export function Privacy() {
  return (
    <div lang="th" className="min-h-dvh bg-landing-canvas font-sans text-landing-ink">
      <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-5 sm:px-8">
        <header className="flex items-center justify-between gap-3 py-5 sm:py-7">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="" width={36} height={36} className="h-8 w-8 sm:h-9 sm:w-9 object-contain" />
            <span className="font-display text-xl sm:text-2xl font-extrabold tracking-tight">Spendiary</span>
          </Link>
          <Link to="/" className="text-sm font-semibold text-landing-ink-soft hover:text-landing-ink hover:underline">
            กลับหน้าแรก
          </Link>
        </header>

        <main className="flex-1 pb-16 pt-4 sm:pt-8">
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold leading-snug tracking-tight">ความเป็นส่วนตัว</h1>
          <p className="mt-3 text-base leading-relaxed text-landing-ink-muted">
            Spendiary เปิดให้ใช้เฉพาะคนที่ได้รับเชิญ หน้านี้บอกตรงๆ ว่าเก็บข้อมูลอะไร เก็บที่ไหน และใคร<Keep>เห็นได้บ้าง</Keep>
          </p>
          <p className="mt-1 text-sm text-landing-ink-faint">อัปเดตล่าสุด 26 ตุลาคม 2026</p>

          <div className="mt-10 space-y-9">
            {SECTIONS.map((s) => (
              <section key={s.title}>
                <h2 className="font-display text-lg font-extrabold">{s.title}</h2>
                <div className="mt-2 text-base leading-relaxed text-landing-ink-soft">{s.body}</div>
              </section>
            ))}
          </div>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-landing-line py-6 text-xs text-landing-ink-muted">
          <p>
            Spendiary · <span className="tnum">v{__APP_VERSION__}</span>
          </p>
          <p>Built by bbrightns</p>
        </footer>
      </div>
    </div>
  )
}

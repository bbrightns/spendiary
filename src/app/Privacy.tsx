import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Keep } from './Keep'
import { LandingFooter } from './LandingFooter'

/** Plain facts about the data, in Thai. Every line must stay true of the code: update it when storage or a
 *  third-party call changes (lib/prices.ts, store/useCloudSync.ts, index.html fonts). */
const SECTIONS: { title: string; body: ReactNode }[] = [
  {
    title: 'เราเก็บข้อมูลอะไรบ้าง',
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>ข้อมูลบัญชี ได้แก่อีเมล และถ้าเข้าสู่ระบบด้วย Google จะมีชื่อและรูปโปรไฟล์จาก Google ด้วย</li>
        <li>ข้อมูลที่คุณบันทึกในแอป เช่น รายรับรายจ่าย บัญชีและบัตร งบประมาณ บิล หนี้ พอร์ตลงทุน แผน DCA เงินปันผล และการตั้งค่า</li>
        <li>การตั้งค่าบางอย่างของแต่ละเครื่อง เช่นธีม และราคาล่าสุดที่ดึงมา ซึ่งเก็บไว้ในเบราว์เซอร์ของคุณเอง</li>
        <li>เราไม่เก็บสถิติการใช้งาน ไม่มีโฆษณา และไม่ใช้ cookie ติดตาม</li>
      </ul>
    ),
  },
  {
    title: 'ข้อมูลเก็บไว้ที่ไหน',
    body: (
      <p>
        ข้อมูลที่คุณบันทึกเก็บไว้บน Supabase ซึ่งเป็นฐานข้อมูลบนคลาวด์ โดยแยกเป็นหนึ่งแถวต่อหนึ่งบัญชี และเปิดใช้ Row Level
        Security ไว้ แต่ละบัญชีจึงอ่านและแก้ไขได้เฉพาะข้อมูลของตัวเอง ข้อมูลถูกส่งผ่าน HTTPS
        แต่ไม่ได้ถูกเข้ารหัสในเครื่องของคุณก่อนส่ง
      </p>
    ),
  },
  {
    title: 'ใครเข้าถึงข้อมูลได้บ้าง',
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>ตัวคุณเอง</li>
        <li>
          ผู้ดูแลระบบ (คนที่ส่งคำเชิญให้คุณ) ซึ่งเข้าระบบหลังบ้านของ Supabase ได้ จึงเห็นข้อมูลของทุกบัญชีได้ในทางเทคนิค
          เราแจ้งไว้ตรงนี้เพื่อให้คุณเลือกเองว่าจะบันทึกอะไรลงในแอป
        </li>
      </ul>
    ),
  },
  {
    title: 'บริการภายนอกที่แอปใช้',
    body: (
      <>
        <ul className="list-disc space-y-2 pl-5">
          <li>Supabase สำหรับเก็บข้อมูล ระบบเข้าสู่ระบบ และส่งรหัสทางอีเมล</li>
          <li>Google สำหรับเข้าสู่ระบบ (ถ้าคุณเลือกใช้) และฟอนต์บนหน้าเว็บ ซึ่ง Google จะเห็น IP ของคุณตอนโหลดฟอนต์</li>
          <li>Vercel สำหรับโฮสต์หน้าเว็บ</li>
          <li>ราคาหุ้น แอปส่งไปเพียงชื่อหุ้น (เช่น AAPL) หรือคำที่คุณค้นหา ไปที่ Edge Function ของ Supabase ซึ่งดึงราคาจาก Yahoo Finance อีกต่อหนึ่ง</li>
          <li>ราคา<Keep>คริปโต</Keep>และอัตรา USD/THB เบราว์เซอร์ของคุณขอราคาจาก Binance และ Binance TH โดยตรง และส่งไปเพียงชื่อเหรียญ</li>
        </ul>
        <p className="mt-3">ไม่มีบริการใดได้รับยอดเงินหรือรายการของคุณ</p>
      </>
    ),
  },
  {
    title: 'การลบข้อมูล',
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>
          ลบข้อมูลทั้งหมดได้เองในแอป ที่ Settings → Data and backup → Reset everything ระบบจะลบข้อมูลของคุณบน Supabase
          แล้วออกจากระบบให้ ซึ่งกู้คืนไม่ได้ ถ้าต้องการเก็บสำรองไว้ ให้กด Export ในหน้าเดียวกันก่อน
        </li>
        <li>ส่วนบัญชีที่ใช้เข้าสู่ระบบ คุณลบเองในแอปไม่ได้ แจ้งผู้ดูแลระบบให้ลบให้ได้</li>
        <li>โหมดทดลองใช้งานไม่บันทึกข้อมูลใดๆ เมื่อปิดหน้า ข้อมูลตัวอย่างจะหายไปทันที</li>
      </ul>
    ),
  },
  {
    title: 'ติดต่อเรา',
    body: <p>หากมีคำถาม ติดต่อผู้ดูแลระบบ ซึ่งก็คือคนที่ส่งคำเชิญให้คุณ</p>,
  },
]

/** /privacy: opens with or without signing in. Light only, like the landing page (landing-* tokens). */
export function Privacy() {
  return (
    <div lang="th" className="landing-canvas-bg min-h-dvh font-sans text-landing-ink">
      <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-5 sm:px-8">
        <header className="flex items-center justify-between gap-3 py-5 sm:py-7">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="" width={36} height={36} className="h-8 w-8 sm:h-9 sm:w-9 object-contain" />
            <span className="font-display text-xl sm:text-2xl font-extrabold tracking-tight">Spendiary</span>
          </Link>
          <Link to="/" className="text-sm font-semibold text-landing-ink-soft hover:text-landing-ink hover:underline">
            ← กลับหน้าแรก
          </Link>
        </header>

        <main className="flex-1 pb-16 pt-4 sm:pt-8">
          <h1 className="font-display text-3xl sm:text-5xl font-extrabold leading-tight tracking-tight">นโยบายความเป็นส่วนตัว</h1>
          <p className="mt-4 text-base sm:text-lg leading-relaxed text-landing-ink-muted">
            Spendiary เปิดให้ใช้เฉพาะผู้ได้รับเชิญ หน้านี้อธิบายว่าเราเก็บข้อมูลอะไร เก็บไว้ที่ไหน และใคร<Keep>เข้าถึงได้บ้าง</Keep>
          </p>
          <p className="mt-2 text-sm text-landing-ink-faint">อัปเดตล่าสุด 26 ตุลาคม 2026</p>

          <div className="mt-10 divide-y divide-landing-line rounded-[28px] border border-landing-surface bg-landing-glass px-6 shadow-[var(--shadow-landing-soft)] sm:px-10">
            {SECTIONS.map((s, i) => (
              <section key={s.title} className="flex gap-4 py-7 sm:gap-5">
                <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-landing-lavender text-sm font-bold text-landing-lavender-ink tnum">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-lg sm:text-xl font-extrabold leading-8">{s.title}</h2>
                  <div className="mt-2 text-base leading-relaxed text-landing-ink-soft">{s.body}</div>
                </div>
              </section>
            ))}
          </div>
        </main>

        <LandingFooter />
      </div>
    </div>
  )
}

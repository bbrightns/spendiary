import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../store/DataContext'
import { FlaskIcon, LockClosedIcon, RetirementIcon, SparkleIcon, TrendUpIcon, WalletIcon } from '../components/icons'
import { EmailCodeSignIn } from './EmailCodeSignIn'
import { Keep } from './Keep'
import { LandingFooter } from './LandingFooter'

/** What the app covers, one card each. Every line must stay true of the app. */
const FEATURES: { icon: ReactNode; tile: string; title: string; body: ReactNode }[] = [
  {
    icon: <WalletIcon className="h-5 w-5" />,
    tile: 'bg-landing-mint text-landing-mint-ink',
    title: 'รายรับรายจ่าย',
    body: <>บันทึกรายจ่าย จัดการบัตรเครดิตและบิล วางแผน<Keep>งบประมาณ</Keep> และ<Keep>ติดตามหนี้</Keep></>,
  },
  {
    icon: <TrendUpIcon className="h-5 w-5" />,
    tile: 'bg-landing-sky text-landing-sky-ink',
    title: 'การลงทุน',
    body: <>ติดตามหุ้นสหรัฐฯ กองทุน <Keep>คริปโต</Keep> วางแผนลงทุน<Keep>รายเดือน (DCA)</Keep> และเงินปันผล</>,
  },
  {
    icon: <RetirementIcon className="h-5 w-5" />,
    tile: 'bg-landing-lavender text-landing-lavender-ink',
    title: 'แผนเกษียณ',
    body: <>ดูว่าเกษียณได้เร็วสุดตอนอายุเท่าไหร่ และเงินเก็บไปถึงเป้าหมายแล้วแค่ไหน</>,
  },
]

const glass = 'border border-landing-surface bg-landing-glass shadow-[var(--shadow-landing-soft)] backdrop-blur-xl'

/** The signed-out page: one centred column, light only (landing-* tokens and .landing-canvas-bg never flip with .dark). */
export function Landing() {
  const { loginWithGoogle, loginAsTestMode, authError } = useData()

  return (
    // lang="th" lets the browser break Thai lines between words instead of mid-word
    <div lang="th" className="landing-canvas-bg min-h-dvh font-sans text-landing-ink">
      <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-5 sm:px-8">
        <header className="flex items-center py-5 sm:py-7">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="" width={36} height={36} className="h-8 w-8 sm:h-9 sm:w-9 object-contain" />
            <span className="font-display text-xl sm:text-2xl font-extrabold tracking-tight">spendiary</span>
          </div>
        </header>

        <main className="flex flex-1 flex-col items-center pb-16 pt-2 sm:pt-6 text-center">
          <span className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs sm:text-sm font-medium text-landing-ink-soft ${glass}`}>
            <SparkleIcon className="h-4 w-4 text-landing-brand" />
            บันทึกรายจ่าย · ติดตามพอร์ต · วางแผนเกษียณ
          </span>

          <h1 className="mt-6 font-display text-4xl sm:text-6xl font-extrabold leading-tight tracking-tight">
            <Keep>จัดการรายจ่าย</Keep> <Keep>วางแผนลงทุน</Keep>
            <span className="mt-1 block text-landing-brand">ครบในแอปเดียว</span>
          </h1>

          <p className="mt-5 max-w-2xl text-base sm:text-lg leading-relaxed text-landing-ink-muted">
            ติดตามรายจ่าย เช็กวันครบกำหนดชำระบัตรและบิล พร้อมดูภาพรวมพอร์ตหุ้น กองทุน และ<Keep>คริปโต</Keep>
            ได้<Keep>ในที่เดียว</Keep> ทุกยอดแปลงเป็นเงินบาทด้วย<Keep>อัตราแลกเปลี่ยนล่าสุด</Keep>
          </p>

          <div className={`mt-9 w-full max-w-md rounded-[28px] p-6 sm:p-8 ${glass}`}>
            <h2 className="font-display text-2xl font-extrabold tracking-tight">เข้าสู่ระบบ</h2>
            <p className="mt-1 text-sm text-landing-ink-muted">ยินดีต้อนรับสู่ Spendiary</p>

            {authError && (
              <p role="alert" className="mt-4 rounded-2xl bg-landing-loss-soft p-3 text-sm text-landing-loss-ink">
                {authError}
              </p>
            )}

            <button
              type="button"
              onClick={loginWithGoogle}
              className="mt-6 flex h-12 w-full cursor-pointer items-center justify-center gap-2.5 rounded-full bg-landing-ink text-sm font-semibold text-white shadow-[var(--shadow-landing-soft)] transition-colors hover:bg-landing-ink-hover"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              ดำเนินการต่อด้วย Google
            </button>

            <EmailCodeSignIn />

            <div className="my-4 flex items-center gap-3">
              <span className="h-px flex-1 bg-landing-line-strong" />
              <span className="text-xs text-landing-ink-faint">หรือ</span>
              <span className="h-px flex-1 bg-landing-line-strong" />
            </div>

            <button
              type="button"
              onClick={loginAsTestMode}
              className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-landing-line-strong bg-landing-surface-muted text-sm font-semibold text-landing-ink-soft transition-colors hover:bg-landing-line hover:text-landing-ink"
            >
              <FlaskIcon className="h-4 w-4" />
              ทดลองใช้งาน
            </button>
            <p className="mt-3 text-xs leading-relaxed text-landing-ink-muted">
              ยังไม่มีบัญชีใช่ไหม? ลองทดลองใช้งานได้ทันที <Keep>ไม่ต้องสมัครสมาชิก</Keep> และ<Keep>ข้อมูลจะไม่ถูกบันทึก</Keep>
            </p>

            <div className="mt-5 border-t border-landing-line pt-4 text-xs text-landing-ink-muted">
              <p className="flex items-center justify-center gap-1.5">
                <LockClosedIcon className="h-3.5 w-3.5 shrink-0 text-landing-mint-ink" />
                แต่ละบัญชีเข้าถึงได้เฉพาะข้อมูลของตนเอง
              </p>
              <Link to="/privacy" className="mt-1 inline-block font-semibold text-landing-link hover:underline">
                อ่านนโยบายความเป็นส่วนตัว
              </Link>
            </div>
          </div>

          <section className="mt-12 grid w-full max-w-md gap-4 text-left md:max-w-none md:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className={`flex items-start gap-3.5 rounded-3xl p-5 ${glass}`}>
                <span className={`grid h-11 w-11 flex-none place-items-center rounded-2xl ${f.tile}`}>{f.icon}</span>
                <div className="min-w-0">
                  <h3 className="font-display text-base font-extrabold">{f.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-landing-ink-muted">{f.body}</p>
                </div>
              </div>
            ))}
          </section>
        </main>

        <LandingFooter />
      </div>
    </div>
  )
}

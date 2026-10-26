import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../store/DataContext'
import { LockClosedIcon, TrendUpIcon, WalletIcon } from '../components/icons'
import { EmailCodeSignIn } from './EmailCodeSignIn'
import { Keep } from './Keep'
import { LandingFooter } from './LandingFooter'

const glassCard =
  'rounded-[28px] border border-landing-surface bg-landing-glass shadow-[var(--shadow-landing-soft)] backdrop-blur-xl'

/** One side of the app: a pastel panel with what it covers and a real demo-mode screen peeking up from the bottom */
function SidePanel({
  tone,
  icon,
  label,
  title,
  body,
  shot,
}: {
  tone: 'mint' | 'sky'
  icon: ReactNode
  label: string
  title: string
  body: ReactNode
  shot: ReactNode
}) {
  const fill = tone === 'mint' ? 'bg-landing-mint' : 'bg-landing-sky'
  const ink = tone === 'mint' ? 'text-landing-mint-ink' : 'text-landing-sky-ink'
  return (
    <div className={`flex flex-col overflow-hidden rounded-[32px] ${fill} px-6 pt-6 sm:px-8 sm:pt-8`}>
      <span className={`inline-flex w-fit items-center gap-1.5 rounded-full bg-landing-surface px-3 py-1 text-xs font-semibold ${ink}`}>
        {icon}
        {label}
      </span>
      <h3 className="mt-4 font-display text-xl sm:text-2xl font-extrabold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm sm:text-base leading-relaxed text-landing-ink-soft">{body}</p>
      {/* The screen is cropped by the panel's bottom edge, so tall phone shots and the wide desktop shot sit level */}
      <div className="mt-6 h-80 sm:h-96 lg:h-[26rem] flex-none overflow-hidden rounded-t-2xl border border-b-0 border-landing-surface shadow-[var(--shadow-landing-soft)]">
        {shot}
      </div>
    </div>
  )
}

// Pinned top-left so the desktop shot keeps its sidebar when the panel crops it
const shotClass = 'h-full w-full object-cover object-left-top'

/** The signed-out page. Invite-only and light only: landing-* tokens and the light gradient never flip with .dark. */
export function Landing() {
  const { loginWithGoogle, loginAsTestMode, authError } = useData()

  return (
    // lang="th" lets the browser break Thai lines between words instead of mid-word
    <div lang="th" className="landing-canvas-bg min-h-dvh font-sans text-landing-ink">
      <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-5 sm:px-8 lg:px-10">
        <header className="flex items-center gap-3 py-5 sm:py-7">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="" width={36} height={36} className="h-8 w-8 sm:h-9 sm:w-9 object-contain" />
            <span className="font-display text-xl sm:text-2xl font-extrabold tracking-tight">Spendiary</span>
          </div>
        </header>

        <main className="flex-1 pb-16">
          <section className="grid items-center gap-8 pt-2 sm:pt-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-16 lg:pt-12">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-landing-lavender px-3 py-1 text-xs sm:text-sm font-semibold text-landing-lavender-ink">
                <LockClosedIcon className="h-3.5 w-3.5" />
                เปิดให้ใช้เฉพาะผู้ได้รับเชิญ
              </span>
              <h1 className="mt-5 font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight">
                <Keep>รายจ่ายทุกวัน</Keep> <Keep>กับพอร์ตลงทุน</Keep>
                <br />
                <span className="bg-[linear-gradient(transparent_62%,var(--color-landing-mint)_62%)] px-1">ดูครบในแอปเดียว</span>
              </h1>
              <p className="mt-5 max-w-xl text-base sm:text-lg leading-relaxed text-landing-ink-muted">
                รู้ว่าเดือนนี้ใช้เงินไปเท่าไหร่ บัตรใบไหน<Keep>ใกล้ถึงวันจ่าย</Keep> และพอร์ตหุ้น กองทุน <Keep>คริปโต</Keep>
                เป็น<Keep>ยังไงบ้าง</Keep> ทุกยอดแปลงเป็นเงินบาทให้ด้วยอัตราแลกเปลี่ยนล่าสุด
              </p>
            </div>

            <div className={`${glassCard} p-6 sm:p-8`}>
              <h2 className="font-display text-2xl font-extrabold tracking-tight">เข้าสู่ระบบ</h2>
              <p className="mt-1 text-sm text-landing-ink-muted">ใช้บัญชีที่ได้รับเชิญ</p>

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
                เข้าสู่ระบบด้วย Google
              </button>

              <EmailCodeSignIn />

              <div className="my-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-landing-line-strong" />
                <span className="text-xs text-landing-ink-faint">หรือ</span>
                <span className="h-px flex-1 bg-landing-line-strong" />
              </div>

              <button
                type="button"
                onClick={loginAsTestMode}
                className="flex h-12 w-full cursor-pointer items-center justify-center rounded-full bg-landing-peach text-sm font-semibold text-landing-ink transition-opacity hover:opacity-85"
              >
                ลองใช้โหมด Demo
              </button>
              <p className="mt-3 text-center text-xs leading-relaxed text-landing-ink-muted">
                ยังไม่ได้รับเชิญ? ลองโหมด Demo ได้เลย ไม่ต้องสมัคร และไม่มีการบันทึกข้อมูล
              </p>
            </div>
          </section>

          {/* Real screens from demo mode (promo/landing-shots.mjs) */}
          <section className="mt-16 grid gap-5 sm:gap-6 lg:mt-24 lg:grid-cols-[1.7fr_1fr]">
            <SidePanel
              tone="mint"
              icon={<WalletIcon className="h-3.5 w-3.5" />}
              label="ฝั่งใช้จ่าย"
              title="รู้ทุกวันว่าเงินไปไหน"
              body={<>งบรายวัน บัตรเครดิต บิลรายเดือน หนี้ และ<Keep>งบประมาณ</Keep></>}
              shot={
                <picture className="block h-full">
                  <source media="(min-width: 1024px)" srcSet="/landing/spend-desktop.webp" width={1440} height={900} />
                  <img src="/landing/spend-mobile.webp" width={780} height={1688} alt="หน้าแรกฝั่งใช้จ่ายในโหมด Demo" loading="lazy" className={shotClass} />
                </picture>
              }
            />
            <SidePanel
              tone="sky"
              icon={<TrendUpIcon className="h-3.5 w-3.5" />}
              label="ฝั่งลงทุน"
              title="เห็นพอร์ตทั้งหมดในหน้าเดียว"
              body={<>หุ้นสหรัฐ กองทุน <Keep>คริปโต</Keep> แผน DCA เงินปันผล และแผนเกษียณ</>}
              shot={<img src="/landing/portfolio-mobile.webp" width={780} height={1688} alt="หน้าพอร์ตลงทุนในโหมด Demo" loading="lazy" className={shotClass} />}
            />
          </section>

          <section className="mt-5 flex flex-col gap-4 rounded-[32px] bg-landing-lavender p-6 sm:mt-6 sm:flex-row sm:items-center sm:p-8">
            <span className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-landing-surface text-landing-lavender-ink">
              <LockClosedIcon className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <h3 className="font-display text-lg font-extrabold">ข้อมูลของคุณเป็นของคุณ</h3>
              <p className="mt-1 text-sm sm:text-base leading-relaxed text-landing-ink-soft">
                เก็บบน Supabase และแต่ละบัญชีเห็นได้เฉพาะข้อมูลของตัวเอง
              </p>
            </div>
            <Link to="/privacy" className="text-sm font-semibold text-landing-lavender-ink hover:underline">
              อ่านเพิ่มเติม →
            </Link>
          </section>
        </main>

        <LandingFooter />
      </div>
    </div>
  )
}

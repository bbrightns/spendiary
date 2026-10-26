import { Link } from 'react-router-dom'
import { useData } from '../store/DataContext'
import { EmailCodeSignIn } from './EmailCodeSignIn'
import { Keep } from './Keep'

/** What each side of the app covers, under the screenshots. Every item must exist in the app. */
const SIDES = [
  { title: 'ฝั่ง Spend', body: <>งบใช้จ่ายรายวัน บัตรเครดิต บิล หนี้ และงบประมาณ</> },
  { title: 'ฝั่ง Invest', body: <>หุ้นสหรัฐ กองทุน <Keep>คริปโต</Keep> แผน DCA ปันผล และแผนเกษียณ</> },
]

const screenshotClass = 'h-auto w-full rounded-2xl border border-landing-line shadow-[var(--shadow-landing-soft)]'

/** The signed-out page. Invite-only and light only: it uses the landing-* tokens, which never flip with .dark. */
export function Landing() {
  const { loginWithGoogle, loginAsTestMode, authError } = useData()

  return (
    // lang="th" lets the browser break Thai lines between words instead of mid-word
    <div lang="th" className="min-h-dvh bg-landing-canvas font-sans text-landing-ink">
      <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-5 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between gap-3 py-5 sm:py-7">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="" width={36} height={36} className="h-8 w-8 sm:h-9 sm:w-9 object-contain" />
            <span className="font-display text-xl sm:text-2xl font-extrabold tracking-tight">Spendiary</span>
          </div>
          <Link to="/privacy" className="text-sm font-semibold text-landing-ink-soft hover:text-landing-ink hover:underline">
            ความเป็นส่วนตัว
          </Link>
        </header>

        <main className="flex-1 pb-16">
          {/* Phones: heading, sign-in card, invite note. Desktop: heading and note on the left, card on the right. */}
          <section className="grid gap-6 pt-4 sm:pt-10 lg:grid-cols-[minmax(0,1fr)_400px] lg:grid-rows-[auto_1fr] lg:gap-x-16 lg:gap-y-8 lg:pt-16">
            <div className="lg:pt-8">
              <h1 className="font-display text-3xl sm:text-5xl font-extrabold leading-snug sm:leading-tight tracking-tight">
                <span className="inline-block">รายจ่ายรายวัน</span>
                <span className="inline-block">กับพอร์ตลงทุน</span>{' '}
                <span className="inline-block">อยู่ในที่เดียว</span>
              </h1>
              <p className="mt-4 max-w-xl text-base sm:text-lg leading-relaxed text-landing-ink-muted">
                ดูว่าเดือนนี้ใช้เงินไปเท่าไหร่ บัตรใบไหน<Keep>ใกล้ครบกำหนด</Keep> และพอร์ตหุ้น กองทุน <Keep>คริปโต</Keep> ตอนนี้เป็น
                <Keep>ยังไง</Keep> ทั้งหมดคิดเป็นเงินบาท ด้วยอัตรา <Keep>USD/THB จริง</Keep>
              </p>
            </div>

            <div className="rounded-[var(--radius-card)] border border-landing-line bg-landing-surface p-6 sm:p-8 shadow-[var(--shadow-landing-soft)] lg:row-span-2">
              <h2 className="font-display text-xl font-extrabold tracking-tight">เข้าสู่ Spendiary</h2>
              <p className="mt-1 text-sm text-landing-ink-muted">ใช้บัญชี Google หรืออีเมลที่ได้รับเชิญ</p>

              {authError && (
                <p role="alert" className="mt-4 rounded-xl bg-landing-loss-soft p-3 text-sm text-landing-loss-ink">
                  {authError}
                </p>
              )}

              <button
                type="button"
                onClick={loginWithGoogle}
                className="mt-5 flex h-12 w-full cursor-pointer items-center justify-center gap-2.5 rounded-full bg-landing-ink text-sm font-semibold text-white transition-colors hover:bg-landing-ink-hover"
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
                <span className="h-px flex-1 bg-landing-line" />
                <span className="text-xs text-landing-ink-faint">หรือ</span>
                <span className="h-px flex-1 bg-landing-line" />
              </div>

              <button
                type="button"
                onClick={loginAsTestMode}
                className="flex h-12 w-full cursor-pointer items-center justify-center rounded-full border border-landing-line-strong bg-landing-surface text-sm font-semibold text-landing-ink transition-colors hover:bg-landing-surface-muted"
              >
                ลองใช้โหมด Demo
              </button>
              <p className="mt-3 text-center text-xs leading-relaxed text-landing-ink-muted">
                ยังไม่ได้รับเชิญ? ลองโหมด Demo ได้เลย ไม่ต้องสมัคร ข้อมูลตัวอย่างไม่ถูกบันทึกไว้ที่ไหน
              </p>
            </div>

            <p className="flex items-center gap-2 self-start text-sm text-landing-ink-muted lg:col-start-1 lg:row-start-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-landing-ink-faint" aria-hidden />
              เปิดให้ใช้เฉพาะคนที่ได้รับเชิญ
            </p>
          </section>

          {/* Real screens from demo mode (promo/landing-shots.mjs). Phones get two phone shots; desktop gets the desktop one. */}
          <section className="mt-14 grid grid-cols-2 items-end gap-4 sm:gap-6 lg:mt-24 lg:grid-cols-[3.46fr_1fr] lg:gap-8">
            <picture>
              <source media="(min-width: 1024px)" srcSet="/landing/spend-desktop.webp" width={1440} height={900} />
              <img
                src="/landing/spend-mobile.webp"
                width={780}
                height={1688}
                alt="หน้าแรกฝั่ง Spend ในโหมด Demo"
                loading="lazy"
                className={screenshotClass}
              />
            </picture>
            <img
              src="/landing/portfolio-mobile.webp"
              width={780}
              height={1688}
              alt="หน้า Portfolio ฝั่ง Invest ในโหมด Demo"
              loading="lazy"
              className={screenshotClass}
            />
          </section>

          <section className="mt-10 grid gap-6 sm:grid-cols-3 sm:gap-8">
            {SIDES.map((s) => (
              <div key={s.title}>
                <h3 className="text-sm font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-landing-ink-muted">{s.body}</p>
              </div>
            ))}
            <div>
              <h3 className="text-sm font-semibold">ข้อมูลของคุณ</h3>
              <p className="mt-1 text-sm leading-relaxed text-landing-ink-muted">
                เก็บบน Supabase แต่ละบัญชีเห็นได้แค่ข้อมูลของตัวเอง ·{' '}
                <Link to="/privacy" className="font-semibold text-landing-link hover:underline">
                  อ่านรายละเอียด
                </Link>
              </p>
            </div>
          </section>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-landing-line py-6 text-xs text-landing-ink-muted">
          <p>
            <Link to="/privacy" className="hover:text-landing-ink hover:underline">
              ความเป็นส่วนตัว
            </Link>{' '}
            · <span className="tnum">v{__APP_VERSION__}</span>
          </p>
          <p>Built by bbrightns</p>
        </footer>
      </div>
    </div>
  )
}

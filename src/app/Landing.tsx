import { Link } from 'react-router-dom'
import { useData } from '../store/DataContext'
import { FlaskIcon, LockClosedIcon, TrendUpIcon, WalletIcon } from '../components/icons'
import { EmailCodeSignIn } from './EmailCodeSignIn'
import { LandingFooter } from './LandingFooter'

/** What each side of the app covers, under the screenshots. Every line must stay true of the app. */
const SIDES = [
  {
    icon: <WalletIcon className="h-3.5 w-3.5" />,
    chip: 'bg-landing-mint text-landing-mint-ink',
    label: 'Income & expenses',
    title: 'Know where your money goes',
    body: 'Log expenses, keep up with cards and bills, set budgets and track debts.',
  },
  {
    icon: <TrendUpIcon className="h-3.5 w-3.5" />,
    chip: 'bg-landing-sky text-landing-sky-ink',
    label: 'Investing',
    title: 'See your whole portfolio',
    body: 'Follow US stocks, funds and crypto, plan monthly DCA, and track dividends and retirement.',
  },
]

/** Punctuation in the display heading, nudged against the word before it */
const Tight = ({ children }: { children: string }) => <span className="-ml-[0.08em]">{children}</span>

const glass = 'border border-landing-surface bg-landing-glass shadow-[var(--shadow-landing-soft)] backdrop-blur-xl'
// Screenshot frames skip the blur: backdrop-filter softens the image drawn inside it
const frame = 'border border-landing-surface bg-landing-glass shadow-[var(--shadow-landing-soft)]'

/** The signed-out page: one centred column, light only (landing-* tokens and .landing-canvas-bg never flip with .dark). */
export function Landing() {
  const { loginWithGoogle, loginAsTestMode, authError } = useData()

  return (
    <div className="landing-canvas-bg min-h-dvh font-sans text-landing-ink">
      <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-5 sm:px-8">
        <header className="flex items-center py-5 sm:py-7">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="" width={36} height={36} className="h-8 w-8 sm:h-9 sm:w-9 object-contain" />
            <span className="font-display text-xl sm:text-2xl font-extrabold tracking-tight">spendiary</span>
          </div>
        </header>

        <main className="flex flex-1 flex-col items-center pb-16 pt-8 sm:pt-14 text-center">
          {/* Plus Jakarta's comma and period carry wide side bearings at this weight; Tight pulls them back to the word */}
          <h1 className="max-w-3xl font-display text-4xl sm:text-6xl font-extrabold leading-[1.1] tracking-tight text-balance">
            Manage spending<Tight>,</Tight> Plan investing<Tight>.</Tight>
            <span className="mt-1 block text-landing-brand">All in one app</span>
          </h1>

          <p className="mt-5 max-w-xl text-base sm:text-lg leading-relaxed text-landing-ink-muted text-pretty">
            Log what you spend, see which cards and bills are due, and follow your stocks, funds and crypto.
          </p>

          <div className={`mt-10 w-full max-w-md rounded-[28px] p-6 sm:p-8 ${glass}`}>
            <h2 className="font-display text-2xl font-extrabold tracking-tight">Welcome to Spendiary</h2>

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
              Continue with Google
            </button>

            <EmailCodeSignIn />

            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-landing-line-strong" />
              <span className="text-xs uppercase tracking-wider text-landing-ink-faint">or</span>
              <span className="h-px flex-1 bg-landing-line-strong" />
            </div>

            <button
              type="button"
              onClick={loginAsTestMode}
              className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-landing-line-strong bg-landing-surface-muted text-sm font-semibold text-landing-ink-soft transition-colors hover:bg-landing-line hover:text-landing-ink"
            >
              <FlaskIcon className="h-4 w-4" />
              Try the demo
            </button>
            <p className="mt-3 text-xs text-landing-ink-muted">No account? Try the demo. Nothing is saved.</p>

            {/* Two whole pieces that wrap as units on narrow phones, so nothing is left hanging */}
            <p className="mt-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-t border-landing-line pt-5 text-xs text-landing-ink-muted">
              <span className="inline-flex items-center gap-1.5">
                <LockClosedIcon className="h-3.5 w-3.5 shrink-0 text-landing-mint-ink" />
                Each account sees only its own data
              </span>
              <Link to="/privacy" className="font-semibold text-landing-link hover:underline">
                Privacy policy
              </Link>
            </p>
          </div>

          {/* Real screens from demo mode (promo/landing-shots.mjs). Desktop: the wide screen with the phone over its corner.
              Phones: the two phone screens side by side. Hidden lazy images never load, so each size fetches only its own. */}
          <section className="relative mt-14 w-full sm:mt-20">
            <div className="relative mx-auto hidden max-w-4xl md:block">
              <div className={`rounded-[28px] p-2.5 ${frame}`}>
                <img src="/landing/spend-desktop.webp" width={1440} height={900} alt="Spending home in demo mode" loading="lazy" className="h-auto w-full rounded-[20px]" />
              </div>
              <div className={`absolute -bottom-10 -right-6 w-[23%] rounded-[30px] p-1.5 lg:-right-14 ${frame}`}>
                <img src="/landing/portfolio-mobile.webp" width={780} height={1688} alt="Portfolio in demo mode" loading="lazy" className="h-auto w-full rounded-[24px]" />
              </div>
            </div>
            <div className="mx-auto grid max-w-md grid-cols-2 gap-3 md:hidden">
              {[
                ['/landing/spend-mobile.webp', 'Spending home in demo mode'],
                ['/landing/portfolio-mobile.webp', 'Portfolio in demo mode'],
              ].map(([src, alt]) => (
                <div key={src} className={`rounded-[24px] p-1.5 ${frame}`}>
                  <img src={src} width={780} height={1688} alt={alt} loading="lazy" className="h-auto w-full rounded-[18px]" />
                </div>
              ))}
            </div>
          </section>

          {/* What each side covers: plain text under the screens, not cards */}
          <section className="mt-12 grid w-full max-w-md gap-8 text-left md:mt-20 md:max-w-3xl md:grid-cols-2 md:gap-12">
            {SIDES.map((s) => (
              <div key={s.label}>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${s.chip}`}>
                  {s.icon}
                  {s.label}
                </span>
                <h3 className="mt-3 font-display text-xl sm:text-2xl font-extrabold tracking-tight text-balance">{s.title}</h3>
                <p className="mt-2 text-sm sm:text-base leading-relaxed text-landing-ink-muted text-pretty">{s.body}</p>
              </div>
            ))}
          </section>
        </main>

        <LandingFooter />
      </div>
    </div>
  )
}

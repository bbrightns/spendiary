import { useEffect, type ReactNode } from 'react'
import { useData } from '../store/DataContext'
import { CalendarIcon, CheckIcon, FlaskIcon, TrendUpIcon, WalletIcon } from '../components/icons'
import { EmailCodeSignIn } from './EmailCodeSignIn'
import { LandingFooter } from './LandingFooter'

/** Sections that fade up once as they scroll into view. Without IntersectionObserver they just show. */
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.landing-reveal')
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-visible'))
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          e.target.classList.add('is-visible')
          io.unobserve(e.target)
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
}

function GoogleMark() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  )
}

const pill = 'inline-flex h-12 cursor-pointer items-center justify-center gap-2.5 rounded-full px-6 text-sm font-semibold transition-colors'
const card = 'rounded-3xl border border-landing-surface bg-landing-paper p-5 text-left shadow-[var(--shadow-landing-soft)]'
const display = 'font-landing font-medium tracking-[-0.04em]'

/** A small event bubble floating beside the hero (wide screens only). Figures come from demo mode. */
function Chip({ icon, children, className }: { icon: ReactNode; children: ReactNode; className: string }) {
  return (
    <span
      aria-hidden
      className={`absolute hidden items-center gap-2 rounded-full border border-landing-surface bg-landing-paper px-3.5 py-2 text-xs font-medium text-landing-ink-soft shadow-[var(--shadow-landing-soft)] xl:inline-flex ${className}`}
    >
      <span className="grid h-5 w-5 place-items-center rounded-full bg-landing-stone text-landing-ink">{icon}</span>
      {children}
    </span>
  )
}

/** One stat card in the "All in one app" ring, styled like the app's own cards. Demo-mode figures. */
function Stat({ title, meta, children }: { title: string; meta: string; children: ReactNode }) {
  return (
    <div className={card}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-landing-ink">{title}</p>
        <p className="text-xs text-landing-ink-faint">{meta}</p>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  )
}

function Bar({ value, tone }: { value: number; tone: string }) {
  return (
    <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-landing-stone">
      <span className={`block h-full rounded-full ${tone}`} style={{ width: `${value}%` }} />
    </span>
  )
}

/** One feature row: words on one side, an app-style fragment on the other. */
function Feature({ chip, title, body, points, visual, flip }: {
  chip: ReactNode
  title: string
  body: string
  points: string[]
  visual: ReactNode
  flip?: boolean
}) {
  return (
    <div className="landing-reveal grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <div className={flip ? 'lg:order-2' : ''}>
        {chip}
        <h3 className={`mt-4 text-4xl sm:text-5xl leading-[1.05] text-landing-ink text-balance ${display}`}>{title}</h3>
        <p className="mt-4 max-w-md text-base sm:text-lg leading-relaxed text-landing-ink-muted text-pretty">{body}</p>
        <ul className="mt-6 space-y-3">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-3 text-sm sm:text-base text-landing-ink-soft">
              <span className="mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full bg-landing-surface text-landing-ink">
                <CheckIcon className="h-3 w-3" />
              </span>
              {p}
            </li>
          ))}
        </ul>
      </div>
      <div className={flip ? 'lg:order-1' : ''}>{visual}</div>
    </div>
  )
}

const BILLS: [string, string][] = [
  ['Electricity', '฿1,450'],
  ['AIS phone + fiber', '฿899'],
  ['Netflix + Spotify', '฿459'],
  ['Gym membership', '฿2,200'],
]

const HOLDINGS: [string, string, number, string][] = [
  ['CONDO-BKK', '฿2,850,000', 48.7, 'bg-landing-sky-ink'],
  ['BTC', '฿1,413,500', 24.2, 'bg-landing-mint-ink'],
  ['AAPL', '฿409,539', 7.0, 'bg-landing-brand'],
  ['NVDA', '฿366,289', 6.3, 'bg-landing-lavender-ink'],
]

/** The signed-out page. Light only: landing-* tokens never flip with .dark. Copy must stay true of the app. */
export function Landing() {
  const { loginWithGoogle, loginAsTestMode, authError } = useData()
  useReveal()

  return (
    <div className="min-h-dvh bg-landing-stone font-sans text-landing-ink">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8 sm:py-6">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="" width={36} height={36} className="h-8 w-8 object-contain" />
          <span className={`text-xl sm:text-2xl ${display}`}>spendiary</span>
        </div>
        <button type="button" onClick={loginAsTestMode} className={`${pill} h-10 bg-landing-ink px-5 text-white hover:bg-landing-ink-hover`}>
          Try the demo
        </button>
      </header>

      <main>
        {/* Hero */}
        <section className="relative mx-auto max-w-6xl px-5 pb-16 pt-10 text-center sm:px-8 sm:pt-16">
          <Chip icon={<CalendarIcon className="h-3 w-3" />} className="left-8 top-[19rem]">2 payments due · ฿17,130</Chip>
          <Chip icon={<WalletIcon className="h-3 w-3" />} className="left-28 top-[25rem]">฿1,562 left today</Chip>
          <Chip icon={<CheckIcon className="h-3 w-3" />} className="right-10 top-[18.5rem]">4 DCA buys to log</Chip>
          <Chip icon={<TrendUpIcon className="h-3 w-3" />} className="right-20 top-[24.5rem]">Portfolio +23.5% all time</Chip>

          <h1 className={`mx-auto max-w-4xl text-5xl leading-[0.95] sm:text-7xl lg:text-8xl ${display}`}>
            <span className="block">Manage spending,</span>
            <span className="block text-landing-taupe">Plan investing.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base sm:text-lg leading-relaxed text-landing-ink-muted text-pretty">
            Log what you spend, see which cards and bills are due, and follow your stocks, funds and crypto.
          </p>

          {authError && (
            <p role="alert" className="mx-auto mt-6 max-w-md rounded-2xl bg-landing-loss-soft p-3 text-sm text-landing-loss-ink">
              {authError}
            </p>
          )}

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button type="button" onClick={loginWithGoogle} className={`${pill} w-full bg-landing-ink text-white hover:bg-landing-ink-hover sm:w-auto`}>
              <GoogleMark />
              Continue with Google
            </button>
            <button
              type="button"
              onClick={loginAsTestMode}
              className={`${pill} w-full border border-landing-line-strong bg-landing-paper text-landing-ink hover:bg-landing-surface sm:w-auto`}
            >
              <FlaskIcon className="h-4 w-4" />
              Try the demo
            </button>
          </div>
          <div className="mx-auto max-w-sm">
            <EmailCodeSignIn />
          </div>
          <p className="mt-3 text-xs text-landing-ink-faint">No account? Try the demo. Nothing is saved.</p>

          {/* Real screens from demo mode (promo/landing-shots.mjs); hidden lazy images never load */}
          <div className="landing-reveal relative mx-auto mt-14 hidden max-w-4xl md:block">
            <div className="rounded-[28px] border border-landing-surface bg-landing-paper p-2.5">
              <img src="/landing/spend-desktop.webp" width={1440} height={900} alt="Spending home in demo mode" loading="lazy" className="h-auto w-full rounded-[18px]" />
            </div>
            <div className="absolute -bottom-10 -right-6 w-[23%] rounded-[30px] border border-landing-surface bg-landing-paper p-1.5 shadow-[var(--shadow-landing-soft)] lg:-right-14">
              <img src="/landing/portfolio-mobile.webp" width={780} height={1688} alt="Portfolio in demo mode" loading="lazy" className="h-auto w-full rounded-[24px]" />
            </div>
          </div>
          <div className="landing-reveal mx-auto mt-12 grid max-w-md grid-cols-2 gap-3 md:hidden">
            {[
              ['/landing/spend-mobile.webp', 'Spending home in demo mode'],
              ['/landing/portfolio-mobile.webp', 'Portfolio in demo mode'],
            ].map(([src, alt]) => (
              <div key={src} className="rounded-[24px] border border-landing-surface bg-landing-paper p-1.5">
                <img src={src} width={780} height={1688} alt={alt} loading="lazy" className="h-auto w-full rounded-[18px]" />
              </div>
            ))}
          </div>
        </section>

        {/* All in one app: the numbers you see on Home, as cards around the phone */}
        <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <h2 className={`landing-reveal text-center text-4xl sm:text-6xl leading-[1.05] ${display}`}>
            All in <span className="text-landing-taupe">one app.</span>
          </h2>
          <div className="landing-reveal mt-12 grid items-center gap-4 sm:grid-cols-2 lg:mt-16 lg:grid-cols-[1fr_auto_1fr] lg:gap-8">
            <div className="grid gap-4 lg:-translate-y-6">
              <Stat title="Today" meta="Daily allowance">
                <p className={`text-3xl tnum ${display}`}>฿1,562</p>
                <p className="mt-1 text-xs text-landing-ink-muted">
                  left today of ฿1,671 · <span className="font-semibold text-landing-mint-ink">On track</span>
                </p>
              </Stat>
              <Stat title="This month" meta="Budget">
                <p className="text-sm tnum text-landing-ink-soft">
                  <span className="font-semibold text-landing-ink">฿18,427</span> of ฿25,000
                </p>
                <Bar value={74} tone="bg-landing-brand" />
              </Stat>
            </div>
            <div className="mx-auto hidden w-60 rounded-[30px] border border-landing-surface bg-landing-paper p-1.5 shadow-[var(--shadow-landing-soft)] lg:block">
              <img src="/landing/spend-mobile.webp" width={780} height={1688} alt="" loading="lazy" className="h-auto w-full rounded-[24px]" />
            </div>
            <div className="grid gap-4 lg:translate-y-6">
              <Stat title="Payments due" meta="Next in 2 days">
                <p className={`text-3xl tnum ${display}`}>฿17,130</p>
                <p className="mt-1 text-xs text-landing-ink-muted">2 cards and bills</p>
              </Stat>
              <Stat title="Portfolio" meta="All time">
                <p className={`text-3xl tnum ${display}`}>฿5.85M</p>
                <p className="mt-1 text-xs font-semibold text-landing-mint-ink tnum">+฿1.11M · +23.5%</p>
              </Stat>
            </div>
          </div>
          <p className="mt-8 text-center text-xs text-landing-ink-faint">Figures from demo mode</p>
        </section>

        {/* Statement */}
        <section className="bg-landing-night px-5 py-24 sm:px-8 sm:py-32">
          <p className={`landing-reveal mx-auto max-w-5xl text-3xl sm:text-5xl lg:text-6xl leading-[1.1] text-landing-on-night text-balance ${display}`}>
            Your daily spending and your investments,{' '}
            <span className="text-landing-on-night-muted">side by side, every amount in Thai baht.</span>
          </p>
        </section>

        {/* What each side covers */}
        <section className="mx-auto max-w-6xl space-y-24 px-5 py-24 sm:space-y-32 sm:px-8 sm:py-32">
          <Feature
            chip={
              <span className="inline-flex items-center gap-1.5 rounded-full bg-landing-mint px-3 py-1 text-xs font-semibold text-landing-mint-ink">
                <WalletIcon className="h-3.5 w-3.5" />
                Income & expenses
              </span>
            }
            title="Know where your money goes"
            body="Log expenses, keep up with cards and bills, set budgets and track debts."
            points={['A daily allowance that shows what is left today', 'Due dates for cards, bills and installments', 'Monthly and per-category budgets']}
            visual={
              <div className={`${card} p-6`}>
                <div className="flex items-baseline justify-between">
                  <p className="text-base font-semibold">Bills and recurring</p>
                  <p className="text-xs text-landing-ink-faint">Demo</p>
                </div>
                <ul className="mt-4 divide-y divide-landing-line">
                  {BILLS.map(([name, amount]) => (
                    <li key={name} className="flex items-center gap-3 py-3">
                      <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-landing-mint text-landing-mint-ink">
                        <CalendarIcon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{name}</span>
                        <span className="block text-xs text-landing-ink-muted">Monthly</span>
                      </span>
                      <span className="text-sm font-semibold tnum">{amount}</span>
                    </li>
                  ))}
                </ul>
              </div>
            }
          />
          <Feature
            flip
            chip={
              <span className="inline-flex items-center gap-1.5 rounded-full bg-landing-sky px-3 py-1 text-xs font-semibold text-landing-sky-ink">
                <TrendUpIcon className="h-3.5 w-3.5" />
                Investing
              </span>
            }
            title="See your whole portfolio"
            body="Follow US stocks, funds and crypto, plan monthly DCA, and track dividends and retirement."
            points={['Stocks, funds and crypto valued in baht', 'Monthly DCA plans with buys to log', 'Dividends and a retirement planner']}
            visual={
              <div className={`${card} p-6`}>
                <div className="flex items-baseline justify-between">
                  <p className="text-base font-semibold">Allocation</p>
                  <p className="text-xs text-landing-ink-faint">Demo</p>
                </div>
                <ul className="mt-4 space-y-4">
                  {HOLDINGS.map(([name, value, pct, tone]) => (
                    <li key={name}>
                      <div className="flex items-baseline justify-between text-sm">
                        <span className="font-semibold">{name}</span>
                        <span className="tnum text-landing-ink-soft">
                          {value} <span className="text-landing-ink-faint">({pct}%)</span>
                        </span>
                      </div>
                      <Bar value={pct} tone={tone} />
                    </li>
                  ))}
                </ul>
              </div>
            }
          />
        </section>

        {/* Closing call */}
        <section className="bg-landing-night px-5 py-24 text-center sm:px-8 sm:py-28">
          <h2 className={`landing-reveal mx-auto max-w-3xl text-4xl sm:text-6xl leading-[1.05] text-landing-on-night ${display}`}>
            See it with sample data <span className="text-landing-on-night-muted">first.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-md text-base text-landing-on-night-muted">The demo opens the full app with example numbers. Nothing is saved.</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button type="button" onClick={loginAsTestMode} className={`${pill} w-full bg-landing-on-night text-landing-ink hover:bg-landing-surface sm:w-auto`}>
              <FlaskIcon className="h-4 w-4" />
              Try the demo
            </button>
            <button
              type="button"
              onClick={loginWithGoogle}
              className={`${pill} w-full border border-landing-night-soft bg-landing-night-soft text-landing-on-night hover:bg-landing-ink-hover sm:w-auto`}
            >
              <GoogleMark />
              Continue with Google
            </button>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  )
}

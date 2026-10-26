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
// Headings as in the app: Plus Jakarta Sans, extrabold, tight
const display = 'font-display font-extrabold tracking-tight'

/** Punctuation in big headings: Plus Jakarta's comma and period carry wide side bearings at this weight */
const Tight = ({ children }: { children: string }) => <span className="-ml-[0.08em]">{children}</span>

/** A small label floating beside the hero (wide screens only). Faint and flat on purpose, so it never reads as a button. */
function Chip({ icon, children, className }: { icon: ReactNode; children: ReactNode; className: string }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute hidden select-none items-center gap-2 rounded-full bg-landing-surface/40 px-3 py-1.5 text-xs text-landing-ink-faint opacity-80 xl:inline-flex ${className}`}
    >
      {icon}
      {children}
    </span>
  )
}

/** A real app component cut out of demo mode (promo/landing-shots.mjs). The capture carries its own card, corners and shadow. */
function Part({ src, w, h, alt, className = '' }: { src: string; w: number; h: number; alt: string; className?: string }) {
  return <img src={`/landing/${src}.webp`} width={w} height={h} alt={alt} loading="lazy" className={`h-auto w-full ${className}`} />
}

/** One feature row: words on one side, a real app card on the other. */
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
              <span className="mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full bg-landing-surface text-landing-ink shadow-[var(--shadow-landing-soft)]">
                <CheckIcon className="h-3 w-3" />
              </span>
              {p}
            </li>
          ))}
        </ul>
      </div>
      <div className={`mx-auto w-full max-w-md ${flip ? 'lg:order-1' : ''}`}>{visual}</div>
    </div>
  )
}

/** The signed-out page. Light only: landing-* tokens and .landing-canvas-bg never flip with .dark. Copy must stay true of the app. */
export function Landing() {
  const { loginWithGoogle, loginAsTestMode, authError } = useData()
  useReveal()

  return (
    <div className="landing-canvas-bg min-h-dvh font-sans text-landing-ink">
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
          <Chip icon={<CalendarIcon className="h-3.5 w-3.5 text-landing-mint-ink" />} className="left-8 top-[19rem]">Bills due this week</Chip>
          <Chip icon={<WalletIcon className="h-3.5 w-3.5 text-landing-mint-ink" />} className="left-28 top-[25rem]">Left to spend today</Chip>
          <Chip icon={<CheckIcon className="h-3.5 w-3.5 text-landing-sky-ink" />} className="right-10 top-[18.5rem]">DCA buys to log</Chip>
          <Chip icon={<TrendUpIcon className="h-3.5 w-3.5 text-landing-sky-ink" />} className="right-20 top-[24.5rem]">All-time profit</Chip>

          <h1 className={`mx-auto max-w-4xl text-5xl leading-[0.95] sm:text-7xl lg:text-8xl ${display}`}>
            <span className="block">Manage spending<Tight>,</Tight></span>
            <span className="block text-landing-brand">Plan investing<Tight>.</Tight></span>
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
              className={`${pill} w-full border border-landing-line-strong bg-landing-surface text-landing-ink hover:bg-landing-line sm:w-auto`}
            >
              <FlaskIcon className="h-4 w-4" />
              Try the demo
            </button>
          </div>
          <div className="mx-auto max-w-sm">
            <EmailCodeSignIn />
          </div>
          <p className="mt-3 text-xs text-landing-ink-faint">No account? Try the demo. Nothing is saved.</p>

          {/* Real screens from demo mode; hidden lazy images never load, so each size fetches only its own */}
          <div className="landing-reveal relative mx-auto mt-14 hidden max-w-4xl md:block">
            <div className="rounded-[28px] border border-landing-line bg-landing-surface p-2.5 shadow-[var(--shadow-landing-soft)]">
              <img src="/landing/spend-desktop.webp" width={1440} height={900} alt="Spending home in demo mode" loading="lazy" className="h-auto w-full rounded-[18px]" />
            </div>
            <div className="absolute -bottom-10 -right-6 w-[23%] rounded-[30px] border border-landing-line bg-landing-surface p-1.5 shadow-[var(--shadow-landing-soft)] lg:-right-14">
              <img src="/landing/portfolio-mobile.webp" width={780} height={1688} alt="Portfolio in demo mode" loading="lazy" className="h-auto w-full rounded-[24px]" />
            </div>
          </div>
          <div className="landing-reveal mx-auto mt-12 grid max-w-md grid-cols-2 gap-3 md:hidden">
            {[
              ['/landing/spend-mobile.webp', 'Spending home in demo mode'],
              ['/landing/portfolio-mobile.webp', 'Portfolio in demo mode'],
            ].map(([src, alt]) => (
              <div key={src} className="rounded-[24px] border border-landing-line bg-landing-surface p-1.5 shadow-[var(--shadow-landing-soft)]">
                <img src={src} width={780} height={1688} alt={alt} loading="lazy" className="h-auto w-full rounded-[18px]" />
              </div>
            ))}
          </div>
        </section>

        {/* All in one app: real cards from Home and Portfolio around the phone screen */}
        <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <h2 className={`landing-reveal text-center text-4xl sm:text-6xl leading-[1.05] ${display}`}>
            All in <span className="text-landing-brand">one app<Tight>.</Tight></span>
          </h2>
          <div className="landing-reveal mx-auto mt-10 grid max-w-md items-center gap-2 lg:mt-14 lg:max-w-none lg:grid-cols-[1fr_auto_1fr] lg:gap-6">
            <div className="grid gap-2 lg:-translate-y-6">
              <Part src="part-today" w={780} h={500} alt="Today card: money left to spend today" />
              <Part src="part-month" w={780} h={284} alt="This month card: spending against the monthly budget" />
            </div>
            <div className="mx-auto hidden w-60 rounded-[30px] border border-landing-line bg-landing-surface p-1.5 shadow-[var(--shadow-landing-soft)] lg:block">
              <img src="/landing/spend-mobile.webp" width={780} height={1688} alt="" loading="lazy" className="h-auto w-full rounded-[24px]" />
            </div>
            <div className="grid gap-2 lg:translate-y-6">
              <Part src="part-due" w={780} h={224} alt="Payments due row with a Review button" />
              {/* The capture is the grey inset only; a white card around it, as in the app */}
              <div className="mx-6 rounded-[var(--radius-card)] border border-landing-line bg-landing-surface shadow-[var(--shadow-landing-soft)]">
                <Part src="part-portfolio-value" w={780} h={316} alt="Portfolio value and all-time profit" />
              </div>
            </div>
          </div>
          <p className="mt-8 text-center text-xs text-landing-ink-faint">Screens from demo mode</p>
        </section>

        {/* Statement */}
        <section className="bg-landing-night px-5 py-24 sm:px-8 sm:py-32">
          <p className={`landing-reveal mx-auto max-w-5xl text-3xl sm:text-5xl lg:text-6xl leading-[1.1] text-landing-on-night text-balance ${display}`}>
            Know what you can spend today<Tight>,</Tight>{' '}
            <span className="text-landing-on-night-muted">without losing sight of what you're building<Tight>.</Tight></span>
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
            visual={<Part src="part-bills" w={920} h={976} alt="Bills and recurring card with due dates and Paid buttons" />}
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
            points={['Stocks, funds and crypto with current prices', 'Monthly DCA plans with buys to log', 'Dividends and a retirement planner']}
            visual={<Part src="part-allocation" w={772} h={1566} alt="Allocation card with portfolio value, a donut chart and holdings" className="mx-auto max-w-sm" />}
          />
        </section>

        {/* Closing call */}
        <section className="bg-landing-night px-5 py-24 text-center sm:px-8 sm:py-28">
          <h2 className={`landing-reveal mx-auto max-w-3xl text-4xl sm:text-6xl leading-[1.05] text-landing-on-night ${display}`}>
            See it with sample data <span className="text-landing-on-night-muted">first<Tight>.</Tight></span>
          </h2>
          <p className="mx-auto mt-5 max-w-md text-base text-landing-on-night-muted">The demo opens the full app with example numbers. Nothing is saved.</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button type="button" onClick={loginAsTestMode} className={`${pill} w-full bg-landing-surface text-landing-ink hover:bg-landing-line sm:w-auto`}>
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

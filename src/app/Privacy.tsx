import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LandingFooter } from './LandingFooter'

/** Plain facts about the data. Every line must stay true of the code: update it when storage or a
 *  third-party call changes (lib/prices.ts, store/useCloudSync.ts, index.html fonts). */
const SECTIONS: { title: string; body: ReactNode }[] = [
  {
    title: 'What we store',
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>Your account: your email, plus your name and profile photo from Google if you sign in with Google.</li>
        <li>What you record in the app: income and expenses, accounts and cards, budgets, bills, debts, holdings, DCA plans, dividends and settings.</li>
        <li>A few settings for each device, such as the theme and the latest prices fetched, kept in your own browser.</li>
        <li>No usage analytics, no ads and no tracking cookies.</li>
      </ul>
    ),
  },
  {
    title: 'Where it is stored',
    body: (
      <p>
        What you record is stored on Supabase, a cloud database, as one row per account with Row Level Security turned on,
        so each account can only read and change its own data. Data travels over HTTPS, but it is not encrypted on your
        device before it is sent.
      </p>
    ),
  },
  {
    title: 'Who can see it',
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>You.</li>
        <li>
          The admin (the person who invited you), who has access to the Supabase dashboard and so can technically see every
          account's data. We say this up front so you can decide what to record.
        </li>
      </ul>
    ),
  },
  {
    title: 'Outside services the app uses',
    body: (
      <>
        <ul className="list-disc space-y-2 pl-5">
          <li>Supabase, for storage, sign-in and emailing sign-in codes.</li>
          <li>Google, for sign-in (if you choose it) and the web fonts; Google sees your IP address when the fonts load.</li>
          <li>Vercel, which hosts the site.</li>
          <li>Stock prices: only the ticker (such as AAPL) or your search text goes to a Supabase Edge Function, which fetches prices from Yahoo Finance.</li>
          <li>Crypto prices and the USD/THB rate: your browser asks Binance and Binance TH directly, sending only the coin symbol.</li>
        </ul>
        <p className="mt-3">None of these services receive your balances or transactions.</p>
      </>
    ),
  },
  {
    title: 'Deleting your data',
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>
          Delete everything yourself in Settings → Data and backup → Reset everything. This removes your data from Supabase
          and signs you out, and it can't be undone. To keep a copy, press Export on the same page first.
        </li>
        <li>You can't delete the sign-in account itself in the app. Ask the admin to remove it.</li>
        <li>The demo saves nothing. Close the page and the sample data is gone.</li>
      </ul>
    ),
  },
  {
    title: 'Contact',
    body: <p>Questions? Contact the admin, the person who invited you.</p>,
  },
]

/** /privacy: opens with or without signing in. Light only, like the landing page (landing-* tokens). */
export function Privacy() {
  return (
    <div className="flex min-h-dvh flex-col bg-landing-stone font-sans text-landing-ink">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 sm:px-8">
        <header className="flex items-center justify-between gap-3 py-5 sm:py-7">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="" width={36} height={36} className="h-8 w-8 sm:h-9 sm:w-9 object-contain" />
            <span className="font-landing text-xl sm:text-2xl font-medium tracking-[-0.04em]">spendiary</span>
          </Link>
          <Link to="/" className="text-sm font-semibold text-landing-ink-soft hover:text-landing-ink hover:underline">
            ← Back to home
          </Link>
        </header>

        <main className="flex-1 pb-16 pt-4 sm:pt-8">
          <h1 className="font-landing text-4xl sm:text-6xl font-medium leading-[1.05] tracking-[-0.04em]">Privacy policy</h1>
          <p className="mt-4 text-base sm:text-lg leading-relaxed text-landing-ink-muted">
            Spendiary is invite-only. This page explains what we store, where it is stored and who can see it.
          </p>
          <p className="mt-2 text-sm text-landing-ink-faint">Last updated 26 October 2026</p>

          <div className="mt-10 divide-y divide-landing-line rounded-[28px] border border-landing-surface bg-landing-paper px-6 shadow-[var(--shadow-landing-soft)] sm:px-10">
            {SECTIONS.map((s, i) => (
              <section key={s.title} className="flex gap-4 py-7 sm:gap-5">
                <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-landing-lavender text-sm font-bold text-landing-lavender-ink tnum">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-landing text-xl sm:text-2xl font-medium leading-8 tracking-[-0.02em]">{s.title}</h2>
                  <div className="mt-2 text-base leading-relaxed text-landing-ink-soft">{s.body}</div>
                </div>
              </section>
            ))}
          </div>
        </main>
      </div>

      <LandingFooter />
    </div>
  )
}

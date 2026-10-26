import { Link } from 'react-router-dom'

/** Footer of the signed-out pages, on the night ground: where data lives (the one privacy link), version and maker. */
export function LandingFooter() {
  return (
    <footer className="border-t border-landing-night-soft bg-landing-night px-5 py-10 text-sm text-landing-on-night-muted sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="" width={28} height={28} className="h-7 w-7 object-contain" />
            <span className="font-landing text-xl font-medium tracking-[-0.04em] text-landing-on-night">spendiary</span>
          </div>
          <p className="mt-3 max-w-sm">
            Stored on Supabase. Each account can only access its own data.{' '}
            <Link to="/privacy" className="font-semibold text-landing-on-night hover:underline">
              Privacy policy
            </Link>
          </p>
        </div>
        <div className="text-xs sm:text-right">
          <p className="tnum">Version {__APP_VERSION__}</p>
          <p>© 2026 Spendiary · Designed & built by bbrightns</p>
        </div>
      </div>
    </footer>
  )
}

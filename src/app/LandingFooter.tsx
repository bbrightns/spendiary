/** Footer of the signed-out pages: version capsule, copyright and the maker. The privacy link lives in the sign-in card. */
export function LandingFooter() {
  return (
    <footer className="flex flex-col items-start gap-3.5 border-t border-landing-line-strong pb-10 pt-8 text-xs text-landing-ink-muted">
      <span className="inline-flex items-center gap-2 rounded-full border border-landing-line-strong bg-landing-surface px-3.5 py-1.5 text-landing-ink-soft shadow-[var(--shadow-landing-soft)]">
        <span className="font-medium tnum">Version {__APP_VERSION__}</span>
        <span className="text-landing-ink-faint">•</span>
        <span className="font-mono">build {__COMMIT_HASH__}</span>
      </span>
      <p>© 2026 Spendiary</p>
      <p className="font-medium">Designed & built by bbrightns</p>
    </footer>
  )
}

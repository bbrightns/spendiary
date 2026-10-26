/** Footer of the signed-out pages: version, copyright and the maker, as plain text (the build hash stays in the app's footer). The privacy link lives in the sign-in card. */
export function LandingFooter() {
  return (
    <footer className="flex flex-col items-start gap-1.5 border-t border-landing-line-strong pb-10 pt-8 text-xs text-landing-ink-muted">
      <p className="tnum">Version {__APP_VERSION__}</p>
      <p>© 2026 Spendiary</p>
      <p>Designed & built by bbrightns</p>
    </footer>
  )
}

/** Footer of the signed-out pages. The privacy link lives in the landing page's data strip, not here, so it isn't repeated. */
export function LandingFooter() {
  return (
    <footer className="flex flex-col gap-2 border-t border-landing-line-strong py-6 text-xs text-landing-ink-muted sm:flex-row sm:items-center sm:justify-between">
      <p>
        © 2026 Spendiary · <span className="tnum">เวอร์ชัน {__APP_VERSION__}</span>
      </p>
      <p>สร้างโดย bbrightns</p>
    </footer>
  )
}

import { Link } from 'react-router-dom'

/** Footer of the signed-out pages. /privacy hides the link to itself. */
export function LandingFooter({ privacyLink = true }: { privacyLink?: boolean }) {
  return (
    <footer className="flex flex-col gap-2 border-t border-landing-line-strong py-6 text-xs text-landing-ink-muted sm:flex-row sm:items-center sm:justify-between">
      <p>
        © 2026 Spendiary · <span className="tnum">เวอร์ชัน {__APP_VERSION__}</span>
      </p>
      <p>
        {privacyLink && (
          <>
            <Link to="/privacy" className="hover:text-landing-ink hover:underline">
              นโยบายความเป็นส่วนตัว
            </Link>
            {' · '}
          </>
        )}
        สร้างโดย bbrightns
      </p>
    </footer>
  )
}

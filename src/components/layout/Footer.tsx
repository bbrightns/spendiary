import { useState } from 'react'

interface FooterProps {
  className?: string
}

export function Footer({ className = '' }: FooterProps) {
  const [copied, setCopied] = useState(false)

  const handleCopyBuild = () => {
    navigator.clipboard.writeText(`Spendiary v${__APP_VERSION__} (build ${__COMMIT_HASH__})`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <footer className={`w-full mt-8 pt-5 pb-8 border-t border-line/60 select-none ${className}`}>
      {/* One row on wide screens; wraps on phones */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-ink-muted">
        <button
          type="button"
          onClick={handleCopyBuild}
          title={`Built on ${new Date(__BUILD_TIME__).toLocaleString()} • Click to copy build info`}
          className="inline-flex items-center gap-2 rounded-full border border-line/80 bg-surface/80 px-3 py-1 text-xs text-ink-muted shadow-xs backdrop-blur-md transition-all duration-150 hover:border-line hover:bg-surface-muted hover:text-ink active:scale-95 cursor-pointer dark:bg-surface-muted/60"
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gain" />
          <span className="font-medium">{copied ? 'Copied to clipboard!' : `Version ${__APP_VERSION__}`}</span>
          {!copied && (
            <>
              <span className="text-ink-muted/40">•</span>
              <span className="font-mono">build {__COMMIT_HASH__}</span>
            </>
          )}
        </button>
        <span>© 2026 Spendiary. Every choice shapes your wealth.</span>
        <span aria-hidden="true" className="hidden text-ink-muted/40 sm:inline">·</span>
        <span className="font-medium">Designed & Built by bbrightns</span>
      </div>
    </footer>
  )
}

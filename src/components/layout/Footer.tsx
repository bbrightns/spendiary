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
    <footer className={`w-full mt-10 pt-8 pb-10 border-t border-line/60 select-none ${className}`}>
      <div className="flex flex-col items-start gap-3.5">
        {/* Version Control Capsule */}
        <button
          type="button"
          onClick={handleCopyBuild}
          title={`Built on ${new Date(__BUILD_TIME__).toLocaleString()} • Click to copy build info`}
          className="group inline-flex items-center gap-2 rounded-full border border-line/80 bg-surface/80 dark:bg-surface-muted/60 backdrop-blur-md px-3.5 py-1.5 text-xs text-ink-muted transition-all duration-150 hover:border-line hover:bg-surface-muted hover:text-ink active:scale-95 cursor-pointer shadow-xs"
        >
          <span
            className={`h-1.5 w-1.5 rounded-full transition-colors shrink-0 ${
              copied ? 'bg-gain animate-pulse' : 'bg-gain'
            }`}
          />
          <span className="font-medium">
            {copied ? 'Copied to clipboard!' : `Version ${__APP_VERSION__}`}
          </span>
          {!copied && (
            <>
              <span className="text-ink-muted/40">•</span>
              <span className="font-mono text-[11px] text-ink-muted">
                build {__COMMIT_HASH__}
              </span>
            </>
          )}
        </button>

        {/* Copyright */}
        <p className="text-xs font-normal text-ink-muted antialiased">
          © 2026 Spendiary. Every choice shapes your wealth.
        </p>

        {/* Gradient Accent Bar + Tag */}
        <div className="flex items-center gap-2.5 pt-0.5">
          <span
            className="w-7 h-[2px] rounded-full shrink-0"
            style={{ background: 'linear-gradient(to right, #405DFF, #DFAA41)' }}
          />
          <span className="text-[11.5px] text-ink-muted font-medium">
            Personal Wealth Cockpit
          </span>
        </div>
      </div>
    </footer>
  )
}

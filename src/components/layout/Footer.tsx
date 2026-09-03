import { useState } from 'react'

interface FooterProps {
  className?: string
  lightOnly?: boolean
}

export function Footer({ className = '', lightOnly = false }: FooterProps) {
  const [copied, setCopied] = useState(false)

  const handleCopyBuild = () => {
    navigator.clipboard.writeText(`Spendiary v${__APP_VERSION__} (build ${__COMMIT_HASH__})`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const borderClass = lightOnly ? 'border-slate-200/80' : 'border-line/60'
  const buttonClass = lightOnly
    ? 'border-slate-200/90 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900'
    : 'border-line/80 bg-surface/80 dark:bg-surface-muted/60 backdrop-blur-md text-ink-muted hover:border-line hover:bg-surface-muted hover:text-ink'
  const textClass = lightOnly ? 'text-slate-500' : 'text-ink-muted'
  const buildTextClass = lightOnly ? 'text-slate-500' : 'text-ink-muted'
  const dotClass = lightOnly ? 'text-slate-300' : 'text-ink-muted/40'

  return (
    <footer className={`w-full mt-10 pt-8 pb-10 border-t ${borderClass} select-none ${className}`}>
      <div className="flex flex-col items-start gap-3.5">
        {/* Version Control Capsule */}
        <button
          type="button"
          onClick={handleCopyBuild}
          title={`Built on ${new Date(__BUILD_TIME__).toLocaleString()} • Click to copy build info`}
          className={`group inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs transition-all duration-150 active:scale-95 cursor-pointer shadow-xs ${buttonClass}`}
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
              <span className={dotClass}>•</span>
              <span className={`font-mono text-[11px] ${buildTextClass}`}>
                build {__COMMIT_HASH__}
              </span>
            </>
          )}
        </button>

        {/* Copyright */}
        <p className={`text-xs font-normal antialiased ${textClass}`}>
          © 2026 Spendiary. Every choice shapes your wealth.
        </p>

        {/* Gradient Accent Bar + Tag */}
        <div className="flex items-center gap-2.5 pt-0.5">
          <span
            className="w-7 h-[2px] rounded-full shrink-0"
            style={{ background: 'linear-gradient(to right, #405DFF, #DFAA41)' }}
          />
          <span className={`text-[11.5px] font-medium ${textClass}`}>
            Personal Wealth Cockpit
          </span>
        </div>
      </div>
    </footer>
  )
}

import { useState, type ReactNode } from 'react'
import { AlertIcon, ChevronDownIcon } from '../icons'

export interface PreviewDetail {
  label: string
  value: string
}

interface Props {
  /** e.g. "฿300" */
  paid: string
  /** What the money bought, e.g. "27,645 sats"; undefined until it's filled in */
  got?: string
  /** The holding after this buy (or as it is now, before anything is filled in) */
  total: string
  /** A smaller second line under the total, e.g. "0.52027645 BTC" */
  totalSub?: string
  /** Shown when this buy's price is far from the market, so a typo gets noticed */
  warning?: string
  /** Price this buy, average cost, … — folded away by default */
  details?: PreviewDetail[]
}

/** The two answers people want before logging a buy: what this buy got, and what they hold now */
export function BuyPreview({ paid, got, total, totalSub, warning, details = [] }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-2xl bg-surface-muted p-4 text-sm">
      <dl className="space-y-3">
        <Row label="This buy">
          <span className="text-ink-muted">{paid} → </span>
          <span className={got ? 'font-semibold text-ink' : 'text-ink-muted'}>{got ?? '…'}</span>
        </Row>
        <Row label="Your total">
          <span className="font-semibold text-ink">{total}</span>
          {totalSub && <span className="block text-xs text-ink-muted">{totalSub}</span>}
        </Row>
      </dl>

      {warning && (
        <p role="status" className="mt-3 flex items-start gap-2 rounded-xl bg-warn-soft px-3 py-2 text-xs font-medium text-warn-ink">
          <AlertIcon className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>{warning}</span>
        </p>
      )}

      {details.length > 0 && (
        <div className="mt-3 border-t border-line pt-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex min-h-9 w-full cursor-pointer items-center justify-between text-xs font-semibold text-ink-muted hover:text-ink"
          >
            Details
            <ChevronDownIcon className={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && (
            <dl className="space-y-1.5 pb-1 pt-1 text-xs">
              {details.map((d) => (
                <div key={d.label} className="flex items-baseline justify-between gap-3">
                  <dt className="text-ink-muted">{d.label}</dt>
                  <dd className="text-right font-medium tnum text-ink-soft">{d.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-right tnum">{children}</dd>
    </div>
  )
}

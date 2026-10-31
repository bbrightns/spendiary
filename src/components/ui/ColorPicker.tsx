import { useState } from 'react'
import { CARD_COLORS, CARD_PALETTE } from '../../lib/palette'

const RAINBOW = 'conic-gradient(#ef4444, #f59e0b, #eab308, #22c55e, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #ef4444)'

/** "1d4ed8" or "14d" (no #) → "#1d4ed8"; anything else → undefined */
function parseHex(v: string): string | undefined {
  if (/^[0-9a-f]{6}$/i.test(v)) return `#${v.toLowerCase()}`
  if (/^[0-9a-f]{3}$/i.test(v)) return `#${[...v.toLowerCase()].map((c) => c + c).join('')}`
}

const SWATCH = 'h-8 w-8 rounded-full ring-1 ring-inset ring-black/10 dark:ring-white/20 transition-transform cursor-pointer'
const PICKED = 'scale-110 ring-2 ring-brand ring-offset-2 ring-offset-surface'

/**
 * The palette (three rows of eight) plus a hex field for any other color.
 * With `allowNone`, a "No color" swatch comes first and picks `undefined`.
 */
export function ColorPicker({ value, onChange, allowNone }: {
  value?: string
  onChange: (hex: string | undefined) => void
  allowNone?: boolean
}) {
  // What's typed in the hex field while editing (null = show the current color)
  const [hexDraft, setHexDraft] = useState<string | null>(null)
  const custom = !!value && !CARD_COLORS.includes(value)
  return (
    <div className="space-y-2.5">
      {allowNone && (
        <button
          type="button"
          aria-pressed={!value}
          onClick={() => onChange(undefined)}
          className={`inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition-colors cursor-pointer ${
            !value ? 'border-brand bg-brand-soft text-brand-ink' : 'border-line-strong text-ink-muted hover:text-ink'
          }`}
        >
          No color
        </button>
      )}
      {CARD_PALETTE.map((group) => (
        <div key={group.name} role="group" aria-label={group.name} className="grid w-fit grid-cols-8 gap-2">
          {group.colors.map((c) => (
            <button
              key={c.hex}
              type="button"
              title={c.name}
              aria-label={c.name}
              aria-pressed={value === c.hex}
              onClick={() => onChange(c.hex)}
              className={`${SWATCH} ${value === c.hex ? PICKED : 'hover:scale-105'}`}
              style={{ background: c.hex }}
            />
          ))}
        </div>
      ))}
      {/* Any other color: type a hex code; it applies once it's a full #RGB or #RRGGBB */}
      <div className="flex items-center gap-2.5">
        <span aria-hidden className={`${SWATCH} shrink-0 cursor-default ${custom ? PICKED : ''}`} style={{ background: custom ? value : RAINBOW }} />
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">#</span>
          <input
            value={hexDraft ?? (custom ? value!.slice(1).toUpperCase() : '')}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9a-f]/gi, '').slice(0, 6)
              setHexDraft(v)
              const hex = parseHex(v)
              if (hex) onChange(hex)
            }}
            onBlur={() => setHexDraft(null)}
            placeholder="Custom hex"
            aria-label="Custom color, hex code"
            autoComplete="off"
            spellCheck={false}
            className="h-9 w-36 rounded-xl border border-line-strong bg-surface-muted focus:bg-surface pl-7 pr-3 font-mono text-base uppercase text-ink outline-none transition-colors placeholder:font-sans placeholder:normal-case placeholder:text-sm placeholder:text-ink-faint focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
        </div>
      </div>
    </div>
  )
}

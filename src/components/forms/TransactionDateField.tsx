import { localDateStr } from '../../lib/format'

interface Props {
  value: string
  onChange: (date: string) => void
  label?: string
  hint?: string
}

export function TransactionDateField({
  value,
  onChange,
  label = 'วันที่ทำรายการ (Date)',
  hint,
}: Props) {
  const today = localDateStr()
  const yesterday = localDateStr(new Date(Date.now() - 86_400_000))

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-ink-soft">{label}</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onChange(today)}
            className={`rounded-md px-2 py-0.5 text-xs transition-colors cursor-pointer ${
              value === today
                ? 'bg-brand text-white font-bold shadow-xs'
                : 'bg-surface-muted text-ink-muted hover:bg-surface-muted/80 hover:text-ink font-medium'
            }`}
          >
            วันนี้
          </button>
          <button
            type="button"
            onClick={() => onChange(yesterday)}
            className={`rounded-md px-2 py-0.5 text-xs transition-colors cursor-pointer ${
              value === yesterday
                ? 'bg-brand text-white font-bold shadow-xs'
                : 'bg-surface-muted text-ink-muted hover:bg-surface-muted/80 hover:text-ink font-medium'
            }`}
          >
            เมื่อวาน
          </button>
        </div>
      </div>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border border-line-strong bg-surface px-3.5 text-base text-ink outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/15"
      />
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </div>
  )
}

import { useState, type ReactNode, type SelectHTMLAttributes } from 'react'

const fieldBase =
  'h-11 w-full rounded-xl border bg-surface px-3.5 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-faint'

function getFieldClass(hasError: boolean) {
  return `${fieldBase} ${
    hasError
      ? 'border-loss/60 focus:border-loss focus:ring-2 focus:ring-loss/15'
      : 'border-line-strong focus:border-brand focus:ring-2 focus:ring-brand/15'
  }`
}

interface LabelWrapProps {
  label: string
  hint?: string
  error?: string
  children: ReactNode
}

function LabelWrap({ label, hint, error, children }: LabelWrapProps) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-[13px] font-semibold text-ink-soft">{label}</span>
        {error ? (
          <span className="text-[12px] font-semibold text-loss animate-fadeIn">{error}</span>
        ) : (
          hint && <span className="text-[12px] text-ink-muted">{hint}</span>
        )}
      </div>
      {children}
    </label>
  )
}

interface TextFieldProps {
  label: string
  hint?: string
  error?: string
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  placeholder?: string
  type?: 'text' | 'date'
}

export function TextField({ label, hint, error, value, onChange, onBlur, placeholder, type = 'text' }: TextFieldProps) {
  return (
    <LabelWrap label={label} hint={hint} error={error}>
      <input
        type={type}
        className={getFieldClass(!!error)}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
    </LabelWrap>
  )
}

interface NumberFieldProps {
  label: string
  hint?: string
  error?: string
  value: number | string | ''
  onChange: (v: any) => void
  onBlur?: () => void
  onFocus?: () => void
  placeholder?: string
  prefix?: string
  suffix?: string
  min?: number
  step?: number
  autoFocus?: boolean
  allowString?: boolean
}

export function NumberField({
  label,
  hint,
  error,
  value,
  onChange,
  onBlur,
  onFocus,
  placeholder,
  prefix,
  suffix,
  min = 0,
  step,
  autoFocus,
  allowString,
}: NumberFieldProps) {
  const [isFocused, setIsFocused] = useState(false)

  const getDisplayValue = () => {
    if (value === '') return ''
    if (!allowString) return value.toString()
    if (isFocused) {
      return value.toString().replace(/,/g, '')
    }

    const rawVal = value.toString().replace(/,/g, '')
    const num = Number(rawVal)
    if (isNaN(num)) return value.toString()

    const dotIdx = rawVal.indexOf('.')
    if (prefix === '฿') {
      return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }

    if (suffix === 'shares' || label.toLowerCase().includes('shares') || label.toLowerCase().includes('units')) {
      return num.toLocaleString(undefined, { maximumFractionDigits: 4 })
    }

    if (dotIdx === -1) {
      return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }
    const decLength = rawVal.length - dotIdx - 1
    const maxDec = Math.min(4, Math.max(2, decLength))
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: maxDec })
  }

  const handleFocus = () => {
    setIsFocused(true)
    if (onFocus) onFocus()
  }

  const handleBlur = () => {
    setIsFocused(false)
    if (onBlur) onBlur()
  }

  return (
    <LabelWrap label={label} hint={hint} error={error}>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] font-medium text-ink-muted">
            {prefix}
          </span>
        )}
        {suffix && (
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[15px] font-medium text-ink-muted">
            {suffix}
          </span>
        )}
        <input
          type={allowString ? 'text' : 'number'}
          inputMode="decimal"
          min={min}
          step={step}
          autoFocus={autoFocus}
          className={`${getFieldClass(!!error)} tnum ${prefix ? 'pl-8' : ''} ${suffix ? 'pr-8' : ''}`}
          value={getDisplayValue()}
          placeholder={placeholder}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={(e) => {
            const v = e.target.value
            const stripped = v.replace(/,/g, '')
            if (allowString) {
              onChange(stripped === '' ? '' : stripped)
            } else {
              onChange(stripped === '' ? '' : Number(stripped))
            }
          }}
        />
      </div>
    </LabelWrap>
  )
}

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
  label: string
  value: string
  error?: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}

export function SelectField({ label, value, error, onChange, options }: SelectFieldProps) {
  return (
    <LabelWrap label={label} error={error}>
      <div className="relative">
        <select
          className={`${getFieldClass(!!error)} cursor-pointer appearance-none pr-9`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    </LabelWrap>
  )
}

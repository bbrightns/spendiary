import { useState, useId, type ReactNode, type SelectHTMLAttributes } from 'react'
import { getFieldClass } from './fieldClasses'

interface FieldWrapProps {
  label: string
  htmlFor?: string
  errorId?: string
  hint?: ReactNode
  error?: string
  children: ReactNode
}

/** Label above a control, with a hint (or the error) on the right. Wrap any input with it. */
export function FieldWrap({ label, htmlFor, errorId, hint, error, children }: FieldWrapProps) {
  return (
    <label htmlFor={htmlFor} className="block">
      {/* In a narrow column the hint drops to its own line whole, rather than breaking mid-word */}
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="text-sm font-semibold text-ink-soft">{label}</span>
        {error ? (
          <span id={errorId} role="alert" className="text-xs font-semibold text-loss-ink animate-fade-in">{error}</span>
        ) : (
          hint && <span className="whitespace-nowrap text-xs text-ink-muted">{hint}</span>
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
  const id = useId()
  const errorId = `${id}-error`
  return (
    <FieldWrap label={label} htmlFor={id} errorId={errorId} hint={hint} error={error}>
      <input
        id={id}
        type={type}
        className={getFieldClass(!!error)}
        value={value}
        placeholder={placeholder}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
    </FieldWrap>
  )
}

interface NumberFieldProps {
  label: string
  hint?: string
  error?: string
  value: number | string | ''
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- callers pass both string and number setters
  onChange: (v: any) => void
  onBlur?: () => void
  onFocus?: () => void
  placeholder?: string
  prefix?: string
  suffix?: string
  min?: number
  max?: number
  step?: number
  decimals?: number
  autoFocus?: boolean
  allowString?: boolean
  rightElement?: ReactNode
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
  max,
  step,
  decimals,
  autoFocus,
  allowString = true,
  rightElement,
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

    if (decimals !== undefined) {
      return num.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    }

    const isIntegerStep = step === 1 || (step !== undefined && Number.isInteger(step) && step > 0)
    const isIntegerLabel =
      label.toLowerCase().includes('day') ||
      label.toLowerCase().includes('sats') ||
      label.toLowerCase().includes('satoshi') ||
      label.toLowerCase().includes('completed') ||
      label.toLowerCase().includes('transfers')

    if (isIntegerStep || isIntegerLabel) {
      return num.toLocaleString(undefined, { maximumFractionDigits: 0 })
    }

    const dotIdx = rawVal.indexOf('.')

    if (prefix === '฿') {
      if (dotIdx === -1) {
        return num.toLocaleString(undefined, { maximumFractionDigits: 0 })
      }
      const decLength = rawVal.length - dotIdx - 1
      return num.toLocaleString(undefined, {
        minimumFractionDigits: Math.min(2, decLength),
        maximumFractionDigits: 2,
      })
    }

    if (prefix === '$') {
      if (dotIdx === -1) {
        return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      }
      const decLength = rawVal.length - dotIdx - 1
      return num.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: Math.max(2, decLength),
      })
    }

    if (suffix === 'shares' || label.toLowerCase().includes('shares') || label.toLowerCase().includes('units')) {
      if (dotIdx === -1) {
        return num.toLocaleString(undefined, { maximumFractionDigits: 0 })
      }
      const decLength = rawVal.length - dotIdx - 1
      return num.toLocaleString(undefined, {
        maximumFractionDigits: Math.min(6, Math.max(2, decLength)),
      })
    }

    if (dotIdx === -1) {
      return num.toLocaleString(undefined, { maximumFractionDigits: 0 })
    }

    const decLength = rawVal.length - dotIdx - 1
    const maxDec = Math.min(6, Math.max(2, decLength))
    return num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: maxDec })
  }

  const handleFocus = () => {
    setIsFocused(true)
    if (onFocus) onFocus()
  }

  const handleBlur = () => {
    setIsFocused(false)
    if (onBlur) onBlur()
  }

  const id = useId()
  const errorId = `${id}-error`

  return (
    <FieldWrap label={label} htmlFor={id} errorId={errorId} hint={hint} error={error}>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-medium text-ink-muted">
            {prefix}
          </span>
        )}
        {rightElement ? (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10 flex items-center">
            {rightElement}
          </div>
        ) : suffix ? (
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-base font-medium text-ink-muted">
            {suffix}
          </span>
        ) : null}
        <input
          id={id}
          type={allowString ? 'text' : 'number'}
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          autoFocus={autoFocus}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className={`${getFieldClass(!!error)} tnum ${prefix ? 'pl-8' : ''} ${
            rightElement ? 'pr-16' : suffix ? 'pr-8' : ''
          }`}
          value={getDisplayValue()}
          placeholder={placeholder}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={(e) => {
            const v = e.target.value
            const stripped = v.replace(/,/g, '')
            if (allowString) {
              if (stripped === '' || /^-?\d*\.?\d*$/.test(stripped)) {
                onChange(stripped)
              }
            } else {
              onChange(stripped === '' ? '' : Number(stripped))
            }
          }}
        />
      </div>
    </FieldWrap>
  )
}

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
  label: string
  value: string
  error?: string
  onChange: (v: string) => void
  options: { value: string; label: string; disabled?: boolean }[]
}

export function SelectField({ label, value, error, onChange, options }: SelectFieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  return (
    <FieldWrap label={label} htmlFor={id} errorId={errorId} error={error}>
      <div className="relative">
        <select
          id={id}
          className={`${getFieldClass(!!error)} cursor-pointer appearance-none pr-9`}
          value={value}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
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
    </FieldWrap>
  )
}

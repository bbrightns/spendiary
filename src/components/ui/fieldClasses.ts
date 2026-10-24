/** The one text-field look (DESIGN.md §6.5). Use these instead of copying the class string. */
const fieldBase =
  'h-11 w-full rounded-xl border bg-surface px-3.5 text-base text-ink outline-none transition-colors placeholder:text-ink-faint'

export function getFieldClass(hasError: boolean) {
  return `${fieldBase} ${
    hasError
      ? 'border-loss/60 focus:border-loss focus:ring-2 focus:ring-loss/15'
      : 'border-line-strong focus:border-brand focus:ring-2 focus:ring-brand/15'
  }`
}

/** For a plain <input> / <select> inside a FieldWrap */
export const fieldClass = getFieldClass(false)

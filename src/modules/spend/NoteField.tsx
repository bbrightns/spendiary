import { useMemo, useRef } from 'react'
import { useChipScroll } from './chipScroll'
import { activeTagQuery, parseTags, suggestTags, toggleTag, topTags } from './logic'
import { useSpend } from './useSpend'
import { TAG_CHIP } from './tones'

interface Props {
  value: string
  onChange: (note: string) => void
  placeholder?: string
}

/** Most-used tags offered under the note, in one row that scrolls sideways */
const QUICK_TAGS = 12

/**
 * The note on a transaction or a recurring item: plain text. #tags work for anyone who types
 * them (search and Analysis pick them up): typing `#` offers tags used before, and otherwise one
 * row of the most-used tags sits under the field, a tap adding or removing one.
 */
export function NoteField({ value: note, onChange, placeholder = 'Brown sugar milk tea' }: Props) {
  const { transactions } = useSpend()
  // While typing `#ta…`, offer tags used before that start with it
  const tagQuery = activeTagQuery(note)
  const suggestions = useMemo(() => (tagQuery === null ? [] : suggestTags(transactions, note, tagQuery)), [transactions, note, tagQuery])
  const quick = useMemo(() => topTags(transactions, QUICK_TAGS), [transactions])
  const inNote = new Set(parseTags(note))
  // Fades the side with more tags to scroll to
  const quickRow = useRef<HTMLDivElement>(null)
  const quickFade = useChipScroll(quickRow, quick.join(' '), { active: suggestions.length === 0 && quick.length > 0 })

  /** Finish the `#ta…` being typed with a tag used before. */
  const completeTag = (tag: string) => onChange(note.replace(/#[^\s#]*$/u, `#${tag} `))

  return (
    <div>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Note</span>
        <input
          value={note}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className="h-11 w-full rounded-xl border border-line-strong bg-surface-muted focus:bg-surface px-3.5 text-base text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-brand focus:ring-2 focus:ring-brand/15"
        />
      </label>
      {suggestions.length === 0 && quick.length > 0 && (
        // One row; the rest scroll sideways rather than wrapping
        <div ref={quickRow} className={`no-scrollbar -mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 py-0.5 ${quickFade}`} role="group" aria-label="Most used tags">
          {quick.map((tag) => {
            const on = inNote.has(tag)
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={on}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onChange(toggleTag(note, tag))}
                className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold transition-all cursor-pointer active:scale-95 ${on ? `${TAG_CHIP.on} ring-1 ring-current` : TAG_CHIP.idle}`}
              >
                #{tag}
              </button>
            )
          })}
        </div>
      )}
      {suggestions.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5" role="listbox" aria-label="Tag suggestions">
          {suggestions.map((tag) => (
            <button
              key={tag}
              type="button"
              role="option"
              aria-selected={false}
              // keep focus in the note field so typing can continue
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => completeTag(tag)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all cursor-pointer active:scale-95 ${TAG_CHIP.idle}`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

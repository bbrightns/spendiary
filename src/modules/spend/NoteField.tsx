import { useMemo } from 'react'
import { activeTagQuery, suggestTags } from './logic'
import { useSpend } from './useSpend'
import { TAG_CHIP } from './tones'

interface Props {
  value: string
  onChange: (note: string) => void
  placeholder?: string
}

/**
 * The note on a transaction or a recurring item: plain text. #tags still work for anyone who
 * types them (search and Analysis pick them up), and typing `#` offers tags used before,
 * but the field no longer asks for them.
 */
export function NoteField({ value: note, onChange, placeholder = 'Brown sugar milk tea' }: Props) {
  const { transactions } = useSpend()
  // While typing `#ta…`, offer tags used before that start with it
  const tagQuery = activeTagQuery(note)
  const suggestions = useMemo(() => (tagQuery === null ? [] : suggestTags(transactions, note, tagQuery)), [transactions, note, tagQuery])

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

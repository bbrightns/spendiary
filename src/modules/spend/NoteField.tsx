import { useMemo } from 'react'
import { activeTagQuery, noteTitle, parseTags, recentTags, suggestTags, topTags } from './logic'
import { useSpend } from './useSpend'
import { TAG_CHIP } from './tones'

interface Props {
  value: string
  onChange: (note: string) => void
  /** Title shown when the note has no name of its own (e.g. the category) */
  fallbackTitle: string
  placeholder?: string
}

/**
 * The note on a transaction or a recurring item: a name first, then #tags, with tags
 * used before offered while typing and as one-tap chips, and a preview of how it shows.
 */
export function NoteField({ value: note, onChange, fallbackTitle, placeholder = 'Brown sugar milk tea #nosetea' }: Props) {
  const { transactions } = useSpend()
  const recent = useMemo(() => recentTags(transactions, 3), [transactions])
  const frequent = useMemo(() => topTags(transactions, 8).filter((t) => !recent.includes(t)).slice(0, 5), [transactions, recent])
  const noteTokens = note.toLowerCase().split(/\s+/)
  // While typing `#ta…`, offer tags used before that start with it
  const tagQuery = activeTagQuery(note)
  const suggestions = useMemo(() => (tagQuery === null ? [] : suggestTags(transactions, note, tagQuery)), [transactions, note, tagQuery])
  const previewTags = parseTags(note)
  const previewTitle = noteTitle(note) || fallbackTitle

  const appendTag = (tag: string) => {
    const token = `#${tag}`
    if (noteTokens.includes(token)) return
    onChange(note.trim() ? `${note.trimEnd()} ${token}` : token)
  }

  /** Finish the `#ta…` being typed with a tag used before. */
  const completeTag = (tag: string) => onChange(note.replace(/#[^\s#]*$/u, `#${tag} `))

  return (
    <div>
      <label className="block">
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-ink-soft">Note</span>
          <span className="text-xs text-ink-muted">Name first, then #tags to find it later</span>
        </div>
        <input
          value={note}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className="h-11 w-full rounded-xl border border-line-strong bg-surface px-3.5 text-base text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-brand focus:ring-2 focus:ring-brand/15"
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
      {note.trim() && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-surface-muted/60 px-3 py-2 text-xs">
          <span className="font-semibold text-ink-muted">Shows as</span>
          <span className="min-w-0 truncate font-bold text-ink">{previewTitle}</span>
          {previewTags.map((tag) => (
            <span key={tag} className="rounded-full bg-brand-soft px-2 py-0.5 font-semibold text-brand-ink">
              #{tag}
            </span>
          ))}
        </div>
      )}
      {recent.length + frequent.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {recent.length > 0 && <span className="mr-0.5 text-xs font-semibold text-ink-muted">Recent</span>}
          {recent.map((tag) => {
            const added = noteTokens.includes(`#${tag}`)
            return (
              <button
                key={tag}
                type="button"
                onClick={() => appendTag(tag)}
                aria-pressed={added}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                  added
                    ? TAG_CHIP.on
                    : TAG_CHIP.idle
                }`}
              >
                #{tag}
              </button>
            )
          })}
          {frequent.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => appendTag(tag)}
              className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold text-ink-soft hover:text-ink cursor-pointer"
            >
              #{tag}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

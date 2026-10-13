import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRightIcon } from '../../components/icons'
import { categoriesFor, getCategory, type SpendCategory } from './categories'
import { CategorySheet } from './CategorySheet'
import { TONES } from './tones'
import { KEEP_CATEGORY, useRemoveCategory } from './useRemoveCategory'
import { useSpend } from './useSpend'

export type CategoryLayout = 'chips' | 'tiles'

interface Props {
  type: 'expense' | 'income'
  value: string
  onChange: (id: string) => void
  subcategory: string
  onSubcategoryChange: (label: string) => void
  /** Chips (compact) or tiles; defaults to the user's choice in Spend settings */
  layout?: CategoryLayout
  /** Category picked when the chosen one is removed; defaults to the first one left */
  fallback?: (left: SpendCategory[]) => string | undefined
}

/**
 * Category and subcategory for a transaction or a recurring item, the same in every sheet:
 * pick one, add a new one, or Edit to rename / restyle (tap) and remove (×).
 */
export function CategoryPicker({ type, value, onChange, subcategory, onSubcategoryChange, layout, fallback }: Props) {
  const { settings, subcategories, addSubcategory } = useSpend()
  const removeCategory = useRemoveCategory()
  const [editing, setEditing] = useState(false)
  const [sheet, setSheet] = useState<{ open: boolean; category?: SpendCategory }>({ open: false })
  const [addingSub, setAddingSub] = useState(false)
  const [newSub, setNewSub] = useState('')
  const tiles = (layout ?? settings.categoryLayout ?? 'chips') === 'tiles'

  // Offered subcategories for the chosen category, plus the one already picked if it was since removed
  const subChoices = useMemo(() => {
    const list = subcategories(value)
    return subcategory && !list.includes(subcategory) ? [...list, subcategory] : list
  }, [subcategories, value, subcategory])

  const pick = (id: string) => {
    if (id !== value) onSubcategoryChange('')
    onChange(id)
  }

  /** Take a category out of the picker; if it was picked, another one is picked instead. */
  const remove = (c: SpendCategory) => {
    removeCategory(c)
    if (c.id !== value) return
    const left = categoriesFor(type).filter((x) => x.id !== c.id)
    onChange((fallback ? fallback(left) : undefined) ?? left[0]?.id ?? '')
    onSubcategoryChange('')
  }

  /** Save the typed subcategory under the chosen category and select it. */
  const commitSub = () => {
    const label = newSub.trim()
    if (label) {
      addSubcategory(value, label)
      onSubcategoryChange(label)
    }
    setAddingSub(false)
    setNewSub('')
  }

  const list = categoriesFor(type, value)

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink-soft">Category</p>
        <button
          type="button"
          aria-pressed={editing}
          onClick={() => setEditing((v) => !v)}
          className="-my-1 rounded-full px-2.5 py-1 text-xs font-semibold text-brand cursor-pointer hover:bg-brand-soft"
        >
          {editing ? 'Done' : 'Edit'}
        </button>
      </div>

      {tiles ? (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {list.map((c) => {
            const active = c.id === value
            return (
              <div key={c.id} className="relative">
                <button
                  type="button"
                  aria-pressed={editing ? undefined : active}
                  aria-label={editing ? `Edit ${c.label}` : undefined}
                  onClick={() => (editing ? setSheet({ open: true, category: c }) : pick(c.id))}
                  className={`flex min-h-[72px] w-full flex-col items-center justify-center gap-1 rounded-2xl border px-1 py-2 text-xs transition-all cursor-pointer active:scale-95 ${
                    active ? `${TONES[c.tone].active} font-bold` : 'border-line bg-surface font-semibold text-ink-soft hover:bg-surface-muted/60'
                  } ${editing ? 'border-dashed' : ''}`}
                >
                  <span className={`grid h-8 w-8 place-items-center rounded-xl transition-colors ${active ? 'bg-white/70 dark:bg-white/10' : TONES[c.tone].chip}`}>
                    <c.icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.1 : 1.7} />
                  </span>
                  <span className="w-full truncate text-center leading-tight">{c.label}</span>
                </button>
                {editing && !KEEP_CATEGORY.has(c.id) && (
                  <button
                    type="button"
                    aria-label={`Remove ${c.label}`}
                    onClick={() => remove(c)}
                    className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-loss text-sm font-bold leading-none text-white shadow-sm cursor-pointer hover:brightness-110"
                  >
                    ×
                  </button>
                )}
              </div>
            )
          })}
          <button
            type="button"
            onClick={() => setSheet({ open: true })}
            className="flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-line-strong px-1 py-2 text-xs font-semibold text-ink-muted transition-all cursor-pointer hover:bg-surface-muted/60 hover:text-ink active:scale-95"
          >
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-surface-muted text-lg leading-none">+</span>
            <span>New</span>
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {list.map((c) => {
            const on = c.id === value
            const removable = editing && !KEEP_CATEGORY.has(c.id)
            return (
              <span
                key={c.id}
                className={`inline-flex items-center rounded-full border text-xs font-semibold ${on ? TONES[c.tone].active : 'border-line text-ink-soft'} ${
                  editing ? 'border-dashed' : ''
                }`}
              >
                <button
                  type="button"
                  aria-pressed={editing ? undefined : on}
                  aria-label={editing ? `Edit ${c.label}` : undefined}
                  onClick={() => (editing ? setSheet({ open: true, category: c }) : pick(c.id))}
                  className={`flex min-h-8 items-center gap-1.5 rounded-full py-1.5 pl-2.5 cursor-pointer ${removable ? 'pr-1' : 'pr-2.5'} ${on ? '' : 'hover:bg-surface-muted/60'}`}
                >
                  <c.icon className="h-3.5 w-3.5" />
                  {c.label}
                </button>
                {removable && (
                  <button
                    type="button"
                    aria-label={`Remove ${c.label}`}
                    onClick={() => remove(c)}
                    className="mr-0.5 grid h-6 w-6 place-items-center rounded-full text-sm leading-none text-ink-muted cursor-pointer hover:bg-loss/15 hover:text-loss"
                  >
                    ×
                  </button>
                )}
              </span>
            )
          })}
          <button
            type="button"
            onClick={() => setSheet({ open: true })}
            className="flex min-h-8 items-center gap-1 rounded-full border border-dashed border-line-strong px-2.5 py-1.5 text-xs font-semibold text-ink-muted cursor-pointer hover:bg-surface-muted/60 hover:text-ink"
          >
            <span className="leading-none">+</span> New
          </button>
        </div>
      )}

      {/* Sub-level: indented under the category, led by a > in that category's color */}
      <div className="mt-3 flex gap-2.5 pl-3">
        <span className={`mt-1.5 grid h-5 w-5 shrink-0 place-items-center rounded-md ${TONES[getCategory(value)?.tone ?? 'slate'].chip}`} aria-hidden="true">
          <ChevronRightIcon className="h-3.5 w-3.5" strokeWidth={2.4} />
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5" role="group" aria-label="Subcategory">
          {subChoices.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={s === subcategory}
              onClick={() => onSubcategoryChange(s === subcategory ? '' : s)}
              className={`h-8 rounded-full border px-3 text-xs font-semibold transition-colors cursor-pointer ${
                s === subcategory ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-ink-soft hover:bg-surface-muted/60'
              }`}
            >
              {s}
            </button>
          ))}
          {addingSub ? (
            <input
              autoFocus
              value={newSub}
              onChange={(e) => setNewSub(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commitSub()
                } else if (e.key === 'Escape') {
                  e.stopPropagation()
                  setAddingSub(false)
                  setNewSub('')
                }
              }}
              onBlur={commitSub}
              placeholder="Subcategory"
              maxLength={30}
              aria-label="New subcategory"
              className="h-8 w-32 rounded-full border border-brand bg-surface px-3 text-xs font-semibold text-ink outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => setAddingSub(true)}
              className="h-8 rounded-full border border-dashed border-line-strong px-3 text-xs font-semibold text-ink-muted transition-colors cursor-pointer hover:bg-surface-muted/60 hover:text-ink"
            >
              + Sub
            </button>
          )}
        </div>
      </div>

      {/* Outside the sheet this picker sits in, so it isn't clipped by it */}
      {createPortal(
        <CategorySheet
          open={sheet.open}
          category={sheet.category}
          type={type}
          onClose={() => setSheet({ open: false })}
          // A new category is picked right away; editing one leaves the pick as it is
          onSaved={sheet.category ? undefined : (id) => pick(id)}
        />,
        document.body,
      )}
    </div>
  )
}

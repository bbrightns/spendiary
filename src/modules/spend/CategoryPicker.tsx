import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDownIcon } from '../../components/icons'
import { categoriesFor, getCategory, type SpendCategory } from './categories'
import { CategorySheet } from './CategorySheet'
import { moveId } from './logic'
import { ReorderSheet } from './ReorderSheet'
import { TONES } from './tones'
import { KEEP_CATEGORY, useRemoveCategory } from './useRemoveCategory'
import { useSpend } from './useSpend'
import { useToast } from '../../store/ToastContext'

export type CategoryLayout = 'chips' | 'tiles'

/** Tiles shown before "more": two rows of five, the last slot being the "more" tile */
const COLLAPSED = 9

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
 * pick one, add a new one, or Edit to rename / restyle (tap), remove (×) and arrange categories, and rename (tap) or remove (×) subcategories.
 */
export function CategoryPicker({ type, value, onChange, subcategory, onSubcategoryChange, layout, fallback }: Props) {
  const { settings, updateSettings, subcategories, addSubcategory, removeSubcategory, renameSubcategory } = useSpend()
  const { showToast } = useToast()
  const removeCategory = useRemoveCategory()
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [arranging, setArranging] = useState(false)
  const [sheet, setSheet] = useState<{ open: boolean; category?: SpendCategory }>({ open: false })
  const [addingSub, setAddingSub] = useState(false)
  const [newSub, setNewSub] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameText, setRenameText] = useState('')
  const tiles = (layout ?? settings.categoryLayout ?? 'tiles') === 'tiles'

  // Offered subcategories for the chosen category, plus the one already picked if it was since removed
  const subChoices = useMemo(() => {
    const list = subcategories(value)
    return subcategory && !list.includes(subcategory) ? [...list, subcategory] : list
  }, [subcategories, value, subcategory])

  const pick = (id: string) => {
    if (id !== value) onSubcategoryChange('')
    onChange(id)
    // Fold the grid back so the subcategories sit right under it; the pick stays in view
    setExpanded(false)
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

  const removeSub = (label: string) => {
    removeSubcategory(value, label)
    if (label === subcategory) onSubcategoryChange('')
  }

  const startRename = (label: string) => {
    setRenaming(label)
    setRenameText(label)
  }

  /** Rename the subcategory being edited, on past transactions too; a name already offered merges into it. */
  const commitRename = () => {
    const from = renaming
    const to = renameText.trim()
    setRenaming(null)
    if (!from || !to || to === from) return
    const merged = subChoices.includes(to)
    const n = renameSubcategory(value, from, to)
    if (from === subcategory) onSubcategoryChange(to)
    const updated = n ? ` · ${n} transaction${n === 1 ? '' : 's'} updated` : ''
    showToast(
      merged ? `Merged ${from} into ${to}${updated}` : `Renamed to ${to}${updated}`,
      'info',
      // A merge can't be pulled apart again, so only a plain rename offers Undo
      merged
        ? undefined
        : {
            label: 'Undo',
            onClick: () => {
              renameSubcategory(value, to, from)
              if (from === subcategory) onSubcategoryChange(from)
            },
          },
    )
  }

  const list = categoriesFor(type, value)
  const current = getCategory(value)
  const tone = current?.tone ?? 'slate'
  const arrangeable = categoriesFor(type).filter((c) => !KEEP_CATEGORY.has(c.id))

  // Tiles fold to two rows; a pick from further down takes the last slot so it's always in view
  const foldable = tiles && list.length > COLLAPSED + 1
  const folded = foldable && !expanded && !editing
  let shown = list
  if (folded) {
    shown = list.slice(0, COLLAPSED)
    if (current && !shown.some((c) => c.id === value) && list.some((c) => c.id === value)) shown = [...shown.slice(0, -1), current]
  }

  const link = '-my-1 rounded-full px-2.5 py-1 text-xs font-semibold text-brand cursor-pointer hover:bg-brand-soft'

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink-soft">Category</p>
        <div className="flex items-center gap-0.5">
          {editing && arrangeable.length > 1 && (
            <button type="button" onClick={() => setArranging(true)} className={link}>
              Arrange
            </button>
          )}
          <button type="button" onClick={() => setSheet({ open: true })} className={link}>
            + New
          </button>
          <button type="button" aria-pressed={editing} onClick={() => setEditing((v) => !v)} className={link}>
            {editing ? 'Done' : 'Edit'}
          </button>
        </div>
      </div>

      {tiles ? (
        <div className="grid grid-cols-5 gap-1.5">
          {shown.map((c) => {
            const active = c.id === value
            return (
              <div key={c.id} className="relative">
                <button
                  type="button"
                  aria-pressed={editing ? undefined : active}
                  aria-label={editing ? `Edit ${c.label}` : undefined}
                  onClick={() => (editing ? setSheet({ open: true, category: c }) : pick(c.id))}
                  className={`flex min-h-[60px] w-full flex-col items-center justify-center gap-1 rounded-2xl border px-1 py-1.5 text-2xs transition-all cursor-pointer active:scale-95 ${
                    active ? `${TONES[c.tone].active} font-bold` : 'border-line bg-surface font-semibold text-ink-soft hover:bg-surface-muted/60'
                  } ${editing ? 'border-dashed' : ''}`}
                >
                  <span className={`grid h-7 w-7 place-items-center rounded-lg transition-colors ${active ? 'bg-white/70 dark:bg-white/10' : TONES[c.tone].chip}`}>
                    <c.icon className="h-4 w-4" strokeWidth={active ? 2.1 : 1.7} />
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
          {foldable && !editing && (
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
              className="flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-line-strong px-1 py-1.5 text-2xs font-semibold text-ink-muted transition-all cursor-pointer hover:bg-surface-muted/60 hover:text-ink active:scale-95"
            >
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-surface-muted">
                <ChevronDownIcon className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} strokeWidth={2} />
              </span>
              <span>{expanded ? 'Less' : `+${list.length - shown.length} more`}</span>
            </button>
          )}
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
        </div>
      )}

      {/* Sub-level: a panel in the picked category's color, headed by its name, so it reads as part of it */}
      {current && (
        <div className={`mt-3 rounded-2xl border px-3 pb-3 pt-2.5 ${TONES[tone].tray}`}>
          <p className={`mb-2 flex items-center gap-1.5 text-xs font-semibold ${TONES[tone].ink}`}>
            <current.icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
            <span className="truncate">
              {current.label} <span className="font-medium">· subcategory (optional)</span>
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Subcategory">
            {subChoices.map((s) => {
              const on = s === subcategory
              if (renaming === s)
                return (
                  <input
                    key={s}
                    autoFocus
                    value={renameText}
                    onChange={(e) => setRenameText(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        commitRename()
                      } else if (e.key === 'Escape') {
                        e.stopPropagation()
                        setRenaming(null)
                      }
                    }}
                    onBlur={commitRename}
                    maxLength={30}
                    aria-label={`Rename subcategory ${s}`}
                    className="h-8 w-32 rounded-full border border-brand bg-surface px-3 text-xs font-semibold text-ink outline-none"
                  />
                )
              return (
                <span
                  key={s}
                  className={`inline-flex h-8 items-center rounded-full border text-xs font-semibold transition-colors ${
                    // Picked: solid in the category's color; the rest are outlined in it
                    on ? `border-transparent ${TONES[tone].bar} font-bold text-black/85` : TONES[tone].subChip
                  } ${editing ? 'border-dashed' : ''}`}
                >
                  <button
                    type="button"
                    aria-pressed={editing ? undefined : on}
                    aria-label={editing ? `Rename subcategory ${s}` : undefined}
                    onClick={() => (editing ? startRename(s) : onSubcategoryChange(on ? '' : s))}
                    className={`h-full rounded-full pl-3 cursor-pointer ${editing ? 'pr-1' : 'pr-3'}`}
                  >
                    {s}
                  </button>
                  {editing && (
                    <button
                      type="button"
                      aria-label={`Remove subcategory ${s}`}
                      onClick={() => removeSub(s)}
                      className="mr-0.5 grid h-6 w-6 place-items-center rounded-full text-sm leading-none cursor-pointer hover:bg-loss/15 hover:text-loss"
                    >
                      ×
                    </button>
                  )}
                </span>
              )
            })}
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
                className={`h-8 rounded-full border border-dashed border-current/50 px-3 text-xs font-semibold transition-colors cursor-pointer hover:bg-surface/60 ${TONES[tone].ink}`}
              >
                {subChoices.length ? '+ Add' : '+ Add subcategory'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Outside the sheet this picker sits in, so it isn't clipped by it */}
      {createPortal(
        <>
          <CategorySheet
            open={sheet.open}
            category={sheet.category}
            type={type}
            onClose={() => setSheet({ open: false })}
            // A new category is picked right away; editing one leaves the pick as it is
            onSaved={sheet.category ? undefined : (id) => pick(id)}
          />
          <ReorderSheet
            open={arranging}
            onClose={() => setArranging(false)}
            title={type === 'income' ? 'Arrange income categories' : 'Arrange categories'}
            description="Sets the order in Quick add and recurring. Other always stays last."
            items={arrangeable.map((c) => ({
              id: c.id,
              label: c.label,
              leading: (
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${TONES[c.tone].chip}`}>
                  <c.icon className="h-4 w-4" />
                </span>
              ),
            }))}
            onMove={(id, delta) =>
              updateSettings({ categoryOrder: { ...settings.categoryOrder, [type]: moveId(arrangeable.map((c) => c.id), id, delta) } })
            }
            canReset={!!settings.categoryOrder?.[type]}
            onReset={() => updateSettings({ categoryOrder: { ...settings.categoryOrder, [type]: undefined } })}
          />
        </>,
        document.body,
      )}
    </div>
  )
}

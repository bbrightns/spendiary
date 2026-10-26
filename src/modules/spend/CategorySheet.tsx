import { useMemo, useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { FormActions } from '../../components/forms/FormActions'
import { useToast } from '../../store/ToastContext'
import { Button } from '../../components/ui/Button'
import { PencilIcon, SearchIcon } from '../../components/icons'
import { CATEGORY_ICON_GROUPS, pickableCategoryIcons } from '../../components/categoryIcons'
import { CATEGORY_ICONS, CATEGORY_TONES, SPEND_CATEGORIES, categoriesFor, manageableCategories, pickerTone, type SpendCategory } from './categories'
import { moveId } from './logic'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { ArrangeButton, ReorderSheet } from './ReorderSheet'
import { TONES, TYPE_ACTIVE, type Tone } from './tones'
import { useSpend } from './useSpend'
import { KEEP_CATEGORY, useCategoryUsage, useRemoveCategory } from './useRemoveCategory'

type CatType = 'expense' | 'income'

interface Props {
  open: boolean
  /** Category to edit; omit to add one */
  category?: SpendCategory
  /** Type for a new category */
  type?: CatType
  onClose: () => void
  /** Called with the id after saving (e.g. to select the new category) */
  onSaved?: (id: string) => void
}

const TYPE_OPTIONS = [
  { value: 'expense' as const, label: 'Expense', activeClassName: TYPE_ACTIVE.expense },
  { value: 'income' as const, label: 'Income', activeClassName: TYPE_ACTIVE.income },
]

/**
 * Any category but the catch-all "Other" can go. A built-in, or one past transactions use, is hidden
 * instead (so history keeps its name); a built-in that is already hidden has nothing left to delete.
 */
const canRemove = (c: SpendCategory) => !KEEP_CATEGORY.has(c.id) && !(c.hidden && !c.custom)

/** Add or edit a category: name, icon and color, for expense or income. */
export function CategorySheet({ open, category, type = 'expense', onClose, onSaved }: Props) {
  const { upsertCategory, resetCategory, subcategories, addSubcategory, removeSubcategory } = useSpend()
  const usageOf = useCategoryUsage()
  const [warning, setWarning] = useState<string[] | null>(null)
  const { showToast } = useToast()
  const remove = useRemoveCategory()
  const [form, setForm] = useState({ type: type as CatType, label: '', icon: 'tag', tone: 'violet' as Tone, hidden: false })
  const [lastOpen, setLastOpen] = useState(false)
  const [newSub, setNewSub] = useState('')
  const [iconQuery, setIconQuery] = useState('')
  if (open !== lastOpen) {
    setLastOpen(open)
    setIconQuery('')
    if (open)
      setForm(
        category
          ? { type: category.type, label: category.label, icon: category.iconKey, tone: category.tone, hidden: !!category.hidden }
          : { type, label: '', icon: 'tag', tone: CATEGORY_TONES[(Math.random() * CATEGORY_TONES.length) | 0], hidden: false },
      )
  }

  const shipped = category && !category.custom ? SPEND_CATEGORIES.find((c) => c.id === category.id) : undefined
  const changed = shipped && (shipped.label !== category?.label || shipped.iconKey !== category?.iconKey || shipped.tone !== category?.tone || !!category?.hidden)
  const canSave = form.label.trim() !== ''
  const canDelete = !!category && canRemove(category)
  const Icon = CATEGORY_ICONS[form.icon] ?? CATEGORY_ICONS.tag
  const iconMatches = pickableCategoryIcons(iconQuery)
  const iconGroups = CATEGORY_ICON_GROUPS.map((g) => ({ ...g, icons: iconMatches.filter((d) => d.group === g.id) })).filter((g) => g.icons.length > 0)

  const save = () => {
    if (!canSave) return
    const id = upsertCategory({ id: category?.id, type: form.type, label: form.label.trim(), icon: form.icon, tone: form.tone, hidden: form.hidden })
    showToast(category ? 'Category updated' : `Added ${form.label.trim()}`)
    onSaved?.(id)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={category ? 'Edit category' : 'New category'}
      size="md"
      footer={
        <FormActions
          hint="Give the category a name"
          editing={!!category}
          canSave={canSave}
          onSave={save}
          onDelete={
            canDelete
              ? () => {
                  // Something still points at it: say what before it goes
                  const usage = usageOf(category)
                  if (usage.length) return setWarning(usage)
                  remove(category)
                  onClose()
                }
              : undefined
          }
        />
      }
    >
      {category && (
        <ConfirmModal
          open={!!warning}
          onClose={() => setWarning(null)}
          title={`Delete ${category.label}?`}
          description="It leaves Settings, Quick add and recurring pickers. Restore it any time from Deleted categories."
          confirmText="Delete category"
          onConfirm={() => {
            setWarning(null)
            remove(category)
            onClose()
          }}
        >
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-soft">
            {(warning ?? []).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </ConfirmModal>
      )}
      <div className="space-y-5">
        <div className="flex items-center gap-3 rounded-2xl bg-surface-muted px-4 py-3">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${TONES[form.tone].chip}`}>
            <Icon className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-base font-bold text-ink">{form.label.trim() || 'Category name'}</span>
            <span className="block text-xs text-ink-muted">{form.type === 'income' ? 'Income' : 'Expense'}</span>
          </span>
        </div>

        {!category && <SegmentedControl options={TYPE_OPTIONS} value={form.type} onChange={(t) => setForm((f) => ({ ...f, type: t }))} ariaLabel="Category type" />}

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Name</span>
          <input
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            maxLength={24}
            placeholder={form.type === 'income' ? 'Freelance' : 'Pets'}
            className="h-11 w-full rounded-xl border border-line-strong bg-surface-muted focus:bg-surface px-3.5 text-base text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
        </label>

        <div>
          <p className="mb-2 text-sm font-semibold text-ink-soft">Icon</p>
          <label className="relative mb-2 block">
            <span className="sr-only">Search icons</span>
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <input
              type="search"
              value={iconQuery}
              onChange={(e) => setIconQuery(e.target.value)}
              placeholder="Search icons, e.g. dog, หมา, cake"
              className="h-10 w-full rounded-xl border border-line-strong bg-surface-muted focus:bg-surface pl-9 pr-3 text-base text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-brand focus:ring-2 focus:ring-brand/15 sm:text-sm"
            />
          </label>
          {/* Its own scroll area, so Color and Subcategories stay one swipe away */}
          <div className="max-h-72 space-y-3 overflow-y-auto overscroll-contain rounded-xl border border-line bg-surface-muted/30 p-2">
            {iconGroups.length === 0 && <p className="px-1 py-6 text-center text-sm text-ink-muted">No icons match "{iconQuery.trim()}"</p>}
            {iconGroups.map((g) => (
              <section key={g.id} aria-label={g.label}>
                <p className="mb-1.5 px-0.5 text-2xs font-bold text-ink-muted">{g.label}</p>
                <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
                  {g.icons.map(({ key, Icon: I }) => {
                    const on = form.icon === key
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-label={`Icon ${key}`}
                        aria-pressed={on}
                        onClick={() => setForm((f) => ({ ...f, icon: key }))}
                        className={`grid aspect-square place-items-center rounded-xl border transition-all cursor-pointer active:scale-95 ${
                          on ? `${TONES[form.tone].active}` : 'border-line bg-surface text-ink-soft hover:bg-surface-muted/60'
                        }`}
                      >
                        <I className="h-5 w-5" />
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-ink-soft">Color</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_TONES.map((t) => (
              <button
                key={t}
                type="button"
                aria-label={`Color ${t}`}
                aria-pressed={pickerTone(form.tone) === t}
                onClick={() => setForm((f) => ({ ...f, tone: t }))}
                className={`h-8 w-8 rounded-full transition-transform cursor-pointer ${TONES[t].bar} ${
                  pickerTone(form.tone) === t ? 'scale-110 ring-2 ring-brand ring-offset-2 ring-offset-surface' : ''
                }`}
              />
            ))}
          </div>
        </div>

        {category && (
          <div>
            <p className="mb-2 text-sm font-semibold text-ink-soft">Subcategories</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {subcategories(category.id).map((s) => (
                <span key={s} className="inline-flex h-8 items-center gap-1 rounded-full border border-line bg-surface pl-3 pr-1 text-xs font-semibold text-ink-soft">
                  {s}
                  <button
                    type="button"
                    aria-label={`Remove ${s}`}
                    onClick={() => removeSubcategory(category.id, s)}
                    className="grid h-6 w-6 place-items-center rounded-full text-ink-muted cursor-pointer hover:bg-surface-muted hover:text-ink"
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                value={newSub}
                onChange={(e) => setNewSub(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  addSubcategory(category.id, newSub)
                  setNewSub('')
                }}
                placeholder="+ Add, then Enter"
                maxLength={30}
                aria-label="New subcategory"
                className="h-8 w-36 rounded-full border border-dashed border-line-strong bg-transparent px-3 text-xs font-semibold text-ink outline-none focus:border-brand"
              />
            </div>
            <p className="mt-1.5 text-xs text-ink-muted">Past transactions keep a removed subcategory.</p>
          </div>
        )}

        {changed && (
          <button
            type="button"
            onClick={() => {
              resetCategory(category!.id)
              showToast(`Reset to ${shipped!.label}`, 'info')
              onClose()
            }}
            className="text-sm font-semibold text-link hover:underline cursor-pointer"
          >
            Reset to default ({shipped!.label})
          </button>
        )}
      </div>
    </Modal>
  )
}

/** Every expense or income category, tap to edit, plus one to add and a way to arrange them; for the settings page. */
export function CategoryManager() {
  const { settings, updateSettings, setCategoryHidden, transactions, recurring } = useSpend()
  const { showToast, toasts, dismissToast } = useToast()
  // How many transactions use each category, and which ones a recurring item still logs into
  const usage = useMemo(() => {
    const txns = new Map<string, number>()
    for (const t of transactions) if (t.categoryId) txns.set(t.categoryId, (txns.get(t.categoryId) ?? 0) + 1)
    return { txns, recurring: new Set(recurring.filter((r) => !r.paused).map((r) => r.categoryId)) }
  }, [transactions, recurring])
  const usageLabel = (id: string) => {
    const n = usage.txns.get(id) ?? 0
    // Short enough to fit a tile on a phone
    if (n) return `${n} txn${n === 1 ? '' : 's'}`
    return usage.recurring.has(id) ? 'Recurring' : 'Not used'
  }
  const [type, setType] = useState<CatType>('expense')
  const [sheet, setSheet] = useState<{ open: boolean; category?: SpendCategory }>({ open: false })
  const [arranging, setArranging] = useState(false)
  const [showDeleted, setShowDeleted] = useState(false)
  // Unset means automatic: most used first
  const manualOrder = settings.categorySort === 'manual'
  // A deleted category is only hidden inside (past transactions keep its name); here it just leaves the list
  const list = manageableCategories(type)
  const tiles = list.filter((c) => !c.hidden)
  const deleted = list.filter((c) => c.hidden)
  // Same list the Quick add picker arranges: shown categories, "Other" pinned last
  const arrangeable = categoriesFor(type).filter((c) => !KEEP_CATEGORY.has(c.id))
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <SegmentedControl options={TYPE_OPTIONS} value={type} onChange={setType} ariaLabel="Category type" />
        </div>
        {manualOrder && arrangeable.length > 1 && (
          <ArrangeButton label={type === 'income' ? 'Arrange income categories' : 'Arrange categories'} onClick={() => setArranging(true)} />
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <p className="text-sm font-semibold text-ink-soft">Order</p>
        <SegmentedControl
          ariaLabel="Category order"
          size="sm"
          fullWidth={false}
          value={manualOrder ? 'manual' : 'auto'}
          onChange={(categorySort) => updateSettings({ categorySort })}
          options={[
            { value: 'auto', label: 'Most used' },
            { value: 'manual', label: 'Manual' },
          ]}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tiles.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSheet({ open: true, category: c })}
            aria-label={`Edit ${c.label}`}
            className="group flex min-w-0 items-center gap-2.5 rounded-xl border border-line px-3 py-2.5 text-left transition-colors cursor-pointer hover:bg-surface-muted/60"
          >
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${TONES[c.tone].chip}`}>
              <c.icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink">{c.label}</span>
              <span className="block truncate text-xs text-ink-muted tnum">{usageLabel(c.id)}</span>
            </span>
            {/* Phones have no room beside the name; the line above the list says to tap */}
            <PencilIcon className="hidden h-3.5 w-3.5 shrink-0 text-ink-faint group-hover:text-ink-soft sm:block" />
          </button>
        ))}
        <button
          type="button"
          onClick={() => setSheet({ open: true })}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-strong px-3 py-2.5 text-sm font-semibold text-ink-muted transition-colors cursor-pointer hover:bg-surface-muted/60 hover:text-ink"
        >
          <span className="text-lg leading-none">+</span> Add category
        </button>
      </div>
      {deleted.length > 0 && (
        <button
          type="button"
          onClick={() => {
            // Toasts sit above sheets on phones and would cover the list; its Restore buttons do what their Undo did
            toasts.forEach((t) => dismissToast(t.id))
            setShowDeleted(true)
          }}
          className="text-sm font-semibold text-link hover:underline cursor-pointer"
        >
          Deleted categories ({deleted.length})
        </button>
      )}
      {/* See what was deleted before bringing any back */}
      <Modal
        open={showDeleted && deleted.length > 0}
        onClose={() => setShowDeleted(false)}
        title="Deleted categories"
        description="Past transactions keep these names. Restore the ones you want back."
        size="sm"
        enterToSubmit={false}
        footer={
          deleted.length > 1 ? (
            <Button
              className="w-full"
              onClick={() => {
                deleted.forEach((c) => setCategoryHidden(c.id, false))
                setShowDeleted(false)
                showToast(`${deleted.length} categories restored`)
              }}
            >
              Restore all
            </Button>
          ) : undefined
        }
      >
        <ul className="space-y-2">
          {deleted.map((c) => (
            <li key={c.id} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${TONES[c.tone].chip}`}>
                <c.icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{c.label}</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setCategoryHidden(c.id, false)
                  // Restoring the last one closes the list, so a later delete doesn't reopen it
                  if (deleted.length === 1) setShowDeleted(false)
                  showToast(`Restored ${c.label}`)
                }}
              >
                Restore
              </Button>
            </li>
          ))}
        </ul>
      </Modal>
      <CategorySheet open={sheet.open} category={sheet.category} type={type} onClose={() => setSheet({ open: false })} />
      <ReorderSheet
        open={arranging}
        onClose={() => setArranging(false)}
        title={type === 'income' ? 'Arrange income categories' : 'Arrange categories'}
        description="Sets the order everywhere you pick a category. Other always stays last."
        items={arrangeable.map((c) => ({
          id: c.id,
          label: c.label,
          leading: (
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${TONES[c.tone].chip}`}>
              <c.icon className="h-4 w-4" />
            </span>
          ),
        }))}
        onMove={(id, delta) => updateSettings({ categoryOrder: { ...settings.categoryOrder, [type]: moveId(arrangeable.map((c) => c.id), id, delta) } })}
        canReset={!!settings.categoryOrder?.[type]}
        onReset={() => updateSettings({ categoryOrder: { ...settings.categoryOrder, [type]: undefined } })}
      />
    </div>
  )
}

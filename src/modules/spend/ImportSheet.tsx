import { useEffect, useMemo, useRef, useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../store/ToastContext'
import { thb } from '../../lib/format'
import { SwitchVisual } from './AccountSheets'
import { CATEGORY_ICONS, CATEGORY_TONES, getCategory, guessCategory, manageableCategories } from './categories'
import { guessColumns, looksLikeHeader, matchExisting, parseCsv, toImportRows, type ColumnMap, type Row } from './importCsv'
import { NOT_TRACKED, PayMethodPicker } from './PayMethodPicker'
import { TONES } from './tones'
import { useSpend } from './useSpend'

const OPEN_EVENT = 'spendiary:open-import'

/** Open the statement import sheet from anywhere. */
export function openImport() {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT))
}

const SHOWN = 100

/** "🍜 Food" → "Food": category names from other apps often start with an emoji. */
const cleanName = (s: string) => s.replace(/^[^\p{L}\p{N}]+/u, '').trim()

/** The app's category with this name (any letter case), hidden ones included. */
const categoryNamed = (name: string, type: 'expense' | 'income') =>
  manageableCategories(type).find((c) => c.label.toLowerCase() === name.toLowerCase())

const short = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
}

/** Bank / card statement CSV → Spend transactions, with a review step before anything is saved. */
export function ImportSheet() {
  const { transactions, methods, settings, addTransactions, patchTransactions, upsertCategory, addSubcategory } = useSpend()
  const { showToast } = useToast()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState('')
  const [map, setMap] = useState<ColumnMap | undefined>()
  const [accountId, setAccountId] = useState(NOT_TRACKED)
  const [alreadyIn, setAlreadyIn] = useState(true)
  const [excluded, setExcluded] = useState<Set<number>>(new Set())
  // Fill in matching entries that are already logged (no time / subcategory yet) instead of adding copies
  const [updateMode, setUpdateMode] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onOpen = () => {
      setText('')
      setFileName('')
      setMap(undefined)
      setAccountId(settings.defaultAccountId ?? NOT_TRACKED)
      setAlreadyIn(true)
      setExcluded(new Set())
      setUpdateMode(false)
      setOpen(true)
    }
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_EVENT, onOpen)
  }, [settings.defaultAccountId])

  // Parse; the first row is the header when it has no date in it
  const parsed = useMemo(() => {
    const all = parseCsv(text)
    if (all.length === 0) return undefined
    const hasHeader = looksLikeHeader(all[0])
    const header: Row = hasHeader ? all[0] : all[0].map((_, i) => `Column ${i + 1}`)
    return { header, body: hasHeader ? all.slice(1) : all, guess: hasHeader ? guessColumns(all[0]) : undefined }
  }, [text])
  const columns = map ?? parsed?.guess

  const result = useMemo(() => (parsed && columns ? toImportRows(parsed.body, columns) : undefined), [parsed, columns])

  // Rows that can update an entry already logged bare (e.g. an earlier import that missed the categories).
  // Any wallet counts: the earlier import may have gone to a different one than picked now.
  const matches = useMemo(
    () => (result ? matchExisting(result.rows, transactions.filter((t) => !t.source)) : new Map<number, string>()),
    [result, transactions],
  )

  // Same day, amount and direction on the same account already logged → probably a duplicate
  // (unless both have a time of day and the times differ)
  const rows = useMemo(() => {
    if (!result) return []
    const seen = new Map<string, (string | undefined)[]>()
    for (const t of transactions) {
      if (t.source || (accountId !== NOT_TRACKED && t.accountId !== accountId)) continue
      const key = `${t.date}|${t.type}|${t.amount.toFixed(2)}`
      seen.set(key, [...(seen.get(key) ?? []), t.time])
    }
    return result.rows.map((r, i) => {
      // A category named in the file wins; a name the app doesn't have yet becomes a new category
      const name = r.category ? cleanName(r.category) : ''
      const named = name ? categoryNamed(name, r.type) : undefined
      const times = seen.get(`${r.date}|${r.type}|${r.amount.toFixed(2)}`)
      const updateId = updateMode ? matches.get(i) : undefined
      return {
        ...r,
        category: named ?? (name ? undefined : guessCategory(r.description, r.type)),
        newCategory: name && !named ? name : undefined,
        updateId,
        duplicate: !updateId && !!times?.some((t) => !t || !r.time || t === r.time),
      }
    })
  }, [result, transactions, accountId, updateMode, matches])

  const included = rows.map((r, i) => !excluded.has(i) && !(r.duplicate && !excluded.has(-1 - i)))
  const chosen = rows.filter((_, i) => included[i])
  const spent = chosen.filter((r) => r.type === 'expense').reduce((s, r) => s + r.amount, 0)
  const earned = chosen.filter((r) => r.type === 'income').reduce((s, r) => s + r.amount, 0)
  const duplicates = rows.filter((r) => r.duplicate).length
  const updates = chosen.filter((r) => r.updateId).length
  const adds = chosen.length - updates
  const fromFile = rows.some((r) => r.category || r.newCategory)
  const newCategories = new Set(chosen.filter((r) => r.newCategory).map((r) => `${r.type}|${r.newCategory!.toLowerCase()}`)).size

  // Excluded holds i for an unticked row, and -1 - i for a duplicate the user ticked anyway
  const toggle = (i: number) =>
    setExcluded((prev) => {
      const next = new Set(prev)
      const key = rows[i].duplicate ? -1 - i : i
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  // Tick every row (duplicates included) / untick every row
  const tickAll = () => setExcluded(new Set(rows.flatMap((r, i) => (r.duplicate ? [-1 - i] : []))))
  const untickAll = () => setExcluded(new Set(rows.map((_, i) => i)))

  const save = () => {
    // Categories named in the file but missing from the app are added once each
    const created = new Map<string, string>()
    const categoryIdFor = (r: (typeof chosen)[number]) => {
      if (r.category) return r.category.id
      if (!r.newCategory) return r.type === 'income' ? 'other_in' : 'other'
      const key = `${r.type}|${r.newCategory.toLowerCase()}`
      let id = created.get(key)
      if (!id) {
        const tone = CATEGORY_TONES[created.size % CATEGORY_TONES.length]
        id = upsertCategory({ type: r.type, label: r.newCategory, icon: 'tag', tone })
        created.set(key, id)
      }
      return id
    }
    const toAdd = chosen.filter((r) => !r.updateId)
    // Updates only fill in what the file has; amount, date, note and wallet stay untouched
    const patches = chosen
      .filter((r) => r.updateId)
      .map((r) => ({
        id: r.updateId!,
        categoryId: r.category || r.newCategory ? categoryIdFor(r) : undefined,
        subcategory: r.subcategory,
        time: r.time,
      }))
    const inputs = toAdd.map((r) => ({
      type: r.type,
      amount: r.amount,
      categoryId: categoryIdFor(r),
      subcategory: r.subcategory,
      accountId: accountId || undefined,
      date: r.date,
      time: r.time,
      note: r.description || undefined,
      alreadyInBalance: accountId && alreadyIn ? true : undefined,
    }))
    const withSub = [...inputs, ...patches].filter((t) => t.subcategory && t.categoryId)
    const subs = new Set(withSub.map((t) => JSON.stringify([t.categoryId, t.subcategory])))
    for (const pair of subs) addSubcategory(...(JSON.parse(pair) as [string, string]))
    if (patches.length) patchTransactions(patches)
    const n = inputs.length ? addTransactions(inputs) : 0
    const plural = (k: number) => (k === 1 ? 'transaction' : 'transactions')
    showToast(
      patches.length ? `Updated ${patches.length} ${plural(patches.length)}${n ? `, imported ${n}` : ''}` : `Imported ${n} ${plural(n)}`,
    )
    setOpen(false)
  }

  const readFile = (f: File) => {
    setFileName(f.name)
    const reader = new FileReader()
    reader.onload = () => {
      setText(String(reader.result ?? ''))
      setMap(undefined)
      setExcluded(new Set())
    }
    reader.readAsText(f)
  }

  const colSelect = (label: string, key: keyof ColumnMap, optional = true) => (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs font-semibold text-ink-muted">{label}</span>
      <select
        value={columns?.[key] ?? -1}
        onChange={(e) => {
          const v = Number(e.target.value)
          const base: ColumnMap = columns ?? { date: 0 }
          const next = { ...base, [key]: v < 0 ? undefined : v }
          // One signed amount or separate out / in columns, not both
          if (key === 'amount' && v >= 0) Object.assign(next, { out: undefined, in: undefined })
          if ((key === 'out' || key === 'in') && v >= 0) next.amount = undefined
          setMap(next)
          setExcluded(new Set())
        }}
        className="h-10 w-full truncate rounded-xl border border-line-strong bg-surface px-2.5 text-sm text-ink outline-none focus:border-brand"
      >
        {optional && <option value={-1}>—</option>}
        {parsed?.header.map((h, i) => (
          <option key={i} value={i}>
            {h || `Column ${i + 1}`}
          </option>
        ))}
      </select>
    </label>
  )

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title="Import a statement"
      description="Paste or pick a CSV from your bank or card. Nothing is saved until you check it."
      size="lg"
      footer={
        <Button data-modal-submit className="w-full" disabled={chosen.length === 0} onClick={save}>
          {updates
            ? `Update ${updates}${adds ? ` · add ${adds}` : ''}`
            : chosen.length
              ? `Import ${chosen.length} ${chosen.length === 1 ? 'transaction' : 'transactions'}`
              : 'Import'}
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
              Choose CSV file
            </Button>
            <span className="min-w-0 truncate text-xs text-ink-muted">{fileName || 'or paste below'}</span>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) readFile(f)
                e.target.value = ''
              }}
            />
          </div>
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setFileName('')
              setMap(undefined)
              setExcluded(new Set())
            }}
            rows={4}
            spellCheck={false}
            placeholder={'วันที่,รายการ,ถอนเงิน,ฝากเงิน\n05/10/2569,ค่ากาแฟ,65.00,'}
            aria-label="CSV text"
            className="w-full rounded-xl border border-line-strong bg-surface px-3 py-2 font-mono text-xs text-ink outline-none placeholder:text-ink-faint focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
        </div>

        {parsed && (
          <div>
            <p className="mb-2 text-sm font-semibold text-ink-soft">Columns</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {colSelect('Date', 'date', false)}
              {colSelect('Description', 'description')}
              {colSelect('Money out (or amount)', columns?.amount !== undefined ? 'amount' : 'out')}
              {colSelect('Money in', 'in')}
              {colSelect('Time', 'time')}
              {colSelect('Category', 'category')}
              {colSelect('Subcategory', 'subcategory')}
            </div>
            {!columns && <p className="mt-2 text-xs font-semibold text-warn">Pick the date and amount columns.</p>}
          </div>
        )}

        {rows.length > 0 && (
          <>
            <PayMethodPicker
              label="Account"
              methods={methods}
              value={accountId}
              onChange={setAccountId}
              favoriteIds={settings.favoriteAccountIds ?? []}
              defaultId={settings.defaultAccountId}
              allowNone
            />
            {accountId !== NOT_TRACKED && (
              <button
                type="button"
                role="switch"
                aria-checked={alreadyIn}
                onClick={() => setAlreadyIn((v) => !v)}
                className="-mt-2 flex w-full items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3 text-left cursor-pointer hover:bg-surface-muted/50"
              >
                <span>
                  <span className="block text-sm font-bold text-ink">Already in my balance</span>
                  <span className="block text-xs text-ink-muted">
                    {alreadyIn ? "Past entries: the account's balance stays as it is" : 'Each entry moves the balance, like logging it now'}
                  </span>
                </span>
                <SwitchVisual on={alreadyIn} />
              </button>
            )}
            {matches.size > 0 && (
              <button
                type="button"
                role="switch"
                aria-checked={updateMode}
                onClick={() => {
                  setUpdateMode((v) => !v)
                  setExcluded(new Set())
                }}
                className="-mt-2 flex w-full items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3 text-left cursor-pointer hover:bg-surface-muted/50"
              >
                <span>
                  <span className="block text-sm font-bold text-ink">Update entries already logged</span>
                  <span className="block text-xs text-ink-muted tnum">
                    {matches.size} {matches.size === 1 ? 'row matches an entry' : 'rows match entries'} with the same day and amount but no time
                    or subcategory yet. {updateMode ? 'Their category, subcategory and time are filled in; nothing is added twice.' : 'Turn on to fill those in instead of adding copies.'}
                  </span>
                </span>
                <SwitchVisual on={updateMode} />
              </button>
            )}

            <div>
              <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 text-xs text-ink-muted tnum">
                <span>
                  <b className="font-bold text-ink">{chosen.length}</b> of {rows.length} · out {thb(spent, true)} · in{' '}
                  <span className="text-gain">{thb(earned, true)}</span>
                </span>
                <span className="flex items-center gap-3">
                  <button type="button" onClick={tickAll} className="font-semibold text-brand hover:underline cursor-pointer">
                    Tick all
                  </button>
                  <button type="button" onClick={untickAll} className="font-semibold text-brand hover:underline cursor-pointer">
                    None
                  </button>
                </span>
                <span className="w-full sm:w-auto">
                  {duplicates > 0 && `${duplicates} look already logged`}
                  {duplicates > 0 && (result?.skipped ?? 0) > 0 && ' · '}
                  {(result?.skipped ?? 0) > 0 && `${result!.skipped} rows unreadable`}
                </span>
              </div>
              <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-xl border border-line">
                {rows.slice(0, SHOWN).map((r, i) => {
                  const cat = r.newCategory
                    ? { label: `${r.newCategory} (new)`, tone: 'slate' as const, icon: CATEGORY_ICONS.tag }
                    : r.category ?? getCategory(r.type === 'income' ? 'other_in' : 'other')
                  return (
                    <li key={i}>
                      <label className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 ${included[i] ? '' : 'opacity-50'}`}>
                        <input type="checkbox" checked={included[i]} onChange={() => toggle(i)} className="h-4 w-4 shrink-0 accent-[var(--color-brand)]" />
                        {cat && (
                          <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${TONES[cat.tone].chip}`}>
                            <cat.icon className="h-3.5 w-3.5" />
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-ink">{r.description || cat?.label}</span>
                          <span className="block truncate text-xs text-ink-muted">
                            {short(r.date)}
                            {r.time ? ` ${r.time}` : ''} · {cat?.label}
                            {r.subcategory ? ` › ${r.subcategory}` : ''}
                            {r.updateId ? ' · updates the logged entry' : r.duplicate ? ' · already logged?' : ''}
                          </span>
                        </span>
                        <span className={`shrink-0 text-sm font-bold tnum ${r.type === 'income' ? 'text-gain' : 'text-ink'}`}>
                          {r.type === 'income' ? '+' : '−'}
                          {thb(r.amount, true)}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
              {rows.length > SHOWN && <p className="mt-1.5 text-xs text-ink-muted">Showing the first {SHOWN}; all {chosen.length} ticked rows will be imported.</p>}
              <p className="mt-1.5 text-xs text-ink-muted">
                {fromFile
                  ? `Categories come from the file${newCategories ? `; ${newCategories} new ${newCategories === 1 ? 'one is' : 'ones are'} added` : ''}. Edit any of them afterwards.`
                  : 'Categories are guessed from the description; edit any of them afterwards.'}
              </p>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

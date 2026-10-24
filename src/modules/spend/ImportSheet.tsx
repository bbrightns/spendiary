import { useEffect, useMemo, useRef, useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../store/ToastContext'
import { thb } from '../../lib/format'
import { SwitchVisual } from '../../components/ui/SwitchVisual'
import { CATEGORY_ICONS, CATEGORY_TONES, TransferIcon, getCategory, guessCategory, manageableCategories } from './categories'
import { guessColumns, investCandidates, looksLikeHeader, pairExisting, parseCsv, sameNote, toImportRows, type ColumnMap, type Row } from './importCsv'
import { NOT_TRACKED, PayMethodPicker } from './PayMethodPicker'
import { TONES } from './tones'
import { useSpend } from './useSpend'
import { SHEET_EVENTS } from './sheetEvents'

const OPEN_EVENT = SHEET_EVENTS.import

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

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/**
 * Bank / card statement CSV → Spend transactions, with a review step before anything is saved.
 * Each row is new, already in the app as is (skipped), or already in the app with less detail
 * (its category, subcategory and time are filled in on that entry instead of adding a copy).
 */
export function ImportSheet() {
  const { transactions, methods, settings, addTransactions, patchTransactions, upsertCategory, addSubcategory } = useSpend()
  const { showToast } = useToast()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState('')
  const [map, setMap] = useState<ColumnMap | undefined>()
  const [accountId, setAccountId] = useState(NOT_TRACKED)
  const [alreadyIn, setAlreadyIn] = useState(true)
  // Rows the user ticked or unticked; the rest follow their default (see `defaultPick`)
  const [picked, setPicked] = useState<Map<number, boolean>>(new Map())
  const [showSame, setShowSame] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const resetPicks = () => {
    setPicked(new Map())
    setShowSame(false)
  }

  useEffect(() => {
    const onOpen = () => {
      setText('')
      setFileName('')
      setMap(undefined)
      setAccountId(settings.defaultAccountId ?? NOT_TRACKED)
      setAlreadyIn(true)
      setPicked(new Map())
      setShowSame(false)
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

  // A transfer row needs the wallet it went to; if that isn't tracked here (e.g. a top-up to an outside wallet), money still left, so it's an expense
  const fileHasAccounts = columns?.account !== undefined
  const resolved = useMemo(() => {
    if (!result) return undefined
    const byName = (name?: string) => (name ? methods.find((m) => m.name.trim().toLowerCase() === name.trim().toLowerCase())?.id : undefined)
    return result.rows.map((r) => {
      if (r.type !== 'transfer') return { ...r, type: r.type, fromId: undefined as string | undefined, toId: undefined as string | undefined }
      // A file that names accounts says where it came from: none (e.g. a card paid outside the app) means no wallet, not the one picked here
      const fromId = byName(r.account) ?? (fileHasAccounts ? undefined : accountId || undefined)
      const toId = byName(r.toAccount)
      if (toId && fromId !== toId) return { ...r, type: 'transfer' as const, fromId, toId }
      return { ...r, type: 'expense' as const, fromId, toId: undefined }
    })
  }, [result, methods, accountId, fileHasAccounts])

  // Which entry in the app each row is (same day, direction, amount; same time when both have one)
  const pairs = useMemo(
    () =>
      resolved
        ? pairExisting(
            resolved,
            // Buys and dividends from Invest already moved this account's balance, so its statement lines count as in the app
            [...transactions.filter((t) => !t.source), ...(accountId === NOT_TRACKED ? [] : investCandidates(transactions, accountId))],
            accountId === NOT_TRACKED ? undefined : accountId,
          )
        : undefined,
    [resolved, transactions, accountId],
  )

  const rows = useMemo(() => {
    if (!resolved || !pairs) return []
    return resolved.map((r, i) => {
      // Transfers have no category; for the others, a category named in the file wins and a name the app doesn't have yet becomes a new category
      const kind = r.type === 'transfer' ? undefined : r.type
      const name = kind && r.category ? cleanName(r.category) : ''
      const named = kind && name ? categoryNamed(name, kind) : undefined
      const category = kind ? (named ?? (name ? undefined : guessCategory(r.description, kind))) : undefined
      const newCategory = name && !named ? name : undefined
      const match = pairs.get(i)
      // What the file would add to the matched entry; only what the file actually has counts
      let change = ''
      let overwrite = false
      let noteDiffers = false
      // Invest rows are read-only here: matched means "already in the app", nothing to fill in
      if (match && !match.source && r.type !== 'transfer') {
        const oldCat = getCategory(match.categoryId)?.label ?? 'Other'
        const newCat = name ? (newCategory ?? category?.label ?? oldCat) : oldCat
        const sub = r.subcategory ?? match.subcategory
        const from = `${oldCat}${match.subcategory ? ` › ${match.subcategory}` : ''}`
        const to = `${newCat}${sub ? ` › ${sub}` : ''}`
        noteDiffers = !!r.description && !sameNote(match.note, r.description)
        const quote = (t: string) => `“${t.replace(/\s+/g, ' ').trim()}”`
        const parts = [
          from !== to ? `${from} → ${to}` : '',
          r.time && !match.time ? `+ ${r.time}` : '',
          noteDiffers ? (match.note ? `note ${quote(match.note)} → ${quote(r.description)}` : `+ note ${quote(r.description)}`) : '',
        ].filter(Boolean)
        change = parts.join(' · ')
        // Replacing details the entry already had (not just filling in blanks) needs a tick from the user
        overwrite = ((!!match.subcategory || !!match.time) && from !== to) || (noteDiffers && !!match.note)
      }
      const status: 'new' | 'same' | 'update' = !match ? 'new' : change ? 'update' : 'same'
      return { ...r, category, newCategory, match, status, change, overwrite, noteDiffers }
    })
  }, [resolved, pairs])

  const nameOf = (id?: string) => methods.find((m) => m.id === id)?.name ?? ''
  const defaultPick = (r: (typeof rows)[number]) => r.status === 'new' || (r.status === 'update' && !r.overwrite)
  const included = rows.map((r, i) => picked.get(i) ?? defaultPick(r))
  const chosen = rows.filter((_, i) => included[i])
  const moved = chosen.filter((r) => r.type === 'transfer').reduce((s, r) => s + r.amount, 0)
  const spent = chosen.filter((r) => r.type === 'expense').reduce((s, r) => s + r.amount, 0)
  const earned = chosen.filter((r) => r.type === 'income').reduce((s, r) => s + r.amount, 0)
  const count = { same: 0, update: 0, new: 0 }
  for (const r of rows) count[r.status]++
  const updates = chosen.filter((r) => r.status === 'update').length
  const adds = chosen.length - updates
  const fromFile = rows.some((r) => r.category || r.newCategory)
  const newCategories = new Set(chosen.filter((r) => r.newCategory).map((r) => `${r.type}|${r.newCategory!.toLowerCase()}`)).size

  // Rows already in the app as they are stay out of the list unless asked for
  const visible = rows.map((r, i) => ({ r, i })).filter(({ r }) => showSame || r.status !== 'same')
  const toggle = (i: number) => setPicked((prev) => new Map(prev).set(i, !included[i]))
  const tickAll = () => setPicked(new Map(visible.map(({ i }) => [i, true])))
  const untickAll = () => setPicked(new Map(rows.map((_, i) => [i, false])))

  const save = () => {
    // Categories named in the file but missing from the app are added once each
    const created = new Map<string, string>()
    const categoryIdFor = (r: (typeof chosen)[number]) => {
      if (r.category) return r.category.id
      if (!r.newCategory) return r.type === 'income' ? 'other_in' : 'other'
      if (r.type === 'transfer') return undefined
      const key = `${r.type}|${r.newCategory.toLowerCase()}`
      let id = created.get(key)
      if (!id) {
        const tone = CATEGORY_TONES[created.size % CATEGORY_TONES.length]
        id = upsertCategory({ type: r.type as 'expense' | 'income', label: r.newCategory, icon: 'tag', tone })
        created.set(key, id)
      }
      return id
    }
    // Updates only fill in what the file has; amount, date, note and wallet stay untouched
    const patches = chosen
      .filter((r) => r.status === 'update')
      .map((r) => ({
        id: r.match!.id,
        categoryId: r.category || r.newCategory ? categoryIdFor(r) : undefined,
        subcategory: r.subcategory,
        time: r.time,
        note: r.noteDiffers ? r.description : undefined,
      }))
    // New rows, plus any "already in the app" row the user ticked on purpose (logged as a copy)
    const inputs = chosen
      .filter((r) => r.status !== 'update')
      .map((r) => ({
        type: r.type,
        amount: r.amount,
        categoryId: r.type === 'transfer' ? undefined : categoryIdFor(r),
        subcategory: r.type === 'transfer' ? undefined : r.subcategory,
        // A transfer keeps exactly the wallets it names, even no "from"
        accountId: r.type === 'transfer' ? r.fromId : (r.fromId ?? (accountId || undefined)),
        toAccountId: r.toId,
        date: r.date,
        time: r.time,
        note: r.description || undefined,
        alreadyInBalance: (r.type === 'transfer' ? r.fromId || r.toId : r.fromId || accountId) && alreadyIn ? true : undefined,
      }))
    const withSub = [...inputs, ...patches].filter((t) => t.subcategory && t.categoryId)
    const subs = new Set(withSub.map((t) => JSON.stringify([t.categoryId, t.subcategory])))
    for (const pair of subs) addSubcategory(...(JSON.parse(pair) as [string, string]))
    if (patches.length) patchTransactions(patches)
    if (inputs.length) addTransactions(inputs)
    const parts = [patches.length ? `Updated ${plural(patches.length, 'transaction')}` : '', inputs.length ? `${patches.length ? 'imported' : 'Imported'} ${plural(inputs.length, 'new one')}` : '']
    showToast(parts.filter(Boolean).join(', '))
    setOpen(false)
  }

  const readFile = (f: File) => {
    setFileName(f.name)
    const reader = new FileReader()
    reader.onload = () => {
      setText(String(reader.result ?? ''))
      setMap(undefined)
      resetPicks()
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
          resetPicks()
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
              ? `Import ${plural(chosen.length, 'transaction')}`
              : rows.length && count.same === rows.length
                ? 'Nothing new to import'
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
              resetPicks()
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
              {colSelect('Type', 'type')}
              {colSelect('Account', 'account')}
              {colSelect('To account', 'toAccount')}
            </div>
            {!columns && <p className="mt-2 text-xs font-semibold text-warn-ink">Pick the date and amount columns.</p>}
          </div>
        )}

        {rows.length > 0 && (
          <>
            <PayMethodPicker
              label="Account"
              methods={methods}
              value={accountId}
              onChange={(id) => {
                setAccountId(id)
                resetPicks()
              }}
              favoriteIds={settings.favoriteAccountIds ?? []}
              defaultId={settings.defaultAccountId}
              allowNone
            />
            {accountId !== NOT_TRACKED && count.new > 0 && (
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

            {/* What the file holds compared with what's already in the app */}
            <div className="rounded-2xl bg-surface-muted px-4 py-3">
              <p className="text-sm font-bold text-ink">
                {count.same === rows.length
                  ? `All ${plural(rows.length, 'row')} are already in the app, nothing differs`
                  : count.new === rows.length
                    ? plural(rows.length, 'new row')
                    : `${plural(rows.length, 'row')}: ${[
                        count.update ? `${count.update} already in the app with different details` : '',
                        count.new ? `${count.new} new` : '',
                      ]
                        .filter(Boolean)
                        .join(' · ')}`}
              </p>
              {count.same > 0 && count.same < rows.length && (
                <p className="mt-0.5 text-xs text-ink-muted tnum">
                  {plural(count.same, 'row is', 'rows are')} already in the app exactly as they are and won't be added again.
                </p>
              )}
              {count.update > 0 && (
                <p className="mt-0.5 text-xs text-ink-muted">
                  Rows with different details update that entry's category, subcategory, time and note. Its amount, date and wallet stay.
                </p>
              )}
              {count.same > 0 && (
                <button type="button" onClick={() => setShowSame((v) => !v)} className="mt-1 text-xs font-semibold text-link hover:underline cursor-pointer">
                  {showSame ? 'Hide' : 'Show'} the {plural(count.same, 'matching row')}
                </button>
              )}
            </div>

            {visible.length > 0 && (
              <div>
                <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 text-xs text-ink-muted tnum">
                  <span>
                    <b className="font-bold text-ink">{chosen.length}</b> ticked · out {thb(spent, true)} · in <span className="text-gain-ink">{thb(earned, true)}</span>
                    {moved > 0 && ` · moved ${thb(moved, true)}`}
                    {(result?.skipped ?? 0) > 0 && ` · ${plural(result!.skipped, 'row')} unreadable`}
                  </span>
                  <span className="flex items-center gap-3">
                    <button type="button" onClick={tickAll} className="font-semibold text-link hover:underline cursor-pointer">
                      Tick all
                    </button>
                    <button type="button" onClick={untickAll} className="font-semibold text-link hover:underline cursor-pointer">
                      None
                    </button>
                  </span>
                </div>
                <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-xl border border-line">
                  {visible.slice(0, SHOWN).map(({ r, i }) => {
                    const cat = r.newCategory
                      ? { label: `${r.newCategory} (new)`, tone: 'slate' as const, icon: CATEGORY_ICONS.tag }
                      : r.category ?? getCategory(r.type === 'income' ? 'other_in' : 'other')
                    return (
                      <li key={i}>
                        <label className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 ${included[i] ? '' : 'opacity-50'}`}>
                          <input type="checkbox" checked={included[i]} onChange={() => toggle(i)} className="h-4 w-4 shrink-0 accent-[var(--color-brand)]" />
                          {/* Same as in History: a transfer has no category, it moves money */}
                          {r.type === 'transfer' ? (
                            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${TONES.sky.chip}`}>
                              <TransferIcon className="h-3.5 w-3.5" />
                            </span>
                          ) : (
                            cat && (
                              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${TONES[cat.tone].chip}`}>
                                <cat.icon className="h-3.5 w-3.5" />
                              </span>
                            )
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-ink">{r.description || cat?.label}</span>
                            <span className="block truncate text-xs text-ink-muted">
                              {short(r.date)}
                              {r.time ? ` ${r.time}` : ''} ·{' '}
                              {r.status === 'update' ? (
                                <span className={r.overwrite ? 'font-semibold text-warn-ink' : 'font-semibold text-link'}>
                                  {r.overwrite ? 'Replaces ' : ''}
                                  {r.change}
                                </span>
                              ) : (
                                <>
                                  {r.type === 'transfer' ? `${nameOf(r.fromId) || '—'} → ${nameOf(r.toId)}` : cat?.label}
                                  {r.type !== 'transfer' && r.subcategory ? ` › ${r.subcategory}` : ''}
                                  {r.status === 'same' ? (r.match?.source ? ' · already in the app from Invest' : ' · already in the app') : ''}
                                </>
                              )}
                            </span>
                          </span>
                          <span className={`shrink-0 text-sm font-bold tnum ${r.type === 'income' ? 'text-gain-ink' : r.type === 'transfer' ? 'text-ink-muted' : 'text-ink'}`}>
                            {r.type === 'income' ? '+' : r.type === 'transfer' ? '' : '−'}
                            {thb(r.amount, true)}
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
                {visible.length > SHOWN && (
                  <p className="mt-1.5 text-xs text-ink-muted">Showing the first {SHOWN}; all {chosen.length} ticked rows will be saved.</p>
                )}
                <p className="mt-1.5 text-xs text-ink-muted">
                  {fromFile
                    ? `Categories come from the file${newCategories ? `; ${newCategories} new ${newCategories === 1 ? 'one is' : 'ones are'} added` : ''}. Edit any of them afterwards.`
                    : 'Categories are guessed from the description; edit any of them afterwards.'}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}

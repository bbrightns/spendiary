import { useEffect, useMemo, useRef, useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../store/ToastContext'
import { thb } from '../../lib/format'
import { SwitchVisual } from './AccountSheets'
import { getCategory, guessCategory } from './categories'
import { guessColumns, looksLikeHeader, parseCsv, toImportRows, type ColumnMap, type Row } from './importCsv'
import { NOT_TRACKED, PayMethodPicker } from './PayMethodPicker'
import { TONES } from './tones'
import { useSpend } from './useSpend'

const OPEN_EVENT = 'spendiary:open-import'

/** Open the statement import sheet from anywhere. */
export function openImport() {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT))
}

const SHOWN = 100

const short = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
}

/** Bank / card statement CSV → Spend transactions, with a review step before anything is saved. */
export function ImportSheet() {
  const { transactions, methods, settings, addTransactions } = useSpend()
  const { showToast } = useToast()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState('')
  const [map, setMap] = useState<ColumnMap | undefined>()
  const [accountId, setAccountId] = useState(NOT_TRACKED)
  const [alreadyIn, setAlreadyIn] = useState(true)
  const [excluded, setExcluded] = useState<Set<number>>(new Set())
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onOpen = () => {
      setText('')
      setFileName('')
      setMap(undefined)
      setAccountId(settings.defaultAccountId ?? NOT_TRACKED)
      setAlreadyIn(true)
      setExcluded(new Set())
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

  // Same day, amount and direction on the same account already logged → probably a duplicate
  const rows = useMemo(() => {
    if (!result) return []
    const seen = new Set(
      transactions
        .filter((t) => !t.source && (accountId === NOT_TRACKED || t.accountId === accountId))
        .map((t) => `${t.date}|${t.type}|${t.amount.toFixed(2)}`),
    )
    return result.rows.map((r) => ({
      ...r,
      category: guessCategory(r.description, r.type),
      duplicate: seen.has(`${r.date}|${r.type}|${r.amount.toFixed(2)}`),
    }))
  }, [result, transactions, accountId])

  const included = rows.map((r, i) => !excluded.has(i) && !(r.duplicate && !excluded.has(-1 - i)))
  const chosen = rows.filter((_, i) => included[i])
  const spent = chosen.filter((r) => r.type === 'expense').reduce((s, r) => s + r.amount, 0)
  const earned = chosen.filter((r) => r.type === 'income').reduce((s, r) => s + r.amount, 0)
  const duplicates = rows.filter((r) => r.duplicate).length

  // Excluded holds i for an unticked row, and -1 - i for a duplicate the user ticked anyway
  const toggle = (i: number) =>
    setExcluded((prev) => {
      const next = new Set(prev)
      const key = rows[i].duplicate ? -1 - i : i
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const save = () => {
    const n = addTransactions(
      chosen.map((r) => ({
        type: r.type,
        amount: r.amount,
        categoryId: r.category?.id ?? (r.type === 'income' ? 'other_in' : 'other'),
        accountId: accountId || undefined,
        date: r.date,
        note: r.description || undefined,
        alreadyInBalance: accountId && alreadyIn ? true : undefined,
      })),
    )
    showToast(`Imported ${n} ${n === 1 ? 'transaction' : 'transactions'}`)
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
          {chosen.length ? `Import ${chosen.length} ${chosen.length === 1 ? 'transaction' : 'transactions'}` : 'Import'}
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
              accept=".csv,.txt,text/csv"
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

            <div>
              <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 text-xs text-ink-muted tnum">
                <span>
                  <b className="font-bold text-ink">{chosen.length}</b> of {rows.length} · out {thb(spent, true)} · in{' '}
                  <span className="text-gain">{thb(earned, true)}</span>
                </span>
                <span>
                  {duplicates > 0 && `${duplicates} look already logged`}
                  {duplicates > 0 && (result?.skipped ?? 0) > 0 && ' · '}
                  {(result?.skipped ?? 0) > 0 && `${result!.skipped} rows unreadable`}
                </span>
              </div>
              <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-xl border border-line">
                {rows.slice(0, SHOWN).map((r, i) => {
                  const cat = r.category ?? getCategory(r.type === 'income' ? 'other_in' : 'other')
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
                            {short(r.date)} · {cat?.label}
                            {r.duplicate ? ' · already logged?' : ''}
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
              <p className="mt-1.5 text-xs text-ink-muted">Categories are guessed from the description; edit any of them afterwards.</p>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

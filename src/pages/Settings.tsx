import { useRef, useState } from 'react'
import { useData, type DataBackup } from '../store/DataContext'
import { useTheme, type Theme } from '../hooks/useTheme'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { TextField } from '../components/ui/Field'
import { DownloadIcon, TrashIcon, UploadIcon } from '../components/icons'
import type { SpendiaryData } from '../lib/types'

const REQUIRED_KEYS: (keyof SpendiaryData)[] = [
  'cashAccounts',
  'monthlyIncome',
  'holdings',
  'dcaPlans',
  'transfers',
]

function isValidData(obj: unknown): obj is SpendiaryData {
  if (typeof obj !== 'object' || obj === null) return false
  const d = obj as Record<string, unknown>
  return (
    REQUIRED_KEYS.every((k) => k in d) &&
    Array.isArray(d.cashAccounts) &&
    Array.isArray(d.holdings) &&
    Array.isArray(d.dcaPlans) &&
    Array.isArray(d.transfers) &&
    typeof d.monthlyIncome === 'number'
  )
}

function hasData(data: SpendiaryData): boolean {
  return data.holdings.length > 0 || data.dcaPlans.length > 0 || data.transfers.length > 0
}

function dataSummary(data: SpendiaryData): string {
  const parts: string[] = []
  if (data.holdings.length > 0) parts.push(`${data.holdings.length} holding${data.holdings.length !== 1 ? 's' : ''}`)
  if (data.dcaPlans.length > 0) parts.push(`${data.dcaPlans.length} DCA plan${data.dcaPlans.length !== 1 ? 's' : ''}`)
  if (data.transfers.length > 0) parts.push(`${data.transfers.length} transfer${data.transfers.length !== 1 ? 's' : ''}`)
  if (parts.length === 0) return 'no data'
  return parts.join(', ')
}

export function Settings() {
  const { data, setData, clearAll, setUserName, backups, restoreBackup } = useData()
  const { theme, setTheme } = useTheme()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [nameDraft, setNameDraft] = useState(data.userName ?? '')

  const [resetOpen, setResetOpen] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState(false)
  const [exportSuccess, setExportSuccess] = useState(false)

  // Pre-import confirmation state
  const [importConfirmOpen, setImportConfirmOpen] = useState(false)
  const [pendingImport, setPendingImport] = useState<SpendiaryData | null>(null)

  // Backup restore state
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false)
  const [pendingRestore, setPendingRestore] = useState<DataBackup | null>(null)
  const [restoreSuccess, setRestoreSuccess] = useState(false)

  // ── Export ────────────────────────────────────────────────────
  function handleExport() {
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `spendiary-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setExportSuccess(true)
    setTimeout(() => setExportSuccess(false), 3000)
  }

  // ── Import ────────────────────────────────────────────────────
  function handleImportClick() {
    setImportError(null)
    setImportSuccess(false)
    fileInputRef.current?.click()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string)
        if (!isValidData(parsed)) {
          setImportError('File does not look like a Spendiary backup. Make sure you chose the right file.')
          return
        }
        // If user already has data, ask before overwriting
        if (hasData(data)) {
          setPendingImport(parsed)
          setImportConfirmOpen(true)
        } else {
          commitImport(parsed)
        }
      } catch {
        setImportError('Could not read the file. Make sure it is a valid JSON backup.')
      }
    }
    reader.readAsText(file)
  }

  function commitImport(incoming: SpendiaryData) {
    setData(incoming)
    setImportConfirmOpen(false)
    setPendingImport(null)
    setImportSuccess(true)
    setTimeout(() => setImportSuccess(false), 3000)
  }

  // ── Reset ─────────────────────────────────────────────────────
  function handleReset() {
    clearAll()
    setResetOpen(false)
  }

  return (
    <>
      <PageHeader eyebrow="App" title="Settings" />
      <div className="flex flex-col gap-4">

      {/* Profile */}
      <Card className="animate-rise">
        <h2 className="font-display text-[17px] font-bold text-ink mb-1">Profile</h2>
        <p className="text-[13px] text-ink-muted mb-4">Used in the Dashboard greeting.</p>
        <TextField
          label="Your name"
          value={nameDraft}
          onChange={(v) => {
            setNameDraft(v)
            setUserName(v)
          }}
          placeholder="e.g. Praween"
        />
      </Card>

      {/* Appearance */}
      <Card className="animate-rise">
        <h2 className="font-display text-[17px] font-bold text-ink mb-1">Appearance</h2>
        <p className="text-[13px] text-ink-muted mb-4">Choose how Spendiary looks on this device.</p>
        <div className="flex rounded-2xl bg-surface-muted p-1 gap-1">
          {([
            { value: 'light' as Theme, label: 'Light', icon: (
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <circle cx="10" cy="10" r="3.5" />
                <path d="M10 2v1.5M10 16.5V18M2 10h1.5M16.5 10H18M4.1 4.1l1.1 1.1M14.8 14.8l1.1 1.1M15.9 4.1l-1.1 1.1M5.2 14.8l-1.1 1.1" />
              </svg>
            )},
            { value: 'system' as Theme, label: 'System', icon: (
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <rect x="2" y="3" width="16" height="11" rx="2" />
                <path d="M6 17h8M10 14v3" />
              </svg>
            )},
            { value: 'dark' as Theme, label: 'Dark', icon: (
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M17 11.5A7 7 0 1 1 8.5 3a5 5 0 0 0 8.5 8.5Z" />
              </svg>
            )},
          ] as const).map(({ value, label, icon }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-semibold transition-all duration-200 ${
                theme === value
                  ? 'bg-surface text-ink shadow-[var(--shadow-soft)]'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      </Card>

      {/* Data & Backup */}
      <Card className="animate-rise">
        <h2 className="font-display text-[17px] font-bold text-ink [text-wrap:balance]">Data &amp; Backup</h2>
        <p className="mt-1 text-[13.5px] text-ink-muted [text-wrap:pretty]">
          All data is stored on this device: {dataSummary(data)}. Export a backup before clearing or switching browsers.
        </p>

        <div className="mt-5 divide-y divide-line">
          {/* Export */}
          <div className="flex items-center justify-between py-4">
            <div>
              <p className="text-[14px] font-semibold text-ink">Export data</p>
              <p className="mt-0.5 text-[12.5px] text-ink-muted">
                Download a JSON file with all your holdings, DCA plans, and transfers.
              </p>
              {exportSuccess && (
                <p role="status" aria-live="polite" className="mt-1 text-[12px] font-medium text-gain">
                  Backup saved.
                </p>
              )}
            </div>
            <button
              onClick={handleExport}
              className="ml-4 inline-flex shrink-0 items-center gap-2 rounded-full bg-surface-muted px-4 py-2 text-[13px] font-semibold text-ink-soft transition-colors hover:bg-ink hover:text-white dark:hover:bg-[#4f46e5] active:scale-95"
            >
              <DownloadIcon className="h-4 w-4" />
              Export
            </button>
          </div>

          {/* Import */}
          <div className="flex items-center justify-between py-4">
            <div>
              <p className="text-[14px] font-semibold text-ink">Import data</p>
              <p className="mt-0.5 text-[12.5px] text-ink-muted">
                Restore from a Spendiary JSON backup.
              </p>
              {(importError || importSuccess) && (
                <p role="status" aria-live="polite" className="mt-1 text-[12px] font-medium">
                  {importError
                    ? <span className="text-loss">{importError}</span>
                    : <span className="text-gain">Data imported successfully.</span>
                  }
                </p>
              )}
            </div>
            <button
              onClick={handleImportClick}
              aria-label="Import data from JSON backup file"
              className="ml-4 inline-flex shrink-0 items-center gap-2 rounded-full bg-surface-muted px-4 py-2 text-[13px] font-semibold text-ink-soft transition-colors hover:bg-ink hover:text-white dark:hover:bg-[#4f46e5] active:scale-95"
            >
              <UploadIcon className="h-4 w-4" />
              Import
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              aria-hidden="true"
              onChange={handleFileChange}
            />
          </div>
        </div>
      </Card>

      {/* Local backups */}
      {backups.length > 0 && (
        <Card className="animate-rise">
          <h2 className="font-display text-[17px] font-bold text-ink mb-1">Local backups</h2>
          <p className="text-[13px] text-ink-muted mb-4">
            Automatic hourly snapshots saved on this device. Restore if your data was wiped.
          </p>
          {restoreSuccess && (
            <div role="status" aria-live="polite" className="mb-3 text-[12px] font-medium text-gain">
              Backup restored successfully.
            </div>
          )}
          <ul className="divide-y divide-line">
            {backups.map((b, i) => {
              const date = new Date(b.savedAt)
              const label = date.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
              return (
                <li key={b.savedAt} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-[13.5px] font-semibold text-ink">
                      {i === 0 ? 'Latest' : `${i + 1} snapshot${i === 1 ? 's' : 's'} ago`}
                    </p>
                    <p className="mt-0.5 text-[12px] text-ink-muted">{label} · {dataSummary(b.data)}</p>
                  </div>
                  <button
                    onClick={() => { setPendingRestore(b); setRestoreConfirmOpen(true) }}
                    className="ml-4 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1.5 text-[12.5px] font-semibold text-brand transition-colors hover:bg-brand hover:text-white active:scale-95"
                  >
                    Restore
                  </button>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {/* Danger zone */}
      <Card className="animate-rise border-loss/20 bg-loss-soft/20">
        <h2 className="font-display text-[17px] font-bold text-ink [text-wrap:balance]">Danger zone</h2>
        <div className="mt-4 flex items-center justify-between">
          <div>
            <p className="text-[14px] font-semibold text-ink">Reset all data</p>
            <p className="mt-0.5 text-[12.5px] text-ink-muted">
              Permanently clears every holding, plan, and transfer. Cannot be undone.
            </p>
          </div>
          <button
            onClick={() => setResetOpen(true)}
            className="ml-4 inline-flex shrink-0 items-center gap-2 rounded-full bg-loss-soft px-4 py-2 text-[13px] font-semibold text-loss transition-colors hover:bg-loss hover:text-white active:scale-95"
          >
            <TrashIcon className="h-4 w-4" />
            Reset
          </button>
        </div>
      </Card>
      </div>

      {/* Import confirmation modal */}
      <Modal
        open={importConfirmOpen}
        onClose={() => { setImportConfirmOpen(false); setPendingImport(null) }}
        title="Replace your current data?"
        description={`Your current data has ${dataSummary(data)}. Importing will replace all of it with the file's contents.`}
      >
        <div className="flex flex-col gap-3 pb-1">
          <button
            onClick={() => handleExport()}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-surface-muted text-[13px] font-semibold text-ink-soft transition-colors hover:bg-ink hover:text-white dark:hover:bg-[#4f46e5]"
          >
            <DownloadIcon className="h-4 w-4" />
            Export current data first
          </button>
          <button
            onClick={() => pendingImport && commitImport(pendingImport)}
            className="inline-flex h-11 w-full items-center justify-center rounded-full bg-ink px-5 text-sm font-semibold text-white transition-all duration-200 hover:bg-ink-hover dark:bg-[#4f46e5] dark:hover:bg-[#4338ca] active:scale-[0.98]"
          >
            Replace with imported data
          </button>
          <button
            onClick={() => { setImportConfirmOpen(false); setPendingImport(null) }}
            className="w-full rounded-full py-2.5 text-[14px] font-semibold text-ink-muted transition-colors hover:text-ink"
          >
            Cancel
          </button>
        </div>
      </Modal>

      {/* Backup restore confirmation modal */}
      <Modal
        open={restoreConfirmOpen}
        onClose={() => { setRestoreConfirmOpen(false); setPendingRestore(null) }}
        title="Restore this backup?"
        description={pendingRestore ? `This will replace your current data (${dataSummary(data)}) with the snapshot from ${new Date(pendingRestore.savedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} (${dataSummary(pendingRestore.data)}).` : ''}
      >
        <div className="flex flex-col gap-3 pb-1">
          <button
            onClick={() => {
              if (pendingRestore) {
                restoreBackup(pendingRestore)
                setRestoreConfirmOpen(false)
                setPendingRestore(null)
                setRestoreSuccess(true)
                setTimeout(() => setRestoreSuccess(false), 3000)
              }
            }}
            className="inline-flex h-11 w-full items-center justify-center rounded-full bg-ink px-5 text-sm font-semibold text-white transition-all duration-200 hover:bg-ink-hover dark:bg-[#4f46e5] dark:hover:bg-[#4338ca] active:scale-[0.98]"
          >
            Restore backup
          </button>
          <button
            onClick={() => { setRestoreConfirmOpen(false); setPendingRestore(null) }}
            className="w-full rounded-full py-2.5 text-[14px] font-semibold text-ink-muted transition-colors hover:text-ink"
          >
            Cancel
          </button>
        </div>
      </Modal>

      {/* Reset confirmation modal */}
      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset all data?"
        description="This will permanently delete all holdings, DCA plans, transfers, and cash accounts. Export a backup first if you want to keep anything."
      >
        <div className="flex flex-col gap-3 pb-1">
          <button
            onClick={handleReset}
            className="inline-flex h-11 w-full items-center justify-center rounded-full bg-loss px-5 text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
          >
            Yes, delete everything
          </button>
          <button
            onClick={() => setResetOpen(false)}
            className="w-full rounded-full py-2.5 text-[14px] font-semibold text-ink-muted transition-colors hover:text-ink"
          >
            Cancel
          </button>
        </div>
      </Modal>
    </>
  )
}

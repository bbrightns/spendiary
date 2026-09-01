import { useRef, useState, useEffect } from 'react'
import { useData } from '../store/DataContext'
import { useToast } from '../store/ToastContext'
import { useTheme, type Theme } from '../hooks/useTheme'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { TextField } from '../components/ui/Field'
import { GuideTour } from '../components/guide/GuideTour'
import { usePageGuide, resetAllPageGuides } from '../hooks/usePageGuide'
import { DownloadIcon, TrashIcon, UploadIcon, HelpCircleIcon } from '../components/icons'
import type { SpendiaryData } from '../lib/types'

// ─── helpers ──────────────────────────────────────────────────────────────────

function hasData(data: SpendiaryData): boolean {
  return data.holdings.length > 0 || data.dcaPlans.length > 0 || data.transfers.length > 0
}

function dataSummary(data: SpendiaryData): string {
  const parts: string[] = []
  if (data.holdings.length > 0)
    parts.push(`${data.holdings.length} holding${data.holdings.length !== 1 ? 's' : ''}`)
  if (data.dcaPlans.length > 0)
    parts.push(`${data.dcaPlans.length} DCA plan${data.dcaPlans.length !== 1 ? 's' : ''}`)
  if (data.transfers.length > 0)
    parts.push(`${data.transfers.length} transfer${data.transfers.length !== 1 ? 's' : ''}`)
  if (parts.length === 0) return 'no data'
  return parts.join(', ')
}

// ─── inline toast ─────────────────────────────────────────────────────────────

type ToastState =
  | { kind: 'idle' }
  | { kind: 'success'; msg: string }
  | { kind: 'error'; msg: string }
  | { kind: 'loading'; msg: string }

// ─── component ────────────────────────────────────────────────────────────────

export function Settings() {
  const {
    steps,
    isRunning,
    currentStepIndex,
    startTour,
    endTour,
    finishTour,
    nextStep,
    prevStep,
  } = usePageGuide('settings')
  const { showToast } = useToast()
  const {
    data,
    clearAll,
    setUserName,
    exportData,
    importData,
    syncStatus,
    lastSyncedAt,
    user,
    logout,
  } = useData()
  const { theme, setTheme } = useTheme()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [nameDraft, setNameDraft] = useState(data.userName ?? '')

  useEffect(() => {
    setNameDraft(data.userName ?? '')
  }, [data.userName])

  // ── modal states ───────────────────────────────────────────────
  const [resetOpen, setResetOpen] = useState(false)
  const [importConfirmOpen, setImportConfirmOpen] = useState(false)
  const [pendingImport, setPendingImport] = useState<string | null>(null)  // raw json string
  const [pendingImportSummary, setPendingImportSummary] = useState('')

  // ── inline toast ───────────────────────────────────────────────
  const [exportToast, setExportToast] = useState<ToastState>({ kind: 'idle' })
  const [importToast, setImportToast] = useState<ToastState>({ kind: 'idle' })

  function flashToast(
    set: React.Dispatch<React.SetStateAction<ToastState>>,
    toast: ToastState,
    ms = 4000,
  ) {
    set(toast)
    if (toast.kind !== 'loading') setTimeout(() => set({ kind: 'idle' }), ms)
  }

  // ── Export ────────────────────────────────────────────────────
  function handleExport() {
    exportData()
    flashToast(setExportToast, { kind: 'success', msg: 'Backup downloaded.' })
  }

  // ── Import: step 1 — file picker ──────────────────────────────
  function handleImportClick() {
    setImportToast({ kind: 'idle' })
    fileInputRef.current?.click()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''                     // allow re-selecting same file

    if (!file.name.endsWith('.json') && file.type !== 'application/json') {
      flashToast(setImportToast, { kind: 'error', msg: 'Please choose a .json file.' })
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const raw = event.target?.result as string

      // Quick pre-validation before showing confirm dialog
      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        flashToast(setImportToast, {
          kind: 'error',
          msg: 'The file is not valid JSON. Make sure you chose the right Spendiary backup.',
        })
        return
      }

      // Build a human-readable summary of what's inside the file
      const d = parsed as Record<string, unknown>
      const fileSummary = [
        Array.isArray(d.holdings) && d.holdings.length > 0
          ? `${(d.holdings as unknown[]).length} holdings`
          : null,
        Array.isArray(d.dcaPlans) && d.dcaPlans.length > 0
          ? `${(d.dcaPlans as unknown[]).length} DCA plans`
          : null,
        Array.isArray(d.transfers) && d.transfers.length > 0
          ? `${(d.transfers as unknown[]).length} transfers`
          : null,
      ]
        .filter(Boolean)
        .join(', ') || 'no records'

      // If existing data → ask first; otherwise commit immediately
      if (hasData(data)) {
        setPendingImport(raw)
        setPendingImportSummary(fileSummary)
        setImportConfirmOpen(true)
      } else {
        commitImport(raw)
      }
    }
    reader.readAsText(file)
  }

  // ── Import: step 2 — commit ────────────────────────────────────
  function commitImport(raw: string) {
    setImportConfirmOpen(false)
    setPendingImport(null)

    flashToast(setImportToast, { kind: 'loading', msg: 'Importing and syncing…' })

    const result = importData(raw)

    if (!result.ok) {
      flashToast(setImportToast, { kind: 'error', msg: result.error })
      return
    }

    flashToast(setImportToast, { kind: 'success', msg: 'Data imported and synced to cloud.' })
  }

  // ── Reset ──────────────────────────────────────────────────────
  function handleReset() {
    clearAll()
    setResetOpen(false)
  }

  // ── Sync badge ─────────────────────────────────────────────────
  const syncBadge =
    syncStatus === 'syncing'
      ? { text: 'Syncing…', cls: 'bg-warn-soft text-warn' }
      : syncStatus === 'synced'
      ? { text: 'Synced', cls: 'bg-gain-soft text-gain' }
      : syncStatus === 'error'
      ? { text: 'Sync error', cls: 'bg-loss-soft text-loss' }
      : null

  return (
    <>
      <PageHeader eyebrow="App" title="Settings" onStartGuide={startTour} />
      <div className="flex flex-col gap-4">

        {/* ── Supabase Cloud Sync ─────────────────────────────── */}
        <div id="guide-settings-sync">
          <Card className="animate-rise">
            <div className="flex items-start justify-between gap-3 mb-1">
              <h2 className="font-display text-[17px] font-bold text-ink">Cloud Sync (Supabase)</h2>
              {syncBadge && (
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${syncBadge.cls}`}>
                  {syncBadge.text}
                </span>
              )}
            </div>
            <p className="text-[13px] text-ink-muted mb-4">
              Your data is securely backed up and synchronized automatically.
            </p>

            <div className="flex flex-col gap-2 rounded-2xl bg-surface-muted p-4 text-[13.5px] mb-4">
              <div className="flex justify-between">
                <span className="text-ink-muted">Account</span>
                <span className="font-semibold text-ink">{user?.email ?? 'Not signed in'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Last synced</span>
                <span className="font-semibold text-ink">
                  {lastSyncedAt ? lastSyncedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : 'Never'}
                </span>
              </div>
            </div>

            {user && (
              <button
                onClick={logout}
                className="w-full py-2.5 px-4 rounded-xl border border-line bg-surface hover:bg-surface-muted text-[13px] font-semibold text-loss transition-colors duration-200 active:scale-[0.98]"
              >
                Sign out
              </button>
            )}
          </Card>
        </div>

        {/* ── Profile ─────────────────────────────────────────── */}
        <div id="guide-settings-profile">
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
        </div>

        {/* ── Appearance ──────────────────────────────────────── */}
        <Card className="animate-rise">
          <h2 className="font-display text-[17px] font-bold text-ink mb-1">Appearance</h2>
          <p className="text-[13px] text-ink-muted mb-4">
            Choose how Spendiary looks on this device.
          </p>
          <div className="flex rounded-2xl bg-surface-muted p-1 gap-1">
            {(
              [
                {
                  value: 'light' as Theme,
                  label: 'Light',
                  icon: (
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                      <circle cx="10" cy="10" r="3.5" />
                      <path d="M10 2v1.5M10 16.5V18M2 10h1.5M16.5 10H18M4.1 4.1l1.1 1.1M14.8 14.8l1.1 1.1M15.9 4.1l-1.1 1.1M5.2 14.8l-1.1 1.1" />
                    </svg>
                  ),
                },
                {
                  value: 'system' as Theme,
                  label: 'System',
                  icon: (
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                      <rect x="2" y="3" width="16" height="11" rx="2" />
                      <path d="M6 17h8M10 14v3" />
                    </svg>
                  ),
                },
                {
                  value: 'dark' as Theme,
                  label: 'Dark',
                  icon: (
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                      <path d="M17 11.5A7 7 0 1 1 8.5 3a5 5 0 0 0 8.5 8.5Z" />
                    </svg>
                  ),
                },
              ] as const
            ).map(({ value, label, icon }) => (
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

        {/* ── Data & Backup ───────────────────────────────────── */}
        <div id="guide-settings-backup">
          <Card className="animate-rise">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-[17px] font-bold text-ink [text-wrap:balance]">
                  Data &amp; Backup
                </h2>
                <p className="mt-1 text-[13px] text-ink-muted [text-wrap:pretty]">
                  {dataSummary(data)} stored on this device.
                </p>
              </div>
            </div>

            <div className="mt-5 divide-y divide-line">

              {/* Export row */}
              <div className="flex items-start justify-between gap-4 py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-ink">Export data</p>
                  <p className="mt-0.5 text-[12.5px] text-ink-muted">
                    Download all holdings, DCA plans, and transfers as a JSON file.
                  </p>
                  {exportToast.kind !== 'idle' && (
                    <p
                      role="status"
                      aria-live="polite"
                      className={`mt-1.5 text-[12px] font-medium ${
                        exportToast.kind === 'success' ? 'text-gain' : 'text-loss'
                      }`}
                    >
                      {exportToast.msg}
                    </p>
                  )}
                </div>
                <button
                  id="btn-export"
                  onClick={handleExport}
                  className="shrink-0 inline-flex items-center gap-2 rounded-full bg-surface-muted px-4 py-2 text-[13px] font-semibold text-ink-soft transition-colors hover:bg-ink hover:text-white dark:hover:bg-[#4f46e5] active:scale-95"
                >
                  <DownloadIcon className="h-4 w-4" />
                  Export
                </button>
              </div>

              {/* Import row */}
              <div className="flex items-start justify-between gap-4 py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-ink">Import data</p>
                  <p className="mt-0.5 text-[12.5px] text-ink-muted">
                    Restore from a Spendiary JSON backup. This will overwrite current data.
                  </p>
                  {importToast.kind !== 'idle' && (
                    <p
                      role="status"
                      aria-live="polite"
                      className={`mt-1.5 flex items-center gap-1.5 text-[12px] font-medium ${
                        importToast.kind === 'success'
                          ? 'text-gain'
                          : importToast.kind === 'error'
                          ? 'text-loss'
                          : 'text-ink-muted'
                      }`}
                    >
                      {importToast.kind === 'loading' && (
                        <svg
                          className="h-3.5 w-3.5 animate-spin"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                        >
                          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
                        </svg>
                      )}
                      {importToast.msg}
                    </p>
                  )}
                </div>
                <button
                  id="btn-import"
                  onClick={handleImportClick}
                  disabled={importToast.kind === 'loading'}
                  aria-label="Import data from JSON backup file"
                  className="shrink-0 inline-flex items-center gap-2 rounded-full bg-surface-muted px-4 py-2 text-[13px] font-semibold text-ink-soft transition-colors hover:bg-ink hover:text-white dark:hover:bg-[#4f46e5] active:scale-95 disabled:pointer-events-none disabled:opacity-50"
                >
                  <UploadIcon className="h-4 w-4" />
                  Import
                </button>
                {/* Hidden file input */}
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
        </div>

        {/* ── Interactive Tour Guides ───────────────────────────── */}
        <div id="guide-settings-tour">
          <Card className="animate-rise">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <HelpCircleIcon className="h-5 w-5 text-brand" strokeWidth={2.2} />
                  <h2 className="font-display text-[17px] font-bold text-ink">
                    คู่มือและคำแนะนำการใช้งาน (Tour Guides)
                  </h2>
                </div>
                <p className="mt-1 text-[13px] text-ink-muted leading-relaxed">
                  Spendiary มีระบบแนะนำฟังก์ชันการทำงานแบบทีละขั้นตอน (Spotlight Tour) หากต้องการเริ่มต้นดูคำแนะนำในทุกหน้าใหม่เหมือนเปิดแอพครั้งแรก สามารถกดรีเซ็ตได้ที่นี่
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  resetAllPageGuides()
                  showToast('รีเซ็ตคู่มือการใช้งานทุกหน้าเรียบร้อยแล้ว ระบบจะเริ่มแนะนำใหม่เมื่อเปิดแต่ละหน้า', 'info')
                }}
                className="inline-flex items-center gap-2 rounded-full bg-ink text-white dark:bg-[#4f46e5] dark:hover:bg-[#4338ca] hover:bg-ink-hover px-4 py-2 text-[13px] font-semibold shadow-xs active:scale-95 transition-all cursor-pointer"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
                รีเซ็ตคู่มือทุกหน้า (Reset All Guides)
              </button>

              <button
                type="button"
                onClick={startTour}
                className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface px-4 py-2 text-[13px] font-semibold text-ink-soft shadow-[var(--shadow-soft)] hover:bg-surface-muted hover:text-ink active:scale-95 transition-all cursor-pointer"
              >
                <HelpCircleIcon className="h-4 w-4 text-brand dark:text-[#a5b4fc]" strokeWidth={2.2} />
                แนะนำหน้าการตั้งค่านี้
              </button>
            </div>
          </Card>
        </div>

        {/* ── Danger zone ─────────────────────────────────────── */}
        <Card className="animate-rise border-loss/20 bg-loss-soft/20">
          <h2 className="font-display text-[17px] font-bold text-ink [text-wrap:balance]">
            Danger zone
          </h2>
          <div className="mt-4 flex items-center justify-between">
            <div>
              <p className="text-[14px] font-semibold text-ink">Reset all data</p>
              <p className="mt-0.5 text-[12.5px] text-ink-muted">
                Permanently clears every holding, plan, and transfer. Cannot be undone.
              </p>
            </div>
            <button
              id="btn-reset"
              onClick={() => setResetOpen(true)}
              className="ml-4 inline-flex shrink-0 items-center gap-2 rounded-full bg-loss-soft px-4 py-2 text-[13px] font-semibold text-loss transition-colors hover:bg-loss hover:text-white active:scale-95"
            >
              <TrashIcon className="h-4 w-4" />
              Reset
            </button>
          </div>
        </Card>

      </div>

      {/* ── Import confirmation modal ──────────────────────────── */}
      <Modal
        open={importConfirmOpen}
        onClose={() => {
          setImportConfirmOpen(false)
          setPendingImport(null)
        }}
        title="Replace your current data?"
        description={`Your current data has ${dataSummary(data)}. The file contains ${pendingImportSummary}. Importing will overwrite everything on this device and push to cloud immediately.`}
      >
        <div className="flex flex-col gap-3 pb-1">
          {/* Offer to save current data first */}
          <button
            onClick={() => exportData()}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-surface-muted text-[13px] font-semibold text-ink-soft transition-colors hover:bg-ink hover:text-white dark:hover:bg-[#4f46e5]"
          >
            <DownloadIcon className="h-4 w-4" />
            Export current data first
          </button>
          <button
            onClick={() => pendingImport && commitImport(pendingImport)}
            className="inline-flex h-11 w-full items-center justify-center rounded-full bg-ink px-5 text-sm font-semibold text-white transition-all duration-200 hover:bg-ink-hover dark:bg-[#4f46e5] dark:hover:bg-[#4338ca] active:scale-[0.98]"
          >
            Yes, replace with imported data
          </button>
          <button
            onClick={() => {
              setImportConfirmOpen(false)
              setPendingImport(null)
            }}
            className="w-full rounded-full py-2.5 text-[14px] font-semibold text-ink-muted transition-colors hover:text-ink"
          >
            Cancel
          </button>
        </div>
      </Modal>

      {/* ── Reset confirmation modal ───────────────────────────── */}
      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset all data?"
        description="This will permanently delete all holdings, DCA plans, transfers, and cash accounts. Export a backup first if you want to keep anything."
      >
        <div className="flex flex-col gap-3 pb-1">
          <button
            onClick={handleReset}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-loss px-5 text-sm font-bold text-white dark:bg-rose-600 dark:hover:bg-rose-700 transition-all duration-200 hover:opacity-90 active:scale-[0.98] cursor-pointer shadow-sm"
          >
            <TrashIcon className="h-4 w-4" strokeWidth={2.2} />
            <span>Yes, delete everything</span>
          </button>
          <button
            onClick={() => setResetOpen(false)}
            className="w-full rounded-full py-2.5 text-[14px] font-semibold text-ink-muted transition-colors hover:text-ink"
          >
            Cancel
          </button>
        </div>
      </Modal>

      <GuideTour
        isOpen={isRunning}
        steps={steps}
        currentStepIndex={currentStepIndex}
        onNext={nextStep}
        onPrev={prevStep}
        onClose={endTour}
        onFinish={finishTour}
      />
    </>
  )
}
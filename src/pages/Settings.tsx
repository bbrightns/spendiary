import { useRef, useState, useEffect } from 'react'
import { useData } from '../store/DataContext'
import { useTheme, type Theme } from '../hooks/useTheme'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { Button } from '../components/ui/Button'
import { TextField } from '../components/ui/Field'
import { GuideTour } from '../components/guide/GuideTour'
import { usePageGuide } from '../hooks/usePageGuide'
import { DownloadIcon, TrashIcon, UploadIcon } from '../components/icons'
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
  const [aboutExpanded, setAboutExpanded] = useState(false)

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
          <SegmentedControl
            value={theme}
            onChange={setTheme}
            options={[
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
            ]}
          />
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
              className="ml-4 inline-flex shrink-0 items-center gap-2 rounded-full bg-loss-soft px-4 py-2 text-[13px] font-semibold text-loss transition-colors hover:bg-loss hover:text-white active:scale-95 cursor-pointer"
            >
              <TrashIcon className="h-4 w-4" />
              Reset
            </button>
          </div>
        </Card>

        {/* ── About Spendiary ─────────────────────────────────── */}
        <Card className="animate-rise overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-surface-muted/80 border border-line/60 flex items-center justify-center p-2.5 shadow-xs shrink-0">
                <img src="/logo.png" alt="Spendiary Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-display text-[17px] font-bold text-ink">About Spendiary</h2>
                  <span className="rounded-full bg-brand-soft text-brand-ink border border-brand/20 px-2 py-0.5 text-[10.5px] font-semibold">
                    v{__APP_VERSION__}
                  </span>
                </div>
                <p className="text-[12.5px] text-ink-muted mt-0.5">
                  Personal Wealth Cockpit · Every choice shapes your wealth.
                </p>
              </div>
            </div>

            {/* Social / External Links + Toggle Chevron */}
            <div className="flex items-center gap-2">
              <a
                href="https://github.com/bbrightns"
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line/80 bg-surface text-xs font-semibold text-ink-muted hover:text-ink hover:border-line hover:bg-surface-muted transition-all cursor-pointer shadow-2xs"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
                <span>GitHub</span>
              </a>
              <a
                href="https://www.facebook.com/bbrightns/"
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line/80 bg-surface text-xs font-semibold text-ink-muted hover:text-ink hover:border-line hover:bg-surface-muted transition-all cursor-pointer shadow-2xs"
              >
                <svg className="w-3.5 h-3.5 text-[#1877F2]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
                <span>Facebook</span>
              </a>
              <button
                type="button"
                onClick={() => setAboutExpanded((v) => !v)}
                aria-label={aboutExpanded ? 'ย่อรายละเอียด' : 'แสดงเพิ่มเติม'}
                title={aboutExpanded ? 'ย่อรายละเอียด' : 'แสดงเพิ่มเติม'}
                className="inline-flex items-center justify-center w-8 h-8 rounded-xl border border-line/80 bg-surface text-ink-muted hover:text-ink hover:border-line hover:bg-surface-muted transition-all cursor-pointer shadow-2xs"
              >
                <svg
                  className={`w-4 h-4 transition-transform duration-200 ${aboutExpanded ? 'rotate-180' : ''}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            </div>
          </div>

          {/* Author Details & Release Highlights (Collapsible) */}
          {aboutExpanded && (
            <div className="pt-4 mt-4 border-t border-line/60 space-y-3 animate-fade-in">
              <div className="rounded-2xl bg-surface-muted/60 p-4 border border-line/50">
                <div className="flex items-center gap-3.5 mb-3">
                  <img
                    src="/bbrightns.jpg"
                    alt="Praween Piyaprapaphan (Bright)"
                    className="w-12 h-12 rounded-full object-cover border-2 border-surface shadow-xs shrink-0"
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[14px] font-bold text-ink leading-tight">
                      Praween Piyaprapaphan (Bright)
                    </span>
                    <span className="text-[12px] font-mono text-brand font-semibold leading-normal mt-0.5">
                      Alias: bbrightns
                    </span>
                  </div>
                </div>
                <p className="text-[12.5px] text-ink-muted leading-relaxed">
                  Electrical Engineer ผู้หลงใหลใน computer & tech มุ่งมั่นพัฒนาเครื่องมือบริหารการเงินส่วนบุคคลที่ทรงพลัง เรียบง่าย และให้ความสำคัญกับความปลอดภัยของข้อมูลสูงสุด
                </p>
              </div>

              {/* Release Notes & Issue Report */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-3.5 rounded-xl border border-line/60 bg-surface">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <h3 className="text-xs font-bold text-ink">Release Highlights</h3>
                  </div>
                  <p className="text-[11.5px] text-ink-muted leading-relaxed">
                    v{__APP_VERSION__} (build <span className="font-mono">{__COMMIT_HASH__}</span>) · ระบบคำนวณดอกเบี้ยเงินฝากเพดานสูง (Max cap), DCA rebalancing, และการปรับปรุง Dark Mode ครบวงจร
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-line/60 bg-surface flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <h3 className="text-xs font-bold text-ink">ช่องทางแจ้งปัญหา (Feedback & Issues)</h3>
                    </div>
                    <p className="text-[11.5px] text-ink-muted leading-relaxed">
                      พบข้อผิดพลาดหรือมีข้อเสนอแนะเพิ่มเติม สามารถเปิด Issue บน GitHub หรือส่งข้อความทาง Facebook ได้โดยตรง
                    </p>
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-line/50 flex items-center gap-2">
                    <a
                      href="https://github.com/bbrightns/spendiary/issues"
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-[11.5px] font-semibold text-brand hover:underline"
                    >
                      Report on GitHub →
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}
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
        footer={
          <div className="flex flex-col gap-2.5 w-full">
            <Button
              variant="primary"
              onClick={() => pendingImport && commitImport(pendingImport)}
              className="w-full cursor-pointer"
            >
              Yes, replace with imported data
            </Button>
            <Button
              variant="secondary"
              onClick={() => exportData()}
              className="w-full cursor-pointer gap-2"
            >
              <DownloadIcon className="h-4 w-4" />
              <span>Export current data first</span>
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setImportConfirmOpen(false)
                setPendingImport(null)
              }}
              className="w-full cursor-pointer text-ink-muted hover:text-ink"
            >
              Cancel
            </Button>
          </div>
        }
      >
        <div className="py-1" />
      </Modal>

      {/* ── Reset confirmation modal ───────────────────────────── */}
      <ConfirmModal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset all data?"
        description="This will permanently delete all holdings, DCA plans, transfers, and cash accounts. Export a backup first if you want to keep anything."
        confirmText="Yes, delete everything"
        confirmVariant="danger"
        confirmIcon={<TrashIcon className="h-4 w-4" strokeWidth={2.2} />}
        cancelText="Cancel"
        onConfirm={handleReset}
      />

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
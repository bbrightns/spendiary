import { useRef, useState, useEffect, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import { useData } from '../store/DataContext'
import { useTheme, type Theme } from '../hooks/useTheme'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { Button } from '../components/ui/Button'
import { TextField } from '../components/ui/Field'
import { GuideTour } from '../components/guide/GuideTour'
import { usePageGuide } from '../hooks/usePageGuide'
import {
  BellIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DatabaseIcon,
  DownloadIcon,
  InfoIcon,
  SettingsIcon,
  SparkleIcon,
  TagIcon,
  TargetIcon,
  TrashIcon,
  UploadIcon,
} from '../components/icons'
import { DataAction, DataCard, DataRow } from '../components/ui/DataCard'
import { AiImportModal } from '../components/forms/AiImportModal'
import type { SpendiaryData } from '../lib/types'
import { SpendDataSection, SpendSettingsSections } from '../modules/spend/pages/SpendSettings'
import {
  DEFAULT_SETTINGS_SECTION,
  SETTINGS_SECTIONS,
  isSettingsSection,
  settingsPath,
  settingsSection,
  type SettingsSectionId,
} from '../lib/settingsSections'

// ─── helpers ──────────────────────────────────────────────────────────────────

function hasData(data: SpendiaryData): boolean {
  return data.holdings.length > 0 ||
    data.cashAccounts.length > 0 ||
    data.dcaPlans.length > 0 ||
    data.transfers.length > 0 ||
    (data.holdingLogs?.length ?? 0) > 0 ||
    (data.dividendRecords?.length ?? 0) > 0
}

/** What a backup holds, for both sides: "Invest: 9 holdings, … · Spend: 32 transactions, … · Money: …" */
function dataSummary(data: SpendiaryData): string {
  const n = (count: number | undefined, word: string, plural = `${word}s`) => (count ? `${count} ${count === 1 ? word : plural}` : '')
  const group = (label: string, items: string[]) => {
    const kept = items.filter(Boolean)
    return kept.length ? `${label}: ${kept.join(', ')}` : ''
  }
  const groups = [
    group('Invest', [n(data.holdings.length, 'holding'), n(data.dcaPlans.length, 'DCA plan'), n(data.holdingLogs?.length, 'log'), n(data.dividendRecords?.length, 'dividend')]),
    group('Spend', [
      n(data.spendTransactions?.length, 'transaction'),
      n(data.spendCards?.length, 'card'),
      n(data.spendRecurring?.length, 'bill'),
      n(data.spendGoals?.length, 'goal'),
    ]),
    group('Money', [n(data.cashAccounts.length, 'cash account'), n(data.liabilities?.length, 'loan'), n(data.transfers.length, 'transfer')]),
  ].filter(Boolean)
  return groups.length ? groups.join(' · ') : 'no data'
}

/** What the Invest side holds: "9 holdings, 6 DCA plans, 2 dividends" */
function investSummary(data: SpendiaryData): string {
  const n = (count: number | undefined, word: string) => (count ? `${count} ${count === 1 ? word : `${word}s`}` : '')
  const parts = [n(data.holdings.length, 'holding'), n(data.dcaPlans.length, 'DCA plan'), n(data.dividendRecords?.length, 'dividend')].filter(Boolean)
  return parts.length ? parts.join(', ') : 'Nothing added yet'
}

// ─── inline toast ─────────────────────────────────────────────────────────────

type ToastState =
  | { kind: 'idle' }
  | { kind: 'success'; msg: string }
  | { kind: 'error'; msg: string }
  | { kind: 'loading'; msg: string }

// ─── component ────────────────────────────────────────────────────────────────

const SECTION_ICONS: Record<SettingsSectionId, typeof SettingsIcon> = {
  general: SettingsIcon,
  month: CalendarIcon,
  budgets: TargetIcon,
  categories: TagIcon,
  quick: BellIcon,
  data: DatabaseIcon,
  about: InfoIcon,
}

/** Rows the Settings tour points at */
const GUIDE_IDS: Partial<Record<SettingsSectionId, string>> = {
  general: 'guide-settings-profile',
  data: 'guide-settings-backup',
}

/** The list of sections; on wide screens the open one stays highlighted beside its panel */
function SettingsMenu({ shown, open }: { shown: SettingsSectionId; open?: SettingsSectionId }) {
  return (
    <Card padded={false} className="animate-rise overflow-hidden">
      <nav aria-label="Settings sections">
        <ul className="divide-y divide-line">
          {SETTINGS_SECTIONS.map((s) => {
            const Icon = SECTION_ICONS[s.id]
            const here = s.id === shown
            return (
              <li key={s.id}>
                <Link
                  id={GUIDE_IDS[s.id]}
                  to={`/settings/${s.id}`}
                  aria-current={s.id === open ? 'page' : undefined}
                  className={`flex min-h-16 items-center gap-3.5 px-4 py-3 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand ${
                    here ? 'xl:bg-surface-muted' : ''
                  }`}
                >
                  <span
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-muted text-ink-soft ${
                      here ? 'xl:bg-primary xl:text-white' : ''
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-ink">{s.title}</span>
                    <span className="block truncate text-sm text-ink-muted">{s.hint}</span>
                  </span>
                  <ChevronRightIcon className="h-4 w-4 shrink-0 text-ink-faint" />
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </Card>
  )
}

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
  const [isResetting, setIsResetting] = useState(false)
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

      // Build a human-readable summary of what's inside the file.
      // Backups wrap the data as { schemaVersion, data }; older files are the bare data object.
      const top = parsed as Record<string, unknown>
      const d = (top && typeof top.data === 'object' && top.data !== null ? top.data : top) as Record<string, unknown>
      const fileSummary = [
        Array.isArray(d.holdings) && d.holdings.length > 0
          ? `${(d.holdings as unknown[]).length} holdings`
          : null,
        Array.isArray(d.dcaPlans) && d.dcaPlans.length > 0
          ? `${(d.dcaPlans as unknown[]).length} DCA plans`
          : null,
        Array.isArray(d.cashAccounts) && d.cashAccounts.length > 0
          ? `${(d.cashAccounts as unknown[]).length} cash accounts`
          : null,
        Array.isArray(d.liabilities) && d.liabilities.length > 0
          ? `${(d.liabilities as unknown[]).length} liabilities`
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
  async function handleReset() {
    setIsResetting(true)
    try {
      await clearAll()
    } finally {
      setIsResetting(false)
      setResetOpen(false)
    }
  }

  // ── Sections: /settings is the menu (plus General beside it on wide screens), /settings/<id> one section ──
  const { section } = useParams()
  const { hash } = useLocation()
  const [aiImportOpen, setAiImportOpen] = useState(false)
  const open = isSettingsSection(section) ? section : undefined
  const shown = open ?? DEFAULT_SETTINGS_SECTION
  const meta = settingsSection(shown)
  // The menu stays put beside a long section on wide screens; below the test-mode banner when shown
  const stickyTop = user?.id === 'test-user-local' ? 'xl:top-12' : 'xl:top-6'

  // An anchor inside a section (/settings/budgets#category-budgets): land on it once the route has settled
  useEffect(() => {
    const id = hash.slice(1)
    if (!open || !id) return
    const frame = requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }))
    return () => cancelAnimationFrame(frame)
  }, [open, hash])

  // ── Sync badge ─────────────────────────────────────────────────
  const syncBadge =
    syncStatus === 'syncing'
      ? { text: 'Syncing…', cls: 'text-warn' }
      : syncStatus === 'synced'
      ? { text: 'Synced', cls: 'text-gain' }
      : syncStatus === 'error'
      ? { text: 'Sync error', cls: 'text-loss' }
      : null

  const accountCard = (
    <Card id="guide-settings-sync" className="animate-rise" padded={false}>
      <div className="flex items-center justify-between gap-3 px-5 py-3.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{user?.email ?? 'Not signed in'}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
            {syncBadge && <span className={`font-semibold ${syncBadge.cls}`}>{syncBadge.text}</span>}
            {!user ? (
              <span>Data stays on this device</span>
            ) : lastSyncedAt ? (
              <span>Last synced {lastSyncedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
            ) : (
              !syncBadge && <span>Not synced yet</span>
            )}
          </p>
        </div>
        {user && <DataAction label="Sign out" tone="danger" onClick={logout} />}
      </div>
    </Card>
  )

  const panels: Record<SettingsSectionId, ReactNode> = {
    general: (
      <>
        {/* ── Appearance ──────────────────────────────────────── */}
        <Card className="animate-rise">
          <h2 className="font-display text-lg font-bold text-ink mb-1">Appearance</h2>
          <p className="text-sm text-ink-muted mb-4">
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
        {/* ── Profile ─────────────────────────────────────────── */}
        <Card className="animate-rise">
          <h2 className="font-display text-lg font-bold text-ink mb-1">Profile</h2>
          <p className="text-sm text-ink-muted mb-4">Used in the greeting on Spend Home.</p>
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
      </>
    ),
    month: <SpendSettingsSections only="month" />,
    budgets: <SpendSettingsSections only="budgets" />,
    categories: <SpendSettingsSections only="categories" />,
    quick: <SpendSettingsSections only="quick" />,
    data: (
      <>
        <SpendDataSection />

        {/* ── Invest data ── */}
        <DataCard
          id="ai-import"
          title="Invest data"
          summary={investSummary(data)}
        >
          <DataRow
            title="Import with AI"
            description="From a screenshot or text from your broker or bank. AI turns it into holdings and cash accounts you check before saving."
            action={<DataAction label="Import" icon={<SparkleIcon className="h-4 w-4" />} onClick={() => setAiImportOpen(true)} />}
          />
        </DataCard>

        {/* ── All data: one backup file for Invest and Spend, restore, reset ── */}
        <DataCard title="All data" summary={`${dataSummary(data)}, stored on this device.`}>
          <DataRow
            title="Export backup"
            description="Everything in Invest and Spend in one JSON file. Keep it somewhere safe."
            status={
              exportToast.kind !== 'idle' && (
                <p role="status" aria-live="polite" className={`mt-1.5 text-xs font-medium ${exportToast.kind === 'success' ? 'text-gain' : 'text-loss'}`}>
                  {exportToast.msg}
                </p>
              )
            }
            action={<DataAction id="btn-export" label="Export" icon={<DownloadIcon className="h-4 w-4" />} onClick={handleExport} />}
          />
          <DataRow
            title="Restore backup"
            description="Load a Spendiary JSON backup. It replaces everything on this device."
            status={
              importToast.kind !== 'idle' && (
                <p
                  role="status"
                  aria-live="polite"
                  className={`mt-1.5 flex items-center gap-1.5 text-xs font-medium ${
                    importToast.kind === 'success' ? 'text-gain' : importToast.kind === 'error' ? 'text-loss' : 'text-ink-muted'
                  }`}
                >
                  {importToast.kind === 'loading' && (
                    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
                    </svg>
                  )}
                  {importToast.msg}
                </p>
              )
            }
            action={
              <>
                <DataAction
                  id="btn-import"
                  label="Restore"
                  icon={<UploadIcon className="h-4 w-4" />}
                  onClick={handleImportClick}
                  disabled={importToast.kind === 'loading'}
                  ariaLabel="Restore data from a JSON backup file"
                />
                <input ref={fileInputRef} type="file" accept=".json,application/json" className="sr-only" aria-hidden="true" onChange={handleFileChange} />
              </>
            }
          />
          <DataRow
            title="Reset everything"
            description="Deletes all your data and signs you out. Export a backup first; this cannot be undone."
            action={
              <DataAction id="btn-reset" label="Reset" tone="danger" icon={<TrashIcon className="h-4 w-4" />} onClick={() => setResetOpen(true)} disabled={isResetting} />
            }
          />
        </DataCard>
      </>
    ),
    about: (
      <Card className="animate-rise overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-surface-muted/80 border border-line/60 flex items-center justify-center p-2.5 shadow-xs shrink-0">
              <img src="/logo.png" alt="Spendiary Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-ink">About Spendiary</h2>
              <p className="text-xs text-ink-muted mt-0.5">
                Designed & Built by bbrightns
              </p>
            </div>
          </div>

          {/* Social / External Links */}
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
          </div>
        </div>

        {/* Why I built it */}
        <div className="pt-4 mt-4 border-t border-line/60 space-y-3">
          <div className="rounded-2xl bg-surface-muted/60 p-4 border border-line/50">
            <div className="flex items-center gap-3.5 mb-3">
              <img
                src="/bbrightns.jpg"
                alt="Praween Piyaprapaphan (Bright)"
                className="w-12 h-12 rounded-full object-cover border-2 border-surface shadow-xs shrink-0"
              />
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-ink leading-tight">
                  Praween Piyaprapaphan (Bright)
                </span>
                <span className="text-xs font-mono text-brand font-semibold leading-normal mt-0.5">
                  Alias: bbrightns
                </span>
              </div>
            </div>
            <p className="text-xs text-ink-muted leading-relaxed">
              An Electrical Engineer who loves writing code and exploring computer & tech. Building handy tools to solve everyday challenges.
            </p>
          </div>

          {/* The Story Behind Spendiary */}
          <div className="rounded-2xl bg-surface-muted/40 p-4 border border-line/50">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">💡</span>
              <h3 className="text-sm font-bold text-ink">Why I Built Spendiary</h3>
            </div>
            <div className="space-y-2 text-xs text-ink-muted leading-relaxed">
              <p>
                This project started purely to solve my own personal headache: having savings and investments scattered across multiple banks and apps to the point where I lost track of where my money actually was! So I decided to build this web app to bring everything together into a clean, single cockpit:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-1 text-xs text-ink-soft">
                <li><strong className="font-semibold text-ink">Real-time Market Prices:</strong> Live price feeds for US Stocks, Gold, and Bitcoin (Thai stocks not included yet).</li>
                <li><strong className="font-semibold text-ink">Comprehensive Retirement FIRE Planner:</strong> In-depth milestone modeling with inflation adjustments and dividend calculations.</li>
                <li><strong className="font-semibold text-ink">Privacy-First Architecture:</strong> Your financial data stays locally on your device with optional encrypted cloud backup.</li>
              </ul>
              <p className="text-xs text-ink-muted pt-1">
                It's 100% free to use. If your portfolio is scattered like mine, feel free to give it a spin! Any feedback or feature requests are always welcome.
              </p>
            </div>
          </div>

        </div>
      </Card>
    ),
  }

  // Old links to the one long page (/settings#category-budgets) open the section that anchor moved to
  if (!section && hash) return <Navigate to={settingsPath(hash)} replace />
  if (section && !open) return <Navigate to="/settings" replace />

  return (
    <>
      <div className={open ? 'hidden xl:block' : undefined}>
        <PageHeader eyebrow="App" title="Settings" subtitle="One place for both Invest and Spend." onStartGuide={startTour} />
      </div>
      {open && (
        <header className="mb-5 xl:hidden">
          <Link
            to="/settings"
            className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-semibold text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <ChevronLeftIcon className="h-4 w-4" />
            Settings
          </Link>
          <h1 className="mt-1 font-display text-3xl font-extrabold leading-none tracking-tight text-ink [text-wrap:balance]">{meta.title}</h1>
          <p className="mt-2 text-sm text-ink-muted">{meta.hint}</p>
        </header>
      )}
      <div className="xl:grid xl:grid-cols-[320px_minmax(0,1fr)] xl:items-start xl:gap-8">
        <div className={`${open ? 'hidden xl:flex' : 'flex'} flex-col gap-4 xl:sticky ${stickyTop}`}>
          {accountCard}
          <SettingsMenu shown={shown} open={open} />
        </div>
        <section aria-labelledby="settings-section-title" className={`${open ? 'flex' : 'hidden xl:flex'} min-w-0 flex-col gap-4`}>
          <div className="hidden px-1 xl:block">
            <h2 id="settings-section-title" className="font-display text-xl font-extrabold text-ink">
              {meta.title}
            </h2>
            <p className="mt-0.5 text-sm text-ink-muted">{meta.hint}</p>
          </div>
          {panels[shown]}
        </section>
      </div>

      <AiImportModal open={aiImportOpen} onClose={() => setAiImportOpen(false)} />

      {/* ── Import confirmation ──────────────────────────────────── */}
      <ConfirmModal
        open={importConfirmOpen}
        onClose={() => {
          setImportConfirmOpen(false)
          setPendingImport(null)
        }}
        onConfirm={() => pendingImport && commitImport(pendingImport)}
        title="Replace your current data?"
        description={`Your current data has ${dataSummary(data)}. The file contains ${pendingImportSummary}. Importing overwrites everything on this device and syncs to the cloud right away.`}
        confirmText="Replace my data"
        confirmVariant="danger"
      >
        <Button variant="secondary" size="sm" onClick={() => exportData()} className="w-full">
          <DownloadIcon className="h-4 w-4" />
          Export current data first
        </Button>
      </ConfirmModal>

      {/* ── Reset confirmation modal ───────────────────────────── */}
      <ConfirmModal
        open={resetOpen}
        onClose={() => {
          if (!isResetting) setResetOpen(false)
        }}
        title="Reset everything?"
        description="This will permanently delete all data of this user and return you to the login screen. Export a backup first if you want to keep anything."
        confirmText={isResetting ? 'Resetting and signing out…' : 'Yes, delete everything'}
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
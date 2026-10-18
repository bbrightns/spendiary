import type { SpendiaryBackup, SpendiaryData } from '../lib/types'
import { localDateStr } from '../lib/format'
import { STORAGE_KEYS } from '../lib/storageKeys'
import { migrate } from './migrate'
import { validateSpendiaryData } from './validate'

/** Backup files: the user's data plus a few device preferences, as one JSON file. */
type Preferences = NonNullable<SpendiaryBackup['preferences']>

/** The device preferences worth carrying in a backup (theme, P/L display, …). */
export function readPreferences(): Preferences {
  const preferences: Preferences = {}
  try {
    const theme = localStorage.getItem(STORAGE_KEYS.theme)
    const pnlDisplay = localStorage.getItem(STORAGE_KEYS.pnlDisplay)
    const logsViewMode = localStorage.getItem(STORAGE_KEYS.logsViewMode)
    const goldSellUnit = localStorage.getItem(STORAGE_KEYS.goldSellUnit)
    if (theme === 'light' || theme === 'dark' || theme === 'system') preferences.theme = theme
    if (pnlDisplay === 'pct' || pnlDisplay === 'thb') preferences.pnlDisplay = pnlDisplay
    if (logsViewMode === 'table' || logsViewMode === 'timeline') preferences.logsViewMode = logsViewMode
    if (goldSellUnit === 'grams' || goldSellUnit === 'baht') preferences.goldSellUnit = goldSellUnit
  } catch {
    // Preferences are optional; financial data remains exportable if storage is unavailable.
  }
  return preferences
}

export function makeBackup(data: SpendiaryData, preferences: Preferences): SpendiaryBackup {
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    data,
    preferences,
  }
}

/** Save the backup as spendiary-backup-YYYY-MM-DD.json (browser download). */
export function downloadBackup(backup: SpendiaryBackup) {
  const json = JSON.stringify(backup, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `spendiary-backup-${localDateStr()}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export type ParsedBackup =
  | { ok: true; data: SpendiaryData; preferences?: Preferences }
  | { ok: false; error: string }

/** Read a backup file (current envelope or an old bare-data export), validated and migrated. */
export function parseBackup(jsonString: string): ParsedBackup {
  // 1. Parse
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonString)
  } catch {
    return { ok: false, error: 'The file is not valid JSON. Make sure you chose the right file.' }
  }

  // 2. Accept the current envelope and legacy root-data exports.
  const backup = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
    ? parsed as Partial<SpendiaryBackup> & SpendiaryData
    : null
  const importedData = backup && backup.schemaVersion === 1 && backup.data
    ? backup.data
    : parsed

  // 3. Strict schema validation
  if (!validateSpendiaryData(importedData)) {
    return {
      ok: false,
      error: 'File does not match the Spendiary data format. Required fields (holdings, dcaPlans, cashAccounts, transfers, monthlyIncome) are missing or have the wrong type.',
    }
  }

  // 4. Migrate legacy fields
  const migrated = migrate(importedData)
  // Stamp lastUpdatedAt so this import wins any cloud conflict resolution
  const stamped: SpendiaryData = { ...migrated, lastUpdatedAt: Date.now() }
  return { ok: true, data: stamped, preferences: backup?.schemaVersion === 1 ? backup.preferences : undefined }
}

/** Put the backup's preferences back on this device; best effort. */
export function applyPreferences(preferences: Preferences) {
  try {
    const { theme, pnlDisplay, logsViewMode, goldSellUnit } = preferences
    if (theme) localStorage.setItem(STORAGE_KEYS.theme, theme)
    if (pnlDisplay) localStorage.setItem(STORAGE_KEYS.pnlDisplay, pnlDisplay)
    if (logsViewMode) localStorage.setItem(STORAGE_KEYS.logsViewMode, logsViewMode)
    if (goldSellUnit) localStorage.setItem(STORAGE_KEYS.goldSellUnit, goldSellUnit)
  } catch {
    // Preference restoration is best effort and must not invalidate the import.
  }
}

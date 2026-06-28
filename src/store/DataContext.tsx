import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { BtcLocation, CashAccount, DcaPlan, FixedCostItem, GoldLocation, Holding, HoldingLog, NetWorthSnapshot, RetirementSettings, SpendiaryData, Transfer } from '../lib/types'
import { localDateStr } from '../lib/format'

const STORAGE_KEY = 'spendiary.data.v1'
const BACKUP_KEY = 'spendiary.backup.v1'
const MAX_BACKUPS = 5
const BACKUP_INTERVAL_MS = 60 * 60 * 1000 // write a new snapshot at most once per hour

export interface DataBackup {
  savedAt: string // ISO timestamp
  data: SpendiaryData
}

function readBackups(): DataBackup[] {
  try {
    const raw = localStorage.getItem(BACKUP_KEY)
    if (raw) return JSON.parse(raw) as DataBackup[]
  } catch { /* ignore */ }
  return []
}

function writeBackup(data: SpendiaryData) {
  try {
    const backups = readBackups()
    const lastSaved = backups[0] ? new Date(backups[0].savedAt).getTime() : 0
    if (Date.now() - lastSaved < BACKUP_INTERVAL_MS) return // too soon
    const next = [{ savedAt: new Date().toISOString(), data }, ...backups].slice(0, MAX_BACKUPS)
    localStorage.setItem(BACKUP_KEY, JSON.stringify(next))
  } catch { /* non-fatal */ }
}

// ── Cloud sync (optional) ─────────────────────────────────────────────────────
// Set VITE_API_URL and VITE_API_TOKEN in .env.local to enable Cloudflare sync.
// Without them the app works purely from localStorage (offline mode).
const API_URL = import.meta.env.VITE_API_URL as string | undefined
const API_TOKEN = import.meta.env.VITE_API_TOKEN as string | undefined
const API_ENABLED = Boolean(API_URL && API_TOKEN)

function apiHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${API_TOKEN}`,
  }
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error'

const emptyData: SpendiaryData = {
  cashAccounts: [],
  monthlyIncome: 0,
  holdings: [],
  dcaPlans: [],
  transfers: [],
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** Result returned by importData — UI can react to success/error */
export type ImportResult =
  | { ok: true }
  | { ok: false; error: string }

/** Strict runtime validation of an incoming JSON object as SpendiaryData. */
export function validateSpendiaryData(obj: unknown): obj is SpendiaryData {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return false
  const d = obj as Record<string, unknown>
  // Required top-level keys
  if (!Array.isArray(d.cashAccounts)) return false
  if (!Array.isArray(d.holdings)) return false
  if (!Array.isArray(d.dcaPlans)) return false
  if (!Array.isArray(d.transfers)) return false
  if (typeof d.monthlyIncome !== 'number') return false
  // Validate each holding shape
  for (const h of d.holdings as unknown[]) {
    if (typeof h !== 'object' || h === null) return false
    const hh = h as Record<string, unknown>
    if (typeof hh.id !== 'string') return false
    if (typeof hh.name !== 'string') return false
    if (typeof hh.units !== 'number') return false
    if (typeof hh.avgCost !== 'number') return false
    if (typeof hh.price !== 'number') return false
    if (!['fund', 'stock', 'crypto', 'gold'].includes(hh.assetClass as string)) return false
  }
  // Validate each DCA plan shape
  for (const p of d.dcaPlans as unknown[]) {
    if (typeof p !== 'object' || p === null) return false
    const pp = p as Record<string, unknown>
    if (typeof pp.id !== 'string') return false
    if (typeof pp.monthlyAmount !== 'number') return false
  }
  // Validate each transfer shape
  for (const t of d.transfers as unknown[]) {
    if (typeof t !== 'object' || t === null) return false
    const tt = t as Record<string, unknown>
    if (typeof tt.id !== 'string') return false
    if (typeof tt.amount !== 'number') return false
    if (typeof tt.completed !== 'number') return false
    if (typeof tt.total !== 'number') return false
  }
  // Validate each cash account
  for (const a of d.cashAccounts as unknown[]) {
    if (typeof a !== 'object' || a === null) return false
    const aa = a as Record<string, unknown>
    if (typeof aa.id !== 'string') return false
    if (typeof aa.balance !== 'number') return false
  }
  return true
}

interface DataContextValue {
  data: SpendiaryData
  setData: (next: SpendiaryData) => void
  loadSample: () => void
  clearAll: () => void
  syncStatus: SyncStatus
  setCashAccounts: (accounts: CashAccount[]) => void
  setMonthlyIncome: (income: number) => void
  setUserName: (name: string) => void
  setMonthlyFixedCost: (cost: number) => void
  upsertFixedCostItem: (item: Omit<FixedCostItem, 'id'> & { id?: string }) => void
  removeFixedCostItem: (id: string) => void
  setMonthlyPersonal: (amount: number) => void
  /** Live USD/THB rate — set by useLivePrices, used by forms to convert USD inputs */
  usdThb: number | null
  setUsdThb: (rate: number) => void

  upsertHolding: (holding: Omit<Holding, 'id'> & { id?: string }) => void
  removeHolding: (id: string) => void
  reorderHoldings: (ids: string[]) => void
  addHoldingLog: (log: Omit<HoldingLog, 'id' | 'timestamp'>) => void

  upsertPlan: (plan: Omit<DcaPlan, 'id'> & { id?: string }) => void
  removePlan: (id: string) => void
  confirmDcaBuy: (planId: string, pricePerUnit: number, date: string) => void
  skipDcaBuy: (planId: string, date: string) => void

  upsertTransfer: (transfer: Omit<Transfer, 'id'> & { id?: string }) => void
  removeTransfer: (id: string) => void

  setRetirement: (settings: RetirementSettings) => void
  recordNetWorthSnapshot: (value: number) => void
  /** ISO timestamp of the last successful cloud sync, or null */
  lastSyncedAt: Date | null
  /** Local rolling backups (newest first) */
  backups: DataBackup[]
  restoreBackup: (backup: DataBackup) => void
  upsertBtcLocation: (holdingId: string, loc: Omit<BtcLocation, 'id'> & { id?: string }) => void
  removeBtcLocation: (holdingId: string, locId: string) => void
  upsertGoldLocation: (holdingId: string, loc: Omit<GoldLocation, 'id'> & { id?: string }) => void
  removeGoldLocation: (holdingId: string, locId: string) => void

  /** Download the current data as a dated JSON file (browser download). */
  exportData: () => void
  /**
   * Parse + validate a JSON string and, if valid, atomically:
   *   1. Update React state
   *   2. Persist to localStorage
   *   3. Immediately push to Cloudflare cloud (skips debounce)
   * Returns { ok: true } on success or { ok: false; error } on failure.
   */
  importData: (jsonString: string) => ImportResult
}

const DataContext = createContext<DataContextValue | null>(null)

type LegacyPlan = DcaPlan & { monthlyTarget?: number; contributed?: number }

/** Migrate older saved shapes into the current model. */
function migrate(raw: SpendiaryData & { cash?: number }): SpendiaryData {
  const merged = { ...emptyData, ...raw }
  if (typeof merged.monthlyIncome !== 'number') merged.monthlyIncome = 0
  if (!Array.isArray(merged.cashAccounts)) merged.cashAccounts = []
  // Old single-cash field → a default account.
  if (merged.cashAccounts.length === 0 && typeof raw.cash === 'number' && raw.cash > 0) {
    merged.cashAccounts = [{ id: newId(), name: 'Cash', balance: raw.cash }]
  }
  // Old DCA plans used `monthlyTarget` + `contributed`.
  // Spread first to preserve ALL fields (frequency, holdingId, confirmedDates, skippedDates, etc.)
  merged.dcaPlans = (merged.dcaPlans ?? []).map((p) => {
    const lp = p as LegacyPlan
    return {
      ...lp,
      id: lp.id ?? newId(),
      monthlyAmount: lp.monthlyAmount ?? lp.monthlyTarget ?? 0,
      dayOfMonth: lp.dayOfMonth ?? 1,
    }
  })
  // Migrate legacy single monthlyFixedCost → fixedCostItems array
  if (!Array.isArray(merged.fixedCostItems) || merged.fixedCostItems.length === 0) {
    if (typeof merged.monthlyFixedCost === 'number' && merged.monthlyFixedCost > 0) {
      merged.fixedCostItems = [{ id: newId(), name: 'Fixed Cost', amount: merged.monthlyFixedCost }]
    } else {
      merged.fixedCostItems = []
    }
  }
  delete (merged as { cash?: number }).cash
  return merged
}

function load(): SpendiaryData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return migrate(JSON.parse(raw))
  } catch {
    /* ignore corrupt storage */
  }
  return emptyData
}

/** Insert (when no id) or replace (when id matches) an item in a list. */
function upsert<T extends { id: string }>(list: T[], item: Omit<T, 'id'> & { id?: string }): T[] {
  if (item.id && list.some((x) => x.id === item.id)) {
    return list.map((x) => (x.id === item.id ? ({ ...x, ...item } as T) : x))
  }
  return [...list, { ...item, id: item.id ?? newId() } as T]
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setDataState] = useState<SpendiaryData>(load)
  const [usdThb, setUsdThb] = useState<number | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)
  const [backups, setBackups] = useState<DataBackup[]>(readBackups)

  // Tracks whether the initial API load has completed (prevents syncing
  // back immediately after we receive data from the server).
  const syncReady = useRef(!API_ENABLED)
  // Last data string we synced to the API — avoids redundant PUTs.
  const lastSynced = useRef('')
  // Snapshot of data at mount — used to detect local changes made before
  // the initial GET completes (race condition guard).
  const mountSnapshot = useRef(JSON.stringify(load()))
  // Mirror of current data as a ref so GET callback can read it without
  // capturing a stale closure.
  const dataRef = useRef(data)
  dataRef.current = data

  // A wrapper for setDataState that automatically adds/updates lastUpdatedAt.
  const updateData = (next: SpendiaryData | ((prev: SpendiaryData) => SpendiaryData)) => {
    setDataState((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next
      return {
        ...resolved,
        lastUpdatedAt: Date.now(),
      }
    })
  }

  // ── Persist to localStorage + rolling backup ─────────────────
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      writeBackup(data)
      setBackups(readBackups())
    } catch {
      /* storage may be unavailable; non-fatal */
    }
  }, [data])

  // ── Load from Cloudflare on first mount ──────────────────────
  useEffect(() => {
    if (!API_ENABLED) return
    let isMounted = true

    fetch(`${API_URL}/api/data`, { headers: apiHeaders() })
      .then((r) => {
        if (r.ok) {
          return r.json().then((payload) => ({ payload, status: r.status }))
        }
        return { payload: null, status: r.status }
      })
      .then(({ payload: remote, status }) => {
        if (!isMounted) return

        if (status === 200 && remote && typeof remote === 'object' && !Array.isArray(remote)) {
          const migrated = migrate(remote as SpendiaryData)
          const migratedStr = JSON.stringify(migrated)
          const currentStr = JSON.stringify(dataRef.current)

          // Safety: never let an empty cloud overwrite non-empty local data.
          const cloudHasData =
            (migrated.holdings?.length ?? 0) > 0 ||
            (migrated.dcaPlans?.length ?? 0) > 0 ||
            (migrated.transfers?.length ?? 0) > 0
          const localHasData =
            (dataRef.current.holdings?.length ?? 0) > 0 ||
            (dataRef.current.dcaPlans?.length ?? 0) > 0 ||
            (dataRef.current.transfers?.length ?? 0) > 0

          if (!cloudHasData && localHasData) {
            // Cloud is empty but local has data — keep local, will sync up.
            lastSynced.current = ''
            syncReady.current = true
            return
          }

          // If local data is newer than cloud data AND local has data, keep local.
          const localTime = dataRef.current.lastUpdatedAt ?? 0
          const cloudTime = migrated.lastUpdatedAt ?? 0
          if (localTime > cloudTime && localHasData) {
            lastSynced.current = ''
            syncReady.current = true
            return
          }

          // If user made local changes before GET completed, keep their
          // changes and let the debounced PUT sync them to cloud instead.
          if (currentStr !== mountSnapshot.current) {
            lastSynced.current = ''
            syncReady.current = true
          } else {
            // No local changes — safe to load cloud data.
            lastSynced.current = migratedStr
            setDataState(migrated)
            syncReady.current = true
          }
        } else if (status === 404) {
          // Cloud is empty — safe to upload local data.
          lastSynced.current = ''
          syncReady.current = true
        } else {
          // Other status (e.g. 500 or auth error) — keep local but do NOT set syncReady
          setSyncStatus('error')
        }
      })
      .catch(() => {
        if (!isMounted) return
        /* network error — keep localStorage data and do NOT set syncReady */
        setSyncStatus('error')
      })

    return () => {
      isMounted = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Debounced sync to Cloudflare on data change ──────────────
  useEffect(() => {
    if (!API_ENABLED) return
    if (!syncReady.current) return
    const serialised = JSON.stringify(data)
    if (serialised === lastSynced.current) return   // nothing changed
    setSyncStatus('syncing')
    const timer = setTimeout(() => {
      fetch(`${API_URL}/api/data`, {
        method: 'PUT',
        headers: apiHeaders(),
        body: serialised,
      })
        .then((r) => {
          if (r.ok) {
            lastSynced.current = serialised
            setSyncStatus('synced')
            setLastSyncedAt(new Date())
          } else {
            setSyncStatus('error')
          }
        })
        .catch(() => setSyncStatus('error'))
    }, 2000)
    return () => clearTimeout(timer)
  }, [data])

  const value = useMemo<DataContextValue>(
    () => ({
      data,
      setData: updateData,
      loadSample: () => {},
      clearAll: () => updateData(emptyData),
      syncStatus,
      lastSyncedAt,
      usdThb,
      setUsdThb,
      setCashAccounts: (cashAccounts) => updateData((prev) => ({ ...prev, cashAccounts })),
      setMonthlyIncome: (monthlyIncome) => updateData((prev) => ({ ...prev, monthlyIncome })),
      setUserName: (userName) => updateData((prev) => ({ ...prev, userName })),
      setMonthlyFixedCost: (monthlyFixedCost) => updateData((prev) => ({ ...prev, monthlyFixedCost })),
      upsertFixedCostItem: (item) =>
        updateData((prev) => ({ ...prev, fixedCostItems: upsert(prev.fixedCostItems ?? [], item) })),
      removeFixedCostItem: (id) =>
        updateData((prev) => ({ ...prev, fixedCostItems: (prev.fixedCostItems ?? []).filter((x) => x.id !== id) })),
      setMonthlyPersonal: (monthlyPersonal) => updateData((prev) => ({ ...prev, monthlyPersonal })),

      upsertHolding: (holding) =>
        updateData((prev) => ({ ...prev, holdings: upsert(prev.holdings, holding) })),
      removeHolding: (id) =>
        updateData((prev) => ({ ...prev, holdings: prev.holdings.filter((h) => h.id !== id) })),

      reorderHoldings: (ids) =>
        updateData((prev) => ({
          ...prev,
          holdings: ids.map((id) => prev.holdings.find((h) => h.id === id)!).filter(Boolean),
        })),

      addHoldingLog: (log) =>
        updateData((prev) => ({
          ...prev,
          holdingLogs: [
            { ...log, id: newId(), timestamp: new Date().toISOString() },
            ...(prev.holdingLogs ?? []),
          ].slice(0, 200),  // keep last 200 entries
        })),

      upsertPlan: (plan) =>
        updateData((prev) => ({ ...prev, dcaPlans: upsert(prev.dcaPlans, plan) })),
      removePlan: (id) =>
        updateData((prev) => ({ ...prev, dcaPlans: prev.dcaPlans.filter((p) => p.id !== id) })),

      confirmDcaBuy: (planId, pricePerUnit, date) =>
        updateData((prev) => {
          const plan = prev.dcaPlans.find((p) => p.id === planId)
          if (!plan) return prev

          // 1. Mark date as confirmed on the plan
          const updatedPlans = prev.dcaPlans.map((p) =>
            p.id !== planId ? p : {
              ...p,
              confirmedDates: [date, ...(p.confirmedDates ?? [])],
            }
          )

          // 2. If plan is linked to a holding, apply the buy
          if (!plan.holdingId || pricePerUnit <= 0) {
            return { ...prev, dcaPlans: updatedPlans }
          }
          const holding = prev.holdings.find((h) => h.id === plan.holdingId)
          if (!holding) return { ...prev, dcaPlans: updatedPlans }

          // BTC: units are derived from btcLocations (managed by upsertBtcLocation).
          // Don't update units/avgCost here — just update the live price + date.
          const isBtcWithLocations =
            holding.assetClass === 'crypto' &&
            (holding.btcLocations?.length ?? 0) > 0

          const units = plan.monthlyAmount / pricePerUnit
          const newUnits = holding.units + units
          const newAvgCost = (holding.units * holding.avgCost + units * pricePerUnit) / newUnits
          const updatedHoldings = prev.holdings.map((h) =>
            h.id !== plan.holdingId ? h : isBtcWithLocations
              ? { ...h, price: pricePerUnit, updatedAt: date }
              : { ...h, units: newUnits, avgCost: newAvgCost, price: pricePerUnit, updatedAt: date }
          )

          // 3. Add to holding log
          const logEntry: import('../lib/types').HoldingLog = {
            id: newId(),
            timestamp: new Date().toISOString(),
            action: 'buy_more',
            holdingName: holding.name,
            ticker: holding.ticker,
            assetClass: holding.assetClass,
            note: holding.assetClass === 'crypto'
              ? `DCA · +${Math.round(units * 1e8).toLocaleString()} sats · ฿${plan.monthlyAmount.toLocaleString()} total`
              : holding.assetClass === 'gold'
              ? `DCA · +${units.toFixed(4)} g · ฿${plan.monthlyAmount.toLocaleString()} total`
              : `DCA · +${units.toFixed(4)} units @ ฿${pricePerUnit.toLocaleString()}/unit · ฿${plan.monthlyAmount.toLocaleString()} total`,
          }

          return {
            ...prev,
            dcaPlans: updatedPlans,
            holdings: updatedHoldings,
            holdingLogs: [logEntry, ...(prev.holdingLogs ?? [])].slice(0, 200),
          }
        }),

      skipDcaBuy: (planId, date) =>
        updateData((prev) => ({
          ...prev,
          dcaPlans: prev.dcaPlans.map((p) =>
            p.id !== planId ? p : {
              ...p,
              skippedDates: [date, ...(p.skippedDates ?? [])],
            }
          ),
        })),

      upsertTransfer: (transfer) =>
        updateData((prev) => ({ ...prev, transfers: upsert(prev.transfers, transfer) })),
      removeTransfer: (id) =>
        updateData((prev) => ({ ...prev, transfers: prev.transfers.filter((t) => t.id !== id) })),

      setRetirement: (retirement) =>
        updateData((prev) => ({ ...prev, retirement })),

      recordNetWorthSnapshot: (value) =>
        updateData((prev) => {
          if (value <= 0) return prev
          const today = localDateStr()
          const existing = prev.netWorthHistory ?? []
          // Replace today's entry (prices may have updated) and keep last 365
          const updated = [...existing.filter((s: NetWorthSnapshot) => s.date !== today), { date: today, value }]
            .sort((a: NetWorthSnapshot, b: NetWorthSnapshot) => a.date.localeCompare(b.date))
            .slice(-365)
          return { ...prev, netWorthHistory: updated }
        }),

      backups,
      restoreBackup: (backup) => {
        setDataState(backup.data)
        // Force a new backup snapshot after restore so you can undo if needed
        try {
          const current = readBackups()
          const next = [{ savedAt: new Date().toISOString(), data: backup.data }, ...current].slice(0, MAX_BACKUPS)
          localStorage.setItem(BACKUP_KEY, JSON.stringify(next))
          setBackups(next)
        } catch { /* non-fatal */ }
      },

      // ── Export ────────────────────────────────────────────────
      exportData: () => {
        const json = JSON.stringify(dataRef.current, null, 2)
        const blob = new Blob([json], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `spendiary-backup-${new Date().toISOString().slice(0, 10)}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      },

      // ── Import ────────────────────────────────────────────────
      importData: (jsonString) => {
        // 1. Parse
        let parsed: unknown
        try {
          parsed = JSON.parse(jsonString)
        } catch {
          return { ok: false, error: 'The file is not valid JSON. Make sure you chose the right file.' }
        }

        // 2. Strict schema validation
        if (!validateSpendiaryData(parsed)) {
          return {
            ok: false,
            error: 'File does not match the Spendiary data format. Required fields (holdings, dcaPlans, cashAccounts, transfers, monthlyIncome) are missing or have the wrong type.',
          }
        }

        // 3. Migrate legacy fields
        const migrated = migrate(parsed)
        // Stamp lastUpdatedAt so this import wins any cloud conflict resolution
        const stamped: SpendiaryData = { ...migrated, lastUpdatedAt: Date.now() }

        // 4. Persist to localStorage immediately (before React re-render)
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(stamped))
        } catch { /* non-fatal — storage may be full */ }

        // 5. Update React state
        setDataState(stamped)

        // 6. Force an immediate cloud push (bypass the 2-second debounce)
        if (API_ENABLED) {
          const serialised = JSON.stringify(stamped)
          setSyncStatus('syncing')
          fetch(`${API_URL}/api/data`, {
            method: 'PUT',
            headers: apiHeaders(),
            body: serialised,
          })
            .then((r) => {
              if (r.ok) {
                lastSynced.current = serialised
                setSyncStatus('synced')
                setLastSyncedAt(new Date())
              } else {
                setSyncStatus('error')
              }
            })
            .catch(() => setSyncStatus('error'))
        }

        return { ok: true }
      },

      upsertBtcLocation: (holdingId, loc) =>
        updateData((prev) => ({
          ...prev,
          holdings: prev.holdings.map((h) => {
            if (h.id !== holdingId) return h
            const locations = upsert(h.btcLocations ?? [], loc)
            const totalSats = locations.reduce((s, l) => s + l.satoshi, 0)
            const totalThb = locations.reduce((s, l) => s + l.thbSpent, 0)
            const units = totalSats / 100_000_000
            const avgCost = units > 0 ? totalThb / units : h.avgCost
            return { ...h, btcLocations: locations, units, avgCost }
          }),
        })),

      removeBtcLocation: (holdingId, locId) =>
        updateData((prev) => ({
          ...prev,
          holdings: prev.holdings.map((h) => {
            if (h.id !== holdingId) return h
            const locations = (h.btcLocations ?? []).filter((l) => l.id !== locId)
            const totalSats = locations.reduce((s, l) => s + l.satoshi, 0)
            const totalThb = locations.reduce((s, l) => s + l.thbSpent, 0)
            const units = totalSats / 100_000_000
            const avgCost = units > 0 ? totalThb / units : h.avgCost
            return { ...h, btcLocations: locations, units, avgCost }
          }),
        })),

      upsertGoldLocation: (holdingId, loc) =>
        updateData((prev) => ({
          ...prev,
          holdings: prev.holdings.map((h) => {
            if (h.id !== holdingId) return h
            const locations = upsert(h.goldLocations ?? [], loc)
            const totalGrams = locations.reduce((s, l) => s + l.grams, 0)
            const totalThb = locations.reduce((s, l) => s + l.thbSpent, 0)
            const avgCost = totalGrams > 0 ? totalThb / totalGrams : h.avgCost
            return { ...h, goldLocations: locations, units: totalGrams, avgCost }
          }),
        })),

      removeGoldLocation: (holdingId, locId) =>
        updateData((prev) => ({
          ...prev,
          holdings: prev.holdings.map((h) => {
            if (h.id !== holdingId) return h
            const locations = (h.goldLocations ?? []).filter((l) => l.id !== locId)
            const totalGrams = locations.reduce((s, l) => s + l.grams, 0)
            const totalThb = locations.reduce((s, l) => s + l.thbSpent, 0)
            const avgCost = totalGrams > 0 ? totalThb / totalGrams : h.avgCost
            return { ...h, goldLocations: locations, units: totalGrams, avgCost }
          }),
        })),
    }),
    [data, syncStatus, lastSyncedAt, backups],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useData(): DataContextValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}

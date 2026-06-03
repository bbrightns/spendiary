import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { BtcLocation, CashAccount, DcaPlan, Holding, RetirementSettings, SpendiaryData, Transfer } from '../lib/types'

const STORAGE_KEY = 'spendiary.data.v1'

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

interface DataContextValue {
  data: SpendiaryData
  setData: (next: SpendiaryData) => void
  loadSample: () => void
  clearAll: () => void
  syncStatus: SyncStatus
  setCashAccounts: (accounts: CashAccount[]) => void
  setMonthlyIncome: (income: number) => void
  /** Live USD/THB rate — set by useLivePrices, used by forms to convert USD inputs */
  usdThb: number | null
  setUsdThb: (rate: number) => void

  upsertHolding: (holding: Omit<Holding, 'id'> & { id?: string }) => void
  removeHolding: (id: string) => void

  upsertPlan: (plan: Omit<DcaPlan, 'id'> & { id?: string }) => void
  removePlan: (id: string) => void

  upsertTransfer: (transfer: Omit<Transfer, 'id'> & { id?: string }) => void
  removeTransfer: (id: string) => void

  setRetirement: (settings: RetirementSettings) => void
  upsertBtcLocation: (holdingId: string, loc: Omit<BtcLocation, 'id'> & { id?: string }) => void
  removeBtcLocation: (holdingId: string, locId: string) => void
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
  merged.dcaPlans = (merged.dcaPlans ?? []).map((p) => {
    const lp = p as LegacyPlan
    return {
      id: lp.id ?? newId(),
      name: lp.name,
      assetClass: lp.assetClass,
      monthlyAmount: lp.monthlyAmount ?? lp.monthlyTarget ?? 0,
      dayOfMonth: lp.dayOfMonth ?? 1,
    }
  })
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

  // Tracks whether the initial API load has completed (prevents syncing
  // back immediately after we receive data from the server).
  const syncReady = useRef(!API_ENABLED)
  // Last data string we synced to the API — avoids redundant PUTs.
  const lastSynced = useRef('')

  // ── Persist to localStorage ──────────────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      /* storage may be unavailable; non-fatal */
    }
  }, [data])

  // ── Load from Cloudflare on first mount ──────────────────────
  useEffect(() => {
    if (!API_ENABLED) return
    fetch(`${API_URL}/api/data`, { headers: apiHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((remote) => {
        if (remote && typeof remote === 'object' && !Array.isArray(remote)) {
          const migrated = migrate(remote as SpendiaryData)
          lastSynced.current = JSON.stringify(migrated)
          setDataState(migrated)
        }
      })
      .catch(() => { /* network error — keep localStorage data */ })
      .finally(() => { syncReady.current = true })
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
      setData: setDataState,
      loadSample: () => {},
      clearAll: () => setDataState(emptyData),
      syncStatus,
      usdThb,
      setUsdThb,
      setCashAccounts: (cashAccounts) => setDataState((prev) => ({ ...prev, cashAccounts })),
      setMonthlyIncome: (monthlyIncome) => setDataState((prev) => ({ ...prev, monthlyIncome })),

      upsertHolding: (holding) =>
        setDataState((prev) => ({ ...prev, holdings: upsert(prev.holdings, holding) })),
      removeHolding: (id) =>
        setDataState((prev) => ({ ...prev, holdings: prev.holdings.filter((h) => h.id !== id) })),

      upsertPlan: (plan) =>
        setDataState((prev) => ({ ...prev, dcaPlans: upsert(prev.dcaPlans, plan) })),
      removePlan: (id) =>
        setDataState((prev) => ({ ...prev, dcaPlans: prev.dcaPlans.filter((p) => p.id !== id) })),

      upsertTransfer: (transfer) =>
        setDataState((prev) => ({ ...prev, transfers: upsert(prev.transfers, transfer) })),
      removeTransfer: (id) =>
        setDataState((prev) => ({ ...prev, transfers: prev.transfers.filter((t) => t.id !== id) })),

      setRetirement: (retirement) =>
        setDataState((prev) => ({ ...prev, retirement })),

      upsertBtcLocation: (holdingId, loc) =>
        setDataState((prev) => ({
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
        setDataState((prev) => ({
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
    }),
    [data, syncStatus],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useData(): DataContextValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}

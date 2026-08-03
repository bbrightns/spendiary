import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { AssetClass, BtcLocation, CashAccount, DcaPlan, FixedCostItem, GoldLocation, Holding, HoldingLog, NetWorthSnapshot, RetirementSettings, SpendiaryData, Transfer } from '../lib/types'
import { localDateStr } from '../lib/format'
import { seedData } from '../lib/seed'

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
  if (d.rebalanceTargets !== undefined) {
    if (typeof d.rebalanceTargets !== 'object' || d.rebalanceTargets === null || Array.isArray(d.rebalanceTargets)) return false
    const rt = d.rebalanceTargets as Record<string, unknown>
    for (const k of Object.keys(rt)) {
      if (typeof rt[k] !== 'number') return false
    }
  }
  return true
}

interface DataContextValue {
  data: SpendiaryData
  setData: (next: SpendiaryData) => void
  loadSample: () => void
  clearAll: () => void
  syncStatus: SyncStatus
  user: User | null
  loginWithGoogle: () => Promise<void>
  loginAsGuest: () => void
  loginAsTestMode: () => void
  authError: string | null
  logout: () => Promise<void>
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
  undoHoldingLog: (logId: string) => void

  upsertPlan: (plan: Omit<DcaPlan, 'id'> & { id?: string }) => void
  removePlan: (id: string) => void
  confirmDcaBuy: (
    planId: string,
    pricePerUnit: number,
    date: string,
    overrideUnits?: number,
    overrideAvgCost?: number,
    overridePrice?: number,
    btcLocationUpdate?: Omit<BtcLocation, 'id'> & { id?: string },
    goldLocationUpdate?: Omit<GoldLocation, 'id'> & { id?: string },
  ) => void
  skipDcaBuy: (planId: string, date: string) => void

  upsertTransfer: (transfer: Omit<Transfer, 'id'> & { id?: string }) => void
  removeTransfer: (id: string) => void

  setRetirement: (settings: RetirementSettings) => void
  setRebalanceTargets: (targets: Record<AssetClass, number>) => void
  recordNetWorthSnapshot: (value: number) => void
  recordPortfolioSnapshot: (value: number) => void
  /** ISO timestamp of the last successful cloud sync, or null */
  lastSyncedAt: Date | null

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



/** Insert (when no id) or replace (when id matches) an item in a list. */
function upsert<T extends { id: string }>(list: T[], item: Omit<T, 'id'> & { id?: string }): T[] {
  if (item.id && list.some((x) => x.id === item.id)) {
    return list.map((x) => (x.id === item.id ? ({ ...x, ...item } as T) : x))
  }
  return [...list, { ...item, id: item.id ?? newId() } as T]
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setDataState] = useState<SpendiaryData>(emptyData)
  const [usdThb, setUsdThb] = useState<number | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(() => {
    const stored = localStorage.getItem('spendiary.last_synced_time')
    return stored ? new Date(stored) : null
  })

  const updateLastSynced = (date: Date | null) => {
    setLastSyncedAt(date)
    if (date) {
      localStorage.setItem('spendiary.last_synced_time', date.toISOString())
    } else {
      localStorage.removeItem('spendiary.last_synced_time')
    }
  }

  const [user, setUser] = useState<User | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  
  // Tracks whether the initial Supabase load has completed (prevents syncing
  // back immediately after we receive data from the server).
  const syncReady = useRef(false)
  // Last data string we synced to Supabase — avoids redundant writes.
  const lastSynced = useRef('')
  // Mirror of current data as a ref so callbacks can read it without
  // capturing a stale closure.
  const dataRef = useRef(data)
  dataRef.current = data

  // Auth setup
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const loginWithGoogle = async () => {
    setAuthError(null)
    const supabaseUrl = import.meta.env.VITE_API_URL || ''
    const supabaseKey = import.meta.env.VITE_API_TOKEN || ''

    if (!supabaseUrl || !supabaseKey) {
      setAuthError('ยังไม่ได้ตั้งค่า Supabase URL หรือ Token ในไฟล์ .env (กรุณาดูไฟล์ .env.example หรือใช้โหมด Guest ด้านล่าง)')
      return
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      })
      if (error) {
        setAuthError(`ไม่สามารถเข้าสู่ระบบด้วย Google ได้: ${error.message}`)
      }
    } catch (err: any) {
      console.error('Sign in error:', err)
      setAuthError(`เกิดข้อผิดพลาดในการ Sign In: ${err?.message || 'ไม่สามารถติดต่อ Supabase ได้'}`)
    }
  }

  const loginAsGuest = () => {
    setAuthError(null)
    const guestUser: User = {
      id: 'guest-user-local',
      app_metadata: { provider: 'guest' },
      user_metadata: { name: 'Guest User' },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
      email: 'guest@spendiary.local',
      role: 'authenticated'
    }
    setUser(guestUser)
  }

  const loginAsTestMode = () => {
    setAuthError(null)
    const testUser: User = {
      id: 'test-user-local',
      app_metadata: { provider: 'test' },
      user_metadata: { name: 'Test Mode User' },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
      email: 'test@spendiary.local',
      role: 'authenticated'
    }
    setUser(testUser)
  }

  const logout = async () => {
    if (user?.id !== 'guest-user-local' && user?.id !== 'test-user-local') {
      await supabase.auth.signOut()
    }
    localStorage.removeItem('spendiary.last_user_id')
    localStorage.removeItem('spendiary.last_synced_time')
    setUser(null)
    setDataState(emptyData)
    updateLastSynced(null)
  }

  const fetchRemoteData = async (userId: string) => {
    if (userId === 'guest-user-local') {
      const local = localStorage.getItem('spendiary.guest_data')
      if (local) {
        try {
          const parsed = JSON.parse(local)
          const migrated = migrate(parsed)
          lastSynced.current = JSON.stringify(migrated)
          setDataState(migrated)
        } catch {
          setDataState(emptyData)
        }
      } else {
        setDataState(emptyData)
      }
      setSyncStatus('synced')
      syncReady.current = true
      return
    }

    if (userId === 'test-user-local') {
      const local = localStorage.getItem('spendiary.test_data')
      if (local) {
        try {
          const parsed = JSON.parse(local)
          const migrated = migrate(parsed)
          lastSynced.current = JSON.stringify(migrated)
          setDataState(migrated)
        } catch {
          const migrated = migrate(seedData)
          lastSynced.current = JSON.stringify(migrated)
          setDataState(migrated)
        }
      } else {
        const migrated = migrate(seedData)
        lastSynced.current = JSON.stringify(migrated)
        setDataState(migrated)
      }
      setSyncStatus('synced')
      syncReady.current = true
      return
    }

    try {
      setSyncStatus('syncing')
      const { data: row, error } = await supabase
        .from('user_data')
        .select('payload')
        .eq('id', userId)
        .maybeSingle()

      if (error) throw error

      if (row && row.payload) {
        const remote = row.payload as SpendiaryData
        const migrated = migrate(remote)
        const migratedStr = JSON.stringify(migrated)
        
        lastSynced.current = migratedStr
        setDataState(migrated)
        setSyncStatus('synced')
        updateLastSynced(new Date())
      } else {
        // Cloud is empty
        lastSynced.current = JSON.stringify(emptyData)
        setDataState(emptyData)
        setSyncStatus('synced')
        updateLastSynced(null)
      }
    } catch (err) {
      console.error('Error fetching remote data:', err)
      setSyncStatus('error')
    } finally {
      syncReady.current = true
    }
  }

  // Fetch remote data once user is loaded
  useEffect(() => {
    if (user) {
      const storedLastUser = localStorage.getItem('spendiary.last_user_id')
      const isSwitch = Boolean(storedLastUser && storedLastUser !== user.id)

      if (isSwitch) {
        setDataState(emptyData)
        lastSynced.current = ''
      }

      localStorage.setItem('spendiary.last_user_id', user.id)

      // Automatically pre-fill default userName from email username prefix if empty
      setDataState((prev) => {
        if (!prev.userName && user.email) {
          const emailPrefix = user.email.split('@')[0]
          const capitalized = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1)
          return { ...prev, userName: capitalized }
        }
        return prev
      })

      syncReady.current = false
      fetchRemoteData(user.id)
    } else {
      syncReady.current = false
      setDataState(emptyData)
      updateLastSynced(null)
    }
  }, [user])

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

  // ── Debounced sync to Supabase (or localStorage for Guest) on data change ──────────────
  useEffect(() => {
    if (!user) return
    if (!syncReady.current) return
    const serialised = JSON.stringify(data)
    if (serialised === lastSynced.current) return   // nothing changed

    if (user.id === 'guest-user-local') {
      localStorage.setItem('spendiary.guest_data', serialised)
      lastSynced.current = serialised
      setSyncStatus('synced')
      updateLastSynced(new Date())
      return
    }

    if (user.id === 'test-user-local') {
      localStorage.setItem('spendiary.test_data', serialised)
      lastSynced.current = serialised
      setSyncStatus('synced')
      updateLastSynced(new Date())
      return
    }

    setSyncStatus('syncing')
    const timer = setTimeout(async () => {
      try {
        const { error } = await supabase
          .from('user_data')
          .upsert({
            id: user.id,
            payload: data,
            updated_at: new Date().toISOString()
          })
        if (error) throw error

        lastSynced.current = serialised
        setSyncStatus('synced')
        updateLastSynced(new Date())
      } catch (err) {
        console.error('Error syncing to Supabase:', err)
        setSyncStatus('error')
      }
    }, 2000)
    return () => clearTimeout(timer)
  }, [data, user])

  const value = useMemo<DataContextValue>(
    () => ({
      data,
      setData: updateData,
      loadSample: () => {},
      clearAll: () => updateData(emptyData),
      syncStatus,
      lastSyncedAt,
      user,
      loginWithGoogle,
      loginAsGuest,
      loginAsTestMode,
      authError,
      logout,
      usdThb,
      setUsdThb,
      setCashAccounts: (cashAccounts) =>
        updateData((prev) => {
          const changes: string[] = []
          const oldAccounts = prev.cashAccounts ?? []
          
          for (const oldAcc of oldAccounts) {
            const newAcc = cashAccounts.find((a) => a.id === oldAcc.id)
            if (!newAcc) {
              changes.push(`Removed "${oldAcc.name}"`)
            } else if (newAcc.name !== oldAcc.name || newAcc.balance !== oldAcc.balance) {
              if (newAcc.name !== oldAcc.name && newAcc.balance !== oldAcc.balance) {
                changes.push(`Renamed "${oldAcc.name}" to "${newAcc.name}" and set balance to ฿${newAcc.balance.toLocaleString()}`)
              } else if (newAcc.name !== oldAcc.name) {
                changes.push(`Renamed "${oldAcc.name}" to "${newAcc.name}"`)
              } else {
                changes.push(`Updated "${oldAcc.name}" balance to ฿${newAcc.balance.toLocaleString()}`)
              }
            }
          }
          
          for (const newAcc of cashAccounts) {
            if (!oldAccounts.some((a) => a.id === newAcc.id)) {
              changes.push(`Added "${newAcc.name}" with balance ฿${newAcc.balance.toLocaleString()}`)
            }
          }
          
          if (changes.length === 0) {
            return { ...prev, cashAccounts }
          }
          
          const logEntry: HoldingLog = {
            id: newId(),
            timestamp: new Date().toISOString(),
            action: 'edit',
            holdingName: 'Cash Accounts',
            ticker: 'CASH',
            assetClass: 'cash',
            note: changes.join(', '),
            previousCashAccountsState: oldAccounts,
          }
          
          return {
            ...prev,
            cashAccounts,
            holdingLogs: [logEntry, ...(prev.holdingLogs ?? [])].slice(0, 200),
          }
        }),
      setMonthlyIncome: (monthlyIncome) => updateData((prev) => ({ ...prev, monthlyIncome })),
      setUserName: (userName) => updateData((prev) => ({ ...prev, userName })),
      setMonthlyFixedCost: (monthlyFixedCost) => updateData((prev) => ({ ...prev, monthlyFixedCost })),
      upsertFixedCostItem: (item) =>
        updateData((prev) => {
          const isEdit = item.id && (prev.fixedCostItems ?? []).some((x) => x.id === item.id)
          const updatedItems = upsert(prev.fixedCostItems ?? [], item)
          const savedItem = updatedItems.find((x) => x.id === item.id) || updatedItems[updatedItems.length - 1]
          
          const logEntry: import('../lib/types').HoldingLog = {
            id: newId(),
            timestamp: new Date().toISOString(),
            action: isEdit ? 'edit' : 'add',
            holdingName: `Fixed Cost: ${savedItem.name}`,
            ticker: 'FIXED',
            assetClass: 'fund', // fallback
            note: `${isEdit ? 'Updated' : 'Added'} fixed expense item of ฿${savedItem.amount.toLocaleString()}`,
          }

          return {
            ...prev,
            fixedCostItems: updatedItems,
            holdingLogs: [logEntry, ...(prev.holdingLogs ?? [])].slice(0, 200),
          }
        }),
      removeFixedCostItem: (id) =>
        updateData((prev) => {
          const item = (prev.fixedCostItems ?? []).find((x) => x.id === id)
          if (!item) return prev
          const updatedItems = (prev.fixedCostItems ?? []).filter((x) => x.id !== id)
          
          const logEntry: import('../lib/types').HoldingLog = {
            id: newId(),
            timestamp: new Date().toISOString(),
            action: 'edit',
            holdingName: `Fixed Cost: ${item.name}`,
            ticker: 'FIXED',
            assetClass: 'fund',
            note: `Removed fixed expense item of ฿${item.amount.toLocaleString()}`,
          }

          return {
            ...prev,
            fixedCostItems: updatedItems,
            holdingLogs: [logEntry, ...(prev.holdingLogs ?? [])].slice(0, 200),
          }
        }),
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
        updateData((prev) => {
          const holding = prev.holdings.find((h) => h.ticker === log.ticker)
          const previousHoldingState =
            log.action !== 'add' && holding
              ? JSON.parse(JSON.stringify(holding))
              : undefined

          return {
            ...prev,
            holdingLogs: [
              {
                ...log,
                id: newId(),
                timestamp: new Date().toISOString(),
                holdingId: holding?.id,
                previousHoldingState,
              },
              ...(prev.holdingLogs ?? []),
            ].slice(0, 200),
          }
        }),

      undoHoldingLog: (logId) =>
        updateData((prev) => {
          const logs = prev.holdingLogs ?? []
          const log = logs.find((l) => l.id === logId)
          if (!log) return prev

          let updatedHoldings = [...prev.holdings]
          let updatedPlans = [...prev.dcaPlans]
          let updatedCashAccounts = prev.cashAccounts ? [...prev.cashAccounts] : []

          if (log.previousCashAccountsState) {
            updatedCashAccounts = log.previousCashAccountsState
          }

          // 1. Revert holding change
          if (log.action === 'add') {
            // Remove newly added holding
            if (log.ticker === 'FIXED') {
              // Ignore fixed cost revert here, not full undo support needed for this simple log
            } else if (log.ticker === 'DCA') {
              // Ignore simple DCA plan add revert for now
            } else {
              updatedHoldings = updatedHoldings.filter((h) => h.id !== log.holdingId && h.ticker !== log.ticker)
            }
          } else if (log.previousHoldingState) {
            // Restore previous state
            updatedHoldings = updatedHoldings.map((h) =>
              h.id === log.holdingId || h.ticker === log.ticker ? log.previousHoldingState! : h
            )
          }

          // 2. Revert DCA plan confirmations if linked
          if (log.dcaPlanId && log.dcaDate) {
            updatedPlans = updatedPlans.map((p) => {
              if (p.id !== log.dcaPlanId) return p
              return {
                ...p,
                confirmedDates: (p.confirmedDates ?? []).filter((d) => d !== log.dcaDate),
                skippedDates: (p.skippedDates ?? []).filter((d) => d !== log.dcaDate),
              }
            })
          }

          // 3. Remove this log entry
          const updatedLogs = logs.filter((l) => l.id !== logId)

          return {
            ...prev,
            holdings: updatedHoldings,
            dcaPlans: updatedPlans,
            cashAccounts: updatedCashAccounts,
            holdingLogs: updatedLogs,
          }
        }),

      upsertPlan: (plan) =>
        updateData((prev) => {
          const isEdit = plan.id && prev.dcaPlans.some((p) => p.id === plan.id)
          const updatedPlans = upsert(prev.dcaPlans, plan)
          const savedPlan = updatedPlans.find((p) => p.id === plan.id) || updatedPlans[updatedPlans.length - 1]

          const logEntry: import('../lib/types').HoldingLog = {
            id: newId(),
            timestamp: new Date().toISOString(),
            action: isEdit ? 'edit' : 'add',
            holdingName: `DCA Plan: ${savedPlan.name}`,
            ticker: 'DCA',
            assetClass: savedPlan.assetClass,
            note: `${isEdit ? 'Updated' : 'Created'} DCA plan of ฿${savedPlan.monthlyAmount.toLocaleString()}/month`,
          }

          return {
            ...prev,
            dcaPlans: updatedPlans,
            holdingLogs: [logEntry, ...(prev.holdingLogs ?? [])].slice(0, 200),
          }
        }),
      removePlan: (id) =>
        updateData((prev) => {
          const plan = prev.dcaPlans.find((p) => p.id === id)
          if (!plan) return prev
          const updatedPlans = prev.dcaPlans.filter((p) => p.id !== id)

          const logEntry: import('../lib/types').HoldingLog = {
            id: newId(),
            timestamp: new Date().toISOString(),
            action: 'edit',
            holdingName: `DCA Plan: ${plan.name}`,
            ticker: 'DCA',
            assetClass: plan.assetClass,
            note: `Deleted DCA plan of ฿${plan.monthlyAmount.toLocaleString()}/month`,
          }

          return {
            ...prev,
            dcaPlans: updatedPlans,
            holdingLogs: [logEntry, ...(prev.holdingLogs ?? [])].slice(0, 200),
          }
        }),

      confirmDcaBuy: (
        planId,
        pricePerUnit,
        date,
        overrideUnits,
        overrideAvgCost,
        overridePrice,
        btcLocationUpdate,
        goldLocationUpdate,
      ) =>
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

          // 2. If plan is linked to a holding, or asset holding exists/created, apply the buy
          let holding = plan.holdingId
            ? prev.holdings.find((h) => h.id === plan.holdingId)
            : prev.holdings.find((h) => h.assetClass === plan.assetClass)

          let holdingsList = prev.holdings

          // Auto-create holding if needed when location or buy detail is provided
          if (!holding && (btcLocationUpdate || goldLocationUpdate || (pricePerUnit > 0 && (plan.assetClass === 'gold' || plan.assetClass === 'crypto')))) {
            const createdHolding: import('../lib/types').Holding = {
              id: newId(),
              name: plan.assetClass === 'gold' ? 'Gold' : plan.assetClass === 'crypto' ? 'Bitcoin' : plan.name,
              ticker: plan.assetClass === 'gold' ? 'GOLD' : plan.assetClass === 'crypto' ? 'BTC' : plan.name.toUpperCase().slice(0, 6),
              assetClass: plan.assetClass,
              units: 0,
              avgCost: pricePerUnit,
              price: pricePerUnit,
              updatedAt: date,
              btcLocations: [],
              goldLocations: [],
            }
            holding = createdHolding
            holdingsList = [...prev.holdings, createdHolding]
          }

          if (!holding) {
            // Log simple plan confirmation (no holding update)
            const logEntry: import('../lib/types').HoldingLog = {
              id: newId(),
              timestamp: new Date().toISOString(),
              action: 'buy_more',
              holdingName: `DCA Plan: ${plan.name}`,
              ticker: 'DCA',
              assetClass: plan.assetClass,
              note: `Confirmed DCA buy of ฿${plan.monthlyAmount.toLocaleString()} (No linked holding)`,
              dcaPlanId: plan.id,
              dcaDate: date,
            }
            return {
              ...prev,
              dcaPlans: updatedPlans,
              holdingLogs: [logEntry, ...(prev.holdingLogs ?? [])].slice(0, 200),
            }
          }

          // Capture previous state (for undo) BEFORE applying location updates
          const previousHoldingState = JSON.parse(JSON.stringify(holding))

          let calculatedUnits = pricePerUnit > 0 ? plan.monthlyAmount / pricePerUnit : 0
          if (!isFinite(calculatedUnits) || isNaN(calculatedUnits)) calculatedUnits = 0

          let newUnits = overrideUnits !== undefined ? overrideUnits : (holding.units + calculatedUnits)
          let newAvgCost = overrideAvgCost !== undefined ? overrideAvgCost : (newUnits > 0 ? (holding.units * holding.avgCost + calculatedUnits * pricePerUnit) / newUnits : holding.avgCost)
          if (!isFinite(newAvgCost) || isNaN(newAvgCost)) newAvgCost = holding.avgCost
          const finalPrice = overridePrice !== undefined ? overridePrice : pricePerUnit

          let finalBtcLocations = holding.btcLocations
          let finalGoldLocations = holding.goldLocations

          if (holding.assetClass === 'crypto' && btcLocationUpdate) {
            finalBtcLocations = upsert(holding.btcLocations ?? [], btcLocationUpdate)
            const totalSats = finalBtcLocations.reduce((s, l) => s + l.satoshi, 0)
            const totalThb = finalBtcLocations.reduce((s, l) => s + l.thbSpent, 0)
            newUnits = totalSats / 100_000_000
            newAvgCost = newUnits > 0 ? totalThb / newUnits : holding.avgCost
            if (!isFinite(newAvgCost) || isNaN(newAvgCost)) newAvgCost = holding.avgCost
            calculatedUnits = newUnits - (holding.units || 0)
            if (!isFinite(calculatedUnits) || isNaN(calculatedUnits)) calculatedUnits = 0
          } else if (holding.assetClass === 'gold' && goldLocationUpdate) {
            finalGoldLocations = upsert(holding.goldLocations ?? [], goldLocationUpdate)
            const totalGrams = finalGoldLocations.reduce((s, l) => s + l.grams, 0)
            const totalThb = finalGoldLocations.reduce((s, l) => s + l.thbSpent, 0)
            newUnits = totalGrams
            newAvgCost = newUnits > 0 ? totalThb / newUnits : holding.avgCost
            if (!isFinite(newAvgCost) || isNaN(newAvgCost)) newAvgCost = holding.avgCost
            calculatedUnits = newUnits - (holding.units || 0)
            if (!isFinite(calculatedUnits) || isNaN(calculatedUnits)) calculatedUnits = 0
          }

          const isBtcWithLocations =
            holding.assetClass === 'crypto' &&
            (finalBtcLocations?.length ?? 0) > 0
          const isGoldWithLocations =
            holding.assetClass === 'gold' &&
            (finalGoldLocations?.length ?? 0) > 0

          const targetHoldingId = holding.id
          const updatedHoldings = holdingsList.map((h) =>
            h.id !== targetHoldingId ? h : (isBtcWithLocations || isGoldWithLocations)
              ? { ...h, btcLocations: finalBtcLocations, goldLocations: finalGoldLocations, units: newUnits, avgCost: newAvgCost, price: finalPrice, updatedAt: date }
              : { ...h, units: newUnits, avgCost: newAvgCost, price: finalPrice, updatedAt: date }
          )

          const displayGrams = isFinite(calculatedUnits) && !isNaN(calculatedUnits) ? calculatedUnits.toFixed(4) : '0.0000'

          // 3. Add to holding log
          const logEntry: import('../lib/types').HoldingLog = {
            id: newId(),
            timestamp: new Date().toISOString(),
            action: 'buy_more',
            holdingName: holding.name,
            ticker: holding.ticker,
            assetClass: holding.assetClass,
            note: holding.assetClass === 'crypto'
              ? `DCA · +${Math.round(calculatedUnits * 1e8).toLocaleString()} sats · ฿${plan.monthlyAmount.toLocaleString()} total`
              : holding.assetClass === 'gold'
              ? `DCA · +${displayGrams} g · ฿${plan.monthlyAmount.toLocaleString()} total`
              : overrideUnits !== undefined
              ? `DCA (Updated Portfolio) · New Units: ${overrideUnits.toLocaleString()} @ Avg Cost: ${overrideAvgCost?.toLocaleString()}`
              : `DCA · +${displayGrams} units @ ฿${pricePerUnit.toLocaleString()}/unit · ฿${plan.monthlyAmount.toLocaleString()} total`,
            holdingId: holding.id,
            previousHoldingState,
            dcaPlanId: plan.id,
            dcaDate: date,
          }

          return {
            ...prev,
            dcaPlans: updatedPlans,
            holdings: updatedHoldings,
            holdingLogs: [logEntry, ...(prev.holdingLogs ?? [])].slice(0, 200),
          }
        }),

      skipDcaBuy: (planId, date) =>
        updateData((prev) => {
          const plan = prev.dcaPlans.find((p) => p.id === planId)
          if (!plan) return prev

          const updatedPlans = prev.dcaPlans.map((p) =>
            p.id !== planId ? p : {
              ...p,
              skippedDates: [date, ...(p.skippedDates ?? [])],
            }
          )

          const logEntry: import('../lib/types').HoldingLog = {
            id: newId(),
            timestamp: new Date().toISOString(),
            action: 'edit',
            holdingName: `DCA Plan: ${plan.name}`,
            ticker: 'DCA',
            assetClass: plan.assetClass,
            note: `Skipped DCA buy of ฿${plan.monthlyAmount.toLocaleString()} for this period`,
            dcaPlanId: plan.id,
            dcaDate: date,
          }

          return {
            ...prev,
            dcaPlans: updatedPlans,
            holdingLogs: [logEntry, ...(prev.holdingLogs ?? [])].slice(0, 200),
          }
        }),

      upsertTransfer: (transfer) =>
        updateData((prev) => ({ ...prev, transfers: upsert(prev.transfers, transfer) })),
      removeTransfer: (id) =>
        updateData((prev) => ({ ...prev, transfers: prev.transfers.filter((t) => t.id !== id) })),

      setRetirement: (retirement) =>
        updateData((prev) => ({ ...prev, retirement })),
      setRebalanceTargets: (rebalanceTargets) =>
        updateData((prev) => ({ ...prev, rebalanceTargets })),

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

      recordPortfolioSnapshot: (value) =>
        updateData((prev) => {
          if (value <= 0) return prev
          const today = localDateStr()
          const existing = prev.portfolioHistory ?? []
          const updated = [...existing.filter((s: NetWorthSnapshot) => s.date !== today), { date: today, value }]
            .sort((a: NetWorthSnapshot, b: NetWorthSnapshot) => a.date.localeCompare(b.date))
            .slice(-365)
          return { ...prev, portfolioHistory: updated }
        }),



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



        // 5. Update React state
        setDataState(stamped)

        // 6. Force an immediate cloud push (bypass the 2-second debounce)
        if (user) {
          const serialised = JSON.stringify(stamped)
          setSyncStatus('syncing')
          supabase
            .from('user_data')
            .upsert({
              id: user.id,
              payload: stamped,
              updated_at: new Date().toISOString()
            })
            .then(({ error }) => {
              if (!error) {
                lastSynced.current = serialised
                setSyncStatus('synced')
                updateLastSynced(new Date())
              } else {
                setSyncStatus('error')
              }
            }, () => setSyncStatus('error'))
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
    [data, syncStatus, lastSyncedAt, user],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useData(): DataContextValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}

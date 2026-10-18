import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { AcquisitionSource, BtcLocation, CashAccount, DcaPlan, DividendRecord, GoldLocation, Holding, HoldingLog, InvestAssetClass, Liability, PlannedAsset, RebalanceMode, RetirementSettings, SpendiaryData, Transfer } from '../lib/types'
import { isValidRate, readCachedUsdThb, writeCachedUsdThb, type UsdThbRate } from '../lib/fx'
import { fetchUsdThb } from '../lib/prices'
import { seedData } from './seed'
import { syncCategories } from '../modules/spend/categories'
import { emptyData, migrate, newId } from './migrate'
import type { DcaPayment } from './dataHelpers'
import { useAuth } from './useAuth'
import { useCloudSync, type SyncStatus } from './useCloudSync'
import * as cashActions from './actions/cash'
import * as liabilityActions from './actions/liabilities'
import * as holdingActions from './actions/holdings'
import * as holdingLogActions from './actions/holdingLogs'
import * as dcaActions from './actions/dca'
import * as dividendActions from './actions/dividends'
import * as planningActions from './actions/planning'
import { applyImport, prepareImport } from './actions/importPortfolio'
import { applyPreferences, downloadBackup, makeBackup, parseBackup, readPreferences } from './backup'
import { STORAGE_KEYS } from '../lib/storageKeys'

/** Result returned by importData — UI can react to success/error */
export type ImportResult =
  | { ok: true }
  | { ok: false; error: string }

/** Result returned by importPortfolioAndCash */
export type ImportPortfolioAndCashResult =
  | { ok: true; count: { holdings: number; cashAccounts: number; liabilities?: number } }
  | { ok: false; error: string }

export interface DataContextValue {
  data: SpendiaryData
  setData: (next: SpendiaryData | ((prev: SpendiaryData) => SpendiaryData)) => void
  loadSample: () => void
  clearAll: () => Promise<void>
  syncStatus: SyncStatus
  /** False until the initial load (cloud / guest / test data) for the current user has finished. */
  dataReady: boolean
  /** True when the cloud load failed. Saving stays off so the real data is never overwritten. */
  loadError: boolean
  /** True when another tab or device saved first. Saving stays off so their changes are not overwritten. */
  syncConflict: boolean
  /** Try the cloud load again after a failure, or load the latest data after a conflict */
  retryLoad: () => void
  user: User | null
  loginWithGoogle: () => void
  loginAsGuest: () => void
  loginAsTestMode: () => void
  authError: string | null
  logout: () => Promise<void>
  setCashAccounts: (accounts: CashAccount[]) => void
  setMonthlyIncome: (income: number) => void
  setUserName: (name: string) => void
  upsertLiability: (item: Omit<Liability, 'id'> & { id?: string }) => void
  removeLiability: (id: string) => void
  setLiabilities: (liabilities: Liability[]) => void
  /** Mark one payment made; `amount` defaults to the monthly payment (or the balance spread over what's left) */
  payLiabilityInstallment: (id: string, amount?: number) => void
  undoLiabilityPayment: (id: string) => void
  /** USD/THB: the latest real rate (fetched now or on an earlier visit). Null when none was ever fetched; never a guess. */
  usdThb: number | null
  /** When usdThb was fetched, so screens can say how fresh it is */
  usdThbAsOf: Date | null
  setUsdThb: (rate: number) => void

  upsertHolding: (holding: Omit<Holding, 'id'> & { id?: string }) => void
  removeHolding: (id: string) => void
  toggleHoldingLock: (id: string) => void
  toggleLocationLock: (holdingId: string, locationId: string, isBtc: boolean) => void
  transferLocation: (params: {
    holdingId: string
    fromLocationId: string
    /** Existing destination; omit to create one with `newLocationName` */
    toLocationId?: string
    newLocationName?: string
    /** Sats (BTC) or grams (gold) leaving the source */
    amount: number
    /** Part of `amount` lost in transit (same unit) */
    fee?: number
    timestamp?: string
  }) => void
  reorderHoldings: (ids: string[]) => void
  sellHolding: (params: {
    holdingId: string
    soldUnits: number
    soldPrice: number
    proceeds: number
    realizedPnL: number
    realizedPnLPercent: number
    fee?: number
    remainingHolding?: Holding | null
    cashAccountId?: string
    cashDepositAmount?: number
    note: string
    timestamp?: string
  }) => void
  buyMoreHolding: (params: {
    updatedHolding: Holding
    cashAccountId?: string
    cashDeductAmount?: number
    note: string
    timestamp?: string
    source?: AcquisitionSource
    receivedFrom?: string
  }) => void
  addHoldingLog: (log: Omit<HoldingLog, 'id' | 'timestamp'> & { id?: string; timestamp?: string }) => void
  removeHoldingLog: (logId: string) => void
  removeHoldingLogs: (logIds: string[]) => void
  undoHoldingLog: (logId: string) => void
  updateHoldingLogTimestamp: (logId: string, timestamp: string) => void
  /** Edit a log's own record (date, note, how it was acquired) without touching holdings or cash */
  updateHoldingLog: (logId: string, patch: Partial<Pick<HoldingLog, 'timestamp' | 'note' | 'source' | 'receivedFrom'>>) => void

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
    stockUpdate?: {
      unitsBought: number
      amountSpentThb: number
      fxRate: number
    },
    fundUpdate?: {
      unitsBought: number
      amountSpentThb: number
      nav: number
    },
    targetHoldingId?: string,
    btcUpdate?: {
      satsBought: number
      amountSpentThb: number
    },
    goldUpdate?: {
      gramsBought: number
      amountSpentThb: number
    },
    /** Take the money for this buy out of a cash account */
    payment?: DcaPayment,
  ) => void
  skipDcaBuy: (planId: string, date: string) => void

  upsertTransfer: (transfer: Omit<Transfer, 'id'> & { id?: string }) => void
  removeTransfer: (id: string) => void

  /** Returns the new record's id, so it can be undone with `removeDividendRecord` */
  recordDividend: (record: Omit<DividendRecord, 'id' | 'createdAt'>) => string
  removeDividendRecord: (id: string) => void

  setRetirement: (settings: RetirementSettings) => void
  setRebalanceMode: (mode: RebalanceMode) => void
  setRebalanceTargets: (targets: Record<InvestAssetClass, number>) => void
  setRebalanceHoldingTargets: (targets: Record<string, number>) => void
  upsertPlannedAsset: (asset: Omit<PlannedAsset, 'id'> & { id?: string }) => void
  removePlannedAsset: (id: string) => void
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
   * Parse + validate a backup file and, if valid, replace the data with it, restore its
   * preferences and save to the cloud right away (skips the debounce).
   * Returns { ok: true } on success or { ok: false; error } on failure.
   */
  importData: (jsonString: string) => ImportResult
  /**
   * Import portfolio holdings and cash accounts, either merging with or replacing existing data.
   */
  importPortfolioAndCash: (
    payload: { holdings?: unknown[]; cashAccounts?: unknown[]; liabilities?: unknown[] },
    mode: 'merge' | 'replace',
  ) => ImportPortfolioAndCashResult
}

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setDataState] = useState<SpendiaryData>(emptyData)
  // Spend category lookups are plain functions read while rendering, so the list has to match
  // this render's data before the children render; an effect would leave them one render behind.
  // syncCategories only rebuilds when the settings objects change, so calling it here is a cache.
  syncCategories(data.spendSettings)
  // A render React throws away could leave the list on its settings; snap back to what committed
  useLayoutEffect(() => {
    syncCategories(data.spendSettings)
  }, [data.spendSettings])
  // Start from the last real rate this device saw, then fetch a fresh one right away
  const [fx, setFx] = useState<UsdThbRate | null>(() => readCachedUsdThb())
  const usdThb = fx?.rate ?? null
  const usdThbAsOf = fx?.asOf ?? null
  const setUsdThb = (rate: number) => {
    if (!isValidRate(rate)) return
    const asOf = new Date()
    setFx({ rate, asOf })
    writeCachedUsdThb(rate, asOf)
  }
  useEffect(() => {
    // Once per app load; useLivePrices keeps it fresh on the pages that show prices
    fetchUsdThb().then(setUsdThb, (err) => console.warn('USD/THB rate unavailable:', err))
  }, [])
  const { user, setUser, authError, setAuthError, loginWithGoogle, loginAsGuest } = useAuth()
  const {
    syncStatus, setSyncStatus, dataReady, loadError, syncConflict, lastSyncedAt, updateLastSynced,
    retryLoad, pushNow, syncReady, lastSynced,
  } = useCloudSync(user, data, setDataState)

  // Mirror of current data as a ref so callbacks can read it without
  // capturing a stale closure.
  const dataRef = useRef(data)
  dataRef.current = data

  const loginAsTestMode = () => {
    setAuthError(null)
    localStorage.removeItem(STORAGE_KEYS.testData)
    const testUser: User = {
      id: 'test-user-local',
      app_metadata: { provider: 'test' },
      user_metadata: { name: 'Test Mode User' },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
      email: 'test@spendiary.local',
      role: 'authenticated'
    }
    const freshSample = migrate(JSON.parse(JSON.stringify(seedData)))
    setDataState(freshSample)
    lastSynced.current = JSON.stringify(freshSample)
    setUser(testUser)
  }

  const logout = async () => {
    if (user?.id !== 'guest-user-local' && user?.id !== 'test-user-local') {
      await supabase.auth.signOut()
    }
    localStorage.removeItem(STORAGE_KEYS.lastUserId)
    localStorage.removeItem(STORAGE_KEYS.lastSyncedTime)
    setUser(null)
    setDataState(emptyData)
    updateLastSynced(null)
  }

  const clearAll = async () => {
    syncReady.current = false
    const currentUser = user

    if (currentUser) {
      if (currentUser.id === 'guest-user-local') {
        localStorage.removeItem(STORAGE_KEYS.guestData)
      } else if (currentUser.id === 'test-user-local') {
        localStorage.removeItem(STORAGE_KEYS.testData)
      } else {
        // Cloud Supabase user: delete row from user_data table
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the client has no generated table types
          const { error } = await (supabase.from('user_data') as any)
            .delete()
            .eq('id', currentUser.id)
          if (error) {
            console.warn('Supabase delete failed, falling back to empty payload upsert:', error)
            await supabase
              .from('user_data')
              .upsert({
                id: currentUser.id,
                payload: emptyData,
                updated_at: new Date().toISOString()
              })
              // Clearing replaces the data on purpose; the database's write lock lets it through
              .setHeader('x-spendiary-force', '1')
          }
        } catch (err) {
          console.error('Error clearing remote user data:', err)
        }

        try {
          await supabase.auth.signOut()
        } catch (err) {
          console.error('Error signing out during clearAll:', err)
        }
      }
    }

    localStorage.removeItem(STORAGE_KEYS.lastUserId)
    localStorage.removeItem(STORAGE_KEYS.lastSyncedTime)

    lastSynced.current = ''
    setDataState(emptyData)
    updateLastSynced(null)
    setSyncStatus('idle')
    setUser(null)

    try {
      window.history.replaceState(null, '', '/')
    } catch {
      // ignore: storage or JSON unavailable
    }
  }

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

  const value = useMemo<DataContextValue>(
    () => ({
      data,
      setData: updateData,
      loadSample: () => {
        const freshSample = migrate(JSON.parse(JSON.stringify(seedData)))
        updateData(freshSample)
      },
      clearAll,
      syncStatus,
      dataReady,
      loadError,
      syncConflict,
      retryLoad,
      lastSyncedAt,
      user,
      loginWithGoogle,
      loginAsGuest,
      loginAsTestMode,
      authError,
      logout,
      usdThb,
      usdThbAsOf,
      setUsdThb,
      setCashAccounts: (cashAccounts) => updateData((prev) => cashActions.setCashAccounts(prev, cashAccounts)),
      setMonthlyIncome: (monthlyIncome) => updateData((prev) => cashActions.setMonthlyIncome(prev, monthlyIncome)),
      setUserName: (userName) => updateData((prev) => cashActions.setUserName(prev, userName)),

      upsertLiability: (item) => updateData((prev) => liabilityActions.upsertLiability(prev, item)),
      removeLiability: (id) => updateData((prev) => liabilityActions.removeLiability(prev, id)),
      setLiabilities: (liabilities) => updateData((prev) => liabilityActions.setLiabilities(prev, liabilities)),

      payLiabilityInstallment: (id, amount) => updateData((prev) => liabilityActions.payLiabilityInstallment(prev, id, amount)),

      undoLiabilityPayment: (id) => updateData((prev) => liabilityActions.undoLiabilityPayment(prev, id)),

      upsertHolding: (holding) => updateData((prev) => holdingActions.upsertHolding(prev, holding)),
      removeHolding: (id) => updateData((prev) => holdingActions.removeHolding(prev, id)),
      toggleHoldingLock: (id) => updateData((prev) => holdingActions.toggleHoldingLock(prev, id)),
      transferLocation: (params) => updateData((prev) => holdingActions.transferLocation(prev, params)),
      toggleLocationLock: (holdingId, locationId, isBtc) => updateData((prev) => holdingActions.toggleLocationLock(prev, holdingId, locationId, isBtc)),

      reorderHoldings: (ids) => updateData((prev) => holdingActions.reorderHoldings(prev, ids)),

      sellHolding: (params) => updateData((prev) => holdingActions.sellHolding(prev, params)),

      buyMoreHolding: (params) => updateData((prev) => holdingActions.buyMoreHolding(prev, params)),

      addHoldingLog: (log) => updateData((prev) => holdingLogActions.addHoldingLog(prev, log)),

      removeHoldingLog: (logId) => updateData((prev) => holdingLogActions.removeHoldingLog(prev, logId)),

      removeHoldingLogs: (logIds) => updateData((prev) => holdingLogActions.removeHoldingLogs(prev, logIds)),

      updateHoldingLogTimestamp: (logId, timestamp) => updateData((prev) => holdingLogActions.updateHoldingLogTimestamp(prev, logId, timestamp)),

      updateHoldingLog: (logId, patch) => updateData((prev) => holdingLogActions.updateHoldingLog(prev, logId, patch)),

      undoHoldingLog: (logId) => updateData((prev) => holdingLogActions.undoHoldingLog(prev, logId)),

      upsertPlan: (plan) => updateData((prev) => dcaActions.upsertPlan(prev, plan)),
      removePlan: (id) => updateData((prev) => dcaActions.removePlan(prev, id)),

      confirmDcaBuy: (
        planId,
        pricePerUnit,
        date,
        overrideUnits,
        overrideAvgCost,
        overridePrice,
        btcLocationUpdate,
        goldLocationUpdate,
        stockUpdate,
        fundUpdate,
        targetHoldingId,
        btcUpdate,
        goldUpdate,
        payment,
      ) =>
        updateData((prev) =>
          dcaActions.confirmDcaBuy(
            prev, planId, pricePerUnit, date, overrideUnits, overrideAvgCost, overridePrice, btcLocationUpdate,
            goldLocationUpdate, stockUpdate, fundUpdate, targetHoldingId, btcUpdate, goldUpdate, payment,
          ),
        ),

      skipDcaBuy: (planId, date) => updateData((prev) => dcaActions.skipDcaBuy(prev, planId, date)),

      upsertTransfer: (transfer) => updateData((prev) => planningActions.upsertTransfer(prev, transfer)),
      removeTransfer: (id) => updateData((prev) => planningActions.removeTransfer(prev, id)),

      recordDividend: (record) => {
        const id = newId()
        updateData((prev) => dividendActions.recordDividend(prev, record, id))
        return id
      },

      removeDividendRecord: (recordId) => updateData((prev) => dividendActions.removeDividendRecord(prev, recordId)),

      setRetirement: (retirement) => updateData((prev) => planningActions.setRetirement(prev, retirement)),
      setRebalanceMode: (rebalanceMode) => updateData((prev) => planningActions.setRebalanceMode(prev, rebalanceMode)),
      setRebalanceTargets: (rebalanceTargets) => updateData((prev) => planningActions.setRebalanceTargets(prev, rebalanceTargets)),
      setRebalanceHoldingTargets: (rebalanceHoldingTargets) => updateData((prev) => planningActions.setRebalanceHoldingTargets(prev, rebalanceHoldingTargets)),
      upsertPlannedAsset: (asset) => updateData((prev) => planningActions.upsertPlannedAsset(prev, asset)),
      removePlannedAsset: (id) => updateData((prev) => planningActions.removePlannedAsset(prev, id)),

      recordNetWorthSnapshot: (value) => updateData((prev) => planningActions.recordNetWorthSnapshot(prev, value)),

      recordPortfolioSnapshot: (value) => updateData((prev) => planningActions.recordPortfolioSnapshot(prev, value)),



      // ── Export ────────────────────────────────────────────────
      exportData: () => downloadBackup(makeBackup(dataRef.current, readPreferences())),

      // ── Import ────────────────────────────────────────────────
      importData: (jsonString) => {
        const parsed = parseBackup(jsonString)
        if (!parsed.ok) return parsed
        setDataState(parsed.data)
        if (parsed.preferences) applyPreferences(parsed.preferences)
        // Save to the cloud right away instead of after the usual 2-second wait
        if (user) pushNow(user.id, parsed.data)
        return { ok: true }
      },

      importPortfolioAndCash: (payload, mode) => {
        try {
          const result = prepareImport(payload, mode, usdThb)
          if (!result.ok) return result
          const { prepared } = result
          updateData((prev) => applyImport(prev, prepared, mode))
          return {
            ok: true,
            count: {
              holdings: prepared.sanitizedHoldings.length,
              cashAccounts: prepared.sanitizedCash.length,
              liabilities: prepared.sanitizedLiabilities.length,
            },
          }
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : 'Unknown error during import.' }
        }
      },

      upsertBtcLocation: (holdingId, loc) => updateData((prev) => holdingActions.upsertBtcLocation(prev, holdingId, loc)),

      removeBtcLocation: (holdingId, locId) => updateData((prev) => holdingActions.removeBtcLocation(prev, holdingId, locId)),

      upsertGoldLocation: (holdingId, loc) => updateData((prev) => holdingActions.upsertGoldLocation(prev, holdingId, loc)),

      removeGoldLocation: (holdingId, locId) => updateData((prev) => holdingActions.removeGoldLocation(prev, holdingId, locId)),
    }),
    [data, syncStatus, dataReady, loadError, syncConflict, lastSyncedAt, user, authError, usdThb, usdThbAsOf],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useData(): DataContextValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}

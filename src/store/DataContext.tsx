import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { AcquisitionSource, BtcLocation, CashAccount, DcaPlan, DebtCategory, DividendRecord, GoldLocation, Holding, HoldingLog, InvestAssetClass, Liability, PlannedAsset, RebalanceMode, RetirementSettings, SpendiaryBackup, SpendiaryData, Transfer } from '../lib/types'
import { localDateStr } from '../lib/format'
import { isValidRate, readCachedUsdThb, writeCachedUsdThb, type UsdThbRate } from '../lib/fx'
import { fetchUsdThb } from '../lib/prices'
import { seedData } from '../lib/seed'
import { detectBankPreset, findMatchingHolding, inferCashCategory } from '../lib/calc'
import { inferAssetClass } from '../lib/assetClass'
import { syncCategories } from '../modules/spend/categories'
import { emptyData, migrate, newId } from './migrate'
import { parseCleanNumber, validateSpendiaryData } from './validate'
import { payFromAccount, upsert, type DcaPayment } from './dataHelpers'
import { useAuth } from './useAuth'
import { useCloudSync, type SyncStatus } from './useCloudSync'
import * as cashActions from './actions/cash'
import * as liabilityActions from './actions/liabilities'
import * as holdingActions from './actions/holdings'
import * as holdingLogActions from './actions/holdingLogs'
import * as dcaActions from './actions/dca'
import * as dividendActions from './actions/dividends'
import * as planningActions from './actions/planning'

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
   * Parse + validate a JSON string and, if valid, atomically:
   *   1. Update React state
   *   2. Persist to localStorage
   *   3. Immediately push to Cloudflare cloud (skips debounce)
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
  // Spend category lookups are plain functions; keep their user-made list in step with the data
  syncCategories(data.spendSettings)
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
    localStorage.removeItem('spendiary.test_data')
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
    localStorage.removeItem('spendiary.last_user_id')
    localStorage.removeItem('spendiary.last_synced_time')
    setUser(null)
    setDataState(emptyData)
    updateLastSynced(null)
  }

  const clearAll = async () => {
    syncReady.current = false
    const currentUser = user

    if (currentUser) {
      if (currentUser.id === 'guest-user-local') {
        localStorage.removeItem('spendiary.guest_data')
      } else if (currentUser.id === 'test-user-local') {
        localStorage.removeItem('spendiary.test_data')
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

    localStorage.removeItem('spendiary.last_user_id')
    localStorage.removeItem('spendiary.last_synced_time')

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
        updateData((prev) => {
          const plan = prev.dcaPlans.find((p) => p.id === planId)
          if (!plan) return prev

          // Paid from a cash account: its balance goes down, and the log keeps both
          // snapshots so Undo gives the money back
          const paid = payment && payment.amount > 0 && (prev.cashAccounts ?? []).some((a) => a.id === payment.accountId) ? payment : undefined
          const paidLog = paid
            ? {
                paidFromAccountId: paid.accountId,
                paidAmount: paid.amount,
                previousCashAccountsState: prev.cashAccounts ?? [],
                afterCashAccountsState: payFromAccount(prev.cashAccounts ?? [], paid),
              }
            : {}
          const paidAccounts = paid ? { cashAccounts: payFromAccount(prev.cashAccounts ?? [], paid) } : {}

          // If this is a Cash Account DCA plan, deposit directly into cash account balance
          if (plan.assetClass === 'cash' || plan.cashAccountId) {
            const oldAccounts = prev.cashAccounts ?? []
            const depositAmount =
              (fundUpdate as { amountSpentThb?: number } | undefined)?.amountSpentThb ||
              (stockUpdate as { amountSpentThb?: number } | undefined)?.amountSpentThb ||
              (pricePerUnit > 0 ? pricePerUnit : plan.monthlyAmount)
            const targetAcc = plan.cashAccountId
              ? oldAccounts.find((a) => a.id === plan.cashAccountId)
              : oldAccounts.find((a) => a.name.toLowerCase() === plan.name.toLowerCase())

            const updatedCashAccounts = payFromAccount(
              targetAcc
                ? oldAccounts.map((a) =>
                    a.id === targetAcc.id ? { ...a, balance: a.balance + depositAmount } : a,
                  )
                : oldAccounts,
              paid,
            )

            const updatedPlans = prev.dcaPlans.map((p) =>
              p.id !== planId
                ? p
                : {
                    ...p,
                    cashAccountId: targetAcc ? targetAcc.id : p.cashAccountId,
                    confirmedDates: [date, ...(p.confirmedDates ?? [])],
                  },
            )

            const logEntry: import('../lib/types').HoldingLog = {
              id: newId(),
              timestamp: new Date().toISOString(),
              action: 'buy_more',
              holdingName: targetAcc ? targetAcc.name : plan.name,
              ticker: 'CASH',
              assetClass: 'cash',
              note: `Deposited ฿${depositAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} via DCA into ${targetAcc ? targetAcc.name : plan.name}`,
              dcaPlanId: plan.id,
              dcaDate: date,
              ...(paid ? { paidFromAccountId: paid.accountId, paidAmount: paid.amount } : {}),
              previousCashAccountsState: oldAccounts,
              afterCashAccountsState: updatedCashAccounts,
            }

            return {
              ...prev,
              cashAccounts: updatedCashAccounts,
              dcaPlans: updatedPlans,
              holdingLogs: [logEntry, ...(prev.holdingLogs ?? [])],
            }
          }

          // Check if holding already existed before this transaction (via targetHoldingId or findMatchingHolding)
          const existingHolding = targetHoldingId
            ? prev.holdings.find((h) => h.id === targetHoldingId)
            : findMatchingHolding(prev.holdings, plan)

          const isNewHolding = !existingHolding
          let holding = existingHolding
          let holdingsList = prev.holdings

          // Auto-create holding if needed when location or buy detail is provided
          if (!holding && (stockUpdate || fundUpdate || btcLocationUpdate || goldLocationUpdate || (pricePerUnit > 0 && (plan.assetClass === 'gold' || plan.assetClass === 'crypto' || plan.assetClass === 'stock' || plan.assetClass === 'fund')))) {
            const createdHolding: import('../lib/types').Holding = {
              id: newId(),
              name: plan.name,
              ticker: plan.ticker || plan.name.toUpperCase().slice(0, 6),
              assetClass: plan.assetClass,
              units: 0,
              totalUnits: 0,
              totalThbInvested: 0,
              totalUsdInvested: 0,
              avgCostUsd: 0,
              avgCostThb: 0,
              avgCost: pricePerUnit,
              price: pricePerUnit,
              updatedAt: date,
              btcLocations: [],
              goldLocations: [],
            }
            holding = createdHolding
            holdingsList = [...prev.holdings, createdHolding]
          }

          // Mark date as confirmed on the plan + link holdingId to prevent future binding bugs
          const updatedPlans = prev.dcaPlans.map((p) =>
            p.id !== planId
              ? p
              : {
                  ...p,
                  holdingId: holding ? holding.id : p.holdingId,
                  confirmedDates: [date, ...(p.confirmedDates ?? [])],
                },
          )

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
              ...paidLog,
            }
            return {
              ...prev,
              ...paidAccounts,
              dcaPlans: updatedPlans,
              holdingLogs: [logEntry, ...(prev.holdingLogs ?? [])],
            }
          }

          // Capture previous state (for undo) BEFORE applying updates (if holding existed)
          const previousHoldingState = !isNewHolding ? JSON.parse(JSON.stringify(holding)) : undefined

          let calculatedUnits = pricePerUnit > 0 ? plan.monthlyAmount / pricePerUnit : 0
          if (!isFinite(calculatedUnits) || isNaN(calculatedUnits)) calculatedUnits = 0

          let newUnits = overrideUnits !== undefined ? overrideUnits : holding.units + calculatedUnits
          let newAvgCost =
            overrideAvgCost !== undefined
              ? overrideAvgCost
              : newUnits > 0
              ? (holding.units * holding.avgCost + calculatedUnits * pricePerUnit) / newUnits
              : holding.avgCost
          if (!isFinite(newAvgCost) || isNaN(newAvgCost)) newAvgCost = holding.avgCost
          const finalPrice = overridePrice !== undefined ? overridePrice : pricePerUnit

          let finalBtcLocations = holding.btcLocations
          let finalGoldLocations = holding.goldLocations
          let updatedFields: Partial<import('../lib/types').Holding> = {}
          let logNote = ''

          if (stockUpdate) {
            const { unitsBought, amountSpentThb, fxRate } = stockUpdate
            const usdSpentThisTx = fxRate > 0 ? amountSpentThb / fxRate : 0
            const pricePerShareUsd = unitsBought > 0 ? usdSpentThisTx / unitsBought : 0
            const pricePerShareThb = pricePerShareUsd > 0 ? pricePerShareUsd * fxRate : holding.price

            const currentUnits = holding.units ?? holding.totalUnits ?? 0
            const currentThbInvested = holding.totalThbInvested ?? currentUnits * (holding.avgCostThb ?? holding.avgCost ?? 0)
            const currentUsdInvested = holding.totalUsdInvested ?? currentUnits * (holding.avgCostUsd ?? (fxRate > 0 ? (holding.avgCost ?? 0) / fxRate : 0))

            const newTotalUnits = currentUnits + unitsBought
            const newTotalThbInvested = parseFloat((currentThbInvested + amountSpentThb).toFixed(2))
            const newTotalUsdInvested = currentUsdInvested + usdSpentThisTx

            const newAvgCostUsd = newTotalUnits > 0 ? newTotalUsdInvested / newTotalUnits : (holding.avgCostUsd ?? 0)
            const newAvgCostThb = newTotalUnits > 0 ? newTotalThbInvested / newTotalUnits : (holding.avgCostThb ?? holding.avgCost ?? 0)

            newUnits = newTotalUnits
            newAvgCost = newAvgCostThb
            calculatedUnits = unitsBought

            updatedFields = {
              units: newTotalUnits,
              totalUnits: newTotalUnits,
              totalThbInvested: newTotalThbInvested,
              totalUsdInvested: newTotalUsdInvested,
              avgCostUsd: newAvgCostUsd,
              avgCostThb: newAvgCostThb,
              avgCost: newAvgCostThb,
              price: pricePerShareThb > 0 ? pricePerShareThb : holding.price,
            }

            logNote = `DCA Buy: ${unitsBought} shares @ $${pricePerShareUsd.toFixed(2)}/share (+฿${amountSpentThb.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
          } else if (fundUpdate) {
            const { unitsBought, amountSpentThb, nav } = fundUpdate
            const currentUnits = holding.units ?? holding.totalUnits ?? 0
            const currentThbInvested = holding.totalThbInvested ?? (currentUnits * (holding.avgCostThb ?? holding.avgCost ?? 0))

            const newTotalUnits = currentUnits + unitsBought
            const newTotalThbInvested = parseFloat((currentThbInvested + amountSpentThb).toFixed(2))
            const newAvgCostThb = newTotalUnits > 0 ? newTotalThbInvested / newTotalUnits : (holding.avgCostThb ?? holding.avgCost ?? 0)

            newUnits = newTotalUnits
            newAvgCost = newAvgCostThb
            calculatedUnits = unitsBought

            updatedFields = {
              units: newTotalUnits,
              totalUnits: newTotalUnits,
              totalThbInvested: newTotalThbInvested,
              avgCostThb: newAvgCostThb,
              avgCost: newAvgCostThb,
              price: nav > 0 ? nav : (holding.price > 0 ? holding.price : newAvgCostThb),
            }

            logNote = `DCA Buy: ${unitsBought} units @ ฿${nav.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}/unit (+฿${amountSpentThb.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
          } else if (holding.assetClass === 'crypto' && btcLocationUpdate) {
            finalBtcLocations = upsert(holding.btcLocations ?? [], btcLocationUpdate)
            const totalSats = finalBtcLocations.reduce((s: number, l: BtcLocation) => s + l.satoshi, 0)
            const totalThb = parseFloat(finalBtcLocations.reduce((s: number, l: BtcLocation) => s + l.thbSpent, 0).toFixed(2))
            newUnits = totalSats / 100_000_000
            newAvgCost = newUnits > 0 ? totalThb / newUnits : holding.avgCost
            if (!isFinite(newAvgCost) || isNaN(newAvgCost)) newAvgCost = holding.avgCost

            const existingLoc = btcLocationUpdate.id ? holding.btcLocations?.find((l) => l.id === btcLocationUpdate.id) : undefined
            const satsBought = (btcUpdate && typeof btcUpdate.satsBought === 'number' && btcUpdate.satsBought > 0)
              ? btcUpdate.satsBought
              : (existingLoc ? btcLocationUpdate.satoshi - existingLoc.satoshi : btcLocationUpdate.satoshi)
            const amountSpent = (btcUpdate && typeof btcUpdate.amountSpentThb === 'number' && btcUpdate.amountSpentThb > 0)
              ? btcUpdate.amountSpentThb
              : (existingLoc ? btcLocationUpdate.thbSpent - existingLoc.thbSpent : btcLocationUpdate.thbSpent)
            calculatedUnits = satsBought / 100_000_000

            const impliedBtcPrice = satsBought > 0 ? (amountSpent / satsBought) * 100_000_000 : (pricePerUnit > 0 ? pricePerUnit : holding.price)

            updatedFields = {
              totalThbInvested: totalThb,
              totalUnits: newUnits,
              units: newUnits,
              avgCostThb: newAvgCost,
              avgCost: newAvgCost,
              price: impliedBtcPrice > 0 ? impliedBtcPrice : holding.price,
            }

            const btcLocName = btcLocationUpdate.name || existingLoc?.name
            logNote = `DCA Buy: ${satsBought.toLocaleString()} sats @ ฿${Math.round(impliedBtcPrice).toLocaleString()}/BTC (+฿${amountSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})${btcLocName ? ` · ${btcLocName}` : ''}`
          } else if (holding.assetClass === 'gold' && goldLocationUpdate) {
            finalGoldLocations = upsert(holding.goldLocations ?? [], goldLocationUpdate)
            const totalGrams = finalGoldLocations.reduce((s: number, l: GoldLocation) => s + l.grams, 0)
            const totalThb = parseFloat(finalGoldLocations.reduce((s: number, l: GoldLocation) => s + l.thbSpent, 0).toFixed(2))
            newUnits = totalGrams
            newAvgCost = newUnits > 0 ? totalThb / newUnits : holding.avgCost
            if (!isFinite(newAvgCost) || isNaN(newAvgCost)) newAvgCost = holding.avgCost

            const existingLoc = goldLocationUpdate.id ? holding.goldLocations?.find((l) => l.id === goldLocationUpdate.id) : undefined
            const gramsBought = goldUpdate?.gramsBought ?? (existingLoc ? goldLocationUpdate.grams - existingLoc.grams : goldLocationUpdate.grams)
            const amountSpent = goldUpdate?.amountSpentThb ?? (existingLoc ? goldLocationUpdate.thbSpent - existingLoc.thbSpent : goldLocationUpdate.thbSpent)
            calculatedUnits = gramsBought

            const impliedPricePerGram = gramsBought > 0 ? amountSpent / gramsBought : pricePerUnit

            updatedFields = {
              totalThbInvested: totalThb,
              totalUnits: newUnits,
              units: newUnits,
              avgCostThb: newAvgCost,
              avgCost: newAvgCost,
              price: impliedPricePerGram > 0 ? impliedPricePerGram : holding.price,
            }

            const goldLocName = goldLocationUpdate.name || existingLoc?.name
            logNote = `DCA Buy: ${gramsBought.toFixed(4)} g @ ฿${impliedPricePerGram.toFixed(2)}/g (+฿${amountSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})${goldLocName ? ` · ${goldLocName}` : ''}`
          } else if (holding.assetClass === 'fund') {
            const currentUnits = holding.units ?? holding.totalUnits ?? 0
            const currentThbInvested = holding.totalThbInvested ?? (currentUnits * (holding.avgCostThb ?? holding.avgCost ?? 0))
            const spentThb = plan.monthlyAmount
            const newTotalUnits = overrideUnits !== undefined ? overrideUnits : (currentUnits + calculatedUnits)
            const newTotalThb = parseFloat((currentThbInvested + spentThb).toFixed(2))
            const newAvgCostThb = newTotalUnits > 0 ? newTotalThb / newTotalUnits : holding.avgCost
            updatedFields = {
              totalThbInvested: newTotalThb,
              totalUnits: newTotalUnits,
              units: newTotalUnits,
              avgCostThb: newAvgCostThb,
              avgCost: newAvgCostThb,
            }
            logNote = `DCA Buy: ${calculatedUnits.toFixed(4)} units @ ฿${pricePerUnit.toFixed(2)}/unit (+฿${spentThb.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
          } else if (holding.assetClass === 'crypto') {
            const currentUnits = holding.units ?? holding.totalUnits ?? 0
            const spentThb = calculatedUnits * pricePerUnit
            const newTotalUnits = currentUnits + calculatedUnits
            const currentThbInvested = holding.totalThbInvested ?? (currentUnits * (holding.avgCostThb ?? holding.avgCost ?? 0))
            const newTotalThb = parseFloat((currentThbInvested + spentThb).toFixed(2))
            const newAvgCostThb = newTotalUnits > 0 ? newTotalThb / newTotalUnits : holding.avgCost
            newUnits = newTotalUnits
            newAvgCost = newAvgCostThb
            updatedFields = {
              totalThbInvested: newTotalThb,
              totalUnits: newTotalUnits,
              units: newTotalUnits,
              avgCostThb: newAvgCostThb,
              avgCost: newAvgCostThb,
              price: pricePerUnit > 0 ? pricePerUnit : holding.price,
            }
            logNote = `DCA Buy: ${calculatedUnits.toFixed(8)} units @ ฿${pricePerUnit.toFixed(8)}/unit (+฿${spentThb.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
          }

          const isBtcWithLocations = holding.assetClass === 'crypto' && (finalBtcLocations?.length ?? 0) > 0
          const isGoldWithLocations = holding.assetClass === 'gold' && (finalGoldLocations?.length ?? 0) > 0

          const resultingHolding: import('../lib/types').Holding = {
            ...holding,
            units: newUnits,
            totalUnits: newUnits,
            avgCost: newAvgCost,
            price: finalPrice,
            updatedAt: date,
            ...updatedFields,
            ...(isBtcWithLocations ? { btcLocations: finalBtcLocations } : {}),
            ...(isGoldWithLocations ? { goldLocations: finalGoldLocations } : {}),
          }

          const resolvedHoldingId = holding.id
          const updatedHoldings = holdingsList.map((h) =>
            h.id !== resolvedHoldingId ? h : resultingHolding
          )

          // 3. Add to holding log
          const logEntry: import('../lib/types').HoldingLog = {
            id: newId(),
            timestamp: new Date().toISOString(),
            action: isNewHolding ? 'add' : 'buy_more',
            holdingName: holding.name,
            ticker: holding.ticker,
            assetClass: holding.assetClass,
            note: logNote || `DCA Buy: ${calculatedUnits.toFixed(4)} units @ ฿${pricePerUnit.toLocaleString()} (+฿${plan.monthlyAmount.toLocaleString()})`,
            holdingId: holding.id,
            previousHoldingState,
            afterHoldingState: resultingHolding,
            dcaPlanId: plan.id,
            dcaDate: date,
            ...paidLog,
          }

          return {
            ...prev,
            ...paidAccounts,
            dcaPlans: updatedPlans,
            holdings: updatedHoldings,
            holdingLogs: [logEntry, ...(prev.holdingLogs ?? [])],
          }
        }),

      skipDcaBuy: (planId, date) => updateData((prev) => dcaActions.skipDcaBuy(prev, planId, date)),

      upsertTransfer: (transfer) => updateData((prev) => planningActions.upsertTransfer(prev, transfer)),
      removeTransfer: (id) => updateData((prev) => planningActions.removeTransfer(prev, id)),

      recordDividend: (record) => {
        const id = newId()
        updateData((prev) => {
          const now = new Date().toISOString()
          const oldAccounts = prev.cashAccounts ?? []
          const cashAcc = record.cashAccountId
            ? oldAccounts.find((a) => a.id === record.cashAccountId)
            : undefined

          // 1. Credit cash account if specified
          const updatedCashAccounts = cashAcc
            ? oldAccounts.map((a) =>
                a.id === cashAcc.id
                  ? { ...a, balance: a.balance + record.netAmount }
                  : a,
              )
            : oldAccounts

          // 2. Create DividendRecord
          const newRecord: DividendRecord = {
            ...record,
            id,
            cashAccountName: cashAcc ? cashAcc.name : record.cashAccountName,
            createdAt: now,
          }

          // 3. Create Activity HoldingLog
          const logEntry: HoldingLog = {
            id: newId(),
            timestamp: now,
            action: 'dividend',
            holdingId: record.holdingId,
            holdingName: record.holdingName,
            ticker: record.ticker,
            assetClass: record.assetClass,
            note: `Received dividend ฿${record.netAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (DPS: ฿${record.dps.toLocaleString()}, Tax 10%: -฿${record.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) into ${cashAcc ? cashAcc.name : 'Cash'}`,
            previousCashAccountsState: oldAccounts,
            afterCashAccountsState: updatedCashAccounts,
            cashAccountId: record.cashAccountId,
            dividendPerShare: record.dps,
            grossDividend: record.grossAmount,
            withholdingTax: record.taxAmount,
            netDividend: record.netAmount,
            dividendRecordId: id,
          }

          return {
            ...prev,
            cashAccounts: updatedCashAccounts,
            dividendRecords: [newRecord, ...(prev.dividendRecords ?? [])],
            holdingLogs: [logEntry, ...(prev.holdingLogs ?? [])],
          }
        })
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
      exportData: () => {
        const preferences: SpendiaryBackup['preferences'] = {}
        try {
          const theme = localStorage.getItem('spendiary.theme')
          const pnlDisplay = localStorage.getItem('spendiary_pnl_display')
          const logsViewMode = localStorage.getItem('spendiary_logs_view_mode')
          const goldSellUnit = localStorage.getItem('spendiary_gold_sell_unit')
          if (theme === 'light' || theme === 'dark' || theme === 'system') preferences.theme = theme
          if (pnlDisplay === 'pct' || pnlDisplay === 'thb') preferences.pnlDisplay = pnlDisplay
          if (logsViewMode === 'table' || logsViewMode === 'timeline') preferences.logsViewMode = logsViewMode
          if (goldSellUnit === 'grams' || goldSellUnit === 'baht') preferences.goldSellUnit = goldSellUnit
        } catch {
          // Preferences are optional; financial data remains exportable if storage is unavailable.
        }
        const backup: SpendiaryBackup = {
          schemaVersion: 1,
          exportedAt: new Date().toISOString(),
          data: dataRef.current,
          preferences,
        }
        const json = JSON.stringify(backup, null, 2)
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



        // 5. Update React state
        setDataState(stamped)

        if (backup?.schemaVersion === 1 && backup.preferences) {
          try {
            const { theme, pnlDisplay, logsViewMode, goldSellUnit } = backup.preferences
            if (theme) localStorage.setItem('spendiary.theme', theme)
            if (pnlDisplay) localStorage.setItem('spendiary_pnl_display', pnlDisplay)
            if (logsViewMode) localStorage.setItem('spendiary_logs_view_mode', logsViewMode)
            if (goldSellUnit) localStorage.setItem('spendiary_gold_sell_unit', goldSellUnit)
          } catch {
            // Preference restoration is best effort and must not invalidate the import.
          }
        }

        // 6. Force an immediate cloud push (bypass the 2-second debounce)
        if (user) pushNow(user.id, stamped)

        return { ok: true }
      },

      importPortfolioAndCash: (payload, mode) => {
        try {
          const rawHoldings = Array.isArray(payload.holdings) ? payload.holdings : []
          const rawCash = Array.isArray(payload.cashAccounts) ? payload.cashAccounts : []

          if (rawHoldings.length === 0 && rawCash.length === 0) {
            return { ok: false, error: 'No holdings or cash accounts found in the provided data.' }
          }

          const today = localDateStr(new Date())

          const sanitizedHoldings: Holding[] = []
          for (const item of rawHoldings) {
            if (typeof item !== 'object' || item === null) continue
            const r = item as Record<string, unknown>
            const rawTicker = typeof r.ticker === 'string' ? r.ticker.trim() : ''
            const rawName = typeof r.name === 'string' ? r.name.trim() : ''
            if (!rawTicker && !rawName) continue

            const rawCurr = typeof r.currency === 'string' ? r.currency.toUpperCase().trim() : ''
            const cleanTicker = (rawTicker || rawName).toUpperCase().replace(/\.(BK|SET|TB)$/i, '')
            const ticker = cleanTicker
            const name = rawName || rawTicker
            const assetClass = inferAssetClass(ticker, name, typeof r.assetClass === 'string' ? r.assetClass : undefined, rawCurr)
            const units = Math.max(0, parseCleanNumber(r.units ?? r.totalUnits, 0))
            const rawCost = Math.max(0, parseCleanNumber(r.avgCost ?? r.avgCostThb ?? r.avgCostUsd ?? r.price, 0))
            const rawPrice = parseCleanNumber(r.price, 0)

            const fx = usdThb && usdThb > 0 ? usdThb : 35
            // If currency is explicitly USD, or if assetClass is 'stock' and currency is not explicitly 'THB'
            const isUsd = rawCurr === 'USD' || (assetClass === 'stock' && rawCurr !== 'THB')

            let avgCostThb: number
            let avgCostUsd: number | undefined
            let totalThbInvested: number
            let totalUsdInvested: number | undefined
            let price: number

            const suppliedThbInvested = typeof r.totalThbInvested === 'number' && r.totalThbInvested > 0
              ? r.totalThbInvested
              : undefined
            const suppliedUsdInvested = typeof r.totalUsdInvested === 'number' && r.totalUsdInvested > 0
              ? r.totalUsdInvested
              : undefined

            if (isUsd) {
              avgCostUsd = rawCost
              avgCostThb = parseFloat((rawCost * fx).toFixed(4))
              totalUsdInvested = suppliedUsdInvested ?? parseFloat((units * rawCost).toFixed(4))
              totalThbInvested = suppliedThbInvested ?? parseFloat((units * avgCostThb).toFixed(2))
              price = rawPrice > 0 ? parseFloat((rawPrice * fx).toFixed(2)) : avgCostThb
            } else {
              avgCostThb = rawCost
              totalThbInvested = suppliedThbInvested ?? parseFloat((units * avgCostThb).toFixed(2))
              if (assetClass === 'stock') {
                avgCostUsd = fx > 0 ? parseFloat((rawCost / fx).toFixed(4)) : rawCost
                totalUsdInvested = suppliedUsdInvested ?? (fx > 0 ? parseFloat((totalThbInvested / fx).toFixed(4)) : 0)
              }
              price = rawPrice > 0 ? rawPrice : avgCostThb
            }

            const btcLocations = Array.isArray(r.btcLocations) ? (r.btcLocations as BtcLocation[]) : undefined
            const goldLocations = Array.isArray(r.goldLocations) ? (r.goldLocations as GoldLocation[]) : undefined

            sanitizedHoldings.push({
              id: typeof r.id === 'string' && r.id && r.id !== 'optional' ? r.id : newId(),
              ticker,
              name,
              assetClass,
              units,
              totalUnits: units,
              avgCost: avgCostThb,
              avgCostThb,
              avgCostUsd,
              totalThbInvested,
              totalUsdInvested,
              price,
              updatedAt: today,
              ...(btcLocations ? { btcLocations } : {}),
              ...(goldLocations ? { goldLocations } : {}),
            })
          }

          const sanitizedCash: CashAccount[] = []
          for (const item of rawCash) {
            if (typeof item !== 'object' || item === null) continue
            const r = item as Record<string, unknown>
            const rawName = typeof r.name === 'string' ? r.name.trim() : ''
            if (!rawName) continue

            const balance = parseCleanNumber(r.balance, 0)
            const rawCurr = typeof r.currency === 'string' ? r.currency.toUpperCase().trim() : 'THB'
            const currency: 'THB' | 'USD' = rawCurr === 'USD' ? 'USD' : 'THB'
            const preset = detectBankPreset(rawName)
            const rawCat = typeof r.category === 'string' ? r.category.toLowerCase().trim() : ''
            const category = (rawCat === 'locked'
              ? 'locked'
              : rawCat === 'spending'
                ? 'spending'
                : inferCashCategory(rawName)) as CashAccount['category']

            sanitizedCash.push({
              id: typeof r.id === 'string' && r.id && r.id !== 'optional' ? r.id : newId(),
              name: rawName,
              balance,
              currency,
              bankPreset: preset?.id,
              category,
            })
          }

          const rawLiabilities = Array.isArray(payload.liabilities) ? payload.liabilities : []
          const sanitizedLiabilities: Liability[] = []
          for (const item of rawLiabilities) {
            if (typeof item !== 'object' || item === null) continue
            const r = item as Record<string, unknown>
            const rawName = typeof r.name === 'string' ? r.name.trim() : ''
            if (!rawName) continue

            const balance = parseCleanNumber(r.balance, 0)
            const rawCat = typeof r.category === 'string' ? r.category.toLowerCase().trim() : 'other'
            const validCategories: DebtCategory[] = ['installment', 'credit_card', 'mortgage', 'auto_loan', 'personal_loan', 'student_loan', 'other']
            const category: DebtCategory = validCategories.includes(rawCat as DebtCategory) ? (rawCat as DebtCategory) : 'other'

            sanitizedLiabilities.push({
              id: typeof r.id === 'string' && r.id && r.id !== 'optional' ? r.id : newId(),
              name: rawName,
              category,
              balance,
              interestRate: typeof r.interestRate === 'number' ? r.interestRate : undefined,
              monthlyPayment: typeof r.monthlyPayment === 'number' ? r.monthlyPayment : undefined,
              lender: typeof r.lender === 'string' ? r.lender : undefined,
              dueDay: typeof r.dueDay === 'number' ? r.dueDay : undefined,
              note: typeof r.note === 'string' ? r.note : undefined,
              isInstallment: typeof r.isInstallment === 'boolean' ? r.isInstallment : (category === 'installment'),
              totalInstallments: typeof r.totalInstallments === 'number' ? r.totalInstallments : undefined,
              paidInstallments: typeof r.paidInstallments === 'number' ? r.paidInstallments : undefined,
              createdAt: today,
              updatedAt: today,
            })
          }

          if (sanitizedHoldings.length === 0 && sanitizedCash.length === 0 && sanitizedLiabilities.length === 0) {
            return { ok: false, error: 'Could not extract any valid holdings, cash accounts, or liabilities. Please check your JSON format.' }
          }

          const summaryParts = [
            sanitizedHoldings.length > 0 ? `${sanitizedHoldings.length} holdings` : '',
            sanitizedCash.length > 0 ? `${sanitizedCash.length} cash accounts` : '',
            sanitizedLiabilities.length > 0 ? `${sanitizedLiabilities.length} liabilities` : '',
          ].filter(Boolean).join(', ')

          const logEntry: HoldingLog = {
            id: newId(),
            timestamp: new Date().toISOString(),
            action: 'add',
            holdingName: `AI Import (${summaryParts})`,
            ticker: 'IMPORT',
            assetClass: 'stock',
            note: `Imported via AI/JSON Assistant (${mode === 'replace' ? 'Replaced' : 'Merged'})`,
          }

          updateData((prev) => {
            let nextHoldings: Holding[] = []
            if (mode === 'replace') {
              nextHoldings = sanitizedHoldings
            } else {
              const existing = [...prev.holdings]
              for (const h of sanitizedHoldings) {
                const idx = existing.findIndex(
                  (e) => e.ticker.toUpperCase() === h.ticker.toUpperCase() && e.assetClass === h.assetClass,
                )
                if (idx >= 0) {
                  existing[idx] = { ...existing[idx], ...h, id: existing[idx].id }
                } else {
                  existing.push(h)
                }
              }
              nextHoldings = existing
            }

            let nextCash: CashAccount[] = []
            if (mode === 'replace') {
              nextCash = sanitizedCash
            } else {
              const existing = [...prev.cashAccounts]
              for (const c of sanitizedCash) {
                const idx = existing.findIndex((e) => e.name.toLowerCase() === c.name.toLowerCase())
                if (idx >= 0) {
                  existing[idx] = { ...existing[idx], ...c, id: existing[idx].id }
                } else {
                  existing.push(c)
                }
              }
              nextCash = existing
            }

            let nextLiabilities: Liability[] = []
            if (mode === 'replace') {
              nextLiabilities = sanitizedLiabilities
            } else {
              const existing = [...(prev.liabilities ?? [])]
              for (const l of sanitizedLiabilities) {
                const idx = existing.findIndex((e) => e.name.toLowerCase() === l.name.toLowerCase())
                if (idx >= 0) {
                  existing[idx] = { ...existing[idx], ...l, id: existing[idx].id }
                } else {
                  existing.push(l)
                }
              }
              nextLiabilities = existing
            }

            return {
              ...prev,
              holdings: nextHoldings,
              cashAccounts: nextCash,
              liabilities: (sanitizedLiabilities.length > 0 || mode === 'replace') ? nextLiabilities : (prev.liabilities ?? []),
              holdingLogs: [logEntry, ...(prev.holdingLogs ?? [])],
            }
          })

          return {
            ok: true,
            count: {
              holdings: sanitizedHoldings.length,
              cashAccounts: sanitizedCash.length,
              liabilities: sanitizedLiabilities.length,
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

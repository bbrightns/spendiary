import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { SpendiaryData } from '../lib/types'
import { seedData } from './seed'
import { resolveRemoteLoad } from './remoteLoad'
import { interpretSave, lockHeaders, type SaveMode, type SaveOutcome } from './remoteSave'
import { emptyData, justImportedFixedCosts, migrate } from './migrate'
import { STORAGE_KEYS } from '../lib/storageKeys'

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error'

/**
 * Loads the signed-in user's data (cloud or test) and saves every change back.
 * Saving only turns on after a confirmed load, and cloud saves use an optimistic lock
 * (see remoteLoad.ts and remoteSave.ts), so a failed load or another device's newer save
 * is never overwritten.
 */
export function useCloudSync(
  user: User | null,
  data: SpendiaryData,
  setDataState: Dispatch<SetStateAction<SpendiaryData>>,
) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [dataReady, setDataReady] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [syncConflict, setSyncConflict] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.lastSyncedTime)
    return stored ? new Date(stored) : null
  })

  const updateLastSynced = (date: Date | null) => {
    setLastSyncedAt(date)
    if (date) {
      localStorage.setItem(STORAGE_KEYS.lastSyncedTime, date.toISOString())
    } else {
      localStorage.removeItem(STORAGE_KEYS.lastSyncedTime)
    }
  }

  // Tracks whether the initial Supabase load has completed (prevents syncing
  // back immediately after we receive data from the server).
  const syncReady = useRef(false)
  // Last data string we synced to Supabase — avoids redundant writes.
  const lastSynced = useRef('')
  // The cloud row's version stamp (`updated_at`) as we last loaded or saved it; see remoteSave.ts
  const remoteStamp = useRef<{ exists: boolean; updatedAt: string | null }>({ exists: false, updatedAt: null })
  // Cloud saves run one at a time, so each one checks against the stamp the previous one left
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve())
  // Counts loads; a load that a newer one (a retry, another sign-in) has replaced must not touch the state
  const loadSeq = useRef(0)

  const fetchRemoteData = async (userId: string) => {
    const seq = ++loadSeq.current
    const isStale = () => seq !== loadSeq.current

    if (userId === 'test-user-local') {
      localStorage.removeItem(STORAGE_KEYS.testData)
      const freshSample = migrate(JSON.parse(JSON.stringify(seedData)))
      lastSynced.current = JSON.stringify(freshSample)
      setDataState(freshSample)
      setSyncStatus('synced')
      syncReady.current = true
      setDataReady(true)
      return
    }

    try {
      setSyncStatus('syncing')

      // Only an answer given to this user can say "no row yet"; signed out, the database hides the row
      const { data: { session } } = await supabase.auth.getSession()
      const { data: row, error } = await supabase
        .from('user_data')
        .select('payload, updated_at')
        .eq('id', userId)
        .maybeSingle()

      if (isStale()) return
      const result = resolveRemoteLoad({ error, row, asUser: session?.user.id === userId })

      if (result.kind === 'failed') {
        // We can't tell what is in the cloud. Keep saving off so empty data never overwrites the real row.
        console.error('Could not load remote data; saving is paused until a retry succeeds')
        setSyncStatus('error')
        setLoadError(true)
        return
      }

      if (result.kind === 'loaded') {
        const remotePayload = result.payload as SpendiaryData
        const migrated = migrate(remotePayload)
        const migratedStr = JSON.stringify(migrated)
        remoteStamp.current = { exists: true, updatedAt: result.updatedAt }

        // A one-time move just happened: leave lastSynced stale so it gets saved back once
        lastSynced.current = justImportedFixedCosts(remotePayload, migrated) ? '' : migratedStr
        setDataState(migrated)
        setSyncStatus('synced')
        updateLastSynced(new Date())
      } else {
        remoteStamp.current = { exists: false, updatedAt: null }
        lastSynced.current = JSON.stringify(emptyData)
        setDataState(emptyData)
        setSyncStatus('synced')
        updateLastSynced(null)
      }
      // Only a confirmed load turns saving on
      syncReady.current = true
    } catch (err) {
      if (isStale()) return
      console.error('Error fetching remote data:', err)
      setSyncStatus('error')
      setLoadError(true)
    } finally {
      if (!isStale()) setDataReady(true)
    }
  }

  const retryLoad = () => {
    if (!user) return
    setLoadError(false)
    setSyncConflict(false)
    syncReady.current = false
    setDataReady(false)
    fetchRemoteData(user.id)
  }

  // Fetch remote data once user is loaded
  useEffect(() => {
    setLoadError(false)
    setSyncConflict(false)
    remoteStamp.current = { exists: false, updatedAt: null }
    if (user) {
      const storedLastUser = localStorage.getItem(STORAGE_KEYS.lastUserId)
      const isSwitch = Boolean(storedLastUser && storedLastUser !== user.id)

      if (isSwitch) {
        setDataState(emptyData)
        lastSynced.current = ''
      }

      localStorage.setItem(STORAGE_KEYS.lastUserId, user.id)

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
      setDataReady(false)
      fetchRemoteData(user.id)
    } else {
      loadSeq.current++ // a load still in flight belongs to the user who just signed out
      syncReady.current = false
      setDataState(emptyData)
      updateLastSynced(null)
    }
  }, [user])

  /** Saves to the cloud under the optimistic lock (see remoteSave.ts), after any save already in flight */
  const writeRemote = (userId: string, payload: SpendiaryData, force = false): Promise<SaveOutcome> => {
    const run = async (): Promise<SaveOutcome> => {
      const { exists, updatedAt } = remoteStamp.current
      const mode: SaveMode = force ? 'force' : exists ? 'update' : 'insert'
      const row = { payload, updated_at: new Date().toISOString() }
      const table = supabase.from('user_data')
      const query =
        mode === 'force'
          ? table.upsert({ id: userId, ...row }).select('updated_at')
          : mode === 'insert'
          ? table.insert({ id: userId, ...row }).select('updated_at')
          : updatedAt
          ? table.update(row).eq('id', userId).eq('updated_at', updatedAt).select('updated_at')
          : table.update(row).eq('id', userId).is('updated_at', null).select('updated_at')
      // The database checks the same lock (supabase/sql/user_data_write_lock.sql)
      for (const [name, value] of Object.entries(lockHeaders(mode, updatedAt))) query.setHeader(name, value)
      const res = await query
      const outcome = interpretSave(mode, res)
      if (outcome.kind === 'saved') {
        remoteStamp.current = { exists: true, updatedAt: outcome.updatedAt ?? row.updated_at }
      }
      return outcome
    }
    const next = saveQueue.current.then(run, run)
    saveQueue.current = next.catch(() => undefined)
    return next
  }

  /** A normal save under the lock; a conflict pauses saving instead of overwriting the other device */
  const saveLocked = async (userId: string, payload: SpendiaryData, serialised: string) => {
    try {
      const outcome = await writeRemote(userId, payload)
      if (outcome.kind === 'conflict') {
        // Another tab or device saved first. Stop rather than overwrite their changes.
        console.error('Cloud data changed elsewhere; saving is paused until the latest data is loaded')
        syncReady.current = false
        setSyncConflict(true)
        setSyncStatus('error')
        return
      }
      if (outcome.kind === 'error') throw outcome.error

      lastSynced.current = serialised
      setSyncStatus('synced')
      updateLastSynced(new Date())
    } catch (err) {
      console.error('Error syncing to Supabase:', err)
      setSyncStatus('error')
    }
  }

  // ── Debounced sync to Supabase on data change ──────────────
  useEffect(() => {
    if (!user) return
    if (!syncReady.current) return
    const serialised = JSON.stringify(data)
    if (serialised === lastSynced.current) return   // nothing changed

    if (user.id === 'test-user-local') {
      // Test Mode is strictly in-memory — never persist to localStorage so mock data stays fresh
      lastSynced.current = serialised
      setSyncStatus('synced')
      updateLastSynced(new Date())
      return
    }

    setSyncStatus('syncing')
    const timer = setTimeout(() => {
      // Saved some other way while waiting (a backup restore saves at once with pushNow)
      if (serialised === lastSynced.current) return
      saveLocked(user.id, data, serialised)
    }, 2000)
    return () => clearTimeout(timer)
  }, [data, user])

  /** Saves now, skipping the 2-second wait and the lock: restoring a backup replaces the cloud data on purpose */
  const pushNow = (userId: string, stamped: SpendiaryData) => {
    const serialised = JSON.stringify(stamped)
    // Claim it now, before the debounced save sees the same data and saves it a second time
    const previous = lastSynced.current
    lastSynced.current = serialised
    const failed = () => {
      // A newer save already went out and set the status itself
      if (lastSynced.current !== serialised) return
      lastSynced.current = previous
      // Try once more as a normal save under the lock (the old double save did this by accident)
      if (syncReady.current) saveLocked(userId, stamped, serialised)
      else setSyncStatus('error')
    }
    setSyncStatus('syncing')
    // Restoring a backup replaces the cloud data on purpose, so this write skips the lock
    writeRemote(userId, stamped, true)
      .then((outcome) => {
        if (outcome.kind === 'saved') {
          setSyncStatus('synced')
          updateLastSynced(new Date())
        } else {
          failed()
        }
      }, failed)
  }

  return {
    syncStatus,
    setSyncStatus,
    dataReady,
    loadError,
    syncConflict,
    lastSyncedAt,
    updateLastSynced,
    retryLoad,
    pushNow,
    /** False while saving is paused (before a confirmed load, after a conflict, while clearing) */
    syncReady,
    /** The data as last saved, serialised, so unchanged data is not saved again */
    lastSynced,
  }
}

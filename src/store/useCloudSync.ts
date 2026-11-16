import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { SpendiaryData } from '../lib/types'
import { seedData } from './seed'
import { resolveRemoteLoad } from './remoteLoad'
import { interpretSave, lockHeaders, retryDelayMs, sameSavedData, type SaveMode, type SaveOutcome } from './remoteSave'
import { DATA_SCHEMA, emptyData, isFromNewerApp, justImportedFixedCosts, migrate } from './migrate'
import { withLegacyLocations } from './legacyLocations'
import { STORAGE_KEYS, clearPersonalTraces } from '../lib/storageKeys'

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error'

/**
 * Loads the signed-in user's data (cloud or test) and saves every change back.
 * Saving only turns on after a confirmed load, and cloud saves use an optimistic lock
 * (see remoteLoad.ts and remoteSave.ts), so a failed load or another device's newer save
 * is never overwritten.
 * A save that fails is tried again by itself (and at once when the connection is back), and a change
 * still waiting out the 2 seconds is sent the moment the app is hidden (best effort when the tab is closed outright).
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
  // The cloud data was saved by a newer version of the app: this one must not save over it
  const [needsRefresh, setNeedsRefresh] = useState(false)
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
  // Counts loads; a load that a newer one (a retry, another sign-in) has replaced must not touch the state.
  // Saves read it too: one started before the latest load (or sign-out) belongs to data that is gone.
  const loadSeq = useRef(0)
  // Bumped to run the save effect again for the same data: a failed save's retry, or the connection is back
  const [retryTick, setRetryTick] = useState(0)
  const failures = useRef(0)
  const retryTimer = useRef<ReturnType<typeof setTimeout>>()
  // True when the next run of the save effect is a retry, which doesn't wait the 2 seconds again
  const retryDue = useRef(false)
  // The change waiting out its 2 seconds, so it can be saved at once when the app is hidden
  const pendingSave = useRef<(() => void) | null>(null)
  // The data being saved right now, serialised
  const saving = useRef<string | null>(null)
  // The payload of a save that got no answer: it may have been stored anyway (see writeRemote)
  const unconfirmed = useRef<unknown>(null)

  const stopRetrying = () => {
    clearTimeout(retryTimer.current)
    failures.current = 0
  }

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

      if (result.kind === 'loaded' && isFromNewerApp(result.payload as SpendiaryData)) {
        // Saved by a newer version: this code could misread it, so saving stays off until a refresh
        console.error('Cloud data was saved by a newer version of Spendiary; saving is paused until this page is refreshed')
        setSyncStatus('error')
        setNeedsRefresh(true)
        return
      }

      if (result.kind === 'loaded') {
        const remotePayload = result.payload as SpendiaryData
        const migrated = migrate(remotePayload)
        const migratedStr = JSON.stringify(migrated)
        remoteStamp.current = { exists: true, updatedAt: result.updatedAt }
        unconfirmed.current = null

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
    unconfirmed.current = null
    stopRetrying()
    if (user) {
      const storedLastUser = localStorage.getItem(STORAGE_KEYS.lastUserId)
      const isSwitch = Boolean(storedLastUser && storedLastUser !== user.id)

      if (isSwitch) {
        setDataState(emptyData)
        lastSynced.current = ''
        // The last account's recent searches are not this one's to see
        clearPersonalTraces(localStorage)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loads once per sign-in; setDataState is a stable setter and fetchRemoteData guards itself with loadSeq
  }, [user])

  /** Saves to the cloud under the optimistic lock (see remoteSave.ts), after any save already in flight */
  const writeRemote = (userId: string, payload: SpendiaryData, force = false): Promise<SaveOutcome> => {
    const epoch = loadSeq.current
    const superseded = () => epoch !== loadSeq.current
    // Old location fields too, for devices still on the previous version (legacyLocations.ts)
    const sent = { ...withLegacyLocations(payload), dataSchema: DATA_SCHEMA }
    const send = async (mode: SaveMode, updatedAt: string | null): Promise<SaveOutcome> => {
      const row = { payload: sent, updated_at: new Date().toISOString() }
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
      let outcome: SaveOutcome
      try {
        outcome = interpretSave(mode, await query)
      } catch (error) {
        outcome = { kind: 'error', error }
      }
      if (outcome.kind === 'saved') return { kind: 'saved', updatedAt: outcome.updatedAt ?? row.updated_at }
      return outcome
    }
    /**
     * A conflict is not always another device. When a save reaches the database but its answer is lost
     * (the connection dropped in between), we still hold the old stamp, and our next save conflicts with
     * our own. So look at what the cloud holds: if it is exactly what we are saving, or what we sent when
     * the answer got lost, the row is ours and we carry on from its stamp. Anything else is a real conflict.
     */
    const ownWrite = async (): Promise<SaveOutcome | null> => {
      try {
        const { data: row, error } = await supabase.from('user_data').select('payload, updated_at').eq('id', userId).maybeSingle()
        const stamp = (row as { updated_at?: unknown } | null)?.updated_at
        if (error || !row || typeof stamp !== 'string') return null
        const stored = (row as { payload?: unknown }).payload
        if (sameSavedData(stored, sent)) return { kind: 'saved', updatedAt: stamp }
        if (unconfirmed.current && sameSavedData(stored, unconfirmed.current)) {
          // Ours: keep its stamp even if the save below fails too, so the retry starts from it
          if (!superseded()) remoteStamp.current = { exists: true, updatedAt: stamp }
          return send('update', stamp)
        }
        return null
      } catch {
        return null
      }
    }
    const run = async (): Promise<SaveOutcome> => {
      // Queued before a sign-out or before the latest data was loaded: its stamp and data are out of date
      if (superseded()) return { kind: 'error', error: new Error('Save dropped: the data was loaded again') }
      const { exists, updatedAt } = remoteStamp.current
      const mode: SaveMode = force ? 'force' : exists ? 'update' : 'insert'
      let outcome = await send(mode, updatedAt)
      if (outcome.kind === 'conflict' && !superseded()) outcome = (await ownWrite()) ?? outcome
      if (superseded()) return outcome
      if (outcome.kind === 'saved') {
        remoteStamp.current = { exists: true, updatedAt: outcome.updatedAt }
        unconfirmed.current = null
      } else if (outcome.kind === 'error') {
        unconfirmed.current = sent
      }
      return outcome
    }
    const next = saveQueue.current.then(run, run)
    saveQueue.current = next.catch(() => undefined)
    return next
  }

  /** A normal save under the lock; a conflict pauses saving instead of overwriting the other device */
  const saveLocked = async (userId: string, payload: SpendiaryData, serialised: string) => {
    const epoch = loadSeq.current
    // The data was loaded again (or the user signed out) while this save was on its way: its result
    // says nothing about the data now on screen
    const superseded = () => epoch !== loadSeq.current
    saving.current = serialised
    try {
      const outcome = await writeRemote(userId, payload)
      if (superseded()) return
      if (outcome.kind === 'conflict') {
        // Another tab or device saved first. Stop rather than overwrite their changes.
        console.error('Cloud data changed elsewhere; saving is paused until the latest data is loaded')
        syncReady.current = false
        stopRetrying()
        setSyncConflict(true)
        setSyncStatus('error')
        return
      }
      if (outcome.kind === 'error') throw outcome.error

      stopRetrying()
      lastSynced.current = serialised
      setSyncStatus('synced')
      updateLastSynced(new Date())
    } catch (err) {
      if (superseded()) return
      console.error('Error syncing to Supabase:', err)
      setSyncStatus('error')
      // Nothing else would save this change until the next edit, so try again by ourselves
      failures.current += 1
      clearTimeout(retryTimer.current)
      retryTimer.current = setTimeout(() => {
        retryDue.current = true
        setRetryTick((t) => t + 1)
      }, retryDelayMs(failures.current))
    } finally {
      if (saving.current === serialised) saving.current = null
    }
  }

  // ── Debounced sync to Supabase on data change ──────────────
  useEffect(() => {
    const isRetry = retryDue.current
    retryDue.current = false
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
    const save = () => {
      pendingSave.current = null
      // Saved some other way while waiting (a backup restore saves at once with pushNow), or on its way now
      if (serialised === lastSynced.current || serialised === saving.current) return
      saveLocked(user.id, data, serialised)
    }
    const timer = setTimeout(save, isRetry ? 0 : 2000)
    pendingSave.current = () => {
      clearTimeout(timer)
      save()
    }
    return () => {
      clearTimeout(timer)
      pendingSave.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- saveLocked is rebuilt every render; listing it would restart the 2-second save timer on every render
  }, [data, user, retryTick])

  // Don't sit on an unsaved change while the app goes away or the connection comes back
  useEffect(() => {
    // Switching apps on a phone freezes the page, and its 2-second timer with it; the page is often
    // discarded before it runs again. Send the waiting change now.
    const flush = () => pendingSave.current?.()
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    const onOnline = () => {
      clearTimeout(retryTimer.current)
      retryDue.current = true
      setRetryTick((t) => t + 1)
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', flush)
    window.addEventListener('online', onOnline)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', flush)
      window.removeEventListener('online', onOnline)
      clearTimeout(retryTimer.current)
    }
  }, [])

  /** Saves now, skipping the 2-second wait and the lock: restoring a backup replaces the cloud data on purpose */
  const pushNow = (userId: string, stamped: SpendiaryData) => {
    const serialised = JSON.stringify(stamped)
    // Claim it now, before the debounced save sees the same data and saves it a second time
    const previous = lastSynced.current
    lastSynced.current = serialised
    const epoch = loadSeq.current
    const failed = () => {
      // The data was loaded again since; or a newer save already went out and set the status itself
      if (epoch !== loadSeq.current || lastSynced.current !== serialised) return
      lastSynced.current = previous
      // Try once more as a normal save under the lock (the old double save did this by accident)
      if (syncReady.current) saveLocked(userId, stamped, serialised)
      else setSyncStatus('error')
    }
    setSyncStatus('syncing')
    // Restoring a backup replaces the cloud data on purpose, so this write skips the lock
    writeRemote(userId, stamped, true)
      .then((outcome) => {
        if (epoch !== loadSeq.current) return
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
    needsRefresh,
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

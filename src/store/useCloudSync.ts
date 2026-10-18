import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { SpendiaryData } from '../lib/types'
import { seedData } from '../lib/seed'
import { resolveRemoteLoad, type RestLoad } from './remoteLoad'
import { interpretSave, type SaveMode, type SaveOutcome } from './remoteSave'
import { emptyData, justImportedFixedCosts, migrate } from './migrate'

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error'

/**
 * Loads the signed-in user's data (cloud, guest or test) and saves every change back.
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

  // Tracks whether the initial Supabase load has completed (prevents syncing
  // back immediately after we receive data from the server).
  const syncReady = useRef(false)
  // Last data string we synced to Supabase — avoids redundant writes.
  const lastSynced = useRef('')
  // The cloud row's version stamp (`updated_at`) as we last loaded or saved it; see remoteSave.ts
  const remoteStamp = useRef<{ exists: boolean; updatedAt: string | null }>({ exists: false, updatedAt: null })
  // Cloud saves run one at a time, so each one checks against the stamp the previous one left
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve())

  const fetchRemoteData = async (userId: string) => {
    if (userId === 'guest-user-local') {
      const local = localStorage.getItem('spendiary.guest_data')
      if (local) {
        try {
          const parsed = JSON.parse(local)
          const migrated = migrate(parsed)
          lastSynced.current = justImportedFixedCosts(parsed, migrated) ? '' : JSON.stringify(migrated)
          setDataState(migrated)
        } catch {
          setDataState(emptyData)
        }
      } else {
        setDataState(emptyData)
      }
      setSyncStatus('synced')
      syncReady.current = true
      setDataReady(true)
      return
    }

    if (userId === 'test-user-local') {
      localStorage.removeItem('spendiary.test_data')
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

      const supabaseUrl = import.meta.env.VITE_API_URL || ''
      const supabaseKey = import.meta.env.VITE_API_TOKEN || ''

      // Attempt 1: Via supabase-js client
      const { data: row, error } = await supabase
        .from('user_data')
        .select('payload, updated_at')
        .eq('id', userId)
        .maybeSingle()


      let rest: RestLoad | null = null
      if (error || !row?.payload) {
        // Attempt 2: Via direct REST call with Authorization Bearer header
        // Retrieve token from Supabase localStorage or hash
        const storageKey = `sb-dgxjifbsdpggoyyzhpeb-auth-token`
        let token = supabaseKey
        let usedUserToken = false
        try {
          const raw = localStorage.getItem(storageKey)
          if (raw) {
            const parsed = JSON.parse(raw)
            if (parsed.access_token) {
              token = parsed.access_token
              usedUserToken = true
            }
          }
        } catch {
          // ignore: storage or JSON unavailable
        }

        try {
          const restRes = await fetch(`${supabaseUrl}/rest/v1/user_data?id=eq.${encodeURIComponent(userId)}&select=payload,updated_at`, {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            }
          })
          const list = restRes.ok ? await restRes.json() : null
          rest = { ok: restRes.ok, list, usedUserToken }
        } catch (restErr) {
          console.warn('REST API fallback error:', restErr)
        }
      }

      const result = resolveRemoteLoad({ error, row }, rest)

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
      console.error('Error fetching remote data:', err)
      setSyncStatus('error')
      setLoadError(true)
    } finally {
      setDataReady(true)
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
      setDataReady(false)
      fetchRemoteData(user.id)
    } else {
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
      const res =
        mode === 'force'
          ? await table.upsert({ id: userId, ...row }).select('updated_at')
          : mode === 'insert'
          ? await table.insert({ id: userId, ...row }).select('updated_at')
          : updatedAt
          ? await table.update(row).eq('id', userId).eq('updated_at', updatedAt).select('updated_at')
          : await table.update(row).eq('id', userId).is('updated_at', null).select('updated_at')
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
      // Test Mode is strictly in-memory — never persist to localStorage so mock data stays fresh
      lastSynced.current = serialised
      setSyncStatus('synced')
      updateLastSynced(new Date())
      return
    }

    setSyncStatus('syncing')
    const timer = setTimeout(async () => {
      try {
        const outcome = await writeRemote(user.id, data)
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
    }, 2000)
    return () => clearTimeout(timer)
  }, [data, user])

  /** Saves now, skipping the 2-second wait and the lock: restoring a backup replaces the cloud data on purpose */
  const pushNow = (userId: string, stamped: SpendiaryData) => {
    const serialised = JSON.stringify(stamped)
    setSyncStatus('syncing')
    // Restoring a backup replaces the cloud data on purpose, so this write skips the lock
    writeRemote(userId, stamped, true)
      .then((outcome) => {
        if (outcome.kind === 'saved') {
          lastSynced.current = serialised
          setSyncStatus('synced')
          updateLastSynced(new Date())
        } else {
          setSyncStatus('error')
        }
      }, () => setSyncStatus('error'))
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

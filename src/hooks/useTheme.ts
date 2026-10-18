import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { STORAGE_KEYS } from '../lib/storageKeys'

export type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = STORAGE_KEYS.theme

function prefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function getStoredTheme(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* storage unavailable */
  }
  return 'light'
}

function applyTheme(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && prefersDark())
  document.documentElement.classList.toggle('dark', dark)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', dark ? '#0f1117' : '#fbfbfd')
}

// One theme for the whole app. Each component used to keep its own copy, so a copy left
// behind (Sidebar, command palette) could flip the theme back when it acted or a page mounted.
let current: Theme = getStoredTheme()
const listeners = new Set<() => void>()
const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
const snapshot = () => current

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, snapshot)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Re-apply when the OS preference changes (relevant when theme === 'system')
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if (current === 'system') applyTheme('system')
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const setTheme = useCallback((t: Theme) => {
    current = t
    try {
      localStorage.setItem(STORAGE_KEY, t)
    } catch {
      /* non-fatal */
    }
    applyTheme(t)
    listeners.forEach((fn) => fn())
  }, [])

  return { theme, setTheme }
}

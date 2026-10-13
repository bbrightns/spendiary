/** The keyboard shortcut that opens search: ⌘K on a Mac, Alt + S elsewhere (Windows, Linux). */
export const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)

/** How the shortcut is written in labels and tooltips */
export const SEARCH_SHORTCUT = IS_MAC ? '⌘K' : 'Alt+S'

/**
 * Whether a keydown is the search shortcut. Goes by the physical key (`code`), so Alt + S still
 * works with the Thai keyboard layout, where that key types "ห".
 */
export function isSearchShortcut(e: Pick<KeyboardEvent, 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'code'>, mac = IS_MAC): boolean {
  if (mac) return e.metaKey && !e.altKey && !e.ctrlKey && e.code === 'KeyK'
  return e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.code === 'KeyS'
}

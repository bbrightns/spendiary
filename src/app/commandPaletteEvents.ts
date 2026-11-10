// Kept out of CommandPalette.tsx so that file exports only the component (React Fast Refresh)

export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent('spendiary:open-command-palette'))
}

export function openShortcutsGuide() {
  window.dispatchEvent(new CustomEvent('spendiary:open-shortcuts-guide'))
}

/** Settings is a menu of sections; each one opens at /settings/<id> (a panel beside the menu on desktop). */

export const SETTINGS_SECTIONS = [
  { id: 'general', title: 'General', hint: 'Theme and your name' },
  { id: 'month', title: 'Spending month', hint: 'Count from the 1st, or from payday' },
  { id: 'budgets', title: 'Budgets', hint: 'Monthly total and per-category limits' },
  { id: 'categories', title: 'Categories', hint: 'Names, icons and colors' },
  { id: 'quick', title: 'Quick add and reminders', hint: 'Default payment method, bill reminders' },
  { id: 'data', title: 'Data and backup', hint: 'Import, export, AI import and reset' },
  { id: 'about', title: 'About Spendiary', hint: 'Who built it and why' },
] as const

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]['id']

/** The section desktop shows when /settings opens without one */
export const DEFAULT_SETTINGS_SECTION: SettingsSectionId = 'general'

export function isSettingsSection(id: string | undefined): id is SettingsSectionId {
  return SETTINGS_SECTIONS.some((s) => s.id === id)
}

export function settingsSection(id: SettingsSectionId) {
  return SETTINGS_SECTIONS.find((s) => s.id === id)!
}

/**
 * Anchors that used to sit on the one long Settings page (/settings#category-budgets), and the
 * section each now lives in. Old links, bookmarks and the /spend/settings redirect still land.
 */
const ANCHOR_SECTION: Record<string, SettingsSectionId> = {
  general: 'general',
  spend: 'month',
  'spending-month': 'month',
  'monthly-budget': 'budgets',
  'category-budgets': 'budgets',
  categories: 'categories',
  'bill-reminders': 'quick',
  'quick-add': 'quick',
  backup: 'data',
  data: 'data',
  'ai-import': 'data',
  about: 'about',
}

/** Where a Settings anchor lives now: "category-budgets" → "/settings/budgets#category-budgets". */
export function settingsPath(anchor?: string): string {
  const id = anchor?.replace(/^#/, '') ?? ''
  const section = ANCHOR_SECTION[id]
  if (!section) return '/settings'
  // A section's own name, or an old group name, opens the section at its top
  const atTop = id === section || id === 'spend' || id === 'backup'
  return atTop ? `/settings/${section}` : `/settings/${section}#${id}`
}

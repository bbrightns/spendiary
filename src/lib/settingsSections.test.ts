import { describe, expect, it } from 'vitest'
import { SETTINGS_SECTIONS, isSettingsSection, settingsPath } from './settingsSections'

describe('settingsPath', () => {
  it('opens an anchor inside the section it moved to', () => {
    expect(settingsPath('category-budgets')).toBe('/settings/budgets#category-budgets')
    expect(settingsPath('#quick-add')).toBe('/settings/quick#quick-add')
    expect(settingsPath('ai-import')).toBe('/settings/data#ai-import')
  })

  it('opens a section, or an old group name, at its top', () => {
    expect(settingsPath('general')).toBe('/settings/general')
    expect(settingsPath('categories')).toBe('/settings/categories')
    expect(settingsPath('#spend')).toBe('/settings/month')
    expect(settingsPath('backup')).toBe('/settings/data')
  })

  it('falls back to the menu for unknown or missing anchors', () => {
    expect(settingsPath('nope')).toBe('/settings')
    expect(settingsPath('')).toBe('/settings')
    expect(settingsPath()).toBe('/settings')
  })

  it('maps to real sections only', () => {
    for (const s of SETTINGS_SECTIONS) expect(isSettingsSection(s.id)).toBe(true)
    expect(isSettingsSection('spend')).toBe(false)
    expect(isSettingsSection(undefined)).toBe(false)
  })
})

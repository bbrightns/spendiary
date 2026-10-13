import { describe, expect, it } from 'vitest'
import { isSearchShortcut } from './shortcut'

const key = (code: string, mods: Partial<Record<'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey', boolean>> = {}) => ({
  code,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  ...mods,
})

describe('isSearchShortcut', () => {
  it('is Alt + S on Windows, by the key, whatever the keyboard layout types', () => {
    expect(isSearchShortcut(key('KeyS', { altKey: true }), false)).toBe(true)
    expect(isSearchShortcut(key('KeyS'), false)).toBe(false)
    expect(isSearchShortcut(key('KeyS', { altKey: true, ctrlKey: true }), false)).toBe(false)
    expect(isSearchShortcut(key('KeyK', { ctrlKey: true }), false)).toBe(false)
  })

  it('is ⌘K on a Mac', () => {
    expect(isSearchShortcut(key('KeyK', { metaKey: true }), true)).toBe(true)
    expect(isSearchShortcut(key('KeyS', { altKey: true }), true)).toBe(false)
  })
})

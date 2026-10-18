import { describe, expect, it } from 'vitest'
import { CATEGORY_ICONS, CATEGORY_ICON_GROUPS, CATEGORY_ICON_LIST, pickableCategoryIcons } from './categoryIcons'

/** Keys saved in users' data before the switch to Lucide: every one must keep an icon */
const SAVED_KEYS = [
  'food', 'coffee', 'car', 'plane', 'bag', 'shirt', 'receipt', 'wifi', 'phone', 'home', 'heart', 'shield', 'dumbbell',
  'scissors', 'sparkle', 'film', 'music', 'game', 'book', 'grad', 'gift', 'wallet', 'briefcase', 'coins', 'sparkles',
  'growth', 'dividend', 'tag', 'dots',
]

describe('category icons', () => {
  it('still has an icon for every key saved before', () => {
    for (const key of SAVED_KEYS) expect(CATEGORY_ICONS[key], key).toBeDefined()
  })

  it('has no repeated keys', () => {
    const keys = CATEGORY_ICON_LIST.map((d) => d.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('never offers the same picture twice in the picker', () => {
    const seen = new Map<unknown, string>()
    for (const d of pickableCategoryIcons()) {
      expect(seen.get(d.source), `${d.key} looks like ${seen.get(d.source)}`).toBeUndefined()
      seen.set(d.source, d.key)
    }
  })

  it('keeps the system Dividends icon and the old sparkles out of the picker', () => {
    const keys = pickableCategoryIcons().map((d) => d.key)
    expect(keys).not.toContain('dividend')
    expect(keys).not.toContain('sparkles')
    expect(keys.length).toBeGreaterThanOrEqual(80)
  })

  it('puts every icon in a known group', () => {
    const groups = new Set(CATEGORY_ICON_GROUPS.map((g) => g.id))
    for (const d of CATEGORY_ICON_LIST) expect(groups.has(d.group), d.key).toBe(true)
  })

  it('finds icons by Thai or English words', () => {
    expect(pickableCategoryIcons('หมา').map((d) => d.key)).toEqual(expect.arrayContaining(['pets', 'dog']))
    expect(pickableCategoryIcons('cake').map((d) => d.key)).toContain('dessert')
    expect(pickableCategoryIcons('ของหวาน').map((d) => d.key)).toContain('dessert')
    expect(pickableCategoryIcons('ครอบครัว').map((d) => d.key)).toContain('family')
    expect(pickableCategoryIcons('zzzz')).toEqual([])
  })
})

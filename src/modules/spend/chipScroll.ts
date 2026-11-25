import { useLayoutEffect, useState, type RefObject } from 'react'

/** Room left beside a revealed chip, so the edge fade doesn't cover it */
const REVEAL_PAD = 28

/**
 * Where a sideways row should scroll so the chip at `left` (`width` wide, both relative to the row's
 * content) is fully in view with `pad` px to spare; undefined when it already is.
 */
export function revealScroll(o: { scroll: number; view: number; left: number; width: number; pad?: number }): number | undefined {
  const pad = o.pad ?? REVEAL_PAD
  if (o.left - pad < o.scroll) return Math.max(0, o.left - pad)
  if (o.left + o.width + pad > o.scroll + o.view) return o.left + o.width + pad - o.view
  return undefined
}

/**
 * A row of chips that scrolls sideways: returns the fade classes for the ends with more to scroll
 * to (`fade-x-start` / `fade-x-end`). With `reveal`, whenever `key` changes the picked chip
 * (`aria-pressed="true"`, a single choice) scrolls into view. `active` off (e.g. while the row wraps
 * for editing) turns both off.
 */
export function useChipScroll(ref: RefObject<HTMLElement | null>, key: string, { active = true, reveal = false } = {}): string {
  const [edges, setEdges] = useState({ start: false, end: false })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !active) return setEdges({ start: false, end: false })
    const read = () => {
      const max = el.scrollWidth - el.clientWidth
      const next = { start: el.scrollLeft > 1, end: el.scrollLeft < max - 1 }
      setEdges((prev) => (prev.start === next.start && prev.end === next.end ? prev : next))
    }
    read()
    el.addEventListener('scroll', read, { passive: true })
    const ro = new ResizeObserver(read)
    ro.observe(el)
    // Chips change width too once a web font (Thai) loads
    for (const child of el.children) ro.observe(child)
    return () => {
      el.removeEventListener('scroll', read)
      ro.disconnect()
    }
  }, [ref, active, key])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !active || !reveal) return
    const chip = el.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (!chip) return
    const box = el.getBoundingClientRect()
    const r = chip.getBoundingClientRect()
    const to = revealScroll({ scroll: el.scrollLeft, view: el.clientWidth, left: r.left - box.left + el.scrollLeft, width: r.width })
    // Set directly, not scrollIntoView, so the sheet around it never scrolls up or down
    if (to !== undefined) el.scrollLeft = to
  }, [ref, active, reveal, key])

  return `${edges.start ? 'fade-x-start' : ''} ${edges.end ? 'fade-x-end' : ''}`
}

/** Gap between chips in a row (`gap-1.5`) */
const CHIP_GAP = 6

/**
 * Where chips `widths` wide (in order) break into a second row of a `view` px wide strip; undefined
 * when they all fit in one. The top row fills in reading order up to the strip's width, or up to
 * half of all the chips once that is more, so two long rows scroll side by side about evenly.
 */
export function rowSplit(widths: number[], view: number, gap = CHIP_GAP): number | undefined {
  const total = widths.reduce((sum, w) => sum + w, 0) + gap * Math.max(0, widths.length - 1)
  if (widths.length < 2 || total <= view + 1) return undefined
  const limit = Math.max(view, total / 2)
  let run = 0
  let split = 0
  for (const w of widths) {
    const next = run + (split ? gap : 0) + w
    if (next > limit + 1) break
    run = next
    split++
  }
  return Math.min(Math.max(split, 1), widths.length - 1)
}

/**
 * The index where the chips (`[data-chip]`, in order) inside `ref` start a second row, or undefined
 * while one row holds them. Chip widths don't depend on the rows they sit in, so measuring the two
 * rows gives the same answer as measuring one.
 */
export function useRowSplit(ref: RefObject<HTMLElement | null>, key: string, active = true): number | undefined {
  const [split, setSplit] = useState<number | undefined>()

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !active) return setSplit(undefined)
    const read = () => {
      const widths = Array.from(el.querySelectorAll<HTMLElement>('[data-chip]'), (c) => c.offsetWidth)
      setSplit(rowSplit(widths, el.clientWidth))
    }
    read()
    const ro = new ResizeObserver(read)
    ro.observe(el)
    // Chips change width once a web font (Thai) loads
    for (const chip of el.querySelectorAll('[data-chip]')) ro.observe(chip)
    return () => ro.disconnect()
    // `split` too: moving chips between rows draws them anew, so watch the new ones
  }, [ref, key, active, split])

  return split
}

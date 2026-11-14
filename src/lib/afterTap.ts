/** How long to wait after a press ends for its click (a scroll or drag never sends one) */
const CLICK_WAIT_MS = 300

/**
 * A tap is "in progress" from the press until its click (or CLICK_WAIT_MS after the press ends).
 * On touch the field loses focus only after the finger lifts (on the mousedown the browser adds),
 * so the end of the press alone is too early. Tracked for the whole page, capture phase.
 */
let busy = false
let timer: ReturnType<typeof setTimeout> | undefined
const waiting: (() => void)[] = []

function settle() {
  busy = false
  clearTimeout(timer)
  const fns = waiting.splice(0)
  // Next tick, so the click's own handler has run first
  if (fns.length) setTimeout(() => fns.forEach((fn) => fn()), 0)
}

if (typeof window !== 'undefined') {
  window.addEventListener(
    'pointerdown',
    () => {
      busy = true
      clearTimeout(timer)
    },
    true,
  )
  const ended = () => {
    clearTimeout(timer)
    timer = setTimeout(settle, CLICK_WAIT_MS)
  }
  window.addEventListener('pointerup', ended, true)
  window.addEventListener('pointercancel', ended, true)
  window.addEventListener('click', settle, true)
}

/**
 * Run `fn` once the tap in progress has landed: right away when there is none, otherwise after its
 * click has gone through. For a blur that collapses part of the page: run at once, it shifts what's
 * below mid-tap and the click lands on something else (or nothing).
 */
export function afterTap(fn: () => void): void {
  if (busy) waiting.push(fn)
  else fn()
}

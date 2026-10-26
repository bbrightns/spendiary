// Captures the landing page screenshots from the running dev server (npm run dev → :3000), in demo mode.
// Writes WebP files to ../public/landing/. Re-run whenever the Spend overview or Portfolio UI changes.
//   SHOTS: whole screens.  PARTS: single app components (cards, rows), cut out with transparent corners.
import { mkdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'

const BASE = process.env.APP_URL ?? 'http://localhost:3000'
const OUT = fileURLToPath(new URL('../public/landing/', import.meta.url))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const DESKTOP = { width: 1440, height: 900, deviceScaleFactor: 1 }
const PHONE = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
// Wide parts (bills, allocation) are shot at 2x on a narrower desktop; small ones at phone width
const PARTS_VIEW = { width: 1180, height: 900, deviceScaleFactor: 2 }

const SHOTS = [
  { name: 'spend-desktop', path: '/', viewport: DESKTOP },
  { name: 'spend-mobile', path: '/', viewport: PHONE },
  { name: 'portfolio-mobile', path: '/portfolio', viewport: PHONE },
]

/** Each part: the page, then the smallest element that contains `text` and matches `box` (a card or a row). */
const PARTS = [
  { name: 'part-today', path: '/', text: 'left today of', box: 'card', viewport: PHONE },
  { name: 'part-month', path: '/', text: 'days to payday', box: 'card', viewport: PHONE },
  { name: 'part-due', path: '/', text: 'payments due', box: 'row', viewport: PHONE },
  { name: 'part-bills', path: '/', text: 'Bills and recurring', box: 'card', viewport: PARTS_VIEW },
  { name: 'part-allocation', path: '/portfolio', text: 'Allocation', box: 'card', viewport: PARTS_VIEW },
  { name: 'part-portfolio-value', path: '/portfolio', text: 'Portfolio value', box: 'inset', viewport: PHONE },
]

/** A page signed in to demo mode, light theme, without the demo-only chrome, on `path`. */
async function openDemo(viewport, path) {
  const page = await browser.newPage()
  await page.setViewport(viewport)
  // Today at 2 pm, whenever the script runs, so the greeting ("Good afternoon") and screens come out the same
  await page.evaluateOnNewDocument(() => {
    const RealDate = Date
    const target = new RealDate()
    target.setHours(14, 0, 0, 0)
    const offset = target.getTime() - RealDate.now()
    class FixedDate extends RealDate {
      constructor(...args) {
        if (args.length === 0) super(RealDate.now() + offset)
        else super(...args)
      }
      static now() {
        return RealDate.now() + offset
      }
    }
    globalThis.Date = FixedDate
  })
  await page.goto(BASE, { waitUntil: 'networkidle0' })
  await page.evaluate(() => localStorage.setItem('spendiary.theme', 'light'))
  await page.reload({ waitUntil: 'networkidle0' })
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Try the demo'))?.click())
  await sleep(1500)

  // Hide what only exists in demo mode (banner, the room kept for it, the sidebar's "Test" pill) and toasts
  await page.addStyleTag({
    content: `aside[aria-label="Test mode environment warning" i], [role=status] { display: none !important; }
      #root > div.pt-9 { padding-top: 0 !important; }
      .top-9 { top: 0 !important; }`,
  })
  await page.evaluate(() => {
    document.documentElement.classList.remove('dark')
    document.querySelector('span > .animate-pulse')?.parentElement?.remove()
  })

  await page.evaluate((p) => {
    history.pushState({}, '', p)
    dispatchEvent(new PopStateEvent('popstate'))
  }, path)
  await sleep(1200)
  // One-time tips are for new users, not for a picture of the app
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Got it')?.click())
  await sleep(400)
  await page.evaluate(() => scrollTo(0, 0))
  await sleep(300)
  return page
}

const report = (file, name) => console.log(`saved ${name}.webp (${Math.round(statSync(file).size / 1024)} KB)`)

mkdirSync(OUT, { recursive: true })
const browser = await puppeteer.launch({ headless: true })

for (const { name, path, viewport } of SHOTS) {
  const page = await openDemo(viewport, path)
  const file = `${OUT}${name}.webp`
  await page.screenshot({ path: file, type: 'webp', quality: 80 })
  report(file, name)
  await page.close()
}

for (const { name, path, text, box, viewport } of PARTS) {
  const page = await openDemo(viewport, path)
  // Transparent page behind the part, so its rounded corners and soft shadow land on whatever the landing page uses
  await page.addStyleTag({ content: 'html, body, #root, #root > div, main { background: transparent !important; background-image: none !important; }' })
  const found = await page.evaluate(
    (text, box) => {
      // card: the shared Card; inset: a grey group inside a card; row: a bordered rounded row (TodayStack)
      const match = ({ className: c }) =>
        box === 'card' ? c.includes('radius-card') : box === 'inset' ? /rounded-2xl/.test(c) && /bg-surface-muted/.test(c) : /rounded-2xl/.test(c) && /border/.test(c)
      // Skip hidden copies (other breakpoints render some components twice)
      const els = [...document.querySelectorAll('div')].filter(
        (el) => typeof el.className === 'string' && match(el) && el.textContent.includes(text) && el.getBoundingClientRect().height > 24,
      )
      // The innermost match is the component itself, not a wrapper around several
      const el = els.sort((a, b) => a.getBoundingClientRect().height - b.getBoundingClientRect().height)[0]
      if (!el) return null
      // Only the part stays visible, so neighbours never show in the padding around it
      el.classList.add('landing-shot-target')
      el.scrollIntoView({ block: 'center', behavior: 'instant' })
      return true
    },
    text,
    box,
  )
  if (!found) {
    console.warn(`part not found: ${name} ("${text}")`)
    await page.close()
    continue
  }
  await page.addStyleTag({
    content: 'body * { visibility: hidden !important; } .landing-shot-target, .landing-shot-target * { visibility: visible !important; }',
  })
  await sleep(500)
  // Measured after the scroll settles (the app scrolls smoothly)
  const box2 = await page.evaluate(() => {
    const r = document.querySelector('.landing-shot-target').getBoundingClientRect()
    return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height }
  })
  const pad = 24 // room for the card's soft shadow
  const file = `${OUT}${name}.webp`
  await page.screenshot({
    path: file,
    type: 'webp',
    quality: 90,
    omitBackground: true,
    captureBeyondViewport: false, // true resizes the viewport, which reflows the page and moves the part
    clip: { x: box2.x - pad, y: box2.y - pad, width: box2.width + pad * 2, height: box2.height + pad * 2 },
  })
  report(file, name)
  await page.close()
}

await browser.close()

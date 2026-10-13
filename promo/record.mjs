// Records the onboarding walkthrough from the running dev server (npm run dev → :3000), in demo mode.
// Each scene is real screen video (Chrome screencast), with a tap ripple wherever it taps and
// caption cues stamped at the moment each action happens. Writes public/clips/<scene>.mp4 and
// public/clips/manifest.json, which the Intro composition reads.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import puppeteer from 'puppeteer'

const BASE = process.env.APP_URL ?? 'http://localhost:3000'
const OUT = fileURLToPath(new URL('./public/clips/', import.meta.url))
const TMP = fileURLToPath(new URL('./out/frames/', import.meta.url))
const FPS = 30
// Remotion ships an ffmpeg build; use it so nothing else needs installing
const FFMPEG = createRequire(import.meta.url)
  .resolve('@remotion/compositor-win32-x64-msvc/package.json')
  .replace(/package\.json$/, 'ffmpeg.exe')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

rmSync(OUT, { recursive: true, force: true })
rmSync(TMP, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

// The window flags matter: without them the screencast comes out at ~1.1x, not the 2x the viewport asks for
const browser = await puppeteer.launch({ headless: true, args: ['--window-size=390,844', '--force-device-scale-factor=2'] })
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const cdp = await page.createCDPSession()

// ── Setup (not recorded): demo mode, light theme, no test banner ──
await page.goto(BASE, { waitUntil: 'networkidle0' })
await page.evaluate(() => localStorage.setItem('spendiary.theme', 'light'))
await page.reload({ waitUntil: 'networkidle0' })
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Explore Demo'))?.click())
await sleep(1500)
await page.addStyleTag({
  content: `aside[aria-label="Test Mode Environment Warning"] { display: none !important; }
    #root > div.pt-9 { padding-top: 0 !important; }
    .top-9 { top: 0 !important; }
    html { scroll-behavior: auto !important; }
    .__tap { position: fixed; z-index: 2147483647; width: 46px; height: 46px; margin: -23px 0 0 -23px; border-radius: 50%;
      background: rgba(79,70,229,0.28); border: 3px solid rgba(79,70,229,0.85); pointer-events: none;
      animation: __tap 650ms ease-out forwards; }
    @keyframes __tap { 0% { transform: scale(0.4); opacity: 1 } 60% { transform: scale(1); opacity: 0.9 } 100% { transform: scale(1.5); opacity: 0 } }`,
})
await page.evaluate(() => document.documentElement.classList.remove('dark'))

// ── Helpers ──
const go = async (path) => {
  await page.evaluate((p) => {
    history.pushState({}, '', p)
    dispatchEvent(new PopStateEvent('popstate'))
  }, path)
  await sleep(700)
  await page.evaluate(() => scrollTo(0, 0))
  await sleep(200)
}

/**
 * Find a visible element: by aria-label or text (both "starts with") or CSS selector, optionally
 * inside the topmost dialog. Returns an ElementHandle or throws with a readable message.
 */
async function find(spec) {
  const h = await page.evaluateHandle((s) => {
    const root = s.dialog ? [...document.querySelectorAll('[role=dialog]')].at(-1) : document
    if (!root) return null
    const pool = [...root.querySelectorAll(s.css ?? 'button, a, [role=button], [role=radio], [role=switch], input, textarea')]
    const visible = (el) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
    }
    return (
      pool.find(
        (el) =>
          visible(el) &&
          (s.label ? (el.getAttribute('aria-label') ?? '').startsWith(s.label) : true) &&
          (s.text ? el.textContent.trim().replace(/\s+/g, ' ').startsWith(s.text) : true),
      ) ?? null
    )
  }, spec)
  const el = h.asElement()
  if (!el) throw new Error(`Not found: ${JSON.stringify(spec)}`)
  return el
}

/** Scroll an element to the middle of its scroller, smoothly. */
async function reveal(el, block = 'center') {
  await el.evaluate((e, b) => e.scrollIntoView({ behavior: 'smooth', block: b }), block)
  await sleep(650)
}

/** Show the tap ripple, then tap the element's center. */
async function tap(specOrEl, { pause = 550 } = {}) {
  const el = typeof specOrEl.boundingBox === 'function' ? specOrEl : await find(specOrEl)
  const inView = await el.evaluate((e) => {
    const r = e.getBoundingClientRect()
    return r.top >= 60 && r.bottom <= innerHeight - 80
  })
  if (!inView) await reveal(el)
  const box = await el.boundingBox()
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.evaluate(
    (px, py) => {
      const d = document.createElement('div')
      d.className = '__tap'
      d.style.left = `${px}px`
      d.style.top = `${py}px`
      document.body.appendChild(d)
      setTimeout(() => d.remove(), 700)
    },
    x,
    y,
  )
  await sleep(180)
  await page.touchscreen.tap(x, y)
  await sleep(pause)
}

/** Tap a field, then type into it like a person would. */
async function typeInto(spec, text, delay = 85) {
  await tap(spec, { pause: 250 })
  await page.keyboard.type(text, { delay })
  await sleep(350)
}

/** Smooth-scroll the page by dy CSS px. */
async function scrollPage(dy, ms = 1200) {
  await page.evaluate((d) => scrollBy({ top: d, behavior: 'smooth' }), dy)
  await sleep(ms)
}

async function scrollToHeading(text, offset = 80, ms = 1300) {
  await page.evaluate(
    (t, o) => {
      const h = [...document.querySelectorAll('h2, h3')].find((x) => x.textContent.trim() === t)
      if (h) scrollTo({ top: h.getBoundingClientRect().top + scrollY - o, behavior: 'smooth' })
    },
    text,
    offset,
  )
  await sleep(ms)
}

/** Pick a subcategory chip in Quick add, creating it with "+ Sub" if it's not offered yet. */
async function chooseSub(label) {
  const has = await page.evaluate(
    (l) => !![...document.querySelectorAll('[role=dialog] [aria-label="Subcategory"] button')].find((b) => b.textContent.trim() === l),
    label,
  )
  if (has) {
    await tap({ dialog: true, css: '[aria-label="Subcategory"] button', text: label })
  } else {
    await tap({ dialog: true, text: '+ Sub' }, { pause: 300 })
    await page.keyboard.type(label, { delay: 85 })
    await sleep(250)
    await page.keyboard.press('Enter')
    await sleep(500)
  }
}

// ── Recording ──
const manifest = { fps: FPS, width: 780, height: 1688, scenes: [] }
let frames = []
let sceneStart = 0
let cues = []
cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
  frames.push({ data, t: metadata.timestamp })
  await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
})

/** Caption cue at this moment of the current scene. */
const cue = (title, sub) => cues.push({ at: Date.now() / 1000 - sceneStart, title, sub })

async function scene(id, chapter, body) {
  frames = []
  cues = []
  await sleep(150)
  sceneStart = Date.now() / 1000
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 780, maxHeight: 1688, everyNthFrame: 1 })
  await body()
  const end = Date.now() / 1000
  await cdp.send('Page.stopScreencast')
  await sleep(200)

  // Screencast frames only arrive when something changes: hold each one until the next (constant 30 fps out)
  const dir = `${TMP}${id}/`
  mkdirSync(dir, { recursive: true })
  const lines = []
  frames.forEach((f, i) => {
    const file = `${dir}${String(i).padStart(5, '0')}.jpg`
    writeFileSync(file, Buffer.from(f.data, 'base64'))
    const from = i === 0 ? sceneStart : Math.max(f.t, sceneStart)
    const to = i + 1 < frames.length ? Math.max(frames[i + 1].t, sceneStart) : end
    lines.push(`file '${file.replace(/\\/g, '/')}'`, `duration ${Math.max(0.001, to - from).toFixed(4)}`)
  })
  lines.push(`file '${`${dir}${String(frames.length - 1).padStart(5, '0')}.jpg`.replace(/\\/g, '/')}'`)
  writeFileSync(`${dir}list.txt`, lines.join('\n'))
  execFileSync(
    FFMPEG,
    ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', `${dir}list.txt`, '-vf', 'scale=780:1688,format=yuv420p', '-r', String(FPS), '-fps_mode', 'cfr', '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', `${OUT}${id}.mp4`],
    { stdio: 'inherit' },
  )
  const seconds = end - sceneStart
  manifest.scenes.push({ id, chapter, file: `clips/${id}.mp4`, frames: Math.round(seconds * FPS), cues: cues.map((c) => ({ ...c, at: Math.round(c.at * FPS) })) })
  console.log(`recorded ${id}: ${seconds.toFixed(1)}s, ${frames.length} frames, ${cues.length} cues`)
}

// ── Setup (not recorded): a few Food entries with subcategories + tags, so Analysis has a breakdown.
// Dated a few days back, so today's allowance on Home stays on track ──
const daysAgo = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
for (const [amount, sub, note, ago] of [
  ['845', 'Groceries', 'Big C weekly shop #groceries', 6],
  ['560', 'Dinner', 'Shabu with friends #friends', 4],
  ['320', 'Groceries', 'Fresh market #groceries', 2],
]) {
  await page.evaluate(
    (a, n) => window.dispatchEvent(new CustomEvent('spendiary:open-quick-add', { detail: { draft: { amount: Number(a), note: n, categoryId: 'food' } } })),
    amount,
    note,
  )
  await sleep(600)
  await chooseSub(sub)
  // Set the date the way React notices
  await page.evaluate((v) => {
    const el = [...document.querySelectorAll('[role=dialog]')].at(-1).querySelector('input[type=date]')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }, daysAgo(ago))
  await sleep(200)
  await (await find({ dialog: true, css: '[data-modal-submit]' })).click()
  await sleep(900)
}
await go('/')
// Let the setup's "added" toasts time out so they don't open the tour
await sleep(6500)

// 1. Get around
await scene('tour', 'Get around', async () => {
  cue('This is your home', "Today's allowance, budget and bills")
  await sleep(2200)
  await scrollPage(420, 1600)
  cue('Bills and recent spending', 'Everything that matters today, at a glance')
  await scrollPage(520, 2200)
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'smooth' }))
  await sleep(1000)
  cue('Get anywhere in one tap', 'Home · Accounts · Quick add · History · More')
  await tap({ label: 'Transactions' }, { pause: 1300 })
  await tap({ label: 'More' }, { pause: 1700 })
  await tap({ dialog: true, label: 'Close modal' }, { pause: 500 })
})

// 2. Wallets and cards
await scene('accounts', 'Set up your accounts', async () => {
  await tap({ label: 'Accounts' }, { pause: 1000 })
  cue('Add the wallets you pay from', 'Bank accounts, e-wallets and cash')
  await tap({ text: '+Add wallet' }, { pause: 600 })
  await typeInto({ dialog: true, css: 'input[placeholder^="KBank"]' }, 'KBank Savings')
  await typeInto({ dialog: true, css: '#account-balance' }, '25000')
  await sleep(400)
  await tap({ dialog: true, text: 'Save' }, { pause: 1300 })
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'smooth' }))
  await sleep(700)
  cue('…and your credit cards', 'Limit, statement day and due day')
  await tap({ label: 'Add card' }, { pause: 600 })
  await typeInto({ dialog: true, css: 'input[placeholder="KBank Platinum"]' }, 'Krungsri Now')
  await typeInto({ dialog: true, css: 'input[placeholder="1234"]' }, '4821')
  await typeInto({ dialog: true, css: 'input[placeholder="100,000"]' }, '60000')
  await reveal(await find({ dialog: true, css: 'input[inputmode=numeric][maxlength="2"]' }))
  await sleep(900)
  await tap({ dialog: true, css: 'button[title]', label: 'Amber' }, { pause: 900 })
  await tap({ dialog: true, css: '[data-modal-submit]' }, { pause: 1600 })
})

// 3. Favorites and default
await scene('favorites', 'Favorites & default', async () => {
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'smooth' }))
  await sleep(500)
  cue('Star the ones you use most', 'Favorites become one-tap choices')
  await tap({ label: 'Favorite KBank Savings' }, { pause: 1200 })
  cue('Set a default', "It's picked for you every time you add an expense")
  await tap({ css: '[role=button]', label: 'KBank Savings' }, { pause: 900 })
  await tap({ dialog: true, css: '[role=switch]', text: 'Default' }, { pause: 1400 })
  await tap({ dialog: true, label: 'Close modal' }, { pause: 700 })
  await sleep(600)
})

// 4. Quick add: category, subcategory, tags
await scene('quickadd', 'Log a spend', async () => {
  await tap({ label: 'Home' }, { pause: 900 })
  cue('Tap + to log a spend', 'Your default wallet is already picked')
  await tap({ label: 'Quick add transaction' }, { pause: 900 })
  await reveal(await find({ dialog: true, text: 'KBank Savings' }))
  await sleep(1500)
  await reveal(await find({ dialog: true, css: 'input[placeholder="0"]' }))
  await typeInto({ dialog: true, css: 'input[placeholder="0"]' }, '120', 140)
  cue('Pick a category…', 'Then narrow it down with a subcategory')
  await tap({ dialog: true, text: 'Food' }, { pause: 700 })
  await chooseSub('Lunch')
  await sleep(500)
  cue('Add a note and #tags', 'Tags work across categories, so you can find it later')
  await typeInto({ dialog: true, css: 'input[placeholder^="Brown sugar"]' }, 'Khao man gai #worklunch', 75)
  await sleep(600)
  await tap({ dialog: true, css: '[data-modal-submit]' }, { pause: 1200 })
  cue('Saved', 'It shows up in your day right away')
  await page.evaluate(() => {
    const h = [...document.querySelectorAll('main *')].find((x) => x.children.length === 0 && x.textContent.trim() === 'Khao man gai')
    h?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
  await sleep(2200)
})

// 5. Analysis
await scene('analysis', 'Analysis', async () => {
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'smooth' }))
  await sleep(500)
  cue('See where your money goes', 'Spent, income and what you kept')
  await tap({ label: 'More' }, { pause: 800 })
  await tap({ dialog: true, text: 'Analysis' }, { pause: 2200 })
  cue('By category, then subcategory', 'Budgets per category, with the breakdown underneath')
  await scrollToHeading('By category', 80, 3000)
  cue('Top tags', 'What your #tags add up to')
  await scrollToHeading('Top tags', 120, 2800)
})

// 6. Invest
await scene('invest', 'Investments', async () => {
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'smooth' }))
  await sleep(700)
  cue('Switch to Invest', 'Your whole net worth, next to your spending')
  await tap({ css: '[role=radio]', text: 'Invest' }, { pause: 1800 })
  await scrollToHeading('Port Allocation', 80, 2400)
  cue('Stocks, funds, crypto and gold', 'Allocation, DCA plans, dividends and retirement')
  await scrollToHeading('Net Worth Performance', 80, 2600)
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'smooth' }))
  await sleep(900)
  await tap({ css: 'a[href="/portfolio"]' }, { pause: 2400 })
})

writeFileSync(`${OUT}manifest.json`, JSON.stringify(manifest, null, 2))
await browser.close()
rmSync(TMP, { recursive: true, force: true })
console.log('done →', OUT)

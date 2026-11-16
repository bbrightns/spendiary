/**
 * Cloud sync scenarios against a pretend Supabase (supabase-sim.mjs). Nothing here reaches the real database.
 *
 * Run (Playwright is not a project dependency; use one installed globally):
 *   VITE_API_URL=https://sim-project.supabase.co VITE_API_TOKEN=sim PORT=4173 npm run dev &
 *   node scripts/sim/cloud-sync.mjs            # every scenario
 *   node scripts/sim/cloud-sync.mjs retry lost # only the named ones
 */
import { createRequire } from 'node:module'
import { SupabaseSim, sessionEntry } from './supabase-sim.mjs'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const BASE = process.env.SIM_BASE ?? 'http://localhost:4173'
const base = { cashAccounts: [{ id: 'k', name: 'KBank', balance: 100 }], monthlyIncome: 0, holdings: [], dcaPlans: [], transfers: [], dividendRecords: [], liabilities: [], userName: 'Start', spendSettings: { fixedCostsImported: true }, dataSchema: 2 }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function until(what, check, ms = 20_000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (await check()) return
    await sleep(100)
  }
  throw new Error(`timed out waiting for: ${what}`)
}
const expect = (ok, what) => {
  if (!ok) throw new Error(`expected: ${what}`)
}

async function open(browser, sim) {
  const context = await browser.newContext()
  await sim.install(context)
  const { key, value } = sessionEntry()
  await context.addInitScript(([k, v]) => localStorage.setItem(k, v), [key, value])
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('   pageerror:', e.message))
  await page.goto(`${BASE}/settings`)
  await page.getByLabel('Your name').waitFor({ timeout: 20_000 })
  return { context, page }
}
const typeName = (page, name) => page.getByLabel('Your name').fill(name)
const conflictShown = (page) => page.getByText('Changed on another device').isVisible()
const committed = (sim) => sim.writes.filter((w) => w.committed)

const scenarios = {
  /** A save that fails (offline) is tried again by itself, without waiting for another edit */
  async retry(browser) {
    const sim = new SupabaseSim(base)
    sim.plan = ['fail']
    const { page } = await open(browser, sim)
    await typeName(page, 'Offline edit')
    await until('the failed save to be retried and stored', () => sim.row.payload.userName === 'Offline edit')
    expect(!(await conflictShown(page)), 'no conflict screen')
  },

  /** Back online: the unsaved change goes out at once, not at the end of a long back-off */
  async online(browser) {
    const sim = new SupabaseSim(base)
    sim.plan = ['fail', 'fail', 'fail', 'fail']
    const { page } = await open(browser, sim)
    await typeName(page, 'Tunnel')
    await until('a few failed tries', () => sim.writes.length >= 2, 30_000)
    sim.plan = []
    const before = Date.now()
    await page.evaluate(() => window.dispatchEvent(new Event('online')))
    await until('the save after coming back online', () => sim.row.payload.userName === 'Tunnel', 6_000)
    console.log(`   saved ${Date.now() - before} ms after "online"`)
  },

  /** The save arrived but its answer was lost: the next save must not report "Changed on another device" */
  async lost(browser) {
    const sim = new SupabaseSim(base)
    sim.plan = ['lost']
    const { page } = await open(browser, sim)
    await typeName(page, 'First')
    await until('the save whose answer is lost', () => sim.writes.length >= 1)
    await typeName(page, 'Second')
    await until('the later edit to be stored', () => sim.row.payload.userName === 'Second')
    expect(!(await conflictShown(page)), 'no conflict screen for our own save')
  },

  /** Same, with no further edit: the retry of the very same data finds it already there */
  async lostSame(browser) {
    const sim = new SupabaseSim(base)
    sim.plan = ['lost']
    const { page } = await open(browser, sim)
    await typeName(page, 'Only')
    await until('the save whose answer is lost', () => sim.writes.length >= 1)
    await sleep(12_000)
    expect(!(await conflictShown(page)), 'no conflict screen for our own save')
    expect(sim.row.payload.userName === 'Only', 'the data is stored')
    await typeName(page, 'After')
    await until('the next edit to be stored', () => sim.row.payload.userName === 'After')
  },

  /** Switching away from the app right after an edit saves it now instead of 2 seconds later */
  async hidden(browser) {
    const sim = new SupabaseSim(base)
    const { page } = await open(browser, sim)
    await typeName(page, 'Quick')
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await until('the save on hide', () => sim.row.payload.userName === 'Quick', 1_200)
    await sleep(3_000)
    expect(committed(sim).length === 1, `one save only, saw ${committed(sim).length}`)
  },

  /** Another device really saved: still a conflict, and nothing is overwritten */
  async conflict(browser) {
    const sim = new SupabaseSim(base)
    const { page } = await open(browser, sim)
    sim.writeElsewhere({ ...base, userName: 'Phone' })
    await typeName(page, 'Laptop')
    await until('the conflict screen', () => conflictShown(page))
    expect(sim.row.payload.userName === 'Phone', "the other device's data is untouched")
    await page.getByRole('button', { name: 'Load latest' }).click()
    await page.getByLabel('Your name').waitFor()
    expect((await page.getByLabel('Your name').inputValue()) === 'Phone', 'the latest data is shown')
    await typeName(page, 'Laptop again')
    await until('saving to work again', () => sim.row.payload.userName === 'Laptop again')
  },

  /** A real conflict while the last save's answer was also lost: still a conflict */
  async conflictAfterFail(browser) {
    const sim = new SupabaseSim(base)
    sim.plan = ['fail']
    const { page } = await open(browser, sim)
    await typeName(page, 'Laptop')
    await until('the failed save', () => sim.writes.length >= 1)
    sim.writeElsewhere({ ...base, userName: 'Phone' })
    await until('the conflict screen', () => conflictShown(page))
    expect(sim.row.payload.userName === 'Phone', "the other device's data is untouched")
  },

  /** A save still queued when "Load latest" is pressed must not bring the conflict screen back */
  async staleQueued(browser) {
    const sim = new SupabaseSim(base)
    const { page } = await open(browser, sim)
    sim.delay = 3_000
    sim.writeElsewhere({ ...base, userName: 'Phone' })
    await typeName(page, 'A')
    await sleep(2_600) // save 1 is now on its way
    await typeName(page, 'B') // save 2 queues behind it
    await until('the conflict screen', () => conflictShown(page))
    await sleep(600) // save 2 has left by now
    await page.getByRole('button', { name: 'Load latest' }).click()
    await page.getByLabel('Your name').waitFor()
    await sleep(4_500) // save 2's answer has come back
    expect(!(await conflictShown(page)), 'no second conflict screen after loading the latest')
    sim.delay = 0
    await typeName(page, 'C')
    await until('saving to work again', () => sim.row.payload.userName === 'C')
  },

  /** A load that fails never turns into "no data": nothing is written */
  async loadFails(browser) {
    const sim = new SupabaseSim(base)
    const context = await browser.newContext()
    await sim.install(context)
    await context.route('**/rest/v1/user_data**', (route) => (route.request().method() === 'GET' ? route.abort('internetdisconnected') : route.fallback()))
    const { key, value } = sessionEntry()
    await context.addInitScript(([k, v]) => localStorage.setItem(k, v), [key, value])
    const page = await context.newPage()
    await page.goto(`${BASE}/settings`)
    await page.getByText("Couldn't load your data").waitFor({ timeout: 20_000 })
    await sleep(4_000)
    expect(sim.writes.length === 0, 'no write after a failed load')
    expect(sim.row.payload.userName === 'Start', 'the row is untouched')
  },

  /** A row whose payload is not an object (e.g. JSON saved as text) is never treated as empty and saved over */
  async unreadable(browser) {
    const sim = new SupabaseSim(base)
    sim.row.payload = JSON.stringify(base)
    const context = await browser.newContext()
    await sim.install(context)
    const { key, value } = sessionEntry()
    await context.addInitScript(([k, v]) => localStorage.setItem(k, v), [key, value])
    const page = await context.newPage()
    await page.goto(`${BASE}/settings`)
    await page.getByText("Couldn't load your data").waitFor({ timeout: 20_000 })
    expect(sim.writes.length === 0, 'no write over an unreadable row')
  },
}

const only = process.argv.slice(2)
const browser = await chromium.launch()
let failed = 0
for (const [name, run] of Object.entries(scenarios)) {
  if (only.length && !only.includes(name)) continue
  try {
    await run(browser)
    console.log(`PASS ${name}`)
  } catch (err) {
    failed += 1
    console.log(`FAIL ${name}: ${err.message}`)
  }
}
await browser.close()
process.exit(failed ? 1 : 0)

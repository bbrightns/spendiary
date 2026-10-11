// Captures app screens for the promo video from the running dev server (npm run dev → :3000), in demo mode.
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'

const BASE = process.env.APP_URL ?? 'http://localhost:3000'
const OUT = fileURLToPath(new URL('./public/shots/', import.meta.url))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({ headless: true })
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true })

await page.goto(BASE, { waitUntil: 'networkidle0' })
await page.evaluate(() => localStorage.setItem('spendiary.theme', 'light'))
await page.reload({ waitUntil: 'networkidle0' })
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Explore Demo'))?.click())
await sleep(1500)

// Hide the test-mode banner (and the room kept for it) and toasts: noise in a promo
await page.addStyleTag({
  content: `aside[aria-label="Test Mode Environment Warning"], [role=status] { display: none !important; }
    #root > div.pt-9 { padding-top: 0 !important; }
    .top-9 { top: 0 !important; }`,
})
await page.evaluate(() => document.documentElement.classList.remove('dark'))

const go = async (path) => {
  await page.evaluate((p) => {
    history.pushState({}, '', p)
    dispatchEvent(new PopStateEvent('popstate'))
  }, path)
  await sleep(700)
  await page.evaluate(() => scrollTo(0, 0))
  await sleep(200)
}
const shot = async (name) => {
  await sleep(500)
  await page.screenshot({ path: `${OUT}${name}.png` })
  console.log('saved', name)
}
const closeDialogs = async () => {
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Escape')
    await sleep(250)
  }
}
/** Set a field's value the way React notices (in the top dialog if one is open). */
const setInput = (selector, value) =>
  page.evaluate(
    (sel, v) => {
      const root = [...document.querySelectorAll('[role=dialog]')].at(-1) ?? document
      const el = root.querySelector(sel)
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    },
    selector,
    value,
  )
const clickText = (text, scope = 'document') =>
  page.evaluate(
    (t, s) => {
      const root = s === 'dialog' ? [...document.querySelectorAll('[role=dialog]')].at(-1) : document
      ;[...root.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(t))?.click()
    },
    text,
    scope,
  )
const importCsv = async (csv, account, save) => {
  await go('/spend/txns')
  await clickText('Import')
  await sleep(500)
  await setInput('textarea', csv)
  await sleep(300)
  await clickText(account, 'dialog')
  await sleep(400)
  if (save) {
    await clickText('Import ', 'dialog')
    await sleep(900)
  }
}

// Some history for May–Aug so the 6-month trend has a shape (the demo data starts in August)
const history = ['Date,Description,Amount']
for (const [m, spend] of [
  ['2026-05', 18400],
  ['2026-06', 23900],
  ['2026-07', 16800],
  ['2026-08', 21200],
]) {
  history.push(`${m}-02,Salary payroll,110000`)
  history.push(`${m}-03,ค่าเช่าคอนโด,-9000`)
  history.push(`${m}-06,ค่าไฟ,-${1100 + (spend % 400)}`)
  history.push(`${m}-09,Team lunch,-${Math.round(spend * 0.12)}`)
  history.push(`${m}-12,Coffee,-${Math.round(spend * 0.05)}`)
  history.push(`${m}-15,Grab ride,-${Math.round(spend * 0.06)}`)
  history.push(`${m}-20,Shopping mall,-${Math.round(spend * 0.2)}`)
}
await importCsv(history.join('\n'), 'SCB Easy', true)

// 1. Spend home
await go('/spend')
await shot('home')

// 2. Quick add, filled in
await page.evaluate(() =>
  window.dispatchEvent(new CustomEvent('spendiary:open-quick-add', { detail: { draft: { amount: 65, note: 'Brown sugar milk tea #nosetea', categoryId: 'drinks' } } })),
)
await sleep(600)
await page.evaluate(() => document.activeElement?.blur())
await shot('quickadd')
await closeDialogs()

// 3. Command palette quick add
await page.evaluate(() => window.dispatchEvent(new CustomEvent('spendiary:open-command-palette')))
await sleep(400)
await page.type('[aria-label="Search commands"]', '65 coffee #morning', { delay: 10 })
await sleep(400)
await shot('palette')
await closeDialogs()

// 4. Accounts
await go('/spend/accounts')
await shot('accounts')

// 5. Pay bill
await clickText('Pay bill')
await sleep(600)
await page.evaluate(() => document.activeElement?.blur())
await shot('paybill')
await closeDialogs()

// 6. Savings goals: add two, then show the section
for (const g of [
  { name: 'Japan trip', target: '60000', saved: '27000', deadline: '2027-04-01' },
  { name: 'New laptop', target: '45000', saved: '31500', deadline: '2027-01-15' },
]) {
  await clickText('Add goal')
  await sleep(400)
  await setInput('input[placeholder="Japan trip"]', g.name)
  await setInput('input[placeholder="60,000"]', g.target)
  await setInput('input[type=date]', g.deadline)
  await sleep(150)
  await setInput('input[placeholder="0"]', g.saved)
  await sleep(150)
  await clickText('Add', 'dialog')
  await sleep(800)
}
await page.evaluate(() => {
  const h = [...document.querySelectorAll('h2')].find((x) => x.textContent === 'Savings goals')
  h?.scrollIntoView({ block: 'start' })
  scrollBy(0, -80)
})
await shot('goals')

// 7. Analysis: totals + the 6-month trends
await go('/spend/analysis')
await shot('analysis')
await page.evaluate(() => {
  const h = [...document.querySelectorAll('h2')].find((x) => x.textContent === 'Last 6 months')
  h?.scrollIntoView({ block: 'start' })
  scrollBy(0, -90)
})
await shot('trends')

// 8. Statement import (reviewed, not saved)
await importCsv(
  'Date,Description,Amount\n2026-10-01,Coffee at Starbucks,-145.00\n2026-10-02,Grab ride home,-89.50\n2026-10-03,Team lunch,-320.00\n2026-10-04,ฟรีแลนซ์ logo design,4500\n2026-10-05,ค่าไฟ October,-1240',
  'SCB Easy',
  false,
)
await page.evaluate(() => {
  document.activeElement?.blur()
  ;[...document.querySelectorAll('[role=dialog]')].at(-1)?.querySelector('ul')?.scrollIntoView({ block: 'center' })
})
await shot('import')
await closeDialogs()

// 9. Transactions list
await go('/spend/txns')
await shot('txns')

await browser.close()

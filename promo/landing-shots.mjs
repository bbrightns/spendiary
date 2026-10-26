// Captures the landing page screenshots from the running dev server (npm run dev → :3000), in demo mode.
// Writes WebP files to ../public/landing/. Re-run whenever the Spend overview or Portfolio UI changes.
import { mkdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'

const BASE = process.env.APP_URL ?? 'http://localhost:3000'
const OUT = fileURLToPath(new URL('../public/landing/', import.meta.url))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const SHOTS = [
  { name: 'spend-desktop', path: '/', viewport: { width: 1440, height: 900, deviceScaleFactor: 1 } },
  { name: 'spend-mobile', path: '/', viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
  { name: 'portfolio-mobile', path: '/portfolio', viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
]

mkdirSync(OUT, { recursive: true })
const browser = await puppeteer.launch({ headless: true })

for (const { name, path, viewport } of SHOTS) {
  // A fresh page per shot so desktop and mobile layouts never share state
  const page = await browser.newPage()
  await page.setViewport(viewport)
  await page.goto(BASE, { waitUntil: 'networkidle0' })
  await page.evaluate(() => localStorage.setItem('spendiary.theme', 'light'))
  await page.reload({ waitUntil: 'networkidle0' })
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Explore Demo'))?.click())
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

  const file = `${OUT}${name}.webp`
  await page.screenshot({ path: file, type: 'webp', quality: 80 })
  console.log(`saved ${name}.webp (${Math.round(statSync(file).size / 1024)} KB)`)
  await page.close()
}

await browser.close()

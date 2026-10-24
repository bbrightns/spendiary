#!/usr/bin/env node
/**
 * Design guardrails (DESIGN.md). Fails CI when a change brings back what the design
 * clean-up removed: emoji in the UI (.tsx; the Markdown export in lib/ may use them),
 * hex colours or raw Tailwind palette colours in components, text-brand (unreadable in
 * dark), animation classes that don't exist, hand-rolled full-screen overlays and the
 * old "success" button variant.
 *
 *   npm run lint:design
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const SRC = join(ROOT, 'src')

/** Files allowed to use raw palette colours and hex values, and why */
const COLOUR_ALLOW = [
  'src/components/tones.ts', // every pastel set lives here, written out so Tailwind sees it
  'src/components/layout/TestModeBanner.tsx', // bright amber in both themes on purpose
  'src/app/Sidebar.tsx', // the TEST badge next to the logo, same reason
  'src/App.tsx', // landing page
  'src/components/ui/AssetLogo.tsx', // bank and fund brand colours
]
/** Single hex values allowed anywhere: third-party brand marks */
const HEX_ALLOW = ['#1877F2'] // Facebook

/** Full-screen layers outside the shared Modal / Popover */
const OVERLAY_ALLOW = ['src/app/CommandPalette.tsx', 'src/components/guide/GuideTour.tsx', 'src/App.tsx']

/** Tailwind's own animations; the app's own come from index.css (--animate-* tokens and .animate-* classes) */
const BUILTIN_ANIMATIONS = ['none', 'spin', 'ping', 'pulse', 'bounce']

const PALETTE =
  /(?<![\w-])(?:[a-z-]+:)*(?:bg|text|border|ring|from|to|via|stroke|fill|shadow|outline|divide|accent|decoration|caret|placeholder)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}(?![\w-])/g
const HEX_CLASS = /(?<![\w-])(?:[a-z-]+:)*[a-z-]+-\[(#[0-9a-fA-F]{3,8})\]/g
const EMOJI = /\p{Extended_Pictographic}/u
/** Pictographic by Unicode, but plain typography in the UI */
const NOT_EMOJI = new Set(['©', '®', '™', '↔', '↕', '↩', '↪', '▶', '◀', '⌘', '⌨', '⏎', '✓', '✔', '✕', '✖', '★', '☆', '•'])
const ANIMATE = /(?<![\w-])(?:[a-z-]+:)*animate-([a-zA-Z][\w-]*)/g

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(tsx?|css)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p)
  }
  return out
}

/** Blank out comments, keeping line numbers, so rules only see code and copy */
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (m, pre) => pre + ' '.repeat(m.length - pre.length))
}

const css = readFileSync(join(SRC, 'index.css'), 'utf8')
const animations = new Set([
  ...BUILTIN_ANIMATIONS,
  ...[...css.matchAll(/--animate-([\w-]+):/g)].map((m) => m[1]),
  ...[...css.matchAll(/^\s*\.animate-([\w-]+)\s*\{/gm)].map((m) => m[1]),
])

const problems = []
for (const file of walk(SRC)) {
  const rel = relative(ROOT, file).split(sep).join('/')
  if (rel.endsWith('.css')) continue
  const lines = stripComments(readFileSync(file, 'utf8')).split('\n')
  const colourOk = COLOUR_ALLOW.includes(rel)
  lines.forEach((line, i) => {
    const at = `${rel}:${i + 1}`
    for (const ch of rel.endsWith('.tsx') ? line : '') {
      if (EMOJI.test(ch) && !NOT_EMOJI.has(ch)) {
        problems.push(`${at}  emoji "${ch}": use an icon from components/icons.tsx (DESIGN.md §7)`)
        break
      }
    }
    for (const m of line.matchAll(HEX_CLASS)) {
      if (colourOk || HEX_ALLOW.includes(m[1])) continue
      problems.push(`${at}  hex colour "${m[0]}": add a token in src/index.css (DESIGN.md §3)`)
    }
    if (!colourOk) {
      for (const m of line.matchAll(PALETTE)) {
        problems.push(`${at}  raw palette colour "${m[0]}": use a token (gain, loss, warn, brand, ink, …) or a set from tones.ts (DESIGN.md §3)`)
      }
    }
    for (const m of line.matchAll(ANIMATE)) {
      if (!animations.has(m[1])) problems.push(`${at}  "${m[0]}" is not a defined animation: use a token or class defined in src/index.css (DESIGN.md §5)`)
    }
    if (/\bfixed inset-0\b/.test(line) && !rel.startsWith('src/components/ui/') && !OVERLAY_ALLOW.includes(rel)) {
      problems.push(`${at}  "fixed inset-0" overlay: use Modal, ConfirmModal or Popover (DESIGN.md §6.6)`)
    }
    if (/(?<![\w-])(?:[a-z-]+:)*text-brand(?![\w-])/.test(line)) {
      problems.push(`${at}  "text-brand": brand text uses text-link, which stays readable in dark mode (DESIGN.md §3)`)
    }
    if (/variant=["']success["']/.test(line)) {
      problems.push(`${at}  variant="success": save buttons use primary (DESIGN.md §6.1)`)
    }
  })
}

if (problems.length) {
  console.error(problems.join('\n'))
  console.error(`\nlint:design: ${problems.length} problem${problems.length === 1 ? '' : 's'}. See DESIGN.md.`)
  process.exit(1)
}
console.log('lint:design: no problems')

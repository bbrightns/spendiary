# Design consistency plan

Brings the whole app in line with `DESIGN.md` (rewritten in `ee8d1bf`). The decisions behind it:

- **The code wins** over the old spec.
- **Light theme first.**
- **Spend is the reference** when Spend and Invest differ.
- **One modal design, one card design.**
- **No emoji.**

Work goes in phases. Each phase is one branch and PR, small enough to review, and each leaves the app shippable. Phases 0–2 change the most pixels, so ship them as one **minor** version (a UI/UX overhaul, per `AGENTS.md`); later phases are **patch** releases.

Every phase finishes with the same checks:
1. `npm run build`, `npm run lint`, `npm test`.
2. Screenshots of every touched screen in **light, then dark**, at **390px and 1440px**. Use the Playwright demo-mode script: log in through "Explore Demo / Offline Mode" and navigate client-side, because a reload drops the demo session.
3. No change to saved data (`user_data.payload`) and no SQL. Everything here is UI only.

---

## Phase 0: Foundations (shared pieces; little visible change) [done]
Shipped in `c776ee8`, `41bedca`, `82682c9`, `7a0b07d`, `0df243d` and `94f3469`.
- 5.2 (guide tour box) and 5.3 (toast "Undo" uses primary) were pulled forward into 0.1.
- Found and fixed along the way:
  - `bg-ink text-white` with no dark override turned unreadable in dark (the skip link, plus Retirement, Cash and Settings toggles).
  - Dashboard "Pay term" hovered to lavender behind white text.
  - Escape in a picker opened inside a modal could close both.
- The no-footer modal now clears the iPhone home indicator.
- Pickers open on the selected option (`data-autofocus`).
Each later phase uses these, so they go first.

| # | Change | Files |
|---|---|---|
| 0.1 | Add `--color-primary` and `--color-primary-hover` tokens (ink / ink-hover in light; `#4f46e5` / `#4338ca` in dark). Swap every `dark:bg-[#4f46e5]`, `dark:hover:bg-[#4338ca]`, `dark:text-[#c7d2fe]` and `dark:border-[#4f46e5]` for tokens. | `src/index.css`, `Button`, `FilterChip`, `DropdownChip`, `Toast`, `ResultOverlay`, `DataCard`, `PageHeader`, `GuideTour`, `CommandPalette`, `RecurringDue`, `TodayStack`, `SpendBottomNav`, `SpendOverview`, `DcaPlanner`, `Portfolio`, `Rebalance` |
| 0.2 | Make the missing animations real: add `--animate-fade-in`, `--animate-sheet-up` and `--animate-pop-in` to `@theme`, then replace the dead `animate-fadeIn`, `animate-sheetUp` and `animate-in fade-in zoom-in-95` classes. | `src/index.css`, `Popover`, `Field` (error text), `CommandPalette`, `HoldingMenus` |
| 0.3 | `Card`: add a `compact` prop (`p-4`), and add `CardHeader` (title plus an optional link or button) and `Inset` (`rounded-2xl bg-surface-muted p-4`). | `src/components/ui/Card.tsx` |
| 0.4 | `Modal`: move the sheet shell (backdrop, panel, header, ✕) into one internal piece that `Popover` can reuse on phones. Remove the unused `xl` size. | `Modal.tsx`, `Popover.tsx` |
| 0.5 | `FormActions`: add a `submitLabel` prop ("Pay ฿1,200", "Log buy"), and an optional `hint` shown when the button is disabled. | `src/components/forms/FormActions.tsx` |
| 0.6 | `Field`: export the field and label classes, so the 5 copied `inputClass` strings can import them. | `Field.tsx`, `AccountSheets`, `RecurringSheet`, `LoanSheet`, `Goals`, `SpendSettings` |

**Done when:** no `[#` hex values remain in a `className` (outside the landing page), every `animate-*` class resolves, and the screenshots look the same as before. Dialogs and dropdowns now animate in.

---

## Phase 1: One modal design (the top ask) [done]
Done on branch `ccr-46167c22-mu2vvk` after v1.34.0.
- Every footer is pattern A, B or C, and every overlay is a `Modal`, `ConfirmModal` or `Popover` (plus the palette shell).
- Disabled save buttons explain themselves.
- Deleting from inside the cash-account form no longer opens a second dialog.
- Fixed along the way: the restore dialog said every backup file held "no records", because it didn't read the `{ schemaVersion, data }` wrapper.

### 1.1 Footers: down to the three patterns
DESIGN.md §6.6 allows three footers: A = Form, B = Action, C = Confirm.

| Modal | Now | Becomes |
|---|---|---|
| `BuyMoreForm` (stock, gold, BTC) | Green `success` button, context after a dash in the title | **B**, primary "Add to holding". The location moves into the description. Then delete the `success` variant from `Button`. |
| `ConfirmDividendModal` | Ghost Cancel + hard-coded emerald Confirm | **B**, primary "Record ฿X dividend" |
| `EditCashAccountModal` | Red text Delete + Cancel + Save; its own label and field styles | **A** (`FormActions`), and the shared `Field` classes |
| `PlannedAssetModal` | Split Cancel / Add | **B**, "Add target asset" |
| `AiImportModal` | Cancel + Import | **B**, "Import 12 items" |
| `HoldingLogs` edit | A copy of the `FormActions` delete logic + Cancel + Save | **A** (`FormActions`) |
| `ReorderSheet` | Small Reset + small Done | **B** "Done"; Reset becomes a text link in the body |
| Settings "Replace your current data?" | A hand-built three-button stack | **C** (`ConfirmModal`); "Export current data first" becomes a secondary button in the body |
| `HoldingForm` (BTC / gold add) | Plain buttons without `data-modal-submit` | **A**, so Enter submits |
| Portfolio "Edit location" | Plain "Save changes" button | **B** with `data-modal-submit` |
| `PayBillSheet` when nothing is owed | A secondary "Close" button | No footer; the body says why |

### 1.2 Titles and labels: sentence case, context in the description
- "Add Target Asset" → "Add target asset"
- "Remove Dividend Record" → "Remove dividend record?" ("Remove Record" → "Remove record")
- "Buy more — Vault A" → "Buy more", with the description "Goes into Vault A". The BTC and gold versions follow the same pattern.
- "Sell · AAPL — Vault A" → "Sell AAPL", with the location in the description
- "Log buy: AAPL" and "Log deposit: KBank" → "Log buy" and "Log deposit", with the name in the description
- "Import with AI (Excel / JSON)" → "Import with AI"
- "✓ Log ฿5,000 buy" → "Log ฿5,000 buy" (drop the ✓ character)

### 1.3 Disabled buttons explain themselves
Each disabled "Add" needs a reason in the body. For example, Quick add shows "Enter an amount" while the amount is 0. Check every caller of `FormActions` that passes `canSave`.

### 1.4 Pickers, menus and the command palette
- **`Popover` on phones** uses the shared sheet shell from 0.4: the same header as `Modal`, no grab handle, no small uppercase title.
- **`HoldingMenus` (holding and location "⋯")** become `Popover` lists:
  - They become a bottom sheet on phones.
  - The green and red item colours become neutral; icons carry the meaning.
  - This clears the 42 raw palette colours in that file.
- **Keyboard shortcuts** become a normal `Modal` (`sm`).
- **Command palette:**
  - Keeps its top position.
  - Takes the modal radius (28px), backdrop and animation.
  - Entries move to sentence case ("Add transaction", "Record new holding", "Transfer or pay a card").
  - Fix the layering so the TEST MODE banner dims behind it.

**Done when:** every overlay in the app is a `Modal`, `ConfirmModal` or `Popover` (`grep 'fixed inset-0'` outside `components/ui` finds only the palette and the guide tour); every footer is pattern A, B or C; and Enter submits every form.

---

## Phase 2: One card design (Invest moves to Spend's style) [done]
- **Dashboard:**
  - The net worth card, Allocation, Cash and Debts are plain cards with `CardHeader` and `Inset`.
  - Cash accounts and loans are divided rows, which fixed the overflowing chips.
- **Invest's "to do" lines** use Spend Home's attention cards.
- **One title style** for every card.
- **Padding:** `compact` and `list` replace the per-page padding.
- **Inner panels:** 33 bordered inner boxes are now borderless insets.
- **Hover:** only clickable cards lift.

| # | Change | Where |
|---|---|---|
| 2.1 | **Card headers:** use `CardHeader` (title + link). Drop the icon tile before titles. "Port Allocation" becomes "Allocation", "Cash & Liquidity Hub" becomes "Cash". | `Dashboard`, `Portfolio`, `CashLiquidity`, `Dividends`, `Rebalance`, `DcaPlanner`, `Retirement`, `InteractiveTrendChart`, `InteractiveNetWorthChart` |
| 2.2 | **No cards inside cards:** the "Portfolio value / All-time PnL" box and the "Available cash" box become `Inset`. Debt rows and the cash tiles become Spend list rows (DESIGN.md §6.3). This also **fixes the overflowing yield chips** on the Dashboard cash card. | `Dashboard.tsx` |
| 2.3 | **Padding:** remove the `p-3 sm:p-5`, `p-3.5 sm:p-5`, `p-4 sm:p-6`, `p-3 sm:p-4` and `px-4 sm:px-5` overrides. Stat tiles use `compact`; everything else uses the default. | `Dividends`, `Rebalance`, `SpendAnalysis`, `SpendLoans`, `SpendRecurring`, `SpendTransactions`, `CashLiquidity` |
| 2.4 | **Hand-built boxes** (about 22 radius/shadow combinations) become `Card`, `Inset` or a list row. | `SellHoldingModal`, `Portfolio`, `Rebalance`, `DcaPlanner`, `Settings`, `Retirement`, `HoldingForm`, `DividendSection`, `PlannedAssetModal`, `DcaForm`, `SpendAccounts:252`, `CardStack:145` |
| 2.5 | **No tinted cards:** the Dashboard hero gradient and the Dividends emerald gradient become plain `Card`s, like Spend's "Today". | `Dashboard:149`, `Dividends:169` |
| 2.6 | **One attention pattern:** Invest Overview's grey "3 DCA buys to log / 3 payments due" rows use the `TodayStack` card style, so it matches Spend Home. | `TodayStack.tsx` (Invest variant), `Dashboard` |
| 2.7 | **Hover lift only on cards that are links or buttons**, applied the same everywhere. | `Goals`, `SpendSnapshotCard`, `SpendOverview`, the Dashboard link cards |

**Done when:** `grep` finds no `bg-surface … border … rounded` boxes outside `Card` and `Inset`; no `<Card className="p-…">` overrides remain; and the Dashboard at 1440px has no clipped or overlapping chips.

---

## Phase 3: No emoji [done]
- **Removed:** every emoji in the interface. Log action badges, the cash-category dots and section headers now use lucide icons.
- **Kept on purpose:**
  - the Markdown export
  - two code comments that mention emoji
  - typographic marks (→ ↗ ↵ ▲▼↕)
- **Left for Phase 4:** the Cash table still sets money in a mono font.
About 70 emoji in UI files. The Markdown export (`portfolioMarkdown.ts`) is out of scope (DESIGN.md §7), and the Thai code comments in `App.tsx` lose their 💡 too.

| File | What |
|---|---|
| `pages/holdingLogs/logMeta.ts`, `logDetails.tsx` | Log-type icons (`💰 🎁 🏷️ ✎` and about 22 more) become lucide icons. `logMeta` returns an icon component instead of a string. |
| `lib/calc.ts` | Status `icon: '🟢' / '🔒'` becomes an icon key. The labels "Fully paid 🎉" and "Paid this month ✅" drop the emoji. No tests depend on these strings. |
| `pages/Dashboard.tsx` | `📉` Debt ratio, `⏳` runway and `🎉` paid off / 100% solvency become lucide icons or plain text. |
| `components/forms/HoldingForm.tsx`, `AcquisitionSourceField`, `holdingForm/DividendSection.tsx` | `📦 General info`, `🎁 Gift`, `💰 💵 📅 ⚡ 👆` become lucide icons |
| `SellHoldingModal`, `DcaForm`, `DcaPlanner`, `Retirement`, `Portfolio`, `Dividends`, `CashLiquidity`, `Settings`, `Goals`, `QuickAddSheet`, `ImportSheet`, `SpendAccounts` | One or two each (`💡 ⚠ ⏳ 🪙 💵 📈 📅 🎉 🍜 ★`) |
| `DropdownChip`, `HoldingLogs` | A `✕` text character becomes `CloseIcon` |

**Done when:** a scan of `src/**/*.tsx` and the non-export `src/lib/*.ts` files finds no emoji.

---

## Phase 4: Page structure and type [done]
- **One name per page, sentence case**, in the nav, the page title and the palette.
- **Labels:** about 120 Title Case labels, plus the shared asset, debt and filter labels, are sentence case.
- **No all-caps labels** inside cards.
- **Spend Home** uses `PageHeader`.
- **Links:** one text-link style.
- **Date quick-picks** use the chip style.
- **Money** is set in tabular figures.
| # | Change |
|---|---|
| 4.1 | `PageHeader` on Spend Home (date as eyebrow, greeting as title) and on the Spend settings sections. |
| 4.2 | **Uppercase labels inside cards become sentence case** ("TOTAL NET WORTH" → "Total net worth"). Files: `logDetails` (14), `Rebalance` (7), `Dashboard` (7), `HoldingForm` (4), `ActivitySummary` (3), `Portfolio`, `HoldingLogs`, `DcaPlanner`, `Dividends`, `CashLiquidity`, `MoveLocationModal`, `DcaForm`, `AiImportModal`. Page eyebrows and sidebar group labels stay uppercase. |
| 4.3 | **Headings:** use the table in DESIGN.md §4. Card titles become `text-lg font-extrabold`, which cuts the 11 `h2` variants down to the listed roles. |
| 4.4 | **Text links:** `text-sm font-semibold text-brand hover:underline`, naming the destination. "Rebalance Portfolio →" becomes "Rebalance →". |
| 4.5 | **Remaining Title Case becomes sentence case:** chart titles, the "Page Guide" tooltip, "Copy Portfolio as Markdown", "Exchange Rate USD to THB", "Copy Action Plan as Text". Decide separately whether page names in the nav also move ("Activity Logs" → "Activity logs"). |
| 4.6 | **Quick-pick date chips** (Today / Yesterday) use the filter-chip style. |

---

## Phase 5: Colour and dark-mode cleanup [done]
Done: status colours use `gain` / `loss` / `warn` / `brand` tokens; three new tokens for fills that need white text in both themes (`danger`, `gain-strong`) and for the Spend side (`spend`, `spend-ink`, `spend-soft`). Spend's shared pastels (status chips, Today stack, #tags, spent bars) and Invest's categorical badges (`TINT`: debt types, log kinds) live in `tones.ts`. The DCA mint pills became `gain-strong`, matching "Mark received". `TestModeBanner` and the sidebar TEST badge keep their bright amber on purpose: the test-mode warning must look the same in both themes, which `warn` (amber-600 / amber-400) does not.
| # | Change |
|---|---|
| 5.1 | **Raw palette colours become tokens:** `Dashboard` (43), `Dividends` (25), `AiImportModal` (25), `SellHoldingModal` (22), `DividendSection` (20), `SpendAnalysis` (16), `TestModeBanner` (15, which becomes `warn`), `NoteField` (14), `Portfolio`, `CashLiquidity`, `SpendOverview`, `TodayStack`, `SpendSnapshotCard` and others. `tones.ts` and the side accent stay as they are. |
| 5.2 | **Guide tour box:** `dark:bg-[#1c1f26]` becomes `bg-surface`. |
| 5.3 | **Toast "Undo"** uses the primary pill (ink), not brand blue. |
| 5.4 | **Landing headline** stays blue in dark mode (use `landing-*` or `invest` tokens, not `brand`). |
| 5.5 | **Confetti for milestones only:** keep it for a loan paid off and a goal reached; remove `celebrate` from add holding, add DCA plan, buy more (×4), record dividend, log DCA buy and sell. The result popup stays. |

---

## Phase 6: Guardrails (so the next agent can't undo this) [done]
Done: `scripts/lint-design.mjs` runs as `npm run lint:design` and in CI after `lint`. Beyond the list below it also fails on raw Tailwind palette colours outside `tones.ts` and the allowlisted files, and reads defined animations from `src/index.css` rather than a fixed list. Emoji are checked in `.tsx` only (the portfolio Markdown export keeps its emoji).

- **Add `npm run lint:design`** (a small Node script in `scripts/`) and run it in CI after `lint`. It fails on:
  - emoji in `src/**/*.tsx`
  - `[#` hex values in a `className` (landing page allowlisted)
  - `dark:bg-[#`
  - undefined animation classes (`animate-in`, `animate-fadeIn`, `animate-sheetUp`)
  - `fixed inset-0` outside `src/components/ui` (palette and guide tour allowlisted)
  - `variant="success"`
- **Add one line to `AGENTS.md`:** "Read `DESIGN.md` before any UI change; reuse the components it names." This is a rules change, so it needs your OK.

---

## Order and size
| Phase | Size | Ships as |
|---|---|---|
| 0 Foundations | S–M | Part of the minor release |
| 1 Modals | L | Part of the minor release |
| 2 Cards | L | Part of the minor release |
| 3 Emoji | M | Patch |
| 4 Page and type | M | Patch |
| 5 Colour cleanup | M | Patch |
| 6 Guardrails | S | Patch |

## Decisions
1. **Confetti (5.5):** milestones only: a loan paid off and a goal reached.
2. **Page names in the nav (4.5):** sentence case too ("Activity logs", "Cash and liquidity"). One rule, no exceptions.
3. **Dashboard hero (2.5):** fully plain `Card`, like Spend's Today card.

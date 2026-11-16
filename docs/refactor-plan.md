# Refactor plan: HoldingForm, Portfolio, Rebalance, calc

Written 2026-11-17 against `main` at `240bfe8` (v1.49.8) plus the overnight branch. A plan only: no code was changed
for it. It sits beside `docs/architecture-refactor.md` (phases C and D there) and narrows it to four files.

Sizes today: `HoldingForm.tsx` 1,556 lines, `Portfolio.tsx` 1,471, `Rebalance.tsx` 1,295, `calc.ts` 1,425
(`calc.test.ts` 478), and `Retirement.tsx` 894 with its math inside the page.

House rules that shape every step:

- A `.tsx` file exports only components. Helpers, constants and hooks go in a sibling `.ts` file.
- Names other files import do not change. Move the code, then re-export from the old place for one release.
- Tests first: a step that moves logic starts by pinning today's behaviour in Vitest, including the odd cases.
- One step is one pull request, small enough to review in one sitting, with the visual check for any `.tsx` it touches.

## Why these four

The same shape repeats: money math lives inside a component, so it cannot be unit-tested, so bugs in it are found
by eye. This run's examples: rebalance targets compared with `=== 100` on a float sum, the Coast FI discount rate and
the lump-sum goal in `Retirement.tsx`, and the Rebalance buy form receiving a holding whose units were already
reduced for "exclude safe haven". Each needed a helper pulled out before a test could exist. The plan is that
extraction, done on purpose and in order.

## 1. `src/lib/calc.ts`

**Responsibilities today (8 unrelated ones):** holding metrics and allocations; asset colours and labels; gold and
bitcoin unit conversion; DCA schedule (buy days, executions, next date); transfers; cash accounts (categories, bank
presets, sorting, interest, liquidity); debts (categories, due status, paid this month); net worth; dividends.

**Proposed split** (`calc.ts` stays as a barrel that re-exports everything, so no import changes):

| New file | Takes | Lines (about) |
|---|---|---|
| `lib/calc/holdings.ts` | `hasRealPrice`, `priceGap`, `applyBuy`, `holdingMetrics`, `portfolioValue`, `portfolioCost`, `allocations`, `assetGroupAllocations`, `holdingAllocations`, `portfolioSummary`, `findMatchingHolding` | 330 |
| `lib/calc/units.ts` | gold and BTC conversions and constants | 80 |
| `lib/calc/dca.ts` | everything from `planMonthlyEquivalent` to `sortDcaPlans` | 300 |
| `lib/calc/cash.ts` | categories, bank presets, `sortCashAccounts`, `totalCash`, interest, liquidity | 250 |
| `lib/calc/debts.ts` | `DEBT_CATEGORIES`, `totalLiabilities`, due status, paid this month | 290 |
| `lib/calc/dividends.ts` | `isDividendReceivedThisMonth`, `nextPayoutMonth`, DPS helpers | 60 |
| `lib/calc/meta.ts` | `ASSET_META`, colours | 110 |

**Risks:** circular imports (`locations.ts` and `legacyLocations.ts` import `SATS_PER_BTC` from `calc`; `units.ts`
must import nothing from the rest); the duplicate `upsert` in `calc.ts` and `store/dataHelpers.ts` (keep one, re-export).

**Tests needed first:** `calc.test.ts` already covers 19 groups. Missing before the move: `assetGroupAllocations`,
`sortCashAccounts`, `isLiabilityPaidThisMonth` / `isLiabilityFirstDueNextMonth` at month ends, `getHoldingAnnualDividend`.

## 2. `src/pages/Rebalance.tsx`

**Responsibilities today:** target state (class and holding), persistence when the sum is 100, the active-holdings
filter for locked wallets, actual / target / diff rows for two modes, smart cash allocation, donut data, the
Markdown plan, three modals, and two full layouts (phone cards and desktop table) for each mode.

**Proposed split:**

| New file | Takes |
|---|---|
| `pages/rebalance/plan.ts` | Pure: `activeHoldings(holdings, excludeSafeHaven)`, `classRows(...)`, `holdingRows(...)`, `smartAllocate(rows, cash)`, `planMarkdown(...)`. Joins the existing `rebalanceTargets.ts` |
| `pages/rebalance/useRebalanceTargets.ts` | Local target state, "save when it adds up", fill remaining, and dropping targets of holdings that no longer exist |
| `pages/rebalance/ClassTable.tsx`, `HoldingTable.tsx` | The two tables, each with its phone and desktop layout |
| `pages/Rebalance.tsx` | Page shell, KPI cards, setup card, modals |

**Risks:** the rows are mutated in place by smart rebalance today (`row.actionLabel = …`); the pure version must
return new rows and the table must read the same labels. Local targets are initialised once per mount, so a holding
added while the page is open has no target and a removed one keeps a ghost share of the 100%: decide the rule
before moving it. "Exclude safe haven" with holding targets (Needs decision 12 in the overnight report) should be
decided first, since `holdingRows` encodes it.

**Tests needed first:** rows for both modes with and without new cash; smart allocation sums to the cash put in;
locked wallet and locked holding excluded; the 5-baht "Balanced" band; targets that do not add up give no actions.

## 3. `src/components/forms/HoldingForm.tsx`

**Responsibilities today:** one form component holding four different forms (fund, US stock, bitcoin, gold) in
25 `useState`s; linked fields (shares × cost × rate ↔ baht invested) with blur-time formatting; ticker search
and live validation; paying from a cash account in THB or USD; three save functions (`saveBtc`, `saveGold`, `save`)
that each build a holding, a log entry and a payment.

**Proposed split:**

| New file | Takes |
|---|---|
| `forms/holdingForm/build.ts` | Pure: `buildFundHolding`, `buildStockHolding`, `buildBtcHolding`, `buildGoldHolding`: form values in, `{ holding, log, payment }` out. This is where the money math is |
| `forms/holdingForm/linkedFields.ts` | Pure: the shares / cost / rate / baht recalculation, as one reducer |
| `forms/holdingForm/useTickerCheck.ts` | Search suggestions and the live ticker check |
| `forms/holdingForm/BtcFields.tsx`, `GoldFields.tsx`, `StockFields.tsx`, `FundFields.tsx` | The four field groups |
| `forms/HoldingForm.tsx` | Chooses the group, owns open / close, calls `build*` and the store |

`BuyMoreForm.tsx` repeats the same four branches; once `build.ts` exists it should use the same builders
(`buyInto` already does the merge).

**Risks:** highest of the four. The save paths write cost basis, USD cost and the undo delta; a slip is silent and
permanent in the user's data. Editing versus adding share code with different rules (`placeholderPrice`, keeping
locations). The linked fields depend on which field was edited last (`isThbInvestedManuallyEdited`).

**Tests needed first:** one golden test per asset class for add, add paid from THB, add paid from USD (cost at the
wallet's rate), add as a gift, and edit; each asserts the holding, the log's delta and the cash move. Then undo of
each returns the starting data (the round trip this run found broken for USD wallets).

## 4. `src/pages/Portfolio.tsx`

**Responsibilities today:** filters, sort and search; list and group views; the donut; CSV and Markdown export;
eleven modals, sheets and menus and their open / close state (45 `useState`s in all); a location editor form (14 `useState`s) written inline; the
"set a location for the whole holding" form; the daily portfolio snapshot; the row renderer (`renderHoldingRow`, a
function about 280 lines long).

**Proposed split:**

| New file | Takes |
|---|---|
| `pages/portfolio/view.ts` | Pure: filter, search normalising, sort, grouping |
| `pages/portfolio/LocationEditModal.tsx` + `locationEdit.ts` | The inline location editor and its value → `HoldingLocation` maths |
| `pages/portfolio/HoldingRow.tsx` | `renderHoldingRow` as a component |
| `pages/portfolio/usePortfolioModals.ts` | Which modal is open and for which holding |
| `pages/Portfolio.tsx` | Page shell, toolbar, donut, list |

**Risks:** `renderHoldingRow` closes over about twenty values; turning it into a component with that many props
invites stale-prop bugs, so move the modal state into the hook first. The snapshot effect writes to the cloud on
every price change (Needs decision 2 in the overnight report): do not move it without deciding that.

**Tests needed first:** `view.ts` (sort by value / P&L / type in both directions, search across Thai and English,
group totals); `locationEdit.ts` (sats, grams and gold baht in, quantity and cost out, totals follow the locations).

## 5. Steps, ranked by value over risk

| # | Step | Value | Risk | Needs first |
|---|------|-------|------|-------------|
| 1 | Move the Retirement math (`compoundGrow…`, `calculateCorpusNeeded`, the solvers, Coast FI) to `pages/retirementMath.ts` with tests | High: pins two open modelling questions | Low: pure functions, no behaviour change | Nothing |
| 2 | `pages/rebalance/plan.ts`: rows and smart allocation as pure functions, with tests | High: the page's whole purpose becomes testable | Low to medium | Decision 12 |
| 3 | Split `calc.ts` into `lib/calc/*` behind the barrel | Medium: easier to find and test; no behaviour change | Low | The four missing test groups |
| 4 | `pages/portfolio/view.ts` + `locationEdit.ts` with tests | Medium | Low | Nothing |
| 5 | `forms/holdingForm/build.ts`: the four builders, with golden tests written against the current form first | High: the riskiest money path gets tests | Medium to high | Step 3 (uses `units.ts`) |
| 6 | `useRebalanceTargets.ts` and the two table components | Medium | Medium | Step 2 |
| 7 | `LocationEditModal`, `HoldingRow`, `usePortfolioModals` | Medium | Medium | Step 4 |
| 8 | Split `HoldingForm` into four field groups; point `BuyMoreForm` at the shared builders | High | High | Step 5 and its golden tests green for a release |

Steps 1 to 4 change no behaviour and can ship one a day. Steps 5 and 8 touch what gets written to the user's data:
ship each alone, with a backup export taken first, and leave a release between them.

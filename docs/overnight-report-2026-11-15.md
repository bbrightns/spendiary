# Overnight bug hunt: 2026-11-15

Branch `ccr-bf19b725-8t4cm8`, on top of `main` at `bbe680e` (v1.49.5). Nothing was merged, shipped or version-bumped: see "Ship decision" at the end.

Five bugs fixed, each with a test that failed first. All checks pass. Nine behaviours were left alone because they could be design choices; three of them now have a test that pins the current behaviour.

## 1. Fixed

| # | Bug | Root cause | What a user saw | Commit |
|---|-----|-----------|-----------------|--------|
| 1 | An installment split that divides evenly came out a satang short | `installmentAmount` floored `total / months` in floating point (`1009.8 / 10` is `100.9799…`) | ฿1,009.80 over 10 months showed "10 × ฿100.97" and a last payment of ฿100.98 + 9 satang, instead of 10 × ฿100.98. Roughly 1 in 30 amounts with satang were affected. The total was always right; the per-month figure was not | `b467e0d` |
| 2 | A loan paid off in parts never reached ฿0 | `payLiabilityInstallment` subtracted without rounding: `1000 − 333.33 − 333.33 − 333.34` leaves `1.1e-13` | A fully paid ฿1,000 / 3-month plan kept a balance of 0.0000000000001. It never read "Fully paid" on the Invest side, and a loan without an installment count stayed active forever at "฿0". `lastPaidAmount` carried the same noise (333.3400000000001), so Undo restored a slightly wrong balance | `b467e0d` |
| 3 | Loans already damaged by #2 stayed damaged | No repair on load | Same as #2, for payments made before the fix. `migrate` now rounds `balance` and `lastPaidAmount` to the satang (idempotent, covered by a test). Also: `transfers` / `dividendRecords` saved as `null` crashed Settings; they now default to `[]` | `7f668a0` |
| 4 | A due day the month does not have was never "due today" | `getLiabilityDueStatus` compared today against the raw due day (31) while the rest of the code clamps to the month's last day | Due day 31, on 30 November: "In 1 day (on the 31)" instead of "Due today", so the Home reminder said tomorrow on the actual due date. A first payment next month from 31 January with due day 30 showed "In 30 days (Mar 30)" instead of "In 28 days (Feb 28)" | `89ff59c` |
| 5 | Plain saved dates were parsed as UTC in two places | `new Date('YYYY-MM-DD')` is midnight UTC | **Not visible in Thailand** (UTC+7 lands on the same day). West of UTC: a loan added on its due day showed "Overdue" instead of "first payment next month"; a weekly DCA buy confirmed on Monday was not counted, so the app asked for that week's buy again (a double-buy risk) | `89ff59c`, `e98a4ca` |
| 6 | Dividends and savings deposits left float noise on cash balances | `balance + amount` without rounding in `recordDividend`, `removeDividendRecord` and the savings branch of `confirmDcaBuy` | A ฿0.10 account receiving ฿0.20 saved as 0.30000000000000004. Display rounds it away, but the stored balance was wrong and exact comparisons (`balance === 0`, "hide ฿0.00 cards"-style filters, undo checks) can miss | `72e7ec3` |

`ead2499` adds only tests (section 2).

## 2. Needs decision (all nine decided and fixed on 2026-11-15, after v1.49.6)

| # | Was | Now | Commit |
|---|-----|-----|--------|
| 1 | Installment 1 of a converted charge could be converted again | Refused in the data layer and hidden in Quick add | `431ede8` |
| 2 | Deleting a loan payment in History gave the money back but left the loan counted as paid | Deleting a loan's latest payment (or installment 1 of a converted charge) takes it off the loan too. Pay-loan Undo and Home's Undo no longer undo the loan a second time | `431ede8` |
| 3 | Removing a dividend record stopped the account at ฿0 | Takes the whole amount back, below zero if it was spent | `e96fea9` |
| 4 | Converting onto another card left installment 1 on the old card | Installment 1 goes on the plan's card; the old card's moved-to statement is dropped | `431ede8` |
| 5 | Statement day 28 / due day 29 was due the day it closed in February | Due the day after closing when a short month clamps the due day onto it | `a64e800` |
| 6 | Delete all transactions left bills marked paid and loans paid | Runs exactly as deleting each one, newest first | `431ede8` |
| 7 | Net worth snapshots skipped values below 0 | Negative net worth is recorded (0 and NaN still skipped) | `e96fea9` |
| 8 | Spent-per-day average used bars floored at 0; caption called pay-backs "expenses" | Average nets out pay-backs (matches the period total); caption says "entries" when pay-backs are listed. Bars still stop at 0 | `f88be68` |
| 9 | A converted plan's next payment was the due day next month (the bill that already holds installment 1) | Due with the bill after installment 1's: a charge billed 25 Nov is next due 10 Jan, not 10 Dec. New installment purchases now read their first due date from the same card-cycle logic | `431ede8` |

## 3. Suspicious but unconfirmed

- **`migrate` throws on a `null` entry inside a list** (`holdings: [null]`, `dcaPlans: [null]`, `spendRecurring: [null]`, a `null` in `fixedCostItems` or in a holding's `locations`). The load then fails safe (`loadError`, saving stays off), so no data is lost, but the user is locked out. I could not find a code path that writes such an entry, so I did not add filtering.
- **A holding saved with `avgCostThb` but no `avgCost`** keeps `avgCost` undefined after `migrate`; `applyBuy` would then produce `NaN`. No known old shape has this.
- **Numbers saved as strings** (`units: "10"`) pass through `migrate` unchanged. Backup import rejects them; the cloud load does not validate.
- **`migrate` gives a fresh id on every load until the next save** for the legacy `cash` → Cash account, for a legacy `monthlyFixedCost`, and for a DCA plan without an id. Safe only because the first load of such a payload is always saved back (`justImportedFixedCosts`). A payload with `cash` *and* `fixedCostsImported: true` would break that; it should not exist.
- **`minimumPayment`** uses `Math.ceil(amount × percent) / 100`; float noise could round up one satang too many. Not reproduced.
- **`roundMoney`** is `Math.round(x * 100) / 100`: `1.005` rounds to `1.00`. Only reachable with sub-satang input.
- **Undo of a conversion after installment 2 was paid** removes the plan but leaves the installment-2 transaction on the card. The Undo toast is short-lived, so unlikely.

## 4. Not covered

- **UI components**, apart from reading the conversion and pay flows in `QuickAddSheet`, `PayLoanSheet`, `PayBillSheet`, `AccountSheets` and `SpendAnalysis`. No browser run: nothing was exercised in the dev server, no console check, no visual check (no UI was changed; only two status label strings can differ, for due days past the month's end).
- **`holdingLogs.ts` undo paths, `undoDelta.ts`, `undoEdit.ts`, `importPortfolio.ts`, `holdings.ts` edit/transfer**: skimmed for unrounded money only, not traced.
- **`activitySummary.ts`, `buyTrend.ts`, `portfolioMarkdown.ts`, Retirement and Rebalance math**: not read.
- **`useCloudSync.ts` save/conflict logic** and `backup.ts`: only the load path was read.
- **Old payload shapes**: git history starts in late October, so shapes older than that could only be inferred from the migration code itself, not replayed from real old data.
- **`MatchStatementSheet`, `ImportSheet` matching, `reconcileAccounts`**: relied on their existing tests.
- **fast-check**: not added. Exhaustive loops over every statement day × due day × date (2027 to April 2028, leap day included), and every pay-cycle rule, found no failures in `cardCycle`, `statementFor`, `cardStatementPeriod`, `followingStatement`, `firstInstallmentDue`, `periodFor`, `shiftPeriod` or `occurrencesBetween`, so a new dependency did not earn its place.

## 5. Check results

Run on the final commit:

| Check | Result |
|-------|--------|
| `npm test` | 63 files, 715 tests passed (was 60 files, 693 tests) |
| `npm run build` | passed (`tsc -b` + `vite build`) |
| `npm run lint` | passed, 0 warnings |
| `npm run lint:design` | no problems |

New test files: `src/modules/spend/loans.test.ts`, `src/store/actions/dividends.test.ts`, `src/lib/calc.tz.test.ts` (sets `TZ=America/Los_Angeles` for its own tests and restores it).

## Ship decision

The first five fixes shipped as v1.49.6 (PR #122, merge `cd9d45b`). The nine decisions above are on the working branch, not shipped yet.

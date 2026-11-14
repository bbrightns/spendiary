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

## 2. Needs decision

Not changed. Recommendation first, then why it is ambiguous.

1. **Installment 1 of a converted charge can be converted again.** *Recommend: block it* (exclude entries with `liabilityId` from `canSplit` in `QuickAddSheet.tsx`). Banks do not re-split an installment. Money stays consistent today (total owed is conserved, pinned by a test in `installmentConvert.test.ts`), which is why this is a decision and not a fix.
2. **Deleting a loan-payment transaction in History does not put the loan back.** *Recommend: route it through the same undo as the toast* (`useUndoLoanPayment`), or warn. Today the card/wallet gets the money back but the loan still counts the installment as paid, so total debt drops by that payment. Same for deleting installment 1 of a converted charge. It may be intended ("I logged it twice"), so left alone.
3. **Removing a dividend record clamps the account at ฿0.** *Recommend: let it go negative*, like every other wallet move. Receive ฿100, spend ฿80, remove the record: balance becomes ฿0, not −฿80, so ฿80 appears from nowhere. Pinned by a test in `dividends.test.ts`.
4. **Changing the card while converting a charge.** *Recommend: post installment 1 on the plan's card.* Edit a charge, pick another card, turn on Split: the plan lands on the new card, but installment 1 is posted on the old one (`firstInstallmentTxn` uses `old.accountId`). The amount is right; the card it sits on is arguably wrong. Fixing it properly also means recomputing `statement` for the new card, hence not a one-line fix.
5. **A card whose due day is the day after its statement day** (e.g. 28 / 29). *Recommend: nothing, or reject it in the card form.* In non-leap February the bill is due the day it closes. No real card works like this. Pinned by a test in `logic.test.ts`.
6. **"Delete all transactions" leaves recurring bills marked paid and loans paid.** *Recommend: also clear `doneDates`.* Deleting one transaction un-marks its bill; clearing all does not, so the last 45 days of bills stay "paid" with no transaction behind them.
7. **Net worth snapshots skip values ≤ 0.** *Recommend: record negatives.* With more debt than assets the history chart simply stops. An existing test asserts the skip, so it looks deliberate.
8. **"Spent per day" bars floor a negative day at 0.** *Recommend: leave.* A day with more paid back than spent draws as 0, so the bars can add up to more than the period total. The drill-down caption also counts a pay-back row as an "expense".
9. **Next due date after converting a charge on the open cycle.** *Recommend: leave, but check against a real statement.* `nextMonthDue` says installment 2 is due on the due day next month. With statement day 25 / due day 10 and a charge converted on 14 Nov, the bank bills installment 1 on the 25 Nov statement (due 10 Dec) and installment 2 on 25 Dec (due 10 Jan). The app says 10 Dec. An existing test asserts the current rule.

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

The brief had two instructions that pull apart: the hard rules say never ship, merge or bump the version; the last line says "if all fixed, no more bugs, ship it". I did not ship. The condition is not met: section 2 has nine open decisions, section 3 has unconfirmed suspicions, and section 4 lists what was not read. `package.json` is still 1.49.5 and no PR was opened. Saying "ship" will run the normal flow on this branch.

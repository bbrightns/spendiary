# Spend module — roadmap & parked items

## Phases

- **Phase 1 (done)** — transaction model, Quick Add (+ note with #tags), Overview with
  monthly budget → "per day left", Transactions (search by text / #tag, month
  stepper, type filter), Wallets, Invest ↔ Spend mode switch, command palette entries.
- **Phase 2 (done)** — pastel categories, recent #tags, credit cards (limit, statement /
  due day), Accounts page, favorite + default payment method, full Test Mode seed.
- **Phase 3 (done)** — pay cycle: count a "month" by calendar or from payday
  (fixed day, or N days before month end, with weekend shifting), Spend settings page.
- **Phase 4 (done) — credit card bill reminders**
  - Reminder when a card's statement closes / due date is near (badge on the
    Accounts tab + banner on Overview, e.g. 5 days before due).
  - Tapping it opens a "Pay bill" sheet that totals what the statement billed
    (charges between the two statement dates, minus refunds and payments already made),
    lists those charges, and pre-fills a transfer wallet → card for that amount.
  - Optional: partial payment / minimum payment, mark as paid.
- **Phase 5 (done)** — budget per category (spent vs limit on Overview, warns at 85%, red when over);
  recurring bills / income that wait for a one-tap Log or Skip (or open pre-filled to adjust the amount).
- **Phase 6 (done)** — Invest-side links: dividends → income and DCA buys → "invested" (read-only,
  derived from Invest); Spend cards in net worth (per-card opt-out); Dashboard cash-flow card;
  delta-based undo for cash-account logs.
  - Done: fixed costs moved to Spend. Old `fixedCostItems` are copied once into
    recurring bills (`fixedCost: true`); DCA Plans reads its fixed total from Spend.
  - Later cleanup (ask first): remove `fixedCostItems`, `monthlyFixedCost`,
    `monthlyPersonal` (unused) and `upsertFixedCostItem` / `removeFixedCostItem`
    from DataContext once the import has run on every device.

## Remaining tasks

### Next up
3. **Smarter, wider search (Command Palette, Cmd+K)**
   - Cover everything: Spend transactions (note, #tag, amount like `65` or `>1000`),
     categories, wallets and cards, recurring bills, holdings, DCA plans, debts, settings
     sections, and every page.
   - Context aware: in Spend mode, Spend actions and results come first.
   - Smarter matching: fuzzy / typo-tolerant, Thai and English keywords, ranking by recent
     and frequent use, recent searches when empty.
   - Actions with arguments: "65 ชานม #nosetea" → Quick Add pre-filled; "pay ktc" → Pay bill;
     "budget food" → category budget; results grouped with counts.

### Invest-side links
4. Debts / installments → Spend expense when an installment is paid.
5. DCA Planner: show Spend's real "left this month" next to the salary card.
6. Retirement: suggest `monthlySpend` from the 3–6 month average of real spending.
7. Cash page: per-wallet "see transactions" link → `/spend/txns?q=<wallet>`.
8. DCA salary (`monthlyIncome`) read from Spend's recurring salary.

### Spend features
9. Bulk import of past transactions (bank / card statement CSV or AI).
10. Savings goals.
11. Custom categories (add, rename, color).
12. Monthly report: category trends, 6-month income vs. expense line.
13. USD wallets (currently THB only).
14. Thai public holidays when shifting payday (weekends only for now).
15. Receipt scanning (needs a server-side function for the vision API key).
16. Card bills: minimum payment / mark as paid.

### Tech and data
- Lint warnings left on purpose: ~40 `react-hooks/exhaustive-deps` / fast-refresh warnings in older
  Invest pages and DataContext. Fix them one file at a time with a UI check, since dependency changes can
  change behaviour.
17. Move Spend data to its own Supabase table once it grows (single payload today);
    a foundational change — the trigger for v2.0.0.
18. Test the DCA confirm and Activity Logs undo flows through the real UI (logic tested only).
19. Dashboard "Total Outstanding" now includes Spend cards: label it or list cards in the Debts card.

### Requests
21. **Categories for both expense and income** — add a new category manually from the category
    picker (for either type), and let the user pick its logo (icon) when creating or editing it.
    Overlaps with item 11 (custom categories); build them together.

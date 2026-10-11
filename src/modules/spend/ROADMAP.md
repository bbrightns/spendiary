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
- **Checked in the real UI (2026-10-11):** DCA Confirm Buy (units, invested, Spend "Invested" row) and
  Activity Logs Undo (holding, log, Spend row and the plan all roll back).
- **Phase 6 (done)** — Invest-side links: dividends → income and DCA buys → "invested" (read-only,
  derived from Invest); Spend cards in net worth (per-card opt-out); Dashboard cash-flow card;
  delta-based undo for cash-account logs.
  - Done: fixed costs moved to Spend. Old `fixedCostItems` are copied once into
    recurring bills (`fixedCost: true`); DCA Plans reads its fixed total from Spend.
  - Later cleanup (ask first): remove `fixedCostItems`, `monthlyFixedCost`,
    `monthlyPersonal` (unused) and `upsertFixedCostItem` / `removeFixedCostItem`
    from DataContext once the import has run on every device.

## Remaining tasks

### Spend features
13. USD wallets (currently THB only).
15. Receipt scanning and AI reading of PDF / photo statements (CSV import is done) — both need a
    server-side function for the vision API key.

- Thai holidays: only fixed-date ones are built in; Buddhist holidays (lunar) are added by the user as
  "Other days off". A yearly built-in list could come later.

### Tech and data
- Lint warnings left on purpose: ~40 `react-hooks/exhaustive-deps` / fast-refresh warnings in older
  Invest pages and DataContext. Fix them one file at a time with a UI check, since dependency changes can
  change behaviour.
17. Move Spend data to its own Supabase table once it grows (single payload today);
    a foundational change — the trigger for v2.0.0.

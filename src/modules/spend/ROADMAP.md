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

## Parked: touches the Invest side (do later, on purpose)

These were held back so the stable Invest pages stay untouched for now.

- **Dashboard cash-flow card** — small "In / Out / Left this month" card on
  `pages/Dashboard.tsx` linking to `/spend`.
- **Dividends → income** — when `recordDividend` runs, also create a Spend
  income transaction (`source: 'dividend'`) without moving the wallet twice
  (the dividend flow already credits the cash account).
- **DCA confirm → transfer** — `confirmDcaBuy` deducts cash; mirror it as a
  Spend "to invest" transfer that is excluded from spending totals.
- **Debts / installments → expense** — `payLiabilityInstallment` could log a
  Bills expense.
- **DCA Planner "left this month"** — show Spend's real net next to the salary card.
- **Retirement `monthlySpend` suggestion** — 3–6 month average of real spending.
- **Activity Logs undo vs Spend balances** — Invest log undo restores
  `previousCashAccountsState` snapshots, which can overwrite balance changes made
  by Spend transactions logged after it. Needs a delta-based undo, or a warning.
- **Credit cards → net worth / Debts** — Spend cards (`spendCards`) track what you
  owe, but Dashboard net worth and the Debts page only read `liabilities`. Decide:
  link a card to a `credit_card` liability, or count `spendCards` in net worth.
  Avoid double counting with existing credit-card liabilities (seed has one: l2).
- **Cash page "see transactions" link** per wallet → `/spend/txns?q=<wallet>`.

## Spend-only ideas (no Invest impact)

- Savings goals
- Thai public holidays when shifting payday (weekends only for now)
- Monthly report / charts by category over time
- Custom categories
- USD wallets (currently THB only)
- Receipt scanning (needs a server-side function for the vision API key)
- Payload size: transactions live in the single synced `user_data.payload`;
  if it grows large, move them to their own Supabase table.

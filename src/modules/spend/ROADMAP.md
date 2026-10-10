# Spend module — roadmap & parked items

Phase 1 (done): transaction model, Quick Add (+ note with #tags), Overview with
monthly budget → "per day left", Transactions (search by text / #tag, month
stepper, type filter), Wallets, Invest ↔ Spend mode switch, command palette entries.

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
- **Cash page "see transactions" link** per wallet → `/spend/txns?q=<wallet>`.

## Spend-only ideas (no Invest impact)

- Budget per category
- Savings goals
- Recurring transactions (rent, subscriptions)
- Monthly report / charts by category over time
- Custom categories
- USD wallets (currently THB only)
- Receipt scanning (needs a server-side function for the vision API key)
- Payload size: transactions live in the single synced `user_data.payload`;
  if it grows large, move them to their own Supabase table.

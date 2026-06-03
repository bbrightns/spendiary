# Spendiary

A private, premium personal-finance dashboard for tracking your **investment portfolio**, **DCA plans**, and **bank transfer schedules** — all in Thai Baht (THB).

This is not a budgeting app and not a gamified finance app. It's a single-user cockpit.

## Stack

- **React 18** + **TypeScript**
- **Vite** (dev server + build)
- **Tailwind CSS v4** (design tokens via `@theme`)
- **React Router** for page navigation
- No chart library — donut and progress rings are hand-built SVG
- Data persists locally in `localStorage` (nothing leaves the device)

## Pages

| Route | Page | Shows |
| --- | --- | --- |
| `/` | **Dashboard** | Net worth (auto-summed), portfolio value, cash by account, monthly DCA progress, upcoming transfer expirations |
| `/portfolio` | **Portfolio** | Asset allocation donut, mutual funds / US stocks / Bitcoin, current value, profit/loss, per-holding **Buy more** |
| `/dca` | **DCA Planner** | Every monthly buy, total DCA/month, date-aware "bought this month" progress |
| `/transfers` | **Auto Transfers** | Recipient, amount, frequency, remaining transfers, expiry date, expiring-soon warnings |

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
```

```bash
npm run build    # type-check + production bundle into dist/
npm run preview  # preview the production build
```

## Design

Light theme, modern fintech, premium and minimal — inspired by Apple, Linear, Notion, and Copilot Money. Mobile-first with a bottom navigation bar; desktop gets a fixed sidebar. Soft shadows, rounded corners, large display typography (Plus Jakarta Sans) over Inter body text.

## Data

The app seeds realistic sample data on first load. Clearing all holdings/plans/transfers reveals the empty states, each with a one-tap **Load sample** action. All edits are saved to `localStorage` under `spendiary.data.v1`.

**Net worth is never edited directly** — it's always derived as *total cash + live portfolio value*. Cash is tracked as a list of **accounts** (e.g. KBank, SCB), editable from the **Cash Available** card on the Dashboard; total cash is their sum.

**Date-aware:** the app reads today's date to compute this month's DCA progress — a plan's amount counts as "bought" once its buy-day has passed, so the Dashboard ring and DCA page update automatically as the month advances. Portfolio values use the **latest price you filled** (there's no live market feed); update a price via **Edit**, or use a holding's **Buy more** button to log a purchase — units grow and the average cost is re-weighted automatically.

Older saved data is auto-migrated on load (single `cash` number → one "Cash" account; old DCA `monthlyTarget`/`contributed` → `monthlyAmount`).

- Types: `src/lib/types.ts`
- Seed data: `src/lib/seed.ts`
- Derived metrics (net worth, allocation, P/L, DCA totals, surplus): `src/lib/calc.ts`
- Currency / date formatting: `src/lib/format.ts`
- Store: `src/store/DataContext.tsx`

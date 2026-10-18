# Spendiary

A personal-finance app with two sides:

- **Spend**: daily spending, accounts and cards, bills and recurring payments, loans and installments, budgets and analysis.
- **Invest**: portfolio (funds, stocks, crypto, gold, real estate, cash), DCA plans, dividends, rebalancing, retirement planning and an activity log.

Amounts are in Thai Baht (THB). USD amounts are converted with a real USD/THB rate, either live or the last one fetched. The app never uses a guessed rate (see `src/lib/fx.ts`).

## Stack

- **React 18** + **TypeScript** + **Vite**
- **Tailwind CSS v4**, with design tokens in `@theme`
- **React Router**
- **Supabase**: Google sign-in, cloud storage, and an Edge Function for stock prices
- **Vitest** for unit tests on the pure logic
- Deployed on **Vercel** from `main`

## Getting started

```bash
npm install
cp .env.example .env   # fill in your Supabase URL and publishable key
npm run dev            # http://localhost:5173
```

You can skip the `.env` setup: **Explore Demo / Offline Mode** on the sign-in screen runs the app on in-memory sample data and saves nothing.

```bash
npm run build    # type-check + production bundle into dist/
npm run preview  # serve the production build
npm run lint     # eslint (0 errors required)
npm test         # vitest
```

CI (`.github/workflows/ci.yml`) runs lint, test and build on every pull request and on every push to `main`.

## Environment variables

| Name | Value |
| --- | --- |
| `VITE_API_URL` | Supabase project URL (`https://<project-ref>.supabase.co`) |
| `VITE_API_TOKEN` | Supabase **publishable / anon** key, never the service_role key |

Both end up in the browser bundle, so they are public by design. Row Level Security protects the data. In Vercel, set them under Project Settings → Environment Variables with the type **Config**. `.env` is git-ignored.

## Data and sync

- Each user has **one row** in the Supabase table `public.user_data`: `id` (the user's auth id), `payload` (the whole app data as JSON) and `updated_at`.
- **Row Level Security** is on, and every policy limits a user to the row whose `id = auth.uid()`. `supabase/sql/user_data_rls.sql` has the check and the policies.
- **Loading** (`src/store/remoteLoad.ts`, `useCloudSync.ts`): a load ends as *loaded*, *empty* or *failed*. Saving turns on only after a confirmed load, so a failed load can never overwrite the cloud row. While the data isn't loaded, the pages and the Quick add sheets stay closed.
- **Saving** (`src/store/remoteSave.ts`) uses an optimistic lock on `updated_at`. If another tab or device saved first, nothing is written and the app shows "Changed on another device".
- `localStorage` only holds per-device things: theme, view preferences, last sync time, the last USD/THB rate and price caches.
- Old saved data is migrated on load (`src/store/migrate.ts`, `src/modules/spend/migrate.ts`).

## Where things live

| Path | What |
| --- | --- |
| `src/store/DataContext.tsx` | `useData()`, the app-wide data and actions |
| `src/store/actions/` | Pure data changes: `(prev, ...args) => next` |
| `src/store/useAuth.ts`, `useCloudSync.ts` | Sign-in, load and save |
| `src/lib/types.ts` | Data types |
| `src/lib/calc.ts` | Derived numbers: net worth, allocation, P/L, DCA |
| `src/lib/format.ts` | Money and date formatting (`localDateStr()` for local calendar days) |
| `src/lib/fx.ts` | The single USD/THB source |
| `src/modules/spend/` | The Spend side |
| `src/pages/` | The Invest side and Settings |
| `supabase/functions/smart-responder/` | Edge Function for stock price and symbol lookup |
| `supabase/sql/` | SQL to run by hand in the Supabase dashboard |

## Rules for contributors and AI agents

See `AGENTS.md`.

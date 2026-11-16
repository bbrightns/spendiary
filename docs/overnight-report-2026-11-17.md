# Overnight run: 2026-11-17

Branch `claude/great-pasteur-f4vbvl`, on top of `main` at `240bfe8` (v1.49.8). Pushed to that branch only.
Nothing was merged, shipped or version-bumped, no pull request was opened, and no SQL or Supabase / Vercel setting
was touched. Supabase was only ever simulated (Playwright `route()` and unit tests).

This run covers what the 2026-11-15 run did not read: migration hardening, cloud sync, security, and the remaining
money math. Decisions taken without asking are marked **(decided)** and listed again at the end of section 3.

> **Shipping split.** The sync fixes (#3 to #7, commit `6e70f52`, with `scripts/sim/`) are **not shipped**: they were
> reverted on this branch (revert commit below) and wait for the next round. To bring them back, revert that revert.
> The 8 other fixes (#1, #2, #8 to #13) shipped together. Sections 1 and 2 still describe the sync work in full.

All five phases were reached. Thirteen bugs fixed, each with a test that failed first; no Critical or High security
finding; sixteen behaviours left alone and listed under Needs decision; the refactor plan is in
`docs/refactor-plan.md`.

One thing went wrong during the run: `f516781` was pushed with two lint errors in its test file (my command chain
did not stop on the failed lint). It was fixed one commit later in `f36546e`, and every commit after that was gated
on all four checks. The branch head is clean.

## 1. Fixed

| # | Bug | Root cause | What a user would have seen | Commit |
|---|-----|-----------|-----------------------------|--------|
| 1 | One `null` in any saved list locked the user out | `migrate` mapped over every list and read fields of each entry (`h.units`), so `holdings: [null]` threw; the load then failed for good | "Couldn't load your data" on every sign-in, with no way past it, although the rest of the data was fine | `e2e2c05` |
| 2 | Wallet and card balances kept float noise from older versions | `migrate` only rounded loans to the satang | A wallet holding `-1e-13` shown as overdrawn; a card at `1e-13` never hidden by "hide ฿0.00 cards" | `e2e2c05` |
| 3 | A failed save was not tried again | `useCloudSync` only saves when the data changes; after a network error nothing triggered another attempt | Edit while offline or in a tunnel, close the app: the edit is gone. The sync icon showed an error, but only the next edit would have saved it | `6e70f52` |
| 4 | An edit made just before switching apps could be lost | The save waits 2 seconds; phones freeze the page (and its timer) when it is hidden and often discard it | Add an expense, switch to the banking app within 2 seconds, come back later to a reloaded page without the expense | `6e70f52` |
| 5 | "Changed on another device" with only one device | When a save was stored but its answer was lost on the way back, the device kept the old version stamp, so its next save conflicted with its own row | The full-screen conflict message after a network blip, and "redo your last change" although nothing else had saved | `6e70f52` |
| 6 | The conflict screen came straight back after "Load latest" | A save queued behind the conflicting one still reported its (stale) result into the freshly loaded state. Same hole after a sign-out: the old account's save could overwrite the new account's version stamp | Press "Load latest", see the data, then the conflict screen again a few seconds later | `6e70f52` |
| 7 | A row whose payload is not an object was read as data | `resolveRemoteLoad` accepted any truthy payload; `migrate` turned a string or array into empty data, and saving switched on | If the payload was ever stored as JSON text (hand edit, a bad restore script), the app would open empty and the first edit would replace the real data | `6e70f52` |
| 8 | Recent searches survived sign-out | Search history lives in `localStorage` and was never cleared | On a shared browser the next person signed in saw the previous person's recent searches | `bb26354` |
| 9 | Undoing a buy paid from a USD wallet lost what the dollars cost | A buy that empties a USD wallet zeroes its baht cost; undo put the dollars back "at the wallet's rate", which no longer existed. A partial buy and its undo could also drift by a satang | Exchange ฿36,500 for $1,000, buy a US stock with all of it, undo (a typo). The wallet shows $1,000 with no cost, so its rate falls back to today's, and the re-entered buy is costed at today's rate: the stock's baht cost and P/L are wrong from then on | `6c67e32` |
| 10 | Merging an import wiped fields the row did not mention | Merge spread the whole cleaned-up row, defaults included, over the existing item | Import `{ "name": "Dime FCD", "balance": 1200 }` onto a USD account: it became ฿1,200 (net worth drops by about 97% of that account). Import a debt with only a name and a balance: its rate, monthly payment, lender, due day, note and installment count were wiped, its category became "other" and its created date today | `f516781` |
| 11 | An import could save a balance of `null` | `parseCleanNumber` accepted `Infinity` (JSON reads `1e999` as Infinity, and the text "Infinity" parses too); Infinity is saved as `null` | A wallet with no balance after the next reload, and `NaN` wherever it is added up | `f516781` |
| 12 | Rebalance targets that add up to 100 were refused | The sum was compared with `=== 100` in floating point; 16.6 + 16.6 + 16.7 + 16.7 + 16.7 + 16.7 is 100.00000000000001 | "Targets sum to 100.00000000000001%. Must equal 100%", nothing saved, no buy / sell actions. Typical with six or seven holdings at equal weights | `ad102bc` |
| 13 | Dollar dividends were added to baht totals as if they were baht | The Activity Summary summed `netDividend` without looking at its currency; a US stock's dividend is recorded in dollars | An $85 dividend counted as ฿85 in Dividends, Net profit, the asset's row and the month (about 35 times too small) | `27eb59a` |

Notes on the fixes:

- **#1 (decided):** what is dropped is `null` in any list at any depth, anything that is not an object in the 16
  top-level lists of records, and a top-level list of records that is not a list at all (it becomes the default).
  Valid entries keep their identity. One `console.warn` names the lists and counts. The cleaned data is not saved
  back by itself; it is saved with the user's next edit.
- **#2:** only `balance` is rounded (not `thbCost`, limits or anything else). Non-finite and non-number balances are
  left alone. `-0` is turned into `0`. `migrate(migrate(x))` equals `migrate(x)` for all of these (5 cases tested).
- **#3:** retries wait 5 s, 10 s, 20 s, 40 s, then 60 s, and go out at once on the browser's `online` event.
  A conflict or a sign-out stops them.
- **#4:** best effort. A hidden page still gets its request out; a tab closed outright may not (see Needs decision 1).
- **#9:** buy, add and DCA entries now save the baht cost that left with the dollars (`delta.cash[].thbCost`), and
  undo restores exactly that. Entries saved before this behave as before. An additive field: older app versions
  ignore it, so `DATA_SCHEMA` was not raised.
- **#10:** merging takes only what the row states. A new account or debt still gets the defaults. An existing
  account keeps its bank unless it had none.
- **#12:** totals are rounded to two decimals before the comparison; "Fill +x%" uses the same rounding. Checked in
  the browser in both themes at 1366 px and 390 px: "Targets add up to 100%", 12 actions shown, no horizontal scroll,
  no console errors.
- **#13:** converted at today's rate (no rate is saved with a dividend), the same rule Spend already uses; left out
  of baht totals while no rate has loaded. A dividend paid into a baht account is taken as baht.
- **#5:** on a conflict the app now reads the row once. If it holds exactly what this device is saving, or what it
  sent when the answer was lost, the row is ours and saving continues from its stamp. Any other content is a real
  conflict, as before. Key order is ignored (jsonb reorders keys).

## 2. Security findings

Scope: `supabase/sql/user_data_rls.sql`, `supabase/sql/user_data_write_lock.sql`,
`supabase/functions/smart-responder/index.ts`, the `VITE_*` variables, and the client. I read the files in git; I did
not (and must not) look at the live project, so "as written" below means "if the dashboard matches these files".
`docs/security-plan.md` already tracks several of these; they are repeated here only with what is new.

**No Critical or High finding.** As written, user A cannot read, change, insert or delete user B's row: all four
policies are `to authenticated` with `(select auth.uid()) = id`, INSERT and UPDATE carry `WITH CHECK`, and there is no
policy for `anon`.

| # | Severity | Issue | Attack scenario | Status |
|---|----------|-------|-----------------|--------|
| S1 | Medium | `smart-responder` has no auth check, no input limits and `CORS *` | Anyone with the publishable key (it is in the JS bundle) posts `{"symbols":"A,B,C,…"}` with 10,000 symbols in a loop. Each request fans out into 10,000 parallel Yahoo requests from Supabase. Result: the function quota burns down and Yahoo blocks the project's IP, so prices stop for every user. No data is exposed, and no paid API is behind it | Proposed fix A |
| S2 | Medium | Email-code sign-in can be abused from outside the app | `shouldCreateUser: false` is a client flag, not a server rule. A script calls `/auth/v1/otp` directly: (a) sends code emails to arbitrary addresses until the project's email quota is gone, so real users get no code; (b) requests a code for a known user's address and guesses 6 digits from many IPs. How far (b) gets depends on the rate limits and code length set in the dashboard, which I could not see | Proposed fix B |
| S3 | Medium | Nothing limits the size of `payload` | Anyone can sign in with a Google account, then save a 50 MB payload from the console again and again (or from several accounts). The free plan's 500 MB fills up and every user's saves start failing | Proposed fix C |
| S4 | Medium | CSP is still Report-Only while the session token lives in `localStorage` | No XSS hole was found (no `dangerouslySetInnerHTML`, no `innerHTML`, no user-controlled links). But if one ever appears, or a dependency is compromised, nothing stops the script from reading the token and the whole payload | In `security-plan.md` (enforce the CSP) |
| S5 | Medium | The publishable key reaches every table and function in the project | The key grants the `anon` role. Any table created later without RLS, or with a `true` policy, is readable and writable by the whole internet; this already happened once (`inventory`, `logs`, `store_meta`). `get_next_part_id` and `adjust_stock_v2` are still callable as RPC | Proposed fix D (a check to run after every schema change) |
| S6 | Low | The write lock is in lenient mode, and "force" is a header the client sets | A stale tab of an old app version (no header) still overwrites newer data. Not an attack: a user can only hit their own row. The lock is an integrity aid, not a security boundary | Step 2 (strict) in `user_data_write_lock.sql`; see Needs decision 6 |
| S7 | Low | CSV export does not neutralise formulas | A merchant name such as `=HYPERLINK("http://evil","Refund")` arrives in an imported bank statement, is exported from Spend, and runs as a formula when the file is opened in Excel | Proposed fix E (Needs decision 7) |
| S8 | Low | Recent searches stayed after sign-out | Shared browser: the next account sees the last one's searches | Fixed `bb26354` |
| S9 | Low | `react-router` 6 advisories (open redirect through a backslash in `<Link>`, SSR hydration) | The app has no user-controlled link targets and no SSR, so neither is reachable today | In `security-plan.md` (Ship 2) |
| S10 | Low | Sign-in uses the implicit flow | Tokens return in the URL fragment. The app clears it, but a browser extension or a crash report could capture it first | Proposed fix F |
| S11 | Low | "Clear all data" leaves the auth account, and if the delete request fails the cloud row stays | A user who "cleared everything" on a bad connection signs in again later and the data is back. A privacy expectation, not an attack | In `security-plan.md` (delete account); see Needs decision 8 |
| S12 | Info | `payload` is plaintext; the project admin can read it | Known and accepted until Private mode | In `security-plan.md` |
| S13 | Info | The write lock casts the stamp header with `base::timestamptz` | A malformed header raises `22007` instead of `40001`; the app shows a plain save error. Self-inflicted only | None needed |
| S14 | Info | The function returns `error.message` to the caller | Leaks nothing today (no secrets, fixed upstream host) | Part of fix A |

What `VITE_API_TOKEN` grants, concretely: it is the `sb_publishable_` key, i.e. the `anon` role. A stranger holding
it can call the auth endpoints (start a Google sign-in, request email codes), call `smart-responder`, and query any
table or RPC that RLS and grants leave open to `anon`. With the policies as written, that is no row of `user_data`.
It cannot read or write another user's data, and it is not a secret. `VITE_API_URL` is equally public.

Checked and clean: no `service_role` or secret key in git; `.env` is ignored; `localStorage` holds no app secret
(the Supabase session token is there by design, see S4); backup restore validates and migrates before use; the AI /
JSON import and the CSV import only ever render through React (escaped) and round amounts; the demo user
(`test-user-local`) never reaches Supabase.

### Proposed fixes (not applied)

**A. `smart-responder`: limit input, then require a signed-in user.** Step 1 changes nothing for the app and can
be deployed by itself:

```ts
// near the top
const ALLOWED_ORIGINS = new Set(['https://<your-production-domain>', 'http://localhost:3000'])
const SYMBOL = /^[A-Z0-9.\-=^]{1,15}$/
const MAX_SYMBOLS = 60
const MAX_QUERY = 40

function cors(req: Request) {
  const origin = req.headers.get('origin') ?? ''
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://<your-production-domain>',
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

// in the handler, replacing the two input reads
if (typeof body.query === 'string' && body.query.trim()) {
  const query = body.query.trim().slice(0, MAX_QUERY)
  // … searchSymbols(query)
}
const tickerList = [...new Set(String(symbols).split(',').map((s) => s.trim().toUpperCase()))]
  .filter((s) => SYMBOL.test(s))
  .slice(0, MAX_SYMBOLS)

// in the catch: do not echo the error
return new Response(JSON.stringify({ error: 'Price lookup failed' }), { status: 500, headers })
```

Step 2 (needs an app change shipped first, so decide before doing it): have `src/lib/prices.ts` send the signed-in
user's access token instead of the publishable key, and have the function reject requests without a valid user:

```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
  global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
})
const { data: { user } } = await supabase.auth.getUser()
if (!user) return new Response(JSON.stringify({ error: 'Sign in first' }), { status: 401, headers })
```

The demo (test mode) has no session, so it would lose live prices unless it keeps a fallback. An origin allow-list
only stops other websites; a script ignores CORS, which is why step 2 and a rate limit matter more than the origin.

**B. Auth settings (Supabase dashboard → Authentication).** Turn on CAPTCHA protection (Turnstile or hCaptcha) for
sign-in; set "Email OTP length" to 8; keep the OTP expiry short; check the rate limits for "sending emails" and
"token verifications"; if nobody should be able to create an account by email, turn off email sign-ups there
(Google creates the accounts). Adding CAPTCHA needs a small change in `useAuth.ts` to pass the token.

**C. Size cap on the payload.** Check the current sizes first, then add the constraint:

```sql
-- 1. How big are the rows today? (read-only)
select id, octet_length(payload::text) as bytes
from public.user_data
order by bytes desc
limit 5;

-- 2. Cap at 5 MB (a few years of daily use is well under 1 MB). Pick a limit well above step 1's largest row.
alter table public.user_data
  add constraint user_data_payload_size
  check (octet_length(payload::text) <= 5 * 1024 * 1024) not valid;
alter table public.user_data validate constraint user_data_payload_size;

-- Undo
-- alter table public.user_data drop constraint user_data_payload_size;
```

A save over the cap fails with `23514`; the app shows a save error and (after this run) keeps retrying once a
minute, so the cap must stay far above real use.

**D. A check to run after every schema change** (read-only):

```sql
-- Tables in public without RLS
select c.relname
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

-- Policies that let signed-out or every role in, or that are simply `true`
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and (roles && array['anon', 'public']::name[] or qual = 'true' or with_check = 'true');

-- Functions in public that anon may call, and whether they run with the owner's rights
select p.proname, p.prosecdef as security_definer
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute');
```

Expect: no rows from the first two; from the third, only functions that are meant to be public. Then drop the
leftover inventory functions when their tables go (already planned in `security-plan.md`).

**E. CSV formulas.** In `src/lib/csv.ts`, prefix a text cell that starts with `=`, `+`, `-`, `@`, tab or carriage
return with `'`, unless the cell is a plain number (the Amount column is `-12.00`). The importer would then strip a
leading `'` from descriptions so a round trip stays identical.

**F. PKCE.** `flowType: 'pkce'` in `src/lib/supabase.ts`. The redirect then carries a one-time code instead of the
tokens. It changes the sign-in round trip, so it needs a real test with Google and the email code before shipping.

## 3. Needs decision

| # | Question | Today | Recommendation |
|---|----------|-------|----------------|
| 1 | Unsaved edits when the tab is closed, the session expires, or the user signs out within 2 seconds of an edit | Lost. A closed tab cancels the request; a forced sign-out wipes the in-memory data | Keep an "outbox" on the device: the unsaved payload plus the version stamp it was based on, written on every edit and removed on a confirmed save. On the next load, replay it if the cloud stamp still matches, otherwise offer "keep mine / keep cloud". This closes all three holes; a `beforeunload` warning only covers desktop |
| 2 | Two devices open at once conflict without anyone editing | Opening the Dashboard records today's net worth, and live prices write into holdings. Each of those is a save, so the second device gets "Changed on another device" having done nothing, and any real edit made on it in that window has to be redone | Do not let automatic writes (price refresh, daily snapshots) start a save by themselves, or, on a conflict where the only local changes are those fields, reload silently instead of showing the screen. Longer term: merge lists by record id instead of locking the whole document |
| 3 | A row that exists with a `null` payload | Read as "new user"; the insert then hits the existing row and the user loops on the conflict screen. Nothing is overwritten (pinned by the existing test "treats a row without a payload as no row") | Treat it as loaded-and-empty with the row's stamp, so the update lock applies. Left alone because it changes when the app may write over an existing row |
| 4 | A save that fails for a permanent reason (payload too large, policy change) | After this run it retries once a minute forever | After about 10 failures, stop and show "Saving is failing. Export a backup" with a retry button |
| 5 | Restoring a backup while a normal save is in flight, when the restore's own write then fails | The older save's success can mark the restore as synced although it never reached the cloud. Needs an edit within about 2 seconds before the restore plus a network failure | Give each save a sequence number and only let the newest one set "synced" |
| 6 | Write lock Step 2 (strict) | Lenient: an old tab without the header still overwrites | Run Step 2 now. Version 1.26.7 is long gone from any open tab; this run's sync changes send the header on every write |
| 7 | CSV formula neutralising (S7) | Not done | Do it (fix E). Held back because it changes the exported file and the import round trip |
| 8 | "Clear all data" when the delete request fails | The app signs out and clears the screen anyway; the cloud row is still there | If the delete fails, stay signed in and say so, instead of looking cleared |
| 9 | Undoing a sale that paid into a USD wallet | The dollars leave at the wallet's new average rate, not at what the sale added. $100 at 30, sell for $100 at 35, undo: the wallet is $100 at 32.5, not 30. The code comment says an undo "keeps the average rate", so it was left; pinned by a test | Save the baht the sale added on the entry (as fix 9 now does for buys) and take exactly that back |
| 10 | Undoing a sell-off | The holding comes back; its holding-level rebalance target does not, so the targets no longer add up to 100 | Keep the target on the sell entry and restore it with the holding |
| 11 | Import in Replace mode gives every holding a new id | Pinned by the existing test "replaces everything in replace mode". Side effects: DCA plans lose their holding, holding targets point at nothing, and the Activity Summary drops the history of every holding that was never sold (it hides logs whose holding id is gone) | In Replace mode, keep the existing id when ticker and asset class match. "Replace" still means the list becomes the imported list |
| 12 | Rebalance, "Exclude safe haven" with holding targets | A locked holding disappears from the rows but its target still counts toward the 100%. The visible targets then add up to less, and the page suggests selling the difference with nowhere for it to go | When excluded, scale the remaining targets up to 100% for the calculation (and say so), or ask for targets again |
| 13 | Retirement, "Coasting" milestone | The goal is in future baht (spending is inflated to the retirement year) and the projection grows at the nominal return, but Coast FI discounts the goal at the real return (return minus inflation). Example: goal ฿30M in 20 years, 8% return, 3% inflation. Discounted at 8% that is ฿6.4M; the page asks for ฿11.3M. Someone the page's own chart says is already coasting is told they are not | Discount at the nominal return, so the milestone agrees with the chart. Left alone because it moves a headline number and could be a deliberate margin |
| 14 | Retirement, "lump sum" goal | Monthly spending at retirement × 12 × years, with no inflation after retirement (the "drawdown" option does inflate). Over 30 years at 3% that understates the goal by about a third | Either inflate it like drawdown, or say on the page that lump sum assumes the money keeps pace with inflation |
| 15 | US dividends on the Dividends page and into baht accounts | The form records a US stock's dividend in dollars and offers every account; choosing a baht account adds the dollars as baht. The Dividends page prints dollar records with ฿ and adds them into the year's total | Offer only USD accounts for a US stock's dividend (or convert at the rate when a baht account is chosen), and total the page in baht the way fix 13 does |
| 16 | Activity Summary reads "invested" from the note text first | An entry's amount comes from "฿x spent" in its note before its saved numbers. Notes can be edited, so editing one changes the total. Dividends are also counted in the month they were recorded, not the payment date | Use the saved delta when there is one and the note only for older entries; bucket dividends by payment date |

Decided during the run without asking (conservative choices; say if any should be different):

- Migration drops only `null`, non-objects in lists of records, and lists that are not lists; the cleaned data is
  saved with the next edit, not immediately.
- Only `balance` is rounded on load. `thbCost`, credit limits and invested totals are left as saved.
- Retries never stop by themselves (decision 4), because stopping could strand an unsaved edit.
- Security fixes were limited to the client. `supabase/functions/smart-responder/index.ts` was not edited, since
  the deployed copy would then differ from git without anyone having deployed it; the patch is in section 2.
- `scripts/sim/` was added to the repo (the pretend Supabase and its scenarios). It is not wired into `npm test`.

## 4. Not covered / phases not reached

- The live Supabase project: policies, auth settings, rate limits and the deployed function were reviewed from the
  files in git only.
- The sync hook has no Vitest coverage of its own: the repo has no DOM test library, and adding one was out of
  scope. Its pure parts are unit-tested (`remoteSave.test.ts`, `remoteLoad.test.ts`); the hook is exercised by ten
  Playwright scenarios against a simulated Supabase (`scripts/sim/cloud-sync.mjs`, how to run is in its header).
  They are not part of `npm test` or CI because Playwright is not a project dependency.
- Phase 3, read but nothing changed, low impact:
  - Rebalance with "Exclude safe haven": the Buy form opens with the holding's units already reduced by its locked
    wallets, so "current units" reads low. The save is right (units are recomputed from the locations).
  - Retirement: clearing the birth date shows `NaN`; a retirement age with decimals makes the solvers read past the
    projection; `ageFromBirth` parses the date as UTC (not visible in Thailand, a day early west of UTC).
  - USD cost on a holding (`totalUsdInvested`, `delta.usd`) is added and subtracted without rounding. Display rounds
    it; no comparison depends on it.
  - `portfolioValueChange` takes the snapshot on the period's first day as the baseline, so that day's own move is
    left out of "change this month".
  - AI import creates a holding with 0 units when a row has none.
- Phase 3, not read: the DCA confirm paths (`confirmDcaBuy`, 449 lines) beyond the cash delta, the older
  snapshot-based undo (`undoFromSnapshots`, `undoEdit.ts`), `SellHoldingModal`'s own P/L math, and
  `portfolioMarkdown.ts`.
- Phase 4 is a plan only, as asked: `docs/refactor-plan.md`.

## 5. Check results

Final run on the branch head, after the last code commit (`27eb59a`):

| Check | Result |
|-------|--------|
| `npm test` | Pass: 66 files, 764 tests (was 63 files, 723 tests before the run) |
| `npm run build` | Pass |
| `npm run lint` | Pass, 0 warnings |
| `npm run lint:design` | Pass |
| `node scripts/sim/cloud-sync.mjs` | 10 of 10 scenarios pass (7 of them failed before `6e70f52`) |
| Visual check | Rebalance only (the one page whose output changed): light and dark, 1366 px and 390 px, no overflow, no console errors |
| Real Supabase, SQL, Vercel | Not touched |
| `main`, pull request, version | Not touched. Still v1.49.8 |

New test files: `src/store/sanitize` is covered in `migrate.test.ts`; `src/lib/storageKeys.test.ts`,
`src/lib/activitySummary.test.ts`, `src/pages/rebalanceTargets.test.ts`. Extended: `migrate.test.ts`,
`remoteLoad.test.ts`, `remoteSave.test.ts`, `undoDelta.test.ts`, `importPortfolio.test.ts`.

Commits, oldest first: `e2e2c05`, `6e70f52`, `bb26354`, `3e93c7d` (draft of this report), `6c67e32`, `f516781`,
`f36546e`, `ad102bc`, `27eb59a`, then the commit that adds this report and the refactor plan.

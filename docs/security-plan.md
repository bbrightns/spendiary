# Security plan: opening Spendiary to the public

First audit on 2026-10-28 (`main` at b4ce19c): **4 / 10** for a public launch. Updated the same day after the
account and database work below. Spendiary's own data isolation is solid; the main gaps left are plaintext
storage (Private mode) and the items under "Still open".

## 1. Where we are

| Area | State |
|---|---|
| Row isolation | `user_data`: RLS on, SELECT/INSERT/UPDATE/DELETE for `authenticated` and `auth.uid() = id`. No views, no storage buckets, no `SECURITY DEFINER` functions in `public` |
| Write lock | `user_data_write_lock` trigger installed (Step 1, lenient) on 2026-10-28. Step 2 (strict) not yet |
| Sign-in | Google OAuth + emailed one-time code (`shouldCreateUser: false`). OTP expiry shortened. Redirect URLs: production + `localhost:3000`, no wildcards |
| Keys | `VITE_API_TOKEN` is the `sb_publishable_` key (checked in the live request). No `service_role` / secret key in git |
| Accounts | 2FA on Google, GitHub (passkey + authenticator, no SMS), Vercel. Supabase signs in through GitHub |
| GitHub | `main` ruleset (PR + `check` + no force push / deletion), Dependabot alerts and security updates, secret scanning + push protection |
| Data at rest | `user_data.payload` is plaintext jsonb. The admin (dashboard, `service_role`, DB password) can read it |
| Browser hardening | Shipping now: nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, HSTS, CSP in **Report-Only**. Session token still lives in `localStorage` |
| Dependencies | Shipped code: 2 moderate (react-router / react-router-dom <= 7.17, open redirect). CI now fails on high/critical |
| Backups | Free plan, no Supabase backups. One manual CSV export of `user_data` (2026-10-28) |
| User control | Export / restore backup exist. No in-app account deletion |

## 2. Findings and what was done

1. **Three tables open to everyone (fixed).** `inventory`, `logs`, `store_meta` (a spare-parts inventory app, not
   Spendiary) had `Allow public read/write access` for `public` with `true / true`: anyone with the publishable key,
   which ships in the bundle, could read, change or delete every row without signing in. The policies were dropped
   on 2026-10-28, so RLS now denies everyone but the admin. Rows were exported to CSV first. Drop the tables and their
   functions (`get_next_part_id`, `adjust_stock_v2`) after 1-2 weeks if nobody needs them; if the inventory app is
   still in use, move it to its own Supabase project with sign-in instead of reopening the policies.
2. **Write lock was never installed (fixed).** Nothing stopped two devices or an old tab from overwriting each other.
   Step 1 of `supabase/sql/user_data_write_lock.sql` is now in place. Test: save normally; then save in a second,
   stale tab, which should show "Changed on another device".
3. **Price Edge Function is public.** `supabase/functions/smart-responder` answers any origin (`CORS *`) for anyone
   holding the publishable key. No secrets leak, but it can be called until the free quota runs out. Limit the
   origin and add a rate limit.
4. **Google sign-in shows the Supabase domain.** The account chooser says "continue to `<ref>.supabase.co`", which
   looks suspicious to new users. Fix with Branding in Google Cloud (app name, logo, privacy policy URL) or a custom
   auth domain (paid).
5. **Dependabot security PRs.** The first batch (#58-#62) arrived when security updates were switched on. #59 and
   #61 bump `vitest` to 5, which needs `vite` 6.4+, so `npm install` fails on their previews. Upgrade `vite` and
   `vitest` together (#62) as its own change and close the PRs it supersedes.

## 3. Plan

Decided: **Standard mode by default** (sign in with Google and go, no extra step). **Private mode** (end-to-end
encryption) is opt-in under Settings → Security.

### Ship 1 (in progress)
- [x] Security headers + CSP Report-Only in `vercel.json`; pre-render theme script moved to `public/theme-init.js`
- [x] `npm audit --omit=dev --audit-level=high` in CI
- [x] `.github/dependabot.yml` (weekly, minor/patch grouped)
- [ ] After deploy: check the live site's console for `[Report Only]` CSP messages (sign in with Google, email code,
      a price refresh). If clean for about a week, switch the header to an enforced `Content-Security-Policy`

### Ship 2
- [ ] `react-router-dom` to a fixed version (major bump: click through every route, both themes, phone and desktop)
- [ ] `vite` + `vitest` upgrade (Dependabot #62)

### Next
- [ ] Edge Function: allowed origins + rate limit (deployed in Supabase by hand)
- [ ] Settings → Security section: mode status, last backup date with a reminder, Export, delete account
- [ ] In-app **Delete account** (needs an Edge Function or `security definer` RPC; SQL file in `supabase/sql/`, run by hand)
- [ ] RLS regression test with Playwright `route()` mocks (never the real database)
- [ ] Write lock Step 2 (strict) about a week after Ship 1 is live
- [ ] Rewrite `src/app/Privacy.tsx` for both modes (who can see what, what is lost without the passphrase)

### Private mode (E2E), after the items above
- Browser makes a random 256-bit **master key**; payload encrypted with AES-GCM (Web Crypto), fresh IV per save.
- Master key stored in the row **wrapped** by a passphrase-derived key (Argon2id, or PBKDF2 with a high iteration
  count) and by a **recovery key** shown once. Changing the passphrase only re-wraps the master key. Passkeys
  (WebAuthn PRF) can be added later as another wrapper.
- Envelope: `{ v, alg, iv, ct, wrapped: [...], kdf: {...} }`; `migrate.ts` runs **after** decrypt.
- Load states: plain / encrypted / **locked**. A locked or failed decrypt must never be treated as empty, or the next
  save overwrites real data.
- Turning it on: download backup → set passphrase → save recovery key → encrypt and write through the write lock.
  Turning it off: decrypt and write plaintext.
- Open decisions: the key design above, and accepting that losing both passphrase and recovery key loses the data.

### Before announcing widely
- [ ] Backups: Supabase Pro (daily, includes auth users) or a weekly `pg_dump`, stored encrypted; test one restore
- [ ] Google consent Branding
- [ ] Tell users plainly: in Standard mode the admin can technically read the data; Private mode prevents that

## 4. Residual risks

- A compromised Vercel/GitHub account or a malicious dependency can ship code that reads data or the passphrase.
  Mitigations: 2FA, rulesets, lockfile, CSP, Dependabot.
- Metadata stays visible to the admin even in Private mode: user id, email, row size, save times.
- A compromised device defeats anything client-side.

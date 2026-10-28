# Security plan: opening Spendiary to the public

Status on 2026-10-28 (audit of `main` at b4ce19c). Score **4 / 10** for a public launch (about 6 / 10 for private use).

## 1. Where we are

| Area | State | Score |
|---|---|---|
| Row isolation | RLS on `user_data`, SELECT/INSERT/UPDATE/DELETE limited to `authenticated` and `auth.uid() = id`; write lock against stale writes | 8 |
| Sign-in | Google OAuth + emailed one-time code, `shouldCreateUser: false` for email. No password to leak. No MFA on the app side | 6 |
| Data at rest | `user_data.payload` is plaintext jsonb. Anyone with dashboard, `service_role` or DB access reads everything | 2 |
| Browser hardening | `vercel.json` has only a rewrite: no CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy. Session token sits in `localStorage` (readable by any XSS) | 2 |
| Code hygiene | No `dangerouslySetInnerHTML` / `eval` found. `.env` ignored, keys come from Vercel. CI runs lint, design lint, tests, build | 7 |
| Dependencies | `npm audit --omit=dev`: 2 moderate (react-router / react-router-dom <= 7.17, open redirect). Audit is not in CI | 5 |
| User control | No in-app account deletion (Privacy page says to ask the admin). Backup/restore exists (`store/backup.ts`) | 4 |
| Operations | 2FA on Supabase / GitHub / Vercel, backups (PITR) and key handling are not verified from the repo | ? |

Biggest gaps: **plaintext payload** and **no browser hardening**. They compound: an XSS can read the session token and, once C ships, the key.

## 2. Plan

Order: A, then C together with CSP and Export, then the rest of B, then Privacy copy.

### A. Accounts and keys (no code, same day)
- [ ] 2FA on Supabase, GitHub, Vercel, Google account that owns the OAuth client
- [ ] `service_role` key is only in Supabase / never in repo, Vercel env, or chat
- [ ] Supabase backups / PITR on; test one restore
- [ ] Limit who has access to the Supabase project and Vercel team
- [ ] Supabase Auth settings: redirect URL allow-list is only production + localhost, OTP expiry short, email rate limits on

### C. End-to-end encryption of `payload` (the real fix)
Design (decide first, see section 3):
- Browser generates a random 256-bit **master key**. The payload is encrypted with AES-GCM (Web Crypto), fresh 96-bit IV per save.
- The master key is stored in the row **wrapped** twice: by a key derived from the user's passphrase (Argon2id, or PBKDF2 with a high iteration count if no WASM) and by a **recovery key** shown once. Changing the passphrase only re-wraps the master key.
- Stored envelope: `{ v, alg, iv, ct, wrapped: [...], kdf: {...} }`. `v` lets `migrate.ts` handle future changes. Migration of app data still runs **after** decrypt.
- Master key lives in memory (and optionally a non-extractable `CryptoKey` in IndexedDB for "stay unlocked on this device"). Never in `localStorage`, never sent to the server.
- Touch points: `remoteSave.ts`, `remoteLoad.ts` (empty vs failed logic must stay intact: a decrypt failure is `failed`, never `empty`), `useCloudSync.ts`, `DataContext.tsx`, `backup.ts`, and every `localStorage` cache that holds user data (encrypt or drop).
- New UI: set passphrase, show recovery key (download / print), unlock screen, change passphrase, "I lost it" path (recovery key, else reset = data lost, with a clear warning).
- Tests: crypto round trip, wrong passphrase, tampered ciphertext (GCM auth fails), envelope versioning, load failure never becomes empty.
- Existing users: opt-in migration on next sign-in (read plaintext, encrypt, write with the existing write lock, keep one pre-migration backup the user can download).

### Ship with C
- [ ] CSP in `vercel.json`: `default-src 'self'`; `script-src 'self'`; `connect-src` limited to the Supabase URL and the price/FX APIs actually used; `frame-ancestors 'none'`; no `unsafe-inline` for scripts. Check Vite output and Google OAuth work before enforcing (start with Report-Only).
- [ ] `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (deny camera, mic, geolocation)
- [ ] Export of decrypted data (JSON/CSV) so nobody feels locked in

### B. The rest, before the public announcement
- [ ] Bump `react-router-dom` to a fixed version (breaking change, run tests and click through routes), then add `npm audit --omit=dev --audit-level=high` to CI
- [ ] In-app **Delete account** (needs an Edge Function or RPC with `security definer` that deletes the auth user and the row; SQL is run by hand in Supabase, so it needs a `supabase/sql/` file and a manual step)
- [ ] Rate limits / CAPTCHA on OTP requests (Supabase Auth settings, Turnstile if abuse appears)
- [ ] RLS regression test: Playwright with `route()` mocks proving user A cannot read or write user B (never against the real database)
- [ ] Secret scanning and Dependabot on the GitHub repo
- [ ] `public/.well-known/security.txt` and a security contact address

### Last: honest copy
- [ ] Rewrite `src/app/Privacy.tsx` (line ~24 "not encrypted", line ~35 "admin can see", line ~64 "ask the admin to remove it") to match what is true after C and Delete account. Add a short Security page: who can see what, what is lost if the passphrase and recovery key are lost.
- [ ] PDPA basics: controller name, contact, retention, deletion right.

## 3. Decisions needed before C

1. **Key source**: master key wrapped by passphrase + recovery key (recommended), or derived from the login (no password exists here, so not an option), or passphrase only.
2. **Lost passphrase and recovery key**: data is gone, support cannot help. Accept?
3. **Existing users**: how many real accounts have data in `user_data` today? Zero or few means a simple one-shot migration.
4. **Unlock UX**: ask for the passphrase every session, or remember on this device with a non-extractable key?
5. **Server-side features**: anything planned that needs to read payload on the server (analytics, support tooling, notifications)? E2E rules them out.

## 4. Residual risks after the plan

- Compromised Vercel account or a malicious dependency can ship code that steals the passphrase. Mitigations: 2FA, pinned lockfile, CSP, minimal dependencies, Dependabot review.
- Metadata is still visible to the admin: user id, email, row size, `updated_at` timing.
- Device compromise (malware, shared computer) defeats everything client-side.

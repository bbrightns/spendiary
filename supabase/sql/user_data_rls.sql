-- Row Level Security (RLS) for public.user_data
-- Run in the Supabase dashboard: SQL Editor → New query.
--
-- Without RLS, anyone holding the public anon key (it ships inside the app) can read or
-- overwrite every user's row. With RLS, each signed-in user can only touch the row whose
-- id is their own user id.

-- ── Step 1: check (read-only, safe to run any time) ──────────────────────────────────
-- Expect: rls_enabled = true, and SELECT, INSERT, UPDATE and DELETE policies
-- that all compare id with auth.uid().
select relname as table_name,
       relrowsecurity as rls_enabled,
       relforcerowsecurity as rls_forced
from pg_class
where oid = 'public.user_data'::regclass;

select policyname, cmd, roles, qual as using_expr, with_check
from pg_policies
where schemaname = 'public' and tablename = 'user_data';

select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'user_data' and column_name = 'id';

-- ── Step 2: add the missing DELETE policy ─────────────────────────────────────────────
-- Checked on 2026-10-18: RLS is on, and SELECT, INSERT and UPDATE policies already limit
-- each user to their own row (auth.uid() = id). There was no DELETE policy, so "Clear all
-- data" deleted nothing: with RLS, a delete that matches no allowed row returns no error,
-- the app never ran its fallback, and the data came back on the next sign-in.
-- (An UPDATE policy without WITH CHECK reuses its USING rule, so a user can't move a row
-- to someone else's id.)
create policy "Users can delete their own data." on public.user_data
  for delete to authenticated
  using ((select auth.uid()) = id);

-- ── Step 3: verify ───────────────────────────────────────────────────────────────────
-- Re-run step 1. Then open the app, sign in, and check your data still loads and saves.

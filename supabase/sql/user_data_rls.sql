-- Row Level Security (RLS) for public.user_data
-- Run in the Supabase dashboard: SQL Editor → New query.
--
-- Without RLS, anyone holding the public anon key (it ships inside the app) can read or
-- overwrite every user's row. With RLS, each signed-in user can only touch the row whose
-- id is their own user id.

-- ── Step 1: check (read-only, safe to run any time) ──────────────────────────────────
-- Expect: rls_enabled = true, and four policies (SELECT, INSERT, UPDATE, DELETE)
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

-- ── Step 2: fix (run only if step 1 shows rls_enabled = false or policies are missing) ──
-- Everything below is in one transaction: if any line fails, nothing changes.
-- `id::text = auth.uid()::text` works whether id is a uuid or a text column.
-- If step 1 already lists policies with other names, send them over before running this.
begin;

alter table public.user_data enable row level security;

drop policy if exists "user_data_select_own" on public.user_data;
drop policy if exists "user_data_insert_own" on public.user_data;
drop policy if exists "user_data_update_own" on public.user_data;
drop policy if exists "user_data_delete_own" on public.user_data;

create policy "user_data_select_own" on public.user_data
  for select to authenticated
  using (id::text = (select auth.uid())::text);

create policy "user_data_insert_own" on public.user_data
  for insert to authenticated
  with check (id::text = (select auth.uid())::text);

create policy "user_data_update_own" on public.user_data
  for update to authenticated
  using (id::text = (select auth.uid())::text)
  with check (id::text = (select auth.uid())::text);

create policy "user_data_delete_own" on public.user_data
  for delete to authenticated
  using (id::text = (select auth.uid())::text);

commit;

-- ── Step 3: verify ───────────────────────────────────────────────────────────────────
-- Re-run step 1. Then open the app, sign in, and check your data still loads and saves.

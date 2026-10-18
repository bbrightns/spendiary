-- Server-side write lock for public.user_data
-- Run in the Supabase dashboard: SQL Editor → New query.
--
-- Why: the app already checks `updated_at` before saving (src/store/remoteSave.ts), but that
-- check lives in the browser. An old copy of the app left open in a tab (1.26.7 or older) still
-- saves with a plain upsert and can overwrite newer data from another device. This trigger moves
-- the check into the database, where every write has to pass it.
--
-- How: with every save the app sends a request header (PostgREST hands request headers to SQL as
-- `request.headers`):
--   x-spendiary-base-updated-at: the `updated_at` it loaded. A write is rejected if the row has
--                                moved on since.
--   x-spendiary-force: 1         "Restore backup" replaces the data on purpose.
-- Headers belong to one request, so nothing is stored in the row and nothing carries over.
-- The trigger also stamps `updated_at` with the server's clock instead of the device's.
--
-- Roll out in two steps:
--   Step 1 (any time; the app works with or without it): lenient. Rejects a write whose header no
--          longer matches the row, but still lets through writes that send no header, so app
--          versions older than the one sending it keep saving.
--   Step 2 (about a week after the app update is live): strict. Also rejects writes with no
--          header, which means old app versions can no longer overwrite anything.
-- Errors use SQLSTATE 40001; the app reads that as "Changed on another device".

-- ── Step 1: lenient ───────────────────────────────────────────────────────────────────
create or replace function public.user_data_write_lock()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  headers json := coalesce(nullif(current_setting('request.headers', true), '')::json, '{}'::json);
  base text := headers->>'x-spendiary-base-updated-at';
  forced boolean := coalesce(headers->>'x-spendiary-force', '') = '1';
  strict_mode constant boolean := false;
begin
  if tg_op = 'UPDATE' and not forced then
    if base is null then
      if strict_mode and old.updated_at is not null then
        raise exception 'user_data write without a version stamp (old app version)'
          using errcode = '40001', hint = 'missing_base';
      end if;
    elsif old.updated_at is null or base::timestamptz is distinct from old.updated_at::timestamptz then
      raise exception 'user_data changed since it was loaded'
        using errcode = '40001', hint = 'stale_write';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists user_data_write_lock on public.user_data;
create trigger user_data_write_lock
  before insert or update on public.user_data
  for each row execute function public.user_data_write_lock();

-- ── Step 2: strict (about a week after the app update is live) ────────────────────────
-- Run Step 1 again with `strict_mode constant boolean := true;`
-- Note: strict mode also blocks editing a row by hand in the SQL Editor or Table Editor, since
-- those send no app headers. To fix a row by hand, run Undo first, then Step 1 or 2 again after.

-- ── Undo (if anything goes wrong) ─────────────────────────────────────────────────────
-- Saving then works exactly as it did before Step 1.
/*
drop trigger if exists user_data_write_lock on public.user_data;
drop function if exists public.user_data_write_lock();
*/

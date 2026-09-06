-- ============================================================
-- 620 (appendix 2) — the row is actually created.
--
-- ⚠️ APPLIED TO THE LIVE DATABASE BY HAND ON 6 SEP 2026, before this file
-- existed: the fault was found while the owner stood on it. This file is
-- the repository catching up with the database, not a change to be run
-- again — every statement here is idempotent, so re-running is harmless.
--
-- ⚠️ 0001 SAID IN A COMMENT that a trigger on auth.users creates the row:
--     «Never inserted by hand: a trigger on auth.users creates the row at
--      sign-up»
-- It was never written. `grep -n 'create trigger' supabase/migrations/*.sql`
-- returned exactly one, `profiles_no_admin_escalation` — a guard, not a
-- maker of rows. The comment promised something that did not exist, and the
-- debt is `470`'s, not `610`'s.
--
-- Measured on the live database after the first real sign-up:
--     users = 1 · profiles = 0 · triggers on auth.users = 0
-- and after this ran:
--     users = 1 · profiles = 1 · triggers on auth.users = 2
--
-- ⚠️ AND NOTHING LOOKED BROKEN, which is what made it dangerous.
-- `hydrateUserFromSession` falls back to local values — `display_name ||
-- prev.name`, and `email_confirmed_at` off the session when there is no
-- row — so the fault shows ONLY ON A SECOND DEVICE, where `prev` is empty:
-- the name comes back blank, and `is_admin` cannot be read at all.
--
-- ⚠️ ON THE NUMBER, AND IT IS A DELIBERATE DEVIATION FROM THE APPENDIX.
-- It asked for `0005` so this would precede `admin_find_users`. `0005` was
-- already taken by the batch this appends to and is pushed, and the
-- appendix's own rule is that the number is reserved from this directory at
-- execution time. Measured, the order has no effect on a rebuild:
-- `admin_find_users` is a function DEFINITION and reads no row when it is
-- created. Renaming a migration that may already have been applied is the
-- larger risk — a migration number is a key, the way a listing's id is.
-- ============================================================

-- ⚠️ `security definer` is required and is not to be removed: `profiles`
-- carries no insert policy by a written decision in `0002_rls.sql` — «no
-- insert policy: the row is made by a trigger». The trigger is therefore
-- the only road in, and it only passes through this.
-- ⚠️ `set search_path` is compulsory with it, for the reason written in
-- `0005`: without it a caller can put a schema of their own ahead of
-- `public` and change what the body touches.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public, auth as $$
begin
  insert into public.profiles (id, display_name, email_verified)
  values (
    new.id,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), ''),
    new.email_confirmed_at is not null
  )
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- and the column follows the account instead of going stale: nothing in
-- js/ ever writes profiles, so email_verified would have kept its default
-- for ever while the session said otherwise.
create or replace function public.sync_email_verified()
returns trigger language plpgsql security definer
set search_path = public, auth as $$
begin
  if new.email_confirmed_at is distinct from old.email_confirmed_at then
    update public.profiles
       set email_verified = (new.email_confirmed_at is not null),
           updated_at = now()
     where id = new.id;
  end if;
  return new;
end; $$;

drop trigger if exists on_auth_user_verified on auth.users;
create trigger on_auth_user_verified
  after update on auth.users
  for each row execute function public.sync_email_verified();

-- accounts that were created before the trigger existed
insert into public.profiles (id, display_name, email_verified)
select u.id,
       nullif(btrim(coalesce(u.raw_user_meta_data ->> 'display_name', '')), ''),
       u.email_confirmed_at is not null
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

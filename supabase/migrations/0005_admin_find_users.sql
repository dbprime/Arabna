-- ============================================================
-- 620 — one door, for reading only.
--
-- ⚠️ AND A CORRECTION TO THE BATCH FILE'S OWN MEASUREMENT, WRITTEN HERE
-- SO NOBODY BUILDS ON IT: it said `profiles` carries no admin read policy.
-- Measured in `0002_rls.sql`, the policy is
--     using (id = auth.uid() or public.is_admin())
-- so an admin CAN already read every profile row. The real gap is the one
-- §7.1 of that file states correctly: **`profiles` holds no email at all**.
-- The address lives in `auth.users`, which is not a table we open our own
-- policies on — so a join is needed, and a join across schemas from a
-- client is what this function is for. The gap is real; the reason given
-- for it was not.
--
-- ⚠️ AND NO EMAIL COLUMN IS ADDED TO `profiles`. A second copy of an
-- address that changes down two roads (sign-up, and a change confirmed by
-- code) parts from the original one day, and on that day nothing warns
-- anybody. The original is read where it lives.
-- ============================================================

create or replace function public.admin_find_users(q text)
returns table (
  id uuid, display_name text, email text, phone text,
  created_at timestamptz, email_verified boolean, deleted_at timestamptz
)
language plpgsql
-- ⚠️ `security definer` runs with the OWNER's rights, not the caller's, so
-- it steps past RLS by its nature. That is why the authorisation is the
-- FIRST STATEMENT and raises — never a condition inside `where`, which can
-- be edited away by somebody who does not see what it is holding.
security definer
-- ⚠️ Compulsory on every `security definer`: without a fixed search_path a
-- caller can put a schema of their own ahead of `public` and change which
-- objects the body actually touches.
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  return query
    select p.id, p.display_name, u.email::text, p.phone,
           p.created_at, p.email_verified, p.deleted_at
    from public.profiles p
    join auth.users u on u.id = p.id
    -- ⚠️ Three characters at least: without a floor an empty string
    -- returns the whole membership. This is a SEARCH, and there is
    -- deliberately no way to browse.
    where q is not null and length(btrim(q)) >= 3
      and (p.display_name ilike '%' || btrim(q) || '%'
        or p.phone        ilike '%' || btrim(q) || '%'
        or u.email        ilike '%' || btrim(q) || '%')
    limit 50;
end;
$$;

-- ⚠️ A visitor who has not signed in cannot execute it at all.
revoke all on function public.admin_find_users(text) from public, anon;
grant execute on function public.admin_find_users(text) to authenticated;

-- ⚠️ AND NOT ONE `update`, `insert` OR `delete` POLICY IN THIS MIGRATION.
-- The door opens for reading. Widening what an admin may do needs its own
-- batch and its own reason.

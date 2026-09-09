-- ============================================================
-- ARABNA — the ledger the runner asks, and the seven it is seeded with
-- ------------------------------------------------------------
-- 652. Until today every migration in this folder was executed by hand in
-- the Supabase SQL editor, and `docs/الحالة.md` §1.ج records that TWO of
-- the first seven had silently never run — `0005` answered
-- «Could not find the function public.admin_find_users» and `0004`
-- measured `tier2_by = 0` rows in information_schema.columns. Nothing in
-- the project could have told anybody: there was no record on the server
-- of what had run, so the repository and the database could disagree for
-- weeks with no signal at all.
--
-- This table is that record. It is the only thing the runner asks, and it
-- is OURS — not a third party's ledger written in a naming convention we
-- do not use. Three columns and no more: which file, when it ran, and the
-- commit it ran from.
--
-- ⚠️ THE SEED IS AN EXPLICIT LIST AND IS NEVER DERIVED FROM THE FOLDER.
-- A list built at run time from whatever `supabase/migrations/` happens to
-- hold would mark a file «executed» that has never been executed — and a
-- migration skipped in silence is the worst thing that can happen here,
-- worse than one forgotten, because a forgotten one is still waiting while
-- a skipped one is closed for ever. So the seven below are typed out, and
-- a file that is not in this list runs.
--
-- ⚠️ AND THE LIST IS SEVEN, NOT ELEVEN, AND THAT IS A MEASUREMENT.
-- `docs/الحالة.md` §1.ج marks `0001`–`0007` as executed and `0008`–`0011`
-- as «تُنفَّذ بيد مالك البرنامج بعد الدمج» — still outstanding. Only what
-- is measured as run is seeded. The four outstanding ones are every one of
-- them re-runnable with no effect (`add column if not exists` ×17,
-- `create or replace function` ×2, `drop trigger if exists` before each
-- `create trigger` ×18, and one `insert ... on conflict do nothing`), so
-- if they HAVE been run by hand since, the runner repeats them and nothing
-- moves. The asymmetry is the whole argument: a needless repeat costs
-- nothing, and a silent skip costs everything.
--
-- ⚠️ The date is the day the state file MEASURED them, not the day each
-- one ran — the first three ran before it. The detail is in §1.ج, and the
-- null commit is the mark of «run by hand in the SQL editor», which is
-- what every one of these seven was.
--
-- ⚠️ No `||` and no `*`: the SQL editor's paste field drops both, measured
-- twice. The rule holds here even though the runner is what executes this.
-- ============================================================

create table if not exists public.migration_log (
  file        text primary key,
  ran_at      timestamptz not null default now(),
  commit_sha  text
);

-- ⚠️ ARMED, AND WITH NO POLICY AT ALL — which is the point, not an
-- oversight. Every other table in this schema opens a door for somebody;
-- this one opens none. The publishable key ships on every phone, and a
-- reader who could write this table could mark a migration «executed» and
-- close it for ever. The runner connects as the table's owner, which
-- bypasses row level security, so it needs no policy to do its work.
alter table public.migration_log enable row level security;

-- and the grants are withdrawn as well, so the two roles the API uses do
-- not merely get an empty answer — they do not reach the table at all.
revoke all on public.migration_log from anon;
revoke all on public.migration_log from authenticated;

insert into public.migration_log (file, ran_at, commit_sha) values
  ('0001_schema.sql',                       timestamptz '2026-09-06 00:00:00+00', null),
  ('0002_rls.sql',                          timestamptz '2026-09-06 00:00:00+00', null),
  ('0003_worship_column.sql',               timestamptz '2026-09-06 00:00:00+00', null),
  ('0004_tier2_by.sql',                     timestamptz '2026-09-06 00:00:00+00', null),
  ('0005_admin_find_users.sql',             timestamptz '2026-09-06 00:00:00+00', null),
  ('0006_profiles_on_signup.sql',           timestamptz '2026-09-06 00:00:00+00', null),
  ('0007_admin_insert_businesses.sql',      timestamptz '2026-09-06 00:00:00+00', null)
on conflict (file) do nothing;

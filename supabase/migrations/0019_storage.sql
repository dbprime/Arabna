-- 0019 — 660: the file store, and the picture leaves the device.
--
-- ⚠️ NO `|` TWICE AND NO STAR ANYWHERE IN THIS FILE, and that forbids the
-- block comment as well as `count(star)`: the SQL editor's paste field
-- drops both characters — measured twice — so every comment here is a line
-- comment, `concat()` stands for the doubled pipe, and `select 1` stands
-- for `select star`. Since `652` the runner applies this file itself, and
-- the rule is kept anyway: a migration that cannot be pasted by hand is a
-- migration with one way in.
--
-- Every statement is idempotent, so a re-run moves nothing.
--
-- ⚠️ AND THIS IS THE ONE BATCH IN THE SERIES THAT NEEDS STRUCTURE THAT DOES
-- NOT EXIST. `650`, `655` and `656` each found their tables and their
-- policies already written. Measured before a line of this was written:
--     grep -rn "sb.storage" js/                  ->  no line
--     grep -rn "avatar"  supabase/migrations/    ->  no line
--     grep -rn "photos"  supabase/migrations/    ->  no column on classifieds
-- So the build here is a migration and then a client, never a client alone.

-- ============================================================
-- 1) FOUR PRIVATE BUCKETS
-- ============================================================
-- ⚠️ FOUR AND NOT ONE, because each has a different rule for who may READ
-- it, and one bucket carrying four rules in one policy parts company the
-- first time one of them changes.
--
-- ⚠️ AND EVERY ONE OF THEM IS PRIVATE. A public bucket means a photo held
-- for review can be opened by its link before the admin has seen it — and
-- that is the exact text of `biz_photos`'s own read policy in `0002`:
--     using (status = 'approved' or uploader_id = auth.uid() or is_admin())
-- A public bucket undoes that policy from behind, so reading is by a
-- short-lived signed URL and never by a permanent one.
--
-- ⚠️ AND THE SIZE LIMIT IS REPEATED HERE ON PURPOSE. `MAX_BYTES` in the
-- client is 10 MiB and `MAX_SIDE` is 1200; what only the client guards is
-- not guarded, because the anon key is on every phone.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars',      'avatars',      false, 10485760, array['image/jpeg','image/png','image/webp']),
  ('biz-photos',   'biz-photos',   false, 10485760, array['image/jpeg','image/png','image/webp']),
  ('listings',     'listings',     false, 10485760, array['image/jpeg','image/png','image/webp']),
  ('event-photos', 'event-photos', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public             = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ⚠️ THE COLUMNS COME BEFORE THE POLICIES, AND THE ORDER IS A MEASUREMENT
-- AND NOT A LAYOUT. Written the other way round, this file aborts on a real
-- PostgreSQL 16 with «column p.avatar_path does not exist»: the read policy
-- on `avatars` names that column, and a policy is compiled when it is
-- created, not when it is evaluated. It is `0013`'s lesson from the other
-- side — there the policies had to come DOWN before the column moved, here
-- the column has to go UP before the policy names it — and both were found
-- by applying the file rather than by reading it.

-- ============================================================
-- 2) THE ACCOUNT'S PICTURE — one column, and a path, never a URL
-- ============================================================
-- ⚠️ A PATH AND NOT A LINK. Signed links expire, and a column holding an
-- expired link holds text that opens nothing.
--
-- ⚠️ AND NO SECOND COLUMN FOR THE REVIEW STATE. It is derived: a path in
-- this column IS an approved picture. What waits for the admin waits in
-- `flags` with `kind = 'avatar'` — the table that already holds what is
-- waiting on a human decision — and the admin writes this column when the
-- answer is yes.
alter table public.profiles add column if not exists avatar_path text;

-- ============================================================
-- 3) THE CLASSIFIED'S PHOTOS, AND THE EVENT'S
-- ============================================================
-- ⚠️ AN ARRAY OF PATHS, NEVER OF LINKS — the same reason as the column
-- above. And `not null default` an empty array, so a row written before
-- this migration reads as «no photos» rather than as null.
alter table public.classifieds add column if not exists photos text[] not null default '{}';

-- ⚠️ AND THIS IS THE COLUMN WHOSE ABSENCE WAS THE FAULT. `addClassified`
-- never sent the photos and `mapLiveClsRowToJs` returned `photos: []` as a
-- literal, so a listing published with two photos was read on a second
-- device with none — and its publisher never saw it, because their own
-- device still held what they chose. It is `645`'s city fault, in the same
-- line of the same function, left behind when the city was repaired.
alter table public.events add column if not exists photo_path text;


-- ============================================================
-- 4) THE STORAGE POLICIES — one rule, written four times
-- ============================================================
--     upload  ->  the path begins with an id the uploader owns
--     read    ->  what the admin approved, or what the reader uploaded,
--                 or the admin
--     delete  ->  the uploader or the admin
--
-- ⚠️ AND A REJECTED FILE IS NOT DELETED. Its row is marked `rejected` and
-- the file stays, so a report arriving two days later has something to
-- open.

-- ---- avatars: the folder IS the account id ----
-- ⚠️ «Approved» here is not a status column: `profiles.avatar_path` names
-- the one path the admin accepted, so a path that is not it is a pending
-- upload and is readable by its owner and the admin alone. One fact in one
-- place — a second status column would carry the same truth twice.
-- ⚠️ AND «APPROVED» IS ASKED THROUGH A FUNCTION, BECAUSE `profiles` IS THE
-- ONE PRIVATE TABLE OF THE FOUR. Measured on a real PostgreSQL 16 rather
-- than read: with the test written inline as
--     exists (select 1 from public.profiles p where p.avatar_path = name)
-- the subquery is itself governed by `profiles`'s own policy
-- («own row: read using (id = auth.uid() or is_admin())»), so a reader who
-- is not the picture's owner sees NO row and the answer is false — and an
-- APPROVED avatar stays invisible to everybody except its owner and the
-- admin. The whole point of approving it, defeated, with nothing raised.
--
-- ⚠️ AND THE OTHER THREE BUCKETS NEED NO SUCH FUNCTION, WHICH IS THE
-- MEASUREMENT AND NOT AN ASSUMPTION: `biz_photos` hands an approved row to
-- everybody, `classifieds` hands a live one to everybody, and `events` is
-- `all: read using (true)`. Only `profiles` is private, so only this one
-- branch cannot see what it has to ask about.
--
-- ⚠️ `security definer` IS REQUIRED HERE and is not the convenience it was
-- refused as in `0014`: the caller genuinely cannot reach the row. It is
-- given the narrowest question it can be given — one path in, a boolean
-- out — so it can tell nobody whose picture it is or how many there are.
create or replace function public.avatar_is_approved(p_path text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select exists (select 1 from public.profiles p where p.avatar_path = p_path)
$fn$;

revoke all on function public.avatar_is_approved(text) from public;
grant execute on function public.avatar_is_approved(text) to anon, authenticated;

drop policy if exists "avatars: read" on storage.objects;
create policy "avatars: read" on storage.objects for select
  using (
    bucket_id = 'avatars'
    and (
      public.avatar_is_approved(name)
      or (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

drop policy if exists "avatars: insert" on storage.objects;
create policy "avatars: insert" on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars: delete" on storage.objects;
create policy "avatars: delete" on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- ---- biz-photos: the folder is a business the uploader owns ----
-- ⚠️ AND THE FOLDER IS MATCHED BOTH WAYS, `id` AND `seed_id`. 485 of the
-- 514 businesses in the directory are seeds whose app id is `b30` … `b515`
-- and whose row — when there is one — carries that in `seed_id` and a uuid
-- of its own in `id`. A test on `id` alone reaches 29 of 514.
drop policy if exists "biz-photos: read" on storage.objects;
create policy "biz-photos: read" on storage.objects for select
  using (
    bucket_id = 'biz-photos'
    and (
      exists (select 1 from public.biz_photos bp
               where bp.path = name and bp.status = 'approved')
      or owner = auth.uid()
      or public.is_admin()
    )
  );

drop policy if exists "biz-photos: insert" on storage.objects;
create policy "biz-photos: insert" on storage.objects for insert
  with check (
    bucket_id = 'biz-photos'
    and exists (
      select 1 from public.businesses b
      where (b.id::text = (storage.foldername(name))[1]
             or b.seed_id = (storage.foldername(name))[1])
        and b.owner_id = auth.uid()
    )
  );

drop policy if exists "biz-photos: delete" on storage.objects;
create policy "biz-photos: delete" on storage.objects for delete
  using (bucket_id = 'biz-photos' and (owner = auth.uid() or public.is_admin()));

-- ---- listings: the folder is a listing, and the listing's own rule ----
-- the same three branches `0002` gives the row itself: published and not
-- hidden, or the reader's own, or the admin
drop policy if exists "listings: read" on storage.objects;
create policy "listings: read" on storage.objects for select
  using (
    bucket_id = 'listings'
    and (
      exists (select 1 from public.classifieds c
               where c.id::text = (storage.foldername(name))[1]
                 and c.status = 'live' and c.hidden = false)
      or owner = auth.uid()
      or public.is_admin()
    )
  );

drop policy if exists "listings: insert" on storage.objects;
create policy "listings: insert" on storage.objects for insert
  with check (
    bucket_id = 'listings'
    and exists (
      select 1 from public.classifieds c
      where c.id::text = (storage.foldername(name))[1] and c.owner_id = auth.uid()
    )
  );

drop policy if exists "listings: delete" on storage.objects;
create policy "listings: delete" on storage.objects for delete
  using (bucket_id = 'listings' and (owner = auth.uid() or public.is_admin()));

-- ---- event-photos: THE EVENT'S STATUS, never the uploader's standing ----
-- ⚠️ THE FIRST DRAFT OF THIS BATCH SAID «THE ADMIN ALONE UPLOADS», TO
-- AVOID A REVIEW THAT DOES NOT EXIST. That is a shortcut and it is
-- withdrawn: the EVENT itself is reviewed — it enters `pending` and the
-- admin approves it — so its photo is reviewed with it, and nothing is
-- reviewed twice.
--
-- ⚠️ AND THIS CLOSES A HOLE NOTHING ELSE CLOSES. `events` carries
-- `all: read using (true)`, so the row of a PENDING proposal is readable
-- by everybody today. Were this bucket public, or were its rule the
-- uploader's standing alone, the photo of a proposal the admin has not
-- seen could be opened by anyone holding the link. The status rule refuses
-- it from the storage side and does not wait for the row's policy to be
-- repaired — and that repair is recorded as a debt, not done here.
drop policy if exists "event-photos: read" on storage.objects;
create policy "event-photos: read" on storage.objects for select
  using (
    bucket_id = 'event-photos'
    and (
      exists (select 1 from public.events e
               where e.id::text = (storage.foldername(name))[1] and e.status = 'live')
      or owner = auth.uid()
      or public.is_admin()
    )
  );

drop policy if exists "event-photos: insert" on storage.objects;
create policy "event-photos: insert" on storage.objects for insert
  with check (
    bucket_id = 'event-photos'
    and (
      exists (select 1 from public.events e
               where e.id::text = (storage.foldername(name))[1]
                 and e.proposer_id = auth.uid())
      or public.is_admin()
    )
  );

drop policy if exists "event-photos: delete" on storage.objects;
create policy "event-photos: delete" on storage.objects for delete
  using (bucket_id = 'event-photos' and (owner = auth.uid() or public.is_admin()));

-- ============================================================
-- 5) THE ADMIN WRITES THAT COLUMN THROUGH A FUNCTION
-- ============================================================
-- ⚠️ AND THE ADMIN'S WRITE COLLIDES WITH `0002`'s POLICY WITH NO ERROR
-- SHOWN. Measured:
--     create policy "own row: update" on public.profiles for update
--       using (id = auth.uid()) with check (id = auth.uid());
-- There is no `is_admin()` branch in it — unlike `businesses`, which has
-- one — so an admin updating somebody else's row matches ZERO rows, and
-- PostgREST answers 200 with an empty body: the reviewer reads «approved»,
-- the picture never appears to anybody, and the `flags` row is closed.
--
-- ⚠️ AND THE ANSWER IS A FUNCTION, NOT A WIDER POLICY. Widening
-- `profiles`'s update policy for the admin opens EVERY column in the table
-- to rescue one. This is `0005`'s own pattern: the authorisation is the
-- function's FIRST STATEMENT and it raises, never a condition inside a
-- `where` that can be edited away.
create or replace function public.approve_avatar(p_user uuid, p_path text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if not public.is_admin() then
    raise exception 'not authorised';
  end if;
  update public.profiles set avatar_path = p_path where id = p_user;
  return found;
end;
$fn$;

revoke all on function public.approve_avatar(uuid, text) from public;
grant execute on function public.approve_avatar(uuid, text) to authenticated;

-- ⚠️ AND THE EVENT'S PATH NEEDS ONE TOO, FOR A REASON MEASURED RATHER THAN
-- ASSUMED. The storage path begins with the event's id and the id is the
-- server's, so the picture can only be attached AFTER the row exists — and
-- `0002` gives an organiser «propose», an INSERT policy, and NO UPDATE OF
-- ANY KIND. So an organiser's own follow-up write is refused, the row keeps
-- no path, and the picture stays on the phone: the very fault this batch
-- closes, surviving in the one road an ordinary person takes.
--
-- ⚠️ AND THE ANSWER IS THE NARROWEST FUNCTION, NOT AN UPDATE POLICY ON
-- `events`. An update policy for the proposer would let them rewrite the
-- date, the venue and the body of a proposal after the admin has read it.
-- This one writes ONE column and asks first.
create or replace function public.set_event_photo(p_event uuid, p_path text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if not exists (
    select 1 from public.events e
     where e.id = p_event
       and (e.proposer_id = auth.uid() or public.is_admin())
  ) then
    raise exception 'not authorised';
  end if;
  update public.events set photo_path = p_path where id = p_event;
  return found;
end;
$fn$;

revoke all on function public.set_event_photo(uuid, text) from public;
grant execute on function public.set_event_photo(uuid, text) to authenticated;

-- ============================================================
-- 6) A BUSINESS PHOTO'S ID IS THE ID THE APP HAS — the fourth of `0013`'s
--    class, and the one its own sweep did not reach
-- ============================================================
-- ⚠️ MEASURED, AND IT IS NOT IN THIS BATCH'S SPECIFICATION EITHER, WHICH
-- CALLS `biz_photos` «ready with its columns and its policies». It is not:
--     biz_photos.biz_id   uuid not null references public.businesses(id)
-- and what `setBizPhotos` is handed is `b.id` — `b30` for a seed. So the
-- type refuses it AND the foreign key has nothing to point at, exactly as
-- `0013` measured for `flags.ref_id`, `reviews.biz_id` and `claims.biz_id`.
-- Three were swept and this fourth was passed over, and it would have made
-- every business photo in this batch a write that cannot happen.
--
-- ⚠️ AND THE POLICIES ARE READ BEFORE THE COLUMN IS MOVED. `0013` aborted
-- on a real PostgreSQL because a policy depended on the column it altered.
-- Measured here: `biz_photos`'s four policies name `status`, `uploader_id`
-- and `is_admin()` and NOT `biz_id`, so none has to come down. That is a
-- measurement, not an assumption — and it is why this file was applied to
-- a real PostgreSQL 16 from empty before it was called finished.
alter table public.biz_photos drop constraint if exists biz_photos_biz_id_fkey;
alter table public.biz_photos alter column biz_id type text;

-- ⚠️ AND THE CASCADE THE KEY CARRIED HAS TO BE RESTORED, or a business
-- deleted for good leaves its photos behind pointing at nothing — which is
-- `0014`'s whole subject, and the price it refused to pay silently.
-- `0014` HAS RUN AND IS NOT EDITED: this is a new definition of the same
-- function, which is what `create or replace` is for, and the trigger it
-- is attached to needs no change at all.
create or replace function public.cascade_business_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  delete from public.reviews
   where biz_id = old.id::text
      or (old.seed_id is not null and biz_id = old.seed_id);

  delete from public.claims
   where biz_id = old.id::text
      or (old.seed_id is not null and biz_id = old.seed_id);

  delete from public.biz_photos
   where biz_id = old.id::text
      or (old.seed_id is not null and biz_id = old.seed_id);

  return old;
end;
$fn$;

-- ============================================================
-- 7) A CEILING THAT LEFT WITH THE FOREIGN KEY (660 §11)
-- ============================================================
-- ⚠️ FOUND IN THE INDEPENDENT CLOSING CHECK OF `655`, AND ITS PLACE IS
-- HERE because this batch is the last before the launch gate and carries a
-- migration already.
--
-- `0013` dropped the foreign keys on `reviews.biz_id` and `claims.biz_id`
-- by a correct decision. What went with them, undecided, was the CEILING:
--     and auth.uid() is distinct from (select b.owner_id from businesses b
--                                       where b.id::text = biz_id or b.seed_id = biz_id)
-- The inner query returns nothing for any invented `biz_id`, and
-- `auth.uid() is distinct from NULL` is TRUE — so any signed-in account can
-- write a review row with any text at all in `biz_id`. The unique pair
-- limits one row per pair, and the pair is unbounded, so the rows are.
--
-- ⚠️ NO PUBLISHED FAULT COMES OF IT TODAY. The harm is unbounded writing
-- into a table whose storage we pay for.
--
-- ⚠️ AND THE GUARD IS TWO BRANCHES AND NOT ONE, AND THE REASON IS
-- MEASURED: a seed has no row, so `exists` alone would refuse a review on
-- any of the 485 real businesses in the directory. The shape `b` followed
-- by digits bounds the invented by the number of seeds, and the unique
-- pair bounds each of those to one row per account.
drop policy if exists "own: insert" on public.reviews;
create policy "own: insert" on public.reviews for insert
  with check (
    author_id = auth.uid()
    and auth.uid() is distinct from (
      select b.owner_id from public.businesses b
      where b.id::text = biz_id or b.seed_id = biz_id
    )
    and (
      biz_id ~ '^b[0-9]+$'
      or exists (
        select 1 from public.businesses b
        where b.id::text = biz_id or b.seed_id = biz_id
      )
    )
  );

drop policy if exists "own: insert" on public.claims;
create policy "own: insert" on public.claims for insert
  with check (
    claimer_id = auth.uid()
    and (
      biz_id ~ '^b[0-9]+$'
      or exists (
        select 1 from public.businesses b
        where b.id::text = biz_id or b.seed_id = biz_id
      )
    )
  );

-- ============================================================
-- 8) AND `flags.kind` NOW HAS FIVE VALUES
-- ============================================================
-- ⚠️ `0001`'s inline note beside the column still counts four — «business ·
-- classified · review · message» — and there is no `check` constraint on
-- it, so the insert succeeds and the note alone becomes false. `0001` HAS
-- RUN AND IS NOT EDITED beyond the one pointer line this batch adds to it;
-- the truth is written into the database itself, where a reader of the
-- live schema finds it.
comment on column public.flags.kind is
  'business · classified · review · message · avatar';

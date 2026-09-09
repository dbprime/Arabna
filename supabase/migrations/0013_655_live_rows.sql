-- 0013 — 655: the four dead tables are opened, and the ids they hold are
-- the ids the app has.
--
-- ⚠️ NO `||` AND NO `*` ANYWHERE IN THIS FILE. The SQL editor's paste field
-- drops both characters — measured twice — so `concat()` stands for `||`
-- and `count(1)` for `count(*)`. Since `652` the runner applies this file
-- itself, and the rule is kept anyway: a migration that cannot be pasted by
-- hand is a migration with one way in.
--
-- Every statement is idempotent, so a re-run moves nothing.

-- ============================================================
-- 1) A BUSINESS ID IS THE ID THE APP HAS, AND THE APP'S ARE TEXT
-- ============================================================
-- ⚠️ THE OWNER'S DECISION OF 6 SEPTEMBER 2026, SWEPT TO ITS CLASS.
-- It was taken for `flags.ref_id` and its reason is written in `655` §4.2:
-- the directory is the product, the button stands on 514 pages, and
-- «locking it to the live rows alone leaves the button visible on 499
-- pages and working on none of them — a button that lies is worse than a
-- button that is missing».
--
-- Measured while building `655`, and the spec caught one of three:
--   flags.ref_id     uuid   -- named in the spec
--   reviews.biz_id   uuid   -- NOT named, and identical
--   claims.biz_id    uuid   -- NOT named, and identical
-- against `b1` … `b515`, which is what all 514 directory businesses carry.
-- So a review or a claim on any one of them could not be written at all:
-- the type is wrong, and the foreign key has nothing to point at, because
-- a seed has no row in `businesses` until somebody edits it into a coat —
-- and `own: insert` refuses to let a reviewer create one.
--
-- ⚠️ AND THE PRICE IS SAID AND NOT HIDDEN: `reviews` and `claims` lose the
-- foreign key to `businesses` and its `on delete cascade`. That cost is
-- real, unlike `flags`'s, where the key could never have existed at all
-- (`ref_id` points at four different tables by `kind`). `deleteBusiness`
-- already takes the reviews with it in the app, and the day every business
-- is a live row this is reversible with the reverse of these two lines.
-- ⚠️ It is ONE item the owner can overturn without the batch being rebuilt.
alter table public.flags   alter column ref_id type text;

-- ⚠️ AND THE REASON IS BILINGUAL EVERYWHERE ELSE IN THIS SCHEMA. Every
-- other two-language value it holds is `jsonb` — `claims.details`, and the
-- notification's own title and body below — while `flags.reason` alone was
-- `text`, and what the app hands it is `{ar, en}`. The table is empty, so
-- the conversion costs nothing and the reader takes either shape.
alter table public.flags   alter column reason type jsonb using to_jsonb(reason);

alter table public.reviews drop constraint if exists reviews_biz_id_fkey;
alter table public.reviews alter column biz_id type text;

alter table public.claims  drop constraint if exists claims_biz_id_fkey;
alter table public.claims  alter column biz_id type text;

-- ⚠️ AND THE TWO POLICIES THAT COMPARED THAT COLUMN HAVE TO BE REWRITTEN,
-- or they raise on every evaluation: `b.id` is uuid and `biz_id` is text
-- now, and PostgreSQL refuses the comparison rather than guessing.
--
-- ⚠️ AND THE REWRITE CLOSES A HOLE THE OLD SHAPE HAD: a seed business is
-- reached by `seed_id`, not by `id`, so `b.id = biz_id` alone would find
-- no row for `b30` — and `auth.uid() is distinct from NULL` is TRUE, which
-- would let the claimed owner of a seed business review their own shop.
-- That is the FTC line the policy exists to hold, so both halves are asked.
drop policy if exists "own: insert" on public.reviews;
create policy "own: insert" on public.reviews for insert
  with check (
    author_id = auth.uid()
    and auth.uid() is distinct from (
      select b.owner_id from public.businesses b
      where b.id::text = biz_id or b.seed_id = biz_id
    )
  );

drop policy if exists "biz owner: insert" on public.review_replies;
create policy "biz owner: insert" on public.review_replies for insert
  with check (
    auth.uid() = (
      select b.owner_id from public.businesses b
      join public.reviews r on (b.id::text = r.biz_id or b.seed_id = r.biz_id)
      where r.id = review_id
    )
  );

-- ⚠️ AND A REPLY ITS AUTHOR CAN POST AND CANNOT REMOVE IS A BUTTON THAT
-- LIES. `review_replies` carries read, insert and update policies and no
-- delete, while `#/directory/<id>` has offered its owner a delete button
-- since the reply was built — so the row would have stayed on the page
-- after the screen said it was gone. `reviews` already grants exactly this
-- to a review's own author, and a reply is the same shape: the owner's own
-- words on their own page.
-- ⚠️ It is NOT the shape of `messages`, whose missing delete is written
-- with its reason («a message that can be edited after it is read is not a
-- record, and a report rests on it»). That one is deliberate and stays.
drop policy if exists "own+admin: delete" on public.review_replies;
create policy "own+admin: delete" on public.review_replies for delete
  using (author_id = auth.uid() or public.is_admin());

-- ============================================================
-- 1b) A STRANGER MAY SUGGEST A PLACE OF WORSHIP, AND OWNS NOTHING BY IT
-- ============================================================
-- ⚠️ `#/prayer` and `#/mass` have carried «know a masjid that is not
-- here?» since `V.04.0`, and `suggestWorship` unshifted the suggestion onto
-- `state.extraBusinesses` — the suggester's own phone. So whoever added a
-- masjid or a church was thanked, their suggestion landed on their device,
-- and it never reached the admin at all.
--
-- ⚠️ AND IT CANNOT SIMPLY GO THROUGH `addBusiness`, because `own: insert`
-- demands `owner_id = auth.uid()` — so a suggestion would have made its
-- sender the OWNER of somebody else's masjid, and «owned» is derived from
-- `owner_id`. The policy is widened by exactly one shape and no more: a
-- signed-in account may insert a row that is OWNERLESS, marked
-- `source = 'suggested'`, and HELD at `pendingReview` so no reader sees it
-- before the admin does. It cannot be published, and it makes nobody an
-- owner of anything.
drop policy if exists "own: insert" on public.businesses;
create policy "own: insert" on public.businesses for insert
  with check (
    owner_id = auth.uid()
    or (owner_id is null and source = 'suggested' and status = 'pendingReview')
  );

-- ============================================================
-- 2) THE NOTIFICATION HAS AN ADDRESSEE (655 §6ب)
-- ============================================================
-- `pushNotif` took no addressee, wrote no row and knew no account: it
-- unshifted onto `state.extraNotifs`, the notification list of whichever
-- device ran it. Ten of its fourteen callers address somebody who is not
-- the person acting — so the notification reached the actor.
--
-- ⚠️ And its heaviest form deceives the ADMIN, not the reader: he rejects
-- an advertisement, writes his reason, the screen says «the advertiser was
-- told», and the notification lands in his own list. He then believes a
-- warning was given, and escalates against somebody who was told nothing.
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  icon       text not null default 'bell',
  -- both languages in one value, the shape every notification already has
  title      jsonb not null,
  body       jsonb,
  route      text,
  read_at    timestamptz
);
create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

-- the addressee reads their own, and nobody reads anybody else's
drop policy if exists "own: read" on public.notifications;
create policy "own: read" on public.notifications for select
  using (user_id = auth.uid());

-- and marks their own read
drop policy if exists "own: update" on public.notifications;
create policy "own: update" on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ⚠️ INSERT IS THE ADMIN'S ALONE, AND THAT IS THE DECISION, NOT AN
-- OVERSIGHT. A table any signed-in account may write into another
-- account's list is a spam channel with a policy on it. The ten callers
-- that deceive are the panel's own decisions, and those are the admin's.
-- ⚠️ A notification from one ORDINARY user to another — «somebody reviewed
-- your business», «a message about your listing» — is therefore NOT
-- deliverable, so its sentence changes rather than the fault being
-- swallowed, and the misdirected local copy is deleted rather than left
-- ringing on the wrong phone. Delivering those needs a trigger that reads
-- the row that caused them, and it is recorded as a debt.
drop policy if exists "admin: insert" on public.notifications;
create policy "admin: insert" on public.notifications for insert
  with check (public.is_admin());

-- `updated_at` on the new table too, by the trigger 0009 defined for the
-- other seventeen: a column that names itself «last updated» and only ever
-- says «created» is the fault 0009 was written to close, and a table added
-- after it that skips the trigger reopens it.
drop trigger if exists set_updated_at on public.notifications;
create trigger set_updated_at before update on public.notifications
  for each row execute function public.set_updated_at();

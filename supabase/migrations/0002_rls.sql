-- ============================================================
-- ARABNA — the server contract: row level security
-- ------------------------------------------------------------
-- ⚠️ NOT ONE TABLE WITHOUT IT. A table in `public` with no
-- `enable row level security` is open to the world through the
-- `anon` key — and that key ships with the app onto every phone.
-- This is not caution; it is the difference between a database and
-- a public file.
-- ============================================================

alter table public.profiles        enable row level security;
alter table public.businesses      enable row level security;
alter table public.classifieds     enable row level security;
alter table public.reviews         enable row level security;
alter table public.review_replies  enable row level security;
alter table public.messages        enable row level security;
alter table public.claims          enable row level security;
alter table public.biz_photos      enable row level security;
alter table public.biz_verify      enable row level security;
alter table public.offers          enable row level security;
alter table public.flags           enable row level security;
alter table public.events          enable row level security;
alter table public.articles        enable row level security;
alter table public.greetings       enable row level security;
alter table public.settings        enable row level security;
alter table public.admin_log       enable row level security;
alter table public.receipts        enable row level security;

-- the test that repeats, written once
create or replace function public.is_admin() returns boolean
language sql security definer stable as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- ============ people — owned by their subject ============
create policy "own row: read"   on public.profiles for select
  using (id = auth.uid() or public.is_admin());
create policy "own row: update" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
-- ⚠️ no insert policy: the row is made by a trigger on auth.users at
-- sign-up. And no delete policy: deletion is a mark in `deleted_at`.

-- ⚠️ AND THE EXPLICIT GUARD ON is_admin. The column carries no write
-- policy, but «the app does not send it» is not a guarantee — the anon
-- key is on every phone and anything can send anything. This refuses the
-- change at the database, for any client session.
create or replace function public.refuse_admin_escalation() returns trigger
language plpgsql security definer as $$
begin
  if new.is_admin is distinct from old.is_admin then
    raise exception 'is_admin is not writable from a client session';
  end if;
  return new;
end;
$$;
create trigger profiles_no_admin_escalation
  before update on public.profiles
  for each row execute function public.refuse_admin_escalation();

-- ============ read by everyone, written by its owner ============
-- ⚠️ THIS IS WHAT MAKES A HELD RECORD ACTUALLY HELD. Today
-- `pendingReview` is hidden by a function in js/store.js — on the
-- device of the person it is hiding from — so anybody who edited the
-- app file saw it. With this policy the row does not leave the database
-- at all. The difference is not cosmetic: it is hiding versus refusing.
create policy "live: read" on public.businesses for select
  using (status = 'live' or owner_id = auth.uid() or public.is_admin());
create policy "own: insert" on public.businesses for insert
  with check (owner_id = auth.uid());
create policy "own: update" on public.businesses for update
  using (owner_id = auth.uid() or public.is_admin());

create policy "live: read" on public.classifieds for select
  using ((status = 'live' and hidden = false) or owner_id = auth.uid() or public.is_admin());
create policy "own: insert" on public.classifieds for insert
  with check (owner_id = auth.uid());
create policy "own: update" on public.classifieds for update
  using (owner_id = auth.uid() or public.is_admin());

-- ============ messages — two parties, no more ============
create policy "two parties: read" on public.messages for select
  using (
    sender_id = auth.uid()
    or auth.uid() = (select owner_id from public.classifieds c where c.id = listing_id)
    or public.is_admin()
  );
create policy "sender: insert" on public.messages for insert
  with check (sender_id = auth.uid());
-- ⚠️ no update and no delete policy, for anyone. A message that can be
-- edited after it is read is not a record, and a report rests on it.

-- ============ reviews ============
create policy "all: read"   on public.reviews for select using (true);
-- ⚠️ AND A BUSINESS OWNER DOES NOT REVIEW THEIR OWN BUSINESS. This is a
-- legal line, not a nicety: the FTC rule of October 2024 forbids
-- fabricated reviews, and a rule in the database is stronger than a
-- rule on a screen.
create policy "own: insert" on public.reviews for insert
  with check (
    author_id = auth.uid()
    and auth.uid() is distinct from (select b.owner_id from public.businesses b where b.id = biz_id)
  );
create policy "own: update" on public.reviews for update
  using (author_id = auth.uid());
create policy "own+admin: delete" on public.reviews for delete
  using (author_id = auth.uid() or public.is_admin());

-- ============ a reply belongs to the business owner alone ============
create policy "all: read" on public.review_replies for select using (true);
create policy "biz owner: insert" on public.review_replies for insert
  with check (
    auth.uid() = (
      select b.owner_id from public.businesses b
      join public.reviews r on r.biz_id = b.id
      where r.id = review_id
    )
  );
create policy "biz owner: update" on public.review_replies for update
  using (author_id = auth.uid() or public.is_admin());

-- ============ the queue: raised by its owner, judged by the admin ============
create policy "own or admin: read" on public.claims for select
  using (claimer_id = auth.uid() or public.is_admin());
create policy "own: insert" on public.claims for insert
  with check (claimer_id = auth.uid());
create policy "admin: update" on public.claims for update
  using (public.is_admin()) with check (public.is_admin());

-- ⚠️ approved photos only, and the pending one is visible to whoever
-- uploaded it and to the admin — never to a reader. A photo awaiting
-- approval that anybody can fetch is published before anyone saw it.
create policy "approved or own: read" on public.biz_photos for select
  using (status = 'approved' or uploader_id = auth.uid() or public.is_admin());
create policy "own: insert" on public.biz_photos for insert
  with check (uploader_id = auth.uid());
create policy "admin: update" on public.biz_photos for update
  using (public.is_admin()) with check (public.is_admin());
create policy "own or admin: delete" on public.biz_photos for delete
  using (uploader_id = auth.uid() or public.is_admin());

create policy "owner or admin: read" on public.biz_verify for select
  using (public.is_admin()
         or auth.uid() = (select b.owner_id from public.businesses b where b.id = biz_id));
create policy "owner: insert" on public.biz_verify for insert
  with check (auth.uid() = (select b.owner_id from public.businesses b where b.id = biz_id));
create policy "admin: update" on public.biz_verify for update
  using (public.is_admin()) with check (public.is_admin());

create policy "live or own: read" on public.offers for select
  using (status = 'live' or public.is_admin()
         or auth.uid() = (select b.owner_id from public.businesses b where b.id = biz_id));
create policy "owner: insert" on public.offers for insert
  with check (auth.uid() = (select b.owner_id from public.businesses b where b.id = biz_id));
create policy "owner or admin: update" on public.offers for update
  using (public.is_admin()
         or auth.uid() = (select b.owner_id from public.businesses b where b.id = biz_id));

-- ⚠️ a reporter reads their own report and nothing else: a report list
-- open to readers tells whoever was reported who reported them.
create policy "own or admin: read" on public.flags for select
  using (reporter_id = auth.uid() or public.is_admin());
create policy "any signed-in: insert" on public.flags for insert
  with check (reporter_id = auth.uid());
create policy "admin: update" on public.flags for update
  using (public.is_admin()) with check (public.is_admin());

-- ============ the operator's: everyone reads, the admin writes ============
create policy "all: read"    on public.events for select using (true);
create policy "admin: write" on public.events for all
  using (public.is_admin()) with check (public.is_admin());
-- the one exception: an organiser proposes, and it lands pending
create policy "organiser: propose" on public.events for insert
  with check (status = 'pending' and proposer_id = auth.uid());

create policy "all: read"    on public.articles for select using (true);
create policy "admin: write" on public.articles for all
  using (public.is_admin()) with check (public.is_admin());

create policy "all: read"    on public.greetings for select using (true);
create policy "admin: write" on public.greetings for all
  using (public.is_admin()) with check (public.is_admin());

create policy "all: read"    on public.settings for select using (true);
create policy "admin: write" on public.settings for all
  using (public.is_admin()) with check (public.is_admin());

-- ============ the admin log and the receipts ============
create policy "admin: read"   on public.admin_log for select using (public.is_admin());
create policy "admin: insert" on public.admin_log for insert with check (public.is_admin());
-- ⚠️ and no update and no delete, for anyone, the admin included. A log
-- that its own actor can rewrite is not a log.

create policy "own or admin: read" on public.receipts for select
  using (payer_id = auth.uid() or public.is_admin());
-- ⚠️ AND NO INSERT, UPDATE OR DELETE FROM A CLIENT AT ALL. The app does
-- not write receipts: the Stripe webhook writes them on the server with
-- the `service_role` key — and that key never ships in the app, is never
-- written into a repository, and lives only in the server's environment.

-- 0014 — the cascade stays: a foreign key's behaviour where a foreign key
-- cannot reach.
--
-- ⚠️ NO `||` AND NO `*` ANYWHERE IN THIS FILE, and that forbids the block
-- comment as well as `count(*)`: the SQL editor's paste field drops both
-- characters — measured twice — so every comment here is a line comment.
-- Since `652` the runner applies this file itself, and the rule is kept
-- anyway: a migration that cannot be pasted by hand is a migration with
-- one way in.
--
-- Every statement is idempotent, so a re-run moves nothing.

-- ============================================================
-- THE OWNER'S DECISION OF 9 SEPTEMBER 2026: «القرار قائم — on delete
-- cascade يبقى»
-- ============================================================
-- `0013` converted `reviews.biz_id` and `claims.biz_id` from uuid to text,
-- because what the app passes for a real business is `b1` … `b515` and a
-- uuid column against a value the app never produces is a write that
-- cannot happen. That decision stands. What went with it was not decided
-- and is not accepted: the two tables lost `on delete cascade`, so a
-- business deleted for good would have left its reviews and its claims
-- behind — rows pointing at nothing, and a claim among them still saying
-- somebody owns a business that no longer exists.
--
-- A foreign key cannot come back: the values are text and half of them
-- (`b30` … `b515`) name a seed that has no row in `businesses` at all.
-- So the BEHAVIOUR is restored without the key, which is what was lost.
--
-- ⚠️ AND IT REACHES A SEED THROUGH `seed_id`, WHICH THE OLD KEY NEVER
-- COULD. The key compared `businesses.id`; a coat row for a seed carries
-- its own uuid there and the app's `b30` in `seed_id`, so the children of
-- every seed business were beyond the old cascade's reach even while it
-- existed. Both halves are asked here.

-- ⚠️ `security definer`, AND THE REASON IS THE MEASUREMENT AND NOT THE
-- ONE THAT READS BEST. A real foreign key's cascade is not subject to row
-- level security at all; a trigger running with the caller's own rights
-- is. Measured on a real PostgreSQL 16, both forms behave identically
-- TODAY — `public.businesses` carries no delete policy whatsoever, so the
-- only roles that can delete a business are the table owner and
-- `service_role`, and both bypass RLS anyway. The app never deletes one:
-- `deleteBusiness` writes `status = 'deleted'`, because deletion here is
-- a mark and not a wipe.
--
-- ⚠️ THE DIFFERENCE APPEARS THE DAY SOMEBODY ADDS THAT DELETE POLICY, AND
-- IT WAS MEASURED RATHER THAN REASONED ABOUT. With `admin: delete` added
-- to `businesses` and an admin performing the delete, on two identical
-- databases:
--     security definer   businesses 2->1 · reviews 3->2 · claims 3->2
--     caller's rights    businesses 2->1 · reviews 3->2 · claims 3->3
-- `reviews` carries `own+admin: delete` so the admin may remove one;
-- `claims` carries a read, an insert and an update policy and NO DELETE
-- POLICY AT ALL, so the claim survives — zero rows removed, nothing
-- raised, and an orphan still saying somebody owns a business that no
-- longer exists. That is the swallowed failure this project forbids, and
-- it looks exactly like a cascade that works.
--
-- ⚠️ AND THE GRANT COSTS NOTHING, WHICH IS WHY IT IS NOT WITHHELD ON THE
-- «a privilege the build does not need» rule: a `returns trigger` function
-- has no direct-call surface at all. Measured — calling it as an ordinary
-- account answers «trigger functions can only be called as triggers».
--
-- ⚠️ AND `search_path` IS PINNED FOR THE SAME REASON IT IS PINNED IN
-- `0005`: without it a caller can put a schema of their own ahead of
-- `public` and the function writes to their tables instead of ours.
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

  return old;
end;
$fn$;

-- ⚠️ `before delete`, NEVER `after`: `after` fires once the row is gone,
-- and if the children were still pointing at it there would be nothing
-- left to say they had. Before is also where a real foreign key acts.
drop trigger if exists cascade_business_delete on public.businesses;
create trigger cascade_business_delete
  before delete on public.businesses
  for each row execute function public.cascade_business_delete();

-- ⚠️ `review_replies` NEEDS NOTHING AND IS NOT TOUCHED. Its own foreign
-- key is `review_id uuid references public.reviews(id) on delete cascade`,
-- untouched by `0013` because a review's id is a uuid the server minted.
-- So deleting the reviews above takes their replies with them, by the key
-- that is still there. It is asserted rather than assumed.
--
-- ⚠️ AND `flags` IS DELIBERATELY NOT INCLUDED. It never had a foreign key
-- to lose: `ref_id` points at four different tables by `kind`, which is
-- why `0013` names it as the one conversion whose price was nothing. The
-- decision is that the cascade STAYS, not that a new one is invented, and
-- inventing one here would silently change what happens to a report when
-- the thing it reports is removed.

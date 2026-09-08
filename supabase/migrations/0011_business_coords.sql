-- ============================================================
-- 0011 — the two columns a directory row cannot do without (650)
-- ------------------------------------------------------------
-- Run by the owner in the SQL editor after this batch is merged.
--
-- Measured on this tree before it was written: `businesses` carries
-- twenty-six columns and the app reads EIGHT that are not among them —
-- verified · rating · review_count · claimed · photos · videos · lat · lng.
-- Six of the eight are DERIVED rather than stored (`claimed` from
-- `owner_id`, the rest from `biz_verify`, `reviews` and `biz_photos`), and
-- `videos` is dropped from the read entirely: nothing writes it.
--
-- These two are the exception, and it is why the migration is two lines and
-- not eight: a point cannot be derived from anything the row already holds.
-- Without them a business added tomorrow NEVER enters the «nearest» order —
-- and that order is half the value of a directory.
--
-- ⚠️ Nothing here is `not null` and nothing carries a default: a row written
-- before this ran keeps its blank honestly rather than being handed a point
-- nobody measured. `hasCoords()` in `js/store.js` already reads a missing
-- point as «no point», and `needsGeoList()` already counts it.
--
-- ⚠️ And no policy is touched. A new column inside a row `0002_rls.sql`
-- already governs needs none.
-- ============================================================

alter table public.businesses add column if not exists lat double precision;
alter table public.businesses add column if not exists lng double precision;

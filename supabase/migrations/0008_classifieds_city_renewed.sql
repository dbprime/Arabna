-- ============================================================
-- ARABNA — a listing keeps the city its poster typed, and its renewal
-- ------------------------------------------------------------
-- Measured on main = f9aaaf4, and it is a fault the reader already
-- meets:
--
--   the post form       collects #pCity, and REQUIRES it
--   addClassified       never sent it
--   public.classifieds  had no column to send it to
--   mapLiveClsRowToJs   returned city: '' — a hard-coded empty
--   the card and page   print a map pin beside it
--
-- So a listing read back from the server — on a second device, or by
-- anybody who is not the poster — shows a pin with nothing after it,
-- and the poster never sees it, because their own device still holds
-- the value they typed. Every listing published since 610 has lost
-- that field on the way to the table.
--
-- ⚠️ Nullable, and no default. A row written before this migration
-- keeps its blank honestly rather than being given a city nobody
-- typed, which is the rule the whole directory runs on: the app never
-- invents a place it was not told.
--
-- ⚠️ No policy is touched. "own: insert" and "own: update" already
-- govern the row; a new column inside a governed row needs nothing.
--
-- ⚠️ Written for the SQL editor: no `concat` operator and no star.
-- ============================================================
alter table public.classifieds
  add column if not exists city text;

-- ------------------------------------------------------------
-- And the renewal. `daysLeft` is not a column: it is computed from the
-- row's own age, so `renewClassified` reset a number nobody else reads —
-- the listing kept its original age on every other screen and expired on
-- its first schedule while its owner watched the counter go back. It
-- touches money the day renewing is paid for.
--
-- The days are then computed from coalesce(renewed_at, created_at).
--
-- ⚠️ `created_at` is NOT rewritten. It records when the listing was born,
-- and overwriting it would put two different facts in one field.
-- ------------------------------------------------------------
alter table public.classifieds
  add column if not exists renewed_at timestamptz;

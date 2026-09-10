-- 0016 — the first load down the weekly road: two events from the report of
-- 8 September 2026.
--
-- ⚠️ NO `||` AND NO `*` ANYWHERE IN THIS FILE, and that forbids the block
-- comment as well as `count(*)`: the SQL editor's paste field drops both
-- characters — measured twice — so every comment here is a line comment.
--
-- Every statement is idempotent, so a re-run moves nothing: the conflict
-- target repeats the predicate of the partial index `0015` creates.
--
-- ⚠️ CORRECTED AFTER THE FACT BY `0017_events_type_fix.sql`: the first
-- event below entered with `type = 'lecture'` — «محاضرات ودروس دينيّة» —
-- and its subject was never published, so the type claimed a religion
-- nobody stated. `0017` sets it to `community`. THIS FILE IS NOT EDITED
-- FOR IT: it has already been applied to production, and an executed
-- migration is not edited — what comes after it is written.
--
-- ============================================================
-- WHERE THESE TWO COME FROM
-- ============================================================
-- `docs/تقارير/2026-09-08-فعاليات.md`, in the repository. It measured four
-- candidates and passed two. Its own first line says «entered from the
-- admin panel» — the owner's decision of 9 September replaced that: code
-- enters them, not the owner. That is why they are here and not typed.
--
-- ⚠️ THE PRICE IS EMPTY IN BOTH, AND STAYS EMPTY. Neither the centre
-- calendar nor the organiser announced one, and the report refused to
-- assume it: «interfaith festivals are usually free — and «usually» is not
-- a source». It is not assumed here either. The description says so in
-- words rather than leaving a reader to guess.
--
-- ⚠️ `ticket_url` IS EMPTY IN BOTH, by the owner's decision: no source, no
-- link. `js/screens/events.js` draws the button only when the field is
-- filled, so an empty one draws nothing at all — no dead button and no
-- empty line, the directory's own rule for a shop with no phone.
--
-- ⚠️ `featured` IS NOT WRITTEN. It defaults to false, and it is the paid
-- $99 weekly pin (`AD_PRODUCTS.event`): ticking it on an editorial item
-- crowds out whoever paid.
--
-- ============================================================
-- FOUR TEETH IN THE SHAPE OF THIS FILE
-- ============================================================
-- 1) `seed_id` IS NOT WRITTEN, AND MUST NEVER BE. Measured in
--    `mergedEvents` in `js/store.js`: a row carrying `seed_id` falls into
--    `coats`, and `coats` is read ONLY from inside a loop walking
--    `EVENTS` in `js/data.js`. So a row with a `seed_id` that no seed
--    matches is written to the server successfully, the server answers
--    «done», AND NO HUMAN EVER SEES IT ON ANY SCREEN. It is the only one
--    of the four that fails in total silence.
--
-- 2) THE TIME IS WRITTEN WITH THE CITY ZONE NAMED, and the engine reads
--    the offset for THAT DATE. `addEvent` is what pins an all-day event
--    to noon and reads the `America/Chicago` offset, and an insert by SQL
--    does not pass through it. Measured on PostgreSQL 16:
--        2026-10-04 12:00 America/Chicago  ->  17:00Z   (CDT, UTC-5)
--        2026-11-15 12:00 America/Chicago  ->  18:00Z   (CST, UTC-6)
--    October and November are not on one offset, so the offset is never
--    hand-written. Both events below carry an announced hour, so neither
--    is all-day; an event with no announced hour is written `all_day =
--    true` at 12:00 city time and NEVER at midnight — midnight crosses a
--    day boundary in every zone east or west and noon crosses none.
--
-- 3) `title_ar` IS `not null`, and an English-only source has its name
--    written into both columns as it stands. The name appears as its
--    owner wrote it and is not translated — the project rule, and the
--    same one that keeps a city name English.
--
-- 4) `place` IS NOT WRITTEN, and this is a measured correction rather
--    than an omission. It is one column for two languages;
--    `venue_ar`/`venue_en` replaced it, `mapLiveEventRowToJs` does not
--    read it, and `eventRowFrom` deliberately does not write it. Writing
--    it here would put a value in a column nothing reads and make the
--    weekly road disagree with the app's own writer.
--
-- ============================================================
-- AND THE LATIN RUNS CARRY THEIR OWN ISOLATES
-- ============================================================
-- An address or an organisation name inside an Arabic line reaches the
-- page through `esc()`, so there is no element to hang `unicode-bidi` on
-- and the isolate has to travel INSIDE the text — U+2066 … U+2069, which
-- is exactly what `ltrRun` in `js/data.js` writes. Measured in `642`:
-- without them a price rendered with its dollar sign on the wrong side.


-- ============================================================
-- 1) In Conversation: Rana Begum and Frauke V. Josenhans
--    Friday 2 October 2026, 6:00 pm - 8:00 pm, from the centre calendar.
--    The report checked the weekday against the calendar: 2026-10-02 is a Friday.
-- ============================================================
insert into public.events
  (external_id, title_ar, title_en, starts_at, ends_at, all_day, type,
   venue_ar, venue_en, city, body_ar, body_en,
   organizer_ar, organizer_en, ticket_url, source, source_url, status)
values (
  'wk-2026-10-02-in-conversation-rana-begum',
  'In Conversation: Rana Begum and Frauke V. Josenhans', 'In Conversation: Rana Begum and Frauke V. Josenhans',
  timestamptz '2026-10-02 18:00:00 America/Chicago',
  timestamptz '2026-10-02 20:00:00 America/Chicago',
  false,
  'lecture',
  'المركز الإسماعيلي', 'The Ismaili Center',
  'Houston, TX',
  'أمسية حوار فنّي في المركز الإسماعيلي في ⁦2323 Allen Pkwy⁩.
موضوع الندوة لم ينشره المنظّم — التقويم يحمل اسمَي المتحدّثتين وحدهما، ولا يذكر صلةً بالفنّ العربيّ.
والسعر لم يُعلَن.',
  'An art conversation at the Ismaili Center, 2323 Allen Pkwy.
The organiser has not published a subject — the calendar carries only the two names, and states no connection to Arab art.
No price has been announced.',
  'المركز الإسماعيلي في ⁦Houston⁩',
  'The Ismaili Center, Houston',
  '',
  'weekly',
  'https://events.ismailicenter.org/',
  'live'
)
on conflict (external_id) where external_id is not null and external_id <> ''
do nothing;

-- ============================================================
-- 2) Festival of Faiths Houston
--    Sunday 4 October 2026, 12:00 pm - 5:00 pm, from the centre calendar.
--    The day was checked: 2026-10-04 is a Sunday, and the calendar names it
--    «Sunday» itself. The day is attributed to the VENUE calendar and not to
--    the organiser, whose own page says only «Fall 2026» — the report refused
--    to merge the two sources into one sentence, and so does this.
-- ============================================================
insert into public.events
  (external_id, title_ar, title_en, starts_at, ends_at, all_day, type,
   venue_ar, venue_en, city, body_ar, body_en,
   organizer_ar, organizer_en, ticket_url, source, source_url, status)
values (
  'wk-2026-10-04-festival-of-faiths',
  'Festival of Faiths Houston', 'Festival of Faiths Houston',
  timestamptz '2026-10-04 12:00:00 America/Chicago',
  timestamptz '2026-10-04 17:00:00 America/Chicago',
  false,
  'festival',
  'المركز الإسماعيلي', 'The Ismaili Center',
  'Houston, TX',
  'مهرجان بين الأديان في المركز الإسماعيلي في ⁦2323 Allen Pkwy⁩، بعد ظهر الأحد.
اليوم والساعة من تقويم المركز، و⁦Interfaith Ministries⁩ تقول «خريف 2026» بلا يوم.
والسعر لم يُعلَن.',
  'An interfaith festival at the Ismaili Center, 2323 Allen Pkwy, on a Sunday afternoon.
The day and the hour come from the centre calendar; Interfaith Ministries says "Fall 2026" with no day.
No price has been announced.',
  '⁦Interfaith Ministries for Greater Houston⁩، بالتنسيق مع ⁦Ismaili Center Houston⁩',
  'Interfaith Ministries for Greater Houston, in coordination with Ismaili Center Houston',
  '',
  'weekly',
  'https://events.ismailicenter.org/',
  'live'
)
on conflict (external_id) where external_id is not null and external_id <> ''
do nothing;

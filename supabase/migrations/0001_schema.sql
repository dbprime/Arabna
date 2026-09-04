-- ============================================================
-- ARABNA — the server contract: the schema
-- ------------------------------------------------------------
-- Nothing here is wired to the app. No key, no library, no fetch:
-- this is the contract the connecting batch is built on.
--
-- THE DIVISION IS NOT INVENTED HERE. `KEEPS_ON_SIGN_OUT` in
-- js/store.js already names three kinds — what belongs to the
-- DEVICE, what belongs to the OPERATOR, and one accounting record —
-- and those three are the protection rules themselves. What stays
-- on the device never rises. What is the operator's is read by
-- everyone and written by the admin alone. What is in neither
-- belongs to its owner and to nobody else.
--
-- ⚠️ AND THE 514 SEED LISTINGS ARE NOT COPIED HERE. They stay in
-- js/data.js, which is what keeps the app working with no
-- connection at all (420). `businesses.seed_id` is the join: these
-- tables carry what people added and what the admin edited on top.
-- The tables start empty but for the operator's own rows.
-- ============================================================

-- Every table below carries these three unless it says otherwise:
--   id          uuid primary key default gen_random_uuid()
--   created_at  timestamptz not null default now()
--   updated_at  timestamptz not null default now()

-- ------------------------------------------------------------
-- THE DIVISION OF THE 63 STATE KEYS, read from KEEPS_ON_SIGN_OUT.
-- ⚠️ It is written HERE, in the migration itself, so the suite has
-- something in the repository to check against — and so a key added
-- to DEFAULTS tomorrow with no place in this contract turns the net
-- red the same day. That is the item that stops this file rotting.
--
-- [never-uploads] the device's own, and it never rises to a server:
--   lang theme fontScale location geo geoAsked geoDenied geoGranted
--   area mapsApp seenGreetings clockOffset draft pendingVerify
--   showDemo demoDefaultOff demoPurged adminAuth install
--
-- [operator] read by everyone, written by the admin alone:
--   businessEdits extraArticles extraEvents hiddenEvents eventEdits
--   mergedBusinesses removedBusinesses adWaitlist adStats bizStats
--   seasons ramadanDates greetings prayer worshipFixes adminLog boosted
--
-- [owner-only] its subject's and nobody else's:
--   user saved myListings myBusinessIds subscription myAds notifPrefs
--   readNotifs extraNotifs hiddenListings blocked savedEvents reminded
--   cardOnFile myPendingBusinesses
--
-- [shared] created by a reader, seen by others — the only class that
-- needed a rule written by hand; every other one reads from its kind:
--   extraBusinesses extraClassifieds reviews reviewReplies messages
--   claims offers bizPhotos bizVerify flags reported
--
-- [accounting] never deleted, not even with the account:
--   receipts
--
-- ⚠️ `demoDefaultOff` and `install` are in [never-uploads] on the same
-- ground as the rest of that list and by the same measurement — both
-- sit in KEEPS_ON_SIGN_OUT, and both are traces of a DEVICE (a one-shot
-- migration mark, and whether this phone has been shown the install
-- invite). They were missing from the batch file's own five lists,
-- which covered 61 of 63.
-- ------------------------------------------------------------

create extension if not exists pgcrypto;

-- ---------------- people ----------------
-- Owned by its subject alone. Never inserted by hand: a trigger on
-- auth.users creates the row at sign-up.
create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  display_name   text,
  email_verified boolean not null default false,
  phone          text,                 -- off by a switch in the first release
  phone_verified boolean not null default false,
  notif_prefs    jsonb not null default
                 '{"messages":true,"expiry":true,"adLive":true,"reviews":true}',
  is_admin       boolean not null default false,
  deleted_at     timestamptz           -- deletion is a mark, not an erasure
);

-- ⚠️ NO LOCATION COLUMN HERE OR ANYWHERE ELSE. `geo` in js/store.js
-- carries its own promise in its own comment — «the user's own point,
-- never sent anywhere» — and the arrival of a server does not repeal
-- it. The reader's point stays on the reader's device and the
-- distance is computed there. Search this whole file for a reader's
-- lat or lng and you will not find one.
--
-- ⚠️ AND `is_admin` IS WRITTEN BY NOBODY FROM THE APP. It carries no
-- write policy at all in 0002, and a trigger there refuses a change
-- from a client session. With one write policy every reader could
-- promote themselves.

-- ---------------- the directory ----------------
create table public.businesses (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  owner_id       uuid references public.profiles(id) on delete set null,
  seed_id        text unique,          -- 'b197' for a js/data.js record; null for anything added
  name_ar        text not null,
  name_en        text not null,
  cat            text not null,
  phone          text,
  address        text,
  mobile_service boolean not null default false,
  zip            text,
  hours          jsonb,
  tags           text[] not null default '{}',
  attributes     text[] not null default '{}',
  desc_ar        text,
  desc_en        text,
  plan           text not null default 'free',
  status         text not null default 'live',   -- live · pending · pendingReview · rejected
  reject_reason  text,
  non_commercial boolean not null default false,
  entry_price    text,
  -- ⚠️ `source` is the one genuinely new column, and its reason is a
  -- store rule rather than a preference: Apple 5.1.1(viii) forbids an
  -- app that gathers personal information from anywhere other than the
  -- user themselves, without their explicit consent, «even from public
  -- databases». Nothing in the app records where a record came from,
  -- so without this column there is no answer to give a reviewer.
  source         text not null default 'owner',  -- owner · public · worship · consent
  consent_at     timestamptz,
  consent_by     uuid references public.profiles(id) on delete set null
);

-- ---------------- what people create ----------------
create table public.classifieds (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  cat        text not null,
  title      text not null,
  body       text,
  price      numeric,
  status     text not null default 'live',
  hidden     boolean not null default false
);

create table public.reviews (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  author_id  uuid not null references public.profiles(id) on delete set null,
  biz_id     uuid not null references public.businesses(id) on delete cascade,
  rating     int  not null check (rating between 1 and 5),
  body       text,
  -- not an invention: `addReview` already begins with `myReviewFor(bizId)`
  -- and diverts to `updateReview` when one exists. The rule is already
  -- there; this makes the database keep it instead of the device.
  unique (author_id, biz_id)
);

create table public.review_replies (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  review_id  uuid not null unique references public.reviews(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete set null,
  body       text not null
);

-- ⚠️ READ THIS ONE TWICE. A message today carries `from: 'me'`, and only
-- the device knows who «me» is; a review carries `mine: true` the same
-- way. Neither field travels. `sender_id` and `author_id` replace them,
-- and «mine» becomes a computation rather than storage:
-- sender_id = auth.uid().
--
-- ⚠️ And `scrubContact` stays exactly where it is. The scrub runs on the
-- device before sending, as it does today, AND is repeated on the
-- server — what only the client guards is not guarded.
create table public.messages (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  listing_id   uuid not null references public.classifieds(id) on delete cascade,
  sender_id    uuid not null references public.profiles(id) on delete cascade,
  body         text not null,
  scrubbed     boolean not null default false,
  off_platform boolean not null default false
);

-- ---------------- the queue and ownership ----------------
create table public.claims (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  biz_id     uuid not null references public.businesses(id) on delete cascade,
  claimer_id uuid not null references public.profiles(id) on delete cascade,
  status     text not null default 'pending',
  details    jsonb,
  reason     text,
  unique (biz_id, claimer_id)
);

create table public.biz_photos (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  biz_id      uuid not null references public.businesses(id) on delete cascade,
  uploader_id uuid references public.profiles(id) on delete set null,
  path        text not null,        -- a storage path, never a public URL
  status      text not null default 'pending'
);

create table public.biz_verify (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  biz_id     uuid not null unique references public.businesses(id) on delete cascade,
  status     text not null default 'pending',
  ref        text,
  reason     text
);

create table public.offers (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  biz_id     uuid not null references public.businesses(id) on delete cascade,
  body       text not null,
  price      text,
  ends_at    timestamptz,
  status     text not null default 'pending',
  reason     text
);

create table public.flags (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  reporter_id uuid references public.profiles(id) on delete set null,
  kind        text not null,        -- business · classified · review · message
  ref_id      uuid not null,
  reason      text,
  risk        text,
  status      text not null default 'open'
);

-- ---------------- the operator's own ----------------
create table public.events (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  seed_id      text unique,
  title_ar     text not null,
  title_en     text,
  starts_at    timestamptz,
  ends_at      timestamptz,
  end_time_tba boolean not null default false,
  place        text,
  body_ar      text,
  body_en      text,
  status       text not null default 'live',
  proposer_id  uuid references public.profiles(id) on delete set null
);

create table public.articles (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title_ar   text not null,
  title_en   text,
  body_ar    text,
  body_en    text,
  status     text not null default 'live'
);

create table public.greetings (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title      text not null,
  body       text,
  cta        text,
  from_date  date,
  to_date    date,
  off        boolean not null default false
);

-- one row per setting: the operator's switches that were scattered
-- state keys — seasons · ramadanDates · prayer · boosted
create table public.settings (
  key        text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  value      jsonb not null
);

create table public.admin_log (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  actor_id   uuid references public.profiles(id) on delete set null,
  ref_id     text,
  action     text not null,
  from_val   text,
  to_val     text
);

-- ⚠️ `adminAuth` has no table and never rises. It is `{user, salt, hash}`
-- on the device — no plain text, which is right — but it is a lock on a
-- DEVICE, not on an account. On the server `profiles.is_admin` replaces
-- it, and the hash is not copied into the database under any
-- circumstances.

-- ---------------- accounting ----------------
create table public.receipts (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- ⚠️ `set null`, NEVER `cascade`, and this is the whole item: deleting
  -- an account separates the person from the transaction and does not
  -- erase that money was taken. That is what `deleteAccount` does today,
  -- word for word — and deletion is a right Apple 5.1.1(v) requires, so
  -- the answer is not to refuse it.
  payer_id   uuid references public.profiles(id) on delete set null,
  payer_name text,                  -- emptied on account deletion; the row stays
  ref        text not null unique,  -- ARB-26-XXXXX
  amount     numeric not null,
  currency   text not null default 'USD',
  method     text not null,
  issued_at  timestamptz not null default now()
);

-- ⚠️ NO CARD NUMBER HERE OR ANYWHERE. `cardOnFile` is display text today
-- — 'VISA •••• 4242' — and stays that way. The card itself passes through
-- Stripe's hosted field alone.

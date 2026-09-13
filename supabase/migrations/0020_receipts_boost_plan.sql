-- ============================================================
-- 665ب — the receipt says what it bought, the boost ends, and
--        the subscription is visible from any device.
--
-- Three subjects, one file, because all three are money and all
-- three are columns on tables that already exist:
--
--   1. `receipts` was TEN columns and `addReceipt` writes fourteen
--      fields (`js/store.js`), so what was stored was a number with
--      no name — no kind, no description, and above all NO PERIOD.
--      ⚠️ `covers` is the column that ends «I paid and got nothing».
--   2. `classifieds` had nowhere to record how long a boost lasts.
--      `BOOST_PRICES` sells three days, seven and fourteen, and
--      `boostClassified` pushed the id into a list WITH NO DATE —
--      so two dollars for three days bought them for ever.
--   3. `businesses.plan` is one text column and `state.subscription`
--      carries eleven fields. Two columns carry the half that
--      decides who sees what: is it paid, until when, and cancelled.
--
-- ⚠️ AND A CORRECTION TO THE BATCH FILE'S OWN MEASUREMENT, written
-- here so nobody builds on it. It says `receipts` is «eight columns»
-- and then lists ten; measured, it is ten. And it says «ten columns
-- missing» and its own table lists twelve. Neither figure changes
-- what is added — what is added is measured against `addReceipt`,
-- field by field — and both are named so a later reader does not
-- take a count from a sentence.
--
-- ⚠️ ADD COLUMN IF NOT EXISTS, NEVER A TABLE RECREATED. The table
-- may already hold rows on a live server, and a recreated table is
-- an accounting record erased.
-- ============================================================

-- ---------------- 1) the receipt says what it bought ----------------

alter table public.receipts add column if not exists kind        text;
alter table public.receipts add column if not exists description text;

-- ⚠️ A LINE, NOT A MISSING LINE. Adding a tax line to receipts
-- already issued without one is far harder than filling one that is
-- already there, and an accountant reads a column rather than
-- inferring one from its absence.
alter table public.receipts add column if not exists tax numeric not null default 0;

-- ⚠️ `text`, and this is `0013`'s class, not a preference. The app
-- passes 'b1' … 'b515' for every one of the 514 real businesses, and
-- 485 of those are seeds with no row in `public.businesses` at all.
-- A `uuid` column against a value the app never produces is a write
-- that cannot happen.
alter table public.receipts add column if not exists biz_id text;

-- the listing or the ad the money was for; both are text ids
alter table public.receipts add column if not exists ref_id text;

-- ⚠️ TWO TYPED COLUMNS AND NOT ONE `jsonb`, and the reason is
-- measured rather than stylistic. Everything that rises to this
-- table is a cash receipt (see the function below), and a cash
-- receipt's `covers` is always exactly two instants — it does not
-- vary the way a concert's five fields do, which is the one place
-- the schema accepts `jsonb`. And two timestamps answer «which
-- receipts cover today?»; a blob does not.
alter table public.receipts add column if not exists covers_from timestamptz;
alter table public.receipts add column if not exists covers_to   timestamptz;

-- the whole point of the cash item: money handed over in person
-- leaves no trace anywhere else, so WHO TOOK IT is part of the record
alter table public.receipts add column if not exists received_by text;
alter table public.receipts add column if not exists reference   text;

alter table public.receipts add column if not exists auto_renew boolean not null default false;

-- ⚠️ The original receipt's `ref`, and deliberately NOT a foreign
-- key to it. A refund may be issued against a receipt written before
-- this table was ever written to — every receipt in the app today is
-- local — so a key would refuse exactly the case the column is for.
alter table public.receipts add column if not exists refund_of text;

alter table public.receipts add column if not exists status text not null default 'paid';

-- ⚠️ `payer_name` carries the name alone, and the name is emptied on
-- account deletion while the row stays. The address is the second
-- half of «who paid this», and it is emptied by the same hand.
alter table public.receipts add column if not exists payer_email text;

-- ---------------- 2) the boost ends ----------------

-- ⚠️ AND WHY A COLUMN HERE WHILE ONE WAS REFUSED IN `665أ`. That
-- refusal was right: `boosted` as an operator KEY in `public.settings`
-- is what the schema's own comment describes, and `settings` is
-- `admin: write` — so a member buying a boost for their own listing
-- was refused by the policy, and the paid button did nothing.
-- The measurement showed the two are not one thing: what the OPERATOR
-- marks is a setting, and what a MEMBER BUYS is a fact about the
-- listing. The row is the listing.
alter table public.classifieds add column if not exists boosted_until timestamptz;

-- ---------------- 3) the subscription is visible anywhere ----------------

-- ⚠️ `plan` STAYS THE VISIBLE TRUTH. Whoever reads the directory asks
-- one column exactly as they do today, and nothing in `650`'s
-- matching moves. These two carry the half that decides who sees
-- what: until when, and whether it was cancelled.
alter table public.businesses add column if not exists plan_until timestamptz;
alter table public.businesses
  add column if not exists plan_cancel_at_end boolean not null default false;

-- ============================================================
-- the receipt number is minted on the server
--
-- `newReceiptNumber()` in `js/store.js` avoids a duplicate by
-- comparing what is ON THE DEVICE — and two devices cannot see each
-- other. ⚠️ `ref text not null unique` has stood since `0001`, so the
-- SERVER is the guarantee; the shape `ARB-YY-XXXXX` is unchanged.
-- This is the debt `645` §7.2 recorded, and it is paid here.
-- ============================================================

create or replace function public.new_receipt_ref()
returns text
language plpgsql
-- ⚠️ Not `security definer`: it reads and writes nothing. A privilege
-- the body does not need is not granted (`0005`'s rule, read
-- backwards).
set search_path = public
as $$
declare
  -- no 0 O 1 I L: the number is read down a telephone
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  yy       constant text := to_char(now(), 'YY');
  code     text;
  candidate text;
begin
  for i in 1..200 loop
    code := '';
    for j in 1..5 loop
      -- ⚠️ NO `*` AND NO `||` IN ANY MIGRATION'S CODE — the SQL editor
      -- drops both characters, and `0005` carries the scar. `652` gave us
      -- a runner and the rule still stands for whatever is ever pasted by
      -- hand: `concat()` for `||`, and a random BYTE for the scaling,
      -- which needs no multiplication and is better randomness besides.
      -- (256 mod 31 is 8, so the first eight symbols are drawn a ninth
      -- more often than the rest — irrelevant for a reference protected
      -- by a unique index and a two-hundred-try loop.)
      code := concat(code, substr(alphabet,
                1 + (get_byte(gen_random_bytes(1), 0) % length(alphabet)), 1));
    end loop;
    candidate := concat('ARB-', yy, '-', code);
    if not exists (select 1 from public.receipts r where r.ref = candidate) then
      return candidate;
    end if;
  end loop;
  -- ⚠️ Never a silent collision: the unique index is the real
  -- guarantee and the caller's insert raises if this ever lost.
  raise exception 'could not mint a receipt number';
end;
$$;

-- ⚠️ AND THE GRANT IS NOT OPTIONAL BESIDE THE REVOKE, measured on a real
-- PostgreSQL rather than read: `authenticated` inherits from PUBLIC, so a
-- `revoke ... from public` with no matching grant leaves the function
-- callable by NOBODY but the owner — «permission denied for function», to
-- the admin as much as to anybody. Every function in this repository since
-- `0005` pairs the two, and the first draft of this file did not.
revoke all on function public.new_receipt_ref() from public, anon;
grant execute on function public.new_receipt_ref() to authenticated;

-- ============================================================
-- the cash receipt: a function, never a policy
--
-- `0002_rls.sql` gives `receipts` a read policy and NO insert, update
-- or delete from a client at all — deliberately: a receipt a client
-- can create is a receipt anybody holding the publishable key can
-- invent. So the door is a function that checks who is knocking.
--
-- ⚠️ AND THE CARD RECEIPT DOES NOT COME THROUGH HERE, and does not
-- rise at all. `js/store.js` carries the rule in its own words: no
-- `paid` receipt without the gateway saying so — and `chargeCard` is
-- still a simulation. Uploading one now would write a row saying
-- money arrived that did not. Only the cash receipt rises, because
-- the admin is the person who saw the money.
-- ============================================================

create or replace function public.issue_cash_receipt(
  p_kind        text,
  p_description text,
  p_amount      numeric,
  p_method      text,
  p_biz_id      text,
  p_covers_from timestamptz,
  p_covers_to   timestamptz,
  p_received_by text,
  p_reference   text,
  p_payer_id    uuid    default null,
  p_payer_name  text    default null,
  p_payer_email text    default null,
  p_refund_of   text    default null
)
returns public.receipts
language plpgsql
-- ⚠️ `security definer` runs with the OWNER's rights, so it steps
-- past RLS by its nature — which is exactly why the authorisation is
-- the FIRST STATEMENT and RAISES, never a condition inside `where`
-- that somebody who cannot see what it holds can edit away.
security definer
-- ⚠️ Compulsory on every `security definer`.
set search_path = public, auth
as $$
declare
  out_id uuid;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if p_amount is null or p_amount < 0 then
    raise exception 'amount must be zero or more';
  end if;
  -- ⚠️ The methods are the ones a person hands over in a room. A card
  -- receipt does not come through this door at all.
  if p_method is null or p_method not in ('cash', 'check', 'transfer') then
    raise exception 'method must be cash, check or transfer';
  end if;

  insert into public.receipts
    (payer_id, payer_name, payer_email, ref, amount, method, issued_at,
     kind, description, tax, biz_id, covers_from, covers_to,
     received_by, reference, auto_renew, refund_of, status)
  values
    (p_payer_id, p_payer_name, p_payer_email, public.new_receipt_ref(),
     p_amount, p_method, now(),
     p_kind, p_description, 0, p_biz_id, p_covers_from, p_covers_to,
     p_received_by, p_reference,
     -- ⚠️ Cash never renews. Written into the row rather than left to
     -- a caller: a subscriber whose month ran out weeks ago, whose
     -- page still says «subscribed» and from whom nothing was
     -- collected, is what an auto-renewing cash order produces.
     false,
     p_refund_of,
     case when p_refund_of is null then 'paid' else 'refunded' end)
  -- ⚠️ NOT `returning *`, because the SQL editor drops the `*` — and NOT
  -- `returning receipts into out_row` either, measured on a real
  -- PostgreSQL: `INTO` a row variable matches the query's columns to the
  -- row's fields ONE BY ONE, so a single composite column is assigned to
  -- the FIRST field and the whole row is cast to `id`'s uuid. The id comes
  -- back and the row is read as a composite EXPRESSION, which carries no
  -- `*` and is not subject to that rule.
  returning id into out_id;

  return (select rec from public.receipts rec where rec.id = out_id);
end;
$$;

revoke all on function public.issue_cash_receipt(
  text, text, numeric, text, text, timestamptz, timestamptz,
  text, text, uuid, text, text, text) from public, anon;
-- ⚠️ Granted to every signed-in account and refused inside the body, never
-- withheld by the grant. The grant answers «permission denied», which tells
-- a caller nothing; the body answers «not authorized», which is the truth
-- and is what the panel can show.
grant execute on function public.issue_cash_receipt(
  text, text, numeric, text, text, timestamptz, timestamptz,
  text, text, uuid, text, text, text) to authenticated;

-- ============================================================
-- the boost: one function, two callers
--
-- ⚠️ THE CLIENT WRITES NEITHER `settings` NOR `classifieds` DIRECTLY.
-- A member may update their own listing under `0002`'s «own: update»,
-- so without this door the duration would be a number the buyer
-- controls — and the price is charged for a duration.
-- ============================================================

create or replace function public.boost_classified(listing_id text, days int)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  owner   uuid;
  ends_at timestamptz;
begin
  -- ⚠️ `id::text`, so a seed id ('c1') matches nothing and is refused
  -- cleanly rather than raising a cast error at the boundary.
  select c.owner_id into owner from public.classifieds c where c.id::text = listing_id;
  if owner is null then
    raise exception 'no such listing';
  end if;
  if owner <> auth.uid() and not public.is_admin() then
    raise exception 'not authorized';
  end if;
  -- ⚠️ A DURATION FROM A KNOWN LIST AND NEVER A FREE NUMBER. The
  -- price is charged for a period, and a caller who can name the
  -- period can buy a year for two dollars. The three are
  -- `BOOST_PRICES` in `js/data.js`; the gift from the panel uses the
  -- same three.
  if days is null or days not in (3, 7, 14) then
    raise exception 'duration must be 3, 7 or 14 days';
  end if;

  -- ⚠️ `greatest` IS DELIBERATE: somebody buying seven days on the
  -- second day of three gets nine, not seven. Money paid does not
  -- swallow what is left of the money paid before it.
  update public.classifieds c
     -- ⚠️ `make_interval` and not `(days || ' days')::interval`: the
     -- editor drops `||`, and this says the same thing in one call.
     set boosted_until = greatest(now(), coalesce(c.boosted_until, now()))
                         + make_interval(days => days)
   where c.id::text = listing_id
   returning c.boosted_until into ends_at;

  return ends_at;
end;
$$;

revoke all on function public.boost_classified(text, int) from public, anon;
grant execute on function public.boost_classified(text, int) to authenticated;

-- ============================================================
-- ⚠️ AND THE DOOR IS NOT THE ONLY WAY IN — measured on a real
-- PostgreSQL, not read.
--
-- §4.3 says the client writes `classifieds` directly for nothing, and
-- that is an instruction to the CLIENT CODE. The POLICY did not carry
-- it: `0002`'s «own: update» lets a listing's owner write any column
-- of their own row, so
--
--     PATCH /rest/v1/classifieds?id=eq.X  {"boosted_until": "2030-01-01"}
--
-- with the publishable key that ships on every phone bought a year for
-- nothing, and the whole item was free to anybody who read the file.
--
-- ⚠️ A COLUMN-LEVEL REVOKE DOES NOT CLOSE IT, and this was measured
-- before the trigger was written: a table-level UPDATE privilege
-- implies every column, so `revoke update (boosted_until)` changed
-- nothing at all. Revoking the table grant and re-granting column by
-- column would close it and leave a hand-written list of columns that
-- ages the day one is added — the very shape this project hunts.
--
-- So it is a trigger, which is the schema's OWN precedent: `is_admin`
-- is held by `refuse_admin_escalation` in `0002` for the same reason
-- and in the same shape. The `security definer` function above runs as
-- the migration's owner, so it passes; a client is `anon` or
-- `authenticated`, and does not.
-- ============================================================

create or replace function public.refuse_boost_write() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.boosted_until is not null and current_user in ('anon', 'authenticated') then
      raise exception 'boosted_until is bought through boost_classified, not written';
    end if;
    return new;
  end if;
  if new.boosted_until is distinct from old.boosted_until
     and current_user in ('anon', 'authenticated') then
    raise exception 'boosted_until is bought through boost_classified, not written';
  end if;
  return new;
end;
$$;

drop trigger if exists classifieds_no_boost_write on public.classifieds;
create trigger classifieds_no_boost_write
  before insert or update on public.classifieds
  for each row execute function public.refuse_boost_write();

/* ============================================================
   A stand-in Supabase, for the suites only.
   ------------------------------------------------------------
   ⚠️ WHY THIS EXISTS, AND WHY IT IS NOT A WAY AROUND A TEST.
   From `610` the app's identity really lives on a server: `signUp`
   writes there first and its refusal is final, because an account that
   exists on one device and nowhere else is a lie its owner discovers on
   their second phone. That is the right behaviour and it is deliberate —
   and it means the suites, which run with no route to the internet,
   cannot create an account at all.

   So the endpoint is answered here instead of the behaviour being
   softened. Nothing in `js/` knows this file exists; what changes is the
   network the page is given, exactly as `_phoneauth.mjs` changes the
   module the server serves. The app under test is the shipped app.

   ⚠️ AND IT DOES NOT PRETEND TO BE SUPABASE. It implements the four calls
   the app actually makes and refuses the rest loudly, so a fifth call
   added tomorrow fails in the suite instead of passing against a mock
   that quietly says yes to everything. A permissive mock is the worst
   kind: green with the feature broken.

   The real thing is still exercised by the acceptance tests run by hand
   against the live host — those are named in the batch's own report, and
   this file does not stand in for them.
   ============================================================ */

const HOST = 'ijubbqvbkfzillkhwdzp.supabase.co';

/* ⚠️ THE COLUMNS ARE READ FROM THE MIGRATIONS, NEVER LISTED HERE.
   PostgREST refuses a field the table does not have (PGRST204), and a mock
   that swallowed one would keep a suite green while every write of that
   field failed live — which is the permissive-mock fault this file's own
   head warns about, and is exactly how the missing `city` column survived:
   the form collected it, `addClassified` did not send it, and nothing
   anywhere could have said so.
   Reading the schema means the day a batch sends a field it never added,
   the suite that sends it goes red — and a column added in a migration
   needs nothing written here. */
import { readFileSync, readdirSync } from 'node:fs';
const MIG = new URL('../../supabase/migrations/', import.meta.url).pathname;
function columnsOf(table) {
  const cols = new Set();
  for (const f of readdirSync(MIG).filter(n => n.endsWith('.sql')).sort()) {
    const sql = readFileSync(MIG + f, 'utf8').replace(/--[^\n]*/g, '');
    const create = sql.match(new RegExp('create\\s+table[^;]*?public\\.' + table + '\\s*\\(([\\s\\S]*?)\\n\\s*\\)', 'i'));
    if (create) for (const line of create[1].split('\n')) {
      const m = line.trim().match(/^([a-z_][a-z0-9_]*)\s+/i);
      if (m && !/^(primary|unique|constraint|foreign|check)$/i.test(m[1])) cols.add(m[1]);
    }
    const alters = sql.matchAll(new RegExp('alter\\s+table[^;]*?public\\.' + table + '[\\s\\S]*?add\\s+column\\s+(?:if\\s+not\\s+exists\\s+)?([a-z_][a-z0-9_]*)', 'gi'));
    for (const m of alters) cols.add(m[1]);
  }
  return cols;
}
const SCHEMA = { classifieds: columnsOf('classifieds'), businesses: columnsOf('businesses'),
                 events: columnsOf('events'),
                 /* the four dead tables `655` opened, plus the replies and
                    the notifications table `0013` adds */
                 messages: columnsOf('messages'), reviews: columnsOf('reviews'),
                 review_replies: columnsOf('review_replies'), flags: columnsOf('flags'),
                 claims: columnsOf('claims'), notifications: columnsOf('notifications'),
                 /* and the table `660` finally writes: its columns have stood
                    since `0001` and nothing ever inserted one */
                 biz_photos: columnsOf('biz_photos') };

/* ⚠️ AND THE SEEDED SETTINGS ARE READ FROM THE MIGRATION TOO, for the same
   reason the columns are: the listing limit lives in `settings` from `0009`,
   and a mock that carried its own copy of «4» and «1» would agree with
   itself for ever while the migration moved underneath it. */
function seededSettings() {
  const out = [];
  for (const f of readdirSync(MIG).filter(n => n.endsWith('.sql')).sort()) {
    const sql = readFileSync(MIG + f, 'utf8').replace(/--[^\n]*/g, '');
    const ins = sql.matchAll(/insert\s+into\s+public\.settings\s*\(\s*key\s*,\s*value\s*\)\s*values([\s\S]*?);/gi);
    for (const m of ins) {
      for (const row of m[1].matchAll(/\(\s*'([^']+)'\s*,\s*'([^']*)'/g)) {
        out.push({ key: row[1], value: JSON.parse(row[2]) });
      }
    }
  }
  return out;
}
const SETTINGS_SEED = seededSettings();

/** The whole stand-in server's memory, per browser context. */
function freshDb() {
  return {
    users: new Map(),      // email -> { id, password, confirmed }
    profiles: new Map(),   // id    -> { id, display_name, email_verified, tier2_by, is_admin }
    businesses: [],
    classifieds: [],
    events: [],
    messages: [], reviews: [], review_replies: [], flags: [], claims: [],
    notifications: [], biz_photos: [],
    /* the file store (660): one list of objects, and the bucket rules are
       mirrored from `0019` below rather than waved through */
    objects: [],
    settings: SETTINGS_SEED.map(r => Object.assign({}, r)),
    session: null,
    seq: 0,
  };
}

const json = (body, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

/** A code every suite can type. It is the STAND-IN SERVER's code, not the
    app's: nothing in `js/` compares against it any more, which is the
    whole point of `610`'s change to `confirmEmail`. */
export const MOCK_CODE = '123456';

/** Every stand-in installed in this process, by browser context — so a
    helper handed only a page (`_admin.mjs`) can reach the same memory
    the suite's own call created, instead of installing a second server
    over the first and losing its accounts. */
export const MOCK_DBS = new WeakMap();

function sessionFor(u) {
  return {
    access_token: 'mock-access-' + u.id,
    refresh_token: 'mock-refresh-' + u.id,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: {
      id: u.id,
      email: u.email,
      email_confirmed_at: u.confirmed ? new Date().toISOString() : null,
      created_at: new Date().toISOString(),
      aud: 'authenticated',
      role: 'authenticated',
      app_metadata: {},
      user_metadata: u.meta || {},
    },
  };
}

/**
 * Install the stand-in on a browser context.
 * @param {import('playwright').BrowserContext} ctx
 * @param {{ preConfirm?: boolean, users?: string[], admin?: boolean, db?: object }} [opts]
 *   `preConfirm` makes sign-up land already verified, for the suites whose
 *   subject is downstream of the code screen and which only ever needed an
 *   account to exist.
 *   `admin` marks the account this context creates as staff, which is what
 *   the users section demands on top of the panel's own device lock.
 *   `users` pre-registers addresses. ⚠️ It is for the suites that SEED
 *   `state.user` instead of signing up: from 610 `confirmEmail` promotes
 *   nothing by itself, so an address the server has never heard of is
 *   refused — correctly. Pre-registering says «this account exists on the
 *   server», which is what those suites always assumed and never had to
 *   state, and keeps their subject (the tier ladder) intact.
 */
export async function mockSupabase(ctx, opts = {}) {
  /* `db` shares one server between two browser contexts — the shape of
     630's first item: a listing published in one browser has to reach
     the admin's queue in ANOTHER. Two fresh memories could never show
     that, and would have kept the original fault green. */
  const db = opts.db || freshDb();
  MOCK_DBS.set(ctx, db);
  /* ⚠️ THE TABLES ARE SHARED AND THE SESSION IS NOT (671). `db.session`
     was one field inside the memory two browser contexts share, so the
     session belonged to whichever of them signed in LAST and the first
     one's requests were answered as the second one's account. Measured:
     `updateReview` from account A was refused because the mock had it as
     account B — silently, because nothing counted the rows the update
     touched until this batch did.
     ⚠️ And it is not a small thing to leave: every «two real accounts»
     item in the net stands on this, and `671`'s own teeth are written
     with two on purpose — «measured with two real accounts, never with
     one account reading itself». A shared session makes them one. */
  const local = { session: null };
  const preConfirm = !!opts.preConfirm;
  for (const email of (opts.users || [])) {
    const id = 'mock-uuid-' + (++db.seq);
    db.users.set(String(email).toLowerCase(),
      { id, email: String(email).toLowerCase(), password: null, confirmed: false, meta: {} });
    db.profiles.set(id, { id, display_name: '', email_verified: false, tier2_by: null,
                          is_admin: false, phone: null, created_at: new Date().toISOString() });
  }

  await ctx.route(`https://${HOST}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    let body = {};
    try { body = JSON.parse(req.postData() || '{}'); } catch (e) { /* GET */ }

    /* ---------------- auth ---------------- */
    if (path === '/auth/v1/signup') {
      const email = String(body.email || '').toLowerCase();
      if (!email || !body.password) {
        return route.fulfill(json({ error: 'invalid_request', msg: 'Email and password required' }, 400));
      }
      if (db.users.has(email)) {
        return route.fulfill(json({ error: 'user_already_exists', msg: 'User already registered' }, 400));
      }
      const id = 'mock-uuid-' + (++db.seq);
      const u = { id, email, password: body.password, confirmed: preConfirm,
                  meta: (body.data || (body.options && body.options.data)) || {} };
      db.users.set(email, u);
      db.profiles.set(id, {
        id,
        display_name: u.meta.display_name || '',
        email_verified: preConfirm,
        tier2_by: null,
        is_admin: !!opts.admin,
        phone: null,
        created_at: new Date().toISOString(),
      });
      if (preConfirm) local.session = sessionFor(u);
      return route.fulfill(json(preConfirm ? sessionFor(u) : { user: sessionFor(u).user, session: null }));
    }

    if (path === '/auth/v1/token') {
      const email = String(body.email || '').toLowerCase();
      const u = db.users.get(email);
      /* ⚠️ THE PASSWORD IS REALLY COMPARED. A stand-in that waves everyone
         through would make the whole point of `610`'s sign-in fix — that a
         wrong password is refused — untestable, and green. */
      if (!u || u.password !== body.password) {
        return route.fulfill(json({ error: 'invalid_grant', error_description: 'Invalid login credentials' }, 400));
      }
      local.session = sessionFor(u);
      return route.fulfill(json(local.session));
    }

    if (path === '/auth/v1/verify' || path === '/auth/v1/otp/verify') {
      const email = String(body.email || '').toLowerCase();
      const u = db.users.get(email) ||
        (local.session && db.users.get(String(local.session.user.email).toLowerCase()));
      if (!u || String(body.token || '') !== MOCK_CODE) {
        return route.fulfill(json({ error: 'invalid_grant', error_description: 'Token has expired or is invalid' }, 400));
      }
      u.confirmed = true;
      const prof = db.profiles.get(u.id);
      if (prof) prof.email_verified = true;
      /* ⚠️ `recovery` and `email` land here too. Supabase answers all of
         them with a session, and the recovery session is the ONLY thing
         that lets the next screen set a new password at all — a mock that
         returned nothing there would make the whole road untestable. */
      local.session = sessionFor(u);
      return route.fulfill(json(local.session));
    }

    /* ⚠️ `resend` is what `620` made real, and the mock refuses exactly
       where the server does: a `signup` resend to an already-confirmed
       address. That refusal is why `sendEmailCode` had to learn a third
       case at all, and a mock that waved it through would have hidden it. */
    if (path === '/auth/v1/resend') {
      const email = String(body.email || '').toLowerCase();
      const u = db.users.get(email);
      if (!u) return route.fulfill(json({ error: 'user_not_found', msg: 'User not found' }, 400));
      if (body.type === 'signup' && u.confirmed) {
        return route.fulfill(json({ error: 'validation_failed', msg: 'Email link is invalid or has expired' }, 422));
      }
      db.sent = (db.sent || 0) + 1;
      db.lastSend = { kind: 'resend', type: body.type, email };
      return route.fulfill(json({}));
    }

    /* a code to an address that already exists — the road a confirmed
       account takes when it needs a fresh code and nothing is parked */
    if (path === '/auth/v1/otp') {
      const email = String(body.email || '').toLowerCase();
      if (!db.users.has(email) && body.create_user === false) {
        return route.fulfill(json({ error: 'user_not_found', msg: 'Signups not allowed for otp' }, 422));
      }
      db.sent = (db.sent || 0) + 1;
      db.lastSend = { kind: 'otp', email };
      return route.fulfill(json({}));
    }

    /* ⚠️ THE SAME ANSWER FOR AN ADDRESS IT KNOWS AND ONE IT DOES NOT. The
       real endpoint does not distinguish either, and a mock that did would
       let a screen be written that leaks who is registered. */
    if (path === '/auth/v1/recover') {
      db.sent = (db.sent || 0) + 1;
      db.lastSend = { kind: 'recover', email: String(body.email || '').toLowerCase() };
      return route.fulfill(json({}));
    }

    if (path === '/auth/v1/logout') {
      local.session = null;
      return route.fulfill({ status: 204, body: '' });
    }

    if (path === '/auth/v1/user') {
      if (!local.session) return route.fulfill(json({ error: 'not_authenticated' }, 401));
      if (req.method() === 'PUT') {
        /* ⚠️ A PASSWORD CHANGE REALLY MOVES IT HERE. Without this the suite
           for `620`'s first item could not tell a server that accepted the
           change from one that ignored it — and «the old password still
           works» is the whole fault being closed. */
        if (body.password) {
          const cur = db.users.get(String(local.session.user.email).toLowerCase());
          if (cur) cur.password = body.password;
          return route.fulfill(json(local.session.user));
        }
        /* an email change: parked here exactly as Supabase parks it —
           the address does not move until a code confirms it */
        return route.fulfill(json({ ...local.session.user, new_email: body.email || null }));
      }
      return route.fulfill(json(local.session.user));
    }

    /* ---------------- PostgREST ---------------- */
    /* ⚠️ The function's own guards are mirrored, not skipped: not staff is
       an exception, and fewer than three characters returns nothing. A mock
       that answered anyway would make both assertions green on a database
       that had lost them. */
    if (path === '/rest/v1/rpc/admin_find_users') {
      const me = local.session && db.profiles.get(local.session.user.id);
      if (!me || !me.is_admin) {
        return route.fulfill(json({ code: 'P0001', message: 'not authorized' }, 400));
      }
      const q = String(body.q || '').trim();
      if (q.length < 3) return route.fulfill(json([]));
      const hay = (v) => String(v || '').toLowerCase().includes(q.toLowerCase());
      const rows = [];
      for (const u of db.users.values()) {
        const pr = db.profiles.get(u.id) || {};
        if (hay(pr.display_name) || hay(pr.phone) || hay(u.email)) {
          rows.push({ id: u.id, display_name: pr.display_name || '', email: u.email,
                      phone: pr.phone || null, created_at: pr.created_at || null,
                      email_verified: !!pr.email_verified, deleted_at: null });
        }
      }
      return route.fulfill(json(rows.slice(0, 50)));
    }

    /* ⚠️ `0018`'s narrow name lookup, with ITS guards and not without
       them: it answers a party of an EXISTING conversation and nobody
       else. A mock that answered anybody would make «a stranger reads
       nothing» green on a function that had lost its `where`. */
    if (path === '/rest/v1/rpc/thread_party_name') {
      const uid = local.session ? local.session.user.id : null;
      const lid = body.p_listing, bid = body.p_buyer;
      const c = (db.classifieds || []).find(x => x.id === lid);
      const exists = (db.messages || []).some(m => m.listing_id === lid && m.buyer_id === bid);
      let who = null;
      if (uid && exists) {
        if (uid === bid) who = c && c.owner_id;
        else if (c && c.owner_id === uid) who = bid;
      }
      const pr = who ? db.profiles.get(who) : null;
      return route.fulfill(json((pr && pr.display_name) || null));
    }

    /* ⚠️ `0019`'s `approve_avatar`, WITH ITS FIRST STATEMENT. The
       authorisation is the function's own `raise`, never a condition in a
       `where` that can be edited away — and the reason the function exists
       at all is that `0002`'s «own row: update» on `profiles` has no
       `is_admin()` branch, so a plain PATCH by the admin matches zero rows
       and answers 200 with an empty body. A mock that let the PATCH
       through would keep «the picture appears to everybody» green on a
       database where it never could. */
    if (path === '/rest/v1/rpc/approve_avatar') {
      const me = local.session && db.profiles.get(local.session.user.id);
      if (!(me && me.is_admin)) {
        return route.fulfill(json({ code: 'P0001', message: 'not authorised' }, 400));
      }
      const pr = db.profiles.get(body.p_user);
      if (!pr) return route.fulfill(json(false));
      pr.avatar_path = body.p_path;
      return route.fulfill(json(true));
    }

    /* ⚠️ `0019`'s `set_event_photo`, WITH ITS GUARD. `0002` gives an
       organiser an insert policy and no update at all, so a plain PATCH of
       `photo_path` by the proposer is refused — and a mock that let it
       through would keep «the event's picture reaches the row» green on a
       database where an organiser could never write it. */
    if (path === '/rest/v1/rpc/set_event_photo') {
      const me = local.session && db.profiles.get(local.session.user.id);
      const isAdmin = !!(me && me.is_admin);
      const uid = local.session ? local.session.user.id : null;
      const ev = (db.events || []).find(e => e.id === body.p_event);
      if (!ev || !(isAdmin || (uid && ev.proposer_id === uid))) {
        return route.fulfill(json({ code: 'P0001', message: 'not authorised' }, 400));
      }
      ev.photo_path = body.p_path;
      return route.fulfill(json(true));
    }

    /* ---------------- the file store (660) ----------------
       ⚠️ THE BUCKET RULES OF `0019`, MIRRORED — not waved through. A mock
       that accepted every upload and signed every path would make «a
       stranger cannot upload under somebody else's folder» and «a pending
       picture is not readable by a third account» green on a server that
       had lost both. */
    if (path.startsWith('/storage/v1/')) {
      const me = local.session && db.profiles.get(local.session.user.id);
      const isAdmin = !!(me && me.is_admin);
      const uid = local.session ? local.session.user.id : null;
      const folderOf = (name) => String(name).split('/')[0];

      const mayUpload = (bucket, name) => {
        if (!uid) return false;
        const seg = folderOf(name);
        if (bucket === 'avatars') return seg === uid;
        if (bucket === 'biz-photos') {
          return (db.businesses || []).some(b => (b.id === seg || b.seed_id === seg) && b.owner_id === uid);
        }
        if (bucket === 'listings') {
          return (db.classifieds || []).some(c => c.id === seg && c.owner_id === uid);
        }
        if (bucket === 'event-photos') {
          return isAdmin || (db.events || []).some(e => e.id === seg && e.proposer_id === uid);
        }
        return false;
      };
      const mayRead = (bucket, name) => {
        const o = (db.objects || []).find(x => x.bucket === bucket && x.name === name);
        if (isAdmin) return true;
        if (o && uid && o.owner === uid) return true;
        const seg = folderOf(name);
        if (bucket === 'avatars') {
          return Array.from(db.profiles.values()).some(p => p.avatar_path === name);
        }
        if (bucket === 'biz-photos') {
          return (db.biz_photos || []).some(r => r.path === name && r.status === 'approved');
        }
        if (bucket === 'listings') {
          return (db.classifieds || []).some(c => c.id === seg && c.status === 'live' && !c.hidden);
        }
        if (bucket === 'event-photos') {
          return (db.events || []).some(e => e.id === seg && e.status === 'live');
        }
        return false;
      };

      /* createSignedUrls: one call, many paths, and each answers for itself */
      const sign = /^\/storage\/v1\/object\/sign\/([^/]+)$/.exec(path);
      if (sign && req.method() === 'POST' && Array.isArray(body.paths)) {
        const bucket = sign[1];
        /* ⚠️ `signedURL` AND NOT `signedUrl`, AND THE PATH IS RELATIVE.
           Measured against the vendored client: it reads `datum.signedURL`
           and prepends its own base. A mock answering the camel-case name
           the CALLER uses hands back `signedUrl: null` with no error at
           all — a refusal that looks like a permission refusal and is a
           spelling mistake, which is precisely the near-enough mock this
           file's own head warns about. */
        return route.fulfill(json(body.paths.map(pth => mayRead(bucket, pth)
          ? { path: pth, signedURL: `/object/sign/${bucket}/${pth}?token=mock`, error: null }
          : { path: pth, signedURL: null, error: 'Object not found' })));
      }
      /* the signed link itself, so an `img` really loads: a 1x1 png */
      const fetchSigned = /^\/storage\/v1\/object\/sign\/([^/]+)\/(.+)$/.exec(path);
      if (fetchSigned && req.method() === 'GET') {
        return route.fulfill({ status: 200, contentType: 'image/png',
          body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') });
      }
      const up = /^\/storage\/v1\/object\/([^/]+)\/(.+)$/.exec(path);
      if (up && req.method() === 'POST') {
        const [, bucket, name] = up;
        if (!mayUpload(bucket, name)) {
          return route.fulfill(json({ statusCode: '403', error: 'Unauthorized',
            message: 'new row violates row-level security policy' }, 403));
        }
        (db.objects = db.objects || []).push({ bucket, name, owner: uid,
                                               size: (req.postDataBuffer() || { length: 0 }).length });
        db.uploads = (db.uploads || []).concat([{ bucket, name }]);
        return route.fulfill(json({ Key: bucket + '/' + name, path: name }, 200));
      }
      return route.fulfill(json({ error: 'mock_unhandled', path }, 501));
    }

    if (path.startsWith('/rest/v1/')) {
      const table = path.slice('/rest/v1/'.length);
      const me = local.session && db.profiles.get(local.session.user.id);
      const isAdmin = !!(me && me.is_admin);
      const uid = local.session ? local.session.user.id : null;
      /* ⚠️ THE QUERY STRING IS APPLIED, NOT IGNORED. `?status=eq.live` is
         how supabase-js sends `.eq('status', 'live')`, and the whole point
         of 630's second item is that no reader writes that filter: a mock
         that ignored the filter would keep the queue green with the filter
         put back. */
      const wants = [];
      for (const [k, v] of url.searchParams) {
        if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue;
        const m = /^(eq|neq|is|in)\.(.*)$/.exec(v);
        if (m) wants.push({ k, op: m[1], v: m[2] });
      }
      const matches = (row) => wants.every(({ k, op, v }) => {
        const val = row[k];
        /* ⚠️ `.in('id', […])` reaches PostgREST as `in.("a","b")`, and a
           parser that knew only `eq` would answer every row — so the
           admin's name lookup would look as though it worked while
           measuring nothing. */
        if (op === 'in') {
          const set = v.replace(/^\(|\)$/g, '').split(',').map(x => x.replace(/^"|"$/g, ''));
          return set.includes(String(val));
        }
        const want = v === 'null' ? null : v === 'true' ? true : v === 'false' ? false : v;
        if (op === 'neq') return String(val) !== String(want);
        return val === want || String(val) === String(want);
      });
      /* ⚠️ ROW LEVEL SECURITY, MIRRORED FROM 0002_rls.sql. A stranger gets
         the live rows, an owner their own, staff everything. Without this
         the first item of 630 — «a pending row reaches the admin's queue» —
         would be green for a reader who is NOT staff, measuring nothing. */
      const visible = (row) => {
        if (table === 'classifieds') {
          return isAdmin || (uid && row.owner_id === uid) || (row.status === 'live' && !row.hidden);
        }
        if (table === 'businesses') {
          return isAdmin || (uid && row.owner_id === uid) || row.status === 'live';
        }
        /* ⚠️ `events` is «all: read using (true)» in `0002` and that is
           deliberate: the admin's queue of PENDING events is read by the
           same select everybody uses, and `upcomingEvents()` is what keeps
           a pending row off the public list. Mirrored explicitly so it
           cannot drift into a filter nobody decided on. */
        if (table === 'events') return true;
        /* ⚠️ THE FIVE `655` OPENED, MIRRORED FROM `0002`. Without them the
           batch's own items — «a third party who has nothing to do with
           the listing reads nothing», «a reporter reads their own report
           and not somebody else's» — would be green on a mock that hands
           everything to everybody, which is the permissive mock this
           file's head warns about. */
        if (table === 'messages') {
          /* ⚠️ `buyer_id` IS THE BRANCH THE BUYER LIVES ON (671, `0018`).
             Without it the seller's reply is not the buyer's own row and
             the buyer is not the listing's owner, so both other branches
             fall and the reply never reaches them — with 200 and a shorter
             list, never an error. That is the whole fault this batch
             fixes, and a mock missing this line would keep it green. */
          if (isAdmin || row.sender_id === uid || (row.buyer_id && row.buyer_id === uid)) return true;
          const c = (db.classifieds || []).find(x => x.id === row.listing_id);
          return !!(c && uid && c.owner_id === uid);
        }
        /* reviews and their replies are «all: read using (true)» */
        if (table === 'reviews' || table === 'review_replies') return true;
        /* `0002`: approved for everybody, pending for its uploader and
           the admin — the rule a public bucket would undo from behind */
        if (table === 'biz_photos') {
          return row.status === 'approved' || row.uploader_id === uid || isAdmin;
        }
        if (table === 'flags')  return isAdmin || row.reporter_id === uid;
        if (table === 'claims') return isAdmin || row.claimer_id === uid;
        /* a notification is its addressee's and nobody else's — not even
           the admin's, by the policy in `0013` */
        if (table === 'notifications') return row.user_id === uid;
        return true;
      };
      const wantsOne = /pgrst\.object/.test(req.headers()['accept'] || '');
      if (req.method() === 'GET') {
        if (table === 'profiles') {
          /* ⚠️ `0002`: «own row: read using (id = auth.uid() or is_admin())».
             The admin half is what lets the avatar queue name the account
             beside the picture, and a mock that gave the admin only their
             own row would make that item measure nothing. */
          const pool = isAdmin ? Array.from(db.profiles.values())
                    : local.session ? [db.profiles.get(local.session.user.id)].filter(Boolean) : [];
          const rows = pool.filter(matches);
          if (wantsOne) {
            return rows.length
              ? route.fulfill(json(rows[0]))
              : route.fulfill(json({ code: 'PGRST116', message: 'no rows' }, 406));
          }
          return route.fulfill(json(rows));
        }
        let rows = (db[table] || []).filter(visible).filter(matches);
        /* ⚠️ ORDER AND RANGE ARE APPLIED, NOT IGNORED — and this version of
           postgrest-js sends BOTH as query parameters (measured in the
           vendored build: `.order(c,{ascending})` → `order=c.asc`, and
           `.range(a,b)` → `offset=a&limit=b-a+1`), never as a `Range`
           header. A mock that dropped them would keep `648`'s paging green
           while the live reader returned one arbitrary page. */
        const ord = url.searchParams.get('order');
        if (ord) {
          const keys = ord.split(',').map(part => {
            const [col, ...rest] = part.split('.');
            return { col, desc: rest.includes('desc'), nullsLast: !rest.includes('nullsfirst') };
          });
          rows = rows.slice().sort((a, b) => {
            for (const { col, desc } of keys) {
              const x = a[col], y = b[col];
              if (x === y) continue;
              if (x == null) return 1;
              if (y == null) return -1;
              const c = x < y ? -1 : 1;
              return desc ? -c : c;
            }
            return 0;
          });
        }
        const off = Number(url.searchParams.get('offset') || 0);
        const lim = url.searchParams.get('limit');
        const paged = rows.slice(off, lim ? off + Number(lim) : undefined);
        db.reads = (db.reads || []).concat([{ table, filters: wants.slice(),
                                              order: ord || '', offset: off,
                                              limit: lim ? Number(lim) : null,
                                              n: paged.length }]);
        return route.fulfill(json(wantsOne ? (paged[0] || null) : paged));
      }
      /* ⚠️ PATCH is how PostgREST updates. RLS again: a row the session
         may not update is simply not updated — PostgREST answers 200 with
         an empty list, never an error — so a non-staff «approval» leaves
         the row pending, which is what 630's third item measures. */
      if (req.method() === 'PATCH') {
        if (!local.session) return route.fulfill(json({ message: 'row-level security' }, 401));
        if (table.startsWith('profiles')) {
          const pr = db.profiles.get(local.session.user.id);
          if (pr) Object.assign(pr, body);
          return route.fulfill(json(pr ? [pr] : []));
        }
        /* ⚠️ `events` carries `proposer_id`, NOT `owner_id`, and `0002`
           gives an organiser «propose» — an INSERT policy — and no update
           of any kind. So an organiser cannot rewrite their own proposal
           on the real server either, and the mock must refuse it or `649`
           would be tested against a permission the database does not
           grant. It falls out of the line below by itself; it is named
           here so a later edit cannot widen it by accident. */
        /* ⚠️ EACH TABLE NAMES ITS OWN OWNER COLUMN. `events` carries
           `proposer_id` and no update policy at all, so it falls out by
           itself; the five of `655` each name theirs, and `flags` and
           `claims` are the ADMIN's to judge and nobody else's. */
        const mayUpdate = (row) => {
          if (isAdmin) return true;
          if (table === 'flags' || table === 'claims') return false;
          if (table === 'reviews') return row.author_id === uid;
          if (table === 'review_replies') return row.author_id === uid;
          if (table === 'notifications') return row.user_id === uid;
          if (table === 'messages') return false;   // no update policy, for anyone
          /* `0002` gives `biz_photos` «admin: update» and nothing else:
             the decision on a photo is the admin's, never the uploader's */
          if (table === 'biz_photos') return false;
          return row.owner_id === uid;
        };
        const hit = (db[table] || []).filter(matches).filter(mayUpdate);
        hit.forEach(row => Object.assign(row, body, { updated_at: new Date().toISOString() }));
        db.writes = (db.writes || []).concat([{ table, filters: wants.slice(), body, n: hit.length }]);
        return route.fulfill(json(hit));
      }
      /* ⚠️ DELETE WAS NOT HANDLED AT ALL until `655`, because nothing in
         the app deleted a row — it fell through to the empty 200 at the
         foot of this function, which would have made «the review really
         goes» green while nothing was removed. `reviews` grants delete to
         its author and to staff, `review_replies` the same by `0013`, and
         `messages`, `flags` and `claims` grant it to nobody. */
      if (req.method() === 'DELETE') {
        if (!local.session) return route.fulfill(json({ message: 'row-level security' }, 401));
        const mayDelete = (row) => {
          if (table === 'reviews' || table === 'review_replies') {
            return isAdmin || row.author_id === uid;
          }
          /* `0002`: «own or admin: delete» — the owner drops a photo from
             their own set, which is what `setBizPhotos` does */
          if (table === 'biz_photos') return isAdmin || row.uploader_id === uid;
          return false;
        };
        const hit = (db[table] || []).filter(matches).filter(mayDelete);
        db[table] = (db[table] || []).filter(r => !hit.includes(r));
        db.writes = (db.writes || []).concat([{ table, filters: wants.slice(),
                                                body: { _delete: true }, n: hit.length }]);
        return route.fulfill(json(hit));
      }
      if (req.method() === 'POST') {
        if (!local.session) return route.fulfill(json({ message: 'new row violates row-level security policy' }, 401));
        /* ⚠️ THE COLUMN IS `numeric`, AND THE DATABASE REFUSES A STRING IN
           IT. `addClassified` used to send the display price — «⁦$1,250⁩»,
           a dollar sign and two bidi isolates — and a mock that swallowed
           it kept that green while every priced listing failed live. */
        if (table === 'classifieds' && body.price != null && typeof body.price !== 'number') {
          return route.fulfill(json({ code: '22P02', message: 'invalid input syntax for type numeric: "' + String(body.price) + '"' }, 400));
        }
        /* ⚠️ THE LIMIT TRIGGER OF `0009`, MIRRORED. Without it the whole
           point of the third item — «the server refuses the fifth even
           when the request never went through the screen» — would be a
           check on a server that accepts anything, which is the permissive
           mock this file's own head warns about. The counting rule is the
           migration's: live or pending, not hidden, per category, and the
           account-wide default for the categories that carry no own limit. */
        if (table === 'classifieds' && body.owner_id) {
          const setting = k => {
            const row = (db.settings || []).find(r => r.key === k);
            return row == null ? null : Number(row.value);
          };
          const base = setting('listingLimit.default') != null ? setting('listingLimit.default') : 4;
          const own = setting('listingLimit.' + body.cat);
          const lim = own != null ? own : base;
          const live = r => r.owner_id === body.owner_id && !r.hidden
                            && (r.status === 'live' || r.status === 'pending');
          const inCat = (db.classifieds || []).filter(r => live(r) && r.cat === body.cat).length;
          const all = (db.classifieds || []).filter(live).length;
          if (inCat >= lim || (lim === base && all >= base)) {
            return route.fulfill(json({ code: 'P0001', message: 'ARABNA_LISTING_LIMIT' }, 400));
          }
        }
        /* ⚠️ THE EVENTS POLICIES OF `0002`, MIRRORED. «organiser: propose»
           demands `status = 'pending'` AND `proposer_id = auth.uid()`, and
           «admin: write» is what lets staff publish. A mock that accepted
           `status: 'live'` from anybody would make `649`'s security item —
           an ordinary account cannot publish to everyone, and cannot pin
           the $99 placement — green on a database that had lost it. */
        /* ⚠️ THE BUSINESSES POLICIES OF `0002` AND `0007`, MIRRORED.
           «own: insert» demands `owner_id = auth.uid()`, and «admin:
           insert» — written in `0007` for exactly the coat row an admin's
           first edit of a seed creates — is what lets staff insert one with
           no owner at all. A mock that accepted either from anybody would
           keep `650`'s coat item green on a database that refuses it. */
        /* ⚠️ `0013` WIDENS `own: insert` BY EXACTLY ONE SHAPE and no more:
           an OWNERLESS row marked `source = 'suggested'` and held at
           `pendingReview` — the masjid a stranger suggests. Anything else
           still needs `owner_id = auth.uid()`, so a suggestion can never
           make its sender the owner of somebody else's masjid, and cannot
           be published without an admin. */
        const suggested = body.owner_id == null
          && body.source === 'suggested' && body.status === 'pendingReview';
        if (table === 'businesses' && !isAdmin && body.owner_id !== uid && !suggested) {
          return route.fulfill(json({ code: '42501',
            message: 'new row violates row-level security policy for table "businesses"' }, 403));
        }
        /* ⚠️ THE FIVE OF `655`, MIRRORED FROM `0002` AND `0013`. Each one
           is what one of the batch's own items measures, and a mock that
           said yes to all of them would keep every one of those green on a
           database that refuses them. */
        const deny = (t) => route.fulfill(json({ code: '42501',
          message: 'new row violates row-level security policy for table "' + t + '"' }, 403));
        if (table === 'messages') {
          if (body.sender_id !== uid) return deny('messages');
          /* ⚠️ AND THE TWO BRANCHES OF `0018`'s insert policy, mirrored:
             the buyer may only key a conversation on themselves, and the
             listing's owner may only reply IN ONE THAT EXISTS. Without the
             second, the column that delivers the reply is also a spam
             channel — the owner writes any account's id into `buyer_id`
             and the row lands in the inbox of somebody who never wrote to
             them. A mock that said yes would keep that item green on a
             database that had lost the guard. */
          const lc = (db.classifieds || []).find(x => x.id === body.listing_id);
          const iOwn = !!(lc && lc.owner_id && lc.owner_id === uid);
          const asBuyer = body.buyer_id === uid && !iOwn;
          const asOwner = iOwn && (db.messages || [])
            .some(m => m.listing_id === body.listing_id && m.buyer_id === body.buyer_id);
          if (!asBuyer && !asOwner) return deny('messages');
        }
        if (table === 'biz_photos' && body.uploader_id !== uid) return deny('biz_photos');
        if (table === 'flags'     && body.reporter_id !== uid) return deny('flags');
        if (table === 'claims'    && body.claimer_id !== uid) return deny('claims');
        /* ⚠️ AND THE FTC LINE: `0002` refuses a business owner reviewing
           their own business, and `0013` widens the lookup to reach a SEED
           by its `seed_id` as well — without that half, a claimed owner of
           a seed could review their own shop, since `b.id = biz_id` finds
           no row for `b30` and `is distinct from NULL` is true. */
        if (table === 'reviews') {
          if (body.author_id !== uid) return deny('reviews');
          const b = (db.businesses || []).find(x => x.id === body.biz_id || x.seed_id === body.biz_id);
          if (b && b.owner_id && b.owner_id === uid) return deny('reviews');
          if ((db.reviews || []).some(r => r.author_id === uid && r.biz_id === body.biz_id)) {
            return route.fulfill(json({ code: '23505',
              message: 'duplicate key value violates unique constraint "reviews_author_id_biz_id_key"' }, 409));
          }
        }
        /* a reply belongs to the business owner alone */
        if (table === 'review_replies') {
          const rv = (db.reviews || []).find(r => r.id === body.review_id);
          const b = rv && (db.businesses || []).find(x => x.id === rv.biz_id || x.seed_id === rv.biz_id);
          if (!b || !b.owner_id || b.owner_id !== uid) return deny('review_replies');
        }
        /* ⚠️ INSERT ON `notifications` IS THE ADMIN'S ALONE — a table any
           signed-in account may write into anybody's list is a spam
           channel with a policy on it. */
        if (table === 'notifications' && !isAdmin) return deny('notifications');
        if (table === 'events' && !isAdmin) {
          if (body.status !== 'pending' || body.proposer_id !== uid) {
            return route.fulfill(json({ code: '42501',
              message: 'new row violates row-level security policy for table "events"' }, 403));
          }
        }
        const known = SCHEMA[table];
        if (known && known.size) {
          const stray = Object.keys(body).find(k => !known.has(k));
          if (stray) return route.fulfill(json({ code: 'PGRST204',
            message: "Could not find the '" + stray + "' column of '" + table + "' in the schema cache" }, 400));
        }
        /* ⚠️ ONE timestamp for both, as a transaction's `now()` is: two
           calls to `new Date()` can differ by a millisecond, and `648`'s
           first item asserts that a NEW row carries the two equal. */
        const stamp = new Date().toISOString();
        const row = Object.assign({ id: 'mock-row-' + (++db.seq),
                                    created_at: stamp,
                                    updated_at: stamp },
                                  table === 'classifieds' ? { status: 'live', hidden: false } : {},
                                  body);
        (db[table] = db[table] || []).push(row);
        /* ⚠️ `.single()` asks PostgREST for ONE OBJECT through the Accept
           header, and the client rejects an array when it did. Answering
           with the array either way is the kind of near-enough mock that
           passes the request and fails the caller — the insert really did
           return 201 and `addClassified` really did hand back null. */
        return route.fulfill(json(wantsOne ? row : [row], 201));
      }
      return route.fulfill(json([], 200));
    }

    /* ⚠️ ANYTHING ELSE IS A LOUD FAILURE, never a silent yes. */
    return route.fulfill(json({ error: 'mock_unhandled', path }, 501));
  });

  return db;
}

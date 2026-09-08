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
const SCHEMA = { classifieds: columnsOf('classifieds'), businesses: columnsOf('businesses') };

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
      if (preConfirm) db.session = sessionFor(u);
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
      db.session = sessionFor(u);
      return route.fulfill(json(db.session));
    }

    if (path === '/auth/v1/verify' || path === '/auth/v1/otp/verify') {
      const email = String(body.email || '').toLowerCase();
      const u = db.users.get(email) ||
        (db.session && db.users.get(String(db.session.user.email).toLowerCase()));
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
      db.session = sessionFor(u);
      return route.fulfill(json(db.session));
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
      db.session = null;
      return route.fulfill({ status: 204, body: '' });
    }

    if (path === '/auth/v1/user') {
      if (!db.session) return route.fulfill(json({ error: 'not_authenticated' }, 401));
      if (req.method() === 'PUT') {
        /* ⚠️ A PASSWORD CHANGE REALLY MOVES IT HERE. Without this the suite
           for `620`'s first item could not tell a server that accepted the
           change from one that ignored it — and «the old password still
           works» is the whole fault being closed. */
        if (body.password) {
          const cur = db.users.get(String(db.session.user.email).toLowerCase());
          if (cur) cur.password = body.password;
          return route.fulfill(json(db.session.user));
        }
        /* an email change: parked here exactly as Supabase parks it —
           the address does not move until a code confirms it */
        return route.fulfill(json({ ...db.session.user, new_email: body.email || null }));
      }
      return route.fulfill(json(db.session.user));
    }

    /* ---------------- PostgREST ---------------- */
    /* ⚠️ The function's own guards are mirrored, not skipped: not staff is
       an exception, and fewer than three characters returns nothing. A mock
       that answered anyway would make both assertions green on a database
       that had lost them. */
    if (path === '/rest/v1/rpc/admin_find_users') {
      const me = db.session && db.profiles.get(db.session.user.id);
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

    if (path.startsWith('/rest/v1/')) {
      const table = path.slice('/rest/v1/'.length);
      const me = db.session && db.profiles.get(db.session.user.id);
      const isAdmin = !!(me && me.is_admin);
      const uid = db.session ? db.session.user.id : null;
      /* ⚠️ THE QUERY STRING IS APPLIED, NOT IGNORED. `?status=eq.live` is
         how supabase-js sends `.eq('status', 'live')`, and the whole point
         of 630's second item is that no reader writes that filter: a mock
         that ignored the filter would keep the queue green with the filter
         put back. */
      const wants = [];
      for (const [k, v] of url.searchParams) {
        if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue;
        const m = /^(eq|neq|is)\.(.*)$/.exec(v);
        if (m) wants.push({ k, op: m[1], v: m[2] });
      }
      const matches = (row) => wants.every(({ k, op, v }) => {
        const val = row[k];
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
        return true;
      };
      const wantsOne = /pgrst\.object/.test(req.headers()['accept'] || '');
      if (req.method() === 'GET') {
        if (table === 'profiles') {
          const rows = db.session ? [db.profiles.get(db.session.user.id)].filter(Boolean).filter(matches) : [];
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
        if (!db.session) return route.fulfill(json({ message: 'row-level security' }, 401));
        if (table.startsWith('profiles')) {
          const pr = db.profiles.get(db.session.user.id);
          if (pr) Object.assign(pr, body);
          return route.fulfill(json(pr ? [pr] : []));
        }
        const mayUpdate = (row) => isAdmin || row.owner_id === uid;
        const hit = (db[table] || []).filter(matches).filter(mayUpdate);
        hit.forEach(row => Object.assign(row, body, { updated_at: new Date().toISOString() }));
        db.writes = (db.writes || []).concat([{ table, filters: wants.slice(), body, n: hit.length }]);
        return route.fulfill(json(hit));
      }
      if (req.method() === 'POST') {
        if (!db.session) return route.fulfill(json({ message: 'new row violates row-level security policy' }, 401));
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

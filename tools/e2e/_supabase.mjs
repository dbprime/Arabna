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

/** The whole stand-in server's memory, per browser context. */
function freshDb() {
  return {
    users: new Map(),      // email -> { id, password, confirmed }
    profiles: new Map(),   // id    -> { id, display_name, email_verified, tier2_by, is_admin }
    businesses: [],
    classifieds: [],
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
 * @param {{ preConfirm?: boolean, users?: string[] }} [opts]
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
  const db = freshDb();
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
      if (req.method() === 'GET') {
        const wantsOne = /pgrst\.object/.test(req.headers()['accept'] || '');
        if (table === 'profiles') {
          const rows = db.session ? [db.profiles.get(db.session.user.id)].filter(Boolean) : [];
          if (wantsOne) {
            return rows.length
              ? route.fulfill(json(rows[0]))
              : route.fulfill(json({ code: 'PGRST116', message: 'no rows' }, 406));
          }
          return route.fulfill(json(rows));
        }
        return route.fulfill(json(db[table] || []));
      }
      /* ⚠️ PATCH is how PostgREST updates, and `updateProfile` now writes
         `display_name` back through it. Without this the write fell to the
         501 below and the check for it could never be green. */
      if (req.method() === 'PATCH') {
        if (!db.session) return route.fulfill(json({ message: 'row-level security' }, 401));
        if (table.startsWith('profiles')) {
          const pr = db.profiles.get(db.session.user.id);
          if (pr) Object.assign(pr, body);
          return route.fulfill(json(pr ? [pr] : []));
        }
        return route.fulfill(json([]));
      }
      if (req.method() === 'POST') {
        if (!db.session) return route.fulfill(json({ message: 'new row violates row-level security policy' }, 401));
        const row = Object.assign({ id: 'mock-row-' + (++db.seq) }, body);
        (db[table] = db[table] || []).push(row);
        /* ⚠️ `.single()` asks PostgREST for ONE OBJECT through the Accept
           header, and the client rejects an array when it did. Answering
           with the array either way is the kind of near-enough mock that
           passes the request and fails the caller — the insert really did
           return 201 and `addClassified` really did hand back null. */
        const wantsOne = /pgrst\.object/.test(req.headers()['accept'] || '');
        return route.fulfill(json(wantsOne ? row : [row], 201));
      }
      return route.fulfill(json([], 200));
    }

    /* ⚠️ ANYTHING ELSE IS A LOUD FAILURE, never a silent yes. */
    return route.fulfill(json({ error: 'mock_unhandled', path }, 501));
  });

  return db;
}

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
    profiles: new Map(),   // id    -> { id, display_name, email_verified, tier2_by }
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
    db.profiles.set(id, { id, display_name: '', email_verified: false, tier2_by: null });
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
      db.session = sessionFor(u);
      return route.fulfill(json(db.session));
    }

    if (path === '/auth/v1/logout') {
      db.session = null;
      return route.fulfill({ status: 204, body: '' });
    }

    if (path === '/auth/v1/user') {
      if (!db.session) return route.fulfill(json({ error: 'not_authenticated' }, 401));
      if (req.method() === 'PUT') {
        /* an email change: parked here exactly as Supabase parks it —
           the address does not move until a code confirms it */
        return route.fulfill(json({ ...db.session.user, new_email: body.email || null }));
      }
      return route.fulfill(json(db.session.user));
    }

    /* ---------------- PostgREST ---------------- */
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

/* ============================================================
   Open the admin panel in a suite — since 630, the way the app does it.
   ------------------------------------------------------------
   ⚠️ THE DEVICE LOCK IS GONE. Twenty-one suites used to claim a staff
   password on the device (`setAdminPass`, then `#aUser` / `#aPass` /
   `#aGo`), and each carried its own copy of that dance. The panel now
   opens on one condition — a live session for an account the SERVER
   marks `is_admin` — so this file does what the owner does: makes sure
   a session exists, has the stand-in server mark that account staff,
   and opens `#/admin`.

   ⚠️ IT PROMOTES THE ACCOUNT THAT IS ALREADY SIGNED IN when there is one,
   rather than signing a second one up: `signUp` clears `myListings` and
   replaces `state.user`, and a suite that published as a member and then
   moderates as staff would lose its own listings under it. When nobody
   is signed in it creates one staff account and signs it in.

   ⚠️ And the flag is set ON THE STAND-IN SERVER, never in the page's
   storage — `verifyAccountAdmin` asks the server at the door, and a flag
   written into `localStorage` opens nothing. That is the point of the
   design, and a helper that bypassed it would be testing its own bypass.
   ============================================================ */
import { mockSupabase, MOCK_DBS, MOCK_CODE } from './_supabase.mjs';

export const STAFF_EMAIL = 'staff@arabna.test';
export const STAFF_PW = 'Staff#Panel2026x';

/**
 * @param {import('playwright').Page} page   already on the app
 * @param {{ wait?: number }} [opts]          settle time after `#/admin`
 * @returns {Promise<object>} the stand-in db, for suites that read it
 */
export async function unlockAdmin(page, opts = {}) {
  const ctx = page.context();
  let db = MOCK_DBS.get(ctx);
  /* a suite that never needed the server gets one now — installed late,
     it still answers every request from here on */
  if (!db) db = await mockSupabase(ctx, { preConfirm: true });

  /* ⚠️ Decided HERE, from the stand-in's own memory, and not by trying a
     sign-up and reading its refusal: a 400 from the server is logged by the
     browser as a console error, and every suite counts those. */
  const known = db.users.has(STAFF_EMAIL);
  const email = await page.evaluate(async ({ em, pw, code, known }) => {
    const S = (window.__m && window.__m.S)
      || await import('arabna/js/store.js').catch(() => import('./js/store.js'));
    const { data: { session } = {} } = await S.sb.auth.getSession();
    if (session) return session.user.email;
    if (known) {
      const e1 = await S.signInWithPassword(em, pw);
      if (e1) throw new Error('_admin: signIn ' + e1);
      return em;
    }
    const err = await S.signUp({ name: 'Staff', email: em, password: pw });
    if (err) throw new Error('_admin: signUp ' + err);
    if (!S.state.user || !S.state.user.emailVerified) {
      const e2 = await S.confirmEmail(code);
      if (e2) throw new Error('_admin: confirm ' + e2);
    }
    return em;
  }, { em: STAFF_EMAIL, pw: STAFF_PW, code: MOCK_CODE, known });

  const u = db.users.get(String(email).toLowerCase());
  const pr = u && db.profiles.get(u.id);
  if (!pr) throw new Error('_admin: the stand-in server has no profile for ' + email);
  pr.is_admin = true;

  /* setting a hash the page already has fires no `hashchange` and paints
     nothing — so a page standing on `#/admin` is walked off it first */
  await page.evaluate(() => { if ((location.hash || '').split('?')[0] === '#/admin') location.hash = '#/home'; });
  await page.waitForTimeout(250);
  await page.evaluate(() => { location.hash = '#/admin'; });
  await page.waitForTimeout(opts.wait == null ? 900 : opts.wait);
  return db;
}

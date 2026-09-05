/* V.06.8 — the pending number, and the copy of your own data.

   ⚠️ THE TYPO LOCKED ITSELF IN, and that is what makes item 8 narrow and
   therefore worse. Saving a new number wrote it straight onto the account
   and cleared `phoneVerified`, dropping the account out of tier 2 — and
   `#/auth/phone` then checked the typed number against the one ON FILE. So
   somebody who saved a typo COULD NOT VERIFY THEIR REAL NUMBER: to get
   back in they had to retype the mistake.

   The owner's decision: the number is parked exactly as the address is. The same
   argument the email block already carries — a typo costs posting,
   contacting a seller, claiming a business and buying any advertisement,
   because every one of those is gated on tier 2.

   ⚠️ AND `exportBackup()` IS NOT A PERSON'S COPY OF THEIR DATA. It dumps
   the whole state, and the whole state carries the admin panel's password
   hash and salt and its action log. The privacy page promises the reader a
   copy in so many words, and there was no button for it anywhere.

   ⚠️ AND «EMPTY» WAS THE ONE REFUSAL THAT TOOK A TOAST. Every other
   refusal on these screens puts a red line under its own field and leaves
   it there; empty took a message that names no field and is gone in under
   three seconds. The difference was never importance — it was place. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { mockSupabase } from './_supabase.mjs';
import { phoneAuthOn } from './_phoneauth.mjs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); }
  else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const PW = 'Zaytoun#4417q';
const MAIL = 'ahmad@example.com';
const OLD = '7135550123', NEW = '7135559999';
const browser = await chromium.launch();
const errors = [];
const wire = p => {
  p.on('pageerror', e => errors.push('PAGEERROR ' + e.message.slice(0, 120)));
  p.on('console', m => { if (m.type() === 'error' &&
    !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|ERR_NAME|ERR_FAILED|fonts\.googleapis/.test(m.text()))
    errors.push(m.text().slice(0, 120)); });
};
const fresh = async (verified = true) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  /* 610: the account lives on a server now — the endpoint is answered by
     a stand-in rather than the app's own rule being softened. */
  await mockSupabase(ctx);
  /* ⚠️ REVERSAL (475): this whole suite is about the PARKED NUMBER on the
     phone screen — the typo that locked itself in — and 475 switched that
     screen off. The flag is flipped rather than the suite gutted: what it
     guards is the SMS road, which 475 keeps whole and reopens with one
     line. The email road 475 adds is guarded by `test_v74` instead. */
  await phoneAuthOn(ctx, BASE);
  const p = await ctx.newPage(); wire(p);
  await p.goto(BASE + '#/home', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(900);
  await p.evaluate(async ([pw, mail, old, v]) => {
    window.__S = await import('arabna/js/store.js').catch(() => import('./js/store.js'));
    localStorage.removeItem('arabna.v1');
    await window.__S.signUp({ name: 'أحمد سالم', email: mail, phone: old, password: pw });
    await window.__S.confirmEmail('123456');
    if (v) window.__S.confirmPhone(old);
  }, [PW, MAIL, OLD, verified]);
  return { ctx, p };
};
const go = async (p, h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(800); };
const user = p => p.evaluate(() => ({
  phone: window.__S.state.user.phone,
  verified: window.__S.state.user.phoneVerified,
  tier: window.__S.tier(),
  pending: window.__S.pendingPhone(),
  tail: window.__S.phoneTail(),
}));

/* ---- 1. a new number is parked, and the account does not fall ---- */
{
  const { ctx, p } = await fresh();
  const before = await user(p);
  ok('1.1 the account starts verified at tier 2', before.verified && before.tier === 2,
     JSON.stringify(before));

  await go(p, '#/profile/edit');
  await p.fill('#pPhone', NEW);
  await p.click('#pSave'); await p.waitForTimeout(900);
  const after = await user(p);
  ok('1.2 the new number is parked, not written', after.pending === NEW, String(after.pending));
  /* ⚠️ THE WHOLE POINT: a typo must not cost tier 2 */
  ok('1.3 …the old number still stands', after.phone === OLD, after.phone);
  ok('1.4 …still verified, still tier 2', after.verified && after.tier === 2,
     after.verified + ' / ' + after.tier);
  ok('1.5 …and the code screen is where it goes next', await p.evaluate(() => location.hash) === '#/auth/phone',
     await p.evaluate(() => location.hash));
  /* ⚠️ the tail names the number being ASKED for, not the one on file —
     without this the message contradicts the screen it sits on */
  ok('1.6 the mismatch message would name the NEW tail', after.tail === '999', after.tail);
  await ctx.close();
}

/* ---- 2. …and the real new number can actually be verified ---- */
{
  const { ctx, p } = await fresh();
  await go(p, '#/profile/edit');
  await p.fill('#pPhone', NEW);
  await p.click('#pSave'); await p.waitForTimeout(900);
  await p.fill('#phIn', NEW);
  await p.click('#sendBtn'); await p.waitForTimeout(1500);
  const msg = await p.evaluate(() => ((document.querySelector('#phMsg') || {}).innerText || '').trim());
  /* ⚠️ BEFORE THIS BATCH THE SCREEN REFUSED IT: it compared against the
     number on file, so the only number it accepted was the typo. */
  ok('2.1 typing the new number is accepted, not called a mismatch',
     !/غير مطابق|does not match/.test(msg), msg.slice(0, 60) || '(no message)');
  await ctx.close();
}

/* ---- 3. the code promotes it, and only the code ---- */
{
  const { ctx, p } = await fresh();
  await p.evaluate(n => window.__S.updateProfile({ name: 'أحمد سالم', email: 'ahmad@example.com', phone: n }), NEW);
  const parked = await user(p);
  ok('3.1 parked and waiting', parked.pending === NEW && parked.phone === OLD);
  await p.evaluate(n => window.__S.confirmPhone(n), NEW);
  const done = await user(p);
  ok('3.2 the code promotes the number', done.phone === NEW, done.phone);
  ok('3.3 …marks it verified', done.verified === true);
  ok('3.4 …and clears what was waiting', done.pending === null, String(done.pending));
  await ctx.close();
}

/* ---- 4. undoing it cancels it, and emptying is a removal ---- */
{
  const { ctx, p } = await fresh();
  const r = await p.evaluate(([mail, o, n]) => {
    const S = window.__S;
    S.updateProfile({ name: 'أحمد سالم', email: mail, phone: n });
    const parked = S.pendingPhone();
    S.updateProfile({ name: 'أحمد سالم', email: mail, phone: o });
    const undone = S.pendingPhone();
    S.updateProfile({ name: 'أحمد سالم', email: mail, phone: '' });
    return { parked, undone, phone: S.state.user.phone,
             verified: S.state.user.phoneVerified, pending: S.pendingPhone() };
  }, [MAIL, OLD, NEW]);
  ok('4.1 putting the old number back cancels the change', r.parked === NEW && !r.undone,
     r.parked + ' -> ' + JSON.stringify(r.undone));
  /* ⚠️ Emptying the field is a REMOVAL, not a change waiting on a code:
     there is nothing to verify, so dropping the mark is right. */
  ok('4.2 emptying the field removes the number outright', r.phone === '', JSON.stringify(r.phone));
  ok('4.3 …and takes its verification with it, with nothing left waiting',
     r.verified === false && !r.pending, r.verified + ' / ' + JSON.stringify(r.pending));
  await ctx.close();
}

/* ---- 5. the reader's copy of their own data ---- */
{
  const { ctx, p } = await fresh();
  await go(p, '#/settings');
  ok('5.1 there is a button for it at all',
     await p.evaluate(() => !!document.querySelector('#dlData')));
  const f = await p.evaluate(() => {
    const raw = window.__S.exportMyData();
    return { raw, d: JSON.parse(raw) };
  });
  ok('5.2 it carries the account’s own things', f.d.profile && f.d.profile.email === MAIL,
     f.d.profile && f.d.profile.email);
  /* ⚠️ A PERSON'S COPY IS NOT THE OPERATOR'S BACKUP. `exportBackup()`
     dumps the whole state, and that carries the panel's password hash. */
  ok('5.3 …and no trace of any password', !/pwHash|pwSalt/.test(f.raw));
  ok('5.4 …and nothing of the admin panel’s', !/adminAuth|adminLog/.test(f.raw));
  /* the last moment the data exists */
  await p.evaluate(() => document.querySelector('#delAcc').click());
  await p.waitForTimeout(600);
  ok('5.5 the delete sheet offers the copy first', await p.evaluate(() => {
    const s = document.querySelector('.sheet-panel');
    const dl = s && s.querySelector('#delDl'), del = s && s.querySelector('#delGo');
    return !!dl && !!del && !!(dl.compareDocumentPosition(del) & Node.DOCUMENT_POSITION_FOLLOWING);
  }));
  await ctx.close();
}

/* ---- 6. a place held, never half a feature invented ---- */
{
  const { ctx, p } = await fresh();
  await go(p, '#/settings');
  const held = await p.evaluate(() => {
    const r = [...document.querySelectorAll('#app .setting-row')]
      .find(x => /كلّ الأجهزة|all devices/.test(x.innerText));
    if (!r) return null;
    const b = r.querySelector('.mini-btn');
    return { tag: b.tagName, href: b.getAttribute('href'), text: r.innerText };
  });
  ok('6.1 the row is there', !!held);
  /* ⚠️ A <span>, never a disabled <a>: an anchor with no href stays in the
     tab order and a screen reader still announces it as a link. */
  ok('6.2 …and it is not a link that cannot go anywhere',
     held && held.tag === 'SPAN' && !held.href, held && held.tag);
  /* ⚠️ READ, not hovered — `title` never appears on a phone (V.05.8). */
  ok('6.3 …and the reason is readable beside it, not in a tooltip',
     held && /السيرفر|server/.test(held.text), held && held.text.replace(/\n/g, ' · '));
  await ctx.close();
}

/* ---- 7. «empty» gets a line under its field, like every other refusal ---- */
{
  const { ctx, p } = await fresh();
  await go(p, '#/auth/phone');
  await p.fill('#phIn', '');
  await p.click('#sendBtn'); await p.waitForTimeout(600);
  const r = await p.evaluate(() => ({
    under: ((document.querySelector('#phMsg') || {}).innerText || '').trim(),
    toast: !!document.querySelector('.toast'),
  }));
  ok('7.1 an empty number is refused under its own field', r.under.length > 0, r.under);
  ok('7.2 …and not by a toast that names no field', !r.toast);
  await ctx.close();
}

/* ---- 8. and the two ticks at sign-up, which is all that was left of the age item ---- */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  /* 610: the account lives on a server now — the endpoint is answered by
     a stand-in rather than the app's own rule being softened. */
  await mockSupabase(ctx);
  const p = await ctx.newPage(); wire(p);
  await p.goto(BASE + '#/auth/signup', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(900);
  /* ⚠️ The age box itself was ALREADY there and already mandatory — that
     is why item 7 of the file writes no line. What was missing is that its
     refusal could not be seen. */
  ok('8.1 the age confirmation is on the sign-up screen',
     await p.evaluate(() => !!document.querySelector('#agree2')));
  await p.fill('#sFirst', 'أحمد'); await p.fill('#sLast', 'سالم');
  await p.fill('#sEmail', MAIL); await p.fill('#sPhone', OLD);
  await p.fill('#sPass', PW).catch(() => {});
  await p.fill('#sPass2', PW).catch(() => {});
  await p.click('#suBtn'); await p.waitForTimeout(700);
  const r = await p.evaluate(() => ({
    under: ((document.querySelector('#e_agree') || {}).textContent || '').trim(),
    toast: !!document.querySelector('.toast'),
    signed: !!window.__SIGNED,
  }));
  ok('8.2 leaving them unticked says so under the boxes', r.under.length > 0, r.under);
  ok('8.3 …rather than in a toast', !r.toast);
  await ctx.close();
}

ok('9.1 no console errors anywhere in the batch', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);

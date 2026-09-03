/* V.06.6 — the account section, and a sign-out that cleared nothing.

   THE ONE THAT MATTERS, and it is `225` coming back through a second door.

     export const state = Object.assign({}, DEFAULTS, load() || {});

   `Object.assign` copies REFERENCES. So on a device with nothing saved
   yet — the FIRST session of every new user — `state.saved` IS
   `DEFAULTS.saved`, and the first `push` writes into the defaults
   themselves. `signOut` then does exactly the right thing:

     const fresh = JSON.parse(JSON.stringify(DEFAULTS));

   a deep copy of defaults that are no longer default. Measured in the
   browser with no reload at all: saved 2 -> 2, reviews 1 -> 1,
   messages 1 -> 1, readNotifs 1 -> 1, and all of it still on disk — while
   `tier()` reads 0, so the app LOOKS signed out. The next visitor on that
   phone opens «المفضّلة» and finds two shops.

   ⚠️ AND IT DISAPPEARS AFTER ONE RELOAD, because `load()` returns fresh
   objects from `JSON.parse`. That is why no suite ever saw it: every suite
   seeds localStorage and reloads, which is the one path that hides it. So
   this file drives the app through its OWN functions in a single session,
   and never seeds a signed-in state.

   ⚠️ And the keys that survived were not random — what is edited in place
   survived and what is reassigned was cleared, so signing out looked like
   it half-worked rather than like a bug. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); }
  else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const PW = 'Zaytoun#4417q';
const browser = await chromium.launch();
const errors = [];
const wire = p => {
  p.on('pageerror', e => errors.push('PAGEERROR ' + e.message.slice(0, 120)));
  p.on('console', m => { if (m.type() === 'error' &&
    !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|ERR_NAME|ERR_FAILED|fonts\.googleapis/.test(m.text()))
    errors.push(m.text().slice(0, 120)); });
};
/* ⚠️ NO addInitScript and NO reload — a seeded, reloaded state is exactly
   what hides block 1. The account is made through `signUp` itself. */
const fresh = async (hash = '#/home') => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage(); wire(p);
  await p.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(900);
  await p.evaluate(async () => {
    window.__S = await import('arabna/js/store.js').catch(() => import('./js/store.js'));
    localStorage.removeItem('arabna.v1');
  });
  return { ctx, p };
};
const signUp = p => p.evaluate(pw => {
  window.__S.signUp({ name: 'أحمد سالم', email: 'a@b.c', phone: '7135550123', password: pw });
  window.__S.confirmEmail('123456');
}, PW);
const go = async (p, h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(750); };

/* ---- 1. signing out, in the FIRST session ---- */
{
  const { ctx, p } = await fresh();
  await signUp(p);
  const r = await p.evaluate(() => {
    const S = window.__S;
    S.toggleSaved('b1'); S.toggleSaved('b2');
    S.state.reviews.push({ id: 'r1', bizId: 'b1', rating: 5, text: 'x', user: 'أحمد' });
    S.state.messages.push({ id: 'm1', with: 'x', items: [] });
    S.state.readNotifs.push('n1');
    const before = { saved: S.state.saved.length, reviews: S.state.reviews.length,
                     messages: S.state.messages.length, readNotifs: S.state.readNotifs.length };
    S.signOut();
    const after = { saved: S.state.saved.length, reviews: S.state.reviews.length,
                    messages: S.state.messages.length, readNotifs: S.state.readNotifs.length };
    const disk = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
    return { before, after, diskSaved: (disk.saved || []).length, logged: S.isLoggedIn() };
  });
  ok('1.1 the first session really had things in it', r.before.saved === 2 && r.before.reviews === 1,
     JSON.stringify(r.before));
  ok('1.2 signing out clears what is edited in place', r.after.saved === 0 && r.after.reviews === 0,
     JSON.stringify(r.after));
  ok('1.3 …messages and read notifications with it',
     r.after.messages === 0 && r.after.readNotifs === 0, JSON.stringify(r.after));
  ok('1.4 …and the disk agrees with memory', r.diskSaved === 0, String(r.diskSaved));
  ok('1.5 …and nobody is signed in', r.logged === false);

  /* the poisoning itself, not its effect: DEFAULTS must survive a write */
  const poison = await p.evaluate(() => {
    window.__S.state.saved.push('POISON');
    window.__S.signOut();
    return JSON.stringify(window.__S.state.saved);
  });
  ok('1.6 writing to state never reaches DEFAULTS', poison === '[]', poison);
  await ctx.close();
}

/* ---- 2. the hub's rows were a staircase ---- */
{
  const { ctx, p } = await fresh();
  await signUp(p);
  await go(p, '#/profile');
  const w = await p.evaluate(() =>
    [...document.querySelectorAll('#app button.list-row')].map(e => Math.round(e.getBoundingClientRect().width)));
  /* ⚠️ A flex BUTTON sizes to its content, and `.list-row` is a <div>
     everywhere else — six rows came out at six widths inside a 390 parent. */
  ok('2.1 the account rows are all one width', w.length > 1 && new Set(w).size === 1, w.join(' · '));
  ok('2.2 …and it is the parent’s width, not the word’s', w[0] > 300, String(w[0]));
  await ctx.close();
}

/* ---- 3. deleting an account cleared LESS than signing out ---- */
{
  const { ctx, p } = await fresh();
  await signUp(p);
  const r = await p.evaluate(() => {
    const S = window.__S;
    S.state.cardOnFile = 'VISA •••• 4242';
    S.state.hiddenListings = ['c1'];
    S.state.readNotifs = ['n1'];
    S.state.pendingVerify = { email: 'x' };
    S.state.receipts = [{ id: 'ARB-1', amount: 29, buyer: { name: 'أحمد', email: 'a@b.c' } }];
    S.deleteAccount();
    return { card: S.state.cardOnFile, hidden: (S.state.hiddenListings || []).length,
             read: (S.state.readNotifs || []).length, pending: S.state.pendingVerify,
             user: S.state.user, receipts: (S.state.receipts || []).length,
             buyer: S.state.receipts[0].buyer.name, anon: !!S.state.receipts[0].anonymized };
  });
  ok('3.1 the card on file goes', r.card === null || r.card === undefined, String(r.card));
  ok('3.2 …and the hidden listings, the read marks and the pending verify',
     r.hidden === 0 && r.read === 0 && !r.pending, JSON.stringify([r.hidden, r.read, r.pending]));
  ok('3.3 …and the account itself', r.user === null);
  /* ⚠️ ORDER: receipts are in the keep-list, so the reset leaves them and
     the identity is stripped AFTER it. Reversed, the names come back. */
  ok('3.4 the money record survives the person', r.receipts === 1, String(r.receipts));
  ok('3.5 …stripped of who paid', r.buyer === '' && r.anon, r.buyer + ' / ' + r.anon);
  await ctx.close();
}

/* ---- 4. a pending email change can be undone ---- */
{
  const { ctx, p } = await fresh();
  await signUp(p);
  const r = await p.evaluate(() => {
    const S = window.__S;
    S.updateProfile({ name: 'أحمد سالم', email: 'typo@b.c', phone: '7135550123' });
    const parked = S.pendingEmail();
    S.updateProfile({ name: 'أحمد سالم', email: 'a@b.c', phone: '7135550123' });
    return { parked, after: S.pendingEmail(), email: S.state.user.email };
  });
  ok('4.1 a new address is parked, not written', r.parked === 'typo@b.c' && r.email === 'a@b.c',
     r.parked + ' / ' + r.email);
  /* ⚠️ Retyping the real address left the wrong one pending, and a later
     visit to the code screen would have moved the account ONTO it. */
  ok('4.2 …and putting the old one back cancels it', !r.after, JSON.stringify(r.after));
  await ctx.close();
}

/* ---- 5. the edit screen refuses what sign-up refuses ---- */
{
  const { ctx, p } = await fresh();
  await signUp(p);
  await go(p, '#/profile/edit');
  await p.fill('#pName', '123');
  await p.fill('#pEmail', 'not-an-email');
  await p.click('#pSave'); await p.waitForTimeout(600);
  const r = await p.evaluate(() => ({
    nameErr: (document.querySelector('#e_pName') || {}).textContent || '',
    mailErr: (document.querySelector('#e_pEmail') || {}).textContent || '',
    hash: location.hash,
    saved: window.__S.state.user.email,
  }));
  ok('5.1 a name of digits is refused, under its own field', r.nameErr.length > 0, r.nameErr);
  ok('5.2 …and so is an address that is not one', r.mailErr.length > 0, r.mailErr);
  ok('5.3 …nothing is saved and the screen does not move on',
     r.saved === 'a@b.c' && /profile\/edit/.test(r.hash), r.saved + ' / ' + r.hash);
  await ctx.close();
}

/* ---- 6. the subscription row goes where the subscription is ---- */
{
  const { ctx, p } = await fresh();
  await signUp(p);
  await go(p, '#/profile');
  /* CHANGED in V.06.7: this read the LAST hub row, and V.06.7 reordered
     the hub — three duplicated rows left it and three doors joined it — so
     the last row is «المحظورون» now. The row is found by its ROUTE, which
     is what the check was ever about; reading a position was fragile the
     day it was written and this batch is what exposed it. */
  const subRow = p => p.evaluate(() =>
    [...document.querySelectorAll('#app button.list-row')]
      .map(e => e.dataset.route)
      .find(r => r === '#/subscribe' || r === '#/my-subscription'));
  const before = await subRow(p);
  ok('6.1 with no subscription it offers the sales page', before === '#/subscribe', String(before));
  /* ⚠️ ownership first — `startSubscription` refuses a business this
     account does not own, which is the V.03.3 rule and stays. */
  await p.evaluate(() => {
    window.__S.state.myBusinessIds = ['b1']; window.__S.save();
    window.__S.startSubscription({ businessId: 'b1', plan: 'monthly' });
  });
  await go(p, '#/home'); await go(p, '#/profile');
  const after = await subRow(p);
  ok('6.2 …and with one it goes straight to it', after === '#/my-subscription', String(after));
  ok('6.3 …one definition, read by both screens',
     await p.evaluate(() => window.__S.subscriptionRoute() === '#/my-subscription'));
  await ctx.close();
}

/* ---- 7. an empty name no longer takes the screen down ---- */
{
  const { ctx, p } = await fresh();
  await signUp(p);
  await p.evaluate(() => { window.__S.state.user.name = ''; window.__S.state.user.avatar = null; window.__S.save(); });
  await go(p, '#/profile');
  const r = await p.evaluate(() => ({
    drew: ((document.querySelector('#app') || {}).innerText || '').length > 40,
    initial: (document.querySelector('#app .avatar') || {}).textContent || '',
  }));
  ok('7.1 the screen still renders', r.drew);
  ok('7.2 …with a placeholder rather than a crash', r.initial.trim() === '?', r.initial);
  await ctx.close();
}

/* ---- 8. the phone is shown the way every other number is ---- */
{
  const { ctx, p } = await fresh();
  await signUp(p);
  await go(p, '#/profile');
  const shown = await p.evaluate(() =>
    [...document.querySelectorAll('#app .i-txt b')].map(e => e.textContent.trim()));
  ok('8.1 the account’s number is formatted for reading',
     shown.some(x => x === '(713) 555-0123'), shown.join(' | '));
  /* ⚠️ display only — what is stored never changes, or `samePhone` and
     `phoneTail` would be comparing something else. */
  ok('8.2 …and what is stored is untouched',
     await p.evaluate(() => window.__S.state.user.phone === '7135550123'));
  await ctx.close();
}

/* ---- 9. the phone hint is a rule, not an event that did not happen ---- */
{
  const { ctx, p } = await fresh();
  await signUp(p);
  await go(p, '#/profile/edit');
  const hint = await p.evaluate(() => {
    const i = document.querySelector('#pPhone');
    return i && i.parentElement ? i.parentElement.innerText : '';
  });
  ok('9.1 opening the screen does not claim the number was changed',
     !/غيّرت رقمك|You changed your number/.test(hint), hint.slice(0, 70).replace(/\n/g, ' '));
  await ctx.close();
}

/* ---- 10. the card can be taken off again ---- */
{
  const { ctx, p } = await fresh();
  await signUp(p);
  await go(p, '#/settings');
  ok('10.1 with no card the box offers to add one',
     await p.evaluate(() => !!document.querySelector('#addCard') && !document.querySelector('#delCard')));
  await p.evaluate(() => document.querySelector('#addCard').click());
  await p.waitForTimeout(700);
  ok('10.2 …and once there is one, the same box removes it',
     await p.evaluate(() => !!document.querySelector('#delCard') && !document.querySelector('#addCard')));
  await p.evaluate(() => document.querySelector('#delCard').click());
  await p.waitForTimeout(500);
  await p.evaluate(() => { const y = document.querySelector('#cfmYes'); if (y) y.click(); });
  await p.waitForTimeout(700);
  ok('10.3 …and it is really gone', await p.evaluate(() => !window.__S.state.cardOnFile));
  await ctx.close();
}

/* ---- 11. «حذف الحساب» no longer promises a review that never happens ---- */
{
  const { ctx, p } = await fresh();
  await signUp(p);
  await go(p, '#/settings');
  const txt = await p.evaluate(() => (document.querySelector('#app') || {}).innerText || '');
  ok('11.1 the text does not promise an approval step',
     !/بعد الموافقة|after review/.test(txt));
  await ctx.close();
}

ok('12.1 no console errors anywhere in the batch', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);

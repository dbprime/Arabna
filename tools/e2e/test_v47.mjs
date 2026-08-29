/* V.06.7 — the account hub says what it holds.

   Six frozen names, and every number that would make them useful already
   sitting in `js/store.js` unread. So this batch connects what was built
   rather than building much.

   ⚠️ THE HOLE IS «طلباتي». Somebody who pressed «هذا نشاطي» raised a
   record into the admin queue and then SAW NOTHING — no row, no status,
   not even an acknowledgement that it was sent. Measured before the
   batch: `state.claims` and `approvedClaims()` appear in `js/screens/`
   exactly ZERO times. The data was kept and no screen ever read it.

   ⚠️ AND ZERO IS NEVER PRINTED. «0 رسالة» is noise in a row this narrow
   and its absence is the signal — the rule that took the buyers' button
   off a listing with no messages.

   ⚠️ AND THE MESSAGES ROW COUNTS CONVERSATIONS, NOT «UNREAD». A message
   record carries no read state at all — measured, there is no such field
   — and a count the app does not have is a number invented on a screen. */
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
const fresh = async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage(); wire(p);
  await p.goto(BASE + '#/home', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(900);
  await p.evaluate(async () => {
    window.__S = await import('arabna/js/store.js').catch(() => import('./js/store.js'));
    localStorage.removeItem('arabna.v1');
  });
  await p.evaluate(pw => {
    window.__S.signUp({ name: 'رامي البي', email: 'a@b.c', phone: '7135550123', password: pw });
    window.__S.confirmEmail('123456');
  }, PW);
  return { ctx, p };
};
const go = async (p, h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(800); };
const rows = p => p.evaluate(() =>
  [...document.querySelectorAll('#app button.list-row')].map(e => ({
    route: e.dataset.route,
    title: (e.querySelector('.row-title') || {}).textContent || '',
    sub: (e.querySelector('.row-sub') || {}).textContent || '',
  })));

/* ---- 1. the hub, on a brand-new account ---- */
{
  const { ctx, p } = await fresh();
  await go(p, '#/profile');
  const r = await rows(p);
  ok('1.1 the hub is the seven rows of ACCOUNT_LINKS', r.length === 7, String(r.length));
  ok('1.2 …and every one of them is one width', await p.evaluate(() =>
    new Set([...document.querySelectorAll('#app button.list-row')]
      .map(e => Math.round(e.getBoundingClientRect().width))).size === 1));
  /* ⚠️ THE THREE THAT LEFT are the three counters at the top of the very
     same screen — the reader met them twice, ten lines apart. */
  const routes = r.map(x => x.route);
  ok('1.3 «إعلاناتي» is not repeated as a row', !routes.includes('#/my-ads'), routes.join(' '));
  ok('1.4 …nor «المفضّلة»', !routes.includes('#/saved'));
  ok('1.5 …nor «تقييماتي»', !routes.includes('#/my-reviews'));
  ok('1.6 …and the counters that carry the numbers stay',
     await p.evaluate(() => document.querySelectorAll('#app .stat').length) === 3);
  /* the three doors that were only reachable from elsewhere */
  ok('1.7 notifications, receipts and blocked are reachable from here',
     ['#/notifications', '#/receipts', '#/blocked'].every(x => routes.includes(x)), routes.join(' '));
  /* ⚠️ zero prints nothing */
  const receipts = r.find(x => x.route === '#/receipts');
  ok('1.8 a row with nothing behind it says nothing', receipts && receipts.sub === '',
     JSON.stringify(receipts));
  await ctx.close();
}

/* ---- 2. …and with something behind each row ---- */
{
  const { ctx, p } = await fresh();
  await p.evaluate(() => {
    const S = window.__S;
    S.state.user.phoneVerified = true;
    S.state.myBusinessIds = ['b1'];
    S.startSubscription({ businessId: 'b1', plan: 'monthly' });
    S.state.messages.push({ id: 'm1', listingId: 'c1', from: 'x', text: 'hi' });
    S.state.messages.push({ id: 'm2', listingId: 'c2', from: 'x', text: 'hi' });
    S.requestClaim('b3', { name: 'رامي', role: 'owner', phone: '7135550123', proof: 'x' });
    S.state.blocked = ['u1'];
    S.save();
  });
  await go(p, '#/home'); await go(p, '#/profile');
  const r = await rows(p);
  const by = k => (r.find(x => x.route === k) || { sub: '' }).sub;
  ok('2.1 the business row names the business', by('#/my-business').length > 0, by('#/my-business'));
  ok('2.2 …and says it is subscribed', /مشترك|Subscribed/.test(by('#/my-business')), by('#/my-business'));
  /* ⚠️ two conversations is the DUAL in Arabic, which `arCount` carries */
  ok('2.3 the messages row counts conversations', by('#/messages').length > 0, by('#/messages'));
  ok('2.4 the requests row counts what is waiting', /1/.test(by('#/my-requests')), by('#/my-requests'));
  ok('2.5 the subscription row says when it renews',
     by('#/my-subscription').length > 0, by('#/my-subscription'));
  ok('2.6 …and the row goes to the subscription, not the sales page',
     r.some(x => x.route === '#/my-subscription'), r.map(x => x.route).join(' '));
  ok('2.7 the blocked row carries its count', by('#/blocked') === '1', by('#/blocked'));
  await ctx.close();
}

/* ---- 3. «كمّل حسابك» — three steps, and each disappears when done ---- */
{
  const { ctx, p } = await fresh();
  await go(p, '#/profile');
  const steps = p => p.evaluate(() =>
    [...document.querySelectorAll('#app .list-note')].map(e => e.innerText.split('\n')[0].trim()));
  const first = await steps(p);
  ok('3.1 a new account is offered all three steps', first.length === 3, first.join(' · '));
  /* ⚠️ THE VERIFIED NUMBER IS THE GATE ON EVERYTHING THAT EARNS — posting,
     contacting a seller, claiming a business, buying an advertisement. */
  ok('3.2 …the number among them', first.some(x => /رقم|number/i.test(x)), first.join(' · '));

  await p.evaluate(() => { window.__S.state.user.phoneVerified = true; window.__S.save(); });
  await go(p, '#/home'); await go(p, '#/profile');
  const second = await steps(p);
  ok('3.3 a finished step disappears rather than standing struck through',
     second.length === 2 && !second.some(x => /رقم|number/i.test(x)), second.join(' · '));

  await p.evaluate(() => {
    window.__S.setAvatarPreset('p01');
    window.__S.state.myBusinessIds = ['b1'];
    window.__S.save();
  });
  await go(p, '#/home'); await go(p, '#/profile');
  const third = await steps(p);
  ok('3.4 …and the whole block goes with the last of them', third.length === 0, third.join(' · '));
  await ctx.close();
}

/* ---- 4. «طلباتي» — the queue that no screen read ---- */
{
  const { ctx, p } = await fresh();
  await go(p, '#/my-requests');
  ok('4.1 with nothing sent it is a designed empty state, not a blank',
     await p.evaluate(() => ((document.querySelector('#app') || {}).innerText || '').trim().length > 20));

  await p.evaluate(() => window.__S.requestClaim('b3',
    { name: 'رامي', role: 'owner', phone: '7135550123', proof: 'x' }));
  await go(p, '#/home'); await go(p, '#/my-requests');
  const pend = await p.evaluate(() => (document.querySelector('#app') || {}).innerText || '');
  ok('4.2 a sent request is visible at once, with its status',
     /بانتظار|waiting|pending/i.test(pend), pend.replace(/\n/g, ' | ').slice(0, 80));
  ok('4.3 …and it names the business it is about',
     pend.length > 20 && !/undefined/.test(pend));

  /* ⚠️ THE ADMIN'S WRITTEN REASON REACHES THE READER VERBATIM. It is 307
     that made a refusal ask for a reason at all; before it this screen
     would have shown empty ones. */
  await p.evaluate(() => {
    const c = window.__S.state.claims[0];
    c.status = 'rejected'; c.reason = 'الإثبات غير واضح';
    window.__S.save();
  });
  await go(p, '#/home'); await go(p, '#/my-requests');
  const rej = await p.evaluate(() => (document.querySelector('#app') || {}).innerText || '');
  ok('4.4 a refusal carries the admin’s own sentence', rej.includes('الإثبات غير واضح'),
     rej.replace(/\n/g, ' | ').slice(0, 100));

  await p.evaluate(() => {
    const c = window.__S.state.claims[0];
    c.status = 'approved'; window.__S.save();
  });
  await go(p, '#/home'); await go(p, '#/my-requests');
  ok('4.5 an approved request opens the page it won', await p.evaluate(() =>
    [...document.querySelectorAll('#app .list-row')].some(e => /^#\/directory\//.test(e.dataset.route || ''))));
  await ctx.close();
}

/* ---- 5. the badge request is read in the same place ---- */
{
  const { ctx, p } = await fresh();
  await p.evaluate(() => {
    window.__S.state.user.badge = { status: 'pending', when: Date.now() };
    window.__S.save();
  });
  await go(p, '#/my-requests');
  ok('5.1 a badge request appears beside the ownership ones',
     await p.evaluate(() => /توثيق|badge/i.test((document.querySelector('#app') || {}).innerText || '')));
  await go(p, '#/profile');
  const r = await rows(p);
  ok('5.2 …and it counts towards what is waiting',
     /1/.test((r.find(x => x.route === '#/my-requests') || { sub: '' }).sub));
  await ctx.close();
}

ok('6.1 no console errors anywhere in the batch', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);

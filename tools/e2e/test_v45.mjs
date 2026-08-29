/* V.06.4 — what survives `esc()` executes, and a refusal with no reason.

   THE HOLE, MEASURED BEFORE ANYTHING WAS CHANGED, and it needed no admin
   panel at all: an ordinary member, no staff access, saves a marketplace
   listing whose title SOMEBODY ELSE wrote, and opens «المفضّلة».

     index.html              the node entered the page · the code did NOT run
     index-single-file.html  the node entered the page · window.__pwn === 1

   The single-file build is the one that decides, and this is written into
   `CLAUDE.md` already: it runs under `script-src 'self' 'unsafe-inline'
   data: blob:` — the condition of that build existing, not a choice — so
   there is NO second layer in it. Whatever escapes `esc()` executes.

   ⚠️ And the line seventy rows above it in the same file writes
   `esc(L(c.title))` correctly. The rule was applied on one screen and
   forgotten on its neighbour, which is exactly why the previous pass
   fixing «the four reported places» was not enough.

   The other half of the batch is the panel refusing things in silence: an
   ad order worth $149 refused with `''` written into the code, a report
   taking a listing down with no reason argument at all, two merges that
   move reviews, favourites and ownership and then DELETE a record with no
   undo and no question, and an event deleted on the first tap. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); }
  else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const NOW = Date.now();
const PAY = '<img src=x onerror="window.__pwn=1">';
const ACCOUNT = {
  name: 'رامي البي', email: 'a@b.c', emailVerified: true,
  phone: '7134669182', phoneVerified: true, joined: NOW - 9e8,
};
const ADMIN_PW = 'Zaytoun#4417q';

const browser = await chromium.launch();
const errors = [];
const wire = p => {
  p.on('pageerror', e => errors.push('PAGEERROR ' + e.message.slice(0, 120)));
  p.on('console', m => { if (m.type() === 'error' &&
    !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|ERR_NAME|ERR_FAILED|fonts\.googleapis/.test(m.text()))
    errors.push(m.text().slice(0, 120)); });
};
/* the importmap rule: `arabna/…` reaches the app's OWN instance. */
const mount = p => p.evaluate(async () => {
  window.__S = await import('arabna/js/store.js').catch(() => import('./js/store.js'));
});
const open = async (state, hash = '#/home') => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(s => localStorage.setItem('arabna.v1', JSON.stringify(s)), state);
  const p = await ctx.newPage(); wire(p);
  await p.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(900); await mount(p);
  return { ctx, p };
};
const go = async (p, h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(800); };
/* did the payload BECOME the page, or is it a word on it? */
const pwned = p => p.evaluate(() => ({
  ran: window.__pwn === 1,
  node: !!document.querySelector('#app img[src="x"]'),
  text: (document.querySelector('#app') || { innerText: '' }).innerText.includes('<img src=x'),
}));

/* ---- 1. a member, no panel, no permission ---- */
{
  const { ctx, p } = await open({
    lang: 'ar', user: ACCOUNT,
    extraClassifieds: [{ id: 'cX', title: PAY, price: '100', cat: 'cars', desc: 'x',
                         status: 'live', owner: 'someone-else', created: NOW }],
    saved: ['cX'],
  }, '#/saved');
  const r = await pwned(p);
  ok('1.1 «المفضّلة»: the code does not run', !r.ran);
  ok('1.2 …and the node never becomes part of the page', !r.node);
  ok('1.3 …it is printed as text, letter for letter', r.text);
  await ctx.close();
}

/* ---- 2. the panel's own queues ---- */
{
  const { ctx, p } = await open({
    lang: 'ar', user: ACCOUNT,
    myAds: [{ id: 'aX', product: 'slider', status: 'pending', price: 149,
              bizName: PAY, tagline: PAY, days: 7, created: NOW }],
    claims: [{ id: 'clX', bizId: 'b1', name: 'x', role: 'owner',
               phone: '7134669182', proof: PAY, status: 'pending', when: NOW }],
    flags: [{ id: 'fX', kind: 'listing', refId: 'c1', risk: 'high',
              reason: PAY, item: { ar: PAY, en: PAY }, when: NOW }],
  }, '#/admin');
  await p.fill('#aUser', 'rai'); await p.fill('#aNew', ADMIN_PW);
  await p.waitForTimeout(250); await p.click('#aSet'); await p.waitForTimeout(900);
  const q = await pwned(p);
  ok('2.1 the moderation queue does not execute what it shows', !q.ran);
  ok('2.2 …and no injected node reached it', !q.node);

  await p.evaluate(() => { const x = document.querySelector('[data-t="ads"]'); if (x) x.click(); });
  await p.waitForTimeout(700);
  const a = await pwned(p);
  ok('2.3 «أعلن معنا» does not execute the buyer’s own words', !a.ran);
  ok('2.4 …and prints them instead', a.text);
  await ctx.close();
}

/* ---- 3. and the same words inside an HTML attribute ---- */
{
  const { ctx, p } = await open({
    lang: 'ar', user: ACCOUNT,
    adDraft: { product: 'slider', bizName: 'a" onmouseover="window.__pwn=1" x="', tagline: 'x' },
  }, '#/advertise');
  await p.waitForTimeout(600);
  const r = await p.evaluate(() => ({ ran: window.__pwn === 1, broke: !!document.querySelector('[onmouseover]') }));
  ok('3.1 a quote in a name does not break out of the attribute', !r.broke);
  ok('3.2 …and nothing runs', !r.ran);
  await ctx.close();
}

/* ---- 4. the panel asks, and the reason reaches its owner ---- */
{
  const { ctx, p } = await open({
    lang: 'ar', user: ACCOUNT,
    myAds: [{ id: 'aX', product: 'slider', status: 'pending', price: 149,
              bizName: 'محل', tagline: 'x', days: 7, created: NOW }],
  }, '#/admin');
  await p.fill('#aUser', 'rai'); await p.fill('#aNew', ADMIN_PW);
  await p.waitForTimeout(250); await p.click('#aSet'); await p.waitForTimeout(900);
  await p.evaluate(() => { const x = document.querySelector('[data-t="ads"]'); if (x) x.click(); });
  await p.waitForTimeout(700);

  const had = await p.evaluate(() => !!document.querySelector('[data-adno]'));
  ok('4.1 the paid order is in the queue', had);
  await p.evaluate(() => { const x = document.querySelector('[data-adno]'); if (x) x.click(); });
  await p.waitForTimeout(600);
  ok('4.2 refusing a PAID order opens a reason sheet first',
     await p.evaluate(() => !!document.querySelector('#adminWhy')));
  /* an empty reason is refused — the panel's own rule since V.02.9 */
  await p.evaluate(() => { const g = document.querySelector('#adminGo'); if (g) g.click(); });
  await p.waitForTimeout(500);
  ok('4.3 …and an empty one is refused', await p.evaluate(() =>
    !!document.querySelector('#adminWhy') && window.__S.state.myAds[0].status === 'pending'),
    await p.evaluate(() => window.__S.state.myAds[0].status));

  await p.fill('#adminWhy', 'الصورة غير واضحة');
  await p.evaluate(() => document.querySelector('#adminGo').click());
  await p.waitForTimeout(700);
  const after = await p.evaluate(() => ({
    status: window.__S.state.myAds[0].status,
    reason: window.__S.state.myAds[0].reason,
    notif: (window.__S.state.extraNotifs || []).some(n =>
      JSON.stringify(n.body || '').includes('الصورة غير واضحة')),
  }));
  ok('4.4 the order is refused', after.status === 'rejected', after.status);
  ok('4.5 …the reason is kept', after.reason === 'الصورة غير واضحة', after.reason);
  ok('4.6 …and it reaches its owner verbatim', after.notif);
  await ctx.close();
}

/* ---- 5. deleting an event asks, and names it ---- */
{
  const { ctx, p } = await open({ lang: 'ar', user: ACCOUNT }, '#/admin');
  await p.fill('#aUser', 'rai'); await p.fill('#aNew', ADMIN_PW);
  await p.waitForTimeout(250); await p.click('#aSet'); await p.waitForTimeout(900);
  await p.evaluate(() => { const x = document.querySelector('[data-t="events"]'); if (x) x.click(); });
  await p.waitForTimeout(700);
  const before = await p.evaluate(() => window.__S.allEvents().length);
  await p.evaluate(() => { const x = document.querySelector('[data-evdel]'); if (x) x.click(); });
  await p.waitForTimeout(600);
  const sheet = await p.evaluate(() => {
    const s = document.querySelector('.sheet-panel');
    return { open: !!s, text: s ? s.innerText : '' };
  });
  ok('5.1 deleting an event opens a confirmation', sheet.open);
  ok('5.2 …and it names the event rather than asking blind',
     sheet.text.length > 0 && !/\{title\}/.test(sheet.text), sheet.text.slice(0, 60).replace(/\n/g, ' '));
  ok('5.3 …and nothing is deleted while it stands open',
     await p.evaluate(() => window.__S.allEvents().length) === before);
  await ctx.close();
}

/* ---- 6. the merge, which is the one with no undo ---- */
{
  const { ctx, p } = await open({
    lang: 'ar', user: ACCOUNT,
    extraBusinesses: [
      { id: 'zA', name: { ar: 'مطعم الشام', en: 'Al Sham' }, cat: 'restaurants',
        phone: '7135550001', address: '1 Main St, Houston, TX 77001', status: 'pendingReview' },
      { id: 'zB', name: { ar: 'مطعم الشام', en: 'Al Sham' }, cat: 'restaurants',
        phone: '7135550001', address: '1 Main St, Houston, TX 77001' },
    ],
  }, '#/admin');
  await p.fill('#aUser', 'rai'); await p.fill('#aNew', ADMIN_PW);
  await p.waitForTimeout(250); await p.click('#aSet'); await p.waitForTimeout(900);
  await p.evaluate(() => { const x = document.querySelector('[data-t="dir"]'); if (x) x.click(); });
  await p.waitForTimeout(800);
  const has = await p.evaluate(() => !!document.querySelector('[data-bizmerge]'));
  if (has) {
    const n0 = await p.evaluate(() => window.__S.everyBusiness().length);
    await p.evaluate(() => document.querySelector('[data-bizmerge]').click());
    await p.waitForTimeout(600);
    ok('6.1 merging opens a confirmation first',
       await p.evaluate(() => !!document.querySelector('.sheet-panel')));
    ok('6.2 …and NOTHING is merged until it is answered',
       await p.evaluate(() => window.__S.everyBusiness().length) === n0);
    ok('6.3 …and the sheet names both sides', await p.evaluate(() => {
      const s = document.querySelector('.sheet-panel');
      return !!s && /→/.test(s.innerText);
    }));
  } else {
    ok('6.1 merging opens a confirmation first', false, 'no merge button rendered');
    ok('6.2 …and NOTHING is merged until it is answered', false, 'no merge button rendered');
    ok('6.3 …and the sheet names both sides', false, 'no merge button rendered');
  }
  await ctx.close();
}

/* ---- 7. the lock, and the password that guards itself ---- */
{
  const { ctx, p } = await open({ lang: 'ar', user: ACCOUNT }, '#/admin');
  await p.fill('#aUser', 'rai'); await p.fill('#aNew', ADMIN_PW);
  await p.waitForTimeout(250); await p.click('#aSet'); await p.waitForTimeout(900);
  await p.evaluate(() => { const x = document.querySelector('[data-t="set"]'); if (x) x.click(); });
  await p.waitForTimeout(700);
  ok('7.1 the panel has a lock button at all',
     await p.evaluate(() => !!document.querySelector('#admLock')));
  ok('7.2 changing the password asks for the current one',
     await p.evaluate(() => !!document.querySelector('#apCur')));

  await p.fill('#apCur', 'not-the-password');
  await p.fill('#apNew', 'Kanafa#7712x'); await p.fill('#apConf', 'Kanafa#7712x');
  await p.evaluate(() => document.querySelector('#apSave').click());
  await p.waitForTimeout(700);
  ok('7.3 …a wrong current password is refused, and says so',
     await p.evaluate(() => ((document.querySelector('#e_apCur') || {}).textContent || '').length > 0));
  ok('7.4 …and the password is unchanged',
     await p.evaluate(pw => window.__S.checkAdmin('rai', pw), ADMIN_PW));

  /* ⚠️ BOTH FLAGS: `unlocked` is a module variable in `admin.js` and
     `adminSession` lives in `store.js`. Clearing one leaves the other
     holding a door open. */
  await p.evaluate(() => document.querySelector('#admLock').click());
  await p.waitForTimeout(800);
  ok('7.5 the lock clears the store’s session',
     await p.evaluate(() => window.__S.adminUnlocked() === false));
  ok('7.6 …and the screen asks again',
     await p.evaluate(() => !!document.querySelector('#aUser, #aPass')));
  await ctx.close();
}

/* ---- 8. the cash form: 514 in one select is not a list ---- */
{
  const { ctx, p } = await open({ lang: 'ar', user: ACCOUNT }, '#/admin');
  await p.fill('#aUser', 'rai'); await p.fill('#aNew', ADMIN_PW);
  await p.waitForTimeout(250); await p.click('#aSet'); await p.waitForTimeout(900);
  await p.evaluate(() => { const x = document.querySelector('[data-t="ads"]'); if (x) x.click(); });
  await p.waitForTimeout(700);
  ok('8.1 the money form has a search box',
     await p.evaluate(() => !!document.querySelector('#cshQ')));
  const n0 = await p.evaluate(() => document.querySelectorAll('#cshBiz option').length);
  await p.fill('#cshQ', 'Petra'); await p.waitForTimeout(500);
  const n1 = await p.evaluate(() => document.querySelectorAll('#cshBiz option').length);
  ok('8.2 …and it narrows the list', n1 > 0 && n1 < n0, n0 + ' -> ' + n1);
  ok('8.3 …without repainting away what was already typed',
     await p.evaluate(() => document.querySelector('#cshQ').value === 'Petra'));
  await ctx.close();
}

/* ---- 9. the log answers «who did that?» for more than field edits ---- */
{
  const { ctx, p } = await open({ lang: 'ar', user: ACCOUNT }, '#/admin');
  await p.fill('#aUser', 'rai'); await p.fill('#aNew', ADMIN_PW);
  await p.waitForTimeout(250); await p.click('#aSet'); await p.waitForTimeout(900);
  const logged = await p.evaluate(() => {
    const before = window.__S.adminLog(50).length;
    window.__S.logAdminAction('b1', 'merge', 'b2', 'b1');
    const rows = window.__S.adminLog(50);
    return { grew: rows.length === before + 1, row: rows[0] };
  });
  ok('9.1 an action lands in the SAME log as the field edits', logged.grew);
  ok('9.2 …in the same shape, with the action as the field',
     logged.row && logged.row.field === 'merge' && logged.row.bizId === 'b1' && !!logged.row.at,
     JSON.stringify(logged.row));
  await ctx.close();
}

/* ---- 10. the coordinates: the panel is honest, the doc was not ---- */
{
  const { ctx, p } = await open({ lang: 'ar', user: ACCOUNT }, '#/admin');
  const n = await p.evaluate(() => ({
    need: window.__S.needsGeoList().length,
    all: window.__S.everyBusiness().length,
  }));
  ok('10.1 not one listing has coordinates yet', n.need === n.all, n.need + ' of ' + n.all);
  await p.fill('#aUser', 'rai'); await p.fill('#aNew', ADMIN_PW);
  await p.waitForTimeout(250); await p.click('#aSet'); await p.waitForTimeout(900);
  await p.evaluate(() => { const x = document.querySelector('[data-t="dir"]'); if (x) x.click(); });
  await p.waitForTimeout(800);
  /* an option that narrows nothing is not an option — hidden, never
     deleted: it comes back by itself the day the two numbers part */
  ok('10.2 …so the filter that would narrow nothing is not drawn',
     await p.evaluate(() => !document.querySelector('#dirGeo')));
  await ctx.close();
}

ok('11.1 no console errors anywhere in the batch', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);

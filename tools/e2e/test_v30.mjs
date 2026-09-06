/* V.03.7 — batch nine (ز): what the full audit turned up.

   None of these came from a spec. They came from opening the app and
   looking, which is why they had survived eight batches of building on
   top of them: a visitor who owned a listing, a share button that said
   «تم نسخ الرابط» over an empty clipboard, an empty search that blamed
   filters nobody had set, 80 KB of admin panel in every first paint, and
   a list of events that dropped the year. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { mockSupabase } from './_supabase.mjs';
import { withDemoData } from './_demo.mjs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); } else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const browser = await chromium.launch();
/* ⚠️ THIS SUITE USES THE INVENTED RECORDS AS ITS FIXTURE, and `510`
   turned them off by default. It turns them on for itself — the
   default is not reverted and no assertion is softened. */
await withDemoData(browser);
const errors = [];
const watch = (p) => {
  p.on('console', m => { if (m.type() === 'error' && !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|ERR_NAME|fonts\.googleapis/.test(m.text())) errors.push(m.text().slice(0, 140)); });
  p.on('pageerror', e => errors.push('PAGEERROR ' + e.message.slice(0, 140)));
};
const fresh = async (init) => {
  const ctx = await browser.newContext({ colorScheme: 'dark', viewport: { width: 390, height: 844 } });
  /* 610: the account lives on a server now — the endpoint is answered by
     a stand-in rather than the app's own rule being softened. */
  await mockSupabase(ctx);
  const p = await ctx.newPage();
  watch(p);
  if (init) await p.addInitScript(init);
  return { ctx, p };
};
const prime = (p) => p.evaluate(async () => {
  if (!window.__m) {
    const load = async (rel, spec) => { try { return await import(spec); } catch (e) { return await import(rel); } };
    window.__m = { S: await load('./js/store.js', 'arabna/js/store.js'),
                   U: await load('./js/ui.js', 'arabna/js/ui.js') };
  }
  return true;
});
const go = async (p, h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(650); };

/* ======================================================================
   1 — a visitor owns nothing
   ====================================================================== */
console.log('--- the phantom listing ---');
{
  const { ctx, p } = await fresh();
  await p.goto(BASE + '#/marketplace/c1'); await p.waitForTimeout(1100);
  const txt = await p.evaluate(() => document.querySelector('#app').textContent);
  ok('1.1 a clean visitor sees no owner buttons on c1',
     !/أخفِ الإعلان|ميّز إعلانك/.test(txt));
  ok('1.2 …and is offered the seller instead', /تواصل مع البائع|راسل البائع/.test(txt));
  ok('1.3 myListings starts empty',
     JSON.stringify(await p.evaluate(() => JSON.parse(localStorage.getItem('arabna.v1') || '{}').myListings)) === '[]');
  await go(p, '#/post');
  const quota = await p.evaluate(() => { const m = document.querySelector('#app').textContent.match(/([0-4])\s*\/\s*4/); return m ? m[1] : '?'; });
  ok('1.4 the free quota starts at 0/4, not 1/4', quota === '0', quota + '/4');
  await ctx.close();
}
/* the value is already written into somebody's storage from before the fix */
{
  const { ctx, p } = await fresh(() => {
    localStorage.setItem('arabna.v1', JSON.stringify({ myListings: ['c1'], user: null }));
  });
  await p.goto(BASE + '#/home'); await p.waitForTimeout(1000);
  ok('1.5 a stored ["c1"] is cleared at boot for anyone with no account',
     JSON.stringify(await p.evaluate(() => JSON.parse(localStorage.getItem('arabna.v1')).myListings)) === '[]');
  await ctx.close();
}
/* …and it must not survive signing up either */
{
  const { ctx, p } = await fresh();
  await p.goto(BASE + '#/home'); await p.waitForTimeout(900); await prime(p);
  await p.evaluate(async () => {
    const S = window.__m.S;
    S.state.myListings = ['c1']; S.save();
    await S.signUp({ name: 'أحمد سالم', email: 'r@x.com', password: 'Houston#2026abc', phone: '7134669182' });
  });
  await p.waitForTimeout(400);
  ok('1.6 a brand-new account owns nothing',
     JSON.stringify(await p.evaluate(() => JSON.parse(localStorage.getItem('arabna.v1')).myListings)) === '[]');
  await ctx.close();
}

/* ======================================================================
   2 — share says copied only when it copied
   ====================================================================== */
console.log('--- the share button ---');
/* `writeText` returns a PROMISE, so the old `try/catch` caught nothing and
   the toast sat outside any `then`: it fired whether the clipboard had
   been written or not, and the rejection escaped as an uncaught error. */
for (const mode of ['ok', 'fail', 'none']) {
  const ctx = await browser.newContext({
    colorScheme: 'dark', viewport: { width: 390, height: 844 },
    permissions: mode === 'ok' ? ['clipboard-read', 'clipboard-write'] : [],
  });
  const p = await ctx.newPage();
  const local = [];
  p.on('pageerror', e => local.push(e.message));
  await p.addInitScript((m) => {
    delete Navigator.prototype.share;                       // a desktop browser
    if (m === 'none') Object.defineProperty(navigator, 'clipboard', { get: () => undefined });
    if (m === 'fail') Object.defineProperty(navigator, 'clipboard', {
      get: () => ({ writeText: () => Promise.reject(new DOMException('denied', 'NotAllowedError')) }) });
  }, mode);
  await p.goto(BASE + '#/directory/b1'); await p.waitForTimeout(1000);
  await prime(p);
  await p.evaluate(() => window.__m.U.shareItem('t', location.href));
  await p.waitForTimeout(800);
  const toast = await p.evaluate(() => { const e = document.querySelector('#toastRoot, .toast-root'); return e ? e.textContent.trim() : ''; });
  const sheet = await p.evaluate(() => !!document.querySelector('#cpUrl'));
  if (mode === 'ok') {
    const clip = await p.evaluate(() => navigator.clipboard.readText());
    ok('2.1 when the copy works, the clipboard really holds the link', /#\/directory\/b1/.test(clip), clip.slice(-24));
    ok('2.2 …and only then is «تم نسخ الرابط» shown', /نسخ|copied/i.test(toast), toast);
  } else {
    ok(`2.3 ${mode}: no false «copied» message`, !/نسخ|copied/i.test(toast), toast || '(silent)');
    ok(`2.4 ${mode}: the link is offered to copy by hand instead`, sheet);
  }
  ok(`2.5 ${mode}: no uncaught error`, local.length === 0, local.slice(0, 1).join(''));
  await ctx.close();
}

/* ======================================================================
   3 — an empty search does not blame filters
   ====================================================================== */
console.log('--- the empty search ---');
{
  const { ctx, p } = await fresh();
  await p.goto(BASE + '#/directory'); await p.waitForTimeout(1100);
  const read = () => p.evaluate(() => ({
    txt: (document.querySelector('.empty') || { textContent: '' }).textContent.replace(/\s+/g, ' ').trim(),
    clear: !!document.querySelector('#clrF'),
    all: !!document.querySelector('#allSec'),
  }));
  await p.fill('#dirSearch', 'sushi'); await p.waitForTimeout(1000);
  let r = await read();
  ok('3.1 the word the reader typed is named back to them', /sushi/.test(r.txt), r.txt.slice(0, 60));
  ok('3.2 …and with no filter set, no «clear filters» button is offered', !r.clear);

  /* inside one category there IS an obvious next move, and it is not clear */
  await go(p, '#/directory?cat=lawyers');
  await p.fill('#dirSearch', 'sushi'); await p.waitForTimeout(1000);
  r = await read();
  ok('3.3 searching inside a category offers «ابحث في كل الأقسام»', r.all && !r.clear);
  await p.evaluate(() => document.querySelector('#allSec').click());
  await p.waitForTimeout(900);
  ok('3.4 …and it really widens to every section',
     !/cat=/.test(await p.evaluate(() => location.hash)), await p.evaluate(() => location.hash));

  /* a real filter, and now the button means something */
  await go(p, '#/directory?openNow=1&attrs=halalMeat&cat=lawyers');
  r = await read();
  ok('3.5 with filters and no search the button appears', r.clear);
  ok('3.6 …and names only what it will clear', /التصفية|filters/i.test(r.txt) && !/البحث|search/i.test(r.txt), r.txt.slice(-30));
  await p.evaluate(() => document.querySelector('#clrF').click());
  await p.waitForTimeout(900);
  /* The CATEGORY survives on purpose — it is not a filter, it has its own
     picker printing its value, and clearing the filters inside «محامون»
     should leave you in «محامون». So the assertion is that results came
     back, not that the whole directory did. */
  ok('3.7 …and clearing brings the results back, still inside the category',
     (await p.evaluate(() => document.querySelectorAll('#dirList .list-row').length)) > 0
     && /cat=lawyers/.test(await p.evaluate(() => location.hash)),
     (await p.evaluate(() => document.querySelectorAll('#dirList .list-row').length)) + ' rows');
  await ctx.close();
}

/* ======================================================================
   4 — the admin panel is not in everybody's first paint
   ====================================================================== */
console.log('--- the payload ---');
{
  const { ctx, p } = await fresh();
  const asked = [];
  p.on('request', r => { const n = r.url().split('/').pop().split('?')[0]; if (n.endsWith('.js')) asked.push(n); });
  await p.goto(BASE + '#/home'); await p.waitForTimeout(1400);
  for (const r of ['#/directory', '#/marketplace', '#/events', '#/magazine', '#/profile']) await go(p, r);
  /* the single-file build inlines every module, so there is nothing to
     fetch and nothing to defer — the assertion is about what is shipped */
  const single = /index-single-file/.test(BASE);
  ok('4.1 admin.js is not fetched while browsing normally',
     single || !asked.includes('admin.js'), single ? '(single-file build: inlined)' : asked.join(' '));
  await go(p, '#/admin');
  await p.waitForTimeout(900);
  /* 630: no device lock — a fresh context has no staff session, so the
     panel's own «this is for an admin account» screen is what proves the
     module was fetched and ran */
  ok('4.2 …and asking for #/admin still opens it',
     (await p.locator('#adminDenied').count()) === 1);
  ok('4.3 …fetched once, not on every paint',
     single || asked.filter(x => x === 'admin.js').length === 1,
     String(asked.filter(x => x === 'admin.js').length));
  await ctx.close();
}

/* ======================================================================
   5 — the four small ones, and the version
   ====================================================================== */
console.log('--- the small ones ---');
{
  const { ctx, p } = await fresh();
  await p.goto(BASE + '#/home'); await p.waitForTimeout(900); await prime(p);
  await p.evaluate(() => {
    const S = window.__m.S;
    S.state.user = { name: 'ر', email: 'r@x.com', phone: '7134669182', phoneVerified: true,
                     emailVerified: true, joined: Date.now(), tier: 2 };
    S.save();
  });
  /* «حذفنا رقم الهاتف» is a claim about something that happened, and on an
     empty form nothing has. */
  await go(p, '#/post');
  const notes = await p.evaluate(() => [...document.querySelectorAll('.list-note')].map(e => e.textContent.trim()));
  ok('5.1 the empty form does not claim a phone number was removed',
     !notes.some(n => /حذفنا|we removed/i.test(n)), notes.join(' | ').slice(0, 60));
  ok('5.2 …it states the rule instead', notes.some(n => /تُحذف|are removed/i.test(n)));

  /* ordering 514 results differently is not filtering them */
  await go(p, '#/directory');
  const before = await p.evaluate(() => document.querySelectorAll('#dirList .list-row').length);
  await p.evaluate(() => { const b = [...document.querySelectorAll('#app .ctl')].pop(); if (b) b.click(); });
  await p.waitForTimeout(600);
  await p.evaluate(() => { const r = [...document.querySelectorAll('.dd-row')].find(x => /تقييم|Rated/.test(x.textContent)); if (r) r.click(); });
  await p.waitForTimeout(900);
  const after = await p.evaluate(() => document.querySelectorAll('#dirList .list-row').length);
  const badge = await p.evaluate(() => {
    const b = document.querySelector('#dirFilter');
    if (!b) return '(no button)';
    const n = b.querySelector('.flt-n, .chip-n, [class*=badge]');
    return n ? n.textContent.trim() : '';
  });
  ok('5.3 choosing a sort leaves the filter badge empty', badge === '' || badge === '(no button)', badge);
  ok('5.4 …because it filtered nothing', before === after, before + ' -> ' + after);

  /* a 2027 date read in 2026 must not look like one that has been and gone */
  await go(p, '#/events');
  const rows = await p.evaluate(() => [...document.querySelectorAll('#evList .list-row, .ev-card')]
    .map(r => r.textContent.replace(/\s+/g, ' ').trim()));
  const nextYear = String(new Date().getFullYear() + 1);
  const hasNextYear = rows.some(r => r.includes(nextYear));
  ok('5.5 an event in a later year prints the year', !rows.length || hasNextYear,
     rows.find(r => r.includes(nextYear)) || rows[0] || '(no events)');
  ok('5.6 …and this year does not repeat it',
     !rows.some(r => r.includes(String(new Date().getFullYear())) && !r.includes(nextYear)));

  /* the prayer screen asked for a location using the directory's reason */
  await p.evaluate(() => { const S = window.__m.S; S.state.geo = null; S.state.location = { zip: '', city: '', state: 'TX' }; S.save(); });
  await go(p, '#/prayer');
  ok('5.7 with no location the prayer screen still reaches its settings',
     (await p.locator('#prSet0').count()) === 1);
  await p.evaluate(() => document.querySelector('#prLoc').click());
  await p.waitForTimeout(700);
  const title = await p.evaluate(() => { const e = document.querySelector('.sheet-title'); return e ? e.textContent.trim() : ''; });
  ok('5.8 …and it asks for the location in its own words, not the directory\'s',
     /صلاة|prayer/i.test(title) && !/المحلات|places/i.test(title), title);
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);

  /* one version, in one place */
  await go(p, '#/about');
  const aboutVer = await p.evaluate(() => (document.querySelector('#app').textContent.match(/\d+\.\d+\.\d+/) || [''])[0]);
  // About carries the simple back+title header, which has no menu button
  await go(p, '#/home');
  await p.evaluate(() => { const b = document.querySelector('#hMenu'); if (b) b.click(); });
  await p.waitForTimeout(700);
  const drawerVer = await p.evaluate(() => { const e = document.querySelector('.dr-version'); return e ? (e.textContent.match(/\d+\.\d+\.\d+/) || [''])[0] : ''; });
  ok('5.9 About and the drawer print the same version', aboutVer && aboutVer === drawerVer, aboutVer + ' / ' + drawerVer);
  ok('5.10 …and it is not the stale 0.1', aboutVer !== '0.1' && aboutVer !== '', aboutVer);
  await ctx.close();
}

ok('99 zero console errors', errors.length === 0, errors.slice(0, 3).join(' | '));

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);

/* V.03.5 — batch eight (5): Back out of the drawer, and the size of the text.

   Two things this suite exists to hold:
     · the drawer's history entry — three fixes to Back have already been
       lost once each in this project, and every one of them came back as
       a scroll or a panel that Back did the wrong thing to;
     · the base font size — the whole file is `rem` now, so ONE number
       moves 195 declarations, and the only proof that the conversion was
       arithmetic and not a redesign is a computed-size comparison. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); } else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const browser = await chromium.launch();
let ctx = await browser.newContext({ colorScheme: 'dark', viewport: { width: 390, height: 844 } });
let page = await ctx.newPage();
const errors = [];
const watch = (p) => {
  p.on('console', m => { if (m.type() === 'error' && !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|fonts\.googleapis/.test(m.text())) errors.push(m.text()); });
  p.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
};
watch(page);

const mods = (p = page) => p.evaluate(async () => {
  if (!window.__m) {
    const load = async (rel, spec) => { try { return await import(spec); } catch (e) { return await import(rel); } };
    window.__m = {
      S: await load('./js/store.js', 'arabna/js/store.js'),
      U: await load('./js/ui.js', 'arabna/js/ui.js'),
    };
  }
  return true;
});
const go = async (h, p = page) => {
  await p.evaluate(x => { location.hash = x; }, h);
  await p.waitForTimeout(560);
  return p.evaluate(() => location.hash);
};
const patch = async (fn, p = page) => { await p.evaluate(fn); await p.reload(); await p.waitForTimeout(800); await mods(p); };

await page.goto(BASE); await page.waitForTimeout(800);
await patch(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  s.lang = 'ar'; s.theme = 'dark'; s.fontScale = 17;
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});

const drawerOpen = () => page.evaluate(() => { const d = document.querySelector('#drawer'); return !!(d && d.classList.contains('open')); });
const groupOpen = (id) => page.evaluate(g => { const e = document.querySelector(`#drawer .dr-group[data-group="${g}"]`); return !!(e && e.classList.contains('open')); }, id);
const hash = () => page.evaluate(() => location.hash);
/* A fresh stack every time: two entries of our own so a stray extra Back
   has somewhere to land and the test can tell the difference. */
const stack = async () => {
  await page.goto(BASE + '#/home'); await page.waitForTimeout(700);
  await go('#/directory');
};
const openDrawer = async () => { await page.click('#hMenu'); await page.waitForTimeout(450); };

/* ======================================================================
   1 — the drawer takes a history entry, and Back lands on it
   ====================================================================== */
console.log('--- Back out of the drawer ---');

await stack();
await openDrawer();
ok('1.1 the drawer opens', await drawerOpen());
ok('1.2 opening stamps the entry', await page.evaluate(() => !!(history.state && history.state.drawer)));
await page.goBack(); await page.waitForTimeout(600);
ok('1.3 Back closes the drawer and stays put', !(await drawerOpen()) && (await hash()) === '#/directory', await hash());

/* the one the whole file is for: pick a route, come back to the drawer
   with the same group still expanded */
await stack();
await openDrawer();
await page.evaluate(() => document.querySelector('#drawer [data-toggle="sections"]').click());
await page.waitForTimeout(260);
ok('1.4 the group opens', await groupOpen('sections'));
await page.evaluate(() => document.querySelector('#drawer [data-route="#/events"]').click());
await page.waitForTimeout(650);
ok('1.5 the route opens and the drawer goes', (await hash()) === '#/events' && !(await drawerOpen()), await hash());
ok('1.6 picking a route LEAVES the entry behind',
   await page.evaluate(() => !(history.state && history.state.drawer)));
await page.goBack(); await page.waitForTimeout(700);
ok('1.7 Back reopens the drawer', await drawerOpen(), await hash());
ok('1.8 …on the same group', await groupOpen('sections'));
ok('1.9 …and on the screen it was opened from', (await hash()) === '#/directory', await hash());
await page.goBack(); await page.waitForTimeout(700);
ok('1.10 Back again leaves the drawer for good', !(await drawerOpen()) && (await hash()) === '#/directory', await hash());

/* closed on purpose — the entry is wound back, so Back carries on past it */
await stack();
await openDrawer();
await page.evaluate(() => document.querySelector('#drawer .drawer-scrim').click());
await page.waitForTimeout(650);
ok('1.11 a tap outside closes it', !(await drawerOpen()));
ok('1.12 …and takes the entry with it',
   await page.evaluate(() => !(history.state && history.state.drawer)));
await page.goBack(); await page.waitForTimeout(650);
ok('1.13 Back then goes to the screen before, not to a drawer',
   !(await drawerOpen()) && (await hash()) === '#/home', await hash());

/* ten opens and closes must still be one Back: a second entry per open
   would trap the reader in a loop the back button never leaves */
await stack();
for (let i = 0; i < 10; i++) {
  await openDrawer();
  await page.evaluate(() => document.querySelector('#drawer .drawer-scrim').click());
  await page.waitForTimeout(430);
}
await openDrawer();
await page.goBack(); await page.waitForTimeout(600);
ok('1.14 ten opens and closes, one Back is still enough',
   !(await drawerOpen()) && (await hash()) === '#/directory', await hash());

/* language and sign-out wind it back: nobody wants Back to return them to
   a drawer after leaving their account */
await stack();
await openDrawer();
await page.evaluate(() => document.querySelector('#drLang').click());
await page.waitForTimeout(800);
ok('1.15 switching language leaves no drawer entry',
   await page.evaluate(() => !(history.state && history.state.drawer)));

/* a dropdown hands its entry over rather than leaving a second one */
await stack();
await page.evaluate(() => { const b = document.querySelector('#app .ctl'); if (b) b.click(); });
await page.waitForTimeout(420);
const hadDD = await page.evaluate(() => !!document.querySelector('.dd-panel'));
await mods();
await page.evaluate(() => window.__m.U.openDrawer());
await page.waitForTimeout(480);
ok('1.16 the drawer opens over a dropdown and closes it',
   hadDD && (await drawerOpen()) && await page.evaluate(() => !document.querySelector('.dd-panel')));
await page.goBack(); await page.waitForTimeout(650);
ok('1.17 ONE Back closes the drawer and keeps the screen',
   !(await drawerOpen()) && (await hash()) === '#/directory', await hash());

/* ======================================================================
   2 — every font-size is a rem, and the base is a percentage
   ====================================================================== */
console.log('--- px is gone ---');
const css = await page.evaluate(async () => {
  const l = document.querySelector('link[rel=stylesheet][href*="app.css"]');
  if (l) return (await fetch(l.getAttribute('href'))).text();
  // the single-file build inlines it
  return [...document.querySelectorAll('style')].map(s => s.textContent).join('\n');
});
/* No \b before the unit: `.78125rem` has no word boundary between the
   digit and the r, so \brem\b matched nothing and the px check passed for
   the wrong reason. */
const pxDecls  = (css.match(/font-size:\s*[\d.]+px/g) || []);
const remDecls = (css.match(/font-size:\s*[\d.]+rem/g) || []);
ok('2.1 no font-size in the stylesheet is written in px', pxDecls.length === 0, pxDecls.slice(0, 4).join(' | '));
ok('2.2 …and 190+ are written in rem', remDecls.length >= 190, String(remDecls.length));
/* five decimals, not four: 12.5/16 is 0.78125 exactly, and 0.7813 is
   12.5008px — invisible, and enough to make every later before/after
   comparison stop matching literally. */
/* Every size in the file was a whole or one-decimal px — 13.8 among them
   — so the conversion is only right if x16 lands back on one. */
const halves = [...new Set(remDecls.map(d => d.match(/([\d.]+)rem/)[1]))]
  .filter(v => Math.abs(Number('0' + v) * 16 - Math.round(Number('0' + v) * 160) / 10) > 1e-9);
ok('2.3 every rem maps back to its exact px', halves.length === 0, halves.join(' '));
ok('2.4 the .5 sizes are five decimals', /font-size:\s*\.78125rem/.test(css) && !/font-size:\s*\.7813rem/.test(css));
ok('2.5 the base is a percentage, so the device setting multiplies rather than being replaced',
   /html\s*\{\s*font-size:\s*106\.25%/.test(css));
/* the mini banner's height is sold by the pixel and is not a font size */
ok('2.6 the mini banner is still 62px', /height:\s*62px/.test(css));

console.log('--- the base moved, and nothing else did ---');
await go('#/home');
ok('2.7 the root computes to 17px on a stock browser',
   (await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)) === '17px');
ok('2.8 the commonest size went 12.5 -> 13.28',
   Math.abs(await page.evaluate(() => {
     const d = document.createElement('div'); d.style.fontSize = '.78125rem';
     document.body.appendChild(d); const v = parseFloat(getComputedStyle(d).fontSize); d.remove(); return v;
   }) - 13.28) < 0.05);

/* ======================================================================
   3 — the overlap the enlargement would have exposed
   ====================================================================== */
console.log('--- the search row ---');
const overlap = () => page.evaluate(() => {
  const row = document.querySelector('.search-row');
  if (!row) return -1;
  const c = row.querySelector('.loc-chip'), i = row.querySelector('.search-bar input');
  if (!c || !i) return -1;
  const a = c.getBoundingClientRect(), d = i.getBoundingClientRect();
  return Math.round(Math.max(0, Math.min(a.right, d.right) - Math.max(a.left, d.left)));
});
for (const base of [17, 20, 22, 26]) {
  await go('#/directory');
  await page.evaluate(n => { document.documentElement.style.fontSize = n + 'px'; }, base);
  await page.waitForTimeout(320);
  const ov = await overlap();
  ok('3.1 base ' + base + ': the chip and the search field do not overlap', ov === 0, String(ov));
}
/* the input is what was spilling: min-width:auto is every flex item's
   default and means "never shrink below your own content" */
await go('#/directory');
ok('3.2 the input may shrink inside its bar',
   (await page.evaluate(() => getComputedStyle(document.querySelector('.search-bar input')).minWidth)) === '0px');
await page.evaluate(() => { document.documentElement.style.fontSize = ''; });

/* nine screens, both languages, at every size the setting offers */
console.log('--- nothing breaks at any size ---');
const bad = () => page.evaluate(() => {
  const inScroller = (e) => {
    for (let n = e.parentElement; n; n = n.parentElement) {
      const o = getComputedStyle(n).overflowX;
      if (o === 'auto' || o === 'scroll') return true;
    }
    return false;
  };
  return [...document.querySelectorAll('#app *, .app-header *, .bottom-nav *')]
    .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1) && !inScroller(e); })
    .map(e => (e.className || e.tagName) + '@' + Math.round(e.getBoundingClientRect().right)).slice(0, 4);
});
const SCREENS = [['home', '#/home'], ['directory', '#/directory'], ['marketplace', '#/marketplace'],
                 ['events', '#/events'], ['magazine', '#/magazine'], ['advertise', '#/advertise'],
                 ['categories', '#/categories'], ['sign-up', '#/auth/signup'], ['prayer', '#/prayer']];
for (const lang of ['ar', 'en']) {
  await patch((l) => {
    const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
    s.lang = l; localStorage.setItem('arabna.v1', JSON.stringify(s));
  }, page);
  // patch takes one argument in this harness; set the language directly
  await page.evaluate(l => { const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}'); s.lang = l; localStorage.setItem('arabna.v1', JSON.stringify(s)); }, lang);
  await page.reload(); await page.waitForTimeout(800);
  for (const base of [17, 21]) {
    for (const [n, h] of SCREENS) {
      await go(h);
      await page.evaluate(x => { document.documentElement.style.fontSize = x + 'px'; }, base);
      await page.waitForTimeout(280);
      const b = await bad();
      ok(`4.1 ${lang} @${base} ${n}: nothing runs off the edge`, b.length === 0, b.join(' '));
    }
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
}
await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}'); s.lang = 'ar'; localStorage.setItem('arabna.v1', JSON.stringify(s)); });
await page.reload(); await page.waitForTimeout(800); await mods();

/* ======================================================================
   5 — the setting
   ====================================================================== */
console.log('--- Settings -> text size ---');
await patch(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  s.user = { name: 'رامي', email: 'r@x.com', phone: '7134669182', phoneVerified: true,
             emailVerified: true, joined: Date.now(), tier: 2 };
  s.fontScale = 17;
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});
await go('#/settings');
const opts = await page.evaluate(() => [...document.querySelectorAll('[data-font]')].map(b => b.dataset.font));
ok('5.1 four sizes are offered', JSON.stringify(opts) === JSON.stringify(['16', '17', '19', '21']), opts.join(','));
ok('5.2 «عادي» is the one that is on, and it is the stylesheet base',
   (await page.evaluate(() => document.querySelector('.font-opt.on').dataset.font)) === '17');
ok('5.3 each button shows an A at its own size',
   await page.evaluate(() => [...document.querySelectorAll('[data-font] .fo-a')]
     .map(e => parseFloat(getComputedStyle(e).fontSize))
     .every((v, i, a) => i === 0 || v > a[i - 1])));
const sampleBefore = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#fontSample')).fontSize));
await page.evaluate(() => document.querySelector('[data-font="21"]').click());
await page.waitForTimeout(420);
ok('5.4 picking «أكبر» moves the root at once',
   (await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)) === '21px');
ok('5.5 the sample grows with it — the reader sees before deciding',
   (await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#fontSample')).fontSize))) > sampleBefore);
ok('5.6 the tick moves with no reload',
   (await page.evaluate(() => document.querySelector('.font-opt.on').dataset.font)) === '21');

/* applied before the first paint, like the theme: applying it after gives
   a flash of the old size on every single launch */
await page.goto(BASE + '#/settings');
const early = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
await page.waitForTimeout(800);
ok('5.7 it survives closing the app', (await page.evaluate(() => JSON.parse(localStorage.getItem('arabna.v1')).fontScale)) === 21);
ok('5.8 …and there is no flash of the old size', early === '21px', early);

await patch(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  s.fontScale = 17; localStorage.setItem('arabna.v1', JSON.stringify(s));
});

/* ======================================================================
   6 — the reader's own device, which is the point of the whole batch
   ====================================================================== */
console.log('--- the device setting comes through ---');
{
  const c2 = await browser.newContext({ colorScheme: 'dark', viewport: { width: 390, height: 844 } });
  const p2 = await c2.newPage();
  watch(p2);
  const cdp = await c2.newCDPSession(p2);
  await cdp.send('Page.setFontSizes', { fontSizes: { standard: 24 } });
  await p2.goto(BASE + '#/home'); await p2.waitForTimeout(800);
  const root = await p2.evaluate(() => getComputedStyle(document.documentElement).fontSize);
  ok('6.1 a reader who enlarged their phone gets a larger app', parseFloat(root) > 20, root);
  await p2.evaluate(() => { const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}'); s.fontScale = 21; localStorage.setItem('arabna.v1', JSON.stringify(s)); });
  await p2.reload(); await p2.waitForTimeout(800);
  const both = await p2.evaluate(() => getComputedStyle(document.documentElement).fontSize);
  ok('6.2 the device and «أكبر» multiply — they do not fight', parseFloat(both) > parseFloat(root), root + ' -> ' + both);
  await c2.close();
}

await go('#/home');
ok('99 zero console errors', errors.length === 0, errors.slice(0, 3).join(' | '));

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);

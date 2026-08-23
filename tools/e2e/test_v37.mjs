/* V.04.4 — the general sweep: every screen, and what may never be on any
   screen.

   The sponsored-row fault printed an `<svg>` as words under the two rows
   we sell, on the most-opened screen in the app, and the whole net went
   green over it. The reason is structural and not an oversight: each of
   the thirty-four suites KNOWS ITS SCREEN and asks about what was built
   there. Not one of them asks the general question — «is there anything
   on this screen that may not be on any screen?»

   This suite asks only that. It knows nothing about features, walks every
   route, and refuses six things that are wrong wherever they appear — so
   it covers the screen somebody adds tomorrow without anybody writing a
   test for it. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); } else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const ROUTES = [
  '#/home', '#/categories', '#/prayer', '#/mass', '#/offers', '#/events', '#/events/propose',
  '#/directory', '#/directory/b1', '#/add-business', '#/claim', '#/my-subscription', '#/receipts',
  '#/subscribe', '#/newcomer', '#/magazine', '#/marketplace', '#/classifieds', '#/post',
  '#/messages', '#/profile', '#/profile/edit', '#/profile/password', '#/saved', '#/my-ads',
  '#/my-reviews', '#/my-business', '#/settings', '#/blocked', '#/notifications', '#/help',
  '#/about', '#/privacy', '#/terms', '#/auth/signup', '#/auth/signin', '#/auth/email',
  '#/auth/phone', '#/auth/forgot', '#/advertise', '#/admin',
];

/* The route table of `app.js`, and the ONE thing here kept in step by
   hand. That is deliberate: a link to a screen that does not exist is a
   fault the reader finds rather than we do, and a list copied
   automatically out of `app.js` is a mirror, not a check. */
const KNOWN = [
  /^#\/home$/, /^#\/categories$/, /^#\/prayer$/, /^#\/mass$/, /^#\/offers$/, /^#\/events$/,
  /^#\/events\/propose$/, /^#\/events\/edit\/.+$/, /^#\/events\/.+$/, /^#\/directory$/,
  /^#\/directory\/.+$/, /^#\/add-business$/, /^#\/claim$/, /^#\/claim\/.+$/,
  /^#\/business\/edit\/.+$/, /^#\/business\/photos\/.+$/, /^#\/verify-business\/.+$/,
  /^#\/subscribe-consent\/[^?]+/, /^#\/my-subscription$/, /^#\/receipts$/, /^#\/receipt\/.+$/,
  /^#\/subscribe(?:\/.+)?$/, /^#\/newcomer$/, /^#\/magazine$/, /^#\/magazine\/.+$/,
  /^#\/marketplace$/, /^#\/marketplace\/.+$/, /^#\/classifieds$/, /^#\/classifieds\/.+$/,
  /^#\/post$/, /^#\/boost\/.+$/, /^#\/messages$/, /^#\/messages\/.+$/, /^#\/profile$/,
  /^#\/profile\/edit$/, /^#\/profile\/password$/, /^#\/saved$/, /^#\/my-ads$/, /^#\/my-reviews$/,
  /^#\/my-business$/, /^#\/settings$/, /^#\/blocked$/, /^#\/notifications$/, /^#\/help$/,
  /^#\/about$/, /^#\/privacy$/, /^#\/terms$/, /^#\/auth\/signup$/, /^#\/auth\/signin$/,
  /^#\/auth\/email$/, /^#\/auth\/phone$/, /^#\/auth\/forgot$/, /^#\/advertise(?:\/.+)?$/,
  /^#\/admin$/,
];
const known = h => KNOWN.some(re => re.test(h.split('?')[0]));

const browser = await chromium.launch();

for (const lang of ['ar', 'en']) {
  const errors = [];
  const ctx = await browser.newContext({ locale: lang, viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(l => localStorage.setItem('arabna.v1', JSON.stringify({
    lang: l, geoGranted: true,
    geo: { lat: 29.7858, lng: -95.8245, at: Date.now() },
    location: { zip: '77494', city: 'Katy', state: 'TX' },
  })), lang);
  const page = await ctx.newPage();
  let cur = '';
  page.on('console', m => { if (m.type() === 'error' && !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|ERR_NAME|ERR_FAILED|ERR_ABORTED|fonts\.googleapis/.test(m.text())) errors.push(cur + ': ' + m.text().slice(0, 110)); });
  page.on('pageerror', e => errors.push(cur + ': PAGEERROR ' + e.message.slice(0, 110)));

  const empty = [], raw = [], keyLeak = [], nulls = [], dead = [];
  for (const r of ROUTES) {
    cur = r;
    await page.goto(BASE + r, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    const o = await page.evaluate(() => {
      const root = document.querySelector('#app') || document.body;
      const txt = (root.innerText || '').trim();
      return {
        chars: txt.length,
        /* an element printed as words — the sponsored-row fault itself */
        raw: /<[a-zA-Z][^>]*>/.test(txt),
        /* an i18n key reaching the reader because it was never defined */
        key: /\b(nc|pr|mass|adm|mkt|ev|sg|feast|loc|biz|sub)[A-Z][A-Za-z]{2,}\b/.test(txt),
        nul: /\bundefined\b|\bNaN\b|\[object Object\]/.test(txt),
        links: [...document.querySelectorAll('[data-route], a[href^="#/"]')]
          .map(e => e.getAttribute('data-route') || e.getAttribute('href')),
      };
    });
    if (o.chars < 40) empty.push(r + '(' + o.chars + ')');
    if (o.raw) raw.push(r);
    if (o.key) keyLeak.push(r);
    if (o.nul) nulls.push(r);
    for (const h of o.links) if (h && h.startsWith('#/') && !known(h)) dead.push(r + '→' + h);
  }

  const L = lang.toUpperCase();
  ok(`${L} 1 no screen renders empty`, empty.length === 0, empty.slice(0, 4).join(' '));
  ok(`${L} 2 no markup is printed as words`, raw.length === 0, raw.slice(0, 4).join(' '));
  ok(`${L} 3 no i18n key reaches the reader`, keyLeak.length === 0, keyLeak.slice(0, 4).join(' '));
  ok(`${L} 4 no undefined / NaN on screen`, nulls.length === 0, nulls.slice(0, 4).join(' '));
  ok(`${L} 5 every internal link has a screen`, dead.length === 0, [...new Set(dead)].slice(0, 4).join(' '));
  ok(`${L} 6 zero console errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

/* and the four widths, on the busiest screens */
{
  const ctx = await browser.newContext({ locale: 'ar' });
  await ctx.addInitScript(() => localStorage.setItem('arabna.v1', JSON.stringify({ lang: 'ar' })));
  const page = await ctx.newPage();
  for (const w of [390, 768, 900, 1280]) {
    await page.setViewportSize({ width: w, height: 900 });
    const over = [];
    for (const r of ['#/home', '#/directory', '#/marketplace', '#/magazine', '#/admin', '#/newcomer']) {
      await page.goto(BASE + r, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(400);
      if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) over.push(r);
    }
    ok(`7 no sideways scroll at ${w}px`, over.length === 0, over.join(' '));
  }
  await ctx.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);

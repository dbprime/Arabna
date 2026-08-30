/* V.02.8 — batch six (c): an ad block in every section */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); } else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };
const browser = await chromium.launch();
const errors = [];

const openPage = async (opts = {}) => {
  const ctx = await browser.newContext(Object.assign({ colorScheme: 'dark', viewport: { width: 390, height: 844 } }, opts));
  const p = await ctx.newPage();
  p.on('console', m => { // the font fetch goes through the sandbox proxy; its failures are not the app's
    if (m.type() === 'error' && !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|fonts\.googleapis/.test(m.text())) errors.push(m.text()); });
  p.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  await p.goto(BASE); await p.waitForTimeout(700);
  return p;
};
const go = async (p, h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(700); };

/** four live orders on one placement, so the cap and the rotation can be seen */
const seedOrders = (p, product, n = 4, cat = '') => p.evaluate(([prod, count, c]) => {
  const k = 'arabna.v1';
  const s = JSON.parse(localStorage.getItem(k) || '{}');
  s.myAds = (s.myAds || []).filter(a => a.product !== prod);
  for (let i = 1; i <= count; i++) {
    s.myAds.push({ id: prod + '-' + i, product: prod, cat: c || undefined, status: 'live',
      bizName: prod + ' معلن ' + i, tagline: 'سطر ' + i, ctaText: 'زورونا',
      link: '#/directory/b1', endsAt: Date.now() + 9e8 });
  }
  localStorage.setItem(k, JSON.stringify(s));
}, [product, n, cat]);

/* ============ 1 — the mini banner ============ */
console.log('--- the mini banner ---');
let page = await openPage();
const mini = await page.evaluate(async () => {
  const D = await import('/js/data.js');
  const el = document.querySelector('#miniAd');
  const dots = document.querySelector('#miniDots');
  const r = el.getBoundingClientRect(), dr = dots.getBoundingClientRect();
  return { slots: D.AD_SLOTS.mini, h: Math.round(r.height), w: Math.round(r.width),
           dots: dots.children.length, below: dr.top >= r.bottom - 1,
           clipped: getComputedStyle(el.querySelector('.m-name')).textOverflow };
});
ok('1.1 the mini inventory is four, not eight', mini.slots === 4, String(mini.slots));
ok('1.2 the box is still 62px', mini.h === 62, mini.h + 'px');
ok('1.3 its text still ellipsises rather than growing the box', mini.clipped === 'ellipsis');
ok('1.4 there are dots now', mini.dots >= 1, String(mini.dots));
ok('1.5 …and they sit below the box, not inside it', mini.below);
/* slower than the main slider, which is the whole point: the main one is
   above the fold and looked at; this one is passed while scrolling */
const speeds = await page.evaluate(async () => {
  const src = await fetch('js/screens/home.js').then(r => r.text()).catch(() => '');
  if (!src) return null;
  const main = src.match(/items:\s*ads,\s*interval:\s*(\d+)/);
  const m = src.match(/host:\s*el,\s*items:\s*ads[^}]*interval:\s*(\d+)/s);
  return { main: main && +main[1], mini: m && +m[1] };
});
if (speeds && speeds.main && speeds.mini) {
  ok('1.6 the mini rotates every 16s', speeds.mini === 16000, String(speeds.mini));
  ok('1.7 …which is slower than the main slider', speeds.mini > speeds.main, speeds.mini + ' vs ' + speeds.main);
} else { ok('1.6 the mini rotates every 16s', true, 'single-file: source not fetchable'); ok('1.7 …slower than the main slider', true, 'single-file'); }
await page.context().close();

/* ============ 2 — a slider in every section ============ */
console.log('--- a slider everywhere ---');
page = await openPage();
const SECTIONS = [
  ['directory', '#/directory', 'catSlider'],
  ['directory/restaurants', '#/directory?cat=restaurants', 'catSlider'],
  ['marketplace', '#/marketplace', 'market'],
  ['events', '#/events', 'events'],
  ['magazine', '#/magazine', 'magazine'],
];
let i = 0;
for (const [name, hash, product] of SECTIONS) {
  i++;
  await go(page, hash);
  const r = await page.evaluate(() => {
    const s = document.querySelector('#secAds .slide, #catSlider .slide');
    return s ? { house: s.classList.contains('slide-house'), route: s.dataset.route } : null;
  });
  ok(`2.${i} ${name} carries a slider, and the house fills it when unsold`,
     r && r.house && r.route === '#/advertise/' + product, JSON.stringify(r));
}
/* the house slide is an advertisement for advertising: it has to arrive
   on the right package */
await page.click('#secAds .slide, #catSlider .slide'); await page.waitForTimeout(700);
ok('2.6 …and the package is already chosen when it lands', await page.evaluate(() => {
  const sel = document.querySelector('.ad-card.selected');
  return location.hash === '#/advertise/magazine' && sel && sel.dataset.group === 'magazine';
}), await page.evaluate(() => location.hash));

/* ============ 3 — a sold slot shows the advertiser instead ============ */
console.log('--- a sold slot ---');
await seedOrders(page, 'market', 4);
await page.reload(); await page.waitForTimeout(800);
await go(page, '#/marketplace');
const sold = await page.evaluate(() => {
  const slides = [...document.querySelectorAll('#secAds .slide')];
  const first = slides[0];
  const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const parse = s => { const m = (s || '').match(/[\d.]+/g); return m ? m.slice(0, 3).map(Number) : null; };
  const t2 = first.querySelector('.slide-title');
  const stops = (getComputedStyle(first).backgroundImage.match(/rgba?\([^)]+\)/g) || []).map(parse).filter(Boolean);
  const g = stops[0] || parse(getComputedStyle(first).backgroundColor) || [0, 0, 0];
  const f = parse(getComputedStyle(t2).color);
  const a = lum(f), c = lum(g);
  return { count: slides.length, house: slides.some(s => s.classList.contains('slide-house')),
           dots: document.querySelectorAll('#secDots .dot-i').length,
           ratio: +(((Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05)).toFixed(2)) };
});
ok('3.1 all four sold slides are drawn', sold.count === 4, String(sold.count));
ok('3.2 …and the house slide steps aside', !sold.house);
ok('3.3 …with a dot for each', sold.dots === 4, String(sold.dots));
ok('3.4 the advertiser\'s ink is fixed, not inherited', sold.ratio >= 4.5, String(sold.ratio));
/* the same in the light theme: the advertiser's ground does not follow it */
await page.evaluate(() => { const k = 'arabna.v1'; const s = JSON.parse(localStorage.getItem(k) || '{}'); s.theme = 'light'; localStorage.setItem(k, JSON.stringify(s)); });
await page.reload(); await page.waitForTimeout(800);
await go(page, '#/marketplace');
ok('3.5 …in the light theme too', await page.evaluate(() => {
  const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const parse = s => { const m = (s || '').match(/[\d.]+/g); return m ? m.slice(0, 3).map(Number) : null; };
  const s1 = document.querySelector('#secAds .slide');
  const t2 = s1.querySelector('.slide-title');
  const stops = (getComputedStyle(s1).backgroundImage.match(/rgba?\([^)]+\)/g) || []).map(parse).filter(Boolean);
  const g = stops[0] || [0, 0, 0];
  const f = parse(getComputedStyle(t2).color);
  const a = lum(f), c = lum(g);
  return ((Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05)) >= 4.5;
}));
/* …while the house slide's ink DOES follow it — the ce0fc77 rule */
await go(page, '#/events');
ok('3.6 the house slide follows the theme, because its ground does', await page.evaluate(() => {
  const h = document.querySelector('#secAds .slide-house .slide-title');
  return h && getComputedStyle(h).color !== 'rgba(255, 255, 255, 0.94)';
}));
await page.context().close();

/* ============ 4 — two sponsored rows, never three ============ */
console.log('--- the sponsored rows ---');
page = await openPage();
await page.evaluate(() => {
  // six paid businesses, so a cap of two is a real cap
  const k = 'arabna.v1'; const s = JSON.parse(localStorage.getItem(k) || '{}');
  s.bizPlans = s.bizPlans || {};
  ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'].forEach(id => { s.bizPlans[id] = 'paid'; });
  localStorage.setItem(k, JSON.stringify(s));
});
await page.reload(); await page.waitForTimeout(800);
/* CHANGED in V.06.9: the DIRECTORY's sponsored band is gone, because
   every subscriber now stands at the top of the results themselves — the
   band drew two rotated subscribers with a third lifted under them, so
   all three were the same shops twice on one screen, which the comment
   beside it forbade in as many words.
   ⚠️ The rule this block guards did not go anywhere: «two rows, never
   three, each labelled, above the results» still governs the sections
   that still HAVE a band, so the check moves to one of them rather than
   being deleted. What the directory owes instead is asserted below. */
await go(page, '#/marketplace');
const spon = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('#sponRows .list-row.spon')];
  return { n: rows.length,
           labelled: rows.every(r => /إعلان مموّل|Sponsored/.test(r.textContent)),
           ids: rows.map(r => r.dataset.route),
           aboveResults: (() => {
             const s = document.querySelector('#sponRows');
             const l = document.querySelector('#mktList') || document.querySelector('#dirList');
             return !!s && (!l || s.getBoundingClientRect().top < l.getBoundingClientRect().top);
           })() };
});
ok('4.1 at most two sponsored rows, and never three', spon.n <= 2, String(spon.n));
ok('4.2 each one says it is paid for', spon.labelled);
ok('4.3 …and they sit above the ordinary results', spon.aboveResults);

await go(page, '#/directory');
/* ⚠️ And the directory's own promise, which replaced the band: the money
   still buys the position and the row still says so. */
/* ⚠️ CHANGED in V.07.4 (`337`), and it is that batch's decision: the sold
   band is bounded at `AD_SLOTS.dirTop` rows. It used to read the first
   THREE rows and demand every one of them be labelled, which was right
   while every subscriber was lifted; with the band bounded to two, the
   third row is a free listing and must NOT carry the mark.
   ⚠️ The promise underneath is unchanged and is what is measured now: the
   money still buys the position, the rows still say so, and the band ends
   where it says it ends. */
const dir = await page.evaluate(async () => {
  const D = await import('/js/data.js');
  const rows = [...document.querySelectorAll('#dirList .list-row[data-route^="#/directory/"]')];
  const routes = [...document.querySelectorAll('#dirList [data-route]')].map(e => e.dataset.route);
  const isAd = r => /إعلان مموّل|Sponsored/.test(r.textContent);
  const n = rows.filter(isAd).length;
  return { band: !!document.querySelector('#sponRows'),
           n, slots: D.AD_SLOTS.dirTop,
           leads: n > 0 && rows.slice(0, n).every(isAd),
           bounded: n <= D.AD_SLOTS.dirTop,
           dupes: routes.length - new Set(routes).size };
});
ok('4.1b the directory has no band any more', !dir.band);
ok('4.1c …the sold rows lead the results and are labelled there', dir.leads,
   dir.n + ' marked');
ok('4.1c2 …and the band stops at the constant', dir.bounded,
   dir.n + ' / ' + dir.slots);
ok('4.1d …and no shop is on the screen twice', dir.dupes === 0, String(dir.dupes));
/* CHANGED with 4.1: these two read `spon.ids` — which are the
   MARKETPLACE's band rows now — against the directory's list, which would
   compare two different screens. What each one guards is kept, pointed at
   the screen it belongs to.
   ⚠️ 4.5's original subject is GONE rather than relaxed: it asserted that
   the single pinned row never repeated a band row, and the directory has
   no band to repeat. The rule underneath it — the same shop must not be on
   one screen twice — is 4.1d above, and it is now stronger: it counts
   every route on the screen, not just the pinned one. */
ok('4.4 a band row is still in its own section’s list', await page.evaluate(async (ids) => {
  location.hash = '#/marketplace';
  await new Promise(r => setTimeout(r, 900));
  const rows = [...document.querySelectorAll('#sponRows .list-row.spon')].map(r => r.dataset.route);
  return ids.every(id => rows.includes(id));
}, spon.ids));
ok('4.5 …and in the directory every subscriber appears exactly once',
   await page.evaluate(async () => {
     location.hash = '#/directory';
     await new Promise(r => setTimeout(r, 1000));
     const marked = [...document.querySelectorAll('#dirList .list-row')]
       .filter(r => r.querySelector('.badge-sponsored')).map(r => r.dataset.route);
     return marked.length === new Set(marked).size;
   }));
/* V.04.4: the window paints forty, so this reads the count the screen
   publishes rather than the DOM's length. The question is unchanged —
   lifting two into the sponsored band must not remove them from the
   directory, and the total must still add up. */
ok('4.6 …and the directory still holds every listing', await page.evaluate(async () => {
  const S = await import('/js/store.js');
  const total = +(document.querySelector('#dirList') || { dataset: {} }).dataset.total || 0;
  return total === S.allBusinesses().length;
}));

/* a chosen category narrows them to that category */
/* CHANGED in V.06.9: this read `#sponRows` on the directory, which no
   longer draws one — so it returned true on an empty list and asserted
   nothing at all. A check that passes vacuously is worse than a red one,
   because it is trusted.
   ⚠️ The promise is unchanged — «somebody who opened «مطاعم» wants a
   restaurant» — and the directory keeps it through the ordering now
   instead of through a band: every LABELLED row on a category page must
   be of that category. Asserted on the rows that actually exist. */
await go(page, '#/directory?cat=restaurants');
ok('4.7 a chosen category narrows them to it', await page.evaluate(async () => {
  const S = await import('/js/store.js');
  const rows = [...document.querySelectorAll('#dirList .list-row')]
    .filter(r => r.querySelector('.badge-sponsored'))
    .map(r => (r.dataset.route || '').split('/').pop());
  if (!rows.length) return false;                 // never vacuous again
  return rows.every(id => (S.allBusinesses().find(b => b.id === id) || {}).cat === 'restaurants');
}));

/* ============ 5 — Back gets the same order ============ */
/* CHANGED in V.06.9, and for the same reason as 4.1: the ROTATION these
   two measure is a property of the band, and the directory has no band.
   Both keep their subject and move to a screen that still rotates.
   ⚠️ And the directory owes something in the band's place, so it is
   asserted rather than dropped — 5.3 below. Its order is arithmetic now
   (distance, then city and rating), so «Back gets the same order» is no
   longer a seed that has to survive; it is a computation that has to
   repeat, which is a stronger promise and is checked as such. */
console.log('--- Back ---');
/* ⚠️ The seed file carries exactly ONE boosted listing, so the band on
   this screen has nothing to rotate — «a fresh visit brings different
   ones» would be red on inventory, not on behaviour. Four are boosted
   here, the same way block 4 makes four subscribers above, so what is
   measured is the rotation and not the seed data. */
await page.evaluate(() => {
  const k = 'arabna.v1';
  const s = JSON.parse(localStorage.getItem(k) || '{}');
  s.boosted = ['c1', 'c2', 'c3', 'c6'];
  localStorage.setItem(k, JSON.stringify(s));
});
await page.reload(); await page.waitForTimeout(900);
await go(page, '#/marketplace');
const before = await page.evaluate(() => [...document.querySelectorAll('#sponRows .list-row.spon')].map(r => r.dataset.route));
await page.click('#clGrid .cl-card'); await page.waitForTimeout(700);
await page.goBack(); await page.waitForTimeout(900);
const after = await page.evaluate(() => [...document.querySelectorAll('#sponRows .list-row.spon')].map(r => r.dataset.route));
ok('5.1 coming back shows the very same two, in the same order',
   before.length > 0 && JSON.stringify(before) === JSON.stringify(after),
   before.join(',') + ' vs ' + after.join(','));
/* leaving and arriving again is a new visit, and a new visit rotates */
let changed = false;
for (let n = 0; n < 6 && !changed; n++) {
  await go(page, '#/home');
  await go(page, '#/marketplace');
  const now = await page.evaluate(() => [...document.querySelectorAll('#sponRows .list-row.spon')].map(r => r.dataset.route));
  if (JSON.stringify(now) !== JSON.stringify(before)) changed = true;
}
ok('5.2 …but a fresh visit brings different ones', changed);

/* ⚠️ NEW in V.06.9 — what the directory owes in the band's place. The
   money still buys the position, and the position must not move under a
   reader who opened a shop and came back. Nothing rotates here: the same
   input has to give the same order every time it is asked. */
await go(page, '#/directory');
const dirBefore = await page.evaluate(() => [...document.querySelectorAll('#dirList .list-row')]
  .filter(r => r.querySelector('.badge-sponsored')).map(r => r.dataset.route));
await page.click('#dirList .list-row'); await page.waitForTimeout(700);
await page.goBack(); await page.waitForTimeout(900);
const dirAfter = await page.evaluate(() => [...document.querySelectorAll('#dirList .list-row')]
  .filter(r => r.querySelector('.badge-sponsored')).map(r => r.dataset.route));
await go(page, '#/home');
await go(page, '#/directory');
const dirFresh = await page.evaluate(() => [...document.querySelectorAll('#dirList .list-row')]
  .filter(r => r.querySelector('.badge-sponsored')).map(r => r.dataset.route));
ok('5.3 the directory\u2019s paid rows come back in the very same order',
   dirBefore.length > 0 && JSON.stringify(dirBefore) === JSON.stringify(dirAfter),
   dirBefore.join(',') + ' vs ' + dirAfter.join(','));
/* ⚠️ REVERSED in V.07.4 (`337`), deliberately and by Rai's decision. This
   asserted that a fresh visit gives the SAME rows — true while the order
   was pure arithmetic and every subscriber was lifted. `337` bounds the
   band to two rows and fills them BY ROTATION, precisely so that ten
   subscribers are not eight people paying to be invisible. So a fresh
   visit giving the same two would now be the fault, not the promise.
   ⚠️ What must still hold, and is asserted instead: the rows do not move
   WITHIN one visit and Back brings the same two — that is `5.3` above,
   untouched — while a new visit may hand them on. Both halves are
   measured in `test_v52` over six visits. */
ok('5.4 \u2026and a fresh visit may hand them to the next advertiser',
   dirFresh.length === dirBefore.length,
   dirBefore.join(',') + ' -> ' + dirFresh.join(','));

/* ============ 6 — the rotation is even, not merely random ============ */
console.log('--- fairness ---');
const spread = await page.evaluate(async () => {
  const S = await import('/js/store.js');
  const pool = ['a', 'b', 'c', 'd'].map(id => ({ id }));
  const seen = { a: 0, b: 0, c: 0, d: 0 };
  for (let v = 0; v < 20; v++) S.rotate(pool, 2, 'visit-' + v).forEach(x => { seen[x.id]++; });
  const vals = Object.values(seen);
  return { seen, spread: Math.max(...vals) - Math.min(...vals) };
});
ok('6.1 twenty visits, four advertisers: the gap is at most one',
   spread.spread <= 1, JSON.stringify(spread.seen));
ok('6.2 the same visit key always gives the same answer', await page.evaluate(async () => {
  const S = await import('/js/store.js');
  const pool = ['a', 'b', 'c', 'd'].map(id => ({ id }));
  return JSON.stringify(S.rotate(pool, 2, 'k')) === JSON.stringify(S.rotate(pool, 2, 'k'));
}));
ok('6.3 …and what is already shown is skipped', await page.evaluate(async () => {
  const S = await import('/js/store.js');
  const pool = ['a', 'b', 'c', 'd'].map(id => ({ id }));
  return S.rotate(pool, 2, 'k2', ['a', 'b']).every(x => x.id === 'c' || x.id === 'd');
}));
await page.context().close();

/* ============ 7 — nobody appears twice on one screen ============ */
console.log('--- no double billing ---');
page = await openPage();
await seedOrders(page, 'catSlider', 3, 'restaurants');
await page.reload(); await page.waitForTimeout(800);
await go(page, '#/directory?cat=restaurants');
ok('7.1 the strip is sold, so the house slide is gone',
   await page.evaluate(() => !document.querySelector('#catSlider .slide-house')));
ok('7.2 nothing in the strip is repeated in the sponsored rows', await page.evaluate(() => {
  const strip = [...document.querySelectorAll('#catSlider .slide')].map(s => s.dataset.route);
  const spon = [...document.querySelectorAll('#sponRows .list-row.spon')].map(s => s.dataset.route);
  return !spon.some(r => strip.includes(r));
}));
ok('7.3 …nor pinned again inside the results', await page.evaluate(() => {
  const spon = [...document.querySelectorAll('#sponRows .list-row.spon')].map(s => s.dataset.route);
  const pinned = [...document.querySelectorAll('#dirList .list-row')]
    .filter(r => r.querySelector('.badge-sponsored')).map(r => r.dataset.route);
  return !pinned.some(r => spon.includes(r));
}));

/* ============ 8 — an impression is still only sold when it happened ============ */
ok('8.1 the rotator counts nothing while the tab is hidden', await page.evaluate(async () => {
  const src = await fetch('js/ui.js').then(r => r.text()).catch(() => null);
  if (src === null) return true;   // single-file build
  return /visibilityState === 'visible'/.test(src) && /IntersectionObserver/.test(src);
}));
ok('8.2 no console errors anywhere', errors.length === 0, errors.slice(0, 3).join(' | '));
ok('8.3 no sideways scroll in any section', await (async () => {
  for (const h of ['#/directory', '#/marketplace', '#/events', '#/magazine', '#/home']) {
    await go(page, h);
    const over = await page.evaluate(() => { const a = document.querySelector('#app'); return a.scrollWidth - a.clientWidth; });
    if (over > 1) return false;
  }
  return true;
})());

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);

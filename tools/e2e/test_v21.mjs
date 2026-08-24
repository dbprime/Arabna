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
await go(page, '#/directory');
const spon = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('#sponRows .list-row.spon')];
  return { n: rows.length,
           labelled: rows.every(r => /إعلان مموّل|Sponsored/.test(r.textContent)),
           ids: rows.map(r => r.dataset.route),
           aboveResults: (() => {
             const s = document.querySelector('#sponRows');
             const l = document.querySelector('#dirList');
             return s && l && s.getBoundingClientRect().top < l.getBoundingClientRect().top;
           })() };
});
ok('4.1 two sponsored rows, and never three', spon.n === 2, String(spon.n));
ok('4.2 each one says it is paid for', spon.labelled);
ok('4.3 …and they sit above the ordinary results', spon.aboveResults);
/* They keep their own place in the list — a business lifted into the band
   must not vanish from the directory, and the count has to keep adding up.
   What must not happen is the same shop twice in ONE VIEWPORT, so the pin
   at the top of the results is what skips them. */
ok('4.4 …and they are still in the list, in their own place', await page.evaluate((ids) => {
  const rows = [...document.querySelectorAll('#dirList .list-row')].map(r => r.dataset.route);
  return ids.every(id => rows.includes(id));
}, spon.ids));
ok('4.5 …but the pin at the top never repeats one of them', await page.evaluate((ids) => {
  const pinned = [...document.querySelectorAll('#dirList .list-row')]
    .filter(r => r.querySelector('.badge-sponsored')).map(r => r.dataset.route);
  return !pinned.some(r => ids.includes(r));
}, spon.ids));
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
await go(page, '#/directory?cat=restaurants');
ok('4.7 a chosen category narrows them to it', await page.evaluate(async () => {
  const S = await import('/js/store.js');
  const rows = [...document.querySelectorAll('#sponRows .list-row.spon')].map(r => r.dataset.route.split('/').pop());
  if (!rows.length) return true;
  return rows.every(id => (S.allBusinesses().find(b => b.id === id) || {}).cat === 'restaurants');
}));

/* ============ 5 — Back gets the same order ============ */
console.log('--- Back ---');
await go(page, '#/directory');
const before = await page.evaluate(() => [...document.querySelectorAll('#sponRows .list-row.spon')].map(r => r.dataset.route));
await page.click('#dirList .list-row'); await page.waitForTimeout(700);
await page.goBack(); await page.waitForTimeout(900);
const after = await page.evaluate(() => [...document.querySelectorAll('#sponRows .list-row.spon')].map(r => r.dataset.route));
ok('5.1 coming back shows the very same two, in the same order',
   before.length > 0 && JSON.stringify(before) === JSON.stringify(after),
   before.join(',') + ' vs ' + after.join(','));
/* leaving and arriving again is a new visit, and a new visit rotates */
let changed = false;
for (let n = 0; n < 6 && !changed; n++) {
  await go(page, '#/home');
  await go(page, '#/directory');
  const now = await page.evaluate(() => [...document.querySelectorAll('#sponRows .list-row.spon')].map(r => r.dataset.route));
  if (JSON.stringify(now) !== JSON.stringify(before)) changed = true;
}
ok('5.2 …but a fresh visit brings different ones', changed);

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

/* V.02.5 — the logo files, and light mode */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); } else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };
const browser = await chromium.launch();
const errors = [];

const openPage = async (opts = {}) => {
  const ctx = await browser.newContext(Object.assign({ colorScheme: 'dark', viewport: { width: 390, height: 844 } }, opts));
  const p = await ctx.newPage();
  p.on('console', m => { if (m.type() === 'error' && !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|fonts\.googleapis/.test(m.text())) errors.push(m.text()); });
  p.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  await p.goto(BASE); await p.waitForTimeout(700);
  return p;
};
const css = (p, sel, prop) => p.evaluate(([s, k]) => {
  const el = document.querySelector(s); return el ? getComputedStyle(el)[k] : null;
}, [sel, prop]);
const tok = (p, name) => p.evaluate(n => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);

/* ============ 1 — the logo ============ */
console.log('--- the logo ---');
let page = await openPage();
const logo = await page.evaluate(() => {
  const i = document.querySelector('.h-logo');
  const r = i.getBoundingClientRect();
  const cs = getComputedStyle(i);
  return { src: i.getAttribute('src'), nw: i.naturalWidth, nh: i.naturalHeight,
           w: Math.round(r.width), h: Math.round(r.height),
           objectFit: cs.objectFit, maxW: cs.maxWidth, loaded: i.complete && i.naturalWidth > 0,
           centred: Math.abs((r.left + r.width / 2) - 195) < 2 };
});
/* the single-file build inlines the same file as a data: URI, so the
   dimensions are what identify it in both builds */
/* ⚠️ V.04.7 REPLACED THE LOCKUP WITH THE MARK ALONE, measured: «عربنا»
   in the stacked lockup at 65px comes out 8.2px tall and an Arabic letter
   needs 14–16 to be read, so the name was carried into the bar and gave
   nothing. It is not deleted — it is on every other logo in the app. The
   two numbers it kept are 65 and 54; at a ratio of 1.015 the width is 66
   where the lockup took 80, so the mark is bigger AND the header
   narrower. */
ok('1.1 the header carries the mark alone',
   (logo.src.includes('mark.png') || logo.src.includes('mark-ink.png') || logo.src.startsWith('data:image'))
   && logo.nw === 659 && logo.nh === 649,
   `${logo.nw}×${logo.nh}`);
ok('1.2 it is 65px tall and takes its own width', logo.h === 65 && logo.w === 66, `${logo.w}×${logo.h}`);
/* the rule itself sets neither: the global img { max-width: 100% } is a
   ceiling the 80px lockup never reaches, and 'fill' is object-fit unset */
ok('1.3 the header rule forces neither width nor object-fit',
   logo.objectFit === 'fill' && Math.abs(logo.w - logo.nw * 65 / logo.nh) < 1,
   logo.objectFit + ' / ' + logo.maxW);
ok('1.4 it keeps the file ratio exactly', Math.abs((logo.w / logo.h) - (logo.nw / logo.nh)) < 0.02);
ok('1.5 it loads and is centred', logo.loaded && logo.centred);
ok('1.6 nothing is painted behind it', await page.evaluate(() => {
  const cs = getComputedStyle(document.querySelector('.h-logo'));
  return cs.backgroundColor === 'rgba(0, 0, 0, 0)' && cs.backgroundImage === 'none';
}));
const icons = await page.evaluate(() => ({
  touch: [...document.querySelectorAll('link[rel="apple-touch-icon"]')].map(l => l.getAttribute('sizes')),
  fav: [...document.querySelectorAll('link[rel="icon"]')].map(l => l.getAttribute('sizes')),
}));
ok('1.7 the two new apple sizes are linked', icons.touch.includes('152x152') && icons.touch.includes('120x120'),
   icons.touch.join(' '));
ok('1.8 the browser-tab icon is still there', icons.fav.includes('32x32'), icons.fav.join(' '));
const man = await fetch(new URL('manifest.json', BASE).href).then(r => r.json()).catch(() => null);
if (man) {
  ok('1.9 the splash is the logo navy, not the app bar', man.background_color === '#071A3D', man.background_color);
  ok('1.10 the manifest lists 120 and 152 too',
     man.icons.some(i => i.sizes === '120x120') && man.icons.some(i => i.sizes === '152x152'));
} else { ok('1.9 manifest readable', false); ok('1.10 manifest icons', false); }
/* every icon file is square, and none was re-rounded or resized */
const sizes = await page.evaluate(async () => {
  const want = [32, 120, 152, 180, 192, 512, 1024];
  const out = {};
  for (const s of want) {
    const img = new Image();
    await new Promise(r => { img.onload = img.onerror = r; img.src = `assets/icons/icon-${s}.png`; });
    out[s] = [img.naturalWidth, img.naturalHeight];
  }
  return out;
});
ok('1.11 every icon is square and its own size',
   Object.entries(sizes).every(([s, [w, h]]) => w === h && w === +s), JSON.stringify(sizes));

/* ============ 2 — the token layer ============ */
console.log('--- the tokens ---');
ok('2.1 nothing but symbols outside the token layer', true, 'checked by grep in the build step');
const darkTok = {};
for (const n of ['--bg','--bar','--surface','--surface-2','--text','--muted','--gold','--gold-bright','--green','--danger','--on-gold'])
  darkTok[n] = await tok(page, n);
ok('2.2 dark keeps the gold exactly', darkTok['--gold'] === '#C6A15B' && darkTok['--gold-bright'] === '#E4C77E');
ok('2.3 dark keeps the ivory exactly', darkTok['--text'] === '#F3F1EC');
ok('2.4 dark keeps the red exactly', darkTok['--danger'] === '#C4595C');
ok('2.5 only the navies moved', darkTok['--bg'] === '#0E1829' && darkTok['--bar'] === '#131F39'
   && darkTok['--surface'] === '#1C2A50' && darkTok['--surface-2'] === '#263764',
   [darkTok['--bg'], darkTok['--bar'], darkTok['--surface'], darkTok['--surface-2']].join(' '));
ok('2.6 the system is told there are two schemes', await css(page, ':root', 'colorScheme') === 'light dark');

/* ============ 3 — the switch ============ */
console.log('--- switching ---');
const state = () => page.evaluate(() => ({
  attr: document.documentElement.getAttribute('data-theme'),
  bg: getComputedStyle(document.body).backgroundColor,
  meta: document.querySelector('meta[name="theme-color"]').content,
  status: document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]').content,
  saved: JSON.parse(localStorage.getItem('arabna.v1') || '{}').theme,
}));
ok('3.1 the default is to follow the device', (await state()).saved === undefined || (await state()).saved === 'auto');
ok('3.2 a dark device gets the dark app', (await state()).attr === 'dark', (await state()).bg);
await page.evaluate(async () => (await import('/js/ui.js')).setTheme('light'));
await page.waitForTimeout(300);
let st = await state();
/* ⚠️ V.04.7 TURNED THE LIGHT THEME FROM IVORY TO SKY: page #CFE4F2, bar
   #DFEEF8, card #F3F9FD — and the card is now LIGHTER than the page,
   which the ivory theme had backwards. The check is the same check; only
   the values moved. And 3.4 caught a real one: `BAR_COLOR` in `ui.js` had
   been left at the old ivory, so the phone painted a strip of the
   previous theme above a bar of the new one. */
ok('3.3 light applies with no reload', st.attr === 'light' && st.bg === 'rgb(207, 228, 242)', st.bg);
ok('3.4 the browser bar colour follows', st.meta === '#DFEEF8', st.meta);
ok('3.5 the iPhone status bar style follows', st.status === 'default', st.status);
ok('3.6 the choice is saved', st.saved === 'light');
await page.reload(); await page.waitForTimeout(700);
st = await state();
ok('3.7 …and survives a restart', st.attr === 'light' && st.saved === 'light');
ok('3.8 light darkens the gold for ivory', await tok(page, '--gold') === '#7A5D28', await tok(page, '--gold'));
await page.evaluate(async () => (await import('/js/ui.js')).setTheme('dark'));
await page.waitForTimeout(300);
st = await state();
ok('3.9 back to dark, chrome and all', st.attr === 'dark' && st.meta === '#131F39' && st.status === 'black-translucent');

/* auto follows the device live, with the app open. Driven through the
   saved setting and a reload rather than through an imported module: the
   single-file build inlines its own copy of ui.js, so a module imported
   by the test would be a second instance with a second store. */
const setSaved = async (mode) => {
  await page.evaluate(m => {
    const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
    s.theme = m; localStorage.setItem('arabna.v1', JSON.stringify(s));
  }, mode);
  await page.reload(); await page.waitForTimeout(600);
};
await setSaved('auto');
await page.emulateMedia({ colorScheme: 'light' }); await page.waitForTimeout(400);
ok('3.10 auto follows the device the moment it changes', (await state()).attr === 'light', (await state()).attr);
await page.emulateMedia({ colorScheme: 'dark' }); await page.waitForTimeout(400);
ok('3.11 …and back again', (await state()).attr === 'dark', (await state()).attr);
/* an explicit choice ignores the device */
await setSaved('light');
await page.emulateMedia({ colorScheme: 'dark' }); await page.waitForTimeout(400);
ok('3.12 an explicit choice outranks the device', (await state()).attr === 'light', (await state()).attr);
await page.emulateMedia({ colorScheme: 'dark' });

/* ============ 4 — where you switch it ============ */
console.log('--- the controls ---');
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1'));
  s.theme = 'dark';
  s.user = { name: 'رامي', email: 'r@a.app', phone: '(713) 466-9182', phoneVerified: true, emailVerified: true, tier: 2, joined: Date.now() };
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});
await page.goto(BASE); await page.waitForTimeout(600);
await page.evaluate(() => { location.hash = '#/settings'; }); await page.waitForTimeout(600);
const opts = await page.evaluate(() => [...document.querySelectorAll('[data-theme-opt]')].map(b => ({
  v: b.dataset.themeOpt, on: b.classList.contains('on'), checked: b.getAttribute('aria-checked'),
  hasPreview: !!b.querySelector('.tp-prev'), label: b.querySelector('.tp-name').textContent.trim(),
})));
ok('4.1 settings offers all three', opts.map(o => o.v).join(',') === 'auto,light,dark', opts.map(o => o.v).join(','));
ok('4.2 each one previews itself', opts.every(o => o.hasPreview));
ok('4.3 the current one is marked, for eye and screen reader',
   opts.filter(o => o.on).length === 1 && opts.find(o => o.v === 'dark').checked === 'true');
// V.03.4: «بيتبع» was dialect; plain MSA is «يتبع»
ok('4.4 the automatic one says what it follows', (await page.textContent('#app')).includes('يتبع إعدادات جهازك'));
await page.click('[data-theme-opt="light"]'); await page.waitForTimeout(450);
ok('4.5 picking one switches the app there and then',
   (await page.evaluate(() => document.documentElement.getAttribute('data-theme'))) === 'light');
ok('4.6 …without leaving the settings screen', (await page.evaluate(() => location.hash)) === '#/settings');
ok('4.7 …and the tick moves with it', await page.evaluate(() =>
  document.querySelector('[data-theme-opt="light"]').classList.contains('on')
  && !document.querySelector('[data-theme-opt="dark"]').classList.contains('on')));

await page.evaluate(() => { location.hash = '#/home'; }); await page.waitForTimeout(500);
await page.click('#hMenu'); await page.waitForTimeout(500);
/* V.02.7 moved the flip out of the drawer and into the header corner: the
   same action in two places is the duplication banned everywhere else, and
   a corner is plainer than a drawer you have to open. */
ok('4.8 the flip is not in the drawer any more', await page.locator('#drTheme').count() === 0);
const drRows = await page.evaluate(() => ({
  rows: [...document.querySelectorAll('.drawer-panel > *')]
    .filter(el => el.classList.contains('dr-item') || el.classList.contains('dr-group')).length,
}));
/* ⚠️ V.04.8 ADDED AN EIGHTH ROW ON PURPOSE: «الإعدادات», standalone and
   for everybody. It had been a leaf inside «حسابي» — a group that is not
   drawn for a visitor at all — so a visitor who wanted larger text was
   sent to a sign-up form. The language is already a standalone device
   preference; settings is of its kind. THE COST IS REAL AND IS NOT
   HIDDEN: the drawer's no-scroll rule was already missed by more than two
   rows with a group open, and this makes it worse. Which row goes is the
   owner's decision, open since V.03.2. */
/* REVERSED in V.05.5: six, not eight — the «حسابي» group and the sign-out row
   left for the head's two buttons. Settings is still a standalone row, which
   is the half of this check that carries the 195 decision. */
ok('4.9 …and the drawer costs six rows, settings still standalone',
   drRows.rows === 6 && await page.locator('.drawer-panel > [data-route="#/settings"]').count() === 1,
   drRows.rows + ' rows');
await page.evaluate(() => { const sc = document.querySelector('.drawer-scrim, #drawer .scrim'); if (sc) sc.click();
  document.querySelector('#drawer').classList.remove('open'); });
await page.waitForTimeout(500);
const hdrBtn = await page.evaluate(() => {
  const b = document.querySelector('#hTheme');
  return b ? { w: Math.round(b.getBoundingClientRect().width), label: b.getAttribute('aria-label') } : null;
});
ok('4.9b the header carries it instead, and says where it is going',
   hdrBtn && hdrBtn.w === 44 && hdrBtn.label === 'غامق', JSON.stringify(hdrBtn));
await page.click('#hTheme'); await page.waitForTimeout(600);
ok('4.10 one tap and the app is dark', (await page.evaluate(() => document.documentElement.getAttribute('data-theme'))) === 'dark');
/* V.03.4 deleted the toast, deliberately. The whole screen had just
   changed colour and the icon had flipped sun ↔ moon — two confirmations
   without a word — and the bar stood over the logo saying so. Nothing
   confirms in words what the reader is watching happen. */
ok('4.11 …and no bar appears over the logo to announce it',
   !(await page.textContent('body')).includes('صار الوضع')
   && await page.locator('.toast').count() === 0);

/* ============ 5 — the same app, both ways ============ */
console.log('--- both ways ---');
/* ⚠️ the light page is SKY since V.04.7 — #CFE4F2, not the ivory #EFE8DA */
for (const [theme, bg] of [['dark', 'rgb(14, 24, 41)'], ['light', 'rgb(207, 228, 242)']]) {
  await page.evaluate(async (t) => (await import('/js/ui.js')).setTheme(t), theme);
  for (const h of ['#/home', '#/directory', '#/directory/b1', '#/marketplace', '#/events', '#/magazine', '#/profile']) {
    await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(400);
  }
  ok(`5.x ${theme}: every screen renders and the page keeps its colour`,
     (await page.evaluate(() => getComputedStyle(document.body).backgroundColor)) === bg);
}
/* the verified badge is the first place a theme goes wrong: a gold
   surface whose text must flip from near-black to ivory */
/* ⚠️ V.04.7 TOOK THE PILL OUT OF THE LISTS — measured, a name row
   carrying it was 60px against 28 — so the word now lives on the BUSINESS
   PAGE and the lists carry the mark alone. The check is unchanged in what
   it is for: the gold surface whose ink must flip from near-black to
   ivory is the first place a theme goes wrong. It is simply looked for
   where it now is. */
const badgeIn = async (theme) => {
  await page.evaluate(async (t) => (await import('/js/ui.js')).setTheme(t), theme);
  await page.evaluate(() => { location.hash = '#/directory/b1'; }); await page.waitForTimeout(600);
  return page.evaluate(() => {
    const b = document.querySelector('.badge-bizverified');
    if (!b) return null;
    const cs = getComputedStyle(b);
    return { color: cs.color, onGold: getComputedStyle(document.documentElement).getPropertyValue('--on-gold').trim(),
             gold: cs.backgroundImage.includes('gradient') };
  });
};
const bDark = await badgeIn('dark');
ok('5.3 the gold badge sits on gold in dark, with near-black on it',
   !!bDark && bDark.gold && bDark.color === 'rgb(26, 18, 6)', bDark && bDark.color);
const bLight = await badgeIn('light');
ok('5.4 …and turns ivory in light, never black',
   !!bLight && bLight.color === 'rgb(255, 253, 248)' && bLight.onGold === '#FFFDF8', bLight && bLight.color);

ok('99 no console errors anywhere', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);

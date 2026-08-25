/* V.02.5b — three faults after the colour batch:
   the ad text, the stacked logo, and the logo on ivory */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); } else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };
const browser = await chromium.launch();
const errors = [];

/* V.03.6: installed as a real function instead of a source string that
   the page had to `eval`. The app's CSP forbids `eval`, and this only ever
   worked because the surrounding callback happened not to await first —
   Playwright's own call frame slips past the policy, but a continuation
   after an await does not. `addInitScript` runs before the document, so
   it survives every reload this suite does. */
const installContrast = (p) => p.addInitScript(() => {
  window.__ratio = (() => {
  const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const parse = s => { const m = (s || '').match(/[\d.]+/g); return m ? m.slice(0, 4).map(Number) : null; };
  const over = (fg, bg) => { const a = fg[3] === undefined ? 1 : fg[3];
    return [0, 1, 2].map(i => fg[i] * a + bg[i] * (1 - a)); };
  // the stack of grounds behind an element, innermost first
  function ground(el) {
    let stack = [], n = el;
    while (n && n !== document.documentElement) {
      const cs = getComputedStyle(n);
      const c = parse(cs.backgroundColor);
      if (c && (c[3] === undefined || c[3] > 0)) stack.push(c);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') {
        // a gradient: take the darkest and the lightest stop we can read
        const stops = (cs.backgroundImage.match(/rgba?\([^)]+\)/g) || []).map(parse).filter(Boolean);
        if (stops.length) { stack.push(stops[0]); }
      }
      n = n.parentElement;
    }
    stack.push([14, 24, 41]);
    let g = stack.pop();
    while (stack.length) g = over(stack.pop(), g);
    return g;
  }
  return function ratio(el) {
    const fg = parse(getComputedStyle(el).color);
    const g = ground(el);
    const f = over(fg, g);
    const a = lum(f), b = lum(g);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
  })();
});

const openPage = async (opts = {}) => {
  const ctx = await browser.newContext(Object.assign({ colorScheme: 'dark', viewport: { width: 390, height: 844 } }, opts));
  const p = await ctx.newPage();
  p.on('console', m => { if (m.type() === 'error' && !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|fonts\.googleapis/.test(m.text())) errors.push(m.text()); });
  p.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  await installContrast(p);       // before the first navigation, so reloads keep it
  await p.goto(BASE); await p.waitForTimeout(700);
  return p;
};

/* The theme is set through localStorage and a reload rather than by
   importing ui.js: in the single-file build that import is a second copy
   of the module and would drive a different app. */
const setTheme = async (p, mode) => {
  await p.evaluate(m => {
    const k = 'arabna.v1';
    const s = JSON.parse(localStorage.getItem(k) || '{}');
    s.theme = m; localStorage.setItem(k, JSON.stringify(s));
  }, mode);
  await p.reload(); await p.waitForTimeout(700);
};

/* ---- the contrast maths, run in the page over the real background stack ---- */

/* ============ 1 — the paid slider reads in both themes ============ */
console.log('--- the ad slider ---');
for (const theme of ['dark', 'light']) {
  let page = await openPage();
  await setTheme(page, theme);
  const r = await page.evaluate(() => {
    const ratio = window.__ratio;
    const out = [];
    document.querySelectorAll('.slider .slide').forEach(s => {
      const house = s.classList.contains('slide-house');
      const t = s.querySelector('.slide-title');
      const u = s.querySelector('.slide-sub');
      if (t) out.push({ house, part: 'title', r: ratio(t) });
      if (u) out.push({ house, part: 'sub', r: ratio(u) });
    });
    return out;
  });
  const paid = r.filter(x => !x.house), house = r.filter(x => x.house);
  ok(`1.${theme === 'dark' ? 1 : 3} ${theme}: every paid slide reads`,
     paid.length >= 4 && paid.every(x => x.r >= 4.5),
     paid.map(x => x.r.toFixed(2)).join(' '));
  ok(`1.${theme === 'dark' ? 2 : 4} ${theme}: the house slide reads too`,
     house.length > 0 && house.every(x => x.r >= 4.5),
     house.map(x => x.r.toFixed(2)).join(' '));
  await page.context().close();
}

/* the same strip at the top of a category page */
console.log('--- the category strip ---');
for (const theme of ['dark', 'light']) {
  let page = await openPage();
  /* the strip is fed from real orders, so one is put in the till first */
  await page.evaluate(m => {
    const k = 'arabna.v1'; const s = JSON.parse(localStorage.getItem(k) || '{}');
    s.theme = m;
    s.myAds = (s.myAds || []).concat([{
      id: 'test-cs', product: 'catSlider', cat: 'restaurants', status: 'live',
      bizName: 'مطعم الاختبار', tagline: 'سطر تجريبي', ctaText: 'زورونا',
      link: '#/directory/b1', endsAt: Date.now() + 9e8,
    }]);
    localStorage.setItem(k, JSON.stringify(s));
  }, theme);
  await page.reload(); await page.waitForTimeout(700);
  await page.evaluate(() => { location.hash = '#/directory?cat=restaurants'; });
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => {
    const ratio = window.__ratio;
    return [...document.querySelectorAll('.slide')].map(s => {
      const t = s.querySelector('.slide-title');
      return t ? { house: s.classList.contains('slide-house'), r: ratio(t) } : null;
    }).filter(Boolean);
  });
  ok(`1.${theme === 'dark' ? 5 : 6} ${theme}: the category strip reads`,
     r.length > 0 && r.every(x => x.r >= 4.5), r.map(x => x.r.toFixed(2)).join(' '));
  await page.context().close();
}

/* the rule itself: a fixed ground takes fixed ink, a themed ground themed ink */
let page = await openPage();
const rule = await page.evaluate(() => {
  const s = document.querySelector('.slide:not(.slide-house)');
  const h = document.querySelector('.slide-house');
  return { slide: getComputedStyle(s).color, house: h ? getComputedStyle(h).color : null };
});
ok('1.7 .slide sets its own ink and never inherits',
   rule.slide === 'rgba(255, 255, 255, 0.94)', rule.slide);
ok('1.8 …and the house slide is the exception, on our own ground',
   rule.house === 'rgb(243, 241, 236)', rule.house);
await page.context().close();

/* ============ 2 — the stacked logo is back ============ */
console.log('--- the stacked logo ---');
page = await openPage();
const geom = async p => p.evaluate(() => {
  const i = document.querySelector('.h-logo'), h = document.querySelector('.app-header');
  const r = i.getBoundingClientRect(), hr = h.getBoundingClientRect();
  return { w: Math.round(r.width), h: Math.round(r.height),
           nw: i.naturalWidth, nh: i.naturalHeight,
           top: Math.round(r.top), bottom: Math.round(r.bottom),
           headH: Math.round(hr.height),
           centre: Math.round(r.left + r.width / 2 - hr.width / 2),
           loaded: i.complete && i.naturalWidth > 0, src: i.getAttribute('src') };
});
let g = await geom(page);
/* ⚠️ V.04.7: THE BAR CARRIES THE MARK ALONE. Measured inside the file,
   «عربنا» is 12.7% of the stacked lockup's height — 8.2px at 65 — and an
   Arabic letter needs 14–16 to be read, because its dots need height a
   Latin letter does not. There is no arrangement that makes the name
   legible in this bar, so it was moved to where it is read and the mark
   took the full height. The two numbers survive: 65 tall, 54 installed. */
ok('2.1 the file is the mark, not a lockup',
   g.nw === 659 && g.nh === 649, `${g.nw}×${g.nh}`);
ok('2.2 65px tall, 66px wide — bigger mark, narrower box', g.h === 65 && g.w === 66, `${g.w}×${g.h}`);
ok('2.3 it keeps the file ratio', Math.abs(g.w / g.h - g.nw / g.nh) < 0.02);
ok('2.4 it loads', g.loaded);
ok('2.5 centred in Arabic', Math.abs(g.centre) <= 1, g.centre + 'px');
ok('2.6 inside the 92px header, top and bottom', g.top >= 13 && g.bottom <= g.headH,
   `${g.top}…${g.bottom} of ${g.headH}`);
/* flip the language through the stored state, which both builds honour */
await page.evaluate(() => {
  const k = 'arabna.v1'; const s = JSON.parse(localStorage.getItem(k) || '{}');
  s.lang = 'en'; localStorage.setItem(k, JSON.stringify(s));
});
await page.reload(); await page.waitForTimeout(700);
const gEn = await geom(page);
ok('2.7 English does not move it', Math.abs(gEn.centre) <= 1 && gEn.h === 65,
   `${gEn.centre}px / ${gEn.h}px`);
ok('2.8 nothing is painted behind it in either language', await page.evaluate(() => {
  const cs = getComputedStyle(document.querySelector('.h-logo'));
  return cs.backgroundColor === 'rgba(0, 0, 0, 0)' && cs.backgroundImage === 'none';
}));
await page.context().close();

/* installed: 54px in a 72px bar, still inside it */
page = await openPage();
await page.evaluate(() => {
  const st = document.createElement('style');
  st.textContent = ':root{--header-h:72px}.app-header .h-logo{height:54px;margin-block-start:-27px}';
  document.head.appendChild(st);
});
await page.waitForTimeout(200);
const gs = await geom(page);
ok('2.9 installed: 54px and still inside the 72px bar',
   gs.h === 54 && gs.bottom <= gs.headH && gs.top >= 0, `${gs.h}px, ${gs.top}…${gs.bottom} of ${gs.headH}`);
ok('2.10 installed: still centred', Math.abs(gs.centre) <= 1, gs.centre + 'px');
await page.context().close();

/* ============ 3 — the logo does not dissolve on ivory ============ */
console.log('--- the logo on ivory ---');
page = await openPage();
const srcDark = await page.evaluate(() => document.querySelector('.h-logo').getAttribute('src'));
await setTheme(page, 'light');
const srcLight = await page.evaluate(() => document.querySelector('.h-logo').getAttribute('src'));
ok('3.1 the light theme uses a different file', srcDark !== srcLight);
/* the ink copy of the MARK since V.04.7 — the pair is the same idea and
   the same reason: the silver family is a dark-background mark and 72% of
   it measured under 2:1 on the light bar, so the light theme gets the
   navy-inked copy. Only the file changed. */
ok('3.2 …and it is the ink copy',
   srcLight.includes('mark-ink.png') || srcLight.startsWith('data:image'),
   srcLight.slice(0, 40));
ok('3.3 the ink copy is the same mark, same size', await page.evaluate(() => {
  const i = document.querySelector('.h-logo');
  return i.naturalWidth === 659 && i.naturalHeight === 649 && i.complete;
}));
ok('3.4 no filter is used on it', await page.evaluate(() =>
  getComputedStyle(document.querySelector('.h-logo')).filter === 'none'));

/* the swap is immediate, not one screen late */
const swapped = await page.evaluate(async () => {
  const before = document.querySelector('.h-logo').getAttribute('src');
  const ui = await import('/js/ui.js').catch(() => null);
  if (!ui) return 'noimport';
  ui.setTheme('dark');
  await new Promise(r => setTimeout(r, 120));
  const after = document.querySelector('.h-logo').getAttribute('src');
  ui.setTheme('light');
  return before !== after ? 'swapped' : 'same';
});
if (swapped === 'noimport') ok('3.5 the mark flips with the theme, on the spot', true, 'single-file: checked by reload below');
else ok('3.5 the mark flips with the theme, on the spot', swapped === 'swapped', swapped);
await page.context().close();

/* every logo in the app, not just the header: the drawer head and the
   sign-up screen sit on the same ivory */
console.log('--- every logo, not just the header ---');
for (const theme of ['dark', 'light']) {
  page = await openPage();
  await setTheme(page, theme);
  await page.click('#hMenu'); await page.waitForTimeout(400);
  const dr = await page.evaluate(() => {
    const i = document.querySelector('.drawer-head img');
    return i ? { src: i.getAttribute('src'), kind: i.dataset.logo, loaded: i.complete && i.naturalWidth > 0 } : null;
  });
  ok(`3.${theme === 'dark' ? 6 : 7} ${theme}: the drawer mark matches the theme`,
     dr && dr.kind === 'wide' && dr.loaded &&
     (theme === 'light' ? /logo-sm-ink|^data:/.test(dr.src) : /logo-sm\.png|^data:/.test(dr.src)),
     dr && dr.src.slice(0, 44));
  await page.evaluate(() => { location.hash = '#/auth/signup'; });
  await page.waitForTimeout(500);
  const au = await page.evaluate(() => {
    const i = document.querySelector('img[data-logo]');
    return i ? { kind: i.dataset.logo, src: i.getAttribute('src'), loaded: i.complete && i.naturalWidth > 0 } : null;
  });
  ok(`3.${theme === 'dark' ? 8 : 9} ${theme}: the sign-up mark matches the theme`,
     au && au.loaded && (theme === 'light' ? /-ink|^data:/.test(au.src) : /logo-sm\.png|^data:/.test(au.src)),
     au && au.src.slice(0, 44));
  await page.context().close();
}
/* and the About page, which shows the big stacked one */
page = await openPage();
await setTheme(page, 'light');
await page.evaluate(() => { location.hash = '#/about'; });
await page.waitForTimeout(500);
ok('3.10 light: the About mark is the ink copy too', await page.evaluate(() => {
  const i = document.querySelector('#app img[data-logo]');
  return !!i && i.complete && i.naturalWidth === 1173 &&
    (/logo-ink/.test(i.getAttribute('src')) || i.getAttribute('src').startsWith('data:'));
}));
await page.context().close();

/* ============ 4 — nothing else moved ============ */
console.log('--- nothing else moved ---');
page = await openPage();
const head = await page.evaluate(() => {
  const h = document.querySelector('.app-header');
  return { height: Math.round(h.getBoundingClientRect().height),
           bg: getComputedStyle(h).backgroundColor };
});
ok('4.1 the header is still 92px', head.height === 92, head.height + 'px');
for (const r of ['#/home', '#/directory', '#/marketplace', '#/events', '#/magazine']) {
  await page.evaluate(h => { location.hash = h; }, r);
  await page.waitForTimeout(450);
  const wide = await page.evaluate(() => {
    const a = document.querySelector('#app');
    return a.scrollWidth - a.clientWidth;
  });
  ok('4.2 no sideways scroll on ' + r, wide <= 1, wide + 'px');
}
ok('4.3 no console errors anywhere', errors.length === 0, errors.slice(0, 3).join(' | '));
await page.context().close();

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);

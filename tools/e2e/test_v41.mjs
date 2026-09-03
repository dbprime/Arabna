/* V.04.8 — device preferences are not account property.

   Two reports, one cause.

   · «My phone is on light and the app opens dark.» Not a fault — it was
     written that way: the header button's two outcomes were `light` and
     `dark`, and «auto» was not one of them. So ONE TAP on the plainest
     control on the screen took the reader out of following their own
     device for good, with no word, no change in the icon, and no way back
     except a settings screen. The button now resumes following when the
     direction of the tap is the one the device already says.

   · The settings screen was behind `memberOnly`, so a visitor asking for
     larger text was sent to a sign-up form. ⚠️ Our oldest readers need the
     large text first and sign up last: somebody who cannot read the screen
     is not persuaded to register in order to make it bigger. They close
     the app.

   The rule underneath both: THE LANGUAGE, THE APPEARANCE, THE TEXT SIZE
   AND THE MAPS APP ARE DEVICE PREFERENCES. Nothing about them reaches a
   server, nothing follows the reader to another phone, and there is no
   identity to ask for in exchange. What genuinely belongs to an account
   stays behind `isLoggedIn()`. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); } else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const browser = await chromium.launch();
const errors = [];
let ctx, page;

const MEMBER = { user: { name: 'أحمد', email: 'a@b.c', emailVerified: true,
  phoneVerified: true, phone: '7134669182', joined: 1700000000000 } };

const asReader = async (state = {}, device = 'light') => {
  if (ctx) await ctx.close();
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: device });
  await ctx.addInitScript(s => localStorage.setItem('arabna.v1', JSON.stringify(s)), state);
  page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|ERR_NAME|ERR_FAILED|ERR_ABORTED|fonts\.googleapis/.test(m.text())) errors.push(m.text().slice(0, 120)); });
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message.slice(0, 120)));
};
const at = async (h) => { await page.goto(BASE + h, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1100); };

/* ---------------- 1 · the drawer ---------------- */
console.log('--- 1 · a standalone row, for everybody ---');
await asReader({});
await at('#/home');
await page.click('#hMenu'); await page.waitForTimeout(400);
const drawer = await page.evaluate(() => {
  const kids = [...document.querySelectorAll('.drawer-panel > *')];
  return {
    iLang: kids.findIndex(e => e.id === 'drLang'),
    iSet: kids.findIndex(e => e.getAttribute('data-route') === '#/settings'),
    count: document.querySelectorAll('.drawer-panel [data-route="#/settings"]').length,
    accountGroup: !!document.querySelector('[data-group="account"]'),
  };
});
ok('1.1 the visitor has a settings row at all', drawer.iSet >= 0);
/* Not taste: the language is a device preference and is already a
   standalone row for everybody, so settings is of its kind — and the two
   together make device preferences one block at the top of the drawer,
   before anything belonging to an account. */
ok('1.2 …directly under «اللغة»', drawer.iSet === drawer.iLang + 1, `lang ${drawer.iLang}, settings ${drawer.iSet}`);
/* ⚠️ The «حسابي» group is not drawn for a visitor AT ALL — which is why
   burying settings inside it was the fault itself and not merely a
   placement. No empty group, and no arrow opening onto nothing. */
ok('1.3 …and no «حسابي» group is drawn for a visitor', !drawer.accountGroup);
ok('1.4 exactly one settings row', drawer.count === 1, String(drawer.count));

await asReader(MEMBER);
await at('#/home');
await page.click('#hMenu'); await page.waitForTimeout(400);
/* REVERSED in V.05.5: there is no «حسابي» GROUP to open any more — this line
   was `click('[data-toggle="account"]')` and, with the group deleted, it
   waited thirty seconds and CRASHED the suite rather than failing one item.
   The six rows are the account hub on #/profile now, reached from the button
   in the drawer's head. Both halves of what 195 bought are still checked:
   settings is one row and it is not buried, and the six are still reachable
   — they are simply reachable from the hub. */
ok('1.5 a member has one too, and exactly one',
  await page.evaluate(() => document.querySelectorAll('.drawer-panel [data-route="#/settings"]').length === 1));
ok('1.5b …and the head carries «حسابي» in place of the group',
  await page.evaluate(() => !!document.querySelector('.dr-head-acts [data-route="#/profile"]')
                         && !document.querySelector('[data-group="account"]')));
await page.evaluate(() => { location.hash = '#/profile'; }); await page.waitForTimeout(700);
ok('1.6 …and all six account rows are intact, on the hub', await page.evaluate(() =>
  ['#/my-business', '#/my-ads', '#/my-reviews', '#/messages', '#/saved', '#/subscribe']
    .every(r => !!document.querySelector(`#app [data-route="${r}"]`))));

/* ---------------- 2 · the screen opens for a visitor ---------------- */
console.log('--- 2 · the screen ---');
await asReader({});
await at('#/settings');
ok('2.1 no redirect to sign-up', await page.evaluate(() => location.hash) === '#/settings',
  await page.evaluate(() => location.hash));
const visitor = await page.evaluate(() => ({
  groups: [...document.querySelectorAll('#app .dr-group-label')].map(e => e.textContent.trim()),
  lang: !!document.querySelector('#langBtn'),
  theme: document.querySelectorAll('[data-theme-opt]').length,
  font: document.querySelectorAll('[data-font]').length,
  maps: !!document.querySelector('#mapsPref'),
  /* and none of the six that really need an account */
  notif: document.querySelectorAll('.switch').length,
  card: !!document.querySelector('#addCard'),
  sub: !!document.querySelector('[data-route="#/subscribe"], [data-route="#/my-subscription"]'),
  receipts: !!document.querySelector('[data-route="#/receipts"]'),
  blocked: !!document.querySelector('[data-route="#/blocked"]'),
  del: !!document.querySelector('#delAcc'),
  signup: !!document.querySelector('#app [data-route="#/auth/signup"]'),
  overflow: document.documentElement.scrollWidth > 390,
}));
ok('2.2 language · appearance · text size · maps', visitor.lang && visitor.theme === 3
  && visitor.font === 4 && visitor.maps, visitor.groups.join(' · '));
ok('2.3 and NOT notifications, payment, subscription, receipts, blocked or deletion',
  !visitor.notif && !visitor.card && !visitor.sub && !visitor.receipts && !visitor.blocked && !visitor.del);
/* never a blank where six sections used to be */
ok('2.4 the visitor is told what an account adds', visitor.signup);
/* ⚠️ WHAT 2.5 DOES NOT COVER, WRITTEN HERE SO NOBODY ASSUMES IT DOES.
   `.app-main` carries `overflow-x: hidden`, so the PAGE never scrolls
   sideways whatever happens inside it — this condition cannot go red on a
   clipped element, and it stood green over a «إنشاء الحساب» button that was
   16px outside the frame, in both languages and on all four widths. It is
   kept because what it guards is still true and worth guarding; what was
   learnt is that IT IS NOT ENOUGH ALONE, and 2.5b is the half it missed. */
ok('2.5 no sideways scroll at 390', !visitor.overflow);

/* ⚠️ THE BOX, NOT THE PAGE. `documentElement.scrollWidth` is the measure
   that hid this fault and is never used for overflow in this app.
   ⚠️ And a horizontal scroller is excluded BY ITS COMPUTED STYLE, never by
   a written list of selectors — the photo strip, «مميّز هذا الأسبوع» and the
   sliders are meant to run past the edge, and a list of names goes stale
   the first time one is added. */
const clipProbe = () => {
  const main = document.querySelector('.app-main');
  const m = main.getBoundingClientRect();
  return Array.from(main.querySelectorAll('*')).filter((el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ov = getComputedStyle(p).overflowX;
      if (ov === 'auto' || ov === 'scroll') return false;
    }
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    return r.left < m.left - 0.5 || r.right > m.right + 0.5;
  }).map((el) => {
    const r = el.getBoundingClientRect();
    return (el.tagName + '.' + (el.className || '')).slice(0, 46)
      + ' [' + Math.round(r.left - m.left) + ' … ' + Math.round(r.right - m.left) + ']';
  });
};
for (const w of [390, 768, 900, 1280]) {
  await page.setViewportSize({ width: w, height: 844 });
  await page.waitForTimeout(150);
  const clipped = await page.evaluate(clipProbe);
  ok('2.5b nothing is clipped by .app-main at ' + w, clipped.length === 0,
     clipped.slice(0, 3).join(' | ') || '0 clipped');
}
await page.setViewportSize({ width: 390, height: 844 });

/* ⚠️ THE POINT OF THE WHOLE ITEM: it has to work, not merely render. */
await page.evaluate(() => document.querySelectorAll('[data-font]')[3].click());
await page.waitForTimeout(400);
const big = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
await at('#/settings');
const kept = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
ok('2.6 a visitor can enlarge the text', parseFloat(big) > 17, big);
ok('2.7 …and it survives closing the app', kept === big, kept);

/* the guard: the account block is not drawn, so nothing may reach for it */
for (let i = 0; i < 5; i++) { await at('#/settings'); await at('#/home'); }
ok('2.8 five round trips, zero console errors', errors.length === 0, errors.slice(0, 2).join(' | '));

await asReader(MEMBER);
await at('#/settings');
const m = await page.evaluate(() => ({
  notif: document.querySelectorAll('.switch').length,
  card: !!document.querySelector('#addCard'),
  sub: !!document.querySelector('[data-route="#/subscribe"], [data-route="#/my-subscription"]'),
  receipts: !!document.querySelector('[data-route="#/receipts"]'),
  blocked: !!document.querySelector('[data-route="#/blocked"]'),
  del: !!document.querySelector('#delAcc'),
  maps: !!document.querySelector('#mapsPref'),
}));
ok('2.9 a member loses nothing', m.notif === 4 && m.card && m.sub && m.receipts
  && m.blocked && m.del && m.maps, JSON.stringify(m));

/* ---------------- 3 · the button finds its way back ---------------- */
console.log('--- 3 · one tap from «تلقائي», always ---');
for (const device of ['light', 'dark']) {
  const other = device === 'light' ? 'dark' : 'light';
  await asReader({}, device);
  await at('#/home');
  const read = () => page.evaluate(() => ({
    attr: document.documentElement.getAttribute('data-theme'),
    saved: (JSON.parse(localStorage.getItem('arabna.v1') || '{}')).theme,
  }));
  const a0 = await read();
  ok(`3.1 ${device} device, nothing chosen: auto`, a0.saved === 'auto' || a0.saved === undefined, JSON.stringify(a0));
  await page.click('#hTheme'); await page.waitForTimeout(400);
  const a1 = await read();
  ok(`3.2 …one tap pins ${other}`, a1.attr === other && a1.saved === other, JSON.stringify(a1));
  await page.click('#hTheme'); await page.waitForTimeout(400);
  const a2 = await read();
  /* ⚠️ THE ITEM: the second tap does not pin the device's own value — it
     lets go, so the reader is never more than one tap from following
     their phone again. */
  ok('3.3 …and the next tap gives the device back', a2.attr === device && a2.saved === 'auto',
    JSON.stringify(a2));
}

/* REVERSED in V.06.0, the owner's decision: the theme is not carried across a
   launch at all — `asReader` opens the app afresh, so a stored «فاتح»
   is cleared at boot and the device decides. Within one session the
   choice still holds; that is what 3.1–3.3 above measure. */
await asReader({ theme: 'light' }, 'dark');
await at('#/home');
ok('3.4 a stored choice does not survive a launch', await page.evaluate(() =>
  document.documentElement.getAttribute('data-theme') === 'dark'
  && JSON.parse(localStorage.getItem('arabna.v1')).theme === 'auto'));

/* and «auto» still follows the device live, with the app open */
await asReader({ theme: 'auto' }, 'light');
await at('#/home');
const beforeFlip = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
await page.emulateMedia({ colorScheme: 'dark' });
await page.waitForTimeout(500);
ok('3.5 «تلقائي» still follows the device while the app is open',
  beforeFlip === 'light' && await page.evaluate(() =>
    document.documentElement.getAttribute('data-theme') === 'dark'));

/* the icon is not asked to carry a third state */
await asReader({}, 'light');
await at('#/home');
const icons = [];
for (let i = 0; i < 3; i++) {
  icons.push(await page.evaluate(() => document.querySelector('#hTheme').innerHTML.length));
  await page.click('#hTheme'); await page.waitForTimeout(350);
}
ok('3.6 no third icon state — the sun stays a sun and the moon a moon',
  new Set(icons).size <= 2, icons.join(','));

ok('99 zero console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);

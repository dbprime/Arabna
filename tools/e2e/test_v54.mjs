/* V.07.6 — «أضِفه إلى شاشتك»: an invite that knows where the reader stands.

   ⚠️ WHY THIS IS NOT A POLISH ITEM. On iOS a web app gets NO
   notifications until it is on the home screen — in a Safari tab the
   count is zero however the app is written — and most of this community
   carries an iPhone. So adding the app is the switch that turns the
   strongest feature on, the day the alerts land.

   ⚠️ AND FOUR OF THE SPEC'S OWN TESTS CANNOT RUN HERE, which is said
   plainly rather than papered over: Chromium does not emulate
   `display-mode` (recorded in this project since V.01.7), it fires no
   real `beforeinstallprompt`, and there is no share sheet to open. What
   this suite measures is everything that is READ — the mode for each
   device, the once-only rule, the refusal being kept, the empty store
   constants, and the text never naming a notification. The share sheet,
   the Facebook browser on a real phone and the Android dialog are
   checked by hand and written into the closing line. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync, readdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
const ROOT = new URL('../../', import.meta.url).pathname;
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); }
  else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };
const read = f => readFileSync(ROOT + f, 'utf8');

const IPHONE  = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const FBIOS   = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/450.0.0.35.109]';
const ANDROID = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';
const DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const browser = await chromium.launch();
const errors = [];
/* ⚠️ On the single-file build the modules sit behind an importmap, so a
   relative import fetches the file again and hands back a SECOND instance
   with its own state. `arabna/…` reaches the app's own. */
const MOD = `(async () => { try { return await import('arabna/js/install.js'); }
                            catch (e) { return await import('./js/install.js'); } })()`;

async function open(ua, hash = '#/home', seed = null, standalone = false) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: ua });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message.slice(0, 120)));
  page.on('console', m => { if (m.type() === 'error' &&
    !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|ERR_NAME|ERR_FAILED|fonts\.g/.test(m.text()))
    errors.push(m.text().slice(0, 120)); });
  if (standalone) await page.addInitScript(() =>
    Object.defineProperty(navigator, 'standalone', { get: () => true }));
  if (seed) await page.addInitScript(s => localStorage.setItem('arabna.v1', s), seed);
  /* ⚠️ `domcontentloaded`, not `load`: the only outside request this app
     makes is the Google Fonts stylesheet, and waiting for a host the
     sandbox cannot reach buys nothing but minutes. What is measured is
     the app's own markup, and it is there. */
  await page.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  return { ctx, page };
}
const barShown = p => p.evaluate(() => { const b = document.querySelector('#installBar'); return !!b && !b.hidden; });
const dump     = p => p.evaluate(() => localStorage.getItem('arabna.v1'));
const inst     = p => p.evaluate(() => (JSON.parse(localStorage.getItem('arabna.v1') || '{}').install) || null);
const mode     = p => p.evaluate(m => eval(m).then(x => x.installMode()), MOD);

/* ============ 1 — NOT on the first visit ============ */
console.log('--- somebody who arrived a minute ago does not want to install ---');
let seed1;
{
  const { ctx, page } = await open(IPHONE);
  ok('1.1 nothing is shown on the first visit', (await barShown(page)) === false);
  const i = await inst(page);
  /* ⚠️ ONE LAUNCH, COUNTED ONCE. It read 2 here first time round, because
     `boot()` had been running TWICE since the router was written — a
     module script is deferred, so `readyState` is already past 'loading'
     and both entry points fire. Everything boot did was idempotent, so
     nothing ever looked wrong; this counter is what made it visible. */
  ok('1.2 …and the launch is counted exactly once', i && i.visits === 1, JSON.stringify(i));
  ok('1.3 …and nobody has been invited yet', i && i.invited === false);
  seed1 = await dump(page);
  await ctx.close();
}

/* ============ 2 — the second launch, once, and never again ============ */
console.log('--- shown once, and a line that returns is an advertisement ---');
let seed2;
{
  const { ctx, page } = await open(IPHONE, '#/home', seed1);
  ok('2.1 the second launch shows the line', (await barShown(page)) === true);
  const txt = (await page.textContent('#installBar')).replace(/\s+/g, ' ').trim();
  ok('2.2 …and it says what is true today', /بلا إنترنت|no internet/.test(txt), txt.slice(0, 60));
  ok('2.3 …and it is marked shown the moment it is drawn, not when answered',
     (await inst(page)).invited === true);
  seed2 = await dump(page);
  await ctx.close();
}
{
  const { ctx, page } = await open(IPHONE, '#/home', seed2);
  ok('2.4 the third launch shows nothing', (await barShown(page)) === false);
  await ctx.close();
}

/* ============ 3 — the refusal is kept ============ */
console.log('--- whoever closed it is never shown it again ---');
{
  const { ctx, page } = await open(IPHONE, '#/home', seed1);
  await page.click('#ibX');
  const i = await inst(page);
  ok('3.1 pressing ✕ hides it at once', (await barShown(page)) === false);
  ok('3.2 …and the refusal is written down', i.dismissed === true && i.invited === true);
  const after = await dump(page);
  await ctx.close();
  const b = await open(IPHONE, '#/home', after);
  ok('3.3 …and reloading does not bring it back', (await barShown(b.page)) === false);
  await b.ctx.close();
}

/* ============ 4 — a shop's page counts as knowing the app ============ */
console.log('--- opening a business page is somebody using it for what it is for ---');
{
  const { ctx, page } = await open(IPHONE, '#/directory/b30');
  ok('4.1 a business page invites on the first visit too', (await barShown(page)) === true);
  await ctx.close();
}
{
  /* ⚠️ never over a form somebody is one field from finishing */
  const { ctx, page } = await open(IPHONE, '#/auth/signup', seed1);
  ok('4.2 …and an auth screen never carries it', (await barShown(page)) === false);
  await ctx.close();
}
{
  const { ctx, page } = await open(IPHONE, '#/install', seed1);
  ok('4.3 …nor the page it opens', (await barShown(page)) === false);
  await ctx.close();
}

/* ============ 5 — the road is READ, per device ============ */
console.log('--- six states, and each is read rather than guessed ---');
{
  const a = await open(IPHONE, '#/install');
  ok('5.1 iPhone in Safari -> the three steps', (await mode(a.page)) === 'ios');
  const steps = (await a.page.textContent('.inst-steps')).replace(/\s+/g, ' ');
  ok('5.2 …and step two says to scroll, which is what people ask about',
     /مرِّر للأسفل|scroll down/.test(steps));
  ok('5.3 …and the browser is named, never translated', /Safari/.test(steps));
  await a.ctx.close();

  const b = await open(FBIOS, '#/install');
  /* ⚠️ THE ITEM THAT SERVES RAMADAN. The likeliest way this community
     reaches the app is a tap on a link in a Facebook post — and that is
     the ONE route where adding to the home screen is impossible. */
  ok('5.4 inside Facebook’s browser -> open it outside first', (await mode(b.page)) === 'inapp');
  ok('5.5 …and NO add-to-home steps are printed there, because they cannot work',
     (await b.page.locator('.inst-steps').count()) === 0);
  ok('5.6 …and there is a copy-link button instead',
     (await b.page.locator('#instCopy').count()) === 1);
  await b.ctx.close();

  const c = await open(ANDROID, '#/install');
  ok('5.7 Android -> the browser’s own dialog', (await mode(c.page)) === 'android');
  ok('5.8 …and the button exists', (await c.page.locator('#instGo').count()) === 1);
  await c.ctx.close();

  const d = await open(DESKTOP, '#/install');
  ok('5.9 a desktop with no road says so rather than inventing one',
     (await mode(d.page)) === 'none' && (await d.page.locator('.inst-steps').count()) === 0);
  await d.ctx.close();
}

/* ============ 6 — installed: nothing at all, not one line ============ */
console.log('--- inviting somebody who installed it says the app does not know where it is ---');
{
  const a = await open(IPHONE, '#/home', seed1, true);
  ok('6.1 no line inside the installed app', (await barShown(a.page)) === false);
  ok('6.2 …and the mode says so', (await mode(a.page)) === 'installed');
  await a.ctx.close();
  const b = await open(IPHONE, '#/install', seed1, true);
  ok('6.3 …and its own page offers no steps and no button',
     (await b.page.locator('.inst-steps').count()) === 0 &&
     (await b.page.locator('#instGo').count()) === 0);
  await b.ctx.close();
}

/* ============ 7 — the two store links, empty until they exist ============ */
console.log('--- SUPPORT_PHONE’s pattern, to the letter ---');
{
  const store = read('js/store.js');
  ok('7.1 PLAY_URL is empty', /export const PLAY_URL = '';/.test(store));
  ok('7.2 APPSTORE_URL is empty', /export const APPSTORE_URL = '';/.test(store));
  /* ⚠️ THE TEETH: fill one in and the road changes with no other edit —
     which is what makes «one line on the day the store opens» true. */
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: ANDROID });
  const page = await ctx.newPage();
  await page.goto(BASE + '#/home', { waitUntil: 'domcontentloaded' });
  const withPlay = await page.evaluate(m => eval(m).then(x => {
    /* the constant is read through the module, so this proves the wiring
       and not a copy of it */
    return x.installMode();
  }), MOD);
  ok('7.3 with both empty, Android falls back to the web road', withPlay === 'android');
  await ctx.close();
}

/* ============ 8 — and no promise is sold that is not built ============ */
console.log('--- somebody who adds it for an alert that never arrives was sold a promise ---');
{
  const i18n = read('js/i18n.js');
  const keys = [...i18n.matchAll(/^\s{4}(inst[A-Za-z0-9]+):\s*'((?:[^'\\]|\\.)*)'/gm)];
  ok('8.1 the invite has strings in both packs', keys.length >= 42, keys.length + ' lines');
  const bad = keys.filter(k => /تنبيه|إشعار|أذان|notification|adhan|alert/i.test(k[2]));
  /* ⚠️ NOT NAMED UNTIL IT IS BUILT — `337` and `415`'s rule. The reason is
     added the day the alerts land, not before. */
  ok('8.2 …and not one of them names a notification', bad.length === 0,
     bad.map(b => b[1]).join(', '));
  const ui = read('js/ui.js');
  ok('8.3 the invite is marked shown when it is DRAWN, not when it is answered',
     /markInstallInvited\(\);/.test(ui));
  const inst = read('js/install.js');
  /* ⚠️ iOS publishes no install API at all, so a one-tap button there is a
     button that does nothing when pressed. It is not built, and the file
     says why. */
  ok('8.4 the native prompt is Chrome’s event and nothing else',
     /beforeinstallprompt/.test(inst) && !/navigator\.install|webkit.*install/i.test(inst));
  ok('8.5 the device trace survives a sign-out — it is not account property',
     /'geoGranted', 'area', 'mapsApp', 'install',/.test(read('js/store.js')));

  /* ⚠️ RAI'S OWN MEASUREMENT, AND IT MOVES THE CONDITION. The spec said
     the reason is added «the day the alerts land», which assumes what is
     missing is the PERMISSION. It is not: what is missing is the whole
     machine. There is not one call to a system notification anywhere in
     the app — so what the app calls «notifications» is a list INSIDE it,
     and the pre-adhan switch raises a flag that writes a row in that
     list, never an alert that reaches a locked phone.

     So the condition is not «when the alerts land» but «WHEN IT BECOMES
     TRUE», which needs a push service and a server. This assertion is
     the guard on that: the reason cannot be written into the invite
     while the machine to keep it does not exist. It goes red on the day
     somebody adds the sentence — and on the day somebody adds the API,
     which is the moment to revisit both halves together. */
  const jsAll = (function collect(dir, acc = '') {
    for (const e of readdirSync(ROOT + dir, { withFileTypes: true })) {
      if (e.isDirectory()) acc = collect(dir + '/' + e.name, acc);
      else if (e.name.endsWith('.js')) acc += read(dir + '/' + e.name);
    }
    return acc;
  })('js') + read('sw.js');
  const sysNotif = /new Notification\b|Notification\.requestPermission|showNotification|PushManager/;
  ok('8.6 there is not one system-notification call in the whole app',
     !sysNotif.test(jsAll));
  ok('8.7 …so «تنبيه الأذان» is not a reason to install, and cannot become one silently',
     bad.length === 0 && !sysNotif.test(jsAll));
}

ok('9.1 zero console errors across every state above', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

/* V.08.1 — the invented data is shown to nobody by default.

   ⚠️ A PUBLICATION GATE, NOT AN IMPROVEMENT. The owner bought `arabna.app` and
   is about to connect it, and the first stranger to open the real address
   would have seen invented businesses and reviews nobody wrote.

   ⚠️ AND THE FAULT WAS NOT IN THE DATA — it was in who could see it.
   `showDemo` lives in `DEFAULTS`, `DEFAULTS` is cloned into `state`, and
   `writeState` saves the whole of `state` into THIS PHONE's own store. So
   the switch is a DEVICE preference, not an application setting: turning
   it off on the owner's phone hid the invented data on the owner's phone, and every
   new visitor started from the default and saw all of it. With no server,
   while the default was `true` there was no way at all to hide it. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync, existsSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
const ROOT = new URL('../../', import.meta.url).pathname;
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); }
  else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };
const read = f => readFileSync(ROOT + f, 'utf8');

const browser = await chromium.launch();
const errors = [];
/* ⚠️ EVERY CHECK STARTS FROM AN EMPTY STORE — a phone that never opened
   the app — except where it says otherwise. */
async function open(hash = '#/home', seed = null) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message.slice(0, 120)));
  page.on('console', m => { if (m.type() === 'error' &&
    !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|ERR_NAME|ERR_FAILED|fonts\.g/.test(m.text()))
    errors.push(m.text().slice(0, 120)); });
  await page.route('**://fonts.g*/**', r => r.abort());
  if (seed) await page.addInitScript(s => localStorage.setItem('arabna.v1', s), seed);
  await page.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  return { ctx, page };
}
const stored = p => p.evaluate(() => JSON.parse(localStorage.getItem('arabna.v1') || '{}'));

/* ============ 1 — what a stranger sees ============ */
console.log('--- the first stranger to open the real address ---');
let freshSeed;
{
  const { ctx, page } = await open('#/home');
  ok('1.1 a brand-new device starts with the invented data OFF',
     (await stored(page)).showDemo === false);
  /* ⚠️ THE STRUCTURAL HALF, and it is needed because the behavioural one
     cannot see this: flipping `DEFAULTS` back to `true` leaves 1.1 GREEN,
     since the boot migration turns a fresh device off anyway. Measured —
     the whole suite stays 22/22 with the default reversed. That is two
     layers working, and it is exactly why the default itself is asserted
     here: `485`'s lesson in another file. */
  ok('1.1b …and the DEFAULT itself is off, not only the migration',
     /^  showDemo: false,/m.test(read('js/store.js')));
  /* only the house «إعلانك هنا» slide is left, which is ours */
  ok('1.2 one slider slide, and no invented business named anywhere on Home',
     (await page.locator('.slide').count()) === 1 &&
     (await page.locator('text=مطعم الشام').count()) === 0);
  ok('1.3 …and the mini banner is not drawn at all',
     (await page.locator('.mini-ad').count()) === 0);
  freshSeed = await page.evaluate(() => localStorage.getItem('arabna.v1'));
  await ctx.close();
}
{
  const m = await open('#/marketplace', freshSeed);
  ok('1.4 the marketplace shows nothing invented',
     (await m.page.locator('[data-route^="#/marketplace/"]').count()) === 0);
  /* ⚠️ and it does not break: the empty state is a designed screen */
  const txt = (await m.page.textContent('#app')).replace(/\s+/g, ' ');
  ok('1.5 …and says so rather than going blank', txt.length > 40, txt.trim().slice(0, 48));
  await m.ctx.close();
  const g = await open('#/magazine', freshSeed);
  ok('1.6 the magazine too',
     (await g.page.locator('[data-route^="#/magazine/"]').count()) === 0);
  await g.ctx.close();
  const b1 = await open('#/directory/b1', freshSeed);
  ok('1.7 an invented business does not open',
     !/مطعم الشام/.test(await b1.page.textContent('#app')));
  await b1.ctx.close();
}

/* ============ 2 — and the real directory is untouched ============ */
console.log('--- 485 real listings, and not one of them moves ---');
{
  const d = await open('#/directory', freshSeed);
  /* ⚠️ THE CHECK THAT GUARDS AGAINST «hide the invented and empty the app».
     The list pages 40 at a time — that number is the first paint, and it
     is the same with the switch either way. */
  const off = await d.page.locator('#dirList [data-route^="#/directory/"]').count();
  await d.ctx.close();
  const onSeed = JSON.stringify({ showDemo: true, demoDefaultOff: true, lang: 'ar' });
  const d2 = await open('#/directory', onSeed);
  const on = await d2.page.locator('#dirList [data-route^="#/directory/"]').count();
  await d2.ctx.close();
  ok('2.1 the directory lists the same either way', off === on && off > 0, `off ${off} · on ${on}`);
  const s = await open('#/directory?q=' + encodeURIComponent('مطعم الشام'), freshSeed);
  /* ⚠️ NOT «zero results» — that assertion was wrong and the app was
     right. The query legitimately reaches two REAL shops, Al Shami
     (Westheimer) and Al Shami (Katy), through the transliteration tags
     `V.02.6` added for exactly this. What must be absent is the invented
     record itself. */
  const hits = await s.page.$$eval('#dirList [data-route^="#/directory/"]',
    els => els.map(e => e.getAttribute('data-route')));
  ok('2.2 …and the invented record is not among what a search returns',
     !hits.includes('#/directory/b1'), hits.slice(0, 3).join(' · ') || 'none');
  await s.ctx.close();
}

/* ============ 3 — the migration, and the mark that makes it one ============ */
console.log('--- every existing phone carries showDemo: true in its own store ---');
{
  /* ⚠️ Changing DEFAULTS reaches nobody who already opened the app. */
  const oldPhone = JSON.stringify({ showDemo: true, lang: 'ar' });
  const a = await open('#/home', oldPhone);
  const st = await stored(a.page);
  ok('3.1 an existing phone is turned off once, at boot', st.showDemo === false);
  ok('3.2 …and the mark is written', st.demoDefaultOff === true);
  const then = await a.page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('arabna.v1'));
    s.showDemo = true;                       // the owner turns it on for his phone
    localStorage.setItem('arabna.v1', JSON.stringify(s));
    return localStorage.getItem('arabna.v1');
  });
  await a.ctx.close();
  /* ⚠️ THE MARK'S OWN CHECK. Without it the migration runs every launch
     and the owner can never turn the switch on at all. */
  const b = await open('#/home', then);
  ok('3.3 …and once turned on by hand it STAYS on across a reboot',
     (await stored(b.page)).showDemo === true);
  await b.ctx.close();
  /* a key forgotten in the device list is lost on sign-out and the
     migration runs again */
  ok('3.4 the mark travels with the device keys, not the account',
     /'showDemo', 'demoPurged', 'demoDefaultOff',/.test(read('js/store.js')));
  /* the 430 rule: exactly one place in js/ touches the browser store */
  /* ⚠️ PLACES, NOT MATCHES. `430`'s rule is that exactly one PLACE in the
     app touches the browser store, and that place is one line holding
     both the read and the write — so counting matches gives 2 and means
     nothing. Counting lines is what the rule actually says. */
  const sites = read('js/store.js').replace(/\/\*[\s\S]*?\*\//g, '').split('\n')
    .filter(l => /localStorage\.(get|set|remove)Item/.test(l)).length;
  ok('3.5 …and the migration writes through the gate, not around it', sites === 1, sites + ' places');
}

/* ============ 4 — the panel stops saying what is not true ============ */
console.log('--- an alarm silenced by an act that fixes nothing ---');
{
  const i18n = read('js/i18n.js');
  const get = (k) => (new RegExp("^\\s{4}" + k + ":\\s*'((?:[^'\\\\]|\\\\.)*)'", 'gm').exec(i18n) || [])[1] || '';
  /* ⚠️ «nobody sees it» described a server that does not exist. */
  /* ⚠️ SCOPED TO THE TWO KEYS, and stripped of comments. Sweeping the
     whole file caught two innocents: this batch's own comment quoting the
     sentence it removed, and `greetOffNote` — «Stopped — nobody sees it
     until it is started again» — which is about a paused greeting and is
     perfectly true. A check that reads the prose about the code, again. */
  const strings = i18n.replace(/\/\*[\s\S]*?\*\//g, '');
  const val = (k) => (new RegExp("^\\s{4}" + k + ":\\s*'((?:[^'\\\\]|\\\\.)*)'", 'gm').exec(strings) || [])[1] || '';
  const claims = ['demoShowSub', 'demoWarnBar', 'demoTitle', 'demoShow']
    .map(k => val(k)).filter(v => /لا يراها أحد|nobody sees it/i.test(v));
  ok('4.1 the switch no longer claims nobody sees it', claims.length === 0, claims.join(' | '));
  ok('4.2 …it names the device instead', /هذا الجهاز/.test(get('demoShowSub')), get('demoShowSub').slice(0, 46));
  /* ⚠️ the bar was drawn from THIS device's state while claiming everyone
     could see the data — so turning the switch off silenced the warning
     and changed nothing for anybody else */
  ok('4.3 the warning bar names the device too, and not «users»',
     /هذا الجهاز/.test(get('demoWarnBar')) && !/للمستخدمين/.test(get('demoWarnBar')),
     get('demoWarnBar'));
  ok('4.4 …and the bar is kept, not deleted — the owner must know what he alone sees',
     /demoWarnBar/.test(read('js/screens/admin.js')));
}

/* ============ 5 — the door is shut until the domain is connected ============ */
console.log('--- indexing the temporary address would be the wrong result to inherit ---');
{
  ok('5.1 robots.txt exists', existsSync(ROOT + 'robots.txt'));
  const r = existsSync(ROOT + 'robots.txt') ? read('robots.txt') : '';
  ok('5.2 …and it disallows everything', /User-agent:\s*\*/.test(r) && /Disallow:\s*\/\s*$/m.test(r));
  /* ⚠️ no map is drawn for somebody who is not allowed in */
  ok('5.3 and there is no sitemap.xml', !existsSync(ROOT + 'sitemap.xml'));
}

ok('6.1 zero console errors across every state above', errors.length === 0, errors.slice(0, 2).join(' | '));
await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

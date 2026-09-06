/* V.07.0 — التهاني: one tool for every occasion.

   The owner asked for a button that puts a greeting in front of whoever opens
   the app, between two dates, and that he can use for anything.

   ⚠️ SO IT IS NOT «the Eid card». It is a GENERAL greeting: Eid al-Fitr,
   Eid al-Adha, the Hijri new year, Easter, Independence Day, a new
   section opening, the launch itself. No occasion is named in the code,
   and this suite asserts that too — the moment the interface says «العيد»
   the next occasion needs a second tool.

   And the two faults this batch had to measure rather than reason about:

   1. THE CARD CANNOT LIVE IN `#sheet`. `render()` calls `closeSheet()` as
      its first act on every navigation, the boot paint included, so a card
      opened where the file asked for it would be wiped before anybody saw
      it. Measured: a sheet opened where `catchUp()` stands is gone by the
      first paint. It has its own root.

   2. THE DAY KEY IS LOCAL, NEVER `toISOString()`. That call returns UTC, so
      a reader in Houston at 19:00 on the last day reads tomorrow's date
      there and the greeting vanishes five hours early. Item 5 is that
      exact case, and it fails on the naive implementation. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { mockSupabase } from './_supabase.mjs';

import { unlockAdmin } from './_admin.mjs';
const BASE = process.env.BASE || 'http://localhost:8099/index.html';
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); }
  else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const NOW = Date.now();
const PAY = '<img src=x onerror="window.__pwn=1">';
const ACCOUNT = {
  name: 'أحمد سالم', email: 'a@b.c', emailVerified: true,
  phone: '7134669182', phoneVerified: true, joined: NOW - 9e8,
};
/* ⚠️ THE DAY KEYS ARE BUILT IN THE BROWSER'S TIMEZONE, NOT THE
   CONTAINER'S — and this suite is the one that forces them apart: it sets
   `timezoneId: 'America/Chicago'` for the UTC check in block 5, while the
   runner's own clock is UTC. Measured, they can be a whole day apart:
   01:46 on the 30th in the container is 20:46 on the 29th in Chicago. So
   a greeting seeded «today» by the container was «tomorrow» to the app
   and was correctly not shown — the suite failed on its own arithmetic,
   not on the feature.
   ⚠️ It passed the day it was written because both sides were in the same
   date at that hour. A test that is right only between certain hours is
   the date twin of a flat `waitForTimeout`, and it is fixed the same way:
   measure what the app measures, never a number of your own. */
const TZ = 'America/Chicago';
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ });   // YYYY-MM-DD
const dayFrom = (n) => fmt.format(new Date(Date.now() + n * 864e5));
const TODAY = dayFrom(0), YESTERDAY = dayFrom(-1), TOMORROW = dayFrom(1);
const card = (over = {}) => Object.assign({
  id: 'g1', title: 'كل عام وأنتم بخير',
  body: 'من عربنا لكل العائلات العربية في Houston.',
  from: TODAY, to: TODAY, cta: null, off: false,
}, over);

const browser = await chromium.launch();
const errors = [];
const wire = p => {
  p.on('pageerror', e => errors.push('PAGEERROR ' + e.message.slice(0, 120)));
  p.on('console', m => { if (m.type() === 'error' &&
    !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|ERR_NAME|ERR_FAILED|fonts\.googleapis/.test(m.text()))
    errors.push(m.text().slice(0, 120)); });
};
/* the importmap rule: `arabna/…` reaches the app's OWN instance, where a
   relative path on the single-file build hands back a second copy */
const mount = p => p.evaluate(async () => {
  window.__S = await import('arabna/js/store.js').catch(() => import('./js/store.js'));
  window.__U = await import('arabna/js/ui.js').catch(() => import('./js/ui.js'));
});
const open = async (state, hash = '') => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 },
                                         timezoneId: 'America/Chicago' });
  /* 610: see tools/e2e/_supabase.mjs */
  await mockSupabase(ctx);
  /* ⚠️ SEEDED ONCE, NOT ON EVERY LOAD. `addInitScript` runs before every
     navigation, so seeding unconditionally would rewrite `seenGreetings`
     back to empty on the reload that item 1.7 depends on — and the suite
     would have reported the app failing to remember when it was the
     harness overwriting the memory. */
  await ctx.addInitScript(s => {
    if (!localStorage.getItem('arabna.v1')) localStorage.setItem('arabna.v1', JSON.stringify(s));
  }, state);
  const p = await ctx.newPage(); wire(p);
  await p.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1100); await mount(p);
  return { ctx, p };
};
const shown = p => p.evaluate(() => {
  const root = document.querySelector('#greet');
  const c = document.querySelector('.greet-card');
  return { open: !!root && root.classList.contains('open'),
           text: c ? c.textContent.replace(/\s+/g, ' ').trim() : '',
           width: c ? Math.round(c.getBoundingClientRect().width) : 0,
           logo: (document.querySelector('.greet-logo') || {}).getAttribute
                 ? document.querySelector('.greet-logo').getAttribute('src') : '' };
});

/* ============ 1 — a live greeting shows once, and only once ============ */
console.log('--- once per device ---');
{
  const { ctx, p } = await open({ lang: 'ar', greetings: [card()], seenGreetings: [] });
  const a = await shown(p);
  ok('1.1 a live greeting is there at the first launch', a.open, a.text.slice(0, 40));
  ok('1.2 …carrying the words that were written', /كل عام وأنتم بخير/.test(a.text));
  ok('1.3 …and the mark, as an image and not as type',
     /logo|data:image/.test(a.logo), a.logo.slice(0, 40));
  ok('1.4 the card is the width the design asked for', a.width === 275, String(a.width));

  await p.click('.greet-ok'); await p.waitForTimeout(500);
  ok('1.5 «شكراً» closes it', !(await shown(p)).open);
  ok('1.6 …and the device remembers having seen it',
     (await p.evaluate(() => JSON.parse(localStorage.getItem('arabna.v1')).seenGreetings)).includes('g1'));

  await p.reload(); await p.waitForTimeout(1100);
  ok('1.7 reopening the app does not show it again', !(await shown(p)).open);
  await ctx.close();
}

/* the scrim is the same ending as the button — a greeting dismissed by
   tapping outside must not come back on the next launch either */
{
  const { ctx, p } = await open({ lang: 'ar', greetings: [card()], seenGreetings: [] });
  /* the card sits on top of the scrim and is centred, so the tap has to
     land in a corner — the middle of the scrim IS the card */
  await p.click('.greet-scrim', { position: { x: 6, y: 6 } }); await p.waitForTimeout(400);
  await p.reload(); await p.waitForTimeout(1100);
  ok('1.8 closing on the scrim counts as seen too', !(await shown(p)).open);
  await ctx.close();
}

/* ============ 2 · 3 · 4 — the window, and the switch ============ */
console.log('--- the window ---');
{
  const { ctx, p } = await open({ lang: 'ar',
    greetings: [card({ from: dayFrom(-3), to: YESTERDAY })], seenGreetings: [] });
  ok('2.1 one that ended yesterday does not show — not even unseen', !(await shown(p)).open);
  await ctx.close();
}
{
  const { ctx, p } = await open({ lang: 'ar',
    greetings: [card({ from: TOMORROW, to: dayFrom(3) })], seenGreetings: [] });
  ok('3.1 one that starts tomorrow does not show', !(await shown(p)).open);
  await ctx.close();
}
{
  const { ctx, p } = await open({ lang: 'ar',
    greetings: [card({ off: true })], seenGreetings: [] });
  ok('4.1 «إيقاف» is immediate — inside its own dates it still does not show',
     !(await shown(p)).open);
  await ctx.close();
}

/* ============ 5 — 19:00 on the last day, which is the UTC check ============ */
console.log('--- the local day, not UTC ---');
{
  const { ctx, p } = await open({ lang: 'ar', greetings: [card()], seenGreetings: [] });
  /* 2027-03-22 19:00 in America/Chicago is 2027-03-23 00:00 UTC. A day key
     built from `toISOString()` reads the 23rd and the greeting whose last
     day is the 22nd disappears five hours early. */
  const r = await p.evaluate(() => {
    const S = window.__S;
    const ms = Date.UTC(2027, 2, 23, 0, 0, 0);          // = 19:00 local on the 22nd
    const local = S.todayKey(ms);
    const utc = new Date(ms).toISOString().slice(0, 10);
    S.state.greetings = [{ id: 'gz', title: 'x', body: 'y',
                           from: '2027-03-20', to: '2027-03-22', cta: null, off: false }];
    S.state.seenGreetings = [];
    return { local, utc, live: !!S.liveGreeting(local) };
  });
  ok('5.1 the day key is the LOCAL date', r.local === '2027-03-22', r.local);
  ok('5.2 …and it is not what toISOString would have said', r.utc === '2027-03-23', r.utc);
  ok('5.3 so at 19:00 on its last day the greeting is still live', r.live);
  await ctx.close();
}

/* ============ 6 — the text is a reader's, and is printed as text ============ */
console.log('--- esc() binds here too ---');
{
  const { ctx, p } = await open({ lang: 'ar',
    greetings: [card({ title: PAY, body: PAY })], seenGreetings: [] });
  const r = await p.evaluate(() => ({
    ran: window.__pwn === 1,
    node: !!document.querySelector('#greet img[src="x"]'),
    text: (document.querySelector('.greet-card') || { textContent: '' }).textContent.includes('<img src=x'),
  }));
  ok('6.1 the payload does not run', !r.ran);
  ok('6.2 …and never becomes part of the page', !r.node);
  ok('6.3 …it is printed letter for letter', r.text);
  await ctx.close();
}

/* ============ 7 — one live at a time, and the refusal names the other ============ */
console.log('--- the panel ---');
{
  const { ctx, p } = await open({ lang: 'ar', user: ACCOUNT,
    greetings: [card({ id: 'gA', title: 'الأولى', from: TODAY, to: dayFrom(4) })],
    seenGreetings: ['gA'] }, '#/admin');
  await unlockAdmin(p);
  await p.evaluate(() => { const x = document.querySelector('[data-t="set"]'); if (x) x.click(); });
  await p.waitForTimeout(700);

  ok('7.1 the settings tab lists them, with the state of each',
     /ظاهرة الآن/.test(await p.textContent('#aBody')));
  /* ⚠️ and no occasion is named anywhere in the interface — the tool is
     general, and «العيد» in a label is what turns it into one card */
  const words = await p.textContent('#aBody');
  ok('7.2 the tool names no occasion', !/العيد|رمضان مبارك|الفصح/.test(words.split('تواريخ رمضان')[0]));

  await p.click('#greetNew'); await p.waitForTimeout(600);
  await p.fill('#gTitle', 'الثانية'); await p.fill('#gBody', 'نص');
  await p.fill('#gFrom', dayFrom(2)); await p.fill('#gTo', dayFrom(6));
  await p.click('#gSave'); await p.waitForTimeout(500);
  const clash = (await p.textContent('#e_gTo') || '').trim();
  ok('7.3 an overlapping window is refused', clash.length > 0, clash);
  ok('7.4 …and the refusal names the greeting it collides with', /الأولى/.test(clash));
  ok('7.5 …under the field, never in a toast',
     await p.evaluate(() => !document.querySelector('#toast .toast')));
  ok('7.6 …and nothing was saved',
     await p.evaluate(() => window.__S.greetings().length) === 1);

  /* a window that does not overlap saves, and the sheet closes */
  await p.fill('#gFrom', dayFrom(9)); await p.fill('#gTo', dayFrom(11));
  await p.click('#gSave'); await p.waitForTimeout(700);
  ok('7.7 a clear window saves', await p.evaluate(() => window.__S.greetings().length) === 2);
  ok('7.8 …and it is recorded in the admin log',
     await p.evaluate(() => (window.__S.state.adminLog || []).some(r => /greet/.test(r.field))));
  await ctx.close();
}

/* the preview is the real card, drawn by the same function the launch uses */
{
  const { ctx, p } = await open({ lang: 'ar', user: ACCOUNT }, '#/admin');
  await unlockAdmin(p);
  await p.evaluate(() => { const x = document.querySelector('[data-t="set"]'); if (x) x.click(); });
  await p.waitForTimeout(700);
  await p.click('#greetNew'); await p.waitForTimeout(600);
  await p.fill('#gTitle', 'معاينة العنوان'); await p.fill('#gBody', 'معاينة النص');
  await p.click('#gPrev'); await p.waitForTimeout(600);
  const pv = await shown(p);
  ok('7.9 «معاينة» draws the card people will see', pv.open && /معاينة العنوان/.test(pv.text), pv.text.slice(0, 30));
  ok('7.10 …and it is not saved by previewing it',
     await p.evaluate(() => window.__S.greetings().length) === 0);
  await ctx.close();
}

/* ============ 8 — the mark follows the theme with the card open ============ */
console.log('--- the theme ---');
{
  const { ctx, p } = await open({ lang: 'ar', greetings: [card()], seenGreetings: [] });
  const before = (await shown(p)).logo;
  await p.evaluate(() => { window.__U.setTheme('dark'); });
  await p.waitForTimeout(400);
  const afterDark = (await shown(p)).logo;
  await p.evaluate(() => { window.__U.setTheme('light'); });
  await p.waitForTimeout(400);
  const afterLight = (await shown(p)).logo;
  ok('8.1 the card is still standing through the flip', (await shown(p)).open);
  /* ⚠️ the single-file build inlines every image as a data URI, so a
     filename cannot be asserted on both builds. What is true of both is
     that the two themes resolve to DIFFERENT bytes. */
  ok('8.2 the mark is a different file in the other theme', afterDark !== afterLight,
     String(afterDark).slice(0, 24) + ' vs ' + String(afterLight).slice(0, 24));
  ok('8.3 …and it comes back to what it was', afterLight === before);
  await ctx.close();
}

/* ============ 9 — everybody sees it, except mid sign-up ============ */
console.log('--- who sees it ---');
{
  const { ctx, p } = await open({ lang: 'ar', user: null, greetings: [card()], seenGreetings: [] });
  ok('9.1 a visitor with no account sees it — it is not an account feature',
     (await shown(p)).open);
  ok('9.2 …and it is not gated behind a tier',
     await p.evaluate(() => window.__S.tier()) === 0);
  await ctx.close();
}
{
  /* a sign-up stopped one step from finished resumes on the code screen,
     and a card over it costs somebody a step they were about to finish */
  const { ctx, p } = await open({ lang: 'ar',
    user: { name: 'ر', email: 'a@b.c', emailVerified: false, phone: '', joined: NOW },
    pendingVerify: { kind: 'email', at: NOW, code: '123456' },
    greetings: [card()], seenGreetings: [] });
  ok('9.3 it does not open over the code screen',
     (await p.evaluate(() => location.hash)) === '#/auth/email' && !(await shown(p)).open,
     await p.evaluate(() => location.hash));
  ok('9.4 …and it is postponed, not cancelled — it was not marked seen',
     !(await p.evaluate(() => JSON.parse(localStorage.getItem('arabna.v1')).seenGreetings)).includes('g1'));
  await ctx.close();
}

/* ============ 10 — `seenGreetings` is the device's, not the person's ==== */
console.log('--- the device, not the account ---');
{
  const { ctx, p } = await open({ lang: 'ar', user: ACCOUNT,
    greetings: [card()], seenGreetings: ['g1'] });
  const r = await p.evaluate(async () => {
    const S = window.__S;
    const inExport = /seenGreetings/.test(S.exportMyData());
    /* 610: it ends the server session first, so it is awaited */
    await S.signOut();
    return { inExport,
             keptOnSignOut: (S.state.seenGreetings || []).includes('g1'),
             greetingsKept: S.greetings().length };
  });
  ok('10.1 it is not in the reader\'s copy of their data — it is a device trace', !r.inExport);
  ok('10.2 …and the panel\'s greetings survive a sign-out', r.greetingsKept === 1);
  ok('10.3 …while the device\'s own seen-marks are the account\'s to lose',
     r.keptOnSignOut === false);
  await ctx.close();
}

console.log(errors.length ? 'CONSOLE ERRORS: ' + errors.slice(0, 4).join(' | ') : 'no console errors');
ok('11.1 zero console errors across every launch', errors.length === 0, String(errors.length));

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

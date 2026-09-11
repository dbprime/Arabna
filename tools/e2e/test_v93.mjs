/* ============================================================
   test_v93 — 680: a checkbox that flips on a scroll-touch
   ------------------------------------------------------------
   ⚠️ THE FAULT HAPPENED, it was not reasoned about. On 11 September the
   owner added an event from the panel, never touched «فعالية مميزة», and the
   event went out FEATURED — the $99 weekly pin, given away by a finger
   passing over a row on the way down a form two screens long.

   Measured on the tree before a line was changed:

       label.setting-row in js/          5, and two of them are the
                                         SIGNUP CONSENTS — a legal claim
       the consent label                 362px wide inside a 362px content box
       the age-18 consent                362px of hit area over 165.9px of
                                         glyphs — 166px, 46% of the row,
                                         answering a tap with nothing under it
       a tap 6px inside the row's edge   false -> true   *** the fault ***

   ⚠️ AND THE SPEC'S OWN CHECK 2.1 IS TOOTHLESS AS WRITTEN, which is why
   this file does not implement it literally. It asks for
   `label.offsetWidth < parent.clientWidth` — and `clientWidth` INCLUDES
   PADDING. The parent is 390 wide with 14px each side, so clientWidth is
   390 and the full-width label is 362: **362 < 390 is true before the fix
   and true after.** A check that passes with the fault present is worse
   than no check. What is measured here is the parent's CONTENT box.

   TWO LAYERS, standing beside each other rather than instead: block 1
   reads the code (a rendering check cannot see the pattern come back in a
   screen written next month), blocks 2–4 read the screen.
   ============================================================ */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';
import { mockSupabase, MOCK_CODE } from './_supabase.mjs';
import { unlockAdmin } from './_admin.mjs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
const ROOT = new URL('../../', import.meta.url).pathname;
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); }
  else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const read = f => readFileSync(ROOT + f, 'utf8');
/* ⚠️ comments stripped before any «does the code do X» check — the rule
   this project has now paid for six times, and this file's own CSS
   comment names `.setting-row` and `flex: 1`, the two shapes it forbids. */
const stripJs  = t => t.replace(/(^|[\s(,;{:=])\/\*[\s\S]*?\*\//g, '$1').replace(/^\s*\/\/.*$/gm, '');
const stripCss = t => t.replace(/\/\*[\s\S]*?\*\//g, '');
const code = f => stripJs(read(f));
const css  = stripCss(read('styles/app.css'));

const browser = await chromium.launch();
const errors = [];
const wire = p => {
  p.on('pageerror', e => errors.push('PAGEERROR ' + e.message.slice(0, 140)));
  p.on('console', m => { if (m.type() === 'error' &&
    !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|ERR_NAME|ERR_FAILED|fonts\.googleapis|supabase\.co/.test(m.text()))
    errors.push(m.text().slice(0, 140)); });
};

const fresh = async ({ lang = 'ar', server = false } = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route('**/fonts.googleapis.com/**', r => r.abort());
  if (server) await mockSupabase(ctx, { preConfirm: true });
  else await ctx.route('**/*.supabase.co/**', r => r.abort());
  await ctx.addInitScript(l => { try {
    const k = 'arabna.v1'; const s = JSON.parse(localStorage.getItem(k) || '{}');
    s.lang = l; s.demoDefaultOff = true;
    localStorage.setItem(k, JSON.stringify(s));
  } catch (e) {} }, lang);
  const p = await ctx.newPage(); wire(p);
  return { ctx, p };
};
const show = async (p, hash) => {
  await p.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#app .screen, #app > *', { timeout: 9000 }).catch(() => {});
  await p.waitForTimeout(800);
  await attach(p);
};

/* ------------------------------------------------------------------
   the one measurement the whole file turns on, taken from the page

   `geom` returns, for one checkbox id: the label's own box, its parent's
   CONTENT box (clientWidth minus the two paddings — see the head), and a
   point at the FAR END of the row from the box, which is where a finger
   travelling down the form lands. Before the fix that point is inside the
   label; after it, outside.
   ------------------------------------------------------------------ */
const geom = async (p, id) => p.evaluate(i => {
  const cb = document.getElementById(i);
  if (!cb) return null;
  const l = cb.closest('label');
  if (!l) return null;
  l.scrollIntoView({ block: 'center' });
  const box = l.getBoundingClientRect();
  const par = l.parentElement, pb = par.getBoundingClientRect(), pcs = getComputedStyle(par);
  const padL = parseFloat(pcs.paddingLeft) || 0, padR = parseFloat(pcs.paddingRight) || 0;
  const contentL = pb.left + padL, contentR = pb.right - padR;
  const cbb = cb.getBoundingClientRect();
  const txt = l.querySelector('.s-txt');
  const cs = getComputedStyle(l);
  const tcs = txt ? getComputedStyle(txt) : null;
  /* the glyphs themselves, not the box that holds them */
  let ink = 0;
  if (txt) { const r = document.createRange(); r.selectNodeContents(txt); ink = r.getBoundingClientRect().width; }
  /* the box sits at one end; the far end is where the finger passes */
  const boxOnRight = cbb.left > box.left + box.width / 2;
  const farX = boxOnRight ? contentL + 4 : contentR - 4;
  return {
    display: cs.display, cursor: cs.cursor, gap: cs.columnGap,
    grow: tcs ? tcs.flexGrow : null,
    w: +box.width.toFixed(1), left: +box.left.toFixed(1), right: +box.right.toFixed(1),
    y: +(box.top + box.height / 2).toFixed(1),
    contentW: +(contentR - contentL).toFixed(1),
    cbW: +cbb.width.toFixed(1), ink: +ink.toFixed(1),
    farX: Math.round(farX),
    farOutside: boxOnRight ? farX < box.left : farX > box.right,
    checked: cb.checked,
  };
}, id);

/* ⚠️ The app's own module instance is ATTACHED ONCE and then read with
   ordinary evaluates. `script-src 'self'` refuses `new Function`, so a
   helper that compiled a callback from a string would work in Node and be
   refused in the page — and `arabna/js/store.js` comes first because on the
   single-file build a relative path fetches the file again and hands back a
   SECOND instance with its own state. */
const attach = p => p.evaluate(async () => {
  if (!window.__m) {
    const S = await import('arabna/js/store.js').catch(() => import('./js/store.js'));
    window.__m = { S };
  }
});

const signUpMember = async (p, email) => p.evaluate(async ({ em, code }) => {
  const S = (window.__m && window.__m.S)
    || await import('arabna/js/store.js').catch(() => import('./js/store.js'));
  const { data: { session } = {} } = await S.sb.auth.getSession();
  if (session) return 'already';
  const err = await S.signUp({ name: 'Member', email: em, password: 'Qamar#Night2026' });
  if (err) return 'signUp:' + err;
  if (!S.state.user || !S.state.user.emailVerified) {
    const e2 = await S.confirmEmail(code);
    if (e2) return 'confirm:' + e2;
  }
  return 'ok';
}, { em: email, code: MOCK_CODE });

const tapAt = async (p, id, x, y) => {
  const before = await p.evaluate(i => document.getElementById(i).checked, id);
  await p.mouse.click(x, y);
  await p.waitForTimeout(120);
  const after = await p.evaluate(i => document.getElementById(i).checked, id);
  return { before, after, flipped: before !== after };
};

/* ==================================================================
   1 — the guard: read the code, because a screen written next month
       is where the pattern comes back
   ================================================================== */
console.log('--- 1 the pattern is gone from the source ---');

const jsFiles = ['js/screens/auth.js', 'js/screens/events.js', 'js/screens/admin.js',
                 'js/screens/profile.js', 'js/screens/directory.js', 'js/screens/prayer.js',
                 'js/screens/marketplace.js', 'js/screens/magazine.js', 'js/screens/home.js',
                 'js/screens/advertise.js', 'js/ui.js'];
const labelSetting = [];
for (const f of jsFiles) {
  for (const m of code(f).matchAll(/<label[^>]*class="[^"]*\bsetting-row\b/g)) labelSetting.push(f);
}
ok('1.1 no `<label class="setting-row">` anywhere in js/ — THE GUARD',
   labelSetting.length === 0, labelSetting.join(' '));

const checkRule = /\.check-row\s*\{([^}]*)\}/.exec(css);
ok('1.2 `.check-row` is defined, and its display is inline-flex and not flex',
   !!checkRule && /display:\s*inline-flex/.test(checkRule[1]),
   checkRule ? (/display:\s*([a-z-]+)/.exec(checkRule[1]) || [])[1] : 'no rule');
ok('1.2b …and it caps itself at the form, so a long consent wraps rather than escaping',
   !!checkRule && /max-width:\s*100%/.test(checkRule[1]));
ok('1.2c …and it carries the cursor the five inline styles used to',
   !!checkRule && /cursor:\s*pointer/.test(checkRule[1]));

const txtRule = /\.check-row\s+\.s-txt\s*\{([^}]*)\}/.exec(css);
ok('1.3 `flex: 1` is undone explicitly — the stretch IS the fault',
   !!txtRule && /flex:\s*0\s+1\s+auto/.test(txtRule[1]),
   txtRule ? txtRule[1].trim() : 'no rule');

/* ⚠️ thirty-one of `.setting-row`'s thirty-six uses are not labels and want
   the full width honestly: changing that rule repairs five and breaks 31 */
const settingRule = /\.setting-row\s*\{([^}]*)\}/.exec(css);
const settingTxt  = /\.setting-row\s+\.s-txt\s*\{([^}]*)\}/.exec(css);
ok('1.4 `.setting-row` is NOT touched — still flex, and its text still stretches',
   !!settingRule && /display:\s*flex/.test(settingRule[1])
   && !!settingTxt && /flex:\s*1/.test(settingTxt[1]));
const settingUses = jsFiles.reduce((n, f) => n + (code(f).match(/\bsetting-row\b/g) || []).length, 0);
ok('1.4b …and it is still carrying the rest of the app', settingUses >= 30, String(settingUses));

ok('1.5 `.check-gold` is untouched — the box itself is still 18px',
   /\.check-gold\s*\{[^}]*width:\s*18px[^}]*height:\s*18px/.test(css));

/* the inline style went INTO the class; a property repeated five times is
   the one that drifts */
const inlineLeft = [];
for (const f of jsFiles) {
  for (const m of code(f).matchAll(/<label[^>]*class="check-row"[^>]*>/g)) if (/style=/.test(m[0])) inlineLeft.push(f);
}
ok('1.6 not one of them kept an inline style', inlineLeft.length === 0, inlineLeft.join(' '));

const sites = [];
for (const f of jsFiles) for (const m of code(f).matchAll(/<label class="check-row">/g)) sites.push(f);
ok('1.7 the five sites are exactly five, in the three files the batch names',
   sites.length === 5
   && sites.filter(f => /auth\.js$/.test(f)).length === 2
   && sites.filter(f => /events\.js$/.test(f)).length === 2
   && sites.filter(f => /admin\.js$/.test(f)).length === 1,
   sites.join(' '));

/* ==================================================================
   2 — the five, measured on the screen
   ================================================================== */
console.log('--- 2 the hit area is the box and its words ---');

const measured = [];
const filled = [];

const checkOne = async (p, id, where) => {
  const g = await geom(p, id);
  if (!g) { ok('2.0 ' + id + ' is on the screen (' + where + ')', false); return; }
  measured.push(id);
  ok('2.1 ' + id + ': the label is inline-flex and its text does not stretch',
     g.display === 'inline-flex' && g.grow === '0',
     g.display + ' · flex-grow ' + g.grow);
  /* ⚠️ the parent's CONTENT box, never `clientWidth` — see the head */
  ok('2.1b ' + id + ': it never exceeds the form',
     g.w <= g.contentW + 0.5, g.w + ' of ' + g.contentW);
  if (!g.farOutside) { filled.push(id + '(' + where + ')'); }
  else {
    const r = await tapAt(p, id, g.farX, g.y);
    ok('2.2 ' + id + ': a tap at the far end of the row does NOT flip it',
       !r.flipped, 'x=' + g.farX + ' · ' + r.before + ' -> ' + r.after);
  }
  /* and the fix did not kill the convenience */
  const before = await p.evaluate(i => document.getElementById(i).checked, id);
  await p.evaluate(i => document.getElementById(i).closest('label').querySelector('.s-txt').click(), id);
  await p.waitForTimeout(100);
  const after = await p.evaluate(i => document.getElementById(i).checked, id);
  ok('2.3 ' + id + ': a tap on the words still flips it', before !== after);
  await p.evaluate(i => { document.getElementById(i).checked = false; }, id);
};

/* --- the two signup consents, in both languages: the words are long in
       one and short in the other, and the fault is width --- */
for (const lang of ['ar', 'en']) {
  const { ctx, p } = await fresh({ lang });
  await show(p, '#/auth/signup');
  await checkOne(p, 'agree1', 'signup·' + lang);
  await checkOne(p, 'agree2', 'signup·' + lang);
  await ctx.close();
}

/* --- the concert's family seating, and the featured pin --- */
{
  const { ctx, p } = await fresh({ server: true });
  await show(p, '#/home');
  /* an account, because the form is tier 1 — made through the store, the
     way `_admin.mjs` does, so the form under test is not also the fixture */
  const made = await signUpMember(p, 'v93@arabna.test');
  ok('2.0a a member exists for the propose form', made === 'ok' || made === 'already', made);
  await show(p, '#/events/propose');
  ok('2.0b …and the propose form really opened',
     (await p.locator('#evType').count()) === 1);
  await p.selectOption('#evType', 'concert').catch(() => {});
  await p.waitForTimeout(300);
  await checkOne(p, 'cnFamily', 'propose·concert');
  await ctx.close();
}

{
  const { ctx, p } = await fresh({ server: true });
  await show(p, '#/home');
  await unlockAdmin(p);
  await show(p, '#/events/propose?admin=1');
  await checkOne(p, 'evFeat', 'propose·admin');

  await show(p, '#/admin');
  await p.locator('[data-t="mag"]').first().click().catch(() => {});
  await p.waitForTimeout(500);
  await checkOne(p, 'artSpon', 'admin·magazine');
  await ctx.close();
}

ok('2.4 all five were reached and measured — none skipped in silence',
   new Set(measured).size === 5, [...new Set(measured)].join(' '));
/* ⚠️ a label whose own words fill the row has no far end to tap, and that
   is honest rather than a miss: the long Arabic consent wraps to two lines
   and the English one is longer still. What must not happen is every label
   landing there — then 2.2 would have measured nothing at all. */
ok('2.5 …and the far-end tap really ran on most of them, so 2.2 is not vacuous',
   filled.length <= 3, 'filled the row: ' + (filled.join(' ') || 'none'));

/* ==================================================================
   3 — the two that made this file urgent
   ================================================================== */
console.log('--- 3 a consent is a claim its owner made ---');
{
  const { ctx, p } = await fresh({ server: true });
  await show(p, '#/auth/signup');
  const start = await p.evaluate(() => [document.getElementById('agree1').checked,
                                        document.getElementById('agree2').checked]);
  ok('3.1 both consents start unticked', start[0] === false && start[1] === false, JSON.stringify(start));

  await p.fill('#sFirst', 'اختبار'); await p.fill('#sLast', 'مستخدم');
  await p.fill('#sEmail', 'v93b@arabna.test'); await p.fill('#sPhone', '(713) 466-9182');
  await p.fill('#sPass', 'Qamar#Night2026'); await p.fill('#sPass2', 'Qamar#Night2026');
  await p.click('#suBtn'); await p.waitForTimeout(700);
  ok('3.1b …and signing up is refused while either is unticked',
     (await p.evaluate(() => !!window.__m.S.state.user)) === false
     && (await p.locator('#e_agree .err-msg, #e_agree').first().innerText().catch(() => '')).trim().length > 0);

  /* ⚠️ sound today, and guarded so it stays sound: the spec measured that
     activation behaviour is skipped when the click lands on interactive
     content, and a `<button>` is that — so no `stopPropagation` was added
     to cure what is not broken. This is what would notice if it broke. */
  const was = await p.evaluate(() => document.getElementById('agree1').checked);
  await p.locator('[data-legal="terms"]').first().click();
  await p.waitForTimeout(500);
  const sheetOpen = await p.evaluate(() => !!document.querySelector('.sheet-panel, #sheet .sheet-panel'));
  const now = await p.evaluate(() => document.getElementById('agree1').checked);
  ok('3.2 the «terms» button opens the sheet and does not flip the consent',
     sheetOpen && now === was, 'sheet ' + sheetOpen + ' · ' + was + ' -> ' + now);
  await ctx.close();
}

/* ==================================================================
   4 — the fault itself, inverted
   ================================================================== */
console.log('--- 4 an event nobody marked goes out unmarked ---');
{
  const { ctx, p } = await fresh({ server: true });
  await show(p, '#/home');
  await unlockAdmin(p);
  await show(p, '#/events/propose?admin=1');
  const drawn = await p.locator('#evFeat').count();
  const preChecked = drawn ? await p.evaluate(() => document.getElementById('evFeat').checked) : null;
  ok('4.0 the featured box is drawn for staff and starts unticked',
     drawn === 1 && preChecked === false, 'drawn ' + drawn + ' · checked ' + preChecked);

  await p.fill('#evTitle', 'حدثٌ للاختبار');
  await p.fill('#evVenue', 'قاعة');
  await p.fill('#evStart', '2027-05-20T16:00');
  await p.click('#evSave');
  await p.waitForTimeout(1200);
  const res = await p.evaluate(t => {
    const e = window.__m.S.allEvents().find(x => (x.title && (x.title.ar === t || x.title.en === t)));
    return e ? { found: true, featured: !!e.featured, status: e.status } : { found: false };
  }, 'حدثٌ للاختبار');
  ok('4.1 an event saved without touching the box comes out featured = false — THE FAULT',
     res.found === true && res.featured === false, JSON.stringify(res));
  await ctx.close();
}

/* ================================================================== */
ok('9.1 zero console errors across everything above', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

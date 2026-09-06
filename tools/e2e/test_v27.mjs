/* V.03.4 — batch eight (3 + 4): the interface language, the password rule,
   receipts, the directions sheet, and the cash order */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { mockSupabase } from './_supabase.mjs';
import { withDemoData } from './_demo.mjs';

import { unlockAdmin } from './_admin.mjs';
const BASE = process.env.BASE || 'http://localhost:8099/index.html';
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); } else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const browser = await chromium.launch();
/* ⚠️ THIS SUITE USES THE INVENTED RECORDS AS ITS FIXTURE, and `510`
   turned them off by default. It turns them on for itself — the
   default is not reverted and no assertion is softened. */
await withDemoData(browser);
let ctx = await browser.newContext({ colorScheme: 'dark', viewport: { width: 390, height: 844 } });
/* 610: see tools/e2e/_supabase.mjs */
await mockSupabase(ctx);
let page = await ctx.newPage();
const errors = [];
const watch = (p) => {
  p.on('console', m => { if (m.type() === 'error' && !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|fonts\.googleapis/.test(m.text())) errors.push(m.text()); });
  p.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
};
watch(page);

const mods = (p = page) => p.evaluate(async () => {
  if (!window.__m) {
    const load = async (rel, spec) => { try { return await import(spec); } catch (e) { return await import(rel); } };
    window.__m = {
      S: await load('./js/store.js', 'arabna/js/store.js'),
      I: await load('./js/i18n.js', 'arabna/js/i18n.js'),
      U: await load('./js/ui.js', 'arabna/js/ui.js'),
    };
  }
  return true;
});
const go = async (h, p = page) => {
  await p.evaluate(() => { location.hash = '#/home'; });
  await p.waitForTimeout(120);
  await p.evaluate(x => { location.hash = x; }, h);
  await p.waitForTimeout(560);
  return p.evaluate(() => location.hash);
};
const txt = (p = page) => p.textContent('#app');
const patch = async (fn, p = page) => { await p.evaluate(fn); await p.reload(); await p.waitForTimeout(800); await mods(p); };
const adminIn = async (p = page) => {
  await go('#/admin', p);
  /* V.03.6 — nothing ships a staff password any more, so a device is
     CLAIMED before it can be logged into. This is the fixture doing what
     the owner does once on the first run; the route is re-entered because
     the setup screen is already on screen by the time we get here. */
  await unlockAdmin(p);
};

await page.goto(BASE); await page.waitForTimeout(800);
await patch(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  s.radius = 100; s.receipts = []; s.subscription = null; s.myAds = []; s.mapsApp = null;
  s.clockOffset = 0; s.myBusinessId = null;
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});

/* ======================================================================
   1 — one word per meaning
   ====================================================================== */
console.log('--- the words ---');
const packs = () => page.evaluate(() => window.__m.I.bothPacks());
const P = await packs();

const withWord = (re) => Object.entries(P.ar)
  .filter(([, v]) => typeof v === 'string' && re.test(v)).map(([k]) => k);

ok('1.1 «قيد المراجعة» is gone', withWord(/قيد المراجعة/).length === 0, withWord(/قيد المراجعة/).join(' '));
ok('1.2 «مراجع» survives only where the actor is named',
   withWord(/مراجع/).every(k => ['claimFormNote', 'verifyStep3', 'reviewOrder', 'bizHeldForReview'].includes(k)),
   withWord(/مراجع/).join(' '));
ok('1.3 «كلمة السر» is gone', withWord(/كلمة السر|كلمتا السر/).length === 0, withWord(/كلمة السر|كلمتا السر/).join(' '));
/* ⚠️ THE START BOUNDARY IS REQUIRED, and «اختصار» is why: it ends in
   «صار » and is the ordinary word for an abbreviation, not the dialect
   verb the guard is hunting. This is the V.02.6 boundary lesson in a test
   — Arabic glues prefixes on, so the boundary is demanded at the START of
   these words and never at the end. */
const DIALECT = /(?<![\u0621-\u064A])(صار |يصير|يقدر |تقدر |قبل ما |مرة ثانية|بزنس|ماركت بليس|سلايدر|بانر|فلترة|طابور|مزوّد|الجوال|موبايل| رح |هلق|بكرة)/;
ok('1.4 no dialect or jargon left in the pack', withWord(DIALECT).length === 0, withWord(DIALECT).join(' '));

/* ⚠️ REVERSED IN 555 (V.08.9). This item asserted that «التقييمات» IS in
   `subFeatures` — written when the list still sold reviews. Reviews are
   free for every listing by decision and by code (PLAN_LIMITS gates
   photos, videos and offers only), so the list may not name them at all.
   The half that survives is the original one: the same thing is never
   counted twice. test_v64 holds the rest. */
ok('1.5 the subscription list names no review — they are free — and counts nothing twice',
   !/المراجعات والتقييمات/.test(P.ar.subFeatures) && !/تقييم/.test(P.ar.subFeatures), P.ar.subFeatures);
ok('1.6 the field and its error use the same name',
   P.ar.password.includes('كلمة المرور') && P.ar.wrongPassword.includes('كلمة المرور'));

/* the nine dead duplicates */
const dupCount = await page.evaluate(async () => {
  const src = await (await fetch('/js/i18n.js')).text();
  const scan = (block) => {
    const out = []; let i = 0, depth = 0; const n = block.length;
    while (i < n) {
      const c = block[i];
      if (c === "'" || c === '"' || c === '`') { const q = c; i++; while (i < n && block[i] !== q) { if (block[i] === '\\') i++; i++; } i++; continue; }
      if (c === '/' && block[i + 1] === '/') { const j = block.indexOf('\n', i); i = j < 0 ? n : j; continue; }
      if (c === '/' && block[i + 1] === '*') { const j = block.indexOf('*/', i); i = j < 0 ? n : j + 2; continue; }
      if ('{[('.includes(c)) { depth++; i++; continue; }
      if ('}])'.includes(c)) { depth--; i++; continue; }
      if (depth === 1 && /[A-Za-z_]/.test(c)) {
        let j = i; while (j < n && /[A-Za-z0-9_]/.test(block[j])) j++;
        let k = j; while (k < n && ' \t'.includes(block[k])) k++;
        if (block[k] === ':') out.push(block.slice(i, j));
        i = j; continue;
      }
      i++;
    }
    return out;
  };
  const a = src.indexOf('  ar: {'), b = src.indexOf('  en: {');
  const dups = (ks) => { const seen = {}, d = []; ks.forEach(k => { seen[k] = (seen[k] || 0) + 1; }); Object.entries(seen).forEach(([k, n]) => { if (n > 1) d.push(k); }); return d; };
  return { ar: dups(scan(src.slice(a, b))), en: dups(scan(src.slice(b))) };
});
ok('1.7 no key is defined twice in the Arabic pack', dupCount.ar.length === 0, dupCount.ar.join(' '));
ok('1.8 …nor in the English one', dupCount.en.length === 0, dupCount.en.join(' '));

/* claimIt is a button, and the counter has its own words */
ok('1.9 the claim button and the counter are two keys',
   P.ar.claimIt === 'طالب بملكيته' && P.ar.unclaimedCount === 'بلا مالك');
await adminIn();
await page.click('[data-t="dir"]'); await page.waitForTimeout(700);
ok('1.10 the panel counter reads «بلا مالك», not an instruction',
   /بلا مالك/.test(await txt()) && !/طالب بملكيته/.test(await txt()));

await go('#/help');
ok('1.11 twelve questions, not ten', await page.locator('.faq-item').count() === 12,
   String(await page.locator('.faq-item').count()));
ok('1.12 the placeholder note is gone', !/نصوص مبدئية/.test(await txt()));
ok('1.13 the FAQ names the button the button is called', /طالب بملكيته/.test(await txt()));

await go('#/terms');
ok('1.14 the terms call the section by its real name',
   /خدمات وصيانة/.test(await txt()) && !/الهاندي مان/.test(await txt()));
await go('#/privacy');
ok('1.15 the privacy page is not written in dialect',
   !/تقدر تمسحها|ماركت بليس|الجوال/.test(await txt()));

/* ======================================================================
   2 — the counted noun
   ====================================================================== */
console.log('--- one, two, ten, eleven ---');
const counted = await page.evaluate(() => {
  const { I } = window.__m;
  const ar = I.bothPacks().ar;
  const f = (m) => {
    const h = Math.floor(m / 60), r = m % 60;
    if (!h) return I.arCount(r, ar.plMinute);
    if (!r) return I.arCount(h, ar.plHour);
    return I.arCount(h, ar.plHour) + ' ' + ar.and + I.arCount(r, ar.plMinute);
  };
  return { m: [2, 5, 11, 62, 125, 300, 721, 1439].map(f),
           d: [1, 2, 5, 14].map(n => I.arCount(n, ar.plDay)),
           s: [1, 2, 5, 10, 11].map(n => I.arCount(n, ar.plSecond)),
           en: [1, 2, 5, 11].map(n => I.arCount(n, I.bothPacks().en.plHour)) };
});
ok('2.1 two minutes is «دقيقتان»', counted.m[0] === 'دقيقتان', counted.m[0]);
ok('2.2 five is «5 دقائق»', counted.m[1] === '5 دقائق', counted.m[1]);
ok('2.3 eleven is «11 دقيقة», singular again', counted.m[2] === '11 دقيقة', counted.m[2]);
ok('2.4 «ساعة ودقيقتان»', counted.m[3] === 'ساعة ودقيقتان', counted.m[3]);
ok('2.5 «ساعتان و5 دقائق»', counted.m[4] === 'ساعتان و5 دقائق', counted.m[4]);
ok('2.6 a whole number of hours prints no zero minutes', counted.m[5] === '5 ساعات', counted.m[5]);
ok('2.7 «12 ساعة ودقيقة»', counted.m[6] === '12 ساعة ودقيقة', counted.m[6]);
ok('2.8 «23 ساعة و59 دقيقة»', counted.m[7] === '23 ساعة و59 دقيقة', counted.m[7]);
ok('2.9 days: يوم · يومان · 5 أيام · 14 يوماً', counted.d.join(' | ') === 'يوم | يومان | 5 أيام | 14 يوماً', counted.d.join(' | '));
ok('2.10 seconds count correctly too', counted.s.join(' | ') === 'ثانية | ثانيتان | 5 ثوانٍ | 10 ثوانٍ | 11 ثانية', counted.s.join(' | '));
ok('2.11 English keeps its two forms and no stray space',
   counted.en.join(' | ') === '1 hour | 2 hours | 5 hours | 11 hours', counted.en.join(' | '));
ok('2.12 prHour and prHours are gone', await page.evaluate(async () => {
  for (const f of ['/js/i18n.js', '/js/screens/prayer.js']) {
    if (/prHours?\b/.test(await (await fetch(f)).text())) return false;
  }
  return true;
}));

/* the filter footer, live */
await go('#/directory');
await page.click('#dirFilter'); await page.waitForTimeout(600);
ok('2.13 the results button counts in Arabic', /نتيجة|نتائج|نتيجتان/.test(await page.textContent('#fApply')),
   (await page.textContent('#fApply')).trim());
await page.click('#fApply'); await page.waitForTimeout(400);

/* ======================================================================
   3 — no toast for what the eye already saw
   ====================================================================== */
console.log('--- the theme flip ---');
await go('#/home');
const before = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
await page.click('#hTheme'); await page.waitForTimeout(500);
ok('3.1 the theme changed', await page.evaluate(() => document.documentElement.getAttribute('data-theme')) !== before);
ok('3.2 …and no bar appeared over the logo', await page.locator('.toast').count() === 0);
ok('3.3 the two strings are gone from the whole project', await page.evaluate(async () => {
  for (const f of ['/js/ui.js', '/js/i18n.js']) {
    if (/themeLightOn|themeDarkOn/.test(await (await fetch(f)).text())) return false;
  }
  return true;
}));
ok('3.4 «يتبع إعدادات جهازك» stayed — it describes what is not seen',
   !!P.ar.themeAutoNote);
await page.click('#hTheme'); await page.waitForTimeout(400);

/* ======================================================================
   4 — one password rule
   ====================================================================== */
console.log('--- the password ---');
const CASES = [
  ['Qamar2026$', true], ['Qamar#Nile42', true], ['Sh@mi-Katy!9', true],
  ['M0ntaha#Rd82', true], ['correct horse Staple9!', true],
  ['Password1$', false], ['P@ssw0rd!', false], ['Qwerty123!', false],
  ['Qamar2026', false], ['qamar2026$', false], ['Houston2026$', false],
  ['Arabna@2026!', false], ['عربنا#Houston2026', false], ['كلمةمروري2026$', false],
  ['Qamar٢٠٢٦$', false], ['Café#Qamar9', false], ['Qamar2026$🔥', false],
  ['123456', false], ['aaaaaaaa', false],
];
const results = await page.evaluate((cases) =>
  cases.map(([pw]) => window.__m.S.passwordOk(pw)), CASES);
let wrong = CASES.filter((c, i) => results[i] !== c[1]).map(c => c[0]);
ok('4.1 all nineteen measured cases agree', wrong.length === 0, wrong.join(' | '));
ok('4.2 `length < 6` exists nowhere any more', await page.evaluate(async () => {
  for (const f of ['/js/screens/profile.js', '/js/screens/admin.js', '/js/screens/auth.js']) {
    const src = await (await fetch(f)).text();
    if (/if\s*\([^)]*length\s*<\s*6/.test(src)) return false;
  }
  return true;
}));
ok('4.3 the strength meter is gone', await page.evaluate(async () =>
  !/passwordScore|pwWeak|pwStrong/.test(await (await fetch('/js/store.js')).text())
  && !/pw-meter/.test(await (await fetch('/js/screens/auth.js')).text())));

await go('#/auth/signup');
/* ⚠️ THE NUMBER IS NO LONGER TYPED HERE, and that is the point. It used to
   read `=== 5`, and when `common` was added to `passwordChecks` the list
   kept showing five: a reader watched every tick go green, tapped, and the
   button did nothing, because the sixth rule refused in silence. So the
   count is now read FROM the rules — every condition the submit can refuse
   on has to be a visible row. Add a rule without adding a row and this
   line goes red, which is the check that was missing.
   `latin` is the one exception on purpose: it is a hint ABOVE the list,
   not a row, and 4.5 below says so. */
const pwConditions = await page.evaluate(async () => {
  const S = await import('arabna/js/store.js').catch(() => import('./js/store.js'));
  return Object.keys(S.passwordChecks('Aa1!aaaa')).filter(k => k !== 'latin').length;
});
ok('4.4 every condition the submit can refuse on is listed from the start',
   await page.locator('.pw-reqs li').count() === pwConditions,
   await page.locator('.pw-reqs li').count() + ' rows for ' + pwConditions + ' conditions');
ok('4.5 «English only» is a hint ABOVE the list, never one of its rows',
   (await page.textContent('#sPass_latin')).includes('بالإنجليزية'));
await page.fill('#sPass', 'R'); await page.waitForTimeout(250);
ok('4.6 one letter draws no red', (await page.textContent('#e_sPass')).trim() === '');
ok('4.7 …and the met condition is already green', await page.evaluate(() =>
  document.querySelector('.pw-reqs [data-req="upper"]').classList.contains('ok')));
await page.fill('#sPass', 'Qamar2026'); await page.waitForTimeout(250);
ok('4.8 still no red while typing', (await page.textContent('#e_sPass')).trim() === '');
await page.fill('#sPass', 'Qamar2026$'); await page.waitForTimeout(250);
ok('4.9 the symbol turns green the moment it is typed', await page.evaluate(() =>
  document.querySelector('.pw-reqs [data-req="symbol"]').classList.contains('ok')));
await page.fill('#sPass', 'Qamar2026'); await page.locator('#sPass').blur(); await page.waitForTimeout(350);
ok('4.10 leaving the field names what is missing',
   /ينقص/.test(await page.textContent('#e_sPass')), (await page.textContent('#e_sPass')).trim());
await page.fill('#sPass', 'Qamar2026$'); await page.waitForTimeout(300);
ok('4.11 …and typing again clears it at once', (await page.textContent('#e_sPass')).trim() === '');
await page.fill('#sPass', 'عربنا#Houston2026'); await page.locator('#sPass').blur(); await page.waitForTimeout(350);
ok('4.12 Arabic is told one thing and one only',
   (await page.textContent('#e_sPass')).includes('بالإنجليزية')
   && !(await page.textContent('#e_sPass')).includes('ينقص'),
   (await page.textContent('#e_sPass')).trim());

/* the whole way through, and the storage */
await page.fill('#sFirst', 'أحمد'); await page.fill('#sLast', 'سالم');
await page.fill('#sEmail', 'ahmad@arabna.app');
await page.fill('#sPass', 'Qamar2026$'); await page.fill('#sPass2', 'Qamar2026$');
await page.check('#agree1'); await page.check('#agree2');
await page.click('#suBtn'); await page.waitForTimeout(1400);
ok('4.13 the password is not written down anywhere', await page.evaluate(() =>
  !localStorage.getItem('arabna.v1').includes('Qamar2026$')));
ok('4.14 …only a salted hash', await page.evaluate(() => {
  const u = JSON.parse(localStorage.getItem('arabna.v1')).user || {};
  return !('password' in u) && (u.pwHash || '').length === 64 && (u.pwSalt || '').length === 32;
}));

/* ⚠️ REVERSED BY 620, and the reversal is the point rather than a repair.
   This used to write `emailVerified` straight into storage, which was
   harmless while `changePassword` never left the device. It does now: the
   server is asked, and a session is what makes that possible — so the
   address is verified THROUGH THE CODE, which is what a person does and
   what creates the session. Patching the flag would leave the block green
   over a change that never reached a server. */
await page.evaluate(async () => {
  const S = await import('arabna/js/store.js').catch(() => import('./js/store.js'));
  await S.confirmEmail('123456');
});
await page.waitForTimeout(400);
await go('#/profile/password');
await page.fill('#cpCur', 'Qamar2026$'); await page.fill('#cpNew', '123456'); await page.fill('#cpConf', '123456');
await page.click('#cpSave'); await page.waitForTimeout(600);
ok('4.15 the change screen refuses 123456 — the original fault',
   (await page.evaluate(() => location.hash)) === '#/profile/password'
   && (await page.textContent('#e_cpNew')).trim().length > 0);
await page.fill('#cpNew', 'Qamar2026$'); await page.fill('#cpConf', 'Qamar2026$');
await page.locator('#cpNew').blur(); await page.waitForTimeout(300);
await page.click('#cpSave'); await page.waitForTimeout(600);
ok('4.16 …and the same one as before', /مطابقة للحالية/.test(await page.textContent('#cpErr')));
await page.fill('#cpNew', 'Sh@mi-Katy!9'); await page.fill('#cpConf', 'Sh@mi-Katy!9');
await page.click('#cpSave'); await page.waitForTimeout(900);
ok('4.17 a good one goes through', (await page.evaluate(() => location.hash)) === '#/profile');

await adminIn();
await page.click('[data-t="set"]'); await page.waitForTimeout(700);
ok('4.18 the panel has the same list', await page.locator('#apNew_reqs li').count() === pwConditions,
   await page.locator('#apNew_reqs li').count() + ' rows for ' + pwConditions + ' conditions');

/* ======================================================================
   5 — receipts
   ====================================================================== */
console.log('--- the receipts ---');
const nums = await page.evaluate(() => {
  const S = window.__m.S, seen = new Set();
  for (let i = 0; i < 300; i++) seen.add(S.newReceiptNumber());
  return [...seen];
});
ok('5.1 300 numbers, 300 different', nums.length === 300, String(nums.length));
ok('5.2 the shape is ARB-YY-XXXXX', /^ARB-\d{2}-[A-Z2-9]{5}$/.test(nums[0]), nums[0]);
ok('5.3 no 0 O 1 I or L in any of them',
   !nums.some(n => /[01OIL]/.test(n.slice(7))));
ok('5.4 nothing sequential — inv1 · inv2 published the size of the business',
   new Set(nums.map(n => n.slice(7))).size === 300);

await patch(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  s.receipts = []; s.subscription = null; s.myBusinessId = 'b1';
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});
await go('#/subscribe-consent/b1?plan=monthly');
await (await page.locator('input[type=checkbox]').first()).check();
await page.locator('#consentGo, button.btn-gold').last().click();
await page.waitForTimeout(2400);
const recs = await page.evaluate(() => window.__m.S.receipts());
ok('5.5 subscribing issues a receipt', recs.length === 1, String(recs.length));
ok('5.6 …of the right kind, and it renews', recs[0] && recs[0].kind === 'subscription' && recs[0].autoRenew === true);

await go('#/receipt/' + recs[0].id);
const rcBody = (await page.textContent('#rc')).replace(/\s+/g, ' ');
ok('5.7 the period the money bought is on it', /المدّة/.test(rcBody));
ok('5.8 «renews automatically» with the date', /يتجدّد تلقائياً/.test(rcBody));
ok('5.9 …and the literal path to cancel', /للإلغاء/.test(rcBody));
ok('5.10 the tax line is present at zero, not missing', /الضريبة/.test(rcBody));
ok('5.11 the issuer is left as a TODO, not invented', /\[الاسم القانوني/.test(rcBody));
ok('5.12 the email button says it waits for the server',
   await page.locator('button[disabled]').count() > 0 && /السيرفر/.test(await txt()));

/* a refund is a second receipt and the first is untouched */
const refund = await page.evaluate((id) => {
  const S = window.__m.S;
  const before = JSON.stringify(S.receiptById(id));
  const r = S.refundReceipt(id, 'test');
  return { second: !!r, negative: r && r.amount <= 0, points: r && r.refundOf === id,
           firstUnchanged: JSON.stringify(S.receiptById(id)) === before,
           count: S.receipts().length };
}, recs[0].id);
ok('5.13 a refund is a SECOND receipt', refund.second && refund.count === 2);
ok('5.14 …with a negative amount pointing at the first', refund.negative && refund.points);
ok('5.15 …and the original is never edited', refund.firstUnchanged);

/* the money record survives the person */
/* CHANGED in V.05.2, and the suite CRASHED on it rather than failing:
   `deleteAccount` ends the session, and `receipts()` now returns [] to
   anybody not signed in — so `S.receipts()[0]` was `undefined` and reading
   `.buyer` took the whole suite down with it.
   ⚠️ The point being tested is unchanged and still the important one: the
   money record survives the person. It is simply no longer readable through
   the signed-in accessor, so it is read off the record itself — which is the
   truer test anyway, because that is where an accounting record lives. */
const afterDelete = await page.evaluate(async () => {
  const S = window.__m.S;
  /* 610: it ends the server session first, so it is awaited */
  await S.deleteAccount();
  const kept = (S.state.receipts || []);
  const r = kept[0] || {};
  return { user: S.state.user, kept: kept.length, hidden: S.receipts().length,
           name: r.buyer && r.buyer.name, anon: !!r.anonymized, amount: r.amount };
});
ok('5.16 deleting the account keeps the financial record',
   afterDelete.user === null && afterDelete.kept === 2, JSON.stringify(afterDelete));

/* …and the other half of 225: kept on disk, shown to nobody.
   ⚠️ This buys something that was NOT bought before: without it the suite
   passes again the day `receipts()` starts showing a stranger's receipts to
   somebody with no account — which is the exact fault 225 shipped for. */
ok('5.16b …and shows it to nobody, since nobody is signed in',
   afterDelete.hidden === 0, String(afterDelete.hidden));
ok('5.17 …with the person stripped out of it',
   afterDelete.name === '' && afterDelete.anon === true);

/* ======================================================================
   6 — the directions sheet
   ====================================================================== */
console.log('--- directions ---');
const urls = await page.evaluate(() => {
  const U = window.__m.U, a = '1 Test St, Houston, TX';
  return U.MAP_APPS.map(x => U.mapUrl(x, a));
});
ok('6.1 all three are web links, never app schemes',
   urls.every(u => u.startsWith('https://')) && !urls.some(u => /waze:\/\//.test(u)), urls.join(' '));
ok('6.2 the address goes as text, not coordinates',
   urls.every(u => /Test%20St/.test(u)));

await patch(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  s.mapsApp = null; s.radius = 100;
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});
await go('#/directory/b1');
await page.click('#mapBtn'); await page.waitForTimeout(600);
ok('6.3 it asks instead of deciding', await page.locator('#mapPick').count() === 1);
ok('6.4 Google is first and preselected',
   await page.evaluate(() => {
     const rows = [...document.querySelectorAll('#mapPick .pick-row')];
     return rows[0].dataset.app === 'google' && rows[0].classList.contains('active');
   }));
await page.click('#mapGo'); await page.waitForTimeout(700);
await go('#/directory/b1');
await page.click('#mapBtn'); await page.waitForTimeout(600);
ok('6.5 without «always» it asks again', await page.locator('#mapPick').count() === 1);
await page.click('#mapAlways'); await page.click('#mapGo'); await page.waitForTimeout(700);
await go('#/directory/b1');
await page.click('#mapBtn'); await page.waitForTimeout(700);
ok('6.6 with «always» it never asks again', await page.locator('#mapPick').count() === 0);
ok('6.7 …and the choice is stored', await page.evaluate(() => window.__m.S.mapsApp()) === 'google');
await patch(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  s.user = { name: 'أحمد', email: 'r@a.app', phone: '(713) 466-9182',
             phoneVerified: true, emailVerified: true, tier: 2, joined: Date.now() };
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});
await go('#/settings');
ok('6.8 …and can be changed from Settings', await page.locator('#mapsPref').count() === 1,
   await page.evaluate(() => location.hash));

/* Apple Maps is not offered on Android */
const android = await browser.newContext({ viewport: { width: 390, height: 844 },
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36' });
const ap = await android.newPage(); watch(ap);
await ap.goto(BASE); await ap.waitForTimeout(800); await mods(ap);
ok('6.9 Apple Maps is not offered on Android',
   await ap.evaluate(() => !window.__m.U.mapChoices().includes('apple')),
   await ap.evaluate(() => window.__m.U.mapChoices().join(',')));
await android.close();

/* ======================================================================
   7 — the cash order
   ====================================================================== */
console.log('--- cash ---');
ok('7.1 no «skip payment» on any screen a user can reach', await page.evaluate(async () => {
  for (const f of ['/js/screens/advertise.js', '/js/screens/directory.js',
                   '/js/screens/marketplace.js', '/js/screens/profile.js']) {
    const src = await (await fetch(f)).text();
    if (/addCashOrder|skipPayment|paidInCash/.test(src)) return false;
  }
  return true;
}));
await patch(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  s.receipts = []; s.subscription = null; s.myAds = []; s.clockOffset = 0;
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});
await adminIn();
await page.click('[data-t="ads"]'); await page.waitForTimeout(700);
ok('7.2 the panel is where it is issued', await page.locator('#cshGo').count() === 1);
await page.click('#cshGo'); await page.waitForTimeout(400);
ok('7.3 it refuses without a business', (await page.textContent('#cshErr')).trim().length > 0);
await page.selectOption('#cshBiz', 'b1');
await page.click('#cshGo'); await page.waitForTimeout(400);
ok('7.4 …and without the name of whoever took the money',
   (await page.textContent('#cshErr')).trim().length > 0, (await page.textContent('#cshErr')).trim());
await page.fill('#cshWho', 'أحمد سالم');
await page.fill('#cshAmt', '29'); await page.fill('#cshDays', '30');
await page.click('#cshGo'); await page.waitForTimeout(1100);
const cash = await page.evaluate(() => {
  const S = window.__m.S;
  return { rec: S.receipts()[0], sub: S.state.subscription };
});
ok('7.5 it issues a receipt like any card payment', !!cash.rec && /^ARB-/.test(cash.rec.id), cash.rec && cash.rec.id);
ok('7.6 …recording who took it', cash.rec.receivedBy === 'أحمد سالم' && cash.rec.method === 'cash');
ok('7.7 the subscription runs immediately', cash.sub && cash.sub.status === 'active');
ok('7.8 …and does NOT renew', cash.sub.autoRenew === false && cash.sub.cancelAtPeriodEnd === true);

await go('#/receipt/' + cash.rec.id);
const cashBody = (await page.textContent('#rc')).replace(/\s+/g, ' ');
ok('7.9 its receipt says «ends on», never «renews»',
   /ينتهي في/.test(cashBody) && !/يتجدّد/.test(cashBody));
ok('7.10 …and «نقداً — استلمها فلان»', /نقداً — استلمها/.test(cashBody));

await patch(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  s.clockOffset = 25 * 864e5;
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});
await adminIn();
await page.click('[data-t="ads"]'); await page.waitForTimeout(700);
ok('7.11 the panel warns before the money runs out', /تحصيل نقدي/.test(await txt()));
await patch(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  s.clockOffset = 40 * 864e5;
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});
ok('7.12 past its date it ends by itself',
   await page.evaluate(() => window.__m.S.state.subscription.status) === 'canceled');

await patch(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  s.clockOffset = 0;
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});
await adminIn();
await page.click('[data-t="stats"]'); await page.waitForTimeout(700);
ok('7.13 card and cash are two figures, never one', await page.evaluate(() => {
  const b = document.querySelector('#aBody').textContent;
  return /مدفوع إلكترونياً/.test(b) && /مدفوع نقداً/.test(b);
}));

/* ======================================================================
   8 — the standing rules
   ====================================================================== */
console.log('--- the standing rules ---');
await patch(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  s.lang = 'en';
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});
await go('#/receipts');
ok('8.1 EN: the receipts screen is translated',
   /Business subscription|Advertisement|No receipts/i.test(await txt())
   && !/[\u0600-\u06FF]/.test(await txt()),
   (await txt()).replace(/\s+/g, ' ').slice(0, 60));
await go('#/auth/signup');
ok('8.2 EN: the password conditions are translated',
   /uppercase/i.test(await txt()) && !/حرف/.test(await page.textContent('.pw-reqs')));
ok('8.3 EN: the digits are Western', !/[٠-٩]/.test(await txt()));

const overflow = async () => page.evaluate(() => {
  const scrolls = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (/auto|scroll/.test(getComputedStyle(p).overflowX)) return true;
    }
    return false;
  };
  const bad = [];
  document.querySelectorAll('#app *').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && (r.right > 391.5 || r.left < -1.5) && !scrolls(el)) bad.push(el.className || el.tagName);
  });
  return bad.slice(0, 4);
});
for (const [n, h] of [['sign-up', '#/auth/signup'], ['settings', '#/settings'], ['receipts', '#/receipts']]) {
  await go(h);
  const bad = await overflow();
  ok('8.4 EN: nothing runs off the edge on ' + n, bad.length === 0, bad.join(' '));
}
await patch(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  s.lang = 'ar'; s.theme = 'light';
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});
for (const [n, h] of [['sign-up', '#/auth/signup'], ['settings', '#/settings'], ['receipts', '#/receipts']]) {
  await go(h);
  const bad = await overflow();
  ok('8.5 AR light: nothing runs off the edge on ' + n, bad.length === 0, bad.join(' '));
}

await go('#/home');
ok('99 zero console errors', errors.length === 0, errors.slice(0, 3).join(' | '));

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);

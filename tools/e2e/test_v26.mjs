/* V.03.3 — batch eight (1 + 2): the 485 descriptions, English city names,
   and who is allowed to pay for what */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); } else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const browser = await chromium.launch();
const ctx = await browser.newContext({ colorScheme: 'dark', viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error' && !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|fonts\.googleapis/.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));

/* the app's own modules — behind an importmap on the single-file build */
const mods = () => page.evaluate(async () => {
  if (!window.__m) {
    const load = async (rel, spec) => { try { return await import(spec); } catch (e) { return await import(rel); } };
    window.__m = {
      S: await load('./js/store.js', 'arabna/js/store.js'),
      D: await load('./js/data.js', 'arabna/js/data.js'),
      I: await load('./js/i18n.js', 'arabna/js/i18n.js'),
    };
  }
  return true;
});
const go = async (h) => {
  await page.evaluate(() => { location.hash = '#/home'; });
  await page.waitForTimeout(120);
  await page.evaluate(x => { location.hash = x; }, h);
  await page.waitForTimeout(560);
  return page.evaluate(() => location.hash);
};
const txt = () => page.textContent('#app');
const patch = async (fn) => { await page.evaluate(fn); await page.reload(); await page.waitForTimeout(800); await mods(); };

await page.goto(BASE); await page.waitForTimeout(800);
await patch(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  s.radius = 100; s.myBusinessId = null; s.subscription = null; s.adminLog = [];
  s.user = { name: 'رامي', email: 'r@a.app', phone: '(713) 466-9182',
             phoneVerified: true, emailVerified: true, tier: 2, joined: Date.now() };
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});

/* ======================================================================
   1 — the 485 descriptions
   ====================================================================== */
console.log('--- the descriptions ---');
const counts = await page.evaluate(() => {
  const { S, D } = window.__m;
  const real = D.BUSINESSES.filter(b => !b.demo);
  return {
    total: D.BUSINESSES.length,
    real: real.length,
    ar: real.filter(b => b.desc && b.desc.ar.trim()).length,
    en: real.filter(b => b.desc && b.desc.en.trim()).length,
  };
});
ok('1.1 the directory still holds 514', counts.total === 514, String(counts.total));
ok('1.2 485 real listings', counts.real === 485, String(counts.real));
ok('1.3 every one has an Arabic description', counts.ar === 485, String(counts.ar));
ok('1.4 …and an English one', counts.en === 485, String(counts.en));

await go('#/directory/b63');
ok('1.5 the description prints on the page, under the name',
   /مطعم|Restaurant/i.test(await txt()) && await page.evaluate(() => {
     const el = document.querySelector('.detail-body p.fs-13.muted');
     return !!el && el.textContent.trim().length > 5;
   }), await page.evaluate(() => {
     const el = document.querySelector('.detail-body p.fs-13.muted');
     return el ? el.textContent.trim().slice(0, 50) : 'MISSING';
   }));

ok('1.6 no claim word anywhere — the FTC rule', await page.evaluate(() => {
  const D = window.__m.D;
  const bad = ['الأفضل', 'الأشهر', 'الأرخص', 'best', 'cheapest', 'most famous'];
  return !D.BUSINESSES.some(b => b.desc &&
    bad.some(w => (b.desc.ar + ' ' + b.desc.en).toLowerCase().includes(w.toLowerCase())));
}));
ok('1.7 a description is one short sentence, never a paragraph',
   await page.evaluate(() => {
     const D = window.__m.D;
     const real = D.BUSINESSES.filter(b => !b.demo);
     return real.every(b => b.desc.ar.length <= 90);
   }));

/* ======================================================================
   2 — the city is written in English, always
   ====================================================================== */
console.log('--- the city names ---');
const CITY_AR = ['هيوستن', 'كاتي', 'شوغر لاند', 'شوقر لاند', 'سبرينغ', 'ريتشموند',
                 'ستافورد', 'بيرلاند', 'تكساس', 'ميزوري', 'بيلير', 'بلير',
                 'سايبرس', 'هامبل', 'كونرو', 'وودلاندز'];
const leaked = await page.evaluate((cities) => {
  const D = window.__m.D;
  const out = [];
  D.BUSINESSES.forEach(b => {
    const shown = [b.name.ar, b.name.en, b.desc && b.desc.ar, b.desc && b.desc.en]
      .filter(Boolean).join(' ');
    cities.forEach(c => { if (shown.includes(c)) out.push(b.id + ':' + c); });
  });
  return out;
}, CITY_AR);
ok('2.1 not one Arabic city name in a displayed name or description',
   leaked.length === 0, leaked.slice(0, 5).join(' '));

const i18nLeak = await page.evaluate((cities) => {
  const packs = window.__m.I.bothPacks();
  const out = [];
  ['ar', 'en'].forEach(L => Object.entries(packs[L]).forEach(([k, v]) => {
    if (typeof v === 'string') cities.forEach(c => { if (v.includes(c)) out.push(L + '.' + k); });
  }));
  return out;
}, CITY_AR);
ok('2.2 …nor anywhere in i18n', i18nLeak.length === 0, i18nLeak.join(' '));

ok('2.3 b137 reads «Katy» on both sides', await page.evaluate(() => {
  const b = window.__m.D.BUSINESSES.find(x => x.id === 'b137');
  return /Katy/.test(b.name.ar) && /Katy/.test(b.name.en)
      && !/كاتي/.test(b.name.ar + b.name.en);
}));
ok('2.4 b281 reads «بـHouston الكبرى»', await page.evaluate(() => {
  const b = window.__m.D.BUSINESSES.find(x => x.id === 'b281');
  return /Houston/.test(b.name.ar) && !/هيوستن/.test(b.name.ar);
}));
ok('2.5 regionName is «Houston والمنطقة»', await page.evaluate(() =>
  window.__m.I.bothPacks().ar.regionName === 'Houston والمنطقة'));

/* the other half of Rai's rule: search in Arabic, result in English */
console.log('--- and Arabic still finds them ---');
const search = (q) => page.evaluate((t) => {
  const { S, D } = window.__m;
  const r = S.searchBusinesses(D.BUSINESSES, t);
  return { mode: r.mode, n: r.list.length,
           first: r.list[0] ? (r.list[0].name.en || r.list[0].name.ar) : '' };
}, q);
const hou = await search('هيوستن');
ok('2.6 «هيوستن» typed in Arabic still returns listings', hou.n > 300, String(hou.n));
ok('2.7 …and the name it returns is written in English',
   /^[A-Za-z0-9]/.test(hou.first), hou.first);
ok('2.8 the tags are still Arabic — that is what makes it work',
   await page.evaluate(() => window.__m.D.BUSINESSES
     .filter(b => (b.tags || []).some(x => /هيوستن|كاتي/.test(x))).length) > 0);

/* the V.03.0 numbers must not have moved */
const TARGETS = { 'حلاق': 13, 'كوافير': 15, 'صالون': 24, 'ملحمة': 19, 'مطعم': 176,
                  'مسجد': 25, 'كنيسة': 12, 'محامي': 10, 'ضرائب': 9, 'شاورما': 27,
                  'ترامبولين': 7, 'تجميل': 24, 'مواقف': 130 };
for (const [q, want] of Object.entries(TARGETS)) {
  const r = await search(q);
  ok('2.9 «' + q + '» still answers ' + want, r.n === want, String(r.n));
}

/* ======================================================================
   3 — who may pay for what
   ====================================================================== */
console.log('--- the payment path ---');
for (const r of ['#/business/edit/b1', '#/business/photos/b1', '#/verify-business/b1']) {
  ok('3.x ' + r + ' turns away a stranger', await go(r) === '#/directory/b1', await go(r));
}
ok('3.4 #/subscribe/b1 turns away a stranger too',
   await go('#/subscribe/b1') === '#/directory/b1');
ok('3.5 …and so does the consent screen, which is where the card is',
   await go('#/subscribe-consent/b1?plan=monthly') === '#/directory/b1');

/* the guard that matters: the function, not the screen */
ok('3.6 startSubscription refuses a business the caller does not own',
   await page.evaluate(() => {
     const S = window.__m.S;
     const before = JSON.stringify(S.state.subscription);
     const r = S.startSubscription({ businessId: 'b1', plan: 'monthly' });
     return r === null && JSON.stringify(S.state.subscription) === before;
   }));

/* an owner is unaffected */
await patch(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  s.myBusinessId = 'b1';
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});
ok('3.7 the real owner still reaches the subscription screen',
   await go('#/subscribe/b1') === '#/subscribe/b1');
ok('3.8 …and the consent screen',
   (await go('#/subscribe-consent/b1?plan=monthly')).startsWith('#/subscribe-consent/b1'));
ok('3.9 …and startSubscription works for them', await page.evaluate(() => {
  const S = window.__m.S;
  const r = S.startSubscription({ businessId: 'b1', plan: 'monthly' });
  const good = !!r && r.businessId === 'b1';
  S.state.subscription = null; S.save();
  return good;
}));

/* the admin edits, and never buys */
console.log('--- the admin ---');
await patch(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  s.myBusinessId = null; s.subscription = null; s.adminLog = [];
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});
await go('#/admin');
if (await page.locator('#aUser').count()) {
  await page.fill('#aUser', 'arabna.admin');
  await page.fill('#aPass', 'Arabna@2026!');
  await page.click('#aGo'); await page.waitForTimeout(800);
}
ok('4.1 the admin may edit a shop', await go('#/business/edit/b1') === '#/business/edit/b1');
ok('4.2 …and is told, on the screen, that this is not their shop',
   await page.locator('.admin-as').count() === 1,
   (await page.locator('.admin-as').textContent().catch(() => '')).trim());
ok('4.3 but the admin may NOT buy in somebody\'s name',
   await go('#/subscribe/b1') === '#/directory/b1');
ok('4.4 …not even at the consent screen',
   await go('#/subscribe-consent/b1?plan=monthly') === '#/directory/b1');

/* the trace */
console.log('--- «آخر ما عُدِّل» ---');
await go('#/business/edit/b1');
await page.fill('#ePhone', '(713) 000-9999');
await page.click('#eSave'); await page.waitForTimeout(800);
const log = await page.evaluate(() => window.__m.S.adminLog(10));
ok('5.1 the admin\'s edit is recorded', log.length >= 1, JSON.stringify(log[0] || {}));
ok('5.2 …with the shop, the field, and both values',
   log[0] && log[0].bizId === 'b1' && log[0].field === 'phone'
   && /555-0142/.test(log[0].from) && /000-9999/.test(log[0].to),
   JSON.stringify(log[0] || {}));
ok('5.3 a field the form merely filled in is not a change',
   !log.some(r => r.from === '' && (r.to === 'false' || r.to === '')),
   log.map(r => r.field + ':' + r.from + '>' + r.to).join(' '));
await go('#/admin');
await page.click('[data-t="dir"]'); await page.waitForTimeout(700);
ok('5.4 the panel prints it', await page.locator('.log-row').count() >= 1);
ok('5.5 …under «آخر ما عُدِّل»', /آخر ما عُدِّل|Last edits/.test(await txt()));

/* the owner's own edit records nothing */
await patch(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  s.myBusinessId = 'b1'; s.adminLog = [];
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});
await go('#/business/edit/b1');
ok('5.6 the owner sees no admin banner on their own page',
   await page.locator('.admin-as').count() === 0);
await page.fill('#ePhone', '(713) 111-2222');
await page.click('#eSave'); await page.waitForTimeout(800);
ok('5.7 …and their own edit leaves no line in the log',
   await page.evaluate(() => window.__m.S.adminLog(10).length) === 0,
   JSON.stringify(await page.evaluate(() => window.__m.S.adminLog(3))));

/* ======================================================================
   6 — both languages, and the standing rules
   ====================================================================== */
console.log('--- the standing rules ---');
await patch(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  s.lang = 'en'; s.myBusinessId = null;
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});
await go('#/directory/b63');
ok('6.1 EN: the English description prints',
   await page.evaluate(() => {
     const el = document.querySelector('.detail-body p.fs-13.muted');
     return !!el && /[A-Za-z]{4}/.test(el.textContent);
   }), await page.evaluate(() => {
     const el = document.querySelector('.detail-body p.fs-13.muted');
     return el ? el.textContent.trim().slice(0, 46) : 'MISSING';
   }));

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
for (const [name, hash] of [['a business page', '#/directory/b63'], ['the directory', '#/directory']]) {
  await go(hash);
  const bad = await overflow();
  ok('6.2 EN: nothing runs off the edge on ' + name, bad.length === 0, bad.join(' '));
}
await patch(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  s.lang = 'ar'; s.theme = 'light';
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});
for (const [name, hash] of [['a business page', '#/directory/b63'], ['the directory', '#/directory']]) {
  await go(hash);
  const bad = await overflow();
  ok('6.3 AR light: nothing runs off the edge on ' + name, bad.length === 0, bad.join(' '));
}

ok('6.4 no screen decides who may subscribe — the store does',
   await page.evaluate(async () => {
     const src = await (await fetch('/js/store.js')).text();
     const fn = src.slice(src.indexOf('export function startSubscription'));
     return /ownsBusiness\(businessId\)/.test(fn.slice(0, 600));
   }));

await go('#/home');
ok('99 zero console errors', errors.length === 0, errors.slice(0, 3).join(' | '));

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);

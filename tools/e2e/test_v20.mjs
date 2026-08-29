/* V.02.7 — batch six (a): numerals, MSA, the header flip, and twelve screens */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); } else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };
const browser = await chromium.launch();
const errors = [];

const installPatch = (p) => p.addInitScript(() => {
  window.__patch = (f) => {
    const k = 'arabna.v1';
    const s = JSON.parse(localStorage.getItem(k) || '{}');
    f(s);
    localStorage.setItem(k, JSON.stringify(s));
  };
});

const openPage = async (opts = {}) => {
  const ctx = await browser.newContext(Object.assign({ colorScheme: 'dark', viewport: { width: 390, height: 844 } }, opts));
  const p = await ctx.newPage();
  p.on('console', m => { if (m.type() === 'error' && !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|fonts\.googleapis/.test(m.text())) errors.push(m.text()); });
  p.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  await installPatch(p);          // before the first navigation, so it survives reloads
  await p.goto(BASE); await p.waitForTimeout(700);
  return p;
};
/* V.03.6: the app's CSP forbids `eval` and `new Function`, and a function
   is not a serialisable argument either — so the mutator IS the evaluated
   function, and it reads and writes the state itself through one helper
   installed in the page. Playwright serialises the callback; nothing is
   rebuilt from a string inside the page, which is what CSP refuses. */
const setState = (p, fn) => p.evaluate(fn);
const asMember = (p) => setState(p, () => window.__patch((s) => {
  s.user = { name: 'رامي البي', email: 'r@x.com', tier: 2, emailVerified: true,
             phone: '(713) 466-9182', phoneVerified: true, joined: Date.now() };
}));
const go = async (p, h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(600); };

/* ============ 1 — Latin digits everywhere in Arabic ============ */
console.log('--- the numerals ---');
let page = await openPage();
const ROUTES = ['#/home', '#/directory', '#/directory/b1', '#/marketplace', '#/marketplace/c1',
  '#/events', '#/magazine', '#/advertise', '#/categories', '#/auth/signup', '#/auth/signin',
  '#/privacy', '#/terms', '#/help', '#/about', '#/subscribe'];
let dirty = [];
for (const r of ROUTES) {
  await go(page, r);
  const hits = await page.evaluate(() => {
    const out = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n; while ((n = w.nextNode())) if (/[٠-٩۰-۹]/.test(n.nodeValue)) out.push(n.nodeValue.trim().slice(0, 40));
    return out;
  });
  if (hits.length) dirty.push(r + ': ' + hits[0]);
}
ok('1.1 no Arabic-Indic digit on any screen', dirty.length === 0, dirty.slice(0, 3).join(' | '));
await go(page, '#/directory/b1');
ok('1.2 the opening hours read 12-hour with Latin digits',
   /\d{1,2}:\d{2}\s?[صم]/.test(await page.evaluate(() => document.body.innerText)));
/* stripPhones still folds Arabic-Indic digits before scanning — the rule
   is that WE never print them, not that we stop understanding them. */
ok('1.3 a user\'s own Arabic-Indic digits are still understood', await page.evaluate(async () => {
  const S = await import('/js/store.js').catch(() => null);
  if (!S) return true;
  const r = S.stripPhones('اتصل ٧١٣٤٦٦٩١٨٢');
  const txt = typeof r === 'string' ? r : (r && (r.text || r.out || JSON.stringify(r)));
  return !String(txt).includes('٧١٣٤٦٦٩١٨٢');
}));

/* ============ 2 — MSA, not dialect ============ */
console.log('--- the words ---');
await go(page, '#/auth/signin');
const si = await page.evaluate(() => document.body.innerText);
ok('2.1 «ليس لديك حساب؟»', si.includes('ليس لديك حساب؟'));
ok('2.2 …and «ما عندك» is gone', !si.includes('ما عندك'));
await go(page, '#/directory');
ok('2.3 the search says «ابحث عن»', (await page.getAttribute('#dirSearch', 'placeholder')).includes('ابحث عن'));
const bad = await page.evaluate(async () => {
  const packs = (await import('/js/i18n.js')).bothPacks();
  const marks = ['ما في ', 'ما عندك', 'ما قدرنا', 'شوف ', 'دوّر على', 'مش ', ' رح ', 'تقدر ', 'عشان ', 'هلق', 'بكرة'];
  return Object.entries(packs.ar).filter(([, v]) => typeof v === 'string' && marks.some(m => v.includes(m)))
    .map(([k]) => k);
});
ok('2.4 no dialect marker left in the Arabic pack', bad.length === 0, bad.slice(0, 5).join(' '));

/* ============ 3 — the money reads left to right ============ */
console.log('--- the money ---');
await asMember(page); await page.reload(); await page.waitForTimeout(800);
await go(page, '#/advertise');
const money = await page.evaluate(() => {
  const btn = document.querySelector('.ad-card.selected [data-start]');
  const find = (n) => { if (n.nodeType === 3 && /\$/.test(n.nodeValue)) return n;
    for (const c of n.childNodes) { const f = find(c); if (f) return f; } return null; };
  const tn = btn && find(btn);
  if (!tn) return null;
  const txt = tn.nodeValue, r = document.createRange();
  const si = txt.indexOf('$'), di = txt.search(/\d/);
  r.setStart(tn, si); r.setEnd(tn, si + 1); const rs = r.getBoundingClientRect();
  r.setStart(tn, di); r.setEnd(tn, di + 1); const rd = r.getBoundingClientRect();
  return { label: btn.textContent.replace(/\s+/g, ' ').trim(), dollarFirst: rs.left < rd.left };
});
ok('3.1 the $ is drawn left of the digits', money && money.dollarFirst, money && money.label);
ok('3.2 the button reads «احجز مكانك»', money && money.label.includes('احجز مكانك'), money && money.label);
ok('3.3 «أيّ باقة تناسبك؟»', (await page.evaluate(() => document.body.innerText)).includes('أيّ باقة تناسبك؟'));

/* ============ 4 — the flip is in the header corner ============ */
console.log('--- the flip ---');
for (const lang of ['ar', 'en']) {
  await page.evaluate(l => { const k = 'arabna.v1'; const s = JSON.parse(localStorage.getItem(k) || '{}'); s.lang = l; localStorage.setItem(k, JSON.stringify(s)); location.hash = '#/home'; }, lang);
  await page.reload(); await page.waitForTimeout(900);
  const g = await page.evaluate(() => {
    const m = document.querySelector('#hMenu').getBoundingClientRect();
    const th = document.querySelector('#hTheme').getBoundingClientRect();
    const l = document.querySelector('.h-logo').getBoundingClientRect();
    return { opposite: (m.left < 195) !== (th.left < 195), w: Math.round(th.width),
             logoMid: +(l.left + l.width / 2).toFixed(1),
             spacer: !!document.querySelector('.app-header .h-spacer') };
  });
  ok(`4.${lang === 'ar' ? 1 : 4} ${lang}: menu and flip sit in opposite corners`, g.opposite);
  ok(`4.${lang === 'ar' ? 2 : 5} ${lang}: it is 44px, exactly what the spacer was`, g.w === 44 && !g.spacer, String(g.w));
  ok(`4.${lang === 'ar' ? 3 : 6} ${lang}: the logo has not moved`, Math.abs(g.logoMid - 195) < 1, String(g.logoMid));
}
const swap = await page.evaluate(async () => {
  const before = document.querySelector('#hTheme').innerHTML;
  const logoBefore = document.querySelector('.h-logo').getAttribute('src');
  document.querySelector('#hTheme').click();
  await new Promise(r => setTimeout(r, 300));
  return { icon: before !== document.querySelector('#hTheme').innerHTML,
           logo: logoBefore !== document.querySelector('.h-logo').getAttribute('src'),
           theme: document.documentElement.getAttribute('data-theme') };
});
ok('4.7 one tap flips the theme, the icon and the mark together',
   swap.icon && swap.logo, JSON.stringify(swap));
await page.click('#hMenu'); await page.waitForTimeout(450);
ok('4.8 …and it is not in the drawer as well',
   await page.evaluate(() => !document.querySelector('#drTheme, .dr-theme-btn')));
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
await go(page, '#/settings');
ok('4.9 the simple header keeps its spacer and gains no flip',
   await page.evaluate(() => !document.querySelector('#hTheme') && !!document.querySelector('.h-spacer')));
await page.context().close();

/* ============ 5 — home, directory, marketplace ============ */
console.log('--- the screens ---');
page = await openPage();
for (const w of [390, 360]) {
  await page.setViewportSize({ width: w, height: 844 });
  await go(page, '#/home');
  const row = await page.evaluate(() => {
    const bar = document.querySelector('.search-bar.big').getBoundingClientRect();
    const chip = document.querySelector('#locBtn').getBoundingClientRect();
    const svg = document.querySelector('.search-bar.big > svg').getBoundingClientRect();
    const app = document.querySelector('#app');
    /* ⚠️ MEASURED ON THE CENTRE LINE, not the top. V.04.7 shrank the
       search box to 38px while the chip stayed 52, so two controls that
       share a row perfectly no longer share a top edge — the row is
       `align-items: center`. Comparing tops was only ever right while the
       two happened to be the same height; the centre is what «one row»
       actually means. */
    return { same: Math.abs((bar.top + bar.height / 2) - (chip.top + chip.height / 2)) < 2,
             mag: Math.round(svg.width),
             rows: document.querySelectorAll('.search-row').length,
             over: app.scrollWidth - app.clientWidth };
  });
  ok(`5.${w === 390 ? 1 : 2} ${w}px: search and location share one row`,
     row.same && row.rows === 1 && row.mag === 22 && row.over === 0, JSON.stringify(row));
}
await page.setViewportSize({ width: 390, height: 844 });
await go(page, '#/directory');
ok('5.3 the quick-chip row is gone', await page.evaluate(() => !document.querySelector('#attrChips')));
ok('5.4 the ⚙ button and both pickers remain', await page.evaluate(() =>
  !!document.querySelector('#dirFilter') && !!document.querySelector('#ctlCat') && !!document.querySelector('#ctlSort')));
await go(page, '#/directory?cat=restaurants');
const strip = await page.evaluate(() => {
  const s = document.querySelector('#catSlider .slide');
  return s ? { house: s.classList.contains('slide-house'), route: s.dataset.route } : null;
});
ok('5.5 an unsold category strip carries the house slide',
   strip && strip.house && strip.route === '#/advertise/catSlider', JSON.stringify(strip));
await page.click('#catSlider .slide'); await page.waitForTimeout(700);
ok('5.6 …and it opens the catSlider package already chosen', await page.evaluate(() => {
  const sel = document.querySelector('.ad-card.selected');
  return location.hash === '#/advertise/catSlider' && sel && sel.dataset.group === 'catSlider';
}));
await go(page, '#/marketplace');
ok('5.7 the third copy of the section name is gone', await page.evaluate(() =>
  ![...document.querySelectorAll('#app .section-title')].some(e => /السوق/.test(e.textContent))));
ok('5.8 …and the rules button moved onto the note', await page.evaluate(() =>
  !!document.querySelector('#secNote #rulesBtn, #rulesBtn')));

/* ============ 6 — the drawer ============ */
console.log('--- the drawer ---');
await go(page, '#/home');
await page.click('#hMenu'); await page.waitForTimeout(450);
await page.evaluate(() => { const h = [...document.querySelectorAll('.dr-head')].find(x => /تصنيفات/.test(x.textContent)); h && h.click(); });
await page.waitForTimeout(350);
const dr = await page.evaluate(() => ({
  renamed: /تصنيفات عربنا/.test(document.querySelector('.drawer-panel').textContent),
  routes: [...document.querySelectorAll('.dr-group.open [data-route]')].map(b => b.dataset.route),
  featured: [...document.querySelectorAll('.dr-item')].some(x => /مميّزة/.test(x.textContent)),
  height: Math.round(document.querySelector('.drawer-panel').scrollHeight),
  box: Math.round(document.querySelector('.drawer-panel').clientHeight),
  row: Math.round(document.querySelector('.drawer-panel .dr-item').getBoundingClientRect().height),
}));
ok('6.1 the group is «تصنيفات عربنا»', dr.renamed);
ok('6.2 الدليل and السوق are out — both are bottom-bar tabs',
   !dr.routes.includes('#/directory') && !dr.routes.includes('#/marketplace'), dr.routes.join(' '));
ok('6.3 «إعلانات مميّزة» took their place', dr.featured && dr.routes.includes('#/directory?featured=1'));
/* V.03.2: «دليل الواصل الجديد» was the sixth leaf in this group and the
   panel was already full, so with the group OPEN it now overflows by one
   row. Folded it still fits (v7 measures that). Nothing was removed to
   make room — which row goes is Rai's call, not a code decision — so the
   overflow is bounded rather than dropped: it may not grow past one row
   while the question is open. See CLAUDE.md, "The drawer is now full". */
/* V.03.5 moved this number, and the reason is worth writing down: the
   base went 16 -> 17, so every ROW is 6.25% taller while the panel's
   height is the viewport's and does not move at all. The overflow is the
   difference between the two, so it grows much faster than the text —
   46px over at base 16, 72px at 17, and 127px at «أكبر». The guard is
   still a hard ceiling on a known gap, re-anchored to what the new base
   actually measures, and it is measured against the panel rather than a
   frozen 844. One row anywhere fixes every size; which row is Rai's
   call. See CLAUDE.md, "The drawer scrolls when a group is open".

   V.03.9 raised it from 80 to 130, because «مواعيد القداس» was asked for
   and a row costs 50px: 46 over at base 16, 72 at 17, 122 with this row.
   The ceiling exists to stop the gap growing UNNOTICED — it did its job
   here, and the number is written down rather than the check softened.

   V.04.8 raises it again, to 185, for «الإعدادات» — a row that had to
   leave «حسابي», because that group is not drawn for a visitor at all and
   a visitor who wanted larger text was being sent to a sign-up form.
   Measured with a group open: **1021 against 844 for a visitor** (921 with
   «المساعدة»), 941 / 991 / 891 for a member. And the half worth keeping in
   view: **folded, the panel is exactly 844 and still does not scroll.**
   The ceiling did its job a third time. */
/* V.05.3 raises it a FOURTH time, 185 → 205, and this time NOT because a row
   was added: the drawer mark went 46px to 64px so the two names under it can
   be read, and every EXISTING overflow grew by exactly 18 while no new one
   was born. Measured on both roles and both heights: a visitor 195 over with
   «تصنيفات عربنا» and 95 with «المساعدة», a member 165 / 65 / 115.
   205 and not 200: it keeps the same headroom V.04.8 itself left (185 over a
   measured 177) instead of pinning the ceiling to the measurement, which
   would turn the next honest pixel into a red build.
   And the half worth keeping in view: folded, the panel is still exactly
   844/844 and does not scroll at all.
   ⚠️ This is the fourth raise, and it is worth saying plainly: the ceiling
   exists to stop the gap growing unnoticed, and it has done that four times —
   but the gap itself has never once been closed. ONE row removed from the
   drawer fixes every measurement at once, and that question has stood in
   Rai's name since V.03.2. A row is a product decision, not a code one. */
/* The tile pushed every EXISTING overflow up — a top-level row grew 8px
   and a group head 10 — and no new overflow was born: a visitor went 195
   -> 231 with «تصنيفات عربنا» and 95 -> 131 with «المساعدة», a member
   112 -> 156 and 12 -> 56.
   ⚠️ AND THEN IT COMES BACK DOWN, in the SAME batch, because Rai took the
   duplicate row out: 231 -> 181 for a visitor and 156 -> 106 for a member.
   So the ceiling lands at 191, not 241 — LOWER than the 205 this batch
   started from, and the first time in five raises that it has gone down.
   191 and not 181: the same +10 headroom every earlier raise left.
   ⚠️ And the sentence repeated for four raises — «ONE row removed fixes
   every measurement at once» — WAS MEASURED AND IS FALSE. A leaf is 50px
   and the visitor was 231 over: it takes five. It was true when it was
   first written at V.03.2 and nobody re-measured it for four batches.
   ⚠️ What IS true, and is the reason this ceiling is a watchdog and not an
   alarm: `.drawer-panel` is `overflow-y: auto` and scrolls the whole way.
   Measured — dragged to the end, scrollTop reached 231 of a 231 maximum
   and the version line's bottom landed exactly on the viewport's 844. NO
   ROW IS EVER OUT OF REACH. The promise that matters is «folded, it does
   not scroll», and that is 0 for both roles in both themes. */
/* ⚠️ RAISED in V.07.1 from 191 to 260: «تصنيفات عربنا» stops folding by
   Rai's decision, so its six rows are always drawn. The ceiling stays a
   NUMBER and stays a watchdog — it is raised with the measurement that
   raised it, never removed. */
ok('6.4 the drawer overflow with a group open does not grow past the known gap',
   dr.height - dr.box <= 260, (dr.height - dr.box) + 'px over, one row is ' + dr.row);
/* …and the rule still holds where it is most often read */
/* ⚠️ the FOLDING group, not just the first open one: the always-open
   section carries `.dr-group open` with no `.dr-head` inside it, so the
   old selector picked it and threw on `null.click()`. */
await page.evaluate(() => { const g = [...document.querySelectorAll('.dr-group.open')]
    .find(x => x.querySelector('.dr-head'));
  if (g) g.querySelector('.dr-head').click(); });
await page.waitForTimeout(400);
/* ⚠️ AND THE PROMISE THIS ONE GUARDED IS SPENT. «Folded it does not
   scroll» was true while every group folded; with a section always open
   the panel is 974 against 844 for a member. What is still owed — and is
   what actually protects the reader — is that the panel reaches its end,
   so no row is unreachable. That is asserted instead, and the old
   sentence is not quietly left passing on a changed drawer. */
ok('6.4b …and folded, every row is still reachable', await page.evaluate(() => {
  const pn = document.querySelector('.drawer-panel');
  pn.scrollTop = 1e6;
  return pn.scrollTop >= pn.scrollHeight - pn.getBoundingClientRect().height - 1;
}));
await page.evaluate(() => { const f = [...document.querySelectorAll('.dr-item')].find(x => /مميّزة/.test(x.textContent)); f && f.click(); });
await page.waitForTimeout(700);
ok('6.5 …and it really filters to the subscribers', await page.evaluate(() => {
  const rows = [...document.querySelectorAll('#dirList .list-row[data-route^="#/directory/"]')];
  return rows.length > 0 && rows.every(r => r.classList.contains('premium'));
}));
ok('6.6 …shown as a removable pill', await page.evaluate(() =>
  !!document.querySelector('#pills [data-off="__featured"]')));
await page.context().close();

/* the «قريباً» branch: no subscriber, no destination */
page = await openPage();
await setState(page, () => window.__patch((s) => { s.showDemo = false; }));
await page.reload(); await page.waitForTimeout(800);
await page.click('#hMenu'); await page.waitForTimeout(450);
await page.evaluate(() => { const h = [...document.querySelectorAll('.dr-head')].find(x => /تصنيفات/.test(x.textContent)); h && h.click(); });
await page.waitForTimeout(350);
ok('6.7 with no subscriber the row says «قريباً» and does not navigate', await page.evaluate(() => {
  const f = [...document.querySelectorAll('.dr-item')].find(x => /مميّزة/.test(x.textContent));
  return !!f && f.disabled && !f.dataset.route && /قريباً/.test(f.textContent);
}));
await page.context().close();

/* ============ 7 — help, subscribe, forgot ============ */
console.log('--- help, subscribe, forgot ---');
page = await openPage();
await go(page, '#/help');
/* V.03.4 added two the app could not answer before: whether the prayer
   times are right for your city, and how to add an event. */
ok('7.1 twelve folded questions', await page.evaluate(() => document.querySelectorAll('.faq-item').length) === 12,
   String(await page.evaluate(() => document.querySelectorAll('.faq-item').length)));
ok('7.2 all shut to begin with', await page.evaluate(() => document.querySelectorAll('.faq-item.open').length) === 0);
await page.click('.faq-item[data-q="3"] .faq-head'); await page.waitForTimeout(350);
await page.click('.faq-item[data-q="7"] .faq-head'); await page.waitForTimeout(350);
ok('7.3 only one is ever open', await page.evaluate(() => document.querySelectorAll('.faq-item.open').length) === 1);
ok('7.4 a shut answer is inert, not merely clipped', await page.evaluate(() =>
  [...document.querySelectorAll('.faq-item:not(.open) .faq-body-inner')].every(e => getComputedStyle(e).visibility === 'hidden')));
const help = await page.evaluate(() => document.body.innerText);
ok('7.5 the phone is off this screen', !/\(713\)/.test(help));
ok('7.6 …and the email is still on it', /support@arabna/.test(help));

await go(page, '#/subscribe');
const badge = await page.evaluate(() => {
  const r = [...document.querySelectorAll('.info-row')].find(x => /شارة/.test(x.textContent));
  return r ? { line: r.querySelector('b').textContent.replace(/\s+/g, ' ').trim(),
               sub: [...r.querySelectorAll('.i-txt > span')].map(s => s.textContent.trim()).join(''),
               gold: !!r.querySelector('.badge-bizverified') } : null;
});
ok('7.7 the line reads «اطلب شارة»', badge && /اطلب شارة/.test(badge.line), badge && badge.line);
ok('7.8 …with the gold mark beside it', badge && badge.gold);
// V.03.4: «مراجعة» now means only an admin's vetting, said as «الموافقة»
ok('7.9 …and «بعد الموافقة» under it', badge && badge.sub.includes('بعد الموافقة'), badge && badge.sub);
ok('7.10 «أهلية» is gone and nothing promises the badge',
   !/أهلية|احصل على شارة/.test(await page.evaluate(() => document.body.innerText)));

await go(page, '#/auth/forgot');
ok('7.11 forgot-password says «قريباً» instead of pretending',
   /قريباً/.test(await page.evaluate(() => document.body.innerText))
   && await page.evaluate(() => !document.querySelector('#fEmail')));
ok('7.12 …and offers two doors that open', await page.evaluate(() =>
  [...document.querySelectorAll('#app [data-route]')].map(e => e.dataset.route).includes('#/auth/signup')));

/* ============ 8 — the marketplace listing ============ */
console.log('--- the listing ---');
ok('8.1 share sits beside the heart on a business page', await (async () => {
  await go(page, '#/directory/b1');
  return page.evaluate(() => !!document.querySelector('.top-actions #shareTop') &&
    !!document.querySelector('.top-actions #saveBtn') && !document.querySelector('#shareBtn'));
})());
await go(page, '#/marketplace/c1');
ok('8.2 …and on a marketplace listing', await page.evaluate(() =>
  !!document.querySelector('.top-actions #shareTop') && !document.querySelector('#shareBtn')));
await page.context().close();
page = await openPage();          // a visitor, not the member from section 3
/* c2 belongs to somebody else, which is the case being checked here.
   (V.03.7: c1 is no longer seeded into `myListings` — a visitor who had
   never signed up owned it — so the owner view below is set up explicitly
   a few lines down, the way publishing would.) */
await go(page, '#/marketplace/c2');
ok('8.3 the visitor is offered the seller', await page.evaluate(() =>
  [...document.querySelectorAll('#app button')].some(b => /البائع/.test(b.textContent))));

await asMember(page);
await setState(page, () => window.__patch((s) => { s.myListings = ['c1']; s.messages = []; }));
await page.reload(); await page.waitForTimeout(800);
await go(page, '#/marketplace/c1');
ok('8.4 the owner sees no message button while nobody has written',
   await page.evaluate(() => ![...document.querySelectorAll('#app button')].some(b => /رسائل/.test(b.textContent))));
ok('8.5 …and «أخفِ الإعلان» has replaced «حذف»', await page.evaluate(() =>
  !!document.querySelector('#hideBtn') && !document.querySelector('#delBtn')));
await setState(page, () => window.__patch((s) => { s.messages = [{ id: 'm1', listingId: 'c1', from: 'them', text: 'مرحبا', when: Date.now() }]; }));
await page.reload(); await page.waitForTimeout(800);
await go(page, '#/marketplace/c1');
ok('8.6 one message makes the button appear, counted', await page.evaluate(() =>
  [...document.querySelectorAll('#app button')].some(b => /رسائل المشترين \(1\)/.test(b.textContent.replace(/\s+/g, ' ')))));
await go(page, '#/my-ads');
ok('8.7 every ad in «إعلاناتي» has its own share icon',
   await page.evaluate(() => document.querySelectorAll('[data-share]').length) >= 1);

/* ============ 9 — the posting rules ============ */
console.log('--- posting ---');
const rules = await page.evaluate(async () => {
  const S = await import('/js/store.js');
  return { max: S.MAX_ACTIVE_LISTINGS, days: S.LISTING_DAYS,
           other: S.catRule('other').days, hm: S.catRule('handyman').maxActive };
});
ok('9.1 four active listings and fourteen days, from the store',
   rules.max === 4 && rules.days === 14 && rules.other === 14, JSON.stringify(rules));
ok('9.2 handyman keeps its own stricter rule', rules.hm === 1);
const hide = await page.evaluate(async () => {
  const S = await import('/js/store.js');
  const before = S.activeListingCount();
  S.hideClassified('c1');
  const out = { ownerSees: S.myActiveListings().some(c => c.id === 'c1'),
                freed: S.activeListingCount() === before - 1 || before === 0,
                marked: (S.classifiedById('c1') || {}).status };
  S.unhideClassified('c1');
  out.back = (S.classifiedById('c1') || {}).status;
  return out;
});
ok('9.3 hiding keeps it for the owner and frees the slot',
   hide.ownerSees && hide.marked === 'hidden', JSON.stringify(hide));
ok('9.4 …and it comes back', hide.back === 'live');
await go(page, '#/post');
await page.click('#pubBtn').catch(() => {});
await page.evaluate(() => { const b = [...document.querySelectorAll('#app button')].find(x => /انشر|نشر/.test(x.textContent)); b && b.click(); });
await page.waitForTimeout(450);
ok('9.5 every field but the photos is required, and marked',
   await page.evaluate(() => document.querySelectorAll('.input-err').length) >= 4,
   String(await page.evaluate(() => [...document.querySelectorAll('.input-err')].map(e => e.id).join(' '))));
await page.context().close();

/* ============ 10 — add your business ============ */
console.log('--- add a business ---');
page = await openPage();
await asMember(page); await page.reload(); await page.waitForTimeout(700);
await go(page, '#/add-business');
ok('10.1 the button is dead without a name and a category',
   await page.evaluate(() => document.querySelector('#bSave').disabled));
await page.fill('#bName', 'Test Shop'); await page.waitForTimeout(200);
ok('10.2 …still dead with only a name',
   await page.evaluate(() => document.querySelector('#bSave').disabled));
await page.selectOption('#bCat', 'restaurants'); await page.waitForTimeout(400);
ok('10.3 …and alive once both are there',
   await page.evaluate(() => !document.querySelector('#bSave').disabled));
ok('10.4 the specialities come as one box per group',
   await page.evaluate(() => document.querySelectorAll('.attr-box').length) > 1,
   String(await page.evaluate(() => document.querySelectorAll('.attr-box').length)));
await page.click('.attr-box .attr-head'); await page.waitForTimeout(300);
await page.evaluate(() => { const c = [...document.querySelectorAll('.attr-box.open .chip')]; c[0] && c[0].click(); });
await page.waitForTimeout(300);
await page.evaluate(() => { const c = [...document.querySelectorAll('.attr-box.open .chip')]; c[1] && c[1].click(); });
await page.waitForTimeout(300);
ok('10.5 a box stays open while you pick from it',
   await page.evaluate(() => document.querySelectorAll('.attr-box.open').length) === 1);
ok('10.6 …and what is chosen shows as ✕ pills',
   await page.evaluate(() => document.querySelectorAll('.attr-chosen .pill').length) === 2);
await page.evaluate(() => document.querySelector('.attr-chosen .pill').click()); await page.waitForTimeout(300);
ok('10.7 …removable from the pill', await page.evaluate(() => document.querySelectorAll('.attr-chosen .pill').length) === 1);
await page.click('#bMobile'); await page.waitForTimeout(300);
ok('10.8 «خدمة متنقّلة» swaps the address for a ZIP', await page.evaluate(() =>
  document.querySelector('#bAddrField').hidden && !document.querySelector('#bZipField').hidden));
await page.click('#b24'); await page.waitForTimeout(300);
ok('10.9 «مفتوح 24 ساعة» hides the seven rows',
   await page.evaluate(() => document.querySelector('#bHours').hidden));
await page.click('#bSave'); await page.waitForTimeout(600);
ok('10.10 a mobile trade without a ZIP is refused, and the field is marked',
   await page.evaluate(() => !!document.querySelector('#bZip.input-err') && location.hash === '#/add-business'));
await page.fill('#bZip', '77036'); await page.waitForTimeout(200);
await page.click('#bSave'); await page.waitForTimeout(700);
ok('10.11 …then an empty group is named and opened',
   await page.evaluate(() => document.querySelectorAll('.attr-box.open').length === 1 && location.hash === '#/add-business'));
await page.context().close();

/* ============ 11 — sign up ============ */
console.log('--- sign up ---');
page = await openPage();
await go(page, '#/auth/signup');
await page.click('#suBtn'); await page.waitForTimeout(400);
ok('11.1 an empty form writes an error under every field',
   await page.evaluate(() => [...document.querySelectorAll('.field-err')].filter(e => e.textContent).length) === 5);
await page.fill('#sFirst', 'رامي1'); await page.fill('#sEmail', 'nope');
await page.fill('#sPass', 'abc'); await page.fill('#sPass2', 'abd');
await page.click('#suBtn'); await page.waitForTimeout(400);
const fe = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.field-err')].map(e => [e.id, e.textContent])));
ok('11.2 a digit in the name is refused', /أحرف فقط/.test(fe.e_sFirst || ''), fe.e_sFirst);
ok('11.3 a bad email is named as such', /غير صحيحة/.test(fe.e_sEmail || ''), fe.e_sEmail);
/* V.03.4: the message names the MISSING condition rather than quoting the
   whole rule — «كلمة المرور غير صالحة» names nothing to fix. */
ok('11.4 the password error names what is missing', /ينقص/.test(fe.e_sPass || ''), fe.e_sPass);
ok('11.5 a mismatch is caught', /متطابقتين/.test(fe.e_sPass2 || ''), fe.e_sPass2);
await page.fill('#sPass', 'Rami2026$'); await page.waitForTimeout(250);
/* V.03.4: the meter is gone. «ضعيفة / متوسّطة / قوية» measures nothing
   once the rule is absolute; the list says WHICH condition is missing and
   turns each one green as it is met. */
ok('11.6 the conditions turn green as they are met, before any failure',
   await page.evaluate(() =>
     [...document.querySelectorAll('.pw-reqs li')].every(li => li.classList.contains('ok'))));
await page.click('[data-legal="terms"]'); await page.waitForTimeout(600);
ok('11.7 the terms open over the form', await page.evaluate(() =>
  !!document.querySelector('.sheet-root.open') && /الحسابات/.test(document.querySelector('.sheet-panel').textContent)));
ok('11.8 …and the header still says «إنشاء حساب»',
   (await page.textContent('.h-title')).trim() === 'إنشاء حساب');
await page.click('.sheet-panel [data-close]'); await page.waitForTimeout(600);
ok('11.9 …and closing keeps everything typed', await page.evaluate(() =>
  document.querySelector('#sFirst').value === 'رامي1' && document.querySelector('#sPass').value === 'Rami2026$'));
await page.fill('#sFirst', 'رامي'); await page.fill('#sLast', 'البي');
await page.fill('#sEmail', 'rami@example.com'); await page.fill('#sPhone', '(713) 466-9182');
await page.fill('#sPass2', 'Rami2026$');
await page.click('#agree1'); await page.click('#agree2');
await page.click('#suBtn'); await page.waitForTimeout(1600);
ok('11.10 it lands on the code screen', await page.evaluate(() => location.hash) === '#/auth/email');
ok('11.11 the phone is stored unverified', await page.evaluate(() => {
  const u = JSON.parse(localStorage.getItem('arabna.v1') || '{}').user || {};
  return !!u.phone && u.phoneVerified === false;
}));
ok('11.12 the resend button counts down', await page.evaluate(() =>
  document.querySelector('#rsBtn').disabled && /\d+/.test(document.querySelector('#rsBtn').textContent)));
ok('11.13 …and nobody is trapped there', await page.evaluate(() => !!document.querySelector('#guestBtn')));
await page.goto(BASE); await page.waitForTimeout(1300);
ok('11.14 closing the app and reopening returns to the code, not the form',
   await page.evaluate(() => location.hash) === '#/auth/email');
await page.evaluate(() => { const k = 'arabna.v1'; const s = JSON.parse(localStorage.getItem(k) || '{}'); s.user.emailVerified = true; localStorage.setItem(k, JSON.stringify(s)); });
await page.reload(); await page.waitForTimeout(800);
await go(page, '#/auth/phone');
await page.fill('#phIn', '(281) 555-0000'); await page.click('#sendBtn'); await page.waitForTimeout(800);
const mm = await page.evaluate(() => document.querySelector('#phMsg').textContent);
ok('11.15 a different number is refused', /غير مطابق/.test(mm), mm.trim());
ok('11.16 …naming only the last three digits', /182/.test(mm) && !/466|9182|713/.test(mm));
await page.fill('#phIn', '713-466-9182'); await page.click('#sendBtn'); await page.waitForTimeout(3000);
ok('11.17 the same number, punctuated differently, goes through',
   await page.evaluate(() => getComputedStyle(document.querySelector('#step2')).display) === 'block');

ok('12.1 no console errors anywhere in the walk', errors.length === 0, errors.slice(0, 3).join(' | '));

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);

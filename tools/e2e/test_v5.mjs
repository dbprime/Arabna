/* V.01.5 — drawer versions, guest/member split, branch destinations */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { mockSupabase } from './_supabase.mjs';
import { withDemoData } from './_demo.mjs';

const BASE = process.env.BASE || 'http://localhost:8123/index.html';
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); } else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const browser = await chromium.launch();
/* ⚠️ THIS SUITE USES THE INVENTED RECORDS AS ITS FIXTURE, and `510`
   turned them off by default. It turns them on for itself — the
   default is not reverted and no assertion is softened. */
await withDemoData(browser);
const __c = await browser.newContext({ colorScheme: 'dark', viewport: { width: 390, height: 844 } });
/* 610: see _supabase.mjs */
await mockSupabase(__c);
const page = await __c.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));

const go = async (h) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(320); };
const hash = () => page.evaluate(() => location.hash);
const txt = () => page.textContent('#app');
const openDrawer = async () => {
  if (!(await page.locator('#hMenu').count())) { await go('#/home'); await page.waitForTimeout(340); }
  await page.click('#hMenu'); await page.waitForTimeout(430);
};
const closeDrawer = async () => {
  await page.evaluate(() => { const s = document.querySelector('.drawer-scrim'); if (s) s.click(); });
  await page.waitForTimeout(430);
};
/** every route reachable from the drawer, group by group */
const drawerMap = () => page.evaluate(() => ({
  routes: Array.from(document.querySelectorAll('#drawer [data-route]')).map(b => b.dataset.route),
  heads: Array.from(document.querySelectorAll('#drawer .dr-head')).map(b => b.textContent.trim()),
  headsHaveRoute: Array.from(document.querySelectorAll('#drawer .dr-head')).some(b => b.dataset.route),
  topLevel: Array.from(document.querySelectorAll('#drawer .drawer-panel > *'))
    .filter(el => el.classList.contains('dr-item') || el.classList.contains('dr-group'))
    .map(el => el.classList.contains('dr-group') ? 'group:' + el.dataset.group : 'row:' + (el.id || el.textContent.trim().split('\n')[0])),
  invite: !!document.querySelector('.dr-invite'),
  logout: !!document.querySelector('#drOut'),
  badge: (() => { const b = document.querySelector('#drawer .dr-item > .dr-badge'); return b ? b.textContent : null; })(),
  panelScroll: (() => { const p = document.querySelector('.drawer-panel'); return p ? p.scrollHeight : 0; })(),
  panelBox: (() => { const p = document.querySelector('.drawer-panel'); return p ? Math.round(p.clientHeight) : 0; })(),
}));

await page.goto(BASE);
await page.waitForTimeout(800);

/* ======================================================================
   PART 1 — as a guest
   ====================================================================== */
console.log('--- guest ---');

await openDrawer();
let d = await drawerMap();

ok('guest: invite card is shown', d.invite);
ok('guest: sign-up button in the invite card', d.routes.includes('#/auth/signup'));
ok('guest: sign-in link in the invite card', d.routes.includes('#/auth/signin'));
ok('guest: no notifications row', !d.routes.includes('#/notifications'));
/* ⚠️ V.04.8 REVERSED THIS, and it is the item. The language, the
   appearance, the text size and the maps app are DEVICE preferences —
   nothing about them reaches a server and there is no identity to ask for
   in exchange — so a visitor asking for larger text was being sent to a
   sign-up form. Our oldest readers need that first and register last.
   The row is there for them now; what needs an account still is not. */
ok('guest: a settings row, for the device preferences', d.routes.includes('#/settings'));
ok('guest: no sign-out row', !d.logout);
ok('guest: no "my account" group', !d.topLevel.includes('group:account'));
for (const r of ['#/my-ads', '#/my-reviews', '#/messages', '#/saved', '#/my-business', '#/subscribe']) {
  ok('guest: ' + r + ' removed from the tree', !d.routes.includes(r));
}
ok('guest: app sections group present', d.topLevel.includes('group:sections'));
ok('guest: advertise stays visible', d.routes.includes('#/advertise'));
ok('guest: help group present', d.topLevel.includes('group:help'));
ok('guest: language row present', await page.locator('#drLang').count() === 1);
ok('guest: no disabled/greyed leftovers',
   await page.evaluate(() => !document.querySelector('#drawer [disabled], #drawer .disabled')));

await closeDrawer();

/* guest profile screen carries no link rows */
await go('#/profile');
let profRows = await page.evaluate(() => document.querySelectorAll('#app .dr-item').length);
ok('guest profile: zero link rows', profRows === 0, profRows + ' rows');
ok('guest profile: offers sign up', (await txt()).includes('إنشاء حساب'));

/* personal routes redirect a guest instead of painting empty data */
for (const [route, expect] of [['#/saved', '#/auth/signup'], ['#/my-ads', '#/auth/signup'],
                               ['#/my-reviews', '#/auth/signup'], ['#/my-business', '#/auth/signup'],
                               ['#/notifications', '#/auth/signup'],
                               ['#/messages', '#/auth/signup']]) {
  await go(route);
  ok('guest: ' + route + ' redirects', (await hash()).startsWith(expect), await hash());
}
/* ⚠️ …AND `#/settings` IS OUT OF THAT LIST ON PURPOSE (V.04.8): it opens,
   and it shows the four device preferences and none of the six sections
   that really belong to an account. */
await go('#/settings');
ok('guest: #/settings opens instead of redirecting', (await hash()) === '#/settings', await hash());
ok('guest: …with the device preferences and nothing of the account',
   await page.evaluate(() => !!document.querySelector('#langBtn')
     && document.querySelectorAll('[data-font]').length === 4
     && !document.querySelector('#addCard') && !document.querySelector('#delAcc')));

/* ======================================================================
   PART 2 — sign up, become a member
   ====================================================================== */
console.log('--- becoming a member ---');
await go('#/auth/signup');
// V.02.7: one name field became two, and the password is confirmed

await page.fill('#sFirst', 'أحمد');

await page.fill('#sLast', 'سالم');
await page.fill('#sEmail', 'ahmad@arabna.app');
await page.fill('#sPass', 'Qamar2026$');

await page.fill('#sPass2', 'Qamar2026$');
await page.check('#agree1'); await page.check('#agree2');
await page.click('#suBtn'); await page.waitForTimeout(900);
await page.$$eval('#otp-e .otp-box', bs => bs.forEach((b, i) => { b.value = '123456'[i] || ''; }))  /* 610: the fill card left the email screen; the code is typed */; await page.click('#vBtn'); await page.waitForTimeout(800);

const isMember = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  return !!(s.user && s.user.emailVerified);
});
ok('signed up and email-verified', isMember);

await openDrawer();
d = await drawerMap();
/* REVERSED in V.05.5: what marks the member's drawer is no longer a «حسابي»
   GROUP — it is the two buttons in the head, «حسابي» and sign-out. The check
   is the same check: the drawer was rebuilt for somebody with an account. */
ok('member: drawer rebuilt with the account version',
   await page.locator('.dr-head-acts [data-route="#/profile"]').count() === 1 &&
   await page.locator('.dr-head-acts #drOut').count() === 1 &&
   !d.topLevel.includes('group:account'));
ok('member: invite card gone', !d.invite);
ok('member: sign-out row present', d.logout);
ok('member: notifications is a standalone row',
   d.topLevel.some(x => x.startsWith('row:')) && d.routes.includes('#/notifications')
   && await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('.drawer-panel > .dr-item'));
        return rows.some(r => r.dataset.route === '#/notifications');
      }));

/* seven visible top-level rows, no scrolling */
const visibleRows = await page.evaluate(() => Array.from(document.querySelectorAll('.drawer-panel > *'))
  .filter(el => el.classList.contains('dr-item') || el.classList.contains('dr-group')).length);
/* ⚠️ EIGHT SINCE V.04.8 — «الإعدادات» is a standalone row, directly under
   «اللغة», because the group it used to sit in is not drawn for a visitor
   at all. The cost is measured and not hidden: folded the panel is still
   exactly the viewport and does not scroll; with a group open it is over,
   as it already was. */
/* SIX SINCE V.05.5: the «حسابي» group and the standalone sign-out row both
   left for the head. Settings stays standalone — that is the 195 decision
   and it is the half of this line that must not move. */
ok('member: six top-level rows, settings still standalone',
   visibleRows === 6, visibleRows + ' rows');
ok('member: drawer needs no scrolling', d.panelScroll <= d.panelBox + 2, d.panelScroll + ' / ' + d.panelBox);

/* badge on the notifications row */
ok('notifications row carries the unread badge', d.badge !== null, 'badge=' + d.badge);

/* every group collapsed on open, heads never navigate */
const collapsed = await page.evaluate(() => document.querySelectorAll('#drawer .dr-group.open').length);
ok('all groups collapsed on open', collapsed === 0, collapsed + ' open');
ok('no group head carries a route', !d.headsHaveRoute);

/* REVERSED in V.05.5: the «حسابي» GROUP is deleted from the drawer — its six
   rows are the account hub on #/profile now, reached from the two buttons
   under the name. The accordion itself is unchanged and is asserted on the
   two groups that remain, which is what the check was ever about. */
const beforeHead = await hash();
await page.click('#drawer [data-toggle="sections"]'); await page.waitForTimeout(320);
ok('head opens the group in place, does not navigate', (await hash()) === beforeHead);
ok('the group actually opened', await page.evaluate(() => !!document.querySelector('.dr-group[data-group="sections"].open')));
ok('aria-expanded is true', await page.getAttribute('#drawer [data-toggle="sections"]', 'aria-expanded') === 'true');

await page.click('#drawer [data-toggle="help"]'); await page.waitForTimeout(320);
ok('only one group open at a time',
   await page.evaluate(() => document.querySelectorAll('.dr-group.open').length) === 1);
ok('previous head aria-expanded reset',
   await page.getAttribute('#drawer [data-toggle="sections"]', 'aria-expanded') === 'false');
/* …and the two buttons that replaced the group are in the head */
ok('the head carries «حسابي» and sign-out',
   await page.locator('.dr-head-acts [data-route="#/profile"]').count() === 1 &&
   await page.locator('.dr-head-acts #drOut').count() === 1);

/* the full destination table */
d = await drawerMap();
/* V.02.7: الدليل and السوق left — they are permanent bottom-bar tabs, and
   «إعلانات مميّزة» took their place. */
/* REVERSED in V.05.5: the six account destinations left the drawer for the
   hub. They are asserted below, on #/profile, where they now live — moved,
   never dropped, because a destination nobody checks is a destination that
   quietly disappears. */
/* MOVED, NOT DROPPED: «كل التصنيفات» left the drawer because Home already
   carries it as the computed «+N / شاهد الكل» tile and Home is a permanent
   bottom-bar tab — the same rule that took «الدليل» and «السوق» out. So
   `#/categories` is checked BELOW, on Home, and the drawer is checked for
   its absence. Deleting the line instead would have taken the destination
   out of the net entirely. */
const wanted = ['#/profile',
  '#/settings', '#/events', '#/magazine', '#/directory?featured=1',
  '#/advertise', '#/help', '#/about', '#/privacy', '#/terms', '#/notifications'];
const HUB = ['#/my-business', '#/my-ads', '#/my-reviews', '#/messages', '#/saved', '#/subscribe'];
for (const r of wanted) ok('drawer has a leaf for ' + r, d.routes.includes(r));
ok('Home is deliberately absent (V.01.7)', !d.routes.includes('#/home'));
ok('…and «كل التصنيفات» too, for the same reason', !d.routes.includes('#/categories'),
   d.routes.filter(r => r === '#/categories').join(','));
/* V.02.7 takes it out again: a permanent bottom-bar tab does not need a
   drawer row, and «إعلانات مميّزة» took the space. */
ok('Directory taken back out of app sections', !d.routes.includes('#/directory'));

ok('and the six account rows are NOT in the drawer any more',
   HUB.every(r => !d.routes.includes(r)));

await closeDrawer();

/* the hub holds every one of them */
await page.evaluate(() => { location.hash = '#/profile'; }); await page.waitForTimeout(700);
const hubRoutes = await page.evaluate(() =>
  [...document.querySelectorAll('#app [data-route]')].map(e => e.dataset.route));
for (const r of HUB) ok('the hub has a row for ' + r, hubRoutes.includes(r));
await openDrawer();

await closeDrawer();

/* every leaf really lands where the table says */
console.log('--- leaf destinations ---');
for (const r of wanted) {
  await go('#/home');
  await openDrawer();
  /* settings is a top-level row now, so it is NOT opened through a group */
  const grp = ['#/my-business', '#/my-ads', '#/my-reviews', '#/messages', '#/saved', '#/subscribe'].includes(r) ? 'account'
            : ['#/directory', '#/marketplace', '#/events', '#/magazine'].includes(r) ? 'sections'
            : ['#/help', '#/about', '#/privacy', '#/terms'].includes(r) ? 'help' : null;
  if (grp) { await page.click(`#drawer [data-toggle="${grp}"]`); await page.waitForTimeout(300); }
  await page.evaluate((route) => document.querySelector(`#drawer [data-route="${route}"]`).click(), r);
  await page.waitForTimeout(450);
  ok('leaf ' + r + ' lands on itself', (await hash()) === r, await hash());
}

/* ======================================================================
   PART 3 — pre-filtered destinations
   ====================================================================== */
console.log('--- filtered destinations ---');

const chipState = (chipSel, wrapSel) => page.evaluate(([c, w]) => {
  const chip = document.querySelector(c);
  if (!chip) return null;
  const wrap = document.querySelector(w);
  const cr = chip.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
  return { active: chip.classList.contains('active'),
           inView: cr.left >= wr.left - 1 && cr.right <= wr.right + 1,
           label: chip.textContent.trim() };
}, [chipSel, wrapSel]);

/* V.02.4: the choice is printed on the picker instead of being a chip
   somewhere inside a row that scrolls sideways — so "is it in view" stops
   being a question that can have a wrong answer. */
const pickerValue = (sel) => page.evaluate(s => {
  const el = document.querySelector(s);
  return el ? el.textContent.trim() : null;
}, sel);
await go('#/directory?cat=restaurants');
let cs = { label: await pickerValue('#ctlCat .ctl-v') };
ok('directory: arriving filtered names the section on the picker', cs.label === 'مطاعم', cs.label);
ok('directory: a note names the current section', await page.locator('#dirNote .sec-note').count() === 1,
   (await page.textContent('#dirNote')).trim());
/* V.04.4: `data-total` is how many results there are; `.list-row` is how
   many are painted, and the window paints forty. */
const dirAll = await page.evaluate(() => +document.querySelector('#dirList').dataset.total);
await go('#/directory');
const dirNone = await page.evaluate(() => +document.querySelector('#dirList').dataset.total);
ok('directory: the filter really filters', dirAll < dirNone, dirAll + ' vs ' + dirNone);
ok('directory: unfiltered view shows no section note', await page.locator('#dirNote .sec-note').count() === 0);

await go('#/marketplace?cat=cars');
cs = { label: await pickerValue('#ctlSec .ctl-v') };
ok('marketplace: the picker names the section on arrival', cs.label === 'سيارات', cs.label);
ok('marketplace: section note present', await page.locator('#secNote .sec-note').count() === 1,
   (await page.textContent('#secNote')).trim());

await go('#/magazine?cat=business');
/* V.04.0: six chips became a picker — the rule the batch finished is that
   more than five options is a dropdown. "The chip is active on arrival"
   became "the button names the section on arrival", which is the same
   promise: a filtered arrival must say what it is filtered by. And a
   picker needs no scrollIntoView, because there is nothing to scroll. */
ok('magazine: the picker names the section on arrival',
   (await pickerValue('#ctlMag .ctl-v')) === 'أعمال', await pickerValue('#ctlMag .ctl-v'));
ok('magazine: it is not stuck on «الكل»',
   (await pickerValue('#ctlMag .ctl-v')) !== 'الكل');
ok('magazine: section note present', await page.locator('#magNote .sec-note').count() === 1,
   (await page.textContent('#magNote')).trim());
const magFiltered = await page.evaluate(() => document.querySelectorAll('#magList .mag-card').length);
await go('#/magazine');
const magAll = await page.evaluate(() => document.querySelectorAll('#magList .mag-card').length);
ok('magazine: the filter really filters', magFiltered < magAll, magFiltered + ' vs ' + magAll);
ok('magazine: unfiltered starts on "all"',
   (await pickerValue('#ctlMag .ctl-v')) === 'الكل', await pickerValue('#ctlMag .ctl-v'));

/* home circles + all-categories grid pass the category through */
await go('#/home');
await page.evaluate(() => document.querySelector('.cat-item[data-cat="restaurants"]').click());
await page.waitForTimeout(420);
ok('home circle → filtered directory', (await hash()) === '#/directory?cat=restaurants', await hash());

await go('#/categories');
const catRoutes = await page.evaluate(() => Array.from(document.querySelectorAll('.cat-cell')).map(c => c.dataset.route));
ok('all-categories: marketplace cells carry ?cat=', catRoutes.some(r => r.startsWith('#/marketplace?cat=')));
ok('all-categories: directory cells carry ?cat=', catRoutes.some(r => r.startsWith('#/directory?cat=')));
ok('all-categories: the Events cell opens Events, not an empty filter',
   catRoutes.includes('#/events') && !catRoutes.includes('#/directory?cat=events'));

await page.evaluate(() => document.querySelector('.cat-cell[data-route="#/marketplace?cat=pets"]').click());
await page.waitForTimeout(430);
ok('all-categories → marketplace section', (await hash()) === '#/marketplace?cat=pets', await hash());
cs = { label: await pickerValue('#ctlSec .ctl-v') };
ok('…and lands with the section named on the picker', cs.label === 'حيوانات أليفة', cs.label);

/* back from a filtered destination returns where it came from */
await go('#/home');
await go('#/categories');
await page.evaluate(() => document.querySelector('.cat-cell[data-route="#/marketplace?cat=pets"]').click());
await page.waitForTimeout(430);
await page.goBack(); await page.waitForTimeout(430);
ok('back from a filtered destination returns to the source', (await hash()) === '#/categories', await hash());

/* ======================================================================
   PART 4 — profile is a profile, not a link list
   ====================================================================== */
console.log('--- profile ---');
await go('#/profile');
profRows = await page.evaluate(() => document.querySelectorAll('#app .dr-item').length);
ok('member profile: zero drawer-style link rows', profRows === 0, profRows + ' rows');
const pt = await txt();
// "المفضلة" survives as a stat label, which the brief asks for — what must be
// gone is the link ROW, asserted above by the zero .dr-item count.
/* «عن التطبيق» became «من نحن» in this batch, and the old string then
   appears NOWHERE in the rendered app — measured: zero occurrences across
   `js/` and `index.html`, the one match left being a code comment. So the
   check for it could not fail any more, whatever the profile screen did.
   This is the same shape as v9's `!st.myBusinessId` in 270: a green that
   guards nothing is worse than a red. */
for (const gone of ['الإعدادات', 'المساعدة', 'من نحن', 'الخصوصية', 'الشروط', 'تسجيل الخروج']) {
  ok('profile no longer repeats "' + gone + '"', !pt.includes(gone));
}
ok('profile shows the name', pt.includes('أحمد سالم'));
ok('profile shows the email', pt.includes('ahmad@arabna.app'));
ok('profile shows the join date label', pt.includes('عضو منذ'));
ok('profile shows the account tier', pt.includes('حساب مؤكد'));
/* ⚠️ REVERSAL (475): the «verify your number» step is offered only while
   phone verification is switched ON. With it off the step could never be
   finished — a gold button pointing at a screen that is not registered —
   so the prompt is absent, and its ABSENCE is what must be guarded.
   ⚠️ Read from `PHONE_AUTH` and never written as a verdict: the day the
   switch is flipped this line follows it instead of going stale. */
{
  const on = await page.evaluate(async () => {
    let D; try { D = await import('arabna/js/data.js'); } catch (e) { D = await import('./js/data.js'); }
    return D.PHONE_AUTH;
  });
  ok('profile prompts phone verification only while the road exists',
     pt.includes('وثّق رقمك') === on, 'PHONE_AUTH=' + on);
}
ok('profile keeps edit + change-password', pt.includes('تعديل الملف') && pt.includes('كلمة المرور'));

const stats = await page.evaluate(() => Array.from(document.querySelectorAll('.stat-row .stat'))
  .map(s => ({ tag: s.tagName, route: s.dataset.route || null })));
ok('three stats, all tappable buttons', stats.length === 3 && stats.every(s => s.tag === 'BUTTON'));
ok('stats point at their own lists',
   JSON.stringify(stats.map(s => s.route)) === JSON.stringify(['#/my-ads', '#/saved', '#/my-reviews']),
   JSON.stringify(stats.map(s => s.route)));

for (const [i, route] of [[0, '#/my-ads'], [1, '#/saved'], [2, '#/my-reviews']]) {
  await go('#/profile');
  await page.evaluate((n) => document.querySelectorAll('.stat-row .stat')[n].click(), i);
  await page.waitForTimeout(430);
  ok('stat ' + i + ' opens ' + route, (await hash()) === route, await hash());
}

/* ======================================================================
   PART 5 — the unread counter
   ====================================================================== */
console.log('--- counter ---');
await openDrawer();
const badgeBefore = await page.evaluate(() => {
  const r = Array.from(document.querySelectorAll('.drawer-panel > .dr-item'))
    .find(x => x.dataset.route === '#/notifications');
  const b = r && r.querySelector('.dr-badge');
  return b ? b.textContent.trim() : null;
});
ok('counter shows on the notifications row', badgeBefore && Number(badgeBefore) > 0, 'badge=' + badgeBefore);
await closeDrawer();

await go('#/notifications');
await page.evaluate(() => document.querySelector('.notif-row.unread').click());
await page.waitForTimeout(420);
await go('#/home');
await openDrawer();
const badgeAfter = await page.evaluate(() => {
  const r = Array.from(document.querySelectorAll('.drawer-panel > .dr-item'))
    .find(x => x.dataset.route === '#/notifications');
  const b = r && r.querySelector('.dr-badge');
  return b ? b.textContent.trim() : null;
});
ok('counter drops after one is read', Number(badgeAfter) === Number(badgeBefore) - 1,
   badgeBefore + ' -> ' + badgeAfter);
await closeDrawer();

/* mark everything read → the badge disappears entirely */
await go('#/notifications');
if (await page.locator('#markAll').count()) { await page.click('#markAll'); await page.waitForTimeout(420); }
else {
  const n = await page.evaluate(() => document.querySelectorAll('.notif-row.unread').length);
  for (let i = 0; i < n; i++) {
    await page.evaluate(() => { const r = document.querySelector('.notif-row.unread'); if (r) r.click(); });
    await page.waitForTimeout(320);
    await go('#/notifications');
  }
}
await go('#/home');
await openDrawer();
ok('counter hidden at zero', await page.evaluate(() => {
  const r = Array.from(document.querySelectorAll('.drawer-panel > .dr-item'))
    .find(x => x.dataset.route === '#/notifications');
  return r && !r.querySelector('.dr-badge');
}));
ok('header dot cleared too', await page.evaluate(() => !document.querySelector('#hMenu .dot')));
await closeDrawer();

/* ======================================================================
   PART 6 — English
   ====================================================================== */
console.log('--- English ---');
await openDrawer();
await page.click('#drLang'); await page.waitForTimeout(650);
ok('switched to English', await page.evaluate(() => document.documentElement.lang === 'en'));
ok('LTR applied', await page.evaluate(() => document.documentElement.dir === 'ltr'));

await openDrawer();
const enTxt = await page.textContent('#drawer');
/* it is the head BUTTON now, not a group head — the words survive the move */
ok('EN drawer: «My account» in the head', enTxt.includes('My account'));
ok('EN drawer: "ARABNA categories" group (renamed in V.02.7)', enTxt.includes('ARABNA categories'));
ok('EN drawer: no Arabic left in the drawer chrome', !enTxt.includes('حسابي'));
d = await drawerMap();
ok('EN member drawer is 6 rows too',
   (await page.evaluate(() => Array.from(document.querySelectorAll('.drawer-panel > *'))
     .filter(el => el.classList.contains('dr-item') || el.classList.contains('dr-group')).length)) === 6);
ok('EN drawer still needs no scrolling', d.panelScroll <= d.panelBox + 2, d.panelScroll + ' / ' + d.panelBox);
await closeDrawer();

await go('#/magazine?cat=business');
ok('EN magazine: the picker still names the section on arrival',
   (await pickerValue('#ctlMag .ctl-v')) === 'Business', await pickerValue('#ctlMag .ctl-v'));
ok('EN magazine: section note is English',
   /results/.test((await page.textContent('#magNote')) || ''), (await page.textContent('#magNote')).trim());

await go('#/profile');
const enProf = await txt();
ok('EN profile: no link rows', await page.evaluate(() => document.querySelectorAll('#app .dr-item').length) === 0);
ok('EN profile: stats labelled in English', enProf.includes('Active listings'));

/* ======================================================================
   PART 7 — sign out returns the guest drawer
   ====================================================================== */
console.log('--- sign out ---');
await openDrawer();
await page.click('#drOut'); await page.waitForTimeout(430);
await page.evaluate(() => document.querySelector('#cfmYes').click());
await page.waitForTimeout(700);
ok('signed out lands on home', (await hash()) === '#/home', await hash());

await openDrawer();
d = await drawerMap();
ok('sign out: guest drawer is back immediately', d.invite && !d.logout);
ok('sign out: account tools gone again', !d.topLevel.includes('group:account'));
ok('sign out: notifications gone again', !d.routes.includes('#/notifications'));
await closeDrawer();

/* a personal screen open at sign-out time redirects instead of showing blanks */
await go('#/my-ads');
ok('personal screen after sign-out redirects', (await hash()).startsWith('#/auth/'), await hash());

/* switch back to Arabic for a clean end state */
await go('#/home');
await openDrawer();
await page.click('#drLang'); await page.waitForTimeout(600);
ok('language toggles back to Arabic', await page.evaluate(() => document.documentElement.dir === 'rtl'));

// the Google-Fonts stylesheet cannot be reached from this sandbox
const real = errors.filter(e => !/favicon|ERR_CONNECTION_RESET|Failed to load resource/i.test(e));
ok('no console errors', real.length === 0, real.slice(0, 4).join(' | '));

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);

/* V.01.4 — interface simplification checks (390x844, the size in the brief) */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.env.BASE || 'http://localhost:8123/index.html';
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); } else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const browser = await chromium.launch();
const page = await (await browser.newContext({ colorScheme: 'dark', viewport: { width: 390, height: 844 } })).newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));

const go = async (h) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(300); };
const txt = () => page.textContent('#app');
const drawerTxt = () => page.textContent('#drawer');
const openDrawer = async () => {
  if (!(await page.locator('#hMenu').count())) { await go('#/home'); await page.waitForTimeout(320); }
  await page.click('#hMenu'); await page.waitForTimeout(420);
};
const closeDrawer = async () => {
  await page.evaluate(() => document.querySelector('.drawer-scrim').click());
  await page.waitForTimeout(420);
};
/* a tall sheet can cover its own scrim — dispatch the click directly */
const dismissSheet = async () => {
  await page.evaluate(() => {
    const s = document.querySelector('.sheet-scrim');
    if (s) s.click();
  });
  await page.waitForTimeout(420);
};
const offsetIn = (sel) => page.evaluate((s) => {
  const main = document.querySelector('.app-main'), el = document.querySelector(s);
  if (!el) return null;
  return Math.round(el.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop);
}, sel);

await page.goto(BASE);
await page.waitForTimeout(800);

/* ============ 1. header is menu + logo only ============ */
const head = await page.evaluate(() => ({
  menu: !!document.querySelector('#hMenu'),
  lang: !!document.querySelector('#hLang'),
  bell: !!document.querySelector('#hBell'),
  spacer: !!document.querySelector('.h-spacer'),
  logoOffset: (() => {
    const el = document.querySelector('.h-logo'), h = document.querySelector('.app-header');
    const r = el.getBoundingClientRect(), hr = h.getBoundingClientRect();
    return Math.round(r.left + r.width / 2 - hr.width / 2);
  })(),
}));
ok('header keeps the menu button', head.menu);
ok('header language button removed', !head.lang);
ok('header bell button removed', !head.bell);
/* V.02.7: the spacer became the light/dark button — 44px for 44px, so
   the header still balances and the logo still centres. */
ok('44px control balances the header', await page.evaluate(() => {
  const b = document.querySelector('#hTheme');
  return !!b && Math.round(b.getBoundingClientRect().width) === 44;
}));
ok('logo is centred (AR)', Math.abs(head.logoOffset) <= 1, head.logoOffset + 'px');

await go('#/settings');
ok('detail header has no language button', !(await page.evaluate(() => !!document.querySelector('#hLang'))));
ok('detail header has a back button', await page.evaluate(() => !!document.querySelector('#hBack')));
await go('#/home');

/* ============ language + notifications still reachable from the drawer ============ */
await openDrawer();
ok('language row is first in the drawer', await page.evaluate(() => {
  const rows = Array.from(document.querySelectorAll('.drawer-panel .dr-item'));
  return rows[0] && rows[0].id === 'drLang';
}));
await page.click('#drLang'); await page.waitForTimeout(560);
ok('language toggles from the drawer', (await page.evaluate(() => document.documentElement.lang)) === 'en');
ok('direction flips to LTR', (await page.evaluate(() => document.documentElement.dir)) === 'ltr');
const logoEn = await page.evaluate(() => {
  const el = document.querySelector('.h-logo'), h = document.querySelector('.app-header');
  const r = el.getBoundingClientRect(), hr = h.getBoundingClientRect();
  return Math.round(r.left + r.width / 2 - hr.width / 2);
});
ok('logo stays centred in English', Math.abs(logoEn) <= 1, logoEn + 'px');
await openDrawer(); await page.click('#drLang'); await page.waitForTimeout(560);

/* ============ 2. the search row ============
   V.01.8 batch four split this deliberately: sharing one row with the city
   chip and the filter button squeezed the magnifier to ~13px, so search is
   now a full-width row of its own with the rest underneath. */
for (const [hash, label] of [['#/home', 'home'], ['#/directory', 'directory'], ['#/marketplace', 'marketplace']]) {
  await go(hash);
  const r = await page.evaluate(() => {
    const bar = document.querySelector('.search-row .search-bar.big');
    const chip = document.querySelector('.search-row .loc-chip');
    const svg = bar && bar.querySelector(':scope > svg');
    return {
      row: !!bar,
      oldWrap: !!document.querySelector('.search-wrap'),
      radiusChip: !!document.querySelector('.radius-chip'),
      wide: bar ? Math.round(bar.getBoundingClientRect().width) : 0,
      below: (bar && chip) ? chip.getBoundingClientRect().top > bar.getBoundingClientRect().bottom - 2 : false,
      glass: svg ? Math.round(svg.getBoundingClientRect().width) : 0,
    };
  });
  /* V.02.4: the row carries the search and the city chip; the pickers took
     the sub row. What matters is that the magnifier still cannot shrink. */
  ok(`${label}: the search bar has most of the row`, r.row && r.wide >= 200 && !r.oldWrap, r.wide + 'px');
  ok(`${label}: the magnifier is 22px and does not shrink`, r.glass === 22, r.glass + 'px');
  ok(`${label}: standalone radius chip removed`, !r.radiusChip);
}
await go('#/home');
await page.click('#locBtn'); await page.waitForTimeout(450);
/* V.02.3 reversed this deliberately: the radius chips filtered nothing (no
   listing has coordinates), so the location sheet now holds the real city
   list and the area lives in the filter sheet as counted options. */
ok('the location sheet holds the real city list', await page.evaluate(() =>
  !!document.querySelector('#cityPick') && document.querySelectorAll('#cityPick .chip').length >= 24));
await dismissSheet();

/* ============ 3. home order: categories before the paid slider ============ */
await go('#/home');
const order = await page.evaluate(() => {
  const pos = (s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().top : 1e9; };
  return { cats: pos('#cats'), slider: pos('.slider'), feat: pos('.feat-card'), mini: pos('#miniAd'), mag: pos('.story-card') };
});
ok('categories come first', order.cats < order.slider, `cats ${Math.round(order.cats)} < slider ${Math.round(order.slider)}`);
ok('slider comes before featured', order.slider < order.feat);
ok('featured comes before the mini banner', order.feat < order.mini);
ok('mini banner comes before the magazine', order.mini < order.mag);
ok('all five home blocks still present',
   [order.cats, order.slider, order.feat, order.mini, order.mag].every(v => v < 1e9));
const catsTop = await offsetIn('#cats');
ok('categories are the first thing under the search row', catsTop < 200, catsTop + 'px');

/* ============ 4. category circles ============ */
const cats = await page.evaluate(() => {
  const strip = document.querySelector('#cats');
  const items = Array.from(strip.querySelectorAll('.cat-item'));
  const sr = strip.getBoundingClientRect();
  return {
    count: items.length,
    fully: items.filter(i => { const r = i.getBoundingClientRect(); return r.left >= sr.left - 1 && r.right <= sr.right + 1; }).length,
    circle: Math.round(items[0].querySelector('.cat-circle').getBoundingClientRect().width),
    wrapped: items.filter(i => i.querySelector('.cat-label').getBoundingClientRect().height > 24).length,
    labels: items.map(i => i.querySelector('.cat-label').textContent.trim()),
  };
});
ok('all five circles fit without clipping', cats.fully === 5 && cats.count === 5, `${cats.fully}/${cats.count} visible`);
ok('circle diameter is 56px', cats.circle === 56, cats.circle + 'px');
ok('no label wraps to two lines', cats.wrapped === 0);
ok('labels are single words', cats.labels.every(l => l.split(/\s+/).length === 1), cats.labels.join(' · '));

/* ============ 5. directory: duplication removed ============ */
await go('#/directory');
const dir = await page.evaluate(() => ({
  tabs: !!document.querySelector('.tabs'),
  title: (document.querySelector('#app') || {}).textContent.includes('كل الأعمال العربية بمكان واحد'),
}));
ok('directory/magazine tab bar removed', !dir.tabs);
ok('redundant directory title + subtitle removed', !dir.title);
/* V.02.8 reverses the V.01.4 number on purpose: every section now carries
   a slider and two sponsored rows above its content. What must still hold
   is that the paid block is BOUNDED — one slider and two rows, never a
   third — and that the first thing on screen is an ad slot, not a heading. */
const firstBiz = await offsetIn('.list-row');
ok('the first row on screen is the paid block, and it starts high',
   firstBiz <= 380, firstBiz + 'px');
ok('…and the paid block is one slider and two rows, no more', await page.evaluate(() =>
  document.querySelectorAll('#catSlider .slider').length === 1
  && document.querySelectorAll('#sponRows .list-row.spon').length <= 2));
const upsellPos = await page.evaluate(() => {
  const rows = Array.from(document.querySelectorAll('#dirList .list-row'));
  return rows.findIndex(r => r.getAttribute('data-route') === '#/subscribe');
});
ok('upsell sits after the first five results', upsellPos === 5, 'index ' + upsellPos);
const heights = await page.evaluate(() => {
  const rows = Array.from(document.querySelectorAll('#dirList .list-row'));
  const up = rows.find(r => r.getAttribute('data-route') === '#/subscribe');
  const biz = rows.find(r => r.getAttribute('data-route') !== '#/subscribe');
  return { up: Math.round(up.getBoundingClientRect().height), biz: Math.round(biz.getBoundingClientRect().height) };
});
ok('upsell is no taller than a business row', heights.up <= heights.biz + 4, `upsell ${heights.up}px / row ${heights.biz}px`);
ok('upsell still links to the subscription', await page.evaluate(() => !!document.querySelector('#dirList [data-route="#/subscribe"]')));

/* ============ 6. slimmer business card ============ */
const card = await page.evaluate(() => {
  const row = document.querySelector('#dirList .list-row');
  return {
    text: row.textContent.replace(/\s+/g, ' '),
    call: !!row.querySelector('[data-call]'),
    directions: !!row.querySelector('[data-map]'),
    height: Math.round(row.getBoundingClientRect().height),
  };
});
ok('written phone number removed from the card', !/\(\d{3}\)/.test(card.text), card.text.slice(0, 60));
ok('call button kept on the card', card.call);
ok('directions button moved off the card', !card.directions);
await go('#/directory/b1');
ok('directions is on the business detail page', await page.evaluate(() => !!document.querySelector('#mapBtn')));

/* ============ 7. marketplace ============ */
await go('#/marketplace');
const mk = await page.evaluate(() => {
  const body = document.querySelector('#app').textContent;
  return {
    noteAlways: body.includes('حساب مجاني: حتى 5 إعلانات'),
    postLink: Array.from(document.querySelectorAll('.section-head .link-gold')).some(a => a.getAttribute('data-route') === '#/post'),
    sub: body.includes('بيع وشراء بين الأفراد'),
    infoBtn: !!document.querySelector('#rulesBtn'),
  };
});
ok('always-on free-account note removed from browsing', !mk.noteAlways);
ok('duplicate "+ post" link removed (floating button remains)', !mk.postLink);
ok('subtitle removed from the marketplace header', !mk.sub);
ok('(i) button added next to the title', mk.infoBtn);
await page.click('#rulesBtn'); await page.waitForTimeout(450);
ok('(i) opens the rules sheet with the same text',
   (await page.textContent('#sheet')).includes('حساب مجاني: حتى 4 إعلانات'));
await dismissSheet();
ok('floating post button still works', await page.evaluate(() => !!document.querySelector('#bottomNav .nav-post')));
await go('#/post');
ok('the rules now show inside the post form', (await txt()).includes('حساب مجاني') || (await txt()).includes('إعلان واحد نشط'));

/* ============ 8. unified filter sheet ============ */
for (const [hash, btn, label] of [['#/directory', '#dirFilter', 'directory'], ['#/marketplace', '#mkFilter', 'marketplace']]) {
  await go(hash);
  ok(`${label}: filter button next to the search field`, await page.evaluate((b) => !!document.querySelector(b), btn));
  await page.click(btn); await page.waitForTimeout(450);
  const sheet = await page.textContent('#sheet');
  /* the category row is gone on purpose: it repeated the chips behind the
     sheet, and the grid button opens the full box instead */
  ok(`${label}: the sheet no longer repeats the category row`, !sheet.includes('الفئة'));
  // the directory filters by area (counted options); the marketplace has
  // no distance data at all, so it carries the sort and the price only
  ok(`${label}: sheet has ${label === 'marketplace' ? 'sort' : 'area + sort'}`,
     sheet.includes('الترتيب') && (label === 'marketplace' ? !sheet.includes('المنطقة') : sheet.includes('المنطقة')));
  ok(`${label}: price range ${label === 'marketplace' ? 'present' : 'absent'}`,
     (label === 'marketplace') === sheet.includes('نطاق السعر'));
  /* V.02.3: "sticky" inside a panel taller than the screen covered the
     last group on a device. The footer is a flex sibling of the scrolling
     body now — pinned, and overlapping nothing. */
  ok(`${label}: a pinned footer with clear-all and a live count`,
     await page.evaluate(() => {
       const panel = document.querySelector('.sheet-panel');
       const foot = panel && panel.querySelector('.sheet-foot');
       if (!foot) return false;
       return foot.parentElement === panel
         && getComputedStyle(panel).flexDirection === 'column'
         && !!foot.querySelector('#fClear') && !!foot.querySelector('#fApply');
     }));
  await dismissSheet();
  /* V.02.4: the chips row that scrolled sideways became a picker with a
     vertical list — the categories are all still reachable, in one tap. */
  ok(`${label}: the category picker is there and names the choice`, await page.evaluate(() => {
    const b = document.querySelector('#ctlCat, #ctlSec');
    return !!b && !!b.querySelector('.ctl-v').textContent.trim();
  }));
}
// applying a filter shows a count and actually filters
await go('#/directory');
await page.click('#dirFilter'); await page.waitForTimeout(450);
await page.click('#fSort .chip[data-s="rated"]'); await page.waitForTimeout(150);
await page.click('#fApply'); await page.waitForTimeout(500);
/* V.03.7 REVERSED this. Choosing a sort used to make the badge read 1
   over a list that had not lost a single row — ordering 514 results
   differently is not filtering them, and the sort already prints its
   chosen value in gold on its own picker. `activeFilterCount` excluded
   the category for exactly this reason and now excludes the sort with it.
   So the badge stays empty here, and a REAL filter is what has to move
   it. */
ok('a sort alone leaves the filter badge empty',
   (await page.textContent('#fCount')).trim() === '',
   (await page.textContent('#fCount')).trim() || '(empty)');
await page.click('#dirFilter'); await page.waitForTimeout(450);
await page.click('#fOpenNow'); await page.waitForTimeout(150);
await page.click('#fApply'); await page.waitForTimeout(500);
ok('…and a real filter does move it', (await page.textContent('#fCount')).trim() === '1',
   (await page.textContent('#fCount')).trim());
// back to sort-only, which is the state the rest of this block measures
await page.click('#dirFilter'); await page.waitForTimeout(450);
await page.click('#fOpenNow'); await page.waitForTimeout(150);
await page.click('#fApply'); await page.waitForTimeout(500);
/* V.02.8: the top-rated business may be lifted into the sponsored band on
   some visits, so "is it the first row" is not the invariant any more.
   These two are: it is at the top of the screen one way or the other, and
   what remains in the list really is ordered by rating. */
const sorted = await page.evaluate(async () => {
  const S = await import('./js/store.js');
  const topName = S.allBusinesses().slice()
    .sort((a, b) => S.ratingFor(b).avg - S.ratingFor(a).avg)[0].name.ar;
  const band = [...document.querySelectorAll('#sponRows .list-row.spon')]
    .map(r => r.textContent);
  const rows = [...document.querySelectorAll('#dirList .list-row')];
  const firstOrganic = rows.find(r => !r.querySelector('.badge-sponsored'));
  /* the rating comes from the store, not from scraping digits out of a row
     that also carries a phone number and a review count */
  const rated = rows
    .filter(r => !r.querySelector('.badge-sponsored'))
    .map(r => (r.dataset.route || '').split('/').pop())
    .map(id => S.allBusinesses().find(b => b.id === id))
    .filter(Boolean)
    .map(b => S.ratingFor(b).avg);
  return {
    atTop: band.some(x => x.includes(topName))
        || (firstOrganic && firstOrganic.textContent.includes(topName))
        || rows.slice(0, 2).some(r => r.textContent.includes(topName)),
    descending: rated.every((n, i) => i === 0 || rated[i - 1] >= n),
    topName,
  };
});
ok('sorting by rating puts the top-rated business at the top', sorted.atTop, sorted.topName);
ok('…and the rest really are in rating order', sorted.descending);
await page.click('#dirFilter'); await page.waitForTimeout(450);
await page.click('#fClear'); await page.waitForTimeout(500);
ok('clear all resets the counter', (await page.textContent('#fCount')).trim() === '');

/* ============ 9. drawer: cleaned then folded ============
   V.01.5 splits the drawer in two, so this section now inspects the member
   version — the guest version has its own suite (test_v5.mjs). */
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  s.user = { name: 'رامي', email: 'r@a.app', password: 'x', emailVerified: true,
             phone: '(713) 466-9182', phoneVerified: true, joined: Date.now(), avatar: null, badge: null };
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});
await page.reload(); await page.waitForTimeout(700);
await go('#/home');
await openDrawer();
const dr = await page.evaluate(() => {
  const panel = document.querySelector('.drawer-panel');
  const body = panel.textContent;
  const content = Array.from(panel.children).reduce((h, c) => h + c.getBoundingClientRect().height, 0);
  return {
    height: Math.round(content),
    panelH: Math.round(panel.getBoundingClientRect().height),
    groups: panel.querySelectorAll('.dr-group').length,
    openGroups: panel.querySelectorAll('.dr-group.open').length,
    hasMarketSections: body.includes('حيوانات أليفة') || body.includes('خدمات وصيانة'),
    hasHome: /(^|\s)الرئيسية(\s|$)/.test(body),
    hasDirectory: /(^|\s)الدليل(\s|$)/.test(body),
    // V.03.4: «بزنسي» is «نشاطي التجاري» — the glossary word for a shop
    personal: ['نشاطي التجاري', 'إعلاناتي', 'تقييماتي', 'رسائلي', 'المفضلة', 'الاشتراك'].filter(x => body.includes(x)),
    lang: !!panel.querySelector('#drLang'),
  };
});
ok('marketplace sections removed from the drawer', !dr.hasMarketSections);
// V.01.5 put Directory back; V.01.7 takes Home out again — it is the screen
// the app opens on and it owns a permanent bottom-bar tab.
/* V.02.7 takes الدليل out too, for the same reason Home went: it owns a
   permanent bottom-bar tab, and the drawer is not a second copy of it. */
ok('home and directory both out of the drawer', !dr.hasHome && !dr.hasDirectory);
// V.01.5 also moves the personal rows back, into their own folded group.
ok('personal rows live in the account group', dr.personal.length === 6, dr.personal.join(', ') || 'none');
ok('three collapsible groups', dr.groups === 3, dr.groups + ' groups');
ok('all groups start collapsed', dr.openGroups === 0);
ok('drawer needs no scrolling', dr.height <= dr.panelH, `${dr.height}px content / ${dr.panelH}px panel`);
ok('language row stays outside any group', dr.lang);

// accordion: one open at a time
await page.click('[data-toggle="sections"]'); await page.waitForTimeout(400);
ok('a group opens on tap', await page.evaluate(() => document.querySelectorAll('.dr-group.open').length === 1));
ok('aria-expanded is set', await page.evaluate(() =>
  document.querySelector('[data-toggle="sections"]').getAttribute('aria-expanded') === 'true'));
await page.click('[data-toggle="help"]'); await page.waitForTimeout(400);
ok('opening another group closes the first', await page.evaluate(() => {
  const open = Array.from(document.querySelectorAll('.dr-group.open'));
  return open.length === 1 && open[0].dataset.group === 'help';
}));
ok('every moved destination is still reachable', await page.evaluate(() => {
  const routes = Array.from(document.querySelectorAll('.drawer-panel [data-route]')).map(a => a.dataset.route);
  // الدليل and السوق are reached from the bottom bar, not from here
  return ['#/categories', '#/events', '#/magazine',
          '#/advertise', '#/notifications', '#/settings', '#/help', '#/about',
          '#/privacy', '#/terms'].every(r => routes.includes(r));
}));
await closeDrawer();

/* V.01.5 reverses the V.01.4 placement: what is in the drawer is NOT
   repeated as a row on the profile screen. */
await go('#/profile');
const profBody = await txt();
ok('profile repeats no drawer row',
   await page.evaluate(() => document.querySelectorAll('#app .dr-item').length) === 0);
ok('profile keeps identity + counters instead',
   profBody.includes('r@a.app') && profBody.includes('إعلانات نشطة'));

/* ============ 10. notifications ============ */
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  s.readNotifs = [];
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});
await page.reload(); await page.waitForTimeout(800);
await openDrawer();
// V.01.5: notifications became a standalone row, so the count sits on the row
// itself and no longer has to be rolled up onto a folded group head.
const notifRow = () => page.evaluate(() => {
  const r = Array.from(document.querySelectorAll('.drawer-panel > .dr-item'))
    .find(x => x.dataset.route === '#/notifications');
  const b = r && r.querySelector('.dr-badge');
  return { standalone: !!r, text: b ? b.textContent.trim() : null };
});
const badge = await notifRow();
ok('unread count shows on the standalone notifications row', badge.standalone && badge.text === '2', 'badge ' + badge.text);
await closeDrawer();

await go('#/notifications');
const nt = await page.evaluate(() => {
  const body = document.querySelector('#app').textContent;
  return {
    hasNew: body.includes('جديد'), hasOlder: body.includes('أقدم'),
    unreadRows: document.querySelectorAll('.notif-row.unread').length,
    markAll: !!document.querySelector('#readAll'),
    dotColour: (() => {
      const r = document.querySelector('.notif-row.unread');
      return r ? getComputedStyle(r, '::before').backgroundColor : null;
    })(),
  };
});
ok('notifications split into New / Earlier', nt.hasNew && nt.hasOlder);
ok('unread rows are marked', nt.unreadRows === 2, nt.unreadRows + ' unread');
ok('gold marker on unread rows', /228|226/.test(nt.dotColour || ''), nt.dotColour);
ok('"mark all as read" button shown while unread exist', nt.markAll);
ok('opening the screen does NOT clear the counter', await page.evaluate(() =>
  JSON.parse(localStorage.getItem('arabna.v1')).readNotifs.length === 0));

// tapping one marks only that one and navigates
await page.click('.notif-row.unread'); await page.waitForTimeout(600);
ok('tapping a notification navigates somewhere', (await page.evaluate(() => location.hash)) !== '#/notifications',
   await page.evaluate(() => location.hash));
ok('only the tapped notification is marked read', await page.evaluate(() =>
  JSON.parse(localStorage.getItem('arabna.v1')).readNotifs.length === 1));
await go('#/notifications');
await page.click('#readAll'); await page.waitForTimeout(600);
ok('mark-all clears every unread', await page.evaluate(() => document.querySelectorAll('.notif-row.unread').length === 0));
await openDrawer();
ok('badge disappears at zero (no "0" shown)', (await notifRow()).text === null);
await closeDrawer();
// 9+ cap
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1'));
  s.readNotifs = [];
  s.extraNotifs = Array.from({ length: 12 }, (_, i) => ({
    id: 'bulk' + i, icon: 'bell', unread: true,
    title: { ar: 'تنبيه', en: 'Alert' }, body: { ar: 'نص', en: 'text' },
    when: { ar: 'الآن', en: 'now' },
  }));
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});
await page.reload(); await page.waitForTimeout(800);
await openDrawer();
ok('badge caps at +9', (await notifRow()).text === '+9');
await closeDrawer();

/* empty state */
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1'));
  s.extraNotifs = []; s.readNotifs = [];
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});
await page.reload(); await page.waitForTimeout(700);

/* ============ 11. untouched things ============ */
await go('#/home');
const keep = await page.evaluate(() => ({
  navTabs: document.querySelectorAll('#bottomNav .nav-item').length,
  postBtn: !!document.querySelector('.nav-post'),
  slider: !!document.querySelector('.slider'),
  chips: document.querySelectorAll('.chip').length > 0,
}));
ok('bottom nav still has 5 tabs + the floating post button', keep.navTabs === 5 && keep.postBtn);
ok('sponsored slider still on home', keep.slider);
await go('#/directory/b1');
ok('verified badge still shown', (await txt()).includes('موثّق'));
await go('#/events');
ok('events (previous batch) still work', (await txt()).includes('الفعاليات'));
await go('#/profile/password');
ok('password eye (previous batch) still works', await page.evaluate(() => !!document.querySelector('[data-eye="cpNew"]')));

/* ============ both languages, no blank screens, no console errors ============ */
await go('#/home');
await openDrawer(); await page.click('#drLang'); await page.waitForTimeout(560);
await go('#/directory');
ok('EN: directory renders', ((await txt()) || '').length > 60);
ok('EN: short category labels', await page.evaluate(async () => {
  location.hash = '#/home';
  await new Promise(r => setTimeout(r, 400));
  return Array.from(document.querySelectorAll('#cats .cat-label')).every(l => l.textContent.trim().split(/\s+/).length === 1);
}));
await openDrawer();
ok('EN: drawer groups translated', (await drawerTxt()).includes('ARABNA categories'));
await closeDrawer();
await openDrawer(); await page.click('#drLang'); await page.waitForTimeout(560);

const routes = ['#/home','#/categories','#/events','#/events/e1','#/directory','#/directory/b1','#/marketplace',
  '#/marketplace?cat=free','#/post','#/profile','#/profile/edit','#/profile/password','#/my-ads','#/my-reviews',
  '#/my-business','#/messages','#/settings','#/notifications','#/help','#/about','#/privacy','#/terms',
  '#/magazine','#/advertise','#/subscribe','#/claim','#/add-business','#/admin'];
const blank = [];
for (const r of routes) {
  await go(r);
  if (((await txt()) || '').trim().length < 25) blank.push(r);
}
ok('no blank screens', blank.length === 0, blank.join(', ') || routes.length + ' routes');

const real = errors.filter(e => !/favicon|ERR_CONNECTION_RESET|Failed to load resource/i.test(e));
ok('no console errors', real.length === 0, real.slice(0, 4).join(' | '));

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);

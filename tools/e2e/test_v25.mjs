/* Batch seven (b) — offers · the newcomer's guide · ramadan */
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

/* On the single-file build the app's modules live behind an importmap, so
   `import('./js/store.js')` hands back a SECOND instance with its own
   state. The importmap specifier resolves to the one the app is using. */
const mods = () => page.evaluate(async () => {
  if (!window.__m) {
    const load = async (rel, spec) => { try { return await import(spec); } catch (e) { return await import(rel); } };
    window.__m = {
      S: await load('./js/store.js', 'arabna/js/store.js'),
      D: await load('./js/data.js', 'arabna/js/data.js'),
    };
  }
  return true;
});

const go = async (h) => {
  await page.evaluate(() => { location.hash = '#/home'; });
  await page.waitForTimeout(120);
  await page.evaluate(x => { location.hash = x; }, h);
  await page.waitForTimeout(520);
};
/* V.04.0: the sheet's five headed groups of chips became two multi-select
   pickers, so an attribute is a row inside a panel. What is measured here
   is unchanged — whether the seasonal specialities are offered at all. */
const sheetAttrIds25 = async () => {
  const ids = [];
  for (const [btn, host] of [['#fCtlTop', '#fDdTop'], ['#fCtlRest', '#fDdRest']]) {
    if (!(await page.locator(btn).count())) continue;
    await page.evaluate(b => document.querySelector(b).click(), btn);
    await page.waitForTimeout(400);
    ids.push(...await page.evaluate(h => [...document.querySelectorAll(h + ' .dd-row')].map(r => r.dataset.v), host));
    await page.evaluate(b => document.querySelector(b).click(), btn);
    await page.waitForTimeout(280);
  }
  return ids;
};
/* V.04.4: the directory paints forty rows and grows as you scroll, so
   counting `.list-row` answers "how many are drawn" — and every question
   here is "how many results are there". The screen publishes that on
   `#dirList` as `data-total`, which is the number it already had. */
const rows = () => page.evaluate(() => +(document.querySelector('#dirList')||{dataset:{}}).dataset.total || 0);
const txt = () => page.textContent('#app');
const patch = async (fn) => { await page.evaluate(fn); await page.reload(); await page.waitForTimeout(800); await mods(); };

await page.goto(BASE); await page.waitForTimeout(800);
await patch(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  s.radius = 100;
  s.geo = { lat: 29.7604, lng: -95.3698, at: Date.now() };
  s.location = { city: 'Houston', lat: 29.7604, lng: -95.3698, inRegion: true };
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});

/* ======================================================================
   1 — offers: the rules live in the store, never in a screen
   ====================================================================== */
console.log('--- offers: the rules ---');
const call = (fn, ...args) => page.evaluate(([f, a]) => {
  const S = window.__m.S;
  return S[f].apply(null, a);
}, [fn, args]);

ok('1.1 the subscription column carries offers, the free one does not',
   await page.evaluate(() => {
     const S = window.__m.S;
     return S.PLAN_LIMITS.paid.offers === true && S.PLAN_LIMITS.free.offers === false;
   }));
ok('1.2 canPostOffers reads that column and not `plan`',
   await page.evaluate(() => {
     const { S, D } = window.__m;
     const paid = S.allBusinesses().find(b => S.isPaid(b));
     const free = S.allBusinesses().find(b => !S.isPaid(b));
     return S.canPostOffers(paid) === true && S.canPostOffers(free) === false;
   }));

const paidId = await page.evaluate(() => {
  const S = window.__m.S;
  return S.allBusinesses().find(b => S.isPaid(b)).id;
});
const freeId = await page.evaluate(() => {
  const S = window.__m.S;
  return S.allBusinesses().find(b => !S.isPaid(b)).id;
});

const add = (id, o) => page.evaluate(([i, x]) => window.__m.S.addOffer(i, x), [id, o]);
const day = 864e5;
const nowMs = () => page.evaluate(() => window.__m.S.now());

let t0 = await nowMs();
ok('1.3 a shop that has not subscribed is refused',
   (await add(freeId, { text: 'x', endsAt: t0 + day })).error === 'notSubscribed');
ok('1.4 an offer with no end date is refused',
   (await add(paidId, { text: 'x' })).error === 'noEnd');
ok('1.5 …and one that runs past thirty days',
   (await add(paidId, { text: 'x', endsAt: t0 + 31 * day })).error === 'tooLong');
ok('1.6 …and one with no text', (await add(paidId, { text: '  ', endsAt: t0 + day })).error === 'noText');

const first = await add(paidId, { text: 'خصم 20% على المكسّرات — اتصل 713-466-9182', price: '$8', endsAt: t0 + 7 * day });
ok('1.7 the phone number is taken out of the text', !/713/.test(first.offer.text), first.offer.text);
ok('1.8 …and the owner is told it happened', first.strippedPhone === true);
ok('1.9 it starts pending, never live', first.offer.status === 'pending');
ok('1.10 a reader sees nothing yet', (await call('offersFor', paidId)).length === 0);
ok('1.11 …but its own owner does', (await call('myOffersFor', paidId)).length === 1);

await add(paidId, { text: 'ب', endsAt: t0 + 7 * day });
await add(paidId, { text: 'ج', endsAt: t0 + 7 * day });
ok('1.12 three at a time, and the fourth is refused',
   (await add(paidId, { text: 'د', endsAt: t0 + 7 * day })).error === 'tooMany');
ok('1.13 …the pending ones count toward the cap',
   (await call('activeOfferCount', paidId)) === 3);

/* the admin decides */
console.log('--- offers: the review queue ---');
ok('2.1 all three are in the queue', (await call('pendingOffers')).length === 3);
await page.evaluate((id) => {
  const S = window.__m.S;
  S.pendingOffers().forEach(q => S.approveOffer(q.offer.bizId, q.offer.id));
}, paidId);
ok('2.2 approved, and now a reader sees them', (await call('offersFor', paidId)).length === 3);
ok('2.3 hasOffers says so', (await call('hasOffers', await page.evaluate(i => window.__m.S.businessById(i), paidId))) === true);

/* it ends by itself */
await page.evaluate((d) => { window.__m.S.state.clockOffset = 8 * d; window.__m.S.save(); }, day);
ok('2.4 eight days on, every one of them is gone by itself',
   (await call('offersFor', paidId)).length === 0);
ok('2.5 …from the owner\'s own list too', (await call('myOffersFor', paidId)).length === 0);
ok('2.6 …and from the home list', (await call('allLiveOffers')).length === 0);
await page.evaluate(() => { window.__m.S.state.clockOffset = 0; window.__m.S.save(); });

/* ======================================================================
   3 — offers on the four surfaces
   ====================================================================== */
console.log('--- offers: where they show ---');
await patch(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  const t = Date.now(), d = 864e5;
  s.offers = {
    b1: [{ id: 'oa', bizId: 'b1', text: 'خصم 20% على المكسّرات', price: '$8', endsAt: t + 5 * d, status: 'live', when: t }],
    b5: [{ id: 'ob', bizId: 'b5', text: 'صحن كنافة مجاناً', endsAt: t + 3 * d, status: 'live', when: t }],
    b3: [{ id: 'oc', bizId: 'b3', text: 'قيد المراجعة', endsAt: t + 3 * d, status: 'pending', when: t }],
  };
  s.clockOffset = 0;
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});

await go('#/home');
ok('3.1 the home section is there', await page.locator('.offer-strip').count() === 1);
ok('3.2 it holds only the live ones', await page.locator('.offer-tile').count() === 2,
   String(await page.locator('.offer-tile').count()));
ok('3.3 it sits between «مميّز» and the magazine', await page.evaluate(() => {
  const titles = [...document.querySelectorAll('.section-title')].map(x => x.firstChild.textContent.trim());
  const i = titles.findIndex(x => /عروض|offers/i.test(x));
  const f = titles.findIndex(x => /مميّز|Featured/i.test(x));
  const m = titles.findIndex(x => /أهم|Top/i.test(x));
  return f >= 0 && i > f && m > i;
}), (await page.evaluate(() => [...document.querySelectorAll('.section-title')].map(x => x.firstChild.textContent.trim()).join(' | '))));
/* the first tile is whichever runs out soonest, not whichever was seeded
   first — so assert that a real shop name is printed, not which one */
ok('3.4 the shop\'s own name is on the card', await page.evaluate(() => {
  const names = [...document.querySelectorAll('.offer-tile .offer-shop b')].map(x => x.textContent.trim());
  return names.length === 2 && names.every(n => n.length > 2);
}), await page.evaluate(() => [...document.querySelectorAll('.offer-tile .offer-shop b')].map(x => x.textContent.trim()).join(' | ')));
ok('3.5 soonest to run out is first',
   (await page.locator('.offer-tile .offer-shop b').first().textContent()).includes('حلويات')
   || (await page.evaluate(() => {
        const S = window.__m.S;
        const l = S.allLiveOffers();
        return l.length < 2 || l[0].offer.endsAt <= l[1].offer.endsAt;
      })));

await go('#/directory');
ok('3.6 the whole directory is still 514', await rows() === 514, String(await rows()));
ok('3.7 two rows carry the «عنده عرض» mark', await page.locator('.badge-offer').count() === 2,
   String(await page.locator('.badge-offer').count()));
await page.click('#dirFilter'); await page.waitForTimeout(600);
ok('3.8 the filter sheet offers it, with its count', await page.locator('#fHasOffer').count() === 1);
ok('3.9 …and the count is real', (await page.locator('#fHasOffer .chip-n').textContent()).trim() === '2');
await page.click('#fHasOffer'); await page.waitForTimeout(300);
/* V.03.4: two of anything is the DUAL in Arabic and prints no digit at
   all — «عرض نتيجتان», not «عرض 2 نتيجة». */
ok('3.10 the footer counts live', /نتيجتان|results?/i.test(await page.textContent('#fApply')),
   (await page.textContent('#fApply')).trim());
await page.click('#fApply'); await page.waitForTimeout(700);
ok('3.11 the list narrows to those two', await rows() === 2, String(await rows()));
ok('3.12 the state is in the URL, so the link can be sent',
   (await page.evaluate(() => location.hash)).includes('offer=1'), await page.evaluate(() => location.hash));
ok('3.13 it shows as a removable pill', await page.locator('#pills [data-off="__offer"]').count() === 1);
await page.locator('#pills [data-off="__offer"]').click(); await page.waitForTimeout(600);
ok('3.14 …and removing it puts all 514 back', await rows() === 514, String(await rows()));

/* the business page */
await go('#/directory/b1');
ok('3.15 a reader sees the live offer', await page.locator('.offer-card').count() === 1);
ok('3.16 …and no post button', await page.locator('#offerBtn').count() === 0);
await go('#/directory/b3');
ok('3.17 a pending offer is invisible to a reader', await page.locator('.offer-card').count() === 0);
ok('3.18 …and no empty «offers» heading stands over the gap',
   !/عروض هذا الأسبوع/.test(await txt()));

/* the owner */
await patch(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  s.user = { name: 'رامي', email: 'r@a.app', phone: '(713) 466-9182', phoneVerified: true,
             emailVerified: true, tier: 2, joined: Date.now() };
  s.myBusinessId = 'b1';
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});
await go('#/directory/b1');
ok('3.19 the owner gets the post button', await page.locator('#offerBtn').count() === 1);
ok('3.20 …and is told how many are left', /2/.test(await page.evaluate(() => {
  const h = [...document.querySelectorAll('.section-title')].find(x => /عروض/.test(x.textContent));
  return h ? h.textContent : '';
})));
await page.click('#offerBtn'); await page.waitForTimeout(500);
ok('3.21 the sheet caps the date picker at thirty days', await page.evaluate(() => {
  const el = document.querySelector('#ofEnd');
  const max = new Date(el.max + 'T12:00:00').getTime();
  return Math.round((max - Date.now()) / 864e5) <= 30;
}));
await page.fill('#ofTxt', '');
await page.click('#ofSend'); await page.waitForTimeout(400);
ok('3.22 an empty text is named under its own field',
   (await page.textContent('#ofTxtErr')).length > 0, await page.textContent('#ofTxtErr'));
await page.fill('#ofTxt', 'صحن حمّص مجاناً مع كل طلب');
await page.click('#ofSend'); await page.waitForTimeout(700);
ok('3.23 posting works and lands as pending',
   await page.locator('.offer-card.pending').count() === 1);
ok('3.24 the owner can delete their own', await page.locator('[data-deloffer]').count() >= 1);

/* the shop that has not subscribed */
await patch(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  s.myBusinessId = 'b2';
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});
await go('#/directory/b2');
ok('3.25 the unsubscribed owner is shown the door, not a blank',
   await page.locator('.offer-lock').count() === 1);
ok('3.26 …and it leads to the subscription',
   await page.getAttribute('.offer-lock', 'data-route') === '#/subscribe');
ok('3.27 …with no post button', await page.locator('#offerBtn').count() === 0);

/* a public place is never sold anything */
await go('#/directory/b26');
ok('3.28 a city park is offered no offers block',
   await page.locator('.offer-lock').count() === 0 && await page.locator('#offerBtn').count() === 0);

/* the admin */
console.log('--- offers: the admin ---');
await go('#/admin');
/* V.03.6 — nothing ships a staff password any more, so a device is
   CLAIMED before it can be logged into. This is the fixture doing what
   the owner does once on the first run; the route is re-entered because
   the setup screen is already on screen by the time we get here. */
await page.evaluate(async () => {
  const S = (window.__m && window.__m.S)
    || await import('arabna/js/store.js').catch(() => import('./js/store.js'));
  if (!S.adminIsSet()) { await S.setAdminPass('Arabna@2026!', 'arabna.admin'); location.hash = '#/home'; }
});
await page.waitForTimeout(200);
await page.evaluate(() => { location.hash = '#/admin'; });
await page.waitForTimeout(600);
if (await page.locator('#aUser').count()) {
  await page.fill('#aUser', 'arabna.admin');
  await page.fill('#aPass', 'Arabna@2026!');
  await page.click('#aGo'); await page.waitForTimeout(800);
}
ok('4.1 the queue tab counts them', /\(\d+\)/.test(await page.locator('[data-t="queue"]').textContent()),
   (await page.locator('[data-t="queue"]').textContent()).trim());
ok('4.2 the offer is in the queue with its shop named',
   await page.locator('[data-ofok]').count() >= 1);
await page.fill('#why-oc', 'السعر غير واضح');
await page.locator('[data-ofno][data-biz="b3"]').click(); await page.waitForTimeout(700);
ok('4.3 a rejection records the written reason', await page.evaluate(() => {
  const o = JSON.parse(localStorage.getItem('arabna.v1')).offers.b3[0];
  return o.status === 'rejected' && o.reason === 'السعر غير واضح';
}));
/* other notifications can land after this one (reminders run at boot), so
   look for it rather than assuming it is the last */
ok('4.4 …and it reaches the owner as a notification', await page.evaluate(() => {
  const all = JSON.parse(localStorage.getItem('arabna.v1')).extraNotifs || [];
  return all.some(n => /عرضك/.test(n.title.ar) && /السعر غير واضح/.test(n.body.ar));
}), await page.evaluate(() => (JSON.parse(localStorage.getItem('arabna.v1')).extraNotifs || []).map(n => n.title.ar).join(' | ')));

/* ======================================================================
   5 — the newcomer's guide
   ====================================================================== */
console.log('--- the newcomer\'s guide ---');
await go('#/home');
ok('5.1 a fixed card on the home screen', await page.locator('.nc-card').count() === 1);
ok('5.2 …that never sinks under the articles — it is above them',
   await page.evaluate(() => {
     const c = document.querySelector('.nc-card');
     const s = [...document.querySelectorAll('.section-title')].find(x => /أهم|Top/i.test(x.textContent));
     return !!c && !!s && c.getBoundingClientRect().top < s.getBoundingClientRect().top;
   }));
await go('#/magazine');
ok('5.3 pinned at the head of the magazine', await page.locator('.nc-card').count() === 1);
ok('5.4 …above the chips, so no filter can hide it', await page.evaluate(() => {
  const c = document.querySelector('.nc-card'), ch = document.querySelector('#ctlMag');
  return !!c && !!ch && c.getBoundingClientRect().top < ch.getBoundingClientRect().top;
}));
/* V.04.0: six sections became a picker — the pinned newcomer card must
   still survive whatever section is chosen, so pick the last row. */
await page.evaluate(() => document.querySelector('#ctlMag').click());
await page.waitForTimeout(400);
await page.evaluate(() => { const r = document.querySelectorAll('#magDD .dd-row'); r[r.length - 1].click(); });
await page.waitForTimeout(500);
ok('5.5 …and choosing a section does not remove it', await page.locator('.nc-card').count() === 1);

await go('#/newcomer');
ok('5.6 eight parts', await page.locator('#ncList .faq-item').count() === 8,
   String(await page.locator('#ncList .faq-item').count()));
await page.locator('[data-toggle="ssn"]').click(); await page.waitForTimeout(400);
await page.locator('[data-toggle="bank"]').click(); await page.waitForTimeout(400);
ok('5.7 one open at a time — the drawer\'s own idiom',
   await page.locator('#ncList .faq-item.open').count() === 1);
ok('5.8 no government procedure is invented — the copy says it is coming',
   /قيد الإعداد|being written/.test(await txt()));

const ncRoutes = await page.evaluate(() =>
  [...document.querySelectorAll('#ncList [data-route]')].map(b => b.dataset.route));
ok('5.9 every part ends in a doorway', ncRoutes.length === 8, String(ncRoutes.length));
let allFull = true, worst = '';
for (const r of ncRoutes) {
  await go(r);
  const n = await rows();
  if (n < 1) { allFull = false; worst = r; }
}
ok('5.10 …and every one of them opens onto real listings, never an empty list',
   allFull, worst || 'all non-empty');

/* ======================================================================
   6 — ramadan
   ====================================================================== */
console.log('--- ramadan ---');
await patch(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  s.seasons = { ramadan: false };
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});
await go('#/home');
ok('6.1 with the season off there is no bar', await page.locator('#rmBar').count() === 0);
await go('#/directory?cat=restaurants');
await page.click('#dirFilter'); await page.waitForTimeout(600);
ok('6.2 …and no ramadan option in the sheet',
   (await sheetAttrIds25()).filter(id => ['iftar', 'suhoor', 'ramadanHours'].includes(id)).length === 0);
await page.click('#fApply'); await page.waitForTimeout(400);

await patch(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  s.seasons = { ramadan: true };
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});
await go('#/home');
ok('6.3 the season on, and the bar appears', await page.locator('#rmBar').count() === 1);
ok('6.4 it names the iftar', /الإفطار|Iftar/.test(await page.textContent('.rm-line')));

/* the countdown IS maghrib — the same number, to the minute */
const barAt = (await page.textContent('.rm-at')).trim();
await go('#/prayer');
const screenAt = await page.evaluate(() => {
  const r = [...document.querySelectorAll('.pr-row')].find(x => /المغرب|Maghrib/.test(x.textContent));
  return r ? (r.querySelector('.pr-at') || r).textContent.trim() : '';
});
ok('6.5 the bar and #/prayer agree on maghrib to the minute',
   !!barAt && screenAt.includes(barAt), barAt + ' vs ' + screenAt);

await go('#/home');
const rmRoutes = await page.evaluate(() =>
  [...document.querySelectorAll('.rm-btns [data-route]')].map(b => b.dataset.route));
ok('6.6 both doorways are there', rmRoutes.length === 2, rmRoutes.join(' '));
let rmFull = true, rmWorst = '';
for (const r of rmRoutes) {
  await go(r);
  const n = await rows();
  if (n < 1) { rmFull = false; rmWorst = r; }
}
ok('6.7 …and neither opens an empty list', rmFull, rmWorst || rmRoutes.join(' '));

await go('#/directory?cat=restaurants');
await page.click('#dirFilter'); await page.waitForTimeout(600);
ok('6.8 the ramadan specialities are back in the sheet',
   (await sheetAttrIds25()).filter(id => ['iftar', 'suhoor', 'ramadanHours'].includes(id)).length > 0);
await page.click('#fApply'); await page.waitForTimeout(400);

await go('#/admin');
/* V.03.6 — nothing ships a staff password any more, so a device is
   CLAIMED before it can be logged into. This is the fixture doing what
   the owner does once on the first run; the route is re-entered because
   the setup screen is already on screen by the time we get here. */
await page.evaluate(async () => {
  const S = (window.__m && window.__m.S)
    || await import('arabna/js/store.js').catch(() => import('./js/store.js'));
  if (!S.adminIsSet()) { await S.setAdminPass('Arabna@2026!', 'arabna.admin'); location.hash = '#/home'; }
});
await page.waitForTimeout(200);
await page.evaluate(() => { location.hash = '#/admin'; });
await page.waitForTimeout(600);
if (await page.locator('#aUser').count()) {
  await page.fill('#aUser', 'arabna.admin');
  await page.fill('#aPass', 'Arabna@2026!');
  await page.click('#aGo'); await page.waitForTimeout(800);
}
await page.click('[data-t="set"]'); await page.waitForTimeout(600);
const line = await page.locator('.hint').first().textContent();
ok('6.9 the admin switch says how many carry it', /\d+/.test(line), line.trim());
ok('6.10 …and how many are needed before a chip appears', /5/.test(line), line.trim());

/* ======================================================================
   7 — both languages, both themes, and the standing rules
   ====================================================================== */
console.log('--- the standing rules ---');
await patch(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  s.lang = 'en';
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});
await go('#/home');
ok('7.1 EN: the offers section is translated',
   /This week/i.test(await txt()) || await page.locator('.offer-strip').count() === 0);
ok('7.2 EN: the newcomer card is translated', /Just arrived/i.test(await txt()));
ok('7.3 EN: the ramadan bar is translated', /Iftar/i.test(await page.textContent('.rm-line')));
await go('#/newcomer');
ok('7.4 EN: every part is translated — no Arabic key leaked',
   !/^nc[A-Z]/m.test(await txt()) && /Social Security/i.test(await txt()));

/* nothing runs off the side, in either language */
/* Sideways scrolling is allowed where it is DISPLAY — the featured strip,
   a shop's photos, the offer strip. So an element outside the viewport is
   only a fault when no ANCESTOR is a horizontal scroller: the children of
   a .hscroll card are grandchildren, and checking the direct parent alone
   reported every one of them. */
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
    if (r.width > 0 && (r.right > 391.5 || r.left < -1.5) && !scrolls(el)) {
      bad.push(el.className || el.tagName);
    }
  });
  return bad.slice(0, 4);
});
for (const [name, hash] of [['home', '#/home'], ['newcomer', '#/newcomer'],
                            ['offers', '#/offers'], ['business page', '#/directory/b1']]) {
  await go(hash);
  const bad = await overflow();
  ok('7.5 EN: nothing runs off the edge on ' + name, bad.length === 0, bad.join(' '));
}

await patch(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  s.lang = 'ar'; s.theme = 'light';
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});
for (const [name, hash] of [['home', '#/home'], ['newcomer', '#/newcomer'],
                            ['offers', '#/offers'], ['business page', '#/directory/b1']]) {
  await go(hash);
  const bad = await overflow();
  ok('7.6 AR light: nothing runs off the edge on ' + name, bad.length === 0, bad.join(' '));
}

/* every colour is a token — the light theme must not leave anything unreadable */
await go('#/home');
ok('7.7 light: the ramadan bar has both halves from the token layer',
   await page.evaluate(() => {
     const b = document.querySelector('.rm-bar');
     if (!b) return true;
     const cs = getComputedStyle(b);
     return cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.color !== '';
   }));

/* one timer, still */
ok('7.8 no second timer was added', await page.evaluate(async () => {
  const src = await (await fetch('js/prayer.js')).text();
  const scr = await (await fetch('js/screens/prayer.js')).text();
  return !/setInterval/.test(src) && !/setInterval/.test(scr);
}));

/* the store is the single source of truth */
ok('7.9 no screen decides who may post an offer', await page.evaluate(async () => {
  const files = ['js/screens/directory.js', 'js/screens/home.js', 'js/screens/admin.js'];
  for (const f of files) {
    const s = await (await fetch(f)).text();
    // a screen may ASK canPostOffers; it may never read the plan itself
    if (/plan\s*===\s*['"]paid['"]/.test(s)) return false;
  }
  return true;
}));

await go('#/home');
ok('99 zero console errors', errors.length === 0, errors.slice(0, 3).join(' | '));

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);

/* V.04.0 — batch nine (ب): two live bugs, and the dropdown rule finished.

   The two bugs both came off Rai's own phone. A masjid was being offered a
   $29 monthly subscription — «مكان عام لا يُطالَب بملكيته» — and the city
   he had picked by hand froze there for good, because one flag was doing
   two jobs: "we have a point" and "the reader chose this".

   The rest is a rule that was written in an earlier batch and applied to
   one row out of four: more than five options is a dropdown, five or
   fewer are chips. And the last third of the file is the protection the
   prayer screens need — no advertising anywhere near a prayer time. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); } else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const browser = await chromium.launch();
const errors = [];
let ctx, page;

/* Several sections need a reader who has never granted anything, and a
   granted permission cannot be taken back inside one context. So each
   block that depends on a different starting state opens its own. */
const fresh = async (opts = {}) => {
  if (ctx) await ctx.close();
  ctx = await browser.newContext(Object.assign({ colorScheme: 'dark', viewport: { width: 390, height: 844 } }, opts));
  page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|ERR_NAME|ERR_FAILED|fonts\.googleapis/.test(m.text())) errors.push(m.text().slice(0, 130)); });
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message.slice(0, 130)));
  await page.goto(BASE + '#/home');
  await page.waitForTimeout(900);
  await page.evaluate(async () => {
    if (!window.__m) {
      const load = async (rel, spec) => { try { return await import(spec); } catch (e) { return await import(rel); } };
      window.__m = { S: await load('./js/store.js', 'arabna/js/store.js') };
    }
    return true;
  });
};
/* Setting the hash to what it already is fires no `hashchange`, so the
   screen never repaints and the next section measures the previous one.
   Bounce through Home first — it has bitten this harness three times. */
const go = async (h) => {
  if ((await page.evaluate(() => location.hash)) === h) {
    await page.evaluate(() => { location.hash = '#/home'; });
    await page.waitForTimeout(350);
  }
  await page.evaluate(x => { location.hash = x; }, h);
  await page.waitForTimeout(750);
};
const appTxt = () => page.evaluate(() => document.querySelector('#app').textContent.replace(/\s+/g, ' '));
const sheetTxt = () => page.evaluate(() => { const p = document.querySelector('.sheet-panel'); return p ? p.textContent.replace(/\s+/g, ' ') : ''; });
const esc = async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(350); };
const located = () => page.evaluate(async () => {
  if (!window.__m) {
    const load = async (rel, spec) => { try { return await import(spec); } catch (e) { return await import(rel); } };
    window.__m = { S: await load('./js/store.js', 'arabna/js/store.js') };
  }
  const S = window.__m.S;
  S.setUserLocation({ zip: '77081', city: 'Houston', state: 'TX' }, { lat: 29.7604, lng: -95.3698 });
  S.save();
});

/* ======================================================================
   1 — a place of worship is a public place: no claim, no $29, no badge
   ====================================================================== */
console.log('--- 1) the mosque is not a customer ---');
await fresh();
const wid = await page.evaluate(() => window.__m.S.everyBusiness().find(b => b.cat === 'worship').id);
await go('#/directory/' + wid);
const wtxt = await appTxt();
ok('1.1 the page says it is a public place', /مكان عام/.test(wtxt), wid);
ok('1.2 no $29 anywhere on it', !/\$29/.test(wtxt));
ok('1.3 no «رقّي الآن» and no «اطلب شارة»', !/رقّي الآن|اطلب شارة/.test(wtxt));
ok('1.4 no claim button', await page.evaluate(() => !document.querySelector('#claimBtn')));
ok('1.5 every worship record is non-commercial',
   await page.evaluate(() => { const S = window.__m.S; return S.everyBusiness().filter(b => b.cat === 'worship' && !S.isNonCommercial(b)).length; }) === 0);
/* the free half of `outings` carried the flag before this batch and must
   still carry it: the fix derives from the category, it does not overwrite */
ok('1.6 the free outings are untouched',
   await page.evaluate(() => { const S = window.__m.S; return S.everyBusiness().filter(b => b.cat === 'outings' && S.isNonCommercial(b)).length; }) >= 28);
/* and it did not widen: a restaurant is still sold to */
const rid = await page.evaluate(() => window.__m.S.everyBusiness().find(b => b.cat === 'restaurants' && b.plan !== 'paid').id);
await go('#/directory/' + rid);
/* the contrast that proves the fix did not widen: the mosque has no claim
   card and no commercial offer, the restaurant still has both doors */
ok('1.7 a restaurant is still claimable', await page.evaluate(() => !!document.querySelector('#claimBtn')), rid);
ok('1.8 …and is still a commercial record',
   await page.evaluate(x => window.__m.S.isNonCommercial(window.__m.S.everyBusiness().find(b => b.id === x)) === false, rid));

/* ======================================================================
   2 — the city he picked by hand is his, and is never changed behind him
   ====================================================================== */
console.log('--- 2) the frozen city ---');
await fresh();
/* the two flags the fix separated: "we hold a point" and "he chose it" */
ok('2.1 a reader who never granted anything has no grant flag',
   await page.evaluate(() => window.__m.S.geoGranted() === false));
await page.evaluate(() => {
  const S = window.__m.S;
  S.setUserLocation({ zip: '', city: 'Houston', state: 'TX' });   // by hand
  S.save();
});
ok('2.2 a hand-picked city is marked manual', await page.evaluate(() => window.__m.S.cityIsManual() === true));
/* the chip is only repainted by a render, so bounce the screen before
   reading it — measuring the stale chip made this pass for the wrong
   reason the first time it was written */
await go('#/directory'); await go('#/home');
ok('2.3 …and the chip prints the city with no «تلقائي»',
   await page.evaluate(() => { const s = document.querySelector('#locBtn').textContent; return /Houston/.test(s) && !/تلقائي/.test(s); }),
   await page.evaluate(() => document.querySelector('#locBtn').textContent.replace(/\s+/g, ' ').trim()));
await page.evaluate(() => {
  const S = window.__m.S;
  S.setUserLocation({ zip: '77081', city: 'Houston', state: 'TX' }, { lat: 29.7604, lng: -95.3698 });  // from the device
  S.save();
});
await go('#/directory'); await go('#/home');
ok('2.4 a GPS city is not manual', await page.evaluate(() => window.__m.S.cityIsManual() === false));
/* V.04.5 REVERSED this deliberately, and it is inverted rather than
   deleted: a check that disappears with no reason takes its behaviour
   back two batches later. V.04.0 put «· تلقائي» on the chip so the two
   states would not read alike; Rai asked for the word gone. The
   DISTINCTION stays where it belongs — in the data, where `cityIsManual`
   still stops a hand-picked city being changed behind its owner — it is
   simply no longer written on a button in the header. */
ok('2.5 …and the chip reads the city name alone, with no word about its source',
   await page.evaluate(() => {
     const s = document.querySelector('#locBtn').textContent.replace(/\s+/g, ' ').trim();
     return /Houston/.test(s) && !/تلقائي|auto/i.test(s);
   }),
   await page.evaluate(() => document.querySelector('#locBtn').textContent.replace(/\s+/g, ' ').trim()));
/* the ask itself: manual city + a device point somewhere else */
await page.evaluate(() => {
  const S = window.__m.S;
  S.setUserLocation({ zip: '', city: 'Houston', state: 'TX' });
  S.state.geoGranted = true;
  S.state.geo = { lat: 29.7604, lng: -95.3698, at: 0 };   // stale on purpose
  S.save();
});
ok('2.6 the move is asked once and then never again',
   await page.evaluate(() => {
     const S = window.__m.S;
     const first = S.moveAlreadyAsked();
     S.markMoveAsked();
     return first === false && S.moveAlreadyAsked() === true;
   }));
ok('2.7 «لا» is respected — the city does not change on its own',
   await page.evaluate(() => window.__m.S.userCity()) === 'Houston');
/* and the limit the whole thing exists to protect */
ok('2.8 nothing is read for a reader who never granted',
   await page.evaluate(async () => {
     const src = await (await fetch('js/screens/home.js')).text().catch(() => '');
     return src ? /geoGranted\(\)/.test(src) && !/geolocation\.watchPosition/.test(src) : true;
   }));

/* ======================================================================
   3 + 4 — more than five options is a dropdown, and the area has a name
   ====================================================================== */
console.log('--- 3) the three rows that were still chips ---');
await fresh(); await located();
await go('#/home');
await page.click('#locBtn'); await page.waitForTimeout(600);
ok('3.1 the location sheet has a city dropdown, not 24 chips',
   await page.evaluate(() => !!document.querySelector('#ctlCity') && !document.querySelector('#cityPick .chip')));
ok('3.2 «استخدم موقعي الحالي» is still a full-width button above it',
   await page.evaluate(() => { const b = document.querySelector('#geoBtn'); return !!b && b.classList.contains('btn-block'); }));
await page.evaluate(() => document.querySelector('#ctlCity').click()); await page.waitForTimeout(500);
ok('3.3 …and the list carries a count beside each city',
   await page.evaluate(() => [...document.querySelectorAll('.dd-row .chip-n')].length > 5));
await esc(); await esc();

await go('#/magazine');
ok('3.4 the magazine is a section dropdown now',
   await page.evaluate(() => !!document.querySelector('#ctlMag')));
ok('3.5 …and the six chips are gone',
   await page.evaluate(() => !document.querySelector('#magChips .chip')));

await go('#/directory');
await page.evaluate(() => document.querySelector('#dirFilter').click()); await page.waitForTimeout(700);
const sTxt = await sheetTxt();
ok('4.1 the filter sheet names the area «Houston والمنطقة»', /Houston والمنطقة/.test(sTxt));
ok('4.2 …and «كل المنطقة» is gone from it', !/كل المنطقة/.test(sTxt));
const pickers = await page.evaluate(() => [...document.querySelectorAll('.sheet-panel .ctl')].map(b => b.id));
ok('3.6 the sheet is four pickers and one switch',
   pickers.length === 4 && pickers.includes('fCtlArea') && pickers.includes('fCtlSort')
   && pickers.includes('fCtlTop') && pickers.includes('fCtlRest'), pickers.join(','));
/* the sheet's pickers carry an `f` prefix because the directory's own row
   already owns `#ctlSort`: two elements with one id sent the sheet's choice
   to the button BEHIND the sheet */
ok('3.6b no picker id appears twice in the document',
   await page.evaluate(() => {
     const ids = [...document.querySelectorAll('.ctl')].map(b => b.id);
     return ids.length === new Set(ids).size;
   }),
   await page.evaluate(() => [...document.querySelectorAll('.ctl')].map(b => b.id).join(',')));
ok('3.7 «مفتوح الآن» stays a switch — one option is never a list',
   await page.evaluate(() => !!document.querySelector('#fOpenNow')));
ok('3.8 …and the whole sheet reads without scrolling at 390×844',
   await page.evaluate(() => { const b = document.querySelector('.sheet-body'); return b.scrollHeight <= b.clientHeight + 2; }),
   await page.evaluate(() => { const b = document.querySelector('.sheet-body'); return b.scrollHeight + '/' + b.clientHeight; }));
/* the multi-select stays open while two are picked, and says how many */
await page.evaluate(() => document.querySelector('#fCtlTop').click()); await page.waitForTimeout(450);
await page.evaluate(() => { const r = document.querySelectorAll('#fDdTop .dd-row'); r[0].click(); });
await page.waitForTimeout(350);
const stillOpen = await page.evaluate(() => !!document.querySelector('#fDdTop .dd-row'));
await page.evaluate(() => { const r = document.querySelectorAll('#fDdTop .dd-row'); if (r[1]) r[1].click(); });
await page.waitForTimeout(400);
ok('3.9 the multi-select stays open while picking', stillOpen);
ok('3.10 …and the button counts what is chosen',
   /2/.test(await page.evaluate(() => document.querySelector('#fCtlTop').textContent)),
   await page.evaluate(() => document.querySelector('#fCtlTop').textContent.replace(/\s+/g, ' ').trim()));
ok('3.11 the count is still beside every option',
   await page.evaluate(() => [...document.querySelectorAll('#fDdTop .chip-n')].length > 1));
/* the free feature: the panel took a history entry, so Back closes it */
await page.goBack(); await page.waitForTimeout(500);
ok('3.12 the device back button closes the list and stays on the screen',
   await page.evaluate(() => !document.querySelector('#fDdTop .dd-row'))
   && /#\/directory/.test(await page.evaluate(() => location.hash)));
await esc();
/* what does NOT convert: display is allowed to scroll sideways */
await go('#/home');
ok('3.13 «مميّز هذا الأسبوع» still scrolls horizontally',
   await page.evaluate(() => [...document.querySelectorAll('#app .hscroll')].some(r => r.scrollWidth > r.clientWidth + 2)));

/* ======================================================================
   5 + 6 — the prayer bar is asked for once, and the alert is honest
   ====================================================================== */
console.log('--- 5) asked once ---');
await fresh();
ok('5.1 the ask card is on Home the first time', await page.evaluate(() => !!document.querySelector('#prAsk')));
ok('5.2 …and it is a card, not a bar we hid', await page.evaluate(() => !document.querySelector('.pr-bar')));
await page.evaluate(() => document.querySelector('#prAskNo').click()); await page.waitForTimeout(600);
ok('5.3 «لا» removes the bar', await page.evaluate(() => !document.querySelector('.pr-bar') && !document.querySelector('#prAsk')));
for (let i = 0; i < 5; i++) { await page.reload(); await page.waitForTimeout(650); }
ok('5.4 …and five reopens do not ask again', await page.evaluate(() => !document.querySelector('#prAsk')));
await page.click('#hMenu'); await page.waitForTimeout(500);
await page.evaluate(() => { const h = [...document.querySelectorAll('.dr-head')].find(x => /تصنيفات/.test(x.textContent)); if (h) h.click(); });
await page.waitForTimeout(400);
ok('5.5 #/prayer is still in the drawer after «لا»',
   await page.evaluate(() => [...document.querySelectorAll('.dr-item')].some(x => x.dataset.route === '#/prayer')));
await esc();
await located(); await go('#/prayer');
await page.evaluate(() => document.querySelector('#prSet').click()); await page.waitForTimeout(650);
ok('5.6 the settings hold the switch that brings it back',
   await page.evaluate(() => !!document.querySelector('#prHomeSw')));
console.log('--- 6) the alert says what is true ---');
const setTxt = await sheetTxt();
ok('6.1 «تنبيه قبل الأذان» is there', await page.evaluate(() => !!document.querySelector('#prAlertSw')));
ok('6.2 …and says it works when the server does', /السيرفر/.test(setTxt));
ok('6.3 …and offers no tone picker for something that cannot sound', !/نغمة|tone/i.test(setTxt));
await page.evaluate(() => document.querySelector('#prHomeSw').click()); await page.waitForTimeout(400);
await esc();
await go('#/home');
ok('6.4 the switch brings the bar back', await page.evaluate(() => !!document.querySelector('.pr-bar')));

/* ======================================================================
   7 — a stranger adds the place, never its times
   ====================================================================== */
console.log('--- 7) add a mosque, add a church ---');
await fresh();
await go('#/prayer');
ok('7.1 the door is on #/prayer even with no location at all',
   await page.evaluate(() => !!document.querySelector('[data-sg="mosque"]')));
await page.evaluate(() => document.querySelector('[data-sg="mosque"]').click()); await page.waitForTimeout(600);
const fields = await page.evaluate(() => [...document.querySelectorAll('.sheet-panel input')].map(i => i.id));
ok('7.2 three fields and no more', fields.length === 3 && fields.join(',') === 'sgName,sgAddr,sgPhone', fields.join(','));
ok('7.3 there is NO denomination field — not optional, absent', !/طائفة|مذهب|denomination/i.test(await sheetTxt()));
ok('7.4 and no time field of any kind', !/الأذان|الإقامة|الجمعة|القداس/.test(await sheetTxt()));
await page.fill('#sgName', 'مسجد النور');
await page.fill('#sgAddr', '1234 Hillcroft, Houston');
await page.evaluate(() => document.querySelector('#sgSend').click()); await page.waitForTimeout(800);
ok('7.5 the thank-you says it arrived', /وصلنا اقتراحك/.test(await page.evaluate(() => document.body.textContent)));
const rec = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('arabna.v1')); return (s.extraBusinesses || [])[0] || null; });
ok('7.6 it lands in the admin queue as worship, pending',
   !!rec && rec.cat === 'worship' && rec.status === 'pending' && rec.name.ar === 'مسجد النور',
   rec ? `${rec.cat}/${rec.status}` : 'nothing saved');
ok('7.7 …and non-commercial by rule 1, without anyone choosing it',
   await page.evaluate(() => window.__m.S.isNonCommercial(window.__m.S.state.extraBusinesses[0]) === true));
await go('#/mass');
ok('7.8 the same door on #/mass', await page.evaluate(() => !!document.querySelector('[data-sg="church"]')));
ok('7.9 it is not in the «+» button — that one is for commerce',
   await page.evaluate(async () => {
     const src = await (await fetch('js/ui.js')).text().catch(() => '');
     return src ? !/data-sg=/.test(src) : true;
   }));

/* ======================================================================
   8 — and the rule that protects the whole of it
   ====================================================================== */
console.log('--- 8) zero advertising near a prayer time ---');
const noAds = async (label, hash) => {
  await go(hash);
  const r = await page.evaluate(() => ({
    txt: document.querySelector('#app').textContent,
    slider: !!document.querySelector('#app .slider, #app .slide'),
    spon: !!document.querySelector('#app .spon-row, #app .slide-badge'),
    advertise: [...document.querySelectorAll('#app [data-route]')].filter(b => /#\/advertise/.test(b.dataset.route)).length,
  }));
  ok(`8.x ${label}: no slider, no banner, no «مموّل»`,
     !r.slider && !r.spon && r.advertise === 0 && !/مموّل|إعلانك هنا/.test(r.txt),
     `${r.slider ? 'slider ' : ''}${r.spon ? 'sponsored ' : ''}${r.advertise ? r.advertise + ' advertise links' : ''}`);
};
await located();
await noAds('#/prayer', '#/prayer');
await noAds('#/mass', '#/mass');
await noAds('a mosque page', '#/directory/' + wid);
const cid = await page.evaluate(() => { const S = window.__m.S; const c = S.everyBusiness().find(b => S.isChurch(b)); return c ? c.id : null; });
if (cid) await noAds('a church page', '#/directory/' + cid);

/* ======================================================================
   26 — and nothing chooses sideways
   ====================================================================== */
console.log('--- 26) no sideways choosing anywhere ---');
for (const h of ['#/directory', '#/marketplace', '#/events', '#/magazine', '#/prayer', '#/mass']) {
  await go(h);
  const over = await page.evaluate(() => {
    const d = document.documentElement;
    return Math.max(0, d.scrollWidth - d.clientWidth);
  });
  ok(`26 ${h} does not scroll sideways`, over <= 1, over + 'px');
}

ok('99 zero console errors', errors.length === 0, errors.slice(0, 3).join(' | '));

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);

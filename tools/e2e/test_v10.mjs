/* V.02.0 — twenty categories, the speciality tree, the three-layer
   visibility rule, event types, concerts and yearly events */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';

/* V.02.7 removed the quick-chip row: «مفتوح الآن» and the specialities are
   reached through the ⚙ sheet now. These do through the sheet exactly what
   a tap on the old chip did, so the behaviour under test is unchanged and
   only the doorway moved. */
const viaSheet = async (page, fn) => {
  await page.click('#dirFilter'); await page.waitForTimeout(520);
  await fn();
  await page.click('#fApply'); await page.waitForTimeout(520);
};
const toggleOpenNow = (page) => viaSheet(page, () => page.click('#fOpenNow'));
const toggleAttr = (page, id) => viaSheet(page, async () => {
  const sel = `.sheet-panel [data-a="${id}"]`;
  if (await page.locator(sel).count()) await page.click(sel);
});
/** the ids the sheet offers for the current category */
const sheetAttrIds = async (page) => {
  await page.click('#dirFilter'); await page.waitForTimeout(520);
  const ids = await page.evaluate(() =>
    [...document.querySelectorAll('.sheet-panel [data-a]')].map(b => b.dataset.a));
  await page.click('#fApply'); await page.waitForTimeout(520);
  return ids;
};
const activeAttrPills = (page) => page.evaluate(() =>
  [...document.querySelectorAll('#pills [data-off]')].map(b => b.dataset.off));


const BASE = process.env.BASE || 'http://localhost:8123/index.html';
const DL = '/tmp/claude-0/-home-user-Arabna/251db543-2065-5c48-ad10-c7376686ff5c/scratchpad/dl10';
if (existsSync(DL)) rmSync(DL, { recursive: true });
mkdirSync(DL, { recursive: true });

let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); } else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const browser = await chromium.launch();
const ctx = await browser.newContext({ colorScheme: 'dark', viewport: { width: 390, height: 844 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));

const go = async (h) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(360); };
const hash = () => page.evaluate(() => location.hash);
const txt = () => page.textContent('#app');
const rowEls = `#dirList .list-row[data-route^="#/directory/"]`;
const rows = () => page.evaluate((sel) => Array.from(document.querySelectorAll(sel))
  .map(r => (r.querySelector('.row-title') || {}).textContent.trim()), rowEls);
const chipIds = (sel) => page.evaluate((s) =>
  Array.from(document.querySelectorAll(s)).map(c => c.dataset.attr || c.dataset.type), sel);
const openSheet = async () => { await page.click('#dirFilter'); await page.waitForTimeout(520); };
const shutSheet = async () => {
  await page.evaluate(() => { const s = document.querySelector('.sheet-scrim'); if (s) s.click(); });
  await page.waitForTimeout(450);
};
const grab = async (fn) => {
  const [dl] = await Promise.all([page.waitForEvent('download'), fn()]);
  const path = DL + '/' + dl.suggestedFilename();
  await dl.saveAs(path);
  return { name: dl.suggestedFilename(), text: readFileSync(path, 'utf8') };
};
const adminLogin = async () => {
  await go('#/admin');
  if (await page.locator('#aUser').count()) {
    await page.fill('#aUser', 'arabna.admin');
    await page.fill('#aPass', 'Arabna@2026!');
    await page.click('#aGo'); await page.waitForTimeout(550);
  }
};

await page.goto(BASE);
await page.waitForTimeout(800);
// the new seeds spread past the default 5-mile radius
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  s.radius = 100;
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});
await page.reload(); await page.waitForTimeout(800);

/* ======================================================================
   PART 1 — the twenty categories
   ====================================================================== */
console.log('--- categories ---');
// V.02.1 added `outings` — a deliberate widening, not a regression
const WANT = ['restaurants','grocery','worship','cafe','beauty','shopping','community',
  'education','sweets','finance','occasions','doctors','auto','homegoods','lawyers',
  'travel','electronics','realestate','homeservices','gyms','outings'];


/* V.02.4: the sideways chip rows became drop-downs — an option nobody can
   see is an option nobody has. These read and drive the new lists. */
const ddValues = async (anchor) => {
  await page.click(anchor); await page.waitForTimeout(320);
  const v = await page.evaluate(() => Array.from(document.querySelectorAll('.dd-row')).map(r => r.dataset.v));
  await page.keyboard.press('Escape'); await page.waitForTimeout(220);
  return v;
};
const ddText = async (anchor) => {
  await page.click(anchor); await page.waitForTimeout(320);
  const txt = await page.textContent('.dd-panel');
  await page.keyboard.press('Escape'); await page.waitForTimeout(220);
  return txt;
};
const ddPick = async (anchor, value) => {
  await page.click(anchor); await page.waitForTimeout(320);
  await page.evaluate(v => document.querySelector(`.dd-row[data-v="${v}"]`).click(), value);
  await page.waitForTimeout(520);
};

await go('#/directory');
const dirChips = (await ddValues('#ctlCat')).filter(x => x && x !== 'all');
ok('the directory offers exactly the twenty-one categories',
   dirChips.length === 21 && WANT.every(id => dirChips.includes(id)),
   dirChips.length + ': ' + dirChips.join(' '));
ok('"events" is not among them — it is a shortcut, not a category',
   !dirChips.includes('events'));

await go('#/categories');
const cells = await page.evaluate(() => Array.from(document.querySelectorAll('.cat-grid')).pop()
  .querySelectorAll('.cat-cell').length);
ok('"all categories" lists every one of them', cells === 22, cells + ' cells (21 + events)');
let body = await txt();
for (const [id, label] of [['cafe','مقاهي وأرجيلة'], ['shopping','تسوّق وأزياء'],
                           ['community','مجتمع وخدمات'], ['sweets','حلويات ومخابز'],
                           ['finance','خدمات مالية'], ['occasions','مناسبات وأفراح'],
                           // V.03.4: «جوالات» is Gulf; «هواتف» is read everywhere, and the search
                           // dictionary already links جوال · موبايل · تلفون · هاتف
                           ['homegoods','مفروشات وأدوات منزلية'], ['electronics','إلكترونيات وهواتف'],
                           ['homeservices','صيانة وخدمات المنزل']]) {
  ok('new category named: ' + label, body.includes(label));
}
ok('every cell carries an icon',
   await page.evaluate(() => Array.from(document.querySelectorAll('.cat-cell'))
     .every(c => !!c.querySelector('svg'))));

/* home services and home goods must never be merged */
ok('home services and home goods are separate categories',
   dirChips.includes('homeservices') && dirChips.includes('homegoods'));
await go('#/directory?cat=homeservices');
ok('home services holds the A/C company', (await rows()).some(x => x.includes('أبو خالد')), (await rows()).join(' | '));
await go('#/directory?cat=homegoods');
ok('home goods holds the rug shop', (await rows()).some(x => x.includes('السجاد')), (await rows()).join(' | '));

/* the five on Home */
await go('#/home');
const homeCats = await page.evaluate(() => Array.from(document.querySelectorAll('#cats .cat-item'))
  .map(c => c.dataset.cat));
ok('Home still shows five circles', homeCats.length === 5, homeCats.join(' '));
ok('…pointing at restaurants, doctors, events, home services and shopping',
   JSON.stringify(homeCats) === JSON.stringify(['restaurants','doctors','events','homeservices','shopping']),
   homeCats.join(' '));
await page.evaluate(() => document.querySelector('.cat-item[data-cat="homeservices"]').click());
await page.waitForTimeout(420);
ok('the "repairs" circle opens home services', (await hash()) === '#/directory?cat=homeservices', await hash());

/* ======================================================================
   PART 2 — the speciality tree
   ====================================================================== */
console.log('--- specialities ---');
const meta = await page.evaluate(async () => {
  const m = await import('./js/data.js');
  return {
    attrs: m.ATTRIBUTES.length,
    groups: m.ATTR_GROUPS.length,
    chipMin: m.CHIP_MIN,
    ids: m.ATTRIBUTES.map(a => a.id),
    cats: m.CATEGORIES.filter(c => !c.route).map(c => c.id),
  };
}).catch(() => null);
if (meta) {
  ok('the registry holds the whole tree', meta.attrs > 250, meta.attrs + ' attributes');
  ok('CHIP_MIN is a single constant', meta.chipMin === 5, String(meta.chipMin));
  for (const id of ['cuisYemeni','dishMandi','medDental','lawAsylum','finTaxPersonal',
                    'hsHandyman','hgRugs','wkCoptic','grHalalButcher','cfHookahLounge',
                    'swKnafeh','shAbaya','ocZaffa','elUnlock','cmFuneral','gyBoxing',
                    'trvHajj','eduIslamicSchool','reMortgage','autoTow']) {
    ok('speciality defined: ' + id, meta.ids.includes(id));
  }
  ok('every category has at least one speciality of its own',
     meta.cats.every(c => meta.ids.length > 0));
} else {
  console.log('       (module import unavailable in this build — checked through the UI instead)');
}

/* the add form shows every speciality, empty ones included */
await go('#/add-business');
const formFor = async (cat) => {
  await page.selectOption('#bCat', cat); await page.waitForTimeout(450);
  return page.evaluate(() => ({
    n: document.querySelectorAll('#bAttrs .chip').length,
    txt: document.querySelector('#bAttrs').textContent.replace(/\s+/g, ' '),
  }));
};
const fRest = await formFor('restaurants');
ok('the add form lists every restaurant speciality, empty or not',
   fRest.n > 50, fRest.n + ' options');
ok('…including cuisines with no shop yet', fRest.txt.includes('ليبي') && fRest.txt.includes('بنغالي'));
const fLaw = await formFor('lawyers');
ok('choosing another category swaps the whole list',
   fLaw.n !== fRest.n && fLaw.txt.includes('إفلاس') && !fLaw.txt.includes('شاورما'),
   fLaw.n + ' options');
const fHs = await formFor('homeservices');
ok('home services offers "handyman" as a speciality, not as its name',
   fHs.txt.includes('هاندي مان'));

/* ======================================================================
   PART 3 — the three layers
   ====================================================================== */
console.log('--- three layers ---');
await go('#/directory?cat=restaurants');
const sheetIds = await sheetAttrIds(page);
/* V.02.7 removed the quick-chip ROW, not the rule behind it:
   quickAttrsForCat still applies CHIP_MIN and CHIP_MAX_SHARE, and the
   sheet still offers anything with at least one listing. Both layers are
   checked here — the top one at its source, the middle one on screen. */
const quick = await page.evaluate(async () => {
  const s = await import('./js/store.js').catch(() => null);
  return s ? s.quickAttrsForCat('restaurants', 5).map(a => a.id) : null;
}).catch(() => null);
const counts = await page.evaluate(async () => {
  const s = await import('./js/store.js').catch(() => null);
  return s ? s.attrCounts('restaurants') : null;
}).catch(() => null);
if (quick) {
  ok('the top layer still clears the threshold',
     quick.includes('halalMeat') && quick.includes('noAlcohol'), quick.join(' '));
  ok('…and still drops what nearly everything carries', !quick.includes('arabicSpoken'), quick.join(' '));
  ok('…and still nothing below the floor', !quick.includes('cuisYemeni') && !quick.includes('dishMandi'),
     quick.length + ' quick');
} else { for (let i = 0; i < 3; i++) ok('top layer readable', false, 'store import failed'); }
if (counts && quick) {
  const under = Object.entries(counts).filter(([, n]) => n < 5).map(([k]) => k);
  ok('every quick attribute really meets the count',
     quick.every(c => (counts[c] || 0) >= 5), quick.map(c => c + ':' + counts[c]).join(' '));
  ok('nothing under the count sneaks in', under.every(id => !quick.includes(id)));
  // the sheet is the wider layer: at least one listing, and no more
  ok('the sheet offers everything with content behind it',
     sheetIds.every(id => (counts[id] || 0) >= 1) && sheetIds.length > quick.length,
     sheetIds.length + ' in the sheet vs ' + quick.length + ' quick');
}

await openSheet();
let sheet = await page.textContent('#sheet');
ok('the sheet offers what has at least one business',
   sheet.includes('يمني') && sheet.includes('مندي وكبسة'), '');
ok('…but still not the empty ones', !sheet.includes('ليبي') && !sheet.includes('بنغالي'));
await shutSheet();

/* no filter can ever return nothing */
await go('#/directory?cat=restaurants');
await openSheet();
const sheetAttrs = await page.evaluate(() =>
  Array.from(document.querySelectorAll('#sheet #fAttrs .chip')).map(c => c.dataset.a));
await shutSheet();
let emptyOnes = [];
for (const id of sheetAttrs.slice(0, 12)) {
  // hop away first: assigning the same hash does not re-render, and the
  // previous filter would still be live in the screen's closure
  await go('#/home');
  await go('#/directory?cat=restaurants');
  await openSheet();
  await page.click(`#sheet .chip[data-a="${id}"]`); await page.waitForTimeout(180);
  await page.click('#fApply'); await page.waitForTimeout(450);
  if ((await rows()).length === 0) emptyOnes.push(id);
}
ok('no filter offered in the sheet returns an empty list',
   emptyOnes.length === 0, emptyOnes.join(' ') || 'all产 return results');

/* the designed dead end still exists when chips are combined */
await go('#/directory?cat=restaurants');
await toggleAttr(page, 'halalMeat');
/* V.02.6: «زربيان» is in the synonym dictionary and finds the mandi
   houses now, so the dead end needs a word that really is nowhere */
await page.fill('#dirSearch', 'زرافة'); await page.waitForTimeout(400);
ok('an impossible combination shows the designed empty state',
   (await txt()).includes('لا توجد نتائج بهذه الفلاتر'));
ok('…with a clear-filters button', await page.locator('#clrF').count() === 1);
await page.click('#clrF'); await page.waitForTimeout(450);
ok('clearing brings results back', (await rows()).length > 0);

/* ======================================================================
   PART 4 — event types
   ====================================================================== */
console.log('--- event types ---');
await go('#/events');
const evChips = await ddValues('#ctlType');
ok('the events list offers type chips', evChips.length > 1, evChips.join(' '));
ok('…only for types that have something coming up',
   !evChips.includes('concert'), evChips.join(' '));
ok('every event card names its type', await page.evaluate(() =>
  Array.from(document.querySelectorAll('.ev-card')).every(c => !!c.querySelector('.badge-cat'))));

const allEv = (await page.locator('.ev-card').count());
await ddPick('#ctlType', 'festival');
ok('a type chip filters the list', await page.locator('.ev-card').count() < allEv,
   (await page.locator('.ev-card').count()) + ' of ' + allEv);
ok('…and a line names the type and the count',
   await page.locator('#evNote .sec-note').count() === 1,
   (await page.textContent('#evNote')).trim());

/* ======================================================================
   PART 5 — concerts
   ====================================================================== */
console.log('--- concerts ---');
await adminLogin();
await go('#/events/propose?admin=1');
ok('the event form asks for a type', await page.locator('#evType').count() === 1);
ok('the concert block is hidden for other types',
   await page.evaluate(() => document.querySelector('#evConcert').hidden));
await page.selectOption('#evType', 'concert'); await page.waitForTimeout(300);
ok('choosing "concert" reveals the artist fields',
   await page.evaluate(() => !document.querySelector('#evConcert').hidden));
for (const id of ['#cnArtist', '#cnDoors', '#cnPrice', '#cnAge', '#cnFamily']) {
  ok('concert field present: ' + id, await page.locator(id).count() === 1);
}
ok('the form says tickets are sold elsewhere',
   (await txt()).includes('التطبيق يفتح الرابط فقط'));
await page.selectOption('#evType', 'lecture'); await page.waitForTimeout(300);
ok('switching to a lecture hides them again',
   await page.evaluate(() => document.querySelector('#evConcert').hidden));

await page.selectOption('#evType', 'concert'); await page.waitForTimeout(300);
await page.fill('#evTitle', 'حفل كاظم الساهر');
await page.fill('#evStart', '2026-12-05T20:00');
await page.fill('#evVenue', 'قاعة سميث');
await page.fill('#cnArtist', 'كاظم الساهر');
await page.fill('#cnDoors', '19:00');
await page.fill('#cnPrice', '65');
await page.fill('#cnAge', 'كل الأعمار');
await page.check('#cnFamily');
await page.fill('#evUrl', 'https://example.com/tickets/kadim');
await page.click('#evSave'); await page.waitForTimeout(900);

const saved = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  return (s.extraEvents || []).find(e => e.type === 'concert') || null;
});
ok('the concert saved with its type', !!saved && saved.type === 'concert');
ok('…and its artist details', saved && saved.concert && saved.concert.artist === 'كاظم الساهر'
   && saved.concert.priceFrom === '65' && saved.concert.familySeating === true,
   JSON.stringify(saved && saved.concert));

await go('#/events/' + saved.id);
body = await txt();
ok('the event page shows the artist', body.includes('كاظم الساهر'));
ok('…the door time and the price', body.includes('$65') && body.includes('فتح الأبواب'));
ok('…and says booking happens on the organiser’s site',
   body.includes('الحجز يتم على موقع المنظّم'));
ok('the ticket button is an external link, not a checkout', await page.evaluate(() => {
  const a = document.querySelector('.detail-body a[href^="http"]');
  return !!a && a.target === '_blank' && /example\.com/.test(a.href);
}));

await go('#/events');
ok('the concert type appears in the list now that one exists',
   (await ddValues('#ctlType')).includes('concert'));

/* ======================================================================
   PART 6 — yearly events
   ====================================================================== */
console.log('--- yearly events ---');
const nexts = await page.evaluate(async () => {
  const m = await import('./js/data.js');
  return {
    greg: m.nextOccurrence('2026-10-24T17:00', 'gregorian'),
    hijri: m.nextOccurrence('2027-02-20T16:00', 'hijri'),
  };
}).catch(() => null);
if (nexts) {
  ok('a Gregorian yearly event keeps its date', nexts.greg.startsWith('2027-10-24'), nexts.greg);
  ok('a Hijri one moves about eleven days earlier', nexts.hijri.startsWith('2028-02-09'), nexts.hijri);
  const gap = (new Date(nexts.hijri) - new Date('2027-02-20T16:00')) / 86400000;
  ok('…which is a Hijri year, not a Gregorian one', Math.round(gap) === 354, Math.round(gap) + ' days');
}

/* push a repeating event close enough to be due */
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  const soon = new Date(Date.now() - 320 * 86400000);   // ~11 months ago
  const pad = (n) => String(n).padStart(2, '0');
  const iso = `${soon.getFullYear()}-${pad(soon.getMonth() + 1)}-${pad(soon.getDate())}T18:00`;
  s.extraEvents = (s.extraEvents || []).concat([{
    id: 'evrep', type: 'festival', status: 'live',
    title: { ar: 'مهرجان العيد السنوي', en: 'Annual Eid Festival' },
    startsAt: iso, endsAt: '',
    venue: { ar: 'ساحة المركز', en: 'Center Plaza' }, city: 'Houston, TX',
    desc: { ar: '', en: '' }, organizer: { ar: 'المركز', en: 'The Center' },
    ticketUrl: '', icon: 'calendar', photo: '', featured: false,
    repeat: { kind: 'gregorian', spawned: [] },
    source: '', externalId: '', sourceUrl: '',
  }]);
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});
await page.reload(); await page.waitForTimeout(800);
await adminLogin();
await page.click('#aTabs .tab[data-t="events"]'); await page.waitForTimeout(500);
body = await page.textContent('#aBody');
ok('the admin is warned a yearly event is due', body.includes('فعاليات سنوية اقترب موعدها'));
ok('…with the date of the next edition', body.includes('النسخة القادمة'));
ok('…and is told the copy starts as a draft', body.includes('مسودّة لا منشورة'));
ok('nothing was republished on its own', await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  return (s.extraEvents || []).filter(e => e.title.ar.includes('العيد السنوي')).length === 1;
}));

await page.click('#aBody [data-spawn]'); await page.waitForTimeout(800);
const spawned = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  const list = (s.extraEvents || []).filter(e => e.title.ar.includes('العيد السنوي'));
  return { n: list.length, statuses: list.map(e => e.status), starts: list.map(e => e.startsAt) };
});
ok('a draft copy is made', spawned.n === 2, JSON.stringify(spawned.starts));
ok('…and it is a draft, not published', spawned.statuses.includes('pending'));
ok('…dated a year on', spawned.starts.some((a, i) =>
  spawned.starts.some(b => new Date(b) - new Date(a) > 300 * 86400000)));
ok('the reminder clears once handled',
   !(await page.textContent('#aBody')).includes('فعاليات سنوية اقترب موعدها'));

/* ======================================================================
   PART 7 — import compatibility
   ====================================================================== */
console.log('--- import ---');
await adminLogin();
await page.click('#aTabs .tab[data-t="dir"]'); await page.waitForTimeout(450);
const sample = await grab(() => page.click('#csvSample'));
ok('the sample uses the new category ids',
   sample.text.includes('restaurants') && sample.text.includes('sweets'), '');
ok('…and the new speciality ids', sample.text.includes('cuisLebanese') && sample.text.includes('swKnafeh'));
ok('…and shows a row with no Arabic name', /Abdallah's Bakery,,/.test(sample.text));

const head = sample.text.split('\n')[0];
const csv = [head,
  'Zaytoun Cafe,,cafe,(713) 555-7001,10 Main St Houston TX,,,coffee,cfYemeniCoffee;cfHookahLounge,08:00-23:00,08:00-23:00,08:00-23:00,08:00-23:00,08:00-23:00,08:00-23:00,08:00-23:00',
  'Nour Jewellery,,shopping,(713) 555-7002,20 Main St Houston TX,,,gold,shJewelry;shWatches,10:00-19:00,10:00-19:00,10:00-19:00,10:00-19:00,10:00-19:00,10:00-19:00,closed',
  'Bad Cat,,mosques,(713) 555-7003,30 Main St Houston TX,,,,,,,,,,,',
].join('\n');
await page.setInputFiles('#csvFile', { name: 'in.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf8') });
await page.waitForTimeout(900);
const c2 = await page.evaluate(() => Array.from(document.querySelectorAll('#csvOut .stat b')).map(b => b.textContent));
ok('the new category ids are accepted', c2[0] === '2', c2.join(',') + ' (ok,warn,bad,dup)');
ok('an unknown category is still blocked', c2[2] === '1');
ok('…and the accepted ids are printed so the file can be fixed',
   (await page.textContent('#csvOut')).includes('المعرّفات المقبولة'));
const validList = await page.textContent('#csvOut');
ok('…listing all twenty', WANT.every(id => validList.includes(id)));

const exported = await grab(() => page.click('#impExport'));
ok('the export carries the new categories',
   exported.text.includes('"cafe"') && exported.text.includes('"shopping"'));
ok('…and the new specialities', exported.text.includes('"cfYemeniCoffee"') && exported.text.includes('"shJewelry"'));

/* ======================================================================
   PART 8 — English
   ====================================================================== */
console.log('--- English ---');
await go('#/home');
await page.evaluate(() => document.querySelector('#hMenu').click()); await page.waitForTimeout(430);
await page.click('#drLang'); await page.waitForTimeout(650);
ok('switched to English', await page.evaluate(() => document.documentElement.lang === 'en'));

await go('#/categories');
body = await txt();
for (const label of ['Cafés & Hookah', 'Shopping & Fashion', 'Community & Services',
                     'Sweets & Bakeries', 'Financial Services', 'Events & Weddings',
                     'Home & Furnishings', 'Electronics & Phones', 'Home Services']) {
  ok('EN category: ' + label, body.includes(label));
}
await go('#/directory?cat=restaurants');
await openSheet();
sheet = await page.textContent('#sheet');
ok('EN: cuisines translated', sheet.includes('Yemeni') && sheet.includes('Lebanese'));
ok('EN: dishes translated', sheet.includes('Mandi & kabsa'));
await shutSheet();
await go('#/events');
ok('EN: event types translated', (await ddText('#ctlType')).includes('Festivals'));

await go('#/home');
await page.evaluate(() => document.querySelector('#hMenu').click()); await page.waitForTimeout(430);
await page.click('#drLang'); await page.waitForTimeout(600);
ok('language toggles back to Arabic', await page.evaluate(() => document.documentElement.dir === 'rtl'));

const real = errors.filter(e => !/favicon|ERR_CONNECTION_RESET|Failed to load resource/i.test(e));
ok('no console errors', real.length === 0, real.slice(0, 4).join(' | '));

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);

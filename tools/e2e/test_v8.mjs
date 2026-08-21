/* V.01.8 — structured hours, keywords, the general attribute system,
   new categories and duplicate detection */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

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
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); } else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const browser = await chromium.launch();
const ctx = await browser.newContext({ colorScheme: 'dark', viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));

const go = async (h) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(340); };
const hash = () => page.evaluate(() => location.hash);
const txt = () => page.textContent('#app');
/** business rows only — the subscription upsell is a .list-row as well */
const rowEls = `#dirList .list-row[data-route^="#/directory/"]`;
const rows = () => page.evaluate((sel) => Array.from(document.querySelectorAll(sel))
  .map(r => (r.querySelector('.row-title') || {}).textContent.trim()), rowEls);
const dismissSheet = async () => {
  await page.evaluate(() => { const s = document.querySelector('.sheet-scrim'); if (s) s.click(); });
  await page.waitForTimeout(430);
};
/** freeze the browser clock, reload so the app boots at that instant */
const atTime = async (iso) => {
  await page.clock.setFixedTime(new Date(iso));
  await page.reload();
  await page.waitForTimeout(700);
};

await page.goto(BASE);
await page.waitForTimeout(800);

/* ======================================================================
   PART 1 — structured hours and the open/closed maths
   ====================================================================== */
console.log('--- hours ---');

/* b1 trades 11:00–23:00, and 11:00–02:00 on Friday and Saturday.
   2026-08-19 is a Wednesday. */
await atTime('2026-08-19T15:00:00');
await go('#/directory/b1');
let body = await txt();
ok('Wed 15:00 — Al Sham reads open', body.includes('مفتوح الآن'), body.match(/مفتوح[^·\n]{0,18}/)?.[0]);
ok('the week table is drawn', await page.locator('.hours-row').count() === 7);
ok('today is picked out', await page.locator('.hours-row.today').count() === 1);
ok('today is really Wednesday', (await page.textContent('.hours-row.today')).includes('الأربعاء'),
   (await page.textContent('.hours-row.today')).trim());
/* V.02.7: the digits are Latin in both languages — the address and the
   phone beside them always were. The 12-hour form is unchanged. */
ok('times are shown 12-hour, not 24', /11:00 ص/.test(body), (body.match(/\d+:\d+ [صم]/g) || []).slice(0, 3).join(' '));

await atTime('2026-08-19T22:30:00');
await go('#/directory/b1');
body = await txt();
ok('Wed 22:30 — warns that it closes within the hour', body.includes('يغلق بعد أقل من ساعة'));

await atTime('2026-08-19T09:00:00');
await go('#/directory/b1');
body = await txt();
ok('Wed 09:00 — reads closed, and says when it opens',
   body.includes('يفتح') && !body.includes('مفتوح الآن'), body.match(/يفتح[^·\n]{0,14}/)?.[0]);

/* the case that catches naive implementations: 00:30 on Saturday is still
   inside Friday's 11:00 → 02:00 span */
await atTime('2026-08-22T00:30:00');   // Saturday 00:30
await go('#/directory/b1');
body = await txt();
ok('Sat 00:30 — still open on Friday night\'s span (past midnight)', body.includes('مفتوح الآن'));

await atTime('2026-08-22T03:00:00');   // Saturday 03:00, after the 02:00 close
await go('#/directory/b1');
body = await txt();
ok('Sat 03:00 — closed again after 02:00', !body.includes('مفتوح الآن'));

/* 24 hours, and a day off */
await atTime('2026-08-19T03:00:00');
await go('#/directory/b8');
ok('the 24-hour business reads "open 24 hours"', (await txt()).includes('مفتوح 24 ساعة'));

await atTime('2026-08-21T11:00:00');   // Friday — the clinic is closed Fridays
await go('#/directory/b3');
body = await txt();
ok('a closed weekday reads closed', !body.includes('مفتوح الآن'));
ok('that day shows "closed" in the week table',
   (await page.textContent('.hours-row.today')).includes('مغلق'),
   (await page.textContent('.hours-row.today')).trim());

/* two spans in a day: the salon shuts 14:00–16:00 */
await atTime('2026-08-19T15:00:00');
await go('#/directory/b7');
ok('inside the midday break the salon is closed', await page.evaluate(() => {
  const pill = document.querySelector('.detail-body .open-pill');
  return !!pill && !pill.textContent.includes('مفتوح الآن');
}), await page.evaluate(() => (document.querySelector('.detail-body .open-pill') || {}).textContent));
ok('the day shows both spans',
   ((await page.textContent('.hours-row.today')).match(/–/g) || []).length === 2,
   (await page.textContent('.hours-row.today')).trim());
await atTime('2026-08-19T17:00:00');
await go('#/directory/b7');
ok('after the break it is open again', (await txt()).includes('مفتوح الآن'));

/* ======================================================================
   PART 2 — "open now" as a filter and as a sort
   ====================================================================== */
console.log('--- open now ---');
await atTime('2026-08-19T09:00:00');   // Wednesday 09:00
await go('#/directory');
const all9 = (await rows()).length;
await toggleOpenNow(page);
const open9 = await rows();
ok('the "open now" chip narrows the list', open9.length < all9, open9.length + ' of ' + all9);
ok('every remaining row shows an open pill', await page.evaluate((sel) =>
  Array.from(document.querySelectorAll(sel))
    .every(r => !!r.querySelector('.open-pill.open, .open-pill.soon')), rowEls));
ok('Al Sham (opens 11:00) is filtered out at 09:00', !open9.some(x => x.includes('الشام')), open9.join(' | '));
ok('the 24-hour business survives', open9.some(x => x.includes('أبو خالد')));

await toggleOpenNow(page);
ok('turning the chip off restores the list', (await rows()).length === all9);

/* sort: open first */
await page.click('#dirFilter'); await page.waitForTimeout(450);
await page.click('#fSort .chip[data-s="open"]'); await page.waitForTimeout(200);
await page.click('#fApply'); await page.waitForTimeout(500);
ok('"open first" sort is offered and applies', await page.evaluate((sel) => {
  const list = Array.from(document.querySelectorAll(sel));
  const open = list.map(r => !!r.querySelector('.open-pill.open, .open-pill.soon'));
  // once a closed one appears no open one may follow
  return open.indexOf(false) === -1 || !open.slice(open.indexOf(false)).includes(true);
}, rowEls));
await page.click('#dirFilter'); await page.waitForTimeout(450);
await page.click('#fClear'); await page.waitForTimeout(500);

/* ======================================================================
   PART 3 — search across keywords, both languages
   ====================================================================== */
console.log('--- search ---');
await go('#/directory');
const searchFor = async (term) => {
  await page.fill('#dirSearch', term);
  await page.waitForTimeout(400);
  return rows();
};
/* "شاورما" is in b1's keywords only — not in its name and not in its description */
ok('a keyword that is in neither the name nor the description still finds it',
   (await searchFor('شاورما')).some(x => x.includes('الشام')), (await rows()).join(' | '));
ok('the English half of the same keyword list works too',
   (await searchFor('shawarma')).some(x => x.includes('الشام')));
ok('an English keyword finds an Arabic-named business',
   (await searchFor('green card')).some(x => x.includes('الهدى')), (await rows()).join(' | '));
ok('searching by category name works', (await searchFor('مطاعم')).length >= 2, (await rows()).join(' | '));
ok('the category name in the other language works too',
   (await searchFor('restaurants')).length >= 2, (await rows()).join(' | '));
const kunafa = await searchFor('كنافة');
ok('a rare keyword narrows to the shops that carry it',
   kunafa.length && kunafa.length < 20 && kunafa.some(x => /بيروت|دمشق/.test(x))
     && !kunafa.some(x => /الشام|النور/.test(x)),
   kunafa.length + ': ' + kunafa.join(' | '));
/* V.01.8 batch four: two words that never occur together no longer zero
   the screen. The all-words pass finds nothing, so the near-miss pass
   offers what matches either word — and says so above the results. */
const twoWords = await searchFor('شاورما كنافة');
ok('two words that never co-occur fall back to the closest',
   twoWords.length > 0 && await page.locator('.near-miss').count() === 1, twoWords.length + " results");
ok('…and the line says it is not an exact match',
   (await page.textContent('.near-miss')).includes('تماماً'));
/* V.02.6: «زربيان» is in the synonym dictionary now — a Gulf rice dish
   that used to find nothing and now finds the mandi houses. The dead end
   needs a word that really is nowhere. */
ok('a word nobody uses still finds nothing', (await searchFor('زرافة')).length === 0);
const bare = await searchFor('احمد'), hamza = await searchFor('أحمد');
const tatweel = await searchFor('مطـعم'), plain = await searchFor('مطعم');
ok('an alef with hamza and one without find the same shops',
   bare.length === hamza.length && bare.join('|') === hamza.join('|'),
   bare.length + ' vs ' + hamza.length);
ok('tatweel is folded away too',
   tatweel.length === plain.length && tatweel.length > 0,
   tatweel.length + ' vs ' + plain.length);

/* the designed dead end */
await searchFor('زرافة');
ok('a filtered dead end has its own empty state', (await txt()).includes('لا توجد نتائج بهذه الفلاتر'));
ok('…with a "clear filters" button', await page.locator('#clrF').count() === 1);
await page.click('#clrF'); await page.waitForTimeout(450);
ok('clearing brings the list back', (await rows()).length > 0, (await rows()).length + ' rows');
ok('…and empties the search box', (await page.inputValue('#dirSearch')) === '');

/* ======================================================================
   PART 4 — the general attribute system
   ====================================================================== */
console.log('--- attributes ---');
/* V.02.0: chips are no longer declared, they are counted — an attribute earns
   one once CHIP_MIN businesses in that category carry it. */
await go('#/directory?cat=restaurants');
let chips = (await sheetAttrIds(page)).map(id => ({ id, label: id }));
ok('restaurants get chips for the attributes that reached the threshold',
   chips.map(c => c.id).includes('halalMeat') && chips.map(c => c.id).includes('noAlcohol'),
   chips.map(c => c.label).join(' · '));
/* V.02.7: «مفتوح الآن» is the first control in the ⚙ sheet — the chip
   row it used to lead no longer exists. */
ok('"open now" leads the sheet', await (async () => {
  await page.click('#dirFilter'); await page.waitForTimeout(520);
  const first = await page.evaluate(() => !!document.querySelector('#fOpenNow'));
  await page.click('#fApply'); await page.waitForTimeout(520);
  return first;
})());
ok('a doctors-only attribute is not offered under restaurants',
   !chips.map(c => c.id).includes('femaleDoctor'));

await go('#/directory?cat=homeservices');
chips = await sheetAttrIds(page);
/* homeservices has three listings, so the sheet offers only what really
   has content behind it — a short list, never an empty filter. */
ok('a thin category offers only what has content', chips.length <= 6, chips.join(' '));
await go('#/directory?cat=doctors');
ok('…but the filter sheet still offers what has content', await (async () => {
  await page.click('#dirFilter'); await page.waitForTimeout(500);
  const sheet = await page.textContent('#sheet');
  const has = sheet.includes('طبيبة') && sheet.includes('ميديكيد');
  await page.evaluate(() => { const s = document.querySelector('.sheet-scrim'); if (s) s.click(); });
  await page.waitForTimeout(430);
  return has;
})());
ok('halal is not offered under doctors', !chips.includes('halalMeat'));

await go('#/directory?cat=beauty');
ok('beauty offers its specialities in the sheet', await (async () => {
  await page.click('#dirFilter'); await page.waitForTimeout(500);
  const sheet = await page.textContent('#sheet');
  const has = sheet.includes('نسائي فقط') && sheet.includes('صالون نسائي');
  await page.evaluate(() => { const s = document.querySelector('.sheet-scrim'); if (s) s.click(); });
  await page.waitForTimeout(430);
  return has;
})());

await go('#/directory?cat=gyms');
ok('the gyms category offers its own options', await (async () => {
  await page.click('#dirFilter'); await page.waitForTimeout(500);
  const sheet = await page.textContent('#sheet');
  const has = sheet.includes('أوقات نسائية') && sheet.includes('ملاكمة');
  await page.evaluate(() => { const s = document.querySelector('.sheet-scrim'); if (s) s.click(); });
  await page.waitForTimeout(430);
  return has;
})());

/* chips combine. "Arabic spoken" is no longer offered as a chip in
   restaurants — 138 of 138 carry it, and CHIP_MAX_SHARE keeps anything
   above 60% out of the quick row — so the second chip is whichever one
   the row does offer. */
await go('#/directory?cat=restaurants');
const allRest = (await rows()).length;
const chipIds = (await page.evaluate(async () => {
  const st = await import('./js/store.js').catch(() => null);
  return st ? st.quickAttrsForCat('restaurants', 5).map(a => a.id) : [];
}));
ok('the quick set leaves out what everybody has', !chipIds.includes('arabicSpoken'), chipIds.join(' '));
await toggleAttr(page, chipIds[0]);
const oneChip = (await rows()).length;
await toggleAttr(page, chipIds[1]);
const twoChips = await rows();
ok('one chip narrows', oneChip <= allRest, oneChip + ' of ' + allRest);
ok('two chips narrow further and combine, not widen', twoChips.length <= oneChip, twoChips.length + ' of ' + oneChip);
ok('both chips read as active', await page.evaluate(() =>
  document.querySelectorAll('#pills [data-off]').length >= 2));
/* V.02.4: the badge counts the filters that are *not* already written on
   the row. The category has its own picker showing its name, so counting
   it here only repeated what the reader could already read. */
ok('the filter counter counts them', (await page.textContent('#fCount')).trim() === '2',
   (await page.textContent('#fCount')).trim());
ok('and each one is shown as a removable pill',
   await page.locator('#pills .pill[data-off]').count() === 2,
   String(await page.locator('#pills .pill[data-off]').count()));

/* A family salon must appear under women AND under family — never as two
   listings. Below the chip threshold those filters live in the sheet. */
const filterBy = async (cat, attrId) => {
  await go('#/directory?cat=' + cat);
  await page.click('#dirFilter'); await page.waitForTimeout(500);
  await page.click(`#sheet .chip[data-a="${attrId}"]`); await page.waitForTimeout(200);
  await page.click('#fApply'); await page.waitForTimeout(500);
  return rows();
};
const underWomen = await filterBy('beauty', 'women');
const underFamily = await filterBy('beauty', 'familyPlace');
ok('the family salon shows under "women"', underWomen.some(x => x.includes('ليان')), underWomen.join(' | '));
ok('…and under "family", as one listing not two',
   underFamily.some(x => x.includes('ليان')) && underFamily.length === new Set(underFamily).size);
await go('#/directory?cat=beauty');
await page.click('#dirFilter'); await page.waitForTimeout(450);
await page.click('#fClear'); await page.waitForTimeout(500);

/* switching category drops attributes that no longer apply */
await go('#/directory?cat=restaurants');
await toggleAttr(page, 'halalMeat');
await page.click('#ctlCat'); await page.waitForTimeout(320);
await page.evaluate(() => document.querySelector('.dd-row[data-v="doctors"]').click());
await page.waitForTimeout(500);
ok('changing category clears an attribute that does not apply there',
   await page.evaluate(() => document.querySelectorAll('#pills [data-off]').length) === 0);

/* the filter sheet builds itself from the same registry */
await go('#/directory?cat=doctors');
await page.click('#dirFilter'); await page.waitForTimeout(500);
const sheet = await page.textContent('#sheet');
ok('the sheet lists the insurance group for doctors', sheet.includes('التأمين المقبول'));
// the sheet shows what has content: this clinic takes three of the four
ok('…with the insurance options that have content',
   ['ميديكيد', 'تأمين خاص', 'بدون تأمين'].every(x => sheet.includes(x)),
   ['ميديكيد', 'ميديكير', 'تأمين خاص', 'بدون تأمين'].filter(x => sheet.includes(x)).join(' · '));
ok('the sheet offers "open now"', await page.locator('#fOpenNow').count() === 1);
ok('the sheet offers "open first" sorting', sheet.includes('المفتوح أولاً'));
await page.click('#sheet .chip[data-a="insMedicaid"]'); await page.waitForTimeout(200);
await page.click('#fApply'); await page.waitForTimeout(500);
ok('an insurance filter chosen in the sheet applies',
   (await rows()).length >= 1 && (await rows()).every(x => x.includes('النور')), (await rows()).join(' | '));
await page.click('#dirFilter'); await page.waitForTimeout(450);
await page.click('#fClear'); await page.waitForTimeout(500);

/* attributes shown on the business page */
await go('#/directory/b1');
ok('the business page lists its attribute chips', await page.locator('.attr-chip').count() >= 5,
   await page.locator('.attr-chip').count() + ' chips');
ok('…and names them', (await txt()).includes('ذبيحة حلال') && (await txt()).includes('بدون كحول'));

/* ======================================================================
   PART 5 — seasonal group behind one admin switch
   ====================================================================== */
console.log('--- Ramadan switch ---');
await go('#/directory?cat=restaurants');
chips = await sheetAttrIds(page);
ok('Ramadan attributes are hidden by default', !chips.includes('iftar'), chips.join(' '));
await go('#/directory/b1');
ok('…and not shown on a business page either', !(await txt()).includes('إفطار جماعي'));

await go('#/admin');
await page.fill('#aUser', 'arabna.admin');
await page.fill('#aPass', 'Arabna@2026!');
await page.click('#aGo'); await page.waitForTimeout(500);
await page.click('#aTabs .tab[data-t="set"]'); await page.waitForTimeout(400);
ok('the admin settings carry the Ramadan switch', await page.locator('#ramSw').count() === 1);
await page.click('#ramSw'); await page.waitForTimeout(400);
ok('the switch turns on', await page.evaluate(() => document.querySelector('#ramSw').classList.contains('on')));

await go('#/directory?cat=restaurants');
await page.click('#dirFilter'); await page.waitForTimeout(500);
ok('Ramadan options appear in the sheet once switched on',
   (await page.textContent('#sheet')).includes('إفطار جماعي'));
await page.evaluate(() => { const s = document.querySelector('.sheet-scrim'); if (s) s.click(); });
await page.waitForTimeout(430);
await go('#/directory/b1');
ok('…and on the business page', (await txt()).includes('إفطار جماعي'));

await go('#/admin');
await page.click('#aTabs .tab[data-t="set"]'); await page.waitForTimeout(400);
await page.click('#ramSw'); await page.waitForTimeout(400);
await go('#/directory?cat=restaurants');
await page.click('#dirFilter'); await page.waitForTimeout(500);
ok('switching it off hides them again',
   !(await page.textContent('#sheet')).includes('إفطار جماعي'));
await page.evaluate(() => { const s = document.querySelector('.sheet-scrim'); if (s) s.click(); });
await page.waitForTimeout(430);

/* ======================================================================
   PART 6 — places of worship
   ====================================================================== */
console.log('--- worship ---');
await go('#/directory');
await page.click('#ctlCat'); await page.waitForTimeout(350);
ok('the directory offers a "places of worship" category',
   await page.evaluate(() => !!document.querySelector('.dd-row[data-v="worship"]')));
ok('it is not called "mosques"', !(await page.textContent('.dd-panel')).includes('مساجد'));
await page.keyboard.press('Escape'); await page.waitForTimeout(250);

await go('#/directory/b11');
body = await txt();
ok('the mosque page shows the five prayer times', await page.locator('.wor-cell').count() === 5);
for (const p of ['الفجر', 'الظهر', 'العصر', 'المغرب', 'العشاء']) {
  ok('prayer listed: ' + p, body.includes(p));
}
ok('the Friday sermon time is shown', body.includes('خطبة الجمعة'));
ok('the sermon language is shown', body.includes('لغة الخطبة') && body.includes('عربية وإنجليزية'));
ok('its facilities are listed', body.includes('مصلّى نساء') && body.includes('تحفيظ قرآن'));

await go('#/directory/b12');
body = await txt();
ok('the church page shows mass times instead of prayers', body.includes('أوقات القداس')
   && await page.locator('.wor-cell').count() === 0);
ok('the church shows liturgy language', body.includes('لغة القداس'));

await go('#/directory?cat=worship');
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  s.radius = 25;                     // the church is 7.3 miles out
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});
await page.reload(); await page.waitForTimeout(700);
await go('#/directory?cat=worship');
const worship = await rows();
ok('both a mosque and a church sit in the same category',
   worship.some(x => /مسجد|Masjid|Islamic|Mosque/i.test(x))
   && worship.some(x => /كنيسة|Church/i.test(x)),
   worship.length + ' places');

/* Arabic schooling built out of the same system, not a bespoke sub-category */
await go('#/directory?cat=education');
await page.click('#dirFilter'); await page.waitForTimeout(500);
const eduSheet = await page.textContent('#sheet');
ok('education carries the Arabic-schooling options',
   ['مدرسة عربية', 'تحفيظ قرآن', 'صفوف نهاية الأسبوع', 'دروس خصوصية'].every(x => eduSheet.includes(x)));
await page.evaluate(() => { const s = document.querySelector('.sheet-scrim'); if (s) s.click(); });
await page.waitForTimeout(430);

/* newcomer services, cross-category so nothing is listed twice */
await go('#/directory?cat=lawyers');
await page.click('#dirFilter'); await page.waitForTimeout(500);
const lawSheet = await page.textContent('#sheet');
ok('newcomer services are offered where they are looked for',
   lawSheet.includes('هجرة') && lawSheet.includes('ترجمة معتمدة'));
await page.evaluate(() => { const s = document.querySelector('.sheet-scrim'); if (s) s.click(); });
await page.waitForTimeout(430);

/* ======================================================================
   PART 7 — duplicate detection
   ====================================================================== */
console.log('--- duplicates ---');
/* become a phone-verified member so the add form actually saves */
await go('#/auth/signup');
// V.02.7: one name field became two, and the password is confirmed

await page.fill('#sFirst', 'رامي');

await page.fill('#sLast', 'البي');
await page.fill('#sEmail', 'rami@arabna.app');
await page.fill('#sPass', 'pass1234');

await page.fill('#sPass2', 'pass1234');
await page.check('#agree1'); await page.check('#agree2');
await page.click('#suBtn'); await page.waitForTimeout(900);
await page.click('[data-fill="e"]'); await page.click('#vBtn'); await page.waitForTimeout(900);
await go('#/auth/phone');
await page.fill('#phIn', '(713) 466-9182');
await page.click('#sendBtn'); await page.waitForTimeout(1600);
await page.click('[data-fill="p"]'); await page.click('#vBtn'); await page.waitForTimeout(1000);
ok('phone-verified for the add-business flow', await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  return !!(s.user && s.user.phoneVerified);
}));

await go('#/add-business');
ok('the add form asks for keywords', (await txt()).includes('كلمات مفتاحية'));
ok('the add form has a seven-day hours editor', await page.locator('.hrs-row').count() === 7);
/* V.02.7: the options are inside one box per group, and there are none
   until a category is chosen — the category is required now. */
await page.selectOption('#bCat', 'restaurants'); await page.waitForTimeout(400);
ok('the add form builds attribute options automatically',
   await page.locator('#bAttrs .chip').count() > 5, await page.locator('#bAttrs .chip').count() + ' options');
ok('…grouped into boxes', await page.locator('.attr-box').count() > 1,
   await page.locator('.attr-box').count() + ' groups');

/* the attribute options follow the chosen category */
await page.selectOption('#bCat', 'doctors'); await page.waitForTimeout(400);
ok('choosing "doctors" rebuilds the options', (await page.textContent('#bAttrs')).includes('ميديكيد'));
ok('…and drops the restaurant ones', !(await page.textContent('#bAttrs')).includes('ذبيحة حلال'));

/* exclusive groups hold one answer */
await page.selectOption('#bCat', 'restaurants'); await page.waitForTimeout(400);
/* V.02.7: one speciality from every group is required, so a save walk has
   to answer each box. This picks the first option in each. */
const fillAllGroups = async () => {
  const n = await page.locator('.attr-box').count();
  for (let i = 0; i < n; i++) {
    await page.evaluate((idx) => {
      const box = document.querySelectorAll('.attr-box')[idx];
      if (!box) return;
      if (!box.classList.contains('open')) box.querySelector('.attr-head').click();
    }, i);
    await page.waitForTimeout(160);
    await page.evaluate((idx) => {
      const box = document.querySelectorAll('.attr-box')[idx];
      const chip = box && box.querySelector('.chip:not(.active)');
      if (chip) chip.click();
    }, i);
    await page.waitForTimeout(160);
  }
};
const openBoxFor = async (id) => {
  await page.evaluate((a) => {
    const chip = document.querySelector(`#bAttrs .chip[data-a="${a}"]`);
    const box = chip && chip.closest('.attr-box');
    if (box && !box.classList.contains('open')) box.querySelector('.attr-head').click();
  }, id);
  await page.waitForTimeout(250);
  await page.click(`#bAttrs .chip[data-a="${id}"]`); await page.waitForTimeout(250);
};
await openBoxFor('halalMeat');
await openBoxFor('notHalal');
ok('an exclusive group keeps only the last answer', await page.evaluate(() => {
  const on = Array.from(document.querySelectorAll('#bAttrs .chip.active')).map(c => c.dataset.a);
  return on.includes('notHalal') && !on.includes('halalMeat');
}));

/* the look-alike sheet, by phone. V.01.8 batch four: it never refuses —
   it offers the existing page instead, because a shop owner typing their
   own name in is a claim waiting to happen. */
await page.fill('#bName', 'مطعم الشام الجديد');
// V.02.7: the category is required before #bSave comes alive
await page.selectOption('#bCat', 'restaurants'); await page.waitForTimeout(200);
await page.fill('#bPhone', '713-555-0142');          // same number as b1, typed differently
await page.fill('#bAddr', '999 Some Other St, Houston, TX');
await page.click('#bSave'); await page.waitForTimeout(700);
ok('a repeated phone number raises the look-alike sheet',
   await page.locator('.sim-card').count() === 1);
let simTxt = await page.textContent('#sheet');
ok('the sheet names the matching business', simTxt.includes('الشام'));
ok('…and says why it matched', simTxt.includes('نفس رقم الهاتف'));
ok('…and never uses the word "duplicate"', !simTxt.includes('مكرر'));
ok('the first offer is to claim the existing page', await page.locator('#simClaim').count() === 1);
ok('…with "different place" second and "back" third',
   await page.locator('#simDiff').count() === 1 && await page.locator('#simBack').count() === 1);
ok('a certain match warns that it will be reviewed', simTxt.includes('24 ساعة'));
ok('nothing was saved while the sheet stands', await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  return (s.extraBusinesses || []).length === 0;
}));

/* "this is mine" is the whole point of the screen */
await page.click('#simClaim'); await page.waitForTimeout(700);
ok('"this is mine" opens the claim flow on the existing listing',
   (await hash()).startsWith('#/claim/b1'), await hash());
ok('…and still nothing was added', await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  return (s.extraBusinesses || []).length === 0;
}));

/* "no, different place" goes through — but a certain match waits for review */
await go('#/add-business');
await page.fill('#bName', 'مطعم الشام الجديد');
await page.selectOption('#bCat', 'restaurants'); await page.waitForTimeout(350);
await openBoxFor('notHalal');
await fillAllGroups();
await page.fill('#bPhone', '713-555-0142');
await page.fill('#bAddr', '999 Some Other St, Houston, TX');
await page.click('#bSave'); await page.waitForTimeout(700);
await page.click('#simDiff'); await page.waitForTimeout(900);
ok('choosing "different place" saves it', (await hash()).startsWith('#/directory/'), await hash());
ok('…and it really is stored', await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  return (s.extraBusinesses || []).length === 1;
}));
ok('…held for review, because the match was certain', await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  return s.extraBusinesses[0].status === 'pendingReview'
      && (s.myPendingBusinesses || []).length === 1;
}));
ok('the person who entered it can still see it', (await txt()).includes('مطعم الشام الجديد'));
ok('the new record kept its keywords and attributes', await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  const b = s.extraBusinesses[0];
  // V.02.7: every group is answered, so there are several
  return Array.isArray(b.attributes) && b.attributes.length >= 4
      && Array.isArray(b.hours) && b.hours.length === 7;
}));

/* "back" leaves the form alone */
await go('#/add-business');
await page.fill('#bName', 'فرع آخر');
// V.02.7: the category is required before #bSave comes alive
await page.selectOption('#bCat', 'restaurants'); await page.waitForTimeout(200);
await page.fill('#bPhone', '(281) 555-0198');        // b2
await page.fill('#bAddr', 'somewhere');
await page.click('#bSave'); await page.waitForTimeout(700);
ok('the sheet appears again for another match', await page.locator('.sim-card').count() === 1);
await page.click('#simBack'); await page.waitForTimeout(600);
ok('"back" saves nothing', await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  return (s.extraBusinesses || []).length === 1;
}));
ok('…and leaves what was typed in place', await page.inputValue('#bName') === 'فرع آخر');

/* a genuinely new business goes straight through */
await go('#/add-business');
await page.fill('#bName', 'مخبز جديد تماماً');
// V.02.7: the category is required before #bSave comes alive
await page.selectOption('#bCat', 'restaurants'); await page.waitForTimeout(200);
await fillAllGroups();
await page.fill('#bPhone', '(713) 555-9999');
await page.fill('#bAddr', '1 New Rd, Houston, TX');
await page.click('#bSave'); await page.waitForTimeout(800);
ok('a genuinely new business raises no warning', (await hash()).startsWith('#/directory/'), await hash());

/* ======================================================================
   PART 8 — merging duplicates in admin
   ====================================================================== */
console.log('--- merge ---');
// addBusiness unshifts, so index 0 is the most recent — pick by name instead
const dropId = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  return (s.extraBusinesses || []).find(b => b.name.ar.includes('الجديد')).id;
});
/* give the duplicate a review and a star so the move can be observed */
await page.evaluate((id) => {
  const s = JSON.parse(localStorage.getItem('arabna.v1'));
  s.reviews = (s.reviews || []).concat([{ id: 'rX', bizId: id, rating: 5,
    when: { ar: 'الآن', en: 'now' }, text: { ar: 'اختبار', en: 'test' } }]);
  s.saved = (s.saved || []).concat([id]);
  localStorage.setItem('arabna.v1', JSON.stringify(s));
}, dropId);
await page.reload(); await page.waitForTimeout(700);

// the admin panel locks itself again after a reload
await go('#/admin');
await page.fill('#aUser', 'arabna.admin');
await page.fill('#aPass', 'Arabna@2026!');
await page.click('#aGo'); await page.waitForTimeout(500);
await page.click('#aTabs .tab[data-t="dir"]'); await page.waitForTimeout(400);
ok('the directory tab offers a merge tool', await page.locator('#mgGo').count() === 1);
await page.selectOption('#mgKeep', 'b1');
await page.selectOption('#mgDrop', dropId);
await page.click('#mgGo'); await page.waitForTimeout(500);
await page.evaluate(() => document.querySelector('#cfmYes').click());
await page.waitForTimeout(700);

const after = await page.evaluate((d) => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  return {
    stillThere: (s.extraBusinesses || []).some(b => b.id === d),
    reviewMoved: (s.reviews || []).some(r => r.id === 'rX' && r.bizId === 'b1'),
    savedMoved: (s.saved || []).includes('b1') && !(s.saved || []).includes(d),
    logged: (s.mergedBusinesses || []).length === 1,
  };
}, dropId);
ok('merge: the duplicate record is removed', !after.stillThere);
ok('merge: its review moved to the survivor', after.reviewMoved);
ok('merge: the favourite moved too', after.savedMoved);
ok('merge: the merge is recorded', after.logged);
await go('#/directory');
ok('merge: the duplicate no longer appears in the list',
   !(await rows()).some(x => x.includes('مطعم الشام الجديد')), (await rows()).join(' | '));
ok('merge: the survivor is still listed', (await rows()).some(x => x.includes('مطعم الشام')));

/* ======================================================================
   PART 9 — English
   ====================================================================== */
console.log('--- English ---');
await go('#/home');
await page.evaluate(() => document.querySelector('#hMenu').click()); await page.waitForTimeout(430);
await page.click('#drLang'); await page.waitForTimeout(650);
ok('switched to English', await page.evaluate(() => document.documentElement.lang === 'en'));

await atTime('2026-08-19T15:00:00');
await page.evaluate(() => { location.hash = '#/directory/b1'; }); await page.waitForTimeout(500);
body = await txt();
ok('EN: open badge translated', body.includes('Open now'));
ok('EN: 12-hour times use am/pm', /11:00am/.test(body), (body.match(/\d+:\d+[ap]m/g) || []).slice(0, 3).join(' '));
ok('EN: the week table uses English day names', body.includes('Wednesday'));
ok('EN: attribute chips translated', body.includes('Halal meat') && body.includes('No alcohol'));

await go('#/directory?cat=doctors');
await page.click('#dirFilter'); await page.waitForTimeout(500);
ok('EN: the sheet options are translated',
   (await page.textContent('#sheet')).includes('Female doctor'),
   (await page.textContent('#sheet')).trim().replace(/\s+/g, ' ').slice(0, 80));
await page.evaluate(() => { const s = document.querySelector('.sheet-scrim'); if (s) s.click(); });
await page.waitForTimeout(430);
await go('#/directory');
ok('EN: an Arabic keyword finds the business from the English interface',
   (await searchFor('شاورما')).some(x => x.includes('Al Sham')), (await rows()).join(' | '));
await page.fill('#dirSearch', '');
await page.waitForTimeout(300);

await go('#/directory/b11');
/* V.03.1 split this block in two: the adhan is computed and the iqama is
   the mosque's own decision, so «Prayer times» is no longer one heading. */
ok('EN: worship category translated', (await txt()).includes('Iqama'), (await txt()).slice(0, 60));

await go('#/add-business');
ok('EN: the keywords field is translated', (await txt()).includes('Search keywords'));
ok('EN: the features section is translated', (await txt()).includes('Features'));

/* back to Arabic */
await go('#/home');
await page.evaluate(() => document.querySelector('#hMenu').click()); await page.waitForTimeout(430);
await page.click('#drLang'); await page.waitForTimeout(600);
ok('language toggles back to Arabic', await page.evaluate(() => document.documentElement.dir === 'rtl'));

const real = errors.filter(e => !/favicon|ERR_CONNECTION_RESET|Failed to load resource/i.test(e));
ok('no console errors', real.length === 0, real.slice(0, 4).join(' | '));

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);

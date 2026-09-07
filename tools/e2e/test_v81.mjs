/* V.10.6 — 645: eight from the live walk.
 *
 * ⚠️ Every one was found by hand on the live host, not by the net, and
 * none of them needs a server.
 *
 *   1  «البائع» is not everybody who posts — a job wanted and an hourly
 *      trade are two of the marketplace's own sections
 *   2  a category the directory did not have: transport and moving —
 *      and a category with no specialities is half a category
 *   3  the phone is required, EXCEPT for a non-commercial listing, and
 *      the mark on the label moves with that box, live
 *   4  a group that belongs to everybody is SHOWN to every category and
 *      DEMANDED of none — a car showroom was refused until it claimed a
 *      newcomer service it does not offer
 *   5  the field that is missing is marked, and the sentence stands
 *   6  the account list carries «إعلاناتي», and a door onto nothing is
 *      not drawn
 *   7  the cash screen says where the receipt's number comes from
 *
 * ⚠️ Item 4 is the one to read twice: the rule is DERIVED from the data
 * («does this group hold a speciality that names this category?»), so it
 * settles Ramadan in the same line it settles the other three — which is
 * the proof it is a rule and not four exceptions written out.
 */
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
/* comments stripped before any «does the code do X» check (test_v53's rule) */
const code = f => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const browser = await chromium.launch();
const errors = [];
const wire = p => {
  p.on('pageerror', e => errors.push('PAGEERROR ' + e.message.slice(0, 140)));
  p.on('console', m => { if (m.type() === 'error' &&
    !/supabase\.co|fonts\.googleapis/.test((m.location() && m.location().url) || '') &&
    !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|ERR_NAME|ERR_FAILED|fonts\.googleapis|supabase\.co/.test(m.text()))
    errors.push(m.text().slice(0, 140)); });
};
const fresh = async (opts = {}, ctxOpts = {}) => {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 390, height: 844 } }, ctxOpts));
  await ctx.route('**/fonts.googleapis.com/**', r => r.abort());
  const db = await mockSupabase(ctx, opts);
  await ctx.addInitScript(() => { try {
    const k = 'arabna.v1'; const s = JSON.parse(localStorage.getItem(k) || '{}');
    s.lang = 'ar'; s.showDemo = true; localStorage.setItem(k, JSON.stringify(s));
  } catch (e) {} });
  const p = await ctx.newPage(); wire(p);
  return { ctx, p, db };
};
const prime = p => p.evaluate(async () => {
  window.__S = await import('arabna/js/store.js').catch(() => import('./js/store.js'));
  window.__D = await import('arabna/js/data.js').catch(() => import('./js/data.js'));
  window.__I = await import('arabna/js/i18n.js').catch(() => import('./js/i18n.js'));
});
const open = async (p, hash = '#/home', wait = 1100) => {
  await p.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(wait);
  await prime(p);
};
const go = async (p, h, wait = 900) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(wait); };
const member = async (p, email) => p.evaluate(async ([em, c]) => {
  const S = window.__S;
  const err = await S.signUp({ name: 'Member ' + em, email: em, password: 'Qx7#mVzt2026', phone: '' });
  if (err) throw new Error(err);
  if (!S.state.user.emailVerified) { const e2 = await S.confirmEmail(c); if (e2) throw new Error(e2); }
  return S.state.user.email;
}, [email, MOCK_CODE]);

/* ============================================================
   1 — «تواصل مع المعلن»: the word holds for a job wanted too
   ============================================================ */
{
  const pack = read('js/i18n.js');
  /* ⚠️ Scoped to what is PRINTED, never to the file: `contactSeller` and
     `blockSeller` are key NAMES, and `blockSeller` already prints «حظر هذا
     المستخدم». A sweep over the whole file would demand renaming keys that
     say nothing wrong on screen. */
  const printed = [...pack.matchAll(/^\s*[A-Za-z0-9_]+:\s*(['"])([\s\S]*?)\1\s*,?\s*$/gm)].map(m => m[2]);
  const sells = printed.filter(v => /بائع|\bsellers?\b/i.test(v));
  ok('1.1 no string the app prints calls a poster a seller', sells.length === 0, sells.slice(0, 3).join(' | '));

  const ar = pack.slice(0, pack.indexOf('en:') > 0 ? pack.indexOf('en:') : pack.length);
  ok('1.2 the listing button reads «تواصل مع المعلن»', /contactSeller: 'تواصل مع المعلن'/.test(pack));
  ok('1.2b …and in English «Contact the poster»', /contactSeller: 'Contact the poster'/.test(pack));
  /* the three sites move TOGETHER or the screen and the FAQ disagree */
  ok('1.3 the FAQ question moved with it', /faqQ6: 'كيف أتواصل مع المعلن؟'/.test(pack));
  ok('1.4 …and so did the answer, which QUOTES the button', /faqA6: 'من صفحة الإعلان، زرّ «تواصل مع المعلن»/.test(pack));
  ok('1.5 …and the sign-up invitation', /joinSub: '[^']*المعلنين/.test(pack));
  ok('1.6 …and the message box', /messagePlaceholder: 'اكتب رسالتك للمعلن/.test(pack));
  ok('1.6b the same six in English', ['Contact the poster', 'contact the poster', 'message posters',
    'to the poster', 'Contact the poster”'].every(x => pack.includes(x)) || pack.includes('message posters'));

  const { ctx, p } = await fresh();
  await open(p, '#/help');
  const help = await p.innerText('#app');
  ok('1.7 nothing on «المساعدة» says «بائع»', !/بائع/.test(help));
  ok('1.7b …and it does name the poster', /المعلن/.test(help));
  await ctx.close();
}

/* ============================================================
   2 — the transport category, and a category is not half a category
   ============================================================ */
{
  const { ctx, p } = await fresh();
  await open(p, '#/categories');
  const d = await p.evaluate(() => {
    const D = window.__D;
    const c = D.CATEGORIES.find(x => x.id === 'transport');
    return {
      present: !!c, key: c && c.key, icon: c && c.icon, route: c && c.route,
      hue: D.CAT_HUE.transport,
      inHome: D.HOME_CATS.includes('transport'),
      group: D.ATTR_GROUPS.some(g => g.id === 'transportSvc'),
      attrs: D.ATTRIBUTES.filter(a => a.group === 'transportSvc').map(a => a.id),
      hueless: D.CATEGORIES.filter(x => !x.route && D.CAT_HUE[x.id] == null).map(x => x.id),
      /* every category must be able to describe itself, or whoever opens it
         finds nothing to say — which is item 4 seen from the other side */
      emptyCats: D.CATEGORIES.filter(x => !x.route &&
        !D.ATTRIBUTES.some(a => Array.isArray(a.cats) && a.cats.includes(x.id))).map(x => x.id),
    };
  });
  ok('2.1 the directory has a transport category', d.present && d.key === 'catTransport');
  ok('2.1b …drawn with an icon the file already had', d.icon === 'truck');
  ok('2.2 it carries its own group of specialities', d.group && d.attrs.length >= 5, d.attrs.length + ' attrs');
  /* structural, and general: not «transport has attrs» but «no category is
     shipped without them» — the next one is caught the day it is added */
  ok('2.3 NO category is shipped without a speciality of its own', d.emptyCats.length === 0, d.emptyCats.join(' '));
  ok('2.4 …and none without a hue', d.hueless.length === 0, d.hueless.join(' '));
  ok('2.5 the hue is outside the gold band 35–55', d.hue < 35 || d.hue > 55, String(d.hue));
  ok('2.6 it is NOT on Home — the five there are measured by screen width', !d.inHome);

  const tile = await p.evaluate(() => {
    const el = [...document.querySelectorAll('.cat-cell')].find(e => e.textContent.includes('نقل ومواصلات'));
    if (!el) return null;
    const ico = el.querySelector('.cc-ico');
    const cs = getComputedStyle(ico);
    return { h: ico.style.getPropertyValue('--h').trim(), bg: cs.backgroundColor, route: el.getAttribute('data-route') || '' };
  });
  ok('2.7 the tile is drawn, and its hue is on the tile itself', !!tile && tile.h === String(d.hue), tile && tile.h);
  ok('2.7b …with a ground, never a bare glyph', !!tile && !/rgba\(0, 0, 0, 0\)/.test(tile.bg), tile && tile.bg);

  const strings = await p.evaluate(() => {
    const I = window.__I, out = {};
    for (const lang of ['ar', 'en']) {
      I.setLang(lang);
      out[lang] = { cat: I.t('catTransport'), grp: I.t('attrGrpTransportSvc'),
        attrs: ['transMoving', 'transFreight', 'transParcel', 'transDriver', 'transBus', 'transAirport', 'transTow']
          .map(id => I.t('attr' + id[0].toUpperCase() + id.slice(1))) };
    }
    I.setLang('ar');
    return out;
  });
  const named = o => o.cat && !/^cat/.test(o.cat) && o.grp && !/^attr/.test(o.grp) && o.attrs.every(a => a && !/^attr/.test(a));
  ok('2.8 every new key is written in Arabic', named(strings.ar), strings.ar.cat);
  ok('2.8b …and in English', named(strings.en), strings.en.cat);
  await ctx.close();
}

/* ============================================================
   3 — the phone is required, except where the app already says why
   ============================================================ */
{
  const { ctx, p } = await fresh({ preConfirm: true });
  await open(p, '#/home');
  await member(p, 'phone645@a.app');
  await go(p, '#/add-business', 1100);

  const mark = () => p.evaluate(() => ({
    html: (document.querySelector('#bPhoneMark') || {}).innerHTML || '',
    hintHidden: !!(document.querySelector('#bPhoneHint') || {}).hidden,
  }));
  const a = await mark();
  ok('3.1 a commercial listing is asked for a number', /class="req"/.test(a.html), a.html.trim());
  ok('3.1b …and the «some places have none» hint is not shown to it', a.hintHidden);
  await p.check('#bNonComm'); await p.waitForTimeout(150);
  const b = await mark();
  ok('3.2 ticking «غير تجاريّ» makes it optional, LIVE', /optional|اختياري/.test(b.html), b.html.trim());
  ok('3.2b …and the hint comes back with it', !b.hintHidden);
  await p.uncheck('#bNonComm'); await p.waitForTimeout(150);
  ok('3.3 …and unticking puts the mark back', /class="req"/.test((await mark()).html));

  /* the save really refuses */
  await p.fill('#bName', 'Probe Transport LLC');
  await p.selectOption('#bCat', 'transport');
  await p.waitForTimeout(250);
  await p.click('#bSave'); await p.waitForTimeout(600);
  const st1 = await p.evaluate(() => ({
    err: (document.querySelector('#bErr') || {}).textContent || '',
    marked: !!document.querySelector('#bPhone.input-err'),
    hash: location.hash,
  }));
  ok('3.4 with no number the save is refused, and says so', st1.err.trim().length > 0 && st1.marked, st1.err.trim());
  ok('3.4b …and the screen is still the form', /add-business/.test(st1.hash));

  /* ⚠️ NO SHAPE IS DEMANDED. The item is that a number exists; a pattern
     imposed here refuses a correct international number. */
  await p.fill('#bPhone', '+962 79 000 0000'); await p.waitForTimeout(150);
  await p.click('#bSave'); await p.waitForTimeout(700);
  const st2 = await p.evaluate(() => ((document.querySelector('#bErr') || {}).textContent || '').trim());
  ok('3.5 an international number is accepted — no pattern is imposed', !/هاتف|phone/i.test(st2), st2 || '(moved on)');

  /* and a non-commercial listing may still have none */
  await p.fill('#bPhone', '');
  await p.check('#bNonComm'); await p.waitForTimeout(150);
  await p.click('#bSave'); await p.waitForTimeout(700);
  const st3 = await p.evaluate(() => ((document.querySelector('#bErr') || {}).textContent || '').trim());
  ok('3.6 a non-commercial listing is not asked for one', !/هاتف|phone/i.test(st3), st3 || '(moved on)');
  await ctx.close();
}

/* ============================================================
   4 — a group everybody could carry is demanded of nobody
   ============================================================ */
{
  const { ctx, p } = await fresh({ preConfirm: true });
  await open(p, '#/home');
  const req = await p.evaluate(() => {
    const S = window.__S;
    const shape = (cat) => {
      const gs = S.attrGroupsForCat(cat, { all: true });
      return {
        shown: gs.map(g => g.group.id),
        required: gs.filter(g => g.attrs.some(a => Array.isArray(a.cats) && a.cats.includes(cat)))
          .map(g => g.group.id),
      };
    };
    return { auto: shape('auto'), restaurants: shape('restaurants'), transport: shape('transport') };
  });
  const general = ['newcomer', 'language', 'practical'];
  ok('4.1 the general groups are still SHOWN to a car showroom',
    general.every(g => req.auto.shown.includes(g)), req.auto.shown.join(' '));
  ok('4.2 …and demanded of it no longer',
    general.every(g => !req.auto.required.includes(g)), req.auto.required.join(' '));
  ok('4.2b what IS demanded of it is its own', req.auto.required.length === 1 && req.auto.required[0] === 'autoSvc');
  ok('4.3 a restaurant is still asked for its own groups',
    req.restaurants.required.includes('cuisine') && req.restaurants.required.length >= 4,
    req.restaurants.required.join(' '));
  ok('4.3b …and not for the general ones',
    general.every(g => !req.restaurants.required.includes(g)));
  ok('4.4 the new category is asked for its own group only',
    req.transport.required.length === 1 && req.transport.required[0] === 'transportSvc');

  /* ⚠️ Ramadan is settled by the SAME line and is not a fourth exception:
     the season's own general attribute stops forcing a car showroom, while
     a restaurant, which has two of its own, is still asked. */
  const ram = await p.evaluate(() => {
    const S = window.__S;
    S.setSeason('ramadan', true);
    const shape = (cat) => S.attrGroupsForCat(cat, { all: true })
      .filter(g => g.attrs.some(a => Array.isArray(a.cats) && a.cats.includes(cat)))
      .map(g => g.group.id);
    const out = { auto: shape('auto'), restaurants: shape('restaurants'),
      shownAuto: S.attrGroupsForCat('auto', { all: true }).map(g => g.group.id) };
    S.setSeason('ramadan', false);
    return out;
  });
  ok('4.5 with Ramadan on, the group is shown to a car showroom', ram.shownAuto.includes('ramadan'), ram.shownAuto.join(' '));
  ok('4.5b …and not demanded of it', !ram.auto.includes('ramadan'), ram.auto.join(' '));
  ok('4.5c …and IS demanded of a restaurant, which has two of its own',
    ram.restaurants.includes('ramadan'), ram.restaurants.join(' '));

  /* and it really stops the save, so the rule did not fall for everybody */
  await member(p, 'grp645@a.app');
  await go(p, '#/add-business', 1100);
  await p.fill('#bName', 'Probe Showroom');
  await p.fill('#bPhone', '7135550000');
  await p.selectOption('#bCat', 'auto');
  await p.waitForTimeout(250);
  await p.click('#bSave'); await p.waitForTimeout(700);
  const msg = await p.evaluate(() => ((document.querySelector('#bErr') || {}).textContent || '').trim());
  ok('4.6 a car showroom is stopped by its OWN group, named', /السيارات|Auto/i.test(msg), msg);
  ok('4.6b …and never by «خدمات الوافدين الجدد»', !/الوافدين|newcomer/i.test(msg), msg);
  await ctx.close();
}

/* ============================================================
   5 — the missing field is seen, and the sentence does not run away
   ============================================================ */
{
  const { ctx, p } = await fresh({ preConfirm: true });
  await open(p, '#/home');
  await member(p, 'err645@a.app');
  await go(p, '#/add-business', 1100);

  ok('5.1 the form carries one standing place for the message',
    await p.locator('#bErr').count() === 1);
  ok('5.1b …and it is not drawn while there is nothing to say',
    await p.locator('#bErr').isHidden());

  await p.fill('#bName', 'Probe Errors');
  await p.selectOption('#bCat', 'transport');
  await p.waitForTimeout(250);
  await p.click('#bSave'); await p.waitForTimeout(700);
  const s1 = await p.evaluate(() => ({
    msg: ((document.querySelector('#bErr') || {}).textContent || '').trim(),
    marked: [...document.querySelectorAll('.input-err')].map(e => e.id || e.className),
    toasts: document.querySelectorAll('.toast').length,
  }));
  ok('5.2 the field that is missing is marked', s1.marked.includes('bPhone'), s1.marked.join(' '));
  ok('5.3 the reason is written where the work is', s1.msg.length > 0, s1.msg);
  /* ⚠️ Two messages for one error send the reader hunting for two errors */
  ok('5.4 …and NOT also shouted in a line that runs away', s1.toasts === 0, String(s1.toasts));

  await p.fill('#bPhone', '7135550000'); await p.waitForTimeout(200);
  const s2 = await p.evaluate(() => ({
    marked: !!document.querySelector('#bPhone.input-err'),
    msg: ((document.querySelector('#bErr') || {}).textContent || '').trim(),
  }));
  ok('5.5 the colour goes the moment the field is typed in', !s2.marked);
  ok('5.5b …and the sentence stands until the button is pressed again', s2.msg.length > 0);

  /* the group case is marked too — the box, since that is the control */
  await p.click('#bSave'); await p.waitForTimeout(700);
  const s3 = await p.evaluate(() => ({
    box: !!document.querySelector('.attr-box.input-err'),
    msg: ((document.querySelector('#bErr') || {}).textContent || '').trim(),
    toasts: document.querySelectorAll('.toast').length,
  }));
  ok('5.6 a missing speciality marks its own box', s3.box);
  ok('5.6b …names the group', /«[^»]+»|“[^”]+”/.test(s3.msg), s3.msg);
  ok('5.6c …and still raises no toast', s3.toasts === 0);

  /* and the name/category door takes the same road.
     ⚠️ Away and back, not back to the same hash: a hash that does not
     change fires no `hashchange`, so the screen is never rebuilt and the
     form would still be holding what the block above typed into it. */
  await go(p, '#/home', 500);
  await go(p, '#/add-business', 1000);
  await p.evaluate(() => { document.querySelector('#bSave').disabled = false; });
  await p.click('#bSave'); await p.waitForTimeout(600);
  const s4 = await p.evaluate(() => ({
    msg: ((document.querySelector('#bErr') || {}).textContent || '').trim(),
    marked: [...document.querySelectorAll('.input-err')].map(e => e.id),
    toasts: document.querySelectorAll('.toast').length,
  }));
  ok('5.7 an empty form marks the two the importer demands',
    s4.marked.includes('bName') && s4.marked.includes('bCat'), s4.marked.join(' '));
  ok('5.7b …says it once', s4.msg.length > 0 && s4.toasts === 0, s4.msg);

  /* structural: no `toast(` is left on the refusal path in this form */
  const src = code('js/screens/directory.js');
  const form = src.slice(src.indexOf('function AddBusinessScreen'));
  const finish = form.slice(form.indexOf('function finishChecks'), form.indexOf('function finishChecks') + 2200);
  ok('5.8 finishChecks refuses with a mark, never a toast', !/toast\(/.test(finish));
  await ctx.close();
}

/* ============================================================
   6 — the account list shows what belongs to its holder
   ============================================================ */
{
  const { ctx, p } = await fresh({ preConfirm: true });
  await open(p, '#/home');
  await member(p, 'hub645@a.app');
  await go(p, '#/profile', 1000);
  const rows = () => p.$$eval('.pad.mt-20 .list-row', els => els.map(e => ({
    title: e.querySelector('.row-title').textContent.trim(),
    route: e.getAttribute('data-route'),
    sub: (e.querySelector('.row-sub') || {}).textContent || '',
  })));
  const r1 = await rows();
  const route = h => r1.find(r => r.route === h);
  ok('6.1 «إعلاناتي» is a row, not only a number square', !!route('#/my-ads'), r1.map(r => r.route).join(' '));
  ok('6.1b …and it is the first of them', r1[0] && r1[0].route === '#/my-ads');
  ok('6.2 a fresh account is shown no receipts door', !route('#/receipts'));
  ok('6.2b …and no requests door', !route('#/my-requests'));
  /* ⚠️ the split is not «has an account»: a message, a notification and a
     block are begun by somebody ELSE at any moment, so their doors stay */
  ok('6.3 …while messages, notifications and blocks stay open',
    !!route('#/messages') && !!route('#/notifications') && !!route('#/blocked'));

  /* the door appears the moment there is something behind it */
  await p.evaluate(() => {
    const S = window.__S;
    S.state.receipts = [{ id: 'ARB-26-TEST1', when: S.now(), amount: 29, kind: 'sub',
      buyer: { name: 'Probe' }, lines: [] }];
    S.save();
  });
  await go(p, '#/home', 400); await go(p, '#/profile', 900);
  const r2 = await rows();
  ok('6.4 …and it is drawn as soon as one receipt exists',
    !!r2.find(r => r.route === '#/receipts'), r2.map(r => r.route).join(' '));

  /* and the count comes from the same place the screen does */
  const n = await p.evaluate(() => window.__S.myActiveListings().length);
  const sub = (await rows()).find(r => r.route === '#/my-ads').sub.trim();
  ok('6.5 the listings row carries its own count, and zero is not printed',
    n ? sub === String(n) : sub === '', `${n} · «${sub}»`);

  /* structural: one list, and `when` has exactly one reader */
  const st = code('js/store.js');
  ok('6.6 the rows are one list, filtered by a field on the row',
    /export function accountLinks\(\)/.test(st) && /l\.when/.test(st));
  const screens = code('js/screens/profile.js');
  ok('6.6b …and the screen reads the filtered list, never the raw one',
    /S\.accountLinks\(\)/.test(screens) && !/S\.ACCOUNT_LINKS/.test(screens));
  await ctx.close();
}

/* ============================================================
   7 — the cash screen says where the number comes from
   ============================================================ */
{
  const { ctx, p } = await fresh({ preConfirm: true });
  await open(p, '#/home');
  await unlockAdmin(p);
  await p.click('[data-t="ads"]'); await p.waitForTimeout(800);
  const scr = await p.innerText('#app');
  const label = await p.evaluate(() => {
    const inp = document.querySelector('#cshRef');
    const lab = inp && inp.closest('.field').querySelector('.label');
    return lab ? lab.textContent.trim() : '';
  });
  ok('7.1 the reference box says what it is for — an external number',
    /شيك|إيصال ورقيّ|Check|paper/i.test(label), label);
  ok('7.1b …and no longer calls itself «المرجع» alone', !/^رقم الشيك \/ المرجع$/.test(label));
  ok('7.2 the screen says the receipt number is generated', /ARB-26-XXXXX/.test(scr));

  /* ⚠️ AND THE GENERATOR IS NOT TOUCHED. It has minted the number since
     V.03.4 and its shape is what a column in the server's schema waits
     for; a second generator would have made two numbers for one receipt. */
  const shape = await p.evaluate(() => {
    const S = window.__S;
    const a = S.newReceiptNumber(), b = S.newReceiptNumber();
    return { a, b, ok: /^ARB-\d{2}-[A-Z0-9]{5}$/.test(a) && /^ARB-\d{2}-[A-Z0-9]{5}$/.test(b) };
  });
  ok('7.3 newReceiptNumber still mints ARB-26-XXXXX, letter for letter', shape.ok, shape.a);
  ok('7.4 …and no key with no reader is left behind',
    !/cashReference:/.test(read('js/i18n.js')));
  await ctx.close();
}

/* ============================================================
   8 — the carriers, and a clean console
   ============================================================ */
{
  const v = (read('js/data.js').match(/APP_VERSION = '([^']+)'/) || [])[1];
  const sw = (read('js/sw-manifest.js').match(/'([0-9.]+)'/) || [])[1];
  const cl = (read('CLAUDE.md').match(/Current version: \*\*V\.(\d+)\.(\d+)/) || []);
  const clv = cl.length ? `0.${parseInt(cl[1], 10)}.${parseInt(cl[2], 10)}` : '';
  ok('8.1 data.js, sw-manifest.js and CLAUDE.md carry one version', !!v && v === sw && v === clv, `${v} · ${sw} · ${clv}`);
  ok('8.2 zero console errors across every scene', errors.length === 0, errors.slice(0, 3).join(' | '));
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

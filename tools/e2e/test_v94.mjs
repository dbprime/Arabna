/* ============================================================
   test_v94 — 665أ: the greeting reaches the reader, and the
                    four settings reach every device
   ------------------------------------------------------------
   ⚠️ THE FAULT, IN ONE SENTENCE: a greeting written in the panel was
   shown to whoever wrote it and to nobody else on earth. `state.greetings`
   is a key on ONE PHONE, so the card was composed, validated, saved and
   drawn — on the author's own device. And the warning is the heavier half:
   «flooding expected» or «the office is shut today» is written to be read
   NOW, and the person who wrote it walked away satisfied.

   ⚠️ AND THE FOUR SETTINGS ARE THE SAME SHAPE WITH A SHARPER EDGE.
   Ramadan mode was switched on from a laptop and nobody saw it; the
   prayer calculation method was changed and everybody kept the old one —
   AND PEOPLE PRAY BY THOSE TIMES.

   ⚠️ AND NEITHER NEEDED A MIGRATION. `public.greetings` and
   `public.settings` have stood in `0001_schema.sql` since the first day
   and their policies in `0002` beside them: the column, the policy and
   the screen were all built and THE WIRE WAS MISSING — the fifth and
   sixth time this project has found that shape (`645` twice, `649`,
   `650`, `655`).

   ⚠️ AND EVERY BEHAVIOURAL ITEM IS MEASURED WITH TWO REAL BROWSERS
   SHARING ONE STAND-IN SERVER, never one device reading itself. That is
   the owner's own question — «does it reach the second phone?» — and a
   single-context test cannot answer it at all.

   Eight blocks: the greeting travels · the panel's own controls · the
   templates · the four settings · `boosted` · the migration table ·
   the three registration sites · the screens are unchanged.
   ============================================================ */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync, readdirSync } from 'node:fs';
import { mockSupabase, MOCK_CODE } from './_supabase.mjs';
import { unlockAdmin } from './_admin.mjs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
const ROOT = new URL('../../', import.meta.url).pathname;
const MIG = ROOT + 'supabase/migrations/';
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); }
  else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const read = f => readFileSync(ROOT + f, 'utf8');
/* ⚠️ comments stripped before any «does the code do X» check — the rule
   this project has now paid for six times. This batch's own comments NAME
   the shapes they forbid («never at the point of use», «no occasion is
   named here»), so a check reading the prose about the code reports the
   very fault it exists to prevent. */
const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const code = f => strip(read(f));
const sqlAll = () => readdirSync(MIG).filter(n => n.endsWith('.sql')).sort()
  .map(n => readFileSync(MIG + n, 'utf8')).join('\n');
const sqlCode = () => sqlAll().replace(/--[^\n]*/g, '');

const browser = await chromium.launch();
const errors = [];
const wire = p => {
  p.on('pageerror', e => errors.push('PAGEERROR ' + e.message.slice(0, 140)));
  p.on('console', m => { if (m.type() === 'error' &&
    !/supabase\.co|fonts\.googleapis/.test((m.location() && m.location().url) || '') &&
    !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|ERR_NAME|ERR_FAILED|fonts\.googleapis|supabase\.co/.test(m.text()))
    errors.push(m.text().slice(0, 140)); });
};
/* ⚠️ ONE `db` OBJECT SHARED BY TWO CONTEXTS — that IS the shape of the
   original fault, and a suite giving each browser its own database would
   measure nothing at all. The SESSION is per context (`671`), so the two
   really are two people. */
const fresh = async (opts = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route('**/fonts.googleapis.com/**', r => r.abort());
  const db = await mockSupabase(ctx, opts);
  await ctx.addInitScript(() => { try {
    const k = 'arabna.v1'; const s = JSON.parse(localStorage.getItem(k) || '{}');
    s.lang = 'ar'; localStorage.setItem(k, JSON.stringify(s));
  } catch (e) {} });
  const p = await ctx.newPage(); wire(p);
  return { ctx, p, db };
};
/* ⚠️ `arabna/js/store.js` FIRST: on the single-file build the modules sit
   behind an importmap, so a relative import hands back a SECOND instance
   with its own state. */
const prime = p => p.evaluate(async () => {
  window.__S = await import('arabna/js/store.js').catch(() => import('./js/store.js'));
});
const open = async (p, hash = '#/home', wait = 1200) => {
  await p.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(wait);
  await prime(p);
};
const member = (p, email, name) => p.evaluate(async ([em, c, nm]) => {
  const S = window.__S;
  const err = await S.signUp({ name: nm, email: em, password: 'Qx7#mVzt2026', phone: '' });
  if (err) throw new Error(err);
  if (!S.state.user.emailVerified) { const e2 = await S.confirmEmail(c); if (e2) throw new Error(e2); }
  return S.state.user.id;
}, [email, MOCK_CODE, name]);

const DAY = 86400000;
const dayKey = (offset) => {
  const d = new Date(Date.now() + offset * DAY);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

/* ============================================================
   1 — the greeting leaves the device it was written on
   ⚠️ THE OWNER'S OWN QUESTION, AND THE SUITE'S TEETH.
   ============================================================ */
console.log('--- 1: a greeting published on one device, read on another ---');
{
  const a = await fresh({ preConfirm: true });
  await open(a.p);
  await unlockAdmin(a.p);
  await prime(a.p);
  const saved = await a.p.evaluate(async ([from, to]) => {
    const S = window.__S;
    const r = await S.saveGreeting({ title: 'تحذير', body: 'فيضان متوقّع اليوم', from, to });
    return { ok: !!(r && r.ok), id: r && r.greeting && r.greeting.id, err: r && r.err };
  }, [dayKey(-1), dayKey(7)]);
  ok('1.1 the panel really saves it', saved.ok, saved.err || saved.id);
  /* ⚠️ THE ID COMES FROM THE SERVER, never from `mintId` — `648`'s rule:
     a record with a table takes its id from the insert. A `g…` prefix here
     is the local mint back in the code. */
  ok('1.2 …and its id is the row\'s, not a device mint',
     !!saved.id && !/^g[a-z0-9]{6,}/.test(String(saved.id)), String(saved.id));
  ok('1.3 …and the row is on the server', (a.db.greetings || []).length === 1,
     (a.db.greetings || []).length + ' rows');

  /* the second device: A DIFFERENT BROWSER, sharing the one server, and
     NOBODY SIGNED IN — `all: read` means everybody */
  const b = await fresh({ db: a.db, preConfirm: true });
  await open(b.p);
  const seen = await b.p.evaluate(() => {
    const S = window.__S;
    const list = S.greetings();
    return { n: list.length, title: list[0] && list[0].title, off: list[0] && list[0].off,
             signedIn: S.isLoggedIn() };
  });
  ok('1.4 the visitor on a second device reads it', seen.n === 1 && seen.title === 'تحذير',
     JSON.stringify(seen));
  ok('1.5 …and that visitor never signed in', seen.signedIn === false, 'visitor');

  /* ⚠️ AND `off` HAS TO REACH THEM TOO — a typo everybody is seeing has to
     stop NOW, and stopping it on one phone is the original fault again. */
  await a.p.evaluate(async id => window.__S.setGreetingOff(id, true), saved.id);
  await b.p.evaluate(async () => { await window.__S.loadLiveGreetings(); });
  const afterOff = await b.p.evaluate(() => {
    const l = window.__S.greetings(); return { n: l.length, off: l[0] && l[0].off };
  });
  ok('1.6 switching it off reaches the second device', afterOff.off === true, JSON.stringify(afterOff));

  await a.p.evaluate(async id => window.__S.deleteGreeting(id), saved.id);
  await b.p.evaluate(async () => { await window.__S.loadLiveGreetings(); });
  const afterDel = await b.p.evaluate(() => window.__S.greetings().length);
  ok('1.7 …and deleting it removes it there', afterDel === 0, afterDel + ' left');
  ok('1.8 …and the server row is really gone', (a.db.greetings || []).length === 0,
     (a.db.greetings || []).length + ' rows');
  await a.ctx.close(); await b.ctx.close();
}

/* ============================================================
   2 — the panel's own controls
   ============================================================ */
console.log('--- 2: «now», and the clash measured on the merged list ---');
{
  const a = await fresh({ preConfirm: true });
  await open(a.p, '#/home');
  await unlockAdmin(a.p);
  await a.p.goto(BASE + '#/admin', { waitUntil: 'domcontentloaded' });
  await a.p.waitForTimeout(900);
  await a.p.click('[data-t="set"]').catch(() => {});
  await a.p.waitForTimeout(500);
  await a.p.click('#greetNew').catch(() => {});
  await a.p.waitForTimeout(400);
  const hasNow = await a.p.$('#gNow');
  ok('2.1 the «now» button is on the greeting form', !!hasNow);
  if (hasNow) {
    await a.p.click('#gNow');
    await a.p.waitForTimeout(200);
    const v = await a.p.evaluate(() => ({
      from: document.querySelector('#gFrom') && document.querySelector('#gFrom').value,
      to: document.querySelector('#gTo') && document.querySelector('#gTo').value,
    }));
    ok('2.2 it fills today', v.from === dayKey(0), v.from);
    /* ⚠️ AND NEVER AN EMPTY END DATE — an unbounded card is a card nobody
       can stop, and «to» is what ends it by itself. */
    ok('2.3 …and seven days, never an empty end', v.to === dayKey(7) && !!v.to, v.to);
  } else { ok('2.2 it fills today', false, 'no button'); ok('2.3 …and seven days', false, 'no button'); }

  /* ⚠️ THE CLASH IS MEASURED ON THE MERGED LIST, and the row is put on the
     SERVER and never in local state: measured on the device alone, a second
     phone would allow a window overlapping one it has never heard of, and
     two cards would stack on one launch. */
  await prime(a.p);
  const clash = await a.p.evaluate(async ([f1, t1, f2, t2]) => {
    const S = window.__S;
    const first = await S.saveGreeting({ title: 'أوّل', body: 'نصّ', from: f1, to: t1 });
    /* the row is now the server's; wipe anything local so the ONLY source
       of the clash is the merged live list */
    S.state.greetings = [];
    const second = await S.saveGreeting({ title: 'ثانٍ', body: 'نصّ', from: f2, to: t2 });
    return { first: !!first.ok, second: !!second.ok, err: second.err,
             clashTitle: second.clash && second.clash.title, local: S.state.greetings.length };
  }, [dayKey(0), dayKey(10), dayKey(5), dayKey(15)]);
  ok('2.4 the first is accepted', clash.first);
  ok('2.5 an overlapping second is refused, from the SERVER\'s row',
     clash.second === false && clash.err === 'clash' && clash.clashTitle === 'أوّل'
     && clash.local === 0, JSON.stringify(clash));
  await a.ctx.close();
}

/* ============================================================
   3 — the templates, and no occasion named in code
   ============================================================ */
console.log('--- 3: the templates are text, not logic ---');
{
  const admin = code('js/screens/admin.js');
  const tpl = /const GREET_TPL\s*=\s*\[([^\]]*)\]/.exec(admin);
  ok('3.1 the template list is numbers alone', !!tpl && !/['"`]/.test(tpl[1]),
     tpl ? tpl[1].trim() : 'no list');
  /* ⚠️ NO OCCASION IS NAMED IN THE LOGIC. The rule is that the app knows
     «a greeting», never «Eid» — the moment a name enters the code, a
     second occasion needs a second branch. Swept over every module. */
  const OCCASIONS = /عيد الفطر|عيد الأضحى|رمضان كريم|رأس السنة|الميلاد|christmas|ramadan kareem|eid mubarak/i;
  const named = [];
  for (const f of ['js/store.js', 'js/app.js', 'js/ui.js', 'js/screens/admin.js'])
    if (OCCASIONS.test(code(f))) named.push(f);
  ok('3.2 …and no occasion is named outside i18n', named.length === 0, named.join(', ') || 'none');
  /* ⚠️ AND DELETING THE WHOLE LIST BREAKS NOTHING — a check, not a claim.
     The form has to stand with no template at all. */
  const a = await fresh({ preConfirm: true });
  await open(a.p, '#/home');
  await unlockAdmin(a.p);
  await a.p.evaluate(() => { window.__killTpl = true; });
  await a.p.goto(BASE + '#/admin', { waitUntil: 'domcontentloaded' });
  await a.p.waitForTimeout(900);
  await a.p.click('[data-t="set"]').catch(() => {});
  await a.p.waitForTimeout(500);
  await a.p.click('#greetNew').catch(() => {});
  await a.p.waitForTimeout(400);
  const shape = await a.p.evaluate(() => ({
    from: !!document.querySelector('#gFrom'), to: !!document.querySelector('#gTo'),
    save: !!document.querySelector('#gSave'), sel: !!document.querySelector('#gTpl'),
  }));
  ok('3.3 the greeting form stands whole', shape.from && shape.to && shape.save, JSON.stringify(shape));
  /* ⚠️ AND THE COUPLING IS READ FROM THE SOURCE, not from the fact that a
     picker happens to be drawn today: the list gates ITS OWN control and
     nothing else, so `GREET_TPL` must appear behind one length guard and
     nowhere else in the form. Asserting «a picker is present» would go red
     on the very deletion §3.1 says must break nothing. */
  const usesTpl = (admin.match(/GREET_TPL/g) || []).length;
  const listed = !!(tpl && tpl[1].trim());
  ok('3.4 …and the list gates its own control and nothing else in the form',
     /\$\{GREET_TPL\.length \?/.test(admin) && usesTpl <= 3 && shape.sel === listed,
     usesTpl + ' references · list ' + (listed ? 'non-empty' : 'empty')
       + ' · picker ' + (shape.sel ? 'drawn' : 'absent'));
  await a.ctx.close();
}

/* ============================================================
   4 — the four settings
   ============================================================ */
console.log('--- 4: the operator\'s four switches reach every device ---');
{
  const a = await fresh({ preConfirm: true });
  await open(a.p, '#/home');
  await unlockAdmin(a.p);
  await prime(a.p);
  const wrote = await a.p.evaluate(async () => {
    const S = window.__S;
    return {
      season: await S.setSeason('ramadan', true),
      prayer: await S.setHousePrayer('jafari', 2),
      dates: await S.setRamadanDates('2027-02-07', '2027-03-09'),
    };
  });
  ok('4.1 the panel writes all three to the server',
     wrote.season && wrote.prayer && wrote.dates, JSON.stringify(wrote));
  /* ⚠️ ONE ROW PER KEY, and the table is not ours alone: `0009` seeds
     `listingLimit.default` and `listingLimit.handyman` into the same table,
     which the listing-limit trigger reads. So what is asserted is that each
     of the three arrives exactly once — a count of the whole table would
     have been red on a correct build. */
  const keys = (a.db.settings || []).map(r => r.key);
  const once = k => keys.filter(x => x === k).length === 1;
  ok('4.2 …and they are rows in `settings`, one per key',
     once('seasons') && once('prayer') && once('ramadanDates'), keys.sort().join(','));

  const b = await fresh({ db: a.db, preConfirm: true });
  await open(b.p);
  const got = await b.p.evaluate(() => {
    const S = window.__S;
    return { ramadan: S.seasonOn('ramadan'), method: S.prayerMethod(), asr: S.asrShadow(),
             dates: S.ramadanDates() };
  });
  ok('4.3 ⚠️ Ramadan mode switched on from the panel shows on another device',
     got.ramadan === true, JSON.stringify(got.ramadan));
  ok('4.4 ⚠️ …and the prayer method too — people pray by these times',
     got.method === 'jafari' && got.asr === 2, got.method + ' / ' + got.asr);
  ok('4.5 …and the Ramadan dates',
     got.dates && got.dates.from === '2027-02-07' && got.dates.eid === '2027-03-09',
     JSON.stringify(got.dates));

  /* ⚠️ THE THREE-TIER ORDER: the reader's own choice OUTRANKS the house,
     and the house outranks the written default. A reader who picked ISNA
     for themselves is not moved by the operator. */
  const mine = await b.p.evaluate(() => {
    const S = window.__S;
    S.setPrayerMethod('isna');
    return { method: S.prayerMethod(), house: S.housePrayer().method };
  });
  ok('4.6 the reader\'s own choice outranks the house',
     mine.method === 'isna' && mine.house === 'jafari', JSON.stringify(mine));
  await b.ctx.close();

  /* ⚠️ A VALUE THAT DID NOT ARRIVE READS FROM THE DECLARED DEFAULT, NEVER
     FROM EMPTY. `null` is not `{}` — a failed read must leave the app as
     it was, not switch every season off and reset the method. */
  /* ⚠️ AND IT IS MEASURED WITH A VALUE ALREADY IN HAND, or it measures
     nothing at all: with the device empty too, «read from the default» and
     «read from an empty object» give the same answer and the check is
     green either way. The real risk is that a read which did not arrive
     WIPES what the device already knows — Ramadan mode switched on and
     switched off again by one dropped request. */
  const c = await fresh({ preConfirm: true });
  await c.ctx.addInitScript(() => { try {
    const k = 'arabna.v1'; const st = JSON.parse(localStorage.getItem(k) || '{}');
    st.seasons = { ramadan: true };
    st.prayer = { method: 'ummalqura', asr: 2 };
    localStorage.setItem(k, JSON.stringify(st));
  } catch (e) {} });
  await open(c.p);
  const none = await c.p.evaluate(() => {
    const S = window.__S;
    return { rows: (S.liveSettingsLoadedAt() > 0), ramadan: S.seasonOn('ramadan'),
             method: S.prayerMethod(), asr: S.asrShadow(), house: S.housePrayer() };
  });
  ok('4.7 an empty server does not wipe what the device already holds',
     none.ramadan === true && none.method === 'ummalqura' && none.asr === 2,
     JSON.stringify(none));
  ok('4.8 …and the house value falls back to the written default, never to empty',
     none.house.method === 'isna' && none.house.asr === 1, JSON.stringify(none.house));
  await c.ctx.close();
  await a.ctx.close();
}

console.log('--- 4b: no network call inside seasonOn ---');
{
  /* ⚠️ `seasonOn()` IS CALLED INSIDE TWO LOOPS THAT WALK EVERY SPECIALITY
     IN THE REGISTRY. A network call there freezes the screen, which is why
     the settings are read at BOOT and never at the point of use. */
  const a = await fresh({ preConfirm: true });
  await open(a.p, '#/home');
  let calls = 0;
  a.p.on('request', r => { if (/supabase\.co|\/rest\/v1\//.test(r.url())) calls++; });
  const n = await a.p.evaluate(() => {
    const S = window.__S; let k = 0;
    for (const c of S.CATEGORIES || []) { S.seasonOn('ramadan'); k++; }
    for (let i = 0; i < 200; i++) { S.seasonOn('ramadan'); k++; }
    return k;
  });
  await a.p.waitForTimeout(400);
  ok('4.9 seasonOn asks the network zero times', calls === 0, n + ' calls, ' + calls + ' requests');
  ok('4.10 …and it is a plain synchronous read in the source',
     !/export\s+(async\s+)?function\s+seasonOn[\s\S]{0,300}await/.test(code('js/store.js')), 'no await');
  await a.ctx.close();
}

/* ============================================================
   5 — `boosted` is a setting, and never a column
   ============================================================ */
console.log('--- 5: boosted ---');
{
  const sql = sqlCode();
  ok('5.1 ⚠️ no `boosted` column on `classifieds`, in any migration',
     !/alter table (public\.)?classifieds[\s\S]{0,200}\bboosted\b/i.test(sql)
     && !/\bboosted\b\s+(boolean|text|timestamptz)/i.test(sql), 'none');
  const st = code('js/store.js');
  ok('5.2 …and it is read through the settings key',
     /function boostedIds\(\)[\s\S]{0,300}liveSetting\('boosted'\)/.test(st), 'liveSetting');
  ok('5.3 …and written through the one door',
     /pushSetting\('boosted'/.test(st), 'pushSetting');

  const a = await fresh({ preConfirm: true });
  await open(a.p, '#/home');
  await unlockAdmin(a.p);
  await prime(a.p);
  /* ⚠️ THE ACCOUNT HAS TO OWN THE LISTING — `boostClassified` refuses
     otherwise, which is `620`'s guard and is right. So the suite publishes
     one and boosts that, rather than reaching for a seed it does not own. */
  const r = await a.p.evaluate(async () => {
    const S = window.__S;
    let res = null, err = '';
    try {
      res = await S.addClassified({
        cat: 'furniture', title: { ar: 'كنبة', en: 'Sofa' },
        desc: { ar: 'بحالة جيّدة', en: 'Good condition' },
        price: '650', city: 'Houston', photos: [],
      });
    } catch (e) { err = String(e && e.message || e); }
    const id = res && (res.id || (res.item && res.item.id));
    const okk = id ? await S.boostClassified(id) : false;
    return { id, err, okk: !!okk, after: S.boostedIds().slice() };
  });
  ok('5.4 boosting writes the setting', r.okk && r.after.includes(r.id), JSON.stringify(r.after));
  const row = (a.db.settings || []).find(x => x.key === 'boosted');
  ok('5.5 …and it is a row on the server', !!row && (row.value || []).includes(r.id),
     JSON.stringify(row && row.value));
  await a.ctx.close();
}

/* ============================================================
   6 — the migration table carries no status mark
   ============================================================ */
console.log('--- 6: the state file\'s migration column ---');
{
  const doc = read('docs/الحالة.md').split('\n');
  const rows = doc.filter(l => l.trimStart().startsWith('|'));
  const marked = rows.filter(l => l.includes('⏳') || l.includes('✓'));
  ok('6.1 ⚠️ no `⏳` and no `✓` in any line starting with `|`',
     marked.length === 0, marked.length + ' rows carry one');
  const prose = doc.filter(l => !l.trimStart().startsWith('|')).join('\n');
  ok('6.2 …and the line naming the source stands above the table',
     /حالةُ الهجرة تُسأل من `public\.migration_log` وحدَه/.test(prose), 'written');
  /* ⚠️ THE COUNTER-GUARD, and it is why the first wording of this rule was
     wrong: four of the symbol's five occurrences are the PROSE THAT
     EXPLAINS THE FAULT, so a guard banning it outright would have deleted
     the very thing that stops the fault returning. */
  const hourglass = (prose.match(/⏳/g) || []).length;
  ok('6.3 ⚠️ …and the prose that explains why survives the sweep',
     hourglass >= 4, hourglass + ' outside the table');
  /* and the promise itself is gone from the row it stood in */
  ok('6.4 `0019`\'s row records what happened, not what will',
     /\| `0019_storage\.sql` \| `660` \| نُفِّذت \*\*بالمُشغِّل\*\*/.test(doc.join('\n')), 'recorded');
}

/* ============================================================
   7 — the three registration sites of a live reader
   ============================================================ */
console.log('--- 7: registered in all three places ---');
{
  const a = await fresh({ preConfirm: true });
  await open(a.p);
  const tables = await a.p.evaluate(() => window.__S.liveReaderTables());
  ok('7.1 `greetings` and `settings` are registered readers',
     tables.includes('greetings') && tables.includes('settings'), tables.join(','));
  /* ⚠️ THE BOOT CALL, AND NOT THE PANEL. A greeting is for the ORDINARY
     READER, so reading it when the panel opens would show it to the one
     person who does not need it — and to nobody else. */
  const app = code('js/app.js');
  ok('7.2 …and both are called at boot',
     /loadLiveGreetings\(\)/.test(app) && /loadLiveSettings\(\)/.test(app), 'in js/app.js');
  ok('7.3 …and neither is called from the panel',
     !/loadLiveGreetings|loadLiveSettings/.test(code('js/screens/admin.js')), 'not in admin.js');
  /* the third site: the state file's own table of live tables */
  const doc = read('docs/الحالة.md');
  ok('7.4 …and each has a line in the state file',
     /`greetings`/.test(doc) && /`settings`/.test(doc), 'named');
  /* and a real request goes out on the first open */
  let g = 0, s = 0;
  const b = await fresh({ db: a.db, preConfirm: true });
  b.p.on('request', r => { if (/\/rest\/v1\/greetings/.test(r.url())) g++;
                           if (/\/rest\/v1\/settings/.test(r.url())) s++; });
  await open(b.p);
  ok('7.5 …and both are really fetched on the first open', g > 0 && s > 0, 'greetings ' + g + ' · settings ' + s);
  await b.ctx.close(); await a.ctx.close();
}

/* ============================================================
   8 — the screens did not change shape
   ============================================================ */
console.log('--- 8: nothing on a screen moved ---');
{
  const a = await fresh({ preConfirm: true });
  const seen = [];
  for (const h of ['#/home', '#/directory', '#/marketplace', '#/events', '#/magazine', '#/prayer', '#/settings']) {
    await a.p.goto(BASE + h, { waitUntil: 'domcontentloaded' });
    await a.p.waitForTimeout(700);
    const n = await a.p.evaluate(() => (document.querySelector('#app') || {}).textContent || '');
    seen.push(h + ':' + (n.trim().length > 40 ? 'ok' : 'EMPTY'));
  }
  ok('8.1 every screen still draws', !seen.some(s => /EMPTY/.test(s)), seen.join(' '));
  ok('8.2 …with no console error and no page error', errors.length === 0, errors.slice(0, 3).join(' | '));
  await a.ctx.close();
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

/* ============================================================
   test_v91 — 660: the file store, and the picture leaves the device
   ------------------------------------------------------------
   ⚠️ THE FAULT HAD FOUR FACES AND ONE CAUSE: there was no file store at
   all. Measured on 10 September 2026, before a line was written:
       grep -rn "sb.storage" js/                  ->  no line
       grep -rn "avatar"  supabase/migrations/    ->  no line
       grep -rn "photos"  supabase/migrations/    ->  no column
   So every picture anybody chose was a base64 `data:` string inside
   `localStorage` — a third larger than the file it came from — and five
   of them for one listing against a five-megabyte limit FOR THE WHOLE
   SITE. The damage was never the pictures alone: `save()` fails when the
   store is full, and then NOTHING else is saved — the account, the
   favourites, the half-written draft.

   ⚠️ AND THE MOST DANGEROUS ITEM IN THE BATCH SHOWS NOTHING AT ALL. With
   `img-src 'self' data: blob:` the whole thing lands green and not one
   picture appears: the browser refuses a signed link as a POLICY refusal,
   with no failed request and no 404 — and this batch's own designed cover
   makes that absence look BETTER than it did. Block 9 is that guard.

   Eleven blocks: the migration · the one compressor · the account's
   picture · what a stranger may not do · the classified · the event ·
   the cover · the size line · the policy · what was already on the
   devices · console.
   ============================================================ */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync, readdirSync } from 'node:fs';
import { mockSupabase, MOCK_CODE } from './_supabase.mjs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
const ROOT = new URL('../../', import.meta.url).pathname;
const MIG = ROOT + 'supabase/migrations/';
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); }
  else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const read = f => readFileSync(ROOT + f, 'utf8');
/* ⚠️ comments stripped before any «does the code do X» check — the rule
   this project has now paid for five times, and this batch's own comments
   name every shape it forbids. */
/* ⚠️ AND THE OPENING `/`-STAR HAS TO BE PRECEDED BY NOTHING THAT MAKES IT
   PART OF A VALUE. Measured while writing this suite: the picker's own
   `accept="image/`-star opens a comment to a naive stripper, which then
   swallowed every line down to the next close — including the call this
   block exists to measure, so `2.2` went red on a build that was right. A
   stripper that eats code is the same family as a check that reads prose. */
const strip = t => t.replace(/(^|[\s(,;{:=])\/\*[\s\S]*?\*\//g, '$1').replace(/^\s*\/\/.*$/gm, '');
const code = f => strip(read(f));
const migName = readdirSync(MIG).filter(n => /^0019_/.test(n))[0] || '';
const mig = migName ? readFileSync(MIG + migName, 'utf8') : '';
const migCode = mig.replace(/--[^\n]*/g, '');

const browser = await chromium.launch();
const errors = [];
const wire = p => {
  p.on('pageerror', e => errors.push('PAGEERROR ' + e.message.slice(0, 140)));
  p.on('console', m => { if (m.type() === 'error' &&
    !/supabase\.co|fonts\.googleapis/.test((m.location() && m.location().url) || '') &&
    !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|ERR_NAME|ERR_FAILED|fonts\.googleapis|supabase\.co/.test(m.text()))
    errors.push(m.text().slice(0, 140)); });
};
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
   behind an importmap, so a relative import hands back a SECOND instance. */
const prime = p => p.evaluate(async () => {
  window.__S = await import('arabna/js/store.js').catch(() => import('./js/store.js'));
});
const open = async (p, hash = '#/home', wait = 1100) => {
  await p.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(wait);
  await prime(p);
};
const member = async (p, email, name) => p.evaluate(async ([em, c, nm]) => {
  const S = window.__S;
  const err = await S.signUp({ name: nm, email: em, password: 'Qx7#mVzt2026', phone: '' });
  if (err) throw new Error(err);
  if (!S.state.user.emailVerified) { const e2 = await S.confirmEmail(c); if (e2) throw new Error(e2); }
  return S.state.user.id;
}, [email, MOCK_CODE, name]);
/** ⚠️ `imageUrl` IS SYNCHRONOUS BY DESIGN — every reader of it is — so it
    answers the link it holds and asks for one in the background. The suite
    has to let that answer arrive before it measures: the timer fires on the
    next macrotask and the request after it. */
const signed = (p, bucket, path) => p.evaluate(async ([b, pth]) => {
  const S = window.__S;
  S.imageUrl(b, pth);
  await new Promise(r => setTimeout(r, 350));
  await S.flushImageUrls();
  await new Promise(r => setTimeout(r, 250));
  return S.imageUrl(b, pth);
}, [bucket, path]);
/** navigate INSIDE the page: a reload re-boots and the point here is the
    state this session is already in */
const nav = async (p, hash) => {
  await p.evaluate(h => { location.hash = h; }, hash);
  await p.waitForTimeout(500);
};

/** a real picture, made in the page: `uploadImage` takes a `data:` string
    from the picker exactly as the screens hand it one */
const PIC = p => p.evaluate(() => {
  const cv = document.createElement('canvas'); cv.width = 4; cv.height = 4;
  const c = cv.getContext('2d'); c.fillStyle = '#c6a15b'; c.fillRect(0, 0, 4, 4);
  return cv.toDataURL('image/jpeg', 0.72);
});

/* ============================================================
   1 — the migration
   ============================================================ */
console.log('--- 1: the migration ---');
{
  ok('1.1 `0019` exists and is the batch\'s only migration',
     /^0019_storage\.sql$/.test(migName), migName);
  const buckets = ['avatars', 'biz-photos', 'listings', 'event-photos'];
  ok('1.2 four buckets, named',
     buckets.every(b => new RegExp("'" + b + "'").test(migCode)), buckets.join(' '));
  /* ⚠️ PRIVATE, AND THE `on conflict` FORCES IT BACK. A public bucket
     means a picture held for review can be opened by its link before the
     admin has seen it — and that is the exact text of `biz_photos`'s own
     read policy, undone from behind. */
  ok('1.3 …and every one of them is private, on a first run and on a re-run',
     !/public.{0,4}=.{0,4}true/.test(migCode) && /set\s+public\s*=\s*false/.test(migCode), 'public = false');
  ok('1.4 the size limit is repeated in the bucket, not left to the client',
     /file_size_limit/.test(migCode) && /10485760/.test(migCode), '10 MiB');
  ok('1.5 the three columns the app had nowhere to write to',
     /profiles add column if not exists avatar_path text/.test(migCode)
     && /classifieds add column if not exists photos text\[\]/.test(migCode)
     && /events add column if not exists photo_path text/.test(migCode), '');
  /* ⚠️ THE ORDER IS A MEASUREMENT. Written the other way round the file
     ABORTS on a real PostgreSQL with «column p.avatar_path does not
     exist»: a policy is compiled when it is created, not when it is
     evaluated. It is `0013`'s lesson from the other side. */
  ok('1.6 the columns are added BEFORE the policy that names one',
     migCode.indexOf('avatar_path text') > 0
     && migCode.indexOf('avatar_path text') < migCode.indexOf('"avatars: read"'), 'column first');
  /* ⚠️ AND «approved» IS ASKED THROUGH A FUNCTION, because `profiles` is
     the one private table of the four: inline, the subquery is governed by
     `profiles`'s own policy, so an APPROVED avatar stays invisible to
     everybody except its owner. Measured on a real PostgreSQL 16. */
  ok('1.7 the approved test goes through a definer function, not an inline subquery',
     /create or replace function public\.avatar_is_approved/.test(migCode)
     && /security definer/.test(migCode)
     && /public\.avatar_is_approved\(name\)/.test(migCode), '');
  ok('1.8 the admin writes the column through `approve_avatar`, which raises first',
     /create or replace function public\.approve_avatar[\s\S]{0,400}if not public\.is_admin\(\) then[\s\S]{0,80}raise exception/.test(migCode), '');
  ok('1.9 …and `anon` cannot call either of them',
     (migCode.match(/revoke all on function public\.approve_avatar/) || []).length === 1
     && /grant execute on function public\.approve_avatar\(uuid, text\) to authenticated/.test(migCode)
     && !/grant execute on function public\.approve_avatar[^;]*anon/.test(migCode), '');
  /* ⚠️ THE FOURTH OF `0013`'s CLASS, and the one its own sweep did not
     reach — and this batch's specification calls the table «ready». */
  ok('1.10 a business photo\'s id is the id the app has',
     /biz_photos drop constraint if exists biz_photos_biz_id_fkey/.test(migCode)
     && /biz_photos alter column biz_id type text/.test(migCode), '');
  ok('1.11 …and the cascade the key carried is restored, in a NEW definition',
     /create or replace function public\.cascade_business_delete[\s\S]{0,900}delete from public\.biz_photos/.test(migCode), '');
  /* §11 — the ceiling that left with the foreign key */
  ok('1.12 the ceiling is back on `reviews`, in two branches and not one',
     /"own: insert" on public\.reviews[\s\S]{0,700}biz_id ~ '\^b\[0-9\]\+\$'/.test(migCode)
     && /"own: insert" on public\.reviews[\s\S]{0,700}exists \(/.test(migCode), '');
  ok('1.13 …and on `claims` in the same shape',
     /"own: insert" on public\.claims[\s\S]{0,500}biz_id ~ '\^b\[0-9\]\+\$'/.test(migCode), '');
  ok('1.14 `flags.kind` counts five in the database itself',
     /comment on column public\.flags\.kind/.test(migCode) && /avatar/.test(migCode), '');
  /* the paste rule every migration in this repository lives under */
  ok('1.15 no doubled pipe and no star anywhere in the file',
     !/\|\|/.test(mig) && !/\*/.test(mig), '');
}

/* ============================================================
   2 — one compressor, and the upload is binary
   ============================================================ */
console.log('--- 2: the one compressor ---');
{
  const st = code('js/store.js'), mk = code('js/screens/marketplace.js');
  ok('2.1 `compressImage` lives in the store and nowhere else',
     /export function compressImage/.test(st)
     && !/function compressImage/.test(mk), 'one definition');
  ok('2.2 …and the picker calls that one',
     /S\.compressImage\(/.test(mk), '');
  /* ⚠️ IT KEEPS ITS `data:` CONTRACT. `js/screens/advertise.js` stores
     the result as TEXT and draws it directly, so handing it a `Blob` would
     write «[object Blob]» into a saved value — the one call site this
     batch does not move keeps working exactly as it does today. */
  ok('2.3 it still answers with a data URL, and the Blob is made in `uploadImage`',
     /toDataURL\('image\/jpeg'/.test(st)
     && /function dataUrlToBlob/.test(st)
     && /export async function uploadImage/.test(st), '');
  ok('2.4 the upload sends the blob, never the encoded text',
     /\.upload\(path, blob/.test(st), '');
  ok('2.5 the link is signed and lives an hour at most',
     /SIGNED_URL_SECS = 3600/.test(st) && /createSignedUrls/.test(st), '');
  ok('2.6 …and `uploadImage` answers with a PATH, never a link',
     /return path;/.test(st) && !/createSignedUrl\(/.test(st.replace(/createSignedUrls/g, '')), '');
}

/* ============================================================
   3 — the account's picture: it leaves the device
   ============================================================ */
console.log('--- 3: the account\'s picture ---');
{
  const a = await fresh();
  await open(a.p, '#/home');
  const uid = await member(a.p, 'owner91@a.app', 'Reader One');
  const pic = await PIC(a.p);
  const put = await a.p.evaluate(async (d) => {
    const S = window.__S;
    const r = await S.setAvatar(d);
    return { path: r && r.path, status: r && r.status, view: !!S.avatarView() };
  }, pic);
  ok('3.1 the picture is uploaded and the state holds a PATH, not the text',
     !!put.path && /^[^/]+\/[0-9a-f]{32}\.jpg$/.test(put.path), put.path || 'nothing');
  ok('3.2 …and it is not visible to anybody until the admin says so',
     put.status === 'pending' && put.view === false, put.status);
  ok('3.3 the object really reached the bucket, under the account\'s own folder',
     (a.db.uploads || []).some(u => u.bucket === 'avatars' && u.name.split('/')[0] === uid),
     String((a.db.uploads || []).length));
  ok('3.4 …and it waits in `flags`, not in a second queue of its own',
     (a.db.flags || []).some(f => f.kind === 'avatar' && f.ref_id === put.path), '');
  const inReports = await a.p.evaluate(() => window.__S.flags().length);
  ok('3.5 …and it is NOT counted as a report — the reports tab shows reports',
     inReports === 0, String(inReports));

  /* the admin, in a SECOND browser sharing the one server */
  const b = await fresh({ db: a.db });
  await open(b.p, '#/home');
  await member(b.p, 'admin91@a.app', 'Staff');
  await b.p.evaluate(() => {
    const S = window.__S;
    const me = S.state.user.id;
    return S.state; // nothing: promoted below through the shared db
  });
  b.db.profiles.get(await b.p.evaluate(() => window.__S.state.user.id)).is_admin = true;
  await b.p.evaluate(async () => { await window.__S.hydrateUserFromSession(); });
  await b.p.waitForTimeout(400);
  const queue = await b.p.evaluate(async () => {
    const S = window.__S;
    await S.loadLiveFlags();
    const q = S.pendingAvatars();
    await S.loadAvatarOwners(q);
    return { n: q.length, user: q[0] && q[0].userId, named: q[0] ? S.avatarOwnerName(q[0].userId) : '' };
  });
  ok('3.6 the picture reaches the ADMIN\'s queue, on another device',
     queue.n === 1 && queue.user === uid, String(queue.n));
  ok('3.7 …with the account named beside it, which is what makes it judgeable',
     queue.named === 'Reader One', queue.named || 'no name');
  const done = await b.p.evaluate(async ([u, pth]) => {
    const S = window.__S;
    return await S.approveAvatar(u, pth);
  }, [uid, put.path]);
  ok('3.8 the admin approves through the function, and the row really moves',
     done === true && a.db.profiles.get(uid).avatar_path === put.path,
     String(a.db.profiles.get(uid).avatar_path || 'null'));

  /* the owner, on a THIRD device: nothing local, everything from the server */
  const c = await fresh({ db: a.db });
  await open(c.p, '#/home');
  const back = await c.p.evaluate(async ([em, cd]) => {
    const S = window.__S;
    const err = await S.signInWithPassword(em, 'Qx7#mVzt2026');
    if (err) return { err };
    await new Promise(r => setTimeout(r, 300));
    S.avatarView();
    await new Promise(r => setTimeout(r, 350));
    await S.flushImageUrls();
    await new Promise(r => setTimeout(r, 250));
    const v = S.avatarView();
    return { path: S.state.user.avatar && S.state.user.avatar.path, url: v && v.url };
  }, ['owner91@a.app', MOCK_CODE]);
  ok('3.9 a second device reads the picture back from the account, not from storage on the phone',
     back.path === put.path, back.path || back.err || 'nothing');
  ok('3.10 …and what it draws is a signed link, never the picture itself',
     typeof back.url === 'string' && /\/storage\/v1\/object\/sign\//.test(back.url), (back.url || '').slice(0, 48));
  await a.ctx.close(); await b.ctx.close(); await c.ctx.close();
}

/* ============================================================
   4 — what a stranger may not do
   ============================================================ */
console.log('--- 4: what a stranger may not do ---');
{
  const a = await fresh();
  await open(a.p, '#/home');
  const uid = await member(a.p, 'one91@a.app', 'One');
  const pic = await PIC(a.p);
  const mine = await a.p.evaluate(async (d) => (await window.__S.setAvatar(d)).path, pic);

  const b = await fresh({ db: a.db });
  await open(b.p, '#/home');
  await member(b.p, 'two91@a.app', 'Two');
  const tried = await b.p.evaluate(async ([other, d]) => {
    const S = window.__S;
    return await S.uploadImage('avatars', other, d);
  }, [uid, pic]);
  ok('4.1 a stranger cannot upload under somebody else\'s folder',
     tried === '', tried || 'refused');
  const peek = await signed(b.p, 'avatars', mine);
  ok('4.2 …and a picture waiting for review is not readable by a third account',
     peek === '', peek || 'refused');
  await a.ctx.close(); await b.ctx.close();
}

/* ============================================================
   5 — the classified's photos
   ============================================================ */
console.log('--- 5: the classified ---');
{
  const st = code('js/store.js');
  ok('5.1 the literal `photos: []` is gone from the live map',
     !/photos: \[\],\s*$/m.test(st.slice(st.indexOf('export function mapLiveClsRowToJs'),
                                         st.indexOf('export function mapLiveClsRowToJs') + 1400)), '');
  const a = await fresh();
  await open(a.p, '#/home');
  await member(a.p, 'seller91@a.app', 'Seller');
  const pic = await PIC(a.p);
  const rec = await a.p.evaluate(async (d) => {
    const S = window.__S;
    const r = await S.addClassified({ cat: 'furniture',
      title: { ar: 'كنبة', en: 'Sofa' }, desc: { ar: 'جيّدة', en: 'Good' },
      price: '⁦$650⁩', city: 'Houston', photos: [d, d] });
    return { id: r && r.id, photos: (r && r.photos) || [], failed: r && r.photosFailed };
  }, pic);
  ok('5.2 two photos are uploaded and the record holds two PATHS',
     rec.photos.length === 2 && rec.photos.every(x => /^[^/]+\/[0-9a-f]{32}\.jpg$/.test(x)),
     rec.photos.join(' '));
  const row = (a.db.classifieds || []).find(r => r.id === rec.id);
  ok('5.3 …and the row on the server carries them — this is the original fault',
     !!row && Array.isArray(row.photos) && row.photos.length === 2,
     row ? JSON.stringify(row.photos) : 'no row');
  await a.p.evaluate(async (id) => {
    const S = window.__S;
    await S.approveClassified(id);
  }, rec.id).catch(() => {});
  (a.db.classifieds || []).forEach(r => { if (r.id === rec.id) r.status = 'live'; });

  /* a SECOND device, which is the only place the fault was ever visible */
  const b = await fresh({ db: a.db });
  await open(b.p, '#/home');
  const seen = await b.p.evaluate(async (id) => {
    const S = window.__S;
    await S.loadLiveClassifieds();
    const c = S.classifiedById(id);
    if (!c) return { n: -1, first: '' };
    await new Promise(r => setTimeout(r, 350));
    await S.flushImageUrls();
    await new Promise(r => setTimeout(r, 250));
    const again = S.classifiedById(id);
    return { n: (again.photos || []).length, first: (again.photos || [])[0] || '' };
  }, rec.id);
  ok('5.4 a second device sees the photos at all — before this batch it saw none',
     seen.n === 2, String(seen.n));
  ok('5.5 …as signed links, never as the pictures themselves',
     /\/storage\/v1\/object\/sign\//.test(seen.first), seen.first.slice(0, 48));
  await a.ctx.close(); await b.ctx.close();
}

/* ============================================================
   6 — the event's picture
   ============================================================ */
console.log('--- 6: the event ---');
{
  const st = code('js/store.js');
  const from = st.indexOf('function eventRowFrom');
  ok('6.1 `eventRowFrom` carries the path — the field whose absence was the fault',
     /photo_path:/.test(st.slice(from, from + 2400)), '');
  ok('6.2 …and `mergedEvents` no longer puts the device\'s picture over the row',
     !/mapLiveEventRowToJs\(row\), \{ photo: e\.photo/.test(st), '');
  const a = await fresh();
  await open(a.p, '#/home');
  const uid = await member(a.p, 'org91@a.app', 'Organiser');
  const pic = await PIC(a.p);
  const ev = await a.p.evaluate(async (d) => {
    const S = window.__S;
    const r = await S.addEvent({ title: { ar: 'مهرجان', en: 'Festival' }, type: 'festival',
      startsAt: '2027-10-17', venue: { ar: 'ميدتاون', en: 'Midtown' }, city: 'Houston',
      desc: { ar: '', en: '' }, photo: d }, 'pending');
    return { id: r && r.id, path: r && r.photoPath };
  }, pic);
  ok('6.3 the picture is uploaded with the event and the row carries its path',
     !!ev.path && (a.db.events || []).some(r => r.id === ev.id && r.photo_path === ev.path),
     ev.path || 'nothing');
  /* ⚠️ §6.3's own item: a PENDING proposal's picture is not readable by a
     third account, and a LIVE one is. `events` is «all: read using (true)»,
     so without the status rule on the bucket the photo of a proposal
     nobody has approved could be opened by anyone holding the link. */
  const b = await fresh({ db: a.db });
  await open(b.p, '#/home');
  await member(b.p, 'passer91@a.app', 'Passer');
  const hidden = await signed(b.p, 'event-photos', ev.path);
  ok('6.4 a pending proposal\'s picture is not readable by a third account',
     hidden === '', hidden || 'refused');
  (a.db.events || []).forEach(r => { if (r.id === ev.id) r.status = 'live'; });
  const shown = await signed(b.p, 'event-photos', ev.path);
  ok('6.5 …and a published one is — the rule follows the EVENT, not the uploader',
     /\/storage\/v1\/object\/sign\//.test(shown), shown.slice(0, 48));
  await a.ctx.close(); await b.ctx.close();
}

/* ============================================================
   7 — the cover, when there is no picture
   ============================================================ */
console.log('--- 7: the cover ---');
{
  const css = read('styles/app.css');
  const { EVENT_TYPES } = await import(ROOT + 'js/data.js');
  const hued = [...css.matchAll(/\.ev-fallback\[data-evtype="([a-z]+)"\]/g)].map(m => m[1]);
  /* ⚠️ THE COUNT IS READ FROM `data.js` AND NOT WRITTEN HERE, so a twelfth
     type defined tomorrow drops the net until it is given a colour. */
  ok('7.1 every event type has a hue of its own',
     EVENT_TYPES.every(x => hued.includes(x.id)),
     EVENT_TYPES.filter(x => !hued.includes(x.id)).map(x => x.id).join(' ') || String(hued.length));
  ok('7.2 …and no hue is written for a type that does not exist',
     hued.every(h => EVENT_TYPES.some(x => x.id === h)),
     hued.filter(h => !EVENT_TYPES.some(x => x.id === h)).join(' ') || 'none');
  /* ⚠️ NOT ONE IMAGE IS LOADED FROM ANYWHERE, and it is a legal line
     rather than a weight one: a photograph carries copyright and a logo a
     trademark, so the cover is the theme's own gradient, a geometry drawn
     in CSS and the icon that already exists. */
  const block = css.slice(css.indexOf('.ev-fallback {'), css.indexOf('.ev-fallback[data-evtype="concert"]'));
  ok('7.3 the cover loads no image from anywhere',
     !/url\(/.test(block), '');
  const ev = code('js/screens/events.js');
  ok('7.4 an unknown or empty type falls to `community`, so no event is coverless',
     /EVENT_TYPES\.some\(x => x\.id === e\.type\) \? e\.type : 'community'/.test(ev), '');
  ok('7.5 the marks are drawn larger than they were: 56 on the card, 92 on the page',
     /coverHtml\(e, 56\)/.test(ev) && /coverHtml\(e, 92\)/.test(ev), '');
  /* the row-sized sponsored icon is DELIBERATELY left alone: a designed
     cover in a 22px square reads as noise, not as design */
  ok('7.6 …and the 22px sponsored row keeps its plain mark, by decision',
     !/ev-fallback/.test(code('js/ui.js')), '');
}

/* ============================================================
   8 — the size line: the admin sees it and nobody else
   ============================================================ */
console.log('--- 8: the size line ---');
{
  const a = await fresh();
  await open(a.p, '#/post');
  await member(a.p, 'poster91@a.app', 'Poster');
  await open(a.p, '#/post');
  const asMember = await a.p.evaluate(() => ({
    hint: !!document.querySelector('#phHint'),
    size: !!document.querySelector('#phSize'),
    src: /sizeClassified|JPG —/.test(document.documentElement.innerHTML),
  }));
  ok('8.1 an ordinary account sees the photo count and no size line',
     asMember.hint === true && asMember.size === false, JSON.stringify(asMember));
  /* ⚠️ AND IT IS NOT IN THE PAGE AT ALL, not hidden with `display:none`.
     Hidden in the page is not absent from it, and the request was «a line
     I see and nobody else does». */
  ok('8.2 …and the words are not in the page source either',
     asMember.src === false, '');
  a.db.profiles.get(await a.p.evaluate(() => window.__S.state.user.id)).is_admin = true;
  await nav(a.p, '#/home');
  await a.p.evaluate(async () => { await window.__S.hydrateUserFromSession(); });
  await nav(a.p, '#/post');
  const asAdmin = await a.p.evaluate(() => {
    const el = document.querySelector('#phSize');
    return { size: !!el, text: el ? el.textContent.trim().slice(0, 24) : '',
             cls: el ? el.className : '', hint: (document.querySelector('#phHint') || {}).textContent || '' };
  });
  ok('8.3 the admin sees it, under the count and not instead of it',
     asAdmin.size === true && /\d+\/\d+/.test(asAdmin.hint), asAdmin.hint.trim());
  ok('8.4 …in its own quiet class, so it is not read as a line for the public',
     /hint-admin/.test(asAdmin.cls), asAdmin.cls);
  ok('8.5 …and it says the size', /1200/.test(asAdmin.text), asAdmin.text);
  await a.ctx.close();
}

/* ============================================================
   9 — the policy that would have hidden every picture
   ============================================================ */
console.log('--- 9: the policy ---');
{
  const a = await fresh();
  await open(a.p, '#/home');
  const csp = await a.p.evaluate(() => {
    const m = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    return m ? m.getAttribute('content') : '';
  });
  const img = /img-src ([^;]*)/.exec(csp || '');
  ok('9.1 `img-src` admits the file store — without it the batch lands green and blank',
     !!img && /supabase\.co/.test(img[1]), img ? img[1] : 'no img-src');
  ok('9.2 …and `data:` and `blob:` are not lost doing it',
     !!img && /data:/.test(img[1]) && /blob:/.test(img[1]), img ? img[1] : '');
  /* the two files are identical today and part company at the first edit */
  /* ⚠️ AND THE COMPARISON IS BETWEEN THE TWO SOURCE FILES, never against
     the rendered page: the single-file build carries a DIFFERENT policy by
     design — it IS an inline importmap plus modules as `data:` URLs, so the
     strict rule would refuse to run the app itself — and comparing the live
     meta against `vercel.json` would print red on a build that is right. */
  const j = JSON.parse(read('vercel.json'));
  const hdr = (j.headers || []).flatMap(h => h.headers || [])
    .find(h => h.key === 'Content-Security-Policy');
  const meta = /content="(default-src[^"]*)"/.exec(read('index.html'));
  ok('9.3 the header and the meta say the same thing, letter for letter',
     !!hdr && !!meta && hdr.value === meta[1], hdr ? 'compared' : 'no header');
  /* ⚠️ AND THE STORAGE HOST IS NEVER CACHED BY THE WORKER: a signed link
     expires, and a cached one is a link that stopped working. */
  ok('9.4 the worker keeps the storage host on the network',
     /ijubbqvbkfzillkhwdzp\.supabase\.co/.test(read('sw.js')), '');
  await a.ctx.close();
}

/* ============================================================
   10 — what was already on the devices
   ============================================================ */
console.log('--- 10: what was already on the devices ---');
{
  const st = code('js/store.js');
  ok('10.1 the one-time upload exists and runs where a session does',
     /export async function migrateLocalImages/.test(st)
     && /migrateLocalImages\(\);/.test(st), '');
  /* ⚠️ AND THE LOCAL TEXT IS ERASED ONLY AFTER THE UPLOAD SUCCEEDS. The
     other order loses the picture and gives nothing back. */
  const a = await fresh();
  await open(a.p, '#/home');
  await member(a.p, 'old91@a.app', 'Old Device');
  const moved = await a.p.evaluate(async () => {
    const S = window.__S;
    const cv = document.createElement('canvas'); cv.width = 4; cv.height = 4;
    cv.getContext('2d').fillRect(0, 0, 4, 4);
    const d = cv.toDataURL('image/jpeg', 0.72);
    S.state.user.avatar = { url: d, status: 'pending' };
    S.save();
    const before = S.state.user.avatar.url.slice(0, 11);
    await S.migrateLocalImages();
    const a2 = S.state.user.avatar;
    return { before, path: a2 && a2.path, url: a2 && a2.url };
  });
  ok('10.2 a `data:` picture from before this batch is uploaded once and replaced by a path',
     moved.before === 'data:image/' && !!moved.path && !moved.url,
     moved.path || 'not moved');
  ok('10.3 …and it went to the bucket, not merely to the state',
     (a.db.uploads || []).some(u => u.bucket === 'avatars'), String((a.db.uploads || []).length));
  const twice = await a.p.evaluate(async () => {
    const S = window.__S;
    const n = (await S.migrateLocalImages());
    return n;
  });
  ok('10.4 …and it does not run twice in one launch',
     twice === false, String(twice));
  await a.ctx.close();
}

/* ============================================================
   11 — console
   ============================================================ */
console.log('--- 11: console ---');
ok('11.1 no console errors anywhere in the run', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

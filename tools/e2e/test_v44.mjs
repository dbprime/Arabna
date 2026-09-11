/* V.05.6 — the flag that arrived cut in half.

   V.05.5 shipped three kinds of profile picture — a ready-made mark, an
   emoji, an uploaded photo — and NOT ONE LINE OF THE NET COVERED ANY OF
   THEM. `grep` for `av-opt`, `AVATARS`, `avatarSvg` or `data-preset`
   across every suite returned nothing. That is how this shipped.

   `setAvatarEmoji` kept ONE unit and called it one grapheme:

     const one = [...String(ch || '')][0] || '';

   The spread iterates CODE POINTS, not grapheme clusters, and the comment
   beside it named the fault it was written to prevent — «an emoji is two
   or more units and `[0]` cuts it in half, which renders as an empty
   box» — while doing a smaller version of the same thing. Measured in the
   running app, not reasoned about:

     SA-flag  saved as ONE indicator (S)      a lone regional indicator — a boxed letter
     LB-flag  saved as ONE indicator (L)
     thumb+tone  saved as thumb      the skin tone stripped
     family-ZWJ  refused entirely  maxlength="4" against 8 UTF-16 units

   ⚠️ AND THE FLAGS ARE THE CASE THAT MATTERS HERE. This app is for Arabs
   in Houston, and SA-flag LB-flag PS-flag EG-flag IQ-flag SY-flag JO-flag are the most likely single
   character any of them would choose to stand for themselves. Every one
   of them is two regional indicators, so every one of them came out as
   half a flag. Nobody would have reported it as a bug — they would have
   assumed the app does not do flags and picked something else.

   `Intl.Segmenter` with `granularity: 'grapheme'` is the one correct
   tool, and the fallback keeps an old browser working rather than
   throwing. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { mockSupabase } from './_supabase.mjs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); }
  else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const NOW = Date.now();
const ACCOUNT = {
  name: 'أحمد سالم', email: 'a@b.c', emailVerified: true,
  phone: '7134669182', phoneVerified: true, tier: 2, joined: NOW - 9e8,
};

const browser = await chromium.launch();
const errors = [];
const wire = p => {
  p.on('pageerror', e => errors.push('PAGEERROR ' + e.message.slice(0, 120)));
  p.on('console', m => { if (m.type() === 'error' &&
    !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|ERR_NAME|ERR_FAILED|fonts\.googleapis/.test(m.text()))
    errors.push(m.text().slice(0, 120)); });
};
/* the importmap rule: `arabna/…` reaches the app's OWN instance. A
   relative import on the single-file build fetches the file again and
   hands back a second module with its own state. */
const mount = p => p.evaluate(async () => {
  window.__S = await import('arabna/js/store.js').catch(() => import('./js/store.js'));
});
const open = async (state = { lang: 'ar', user: ACCOUNT }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  /* 610: see tools/e2e/_supabase.mjs */
  await mockSupabase(ctx);
  await ctx.addInitScript(s => localStorage.setItem('arabna.v1', JSON.stringify(s)), state);
  const p = await ctx.newPage(); wire(p);
  await p.goto(BASE + '#/home', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500); await mount(p);
  return { ctx, p };
};
const disk = p => p.evaluate(() => JSON.parse(localStorage.getItem('arabna.v1')));
const go = async (p, h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(700); };

/* ---- 1. the twelve marks ---- */
{
  const { ctx, p } = await open();
  const av = await p.evaluate(() => ({
    count: window.__S.AVATARS.length,
    ids: window.__S.AVATARS.map(a => a[0]),
    hues: window.__S.AVATARS.map(a => a[1]),
    one: window.__S.avatarSvg('p01'),
    none: window.__S.avatarSvg('nope'),
  }));
  ok('1.1 twelve ready-made marks', av.count === 12, String(av.count));
  ok('1.2 …with twelve distinct ids', new Set(av.ids).size === 12, av.ids.join(','));
  ok('1.3 …and twelve distinct hues', new Set(av.hues).size === 12, av.hues.join(','));
  /* the V.05.0 rule: gold is the colour of the button and the action, so
     nothing else may wear it or it reads as «selected». */
  ok('1.4 no hue falls in the gold band 35–55',
     av.hues.every(h => h < 35 || h > 55), av.hues.filter(h => h >= 35 && h <= 55).join(','));
  ok('1.5 avatarSvg returns an svg', /^<svg /.test(av.one || ''), (av.one || '').slice(0, 24));
  ok('1.6 …and null for an id that does not exist', av.none === null, String(av.none));
  await ctx.close();
}

/* ---- 2. choosing one: instant, and no queue ---- */
{
  const { ctx, p } = await open();
  await go(p, '#/profile/edit');
  const n = await p.locator('[data-preset]').count();
  ok('2.1 the twelve are drawn on the edit screen', n === 12, String(n));
  await p.locator('[data-preset]').nth(2).click();
  await p.waitForTimeout(500);
  const d = await disk(p);
  ok('2.2 choosing one is saved as a preset',
     d.user && d.user.avatar && d.user.avatar.kind === 'preset', JSON.stringify(d.user && d.user.avatar));
  /* ⚠️ the owner's decision: a mark WE drew needs no moderator. Only an
     uploaded photograph does — that is the whole reason the marks exist. */
  ok('2.3 …and it does NOT wait for approval',
     !d.user.avatar.status || d.user.avatar.status === 'ok', String(d.user.avatar.status));
  await go(p, '#/profile');
  const shown = await p.evaluate(() => !!document.querySelector('#app svg'));
  ok('2.4 …and it shows on the profile at once', shown);
  await ctx.close();
}

/* ---- 3. the emoji, and the flag this suite exists for ---- */
{
  const { ctx, p } = await open();
  await go(p, '#/profile/edit');
  const put = async (ch) => {
    await p.fill('#avEmoji', '');
    await p.fill('#avEmoji', ch);
    await p.evaluate(() => document.querySelector('#avEmoji').dispatchEvent(new Event('change', { bubbles: true })));
    await p.waitForTimeout(350);
    const d = await disk(p);
    return d.user && d.user.avatar ? d.user.avatar.ch : null;
  };
  /* ⚠️ THE ONE THIS SUITE EXISTS FOR. SA-flag is TWO regional indicators, and
     keeping the first leaves a lone S indicator — which no font draws as a flag. */
  ok('3.1 a flag survives whole', await put('\u{1F1F8}\u{1F1E6}') === '\u{1F1F8}\u{1F1E6}');
  ok('3.2 …and so does the second one anybody would pick', await put('\u{1F1F1}\u{1F1E7}') === '\u{1F1F1}\u{1F1E7}');
  ok('3.3 a skin tone is not stripped', await put('\u{1F44D}\u{1F3FD}') === '\u{1F44D}\u{1F3FD}');
  /* eight UTF-16 units, so `maxlength` has to admit it before the
     function ever sees it — the field and the rule are one item. */
  ok('3.4 a ZWJ sequence is kept entire', await put('\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}') === '\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}');
  ok('3.5 a plain one still works', await put('\u{1F319}') === '\u{1F319}');
  /* and the rule it always had: ONE, whatever was pasted */
  ok('3.6 a pasted string keeps only the first', await put('\u{1F319}\u{1F54C}\u{1F1F5}\u{1F1F8} نص') === '\u{1F319}');
  const empty = await p.evaluate(() => window.__S.setAvatarEmoji(''));
  ok('3.7 an empty field changes nothing', empty === null, String(empty));
  await ctx.close();
}

/* ---- 4. the uploaded photograph is the one that still waits ----
   ⚠️ REVERSED IN `660`, AND THE SUBJECT IS UNCHANGED: what this block is
   about is that OUR OWN drawing never waits and a person's own photograph
   always does. What moved is where the photograph goes — it was a `data:`
   string inside `state.user` with no column for it anywhere, and it is an
   object in a private bucket now, waiting in `flags` with `kind = 'avatar'`.
   ⚠️ So it needs a REAL account: the storage path begins with the account
   id and the policy demands it, and an account-less picture has nowhere to
   go. The seeded `state.user` of this suite carries no id. */
{
  const { ctx, p } = await open();
  const r = await p.evaluate(async () => {
    const S = window.__S;
    const err = await S.signUp({ name: 'Reader', email: 'av44@a.app', password: 'Qx7#mVzt2026', phone: '' });
    if (err) return { err };
    if (!S.state.user.emailVerified) await S.confirmEmail('123456');
    const cv = document.createElement('canvas'); cv.width = 4; cv.height = 4;
    cv.getContext('2d').fillRect(0, 0, 4, 4);
    const saved = await S.setAvatar(cv.toDataURL('image/jpeg', 0.72));
    return { saved, view: S.avatarView(), disk: JSON.parse(localStorage.getItem('arabna.v1')).user.avatar };
  });
  ok('4.1 an uploaded picture is stored as an upload — a PATH now, never the picture',
     !!(r.saved && r.saved.path && !r.saved.kind && /^[^/]+\/[0-9a-f]{32}\.jpg$/.test(r.saved.path)),
     JSON.stringify(r.saved || r.err));
  ok('4.2 …and it DOES wait for the admin', r.saved && r.saved.status === 'pending',
     String(r.saved && r.saved.status));
  /* the other half of the same sentence: waiting means nobody sees it */
  ok('4.3 …so nothing is drawn for it until the admin says yes', r.view === null, JSON.stringify(r.view));
  ok('4.4 …and the device keeps the path, not the picture',
     !!(r.disk && r.disk.path && !r.disk.url), JSON.stringify(r.disk));
  await ctx.close();
}

/* ---- 5. it belongs to the account, not to the device ---- */
{
  const { ctx, p } = await open();
  await p.evaluate(() => { window.__S.setAvatarEmoji('\u{1F1F5}\u{1F1F8}'); });
  await p.waitForTimeout(200);
  await p.evaluate(() => { window.__S.signOut(); });
  await p.waitForTimeout(400);
  const d = await disk(p);
  /* V.05.2: KEEPS_ON_SIGN_OUT names what STAYS, and the picture is not in
     it — it goes with the person, like everything else the account owns. */
  ok('5.1 signing out takes the picture with the account', !d.user, JSON.stringify(d.user));
  ok('5.2 …and the device keeps its own language', d.lang === 'ar', String(d.lang));
  await ctx.close();
}

ok('6.1 no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);

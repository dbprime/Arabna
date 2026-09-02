/* V.03.6 — batch nine (ح): the security pass.

   This suite exists because none of the faults it covers made the app look
   broken. It worked exactly as it always had, which is the whole danger:
   a probe injected through a link ran as part of the page, a signed-in
   stranger could pin somebody else's listing to the top of the marketplace,
   `?admin=1` published an event live, and the staff password was two
   exported constants in a file the browser downloads.

   Every check below fails LOUDLY if any of that comes back. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { withDemoData } from './_demo.mjs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); } else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const browser = await chromium.launch();
/* ⚠️ THIS SUITE USES THE INVENTED RECORDS AS ITS FIXTURE, and `510`
   turned them off by default. It turns them on for itself — the
   default is not reverted and no assertion is softened. */
await withDemoData(browser);
const ctx = await browser.newContext({ colorScheme: 'dark', viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errors = [], csp = [];
page.on('console', m => {
  const x = m.text();
  if (/Content Security Policy/i.test(x)) csp.push(x.slice(0, 140));
  else if (m.type() === 'error' && !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|ERR_NAME|fonts\.googleapis/.test(x)) errors.push(x.slice(0, 140));
});
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message.slice(0, 140)));

const mods = () => page.evaluate(async () => {
  if (!window.__m) {
    const load = async (rel, spec) => { try { return await import(spec); } catch (e) { return await import(rel); } };
    window.__m = { S: await load('./js/store.js', 'arabna/js/store.js') };
  }
  return true;
});
const go = async (h) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(620); };
/* The CSP this suite is here to defend forbids `eval` and `new Function`,
   so the harness may not use them either. The module is primed once and
   read from `window.__m.S` inside a function Playwright serialises. */
const S = async (fn, arg) => { await mods(); return page.evaluate(fn, arg); };

await page.goto(BASE); await page.waitForTimeout(900); await mods();

/* ======================================================================
   1 — a link cannot put code in the page
   ====================================================================== */
console.log('--- the injection ---');
const PROBE = '<arabna-probe id="pX"></arabna-probe>';

/* The search term comes straight off the URL, which is the version of this
   that needs no account at all: a message in WhatsApp is the whole attack. */
await page.goto(BASE + '#/directory?q=' + encodeURIComponent(PROBE));
await page.waitForTimeout(950);
ok('1.1 a tag in ?q= does not become an element',
   !(await page.evaluate(() => !!document.querySelector('#pX'))));

await mods();
await S((P) => {const S = window.__m.S;
  S.state.user = { name: 'ر' + P, email: 'r@x.com', phone: '7134669182',
                   phoneVerified: true, emailVerified: true, joined: Date.now(), tier: 2 };
  S.state.extraClassifieds = [{ id: 'cX', cat: 'cars', title: { ar: P, en: P }, desc: { ar: P, en: P },
                                price: '$100', city: 'Houston', at: Date.now(), status: 'pending', by: 'me' }];
  S.state.myListings = ['cX'];
  S.state.reviews = [{ id: 'rX', bizId: 'b1', by: P, author: P, text: P, rating: 5, at: Date.now() }];
  S.state.offers = { b1: [{ id: 'oX', bizId: 'b1', text: P, price: P, endsAt: Date.now() + 864e5, status: 'live' }] };
  S.save();
}, PROBE);

const clean = async (label, route, n) => {
  await page.goto(BASE + route); await page.waitForTimeout(950);
  const el = await page.evaluate(() => !!document.querySelector('#pX'));
  const asText = await page.evaluate(() => document.body.textContent.includes('arabna-probe'));
  ok(n + ' ' + label + ': the tag is text, not an element', !el && asText, el ? 'INJECTED' : (asText ? 'shown as text' : 'not rendered'));
};
await clean('the marketplace list', '#/marketplace', '1.2');
await clean('the listing page', '#/marketplace/cX', '1.3');
await clean('a business page (review + offer)', '#/directory/b1', '1.4');
await clean('the profile', '#/profile', '1.5');

/* the decisive one: an advertisement waiting for approval is drawn INSIDE
   the owner's own panel, so reaching it needs no break-in, only patience */
await page.goto(BASE + '#/admin'); await page.waitForTimeout(900);
await page.evaluate(async () => {
  const S = (window.__m && window.__m.S)
    || await import('arabna/js/store.js').catch(() => import('./js/store.js'));
  if (!S.adminIsSet()) { await S.setAdminPass('Arabna@2026!', 'arabna.admin'); location.hash = '#/home'; }
});
await page.waitForTimeout(250);
await go('#/admin');
if (await page.locator('#aUser').count()) {
  await page.fill('#aUser', 'arabna.admin'); await page.fill('#aPass', 'Arabna@2026!');
  await page.click('#aGo'); await page.waitForTimeout(1000);
}
ok('1.6 the admin moderation queue: the tag is text, not an element',
   !(await page.evaluate(() => !!document.querySelector('#pX')))
   && (await page.evaluate(() => document.body.textContent.includes('arabna-probe'))));

/* one escape, and no copies of it left behind */
ok('1.7 esc() is exported from ui.js', await page.evaluate(async () => {
  const U = await import('arabna/js/ui.js').catch(() => import('./js/ui.js'));
  return typeof U.esc === 'function'
      && U.esc('<a href="x">&\'') === '&lt;a href=&quot;x&quot;&gt;&amp;&#39;';
}));

/* ======================================================================
   2 — and if a site is ever missed, the policy refuses to run it
   ====================================================================== */
console.log('--- the second layer ---');
await go('#/home');
/* The single-file build IS an inline importmap plus modules served as
   data: URLs, so `script-src 'self'` would refuse to run the app itself.
   It is the offline backup and half the test net, opened from a file and
   never from the web, so it carries a policy that fits what it is — and
   `index.html`, the thing actually deployed, keeps the strict one. Both
   are asserted here rather than one of them being quietly skipped; and
   `esc()` — section 1, which passes on BOTH builds — is the layer that
   does the real work either way. */
const policy = await page.evaluate(() => {
  const m = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
  return m ? m.getAttribute('content') : '';
});
const strict = /script-src 'self';/.test(policy);
if (strict) {
  ok('2.1 a script injected into the page does not run', await page.evaluate(() => {
    try { const s = document.createElement('script'); s.textContent = 'window.__pwned = 1'; document.body.appendChild(s); } catch (e) { /* refused */ }
    return !window.__pwned;
  }));
} else {
  ok('2.1 the offline build relaxes script-src on purpose, and says so',
     /script-src 'self' 'unsafe-inline' data: blob:/.test(policy), policy.slice(0, 70));
}
const probeHost = async (u) => {
  const before = csp.length;
  await page.evaluate(x => fetch(x).catch(() => {}), u);
  await page.waitForTimeout(350);
  return csp.length === before;      // no violation logged = the policy allows it
};
ok('2.2 the ZIP lookup is allowed', await probeHost('https://api.zippopotam.us/us/77081'));
/* ⚠️ REVERSED IN V.08.8 (`550`): Nominatim is disabled in production under
   Schedule E-08 of the Founder Agreement — no call in the code, no host in
   CSP, none in sw.js. The policy must now REFUSE it, so that a line
   bringing it back is stopped by the browser itself. */
ok('2.3 BigDataCloud is allowed and Nominatim is NOT',
   (await probeHost('https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=1&longitude=1'))
   && !(await probeHost('https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=1&lon=1')));
ok('2.4 …and nothing else is', !(await probeHost('https://example.invalid/x')));
/* A host forgotten in `connect-src` fails SILENTLY, so the screens that
   depend on one are walked before this suite is trusted. */
const cspBefore = csp.length;   // the probes above are ours and were meant to fire
for (const r of ['#/home', '#/directory', '#/directory/b1', '#/marketplace', '#/events',
                 '#/magazine', '#/prayer', '#/categories', '#/advertise', '#/newcomer',
                 '#/offers', '#/auth/signup', '#/help', '#/about', '#/privacy']) {
  await go(r);
}
ok('2.5 fifteen screens, zero CSP violations', csp.length === cspBefore,
   csp.slice(cspBefore, cspBefore + 3).join(' | '));
ok('2.6 the font and the logo still load', await page.evaluate(async () => {
  location.hash = '#/home';
  await new Promise(r => setTimeout(r, 500));
  const i = document.querySelector('img[data-logo]');
  return document.fonts.check('16px "IBM Plex Sans Arabic"') && !!i && i.complete && i.naturalWidth > 0;
}));

/* ======================================================================
   3 — signed in is not the same as owning it
   ====================================================================== */
console.log('--- who may change what ---');
await S(() => {const S = window.__m.S;
  S.setAdminUnlocked(false);
  S.state.user = { name: 'غريب', email: 'x@x.com', phone: '7134669182',
                   phoneVerified: true, emailVerified: true, joined: Date.now(), tier: 2 };
  S.state.myListings = [];                    // owns nothing
  S.save();
});
const theirs = await S(() => { const S = window.__m.S; return ((S.allClassifieds()[0] || {}).id); });
await go('#/boost/' + theirs);
ok('3.1 #/boost/<not mine> is refused at the door',
   (await page.evaluate(() => location.hash)) === '#/marketplace/' + theirs
   && !(await page.locator('#payBtn').count()), await page.evaluate(() => location.hash));
/* `state.boosted` may already carry a seed listing, so the assertion is
   that the CALL is refused and adds nothing — not that the list is bare. */
ok('3.2 …and boosting it from the console is refused too',
   await S((id) => {const S = window.__m.S;
     const before = S.state.boosted.length;
     return S.boostClassified(id) === false && S.state.boosted.length === before;
   }, theirs));
await go('#/post?edit=' + theirs);
ok('3.3 #/post?edit=<not mine> does not open their listing',
   !(await page.locator('#pTitle').count()), await page.evaluate(() => location.hash));
ok('3.4 …and rewriting it from the console is refused',
   await S((id) => { const S = window.__m.S; return S.updateClassified(id, { city: 'X' }).rec === null; }, theirs));

/* `?admin=1` was a permission taken from the address bar: it opened the
   staff form, published LIVE to everybody, and offered `featured`, which
   is the $99/week pin. */
await go('#/events/propose?admin=1');
ok('3.5 ?admin=1 does not hand out the staff form',
   !(await page.locator('#evFeat').count()));
ok('3.6 …and the store refuses a live event from anyone but the panel',
   await S(() => {const S = window.__m.S;
     const r = S.addEvent({ title: { ar: 'ت', en: 't' }, startsAt: '2027-01-01T10:00', featured: true }, 'live');
     const okk = r.status === 'pending' && !r.featured;
     S.state.extraEvents = S.state.extraEvents.filter(e => e.id !== r.id); S.save();
     return okk;
   }));
const someEvent = await S(() => { const S = window.__m.S; return ((S.allEvents()[0] || {}).id); });
await go('#/events/edit/' + someEvent);
ok('3.7 an event somebody else proposed cannot be edited',
   !(await page.locator('#evTitle').count()), await page.evaluate(() => location.hash));

/* …and the owner and the panel lose nothing */
await S(() => {const S = window.__m.S;
  S.state.extraClassifieds = [{ id: 'cMine', cat: 'cars', title: { ar: 'سيارتي', en: 'My car' },
                                desc: { ar: 'د', en: 'd' }, price: '$100', city: 'Houston',
                                at: Date.now(), status: 'live', by: 'me' }];
  S.state.myListings = ['cMine']; S.save();
});
await go('#/boost/cMine');
ok('3.8 my own listing still boosts', (await page.locator('#payBtn').count()) === 1);
await go('#/post?edit=cMine');
ok('3.9 my own listing still edits',
   (await page.evaluate(() => { const i = document.querySelector('#pTitle'); return i ? i.value : ''; })) === 'سيارتي');
ok('3.10 the panel keeps every power it had', await S(() => {const S = window.__m.S;
  S.setAdminUnlocked(true);
  const r = S.addEvent({ title: { ar: 'ت', en: 't' }, startsAt: '2027-01-01T10:00' }, 'pending');
  S.approveEvent(r.id);
  S.featureEvent(r.id, true);
  const e = S.eventById(r.id);
  const okk = e.status === 'live' && e.featured === true;
  S.state.extraEvents = S.state.extraEvents.filter(x => x.id !== r.id);
  S.setAdminUnlocked(false); S.save();
  return okk;
}));

/* ======================================================================
   4 — the staff password is not in the files
   ====================================================================== */
console.log('--- the password ---');
const files = await page.evaluate(async () => {
  const out = {};
  for (const f of ['js/store.js', 'js/screens/admin.js', 'js/app.js']) {
    try { out[f] = await (await fetch(f)).text(); } catch (e) { out[f] = ''; }
  }
  return out;
});
const bodies = Object.values(files).join('\n');
/* On the single-file build the modules are base64 inside the page, so the
   fetch above comes back empty; the check then runs against the document
   itself, which is the thing actually shipped either way. */
const shipped = bodies.trim() ? bodies : await page.content();
ok('4.1 no password literal in the shipped code',
   !/Arabna@2026!/.test(shipped.replace(/ADMIN_USER` and `ADMIN_PASS`/g, '')));
ok('4.2 the two constants are gone', !/export const ADMIN_(USER|PASS)\s*=/.test(shipped));
ok('4.3 only a salt and a hash are stored', await page.evaluate(() => {
  const a = (JSON.parse(localStorage.getItem('arabna.v1')) || {}).adminAuth || {};
  return !!a.hash && !!a.salt && a.pass === undefined;
}));
ok('4.4 the panel refuses when nothing has been set', await S(async () => {
  const S = window.__m.S;
  const keep = S.state.adminAuth;
  S.state.adminAuth = null;
  const refused = !(await S.checkAdmin('arabna.admin', 'Arabna@2026!')) && !S.adminIsSet();
  S.state.adminAuth = keep; S.save();
  return refused;
}));
ok('4.5 an unclaimed device is asked to SET one, not to guess', await (async () => {
  const c2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p2 = await c2.newPage();
  await p2.goto(BASE + '#/admin'); await p2.waitForTimeout(1100);
  const r = (await p2.locator('#aSet').count()) === 1 && (await p2.locator('#aGo').count()) === 0;
  await c2.close();
  return r;
})());

/* ======================================================================
   5 — the forms refuse what cannot be true
   ====================================================================== */
console.log('--- the forms ---');
await S(() => {const S = window.__m.S;
  S.state.user = { name: 'ر', email: 'r@x.com', phone: '7134669182', phoneVerified: true,
                   emailVerified: true, joined: Date.now(), tier: 2 };
  S.state.extraClassifieds = []; S.state.myListings = []; S.state.extraEvents = []; S.save();
});
const post = async (price, title = 'سيارة للبيع نظيفة') => {
  await go('#/post'); await page.waitForTimeout(350);
  await page.fill('#pTitle', title); await page.fill('#pPrice', price);
  await page.fill('#pCity', 'Houston'); await page.fill('#pDesc', 'وصف الإعلان هنا');
  const before = await S(() => { const S = window.__m.S; return (S.state.extraClassifieds.length); });
  await page.click('#pubBtn'); await page.waitForTimeout(750);
  return {
    published: (await S(() => { const S = window.__m.S; return (S.state.extraClassifieds.length); })) > before,
    msg: await page.evaluate(() => {
      const e = document.querySelector('#e_pPrice .err-msg, #e_pTitle .err-msg, #e_pDesc .err-msg');
      return e ? e.textContent.trim() : '';
    }),
  };
};
for (const [v, n] of [['-500', '5.1'], ['999999999999', '5.2'], ['abc', '5.3']]) {
  const r = await post(v);
  /* The message NAMES the range. «قيمة غير صالحة» tells somebody who typed
     999999999999 nothing about what to type instead. */
  ok(`${n} price "${v}" is refused, and the message says what is accepted`,
     !r.published && /\d/.test(r.msg), r.msg);
}
const zero = await post('0');
ok('5.4 «0» publishes and reads «مجاني», never "$0"',
   zero.published && (await S(() => { const S = window.__m.S; return (S.state.extraClassifieds[0].price); })) === '__FREE__');
await S(() => {const S = window.__m.S; S.state.extraClassifieds = []; S.state.myListings = []; S.save(); });
const good = await post('14500');
ok('5.5 a real price still publishes', good.published,
   await S(() => { const S = window.__m.S; return (S.state.extraClassifieds[0] && S.state.extraClassifieds[0].price); }));
await go('#/post');
await page.fill('#pTitle', 'ع'.repeat(300));
ok('5.6 a 300-character title is stopped at 80 while it is typed',
   (await page.evaluate(() => document.querySelector('#pTitle').value.length)) === 80
   && /80/.test(await page.evaluate(() => document.querySelector('#c_pTitle').textContent)));
await page.fill('#pTitle', 'ab'); await page.fill('#pPrice', '100');
await page.fill('#pCity', 'Houston'); await page.fill('#pDesc', 'x');
const nBefore = await S(() => { const S = window.__m.S; return (S.state.extraClassifieds.length); });
await page.click('#pubBtn'); await page.waitForTimeout(700);
ok('5.7 a two-character title is refused under its own field',
   (await S(() => { const S = window.__m.S; return (S.state.extraClassifieds.length); })) === nBefore
   && !!(await page.locator('#e_pTitle .err-msg').count()));

const propose = async (start, end) => {
  await go('#/events/propose'); await page.waitForTimeout(350);
  await page.fill('#evTitle', 'مهرجان'); await page.fill('#evVenue', 'قاعة');
  await page.fill('#evStart', start); if (end) await page.fill('#evEnd', end);
  const before = await S(() => { const S = window.__m.S; return (S.state.extraEvents.length); });
  await page.click('#evSave'); await page.waitForTimeout(750);
  return (await S(() => { const S = window.__m.S; return (S.state.extraEvents.length); })) > before;
};
ok('5.8 a start in the past never reaches the queue', !(await propose('2020-05-01T10:00', '')));
ok('5.9 an end before its start never reaches the queue', !(await propose('2027-05-02T10:00', '2027-05-01T10:00')));
ok('5.10 a real future event still does', await propose('2027-05-01T10:00', '2027-05-01T14:00'));

/* ======================================================================
   6 — no dead telephone link
   ====================================================================== */
console.log('--- the published contact ---');
ok('6.1 the fictional 555 support number is gone',
   await S(() => { const S = window.__m.S; return (S.SUPPORT_PHONE === '' || !/^\(?\d{3}\)?[ -]?555-/.test(S.SUPPORT_PHONE)); }),
   await S(() => { const S = window.__m.S; return (S.SUPPORT_PHONE || '(empty)'); }));
for (const [n, r] of [['6.2 About', '#/about'], ['6.3 Privacy', '#/privacy'], ['6.4 Terms', '#/terms']]) {
  await go(r);
  const links = await page.evaluate(() => [...document.querySelectorAll('a[href^="tel:"]')].map(a => a.getAttribute('href')));
  const mail = await page.evaluate(() => !!document.querySelector('a[href^="mailto:"]'));
  ok(`${n}: no tel: link that rings nowhere, and the email is still published`,
     links.every(h => h.length > 4) && mail, links.join(' ') || 'no tel: link');
}

await go('#/home');
ok('99 zero console errors', errors.length === 0, errors.slice(0, 3).join(' | '));

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);

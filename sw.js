/* ARABNA — the directory works with no internet.

   ⚠️ THE REASON IS NOT THE STORE. Somebody standing inside a supermarket
   with no signal wants a grocer's number: the app opens and all 514
   listings are with them. Google Play requires a service worker with a
   fetch handler and there is no way in without one — but nothing here is
   built to please a reviewer; it is built to serve the reader.

   ⚠️ MEASURED BEFORE ANY OF IT: with no internet the app did not open at
   all — no error page, no line, the browser's own screen.
*/
importScripts('./js/sw-manifest.js');

/* ⚠️ The cache name carries the version, so raising APP_VERSION is what
   invalidates the old one — one number in `js/data.js`, no second copy. */
const CACHE = 'arabna-' + self.SW_VERSION;

/* ⚠️ THESE TWO NEVER TOUCH THE CACHE. A coordinate cached from
   yesterday is worse than no coordinate: the reader has moved and the app
   insists they are where they were. They are the same two written into
   `connect-src` in `vercel.json` — read from there, not invented here. */
const NETWORK_ONLY = [
  'api.zippopotam.us',
  'api.bigdatacloud.net',
  /* ⚠️ AND THE LIVE DATABASE, for a reason of the same family and one
     sharper: a cached auth response is a session decided yesterday, and a
     cached row is a listing that may since have been taken down. The
     directory still works with no connection because `data.js` is
     precached — never because a stale answer was kept. Hostname only, no
     scheme: the comparison is on `url.hostname`. */
  'ijubbqvbkfzillkhwdzp.supabase.co',
];

/* ⚠️ A RESPONSE THAT CARRIES A REDIRECT CANNOT ANSWER A NAVIGATION —
   the specification forbids it, and WebKit enforces it to the letter:
   «Response served by service worker has redirections». Rebuilding it
   drops the flag and keeps the body byte for byte.

   Measured on a host that redirects `/index.html` the way `cleanUrls`
   did: the cache held one poisoned row — `/index.html -> /`,
   `redirected: true` — and the SECOND navigation failed outright.
   ⚠️ The first always comes from the network, which is why one try never
   finds this and it reaches the reader instead.

   ⚠️ AND IT STAYS AFTER `cleanUrls` IS GONE. Any hosting setting
   tomorrow, or a domain added later, can bring the redirect back — the
   guard belongs in the app, not in the host's configuration. */
const noRedirect = (res) => (res && res.redirected)
  ? new Response(res.body, { status: res.status, statusText: res.statusText, headers: res.headers })
  : res;

self.addEventListener('install', (e) => {
  /* ⚠️ NO `skipWaiting()` HERE. Taking over while the reader is inside a
     screen swaps the modules under them, so a new module is imported by
     an old build and it breaks in front of their eyes. The new version
     waits until they press. */
  /* ⚠️ `addAll` cannot be used: it stores whatever the network returns,
     redirect flag and all. Each file is fetched and passed through the
     guard, so a poisoned row never enters the cache in the first place. */
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(
    self.PRECACHE.map(f => fetch(f, { cache: 'reload' })
      .then(r => (r && r.ok) ? c.put(f, noRedirect(r)) : null))
  )));
});

self.addEventListener('activate', (e) => {
  /* ⚠️ Old caches are deleted, or a stale one sits on the reader's phone
     costing megabytes that are never used again. */
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* the reader pressed «تحديث»: only now does the new build take over */
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }

  if (NETWORK_ONLY.some(h => url.hostname === h)) return;   // straight to the network
  if (url.origin !== self.location.origin) return;          // fonts and anything else
  /* ⚠️ the single-file build is 6.6 MB and is a TEST build — never cached */
  if (url.pathname.endsWith('index-single-file.html')) return;

  e.respondWith(
    caches.match(req).then((hit) => {
      /* ⚠️ BOTH ENDS, never one. Guarding only the store leaves every
         cache already on a reader's phone poisoned; guarding only the
         answer lets the poison pile up. */
      if (hit) return noRedirect(hit);
      return fetch(req).then((res) => {
        /* whatever else the app asks for — the rest of `assets/` — is
           cached ON FIRST USE, never before: 4 MB up front on somebody's
           mobile data is an assault on the reader. */
        if (res && res.ok && res.type === 'basic') {
          const copy = noRedirect(res.clone());
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => {
        /* offline and never seen: a navigation still opens the app shell,
           so the directory is there rather than the browser's error page */
        /* ⚠️ the exact spot the fault landed: the offline shell */
        if (req.mode === 'navigate') return caches.match('index.html').then(noRedirect);
        return new Response('', { status: 504, statusText: 'offline' });
      });
    })
  );
});

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

/* ⚠️ THESE THREE NEVER TOUCH THE CACHE. A coordinate cached from
   yesterday is worse than no coordinate: the reader has moved and the app
   insists they are where they were. They are the same three written into
   `connect-src` in `vercel.json` — read from there, not invented here. */
const NETWORK_ONLY = [
  'api.zippopotam.us',
  'nominatim.openstreetmap.org',
  'api.bigdatacloud.net',
];

self.addEventListener('install', (e) => {
  /* ⚠️ NO `skipWaiting()` HERE. Taking over while the reader is inside a
     screen swaps the modules under them, so a new module is imported by
     an old build and it breaks in front of their eyes. The new version
     waits until they press. */
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(self.PRECACHE)));
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
      if (hit) return hit;
      return fetch(req).then((res) => {
        /* whatever else the app asks for — the rest of `assets/` — is
           cached ON FIRST USE, never before: 4 MB up front on somebody's
           mobile data is an assault on the reader. */
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => {
        /* offline and never seen: a navigation still opens the app shell,
           so the directory is there rather than the browser's error page */
        if (req.mode === 'navigate') return caches.match('index.html');
        return new Response('', { status: 504, statusText: 'offline' });
      });
    })
  );
});

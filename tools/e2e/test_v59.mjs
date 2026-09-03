/* V.08.2 — the share card carried the old address.

   ⚠️ the owner connected `arabna.app` on 1 September and the domain works.
   Measured after connecting: THREE absolute URLs in `index.html` were
   still written, by hand, on the temporary host — `og:url`, `og:image`
   and `twitter:image`.

   ⚠️ AND THE HARM IS NOT COSMETIC. `og:url` is what the app declares as
   its own address, so whoever shares the link on WhatsApp or Facebook
   gets a card built on the old host, and whoever presses it lands there
   rather than on `arabna.app`. The image is fetched from there too. That
   builds an audience on an address that will be abandoned — the same
   harm that kept Google out in `510`.

   ⚠️ AND THE FAULT WAS NOT THAT THE ADDRESS WAS OLD — IT WAS THAT
   NOTHING WAS WATCHING. Three URLs slept for weeks and only surfaced
   when the domain was connected. So item 4 is a standing item, and it is
   a negative on THE HOST (`vercel.app`) and never on the old name: a
   negative on one name goes green by itself the day a second name is
   invented. That is `390`'s rule exactly.

   ⚠️ AND NO VERSION LITERAL IS WRITTEN HERE. `test_v56 · 3.6` froze
   `'0.7.9'` into a check and it went red in the very next batch with
   nothing broken: a frozen number in a check is a red scheduled for a
   future date. What is measured is that the carriers AGREE. */
import { readFileSync, existsSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const ROOT = new URL('../../', import.meta.url).pathname;
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); }
  else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };
const read = f => readFileSync(ROOT + f, 'utf8');

const SITE = 'https://arabna.app';
const CARD = 'assets/share-1200x630.png';

/* the value of one meta tag, read from the file rather than assumed */
const meta = (html, attr, name) => {
  const re = new RegExp('<meta[^>]*\\b' + attr + '="' + name + '"[^>]*>', 'i');
  const tag = re.exec(html);
  if (!tag) return null;
  const c = /content="([^"]*)"/i.exec(tag[0]);
  return c ? c[1] : null;
};

const html = read('index.html');

/* ============ 1 — og:url is the real address ============ */
ok('1.1 og:url is the connected domain', meta(html, 'property', 'og:url') === SITE + '/',
   String(meta(html, 'property', 'og:url')));

/* ============ 2 — the two image URLs, read and compared ============ */
/* ⚠️ THE TWO ARE READ AND COMPARED WITH EACH OTHER, never written twice
   here: a card whose two halves disagree is a card that renders one way
   on WhatsApp and another on X, and asserting a literal against each
   would not notice them drifting apart. */
{
  const og = meta(html, 'property', 'og:image');
  const tw = meta(html, 'name', 'twitter:image');
  ok('2.1 og:image is on the connected domain', og === SITE + '/' + CARD, String(og));
  ok('2.2 twitter:image is the very same URL', !!og && og === tw, og + ' / ' + tw);
  /* ⚠️ AND THEY STAY ABSOLUTE. Facebook's and WhatsApp's crawlers do not
     resolve a relative `og:image` — the absolute form is correct here and
     the fault was in the host, not in the shape. */
  ok('2.3 …and both stay absolute', /^https:\/\//.test(String(og)) && /^https:\/\//.test(String(tw)));
}

/* ============ 3 — the file the URL points at ============ */
/* ⚠️ A URL with the right host and a broken path gives a card with no
   image at all, which looks exactly like a card that was never set up. */
ok('3.1 the file the URL names is really in the repository', existsSync(ROOT + CARD), CARD);

/* a PNG read with the standard library and nothing else — this project
   has no dependencies and does not buy one to look at an image */
function png(path) {
  const d = readFileSync(path);
  if (d.slice(0, 8).toString('binary') !== '\x89PNG\r\n\x1a\n') throw new Error('not a png');
  let i = 8, idat = [], w = 0, h = 0, bd = 0, ct = 0, inter = 1;
  while (i < d.length) {
    const len = d.readUInt32BE(i), typ = d.slice(i + 4, i + 8).toString('ascii');
    if (typ === 'IHDR') {
      w = d.readUInt32BE(i + 8); h = d.readUInt32BE(i + 12);
      bd = d[i + 16]; ct = d[i + 17]; inter = d[i + 20];
    } else if (typ === 'IDAT') idat.push(d.slice(i + 8, i + 8 + len));
    else if (typ === 'IEND') break;
    i += 12 + len;
  }
  if (inter !== 0 || bd !== 8) throw new Error('unsupported png: interlace ' + inter + ' depth ' + bd);
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ct];
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * ch, out = Buffer.alloc(h * stride);
  let prev = Buffer.alloc(stride), p = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[p++], line = Buffer.from(raw.slice(p, p + stride)); p += stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? line[x - ch] : 0, b = prev[x], c = x >= ch ? prev[x - ch] : 0;
      if (f === 1) line[x] = (line[x] + a) & 255;
      else if (f === 2) line[x] = (line[x] + b) & 255;
      else if (f === 3) line[x] = (line[x] + ((a + b) >> 1)) & 255;
      else if (f === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        line[x] = (line[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
    }
    line.copy(out, y * stride); prev = line;
  }
  return { w, h, ch, px: out };
}

/* ⚠️ DERIVED, NOT WRITTEN. It names no city, no colour and no pixel
   position, so it cannot go green because the picture was redrawn with a
   different sentence in it. A row holds content when it differs from the
   ground colour, and rows separated by a hairline are ONE object: the
   lockup's own parts sit 2 and 3 rows apart, and the sentence that used
   to stand under it was 60 rows below. Measured before and after:
   TWO blocks, then ONE. */
const ROW_GAP = 20, TOL = 18;
function contentBlocks(path) {
  const { w, h, ch, px } = png(path);
  const stride = w * ch, bg = [px[0], px[1], px[2]];
  const spans = []; let run = false, start = 0;
  for (let y = 0; y < h; y++) {
    let hits = 0;
    for (let x = 0; x < w && hits <= 2; x += 2) {
      const o = y * stride + x * ch;
      if (Math.abs(px[o] - bg[0]) > TOL || Math.abs(px[o + 1] - bg[1]) > TOL || Math.abs(px[o + 2] - bg[2]) > TOL) hits++;
    }
    const on = hits > 2;
    if (on && !run) start = y;
    if (!on && run) spans.push([start, y - 1]);
    run = on;
  }
  if (run) spans.push([start, h - 1]);
  const merged = [];
  for (const s of spans) {
    if (merged.length && s[0] - merged[merged.length - 1][1] <= ROW_GAP) merged[merged.length - 1][1] = s[1];
    else merged.push([s[0], s[1]]);
  }
  return { w, h, blocks: merged.length, merged };
}

if (existsSync(ROOT + CARD)) {
  const m = contentBlocks(ROOT + CARD);
  ok('3.2 the card is 1200 x 630, read from the file', m.w === 1200 && m.h === 630, m.w + ' x ' + m.h);
  /* ⚠️ Text drawn INSIDE an image is never reached by a batch. The app's
     own line grew from a city to a country and the picture's did not, so
     the two disagreed on a card everybody sees. The sentence is gone and
     the lockup stands alone — the title and the description are printed
     under the image by WhatsApp and Facebook alike, so it was the copy
     that falls behind. */
  ok('3.3 one block of content — the lockup, with no line under it',
     m.blocks === 1, m.blocks + ' block(s): ' + JSON.stringify(m.merged));
}

/* ============ 4 — the standing item ============ */
/* ⚠️ ON THE HOST, NEVER ON THE OLD NAME. `arabna-db-prime.vercel.app` is
   one name out of an unlimited supply, and a preview project invented
   tomorrow would sail past a check written against that string. */
{
  const files = ['index.html', 'index-single-file.html', 'manifest.json', 'sw.js',
    'styles/app.css', 'vercel.json', 'robots.txt', 'js/sw-manifest.js'];
  const hits = [];
  for (const f of files) if (existsSync(ROOT + f) && /\bvercel\.app\b/.test(read(f))) hits.push(f);
  ok('4.1 no absolute URL on a vercel.app host in any published file',
     hits.length === 0, hits.length ? hits.join(', ') : '0 places');
}

/* ============ 5 — the generated build carries the same three ============ */
/* ⚠️ It is GENERATED, so it is the half that silently keeps yesterday's
   values when somebody edits `index.html` and does not rebuild. */
{
  const one = read('index-single-file.html');
  const same = ['og:url', 'og:image'].every(n => meta(one, 'property', n) === meta(html, 'property', n))
    && meta(one, 'name', 'twitter:image') === meta(html, 'name', 'twitter:image');
  ok('5.1 the single-file build carries the same three values', same,
     String(meta(one, 'property', 'og:url')));
  ok('5.2 …and it names the connected domain three times',
     (one.match(/https:\/\/arabna\.app/g) || []).length === 3,
     String((one.match(/https:\/\/arabna\.app/g) || []).length));
}

/* ============ 6 — a comment that says what is no longer true ============ */
/* ⚠️ Somebody reading it to decide something decides on a dead fact —
   the service worker landed with `420`. */
ok('6.1 the comment above the manifest line does not deny the service worker',
   !/no service worker yet/i.test(html));
ok('6.2 …and it points at where the version really lives',
   /APP_VERSION/.test(html.slice(0, html.indexOf('rel="manifest"'))));

/* ============ 7 — the version rose, and every carrier agrees ============ */
/* ⚠️ THE REASON THE VERSION IS RAISED AT ALL: the worker keeps
   `index.html` in a cache named after it, so without a raise an
   installed reader keeps yesterday's head and yesterday's card. So it is
   MEASURED, not assumed — and measured as agreement, because a literal
   here would be a red scheduled for a future date. */
{
  const v = /APP_VERSION\s*=\s*'([^']+)'/.exec(read('js/data.js'))[1];
  const sw = /SW_VERSION\s*=\s*'([^']+)'/.exec(read('js/sw-manifest.js'))[1];
  const doc = /Current version:\s*\*\*V\.0*(\d+)\.(\d+)/.exec(read('CLAUDE.md'));
  const docV = doc ? Number(doc[1]) + '.' + doc[2] : null;
  ok('7.1 the worker manifest was regenerated with the app', v === sw, v + ' / ' + sw);
  ok('7.2 …and CLAUDE.md names the same version', docV !== null && ('0.' + docV) === v,
     'data.js ' + v + ' · CLAUDE.md 0.' + docV);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

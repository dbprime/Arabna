import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const HOST = process.env.HOST || 'http://localhost:8099';

/* the links the renderer will draw, counted from the packs themselves:
   every markdown link in a block type that reaches the page — the `tool`
   block's `alt` is not one of them (build.mjs drops it) */
const SRC_LINKS = (() => {
  const KEEP = new Set(['p', 'h', 'warn', 'alert', 'do', 'ul', 'rows']);
  const pack = JSON.parse(fs.readFileSync(new URL('./nc-ar.json', import.meta.url), 'utf8'));
  const text = (v) => typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(text) : [];
  let n = 0;
  for (const sec of pack) for (const b of sec.blocks) for (const [k, v] of Object.entries(b)) {
    if (KEEP.has(k)) n += text(v).join(' ').match(/\]\(https?:\/\//g)?.length || 0;
  }
  return n;
})();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{width:390,height:844} });
const errs = [], failed = [];
page.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('requestfailed', r => failed.push(r.url()));
await page.goto(`${HOST}/tools/nc/nc-render.html`, { waitUntil:'networkidle' });

let pass=0, fail=0;
const ok=(c,m)=>{ c?(pass++,console.log('  ok  '+m)):(fail++,console.log('  FAIL '+m)); };

for (const which of ['ar','en']) {
  if (which==='en') await page.click('#lang');
  const box = '#'+which;
  const txt = await page.$eval(box, el => el.innerText);
  ok(!/<[a-zA-Z\/]/.test(txt), which+' — لا وسم مطبوع كنصّ');
  ok(!/\*\*/.test(txt), which+' — لا علامات ** ظاهرة');
  ok(!/\]\(/.test(txt), which+' — لا روابط خام ظاهرة');
  ok(!/`/.test(txt), which+' — لا علامات ` ظاهرة');
  const secs = await page.$$eval(box+' .nc-sec', els=>els.length);
  ok(secs===17, which+' — 17 قسماً ('+secs+')');
  const tels = await page.$$eval(box+' a[href^="tel:"]', els=>els.length);
  const links = await page.$$eval(box+' a[href^="https:"]', els=>els.length);
  ok(tels===41, which+' — 41 هاتفاً ('+tels+')');
  /* ⚠️ THE LINK COUNT IS READ FROM THE SOURCE, NOT TYPED. It was the literal
     86, and 344 adds one — a number typed into a check is a red scheduled for
     the day the content changes, and worse, a check that agrees with itself.
     This one does not: the packs are parsed independently of the renderer
     (the tool block's `alt` link is dropped when the tool renders, so it is
     excluded the same way build.mjs excludes it), and the DOM is compared
     against that. A link that fails to render still turns it red. */
  ok(links===SRC_LINKS, which+' — '+SRC_LINKS+' رابطاً ('+links+')');
  const badHref = await page.$$eval(box+' a', els=>els.filter(a=>!/^(https:|tel:|mailto:|#)/.test(a.getAttribute('href')||'')).length);
  ok(badHref===0, which+' — لا رابط ببروتوكول غريب');
  const dos = await page.$$eval(box+' .nc-do', els=>els.length);
  /* 27 since 344: the «last reviewed» line under the lawyer's head notice */
  ok(dos===27, which+' — 25 سطر «ماذا تكتب» + سطر الخصوصيّة + سطر آخر مراجعة ('+dos+')');
  const tool = await page.$$eval(box+' .nc-tool input', els=>els.length);
  ok(tool===1, which+' — أداة الفيضان مرّة واحدة ('+tool+')');
  // horizontal overflow
  const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  ok(!over, which+' — لا تمرير أفقيّ');
}

await page.click('#lang');            // back to Arabic
await page.screenshot({ path:new URL('./nc-render-ar.png', import.meta.url).pathname, fullPage:false });
await page.click('#lang');
await page.screenshot({ path:new URL('./nc-render-en.png', import.meta.url).pathname, fullPage:false });
/* الخطّ من Google محجوب في صندوقي وحده — ويُستثنى بعنوانه لا بنصّ رسالته */
const fontOnly = failed.every(u => /fonts\.(googleapis|gstatic)\.com/.test(u));
const real = errs.filter(e => !/Failed to load resource/.test(e));
ok(real.length===0 && fontOnly, 'صفر خطأ console — ولا طلبٍ فاشل غير خطّ Google');
if (real.length) console.log('   ' + real.join('\n   '));
if (!fontOnly) console.log('   ' + failed.join('\n   '));
await browser.close();
console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);

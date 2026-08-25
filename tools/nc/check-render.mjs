import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const HOST = process.env.HOST || 'http://localhost:8099';
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
  ok(links===86, which+' — 86 رابطاً ('+links+')');
  const badHref = await page.$$eval(box+' a', els=>els.filter(a=>!/^(https:|tel:|mailto:|#)/.test(a.getAttribute('href')||'')).length);
  ok(badHref===0, which+' — لا رابط ببروتوكول غريب');
  const dos = await page.$$eval(box+' .nc-do', els=>els.length);
  ok(dos===26, which+' — 25 سطر «ماذا تكتب» + سطر الخصوصيّة ('+dos+')');
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

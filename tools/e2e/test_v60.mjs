/* V.08.4 — the house slide shows what can be sold, and does not vanish
   when it cannot.

   ⚠️ RAI'S QUESTION IS WHAT OPENED THIS: «if they are all sold, how does
   somebody browsing learn they could advertise here in future?»

   Three behaviours of one rule, and each was in a different place:

     Home     the house slide was appended UNCONDITIONALLY, so six sold
              made SEVEN slides — every advertiser got a seventh of the
              rotation having paid for a sixth, and the tap advertised a
              page that says «full».
     Sections `sectionSlider` decided from `ads.length` alone, so ONE sale
              out of four removed the invitation — three empty slots and
              nobody left to learn of them.
     Home     the permanent upsell block exists and does not cover it:
              measured, the slider is at y=459 and that block at y=1,529,
              which is 1.8 screens of scrolling.

   THE RULE: with a slot free the slide is IN the rotation; sold out it
   leaves the ROTATION and not the SCREEN — a strip under the slider keeps
   the invitation and offers the waiting list instead. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
const ROOT = new URL('../../', import.meta.url).pathname;
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); }
  else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const browser = await chromium.launch();

/* ⚠️ THE INVENTED RECORDS ARE OFF — the app's own default since `510`, and
   the state this batch is measured in: `SLIDER_ADS` carries three demo
   slides, and with them on, «sold out» is unreachable at six. */
const order = (product, i) => ({ id: 'o' + product + i, product, status: 'live',
  endsAt: Date.now() + 9e8, name: { ar: 'مُعلن ' + i, en: 'Adv ' + i },
  tag: { ar: 'وصف', en: 'tag' }, cta: { ar: 'اذهب', en: 'Go' },
  color: '#333', icon: 'star', link: '#/home' });

async function look(orders, route) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript((o) => {
    const KEY = 'arabna.v1';
    let st = {}; try { st = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { /* */ }
    st.showDemo = false; st.demoDefaultOff = true; st.myAds = o;
    localStorage.setItem(KEY, JSON.stringify(st));
  }, orders);
  const page = await ctx.newPage();
  await page.route('**://fonts.g*/**', r => r.abort());
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  const out = await page.evaluate(() => {
    const bar = document.querySelector('.cap-bar');
    const r = bar && bar.getBoundingClientRect();
    return {
      slides: document.querySelectorAll('.slider-track .slide').length,
      dots: document.querySelectorAll('.slider-dots .dot-i').length,
      house: document.querySelectorAll('.slide-house').length,
      barText: bar ? bar.innerText.replace(/\s+/g, ' ').trim() : null,
      barTop: r ? Math.round(r.top + window.scrollY) : null,
      adv: [...document.querySelectorAll('#app [data-route^="#/advertise"]')].length,
    };
  });
  await ctx.close();
  return out;
}

/* ============ 1 — nothing sold: the slide is the whole slider ============ */
{
  const r = await look([], '#/home');
  ok('1.1 nothing sold — one slide, and it is the house slide',
     r.slides === 1 && r.house === 1, r.slides + ' slide(s), house ' + r.house);
}

/* ============ 2 — some sold: it rides the rotation ============ */
{
  const r = await look(Array.from({ length: 4 }, (_, i) => order('slider', i)), '#/home');
  ok('2.1 four of six sold — five slides, the last of them the house slide',
     r.slides === 5 && r.house === 1, r.slides + ' slide(s), house ' + r.house);
  /* ⚠️ THE DOTS ARE THE PROOF THE ROTATOR AGREES WITH THE TRACK. The
     rotator is driven by the array it is handed, so a track with one more
     slide than the array draws one that is never shown, under a dot that
     never lights. One list, `slidesFor`, and both read it. */
  ok('2.2 …and the dots match the track, so nothing is drawn unshown',
     r.dots === r.slides, r.dots + ' dots / ' + r.slides + ' slides');
}

/* ============ 3 — sold out: six, not seven ============ */
{
  const r = await look(Array.from({ length: 6 }, (_, i) => order('slider', i)), '#/home');
  /* ⚠️ THIS IS THE FAULT ITSELF: seven before. An advertiser buys a SHARE
     of the rotation, and an extra turn takes that share from everyone who
     paid — `AD_SLOTS`'s own comment is the argument. */
  ok('3.1 sold out — six slides, not seven', r.slides === 6, r.slides + ' slide(s)');
  ok('3.2 …and the house slide is out of the rotation', r.house === 0, 'house ' + r.house);

/* ============ 4 — but it does not leave the screen ============ */
  ok('4.1 the strip is drawn under the slider', !!r.barText, String(r.barText));
  ok('4.2 …and it says the places are taken, not «put your ad here»',
     !!r.barText && /مكتمل|taken/.test(r.barText) && !/ضع إعلانك هنا|Put your ad/.test(r.barText),
     String(r.barText));
  /* ⚠️ AND IT REACHES THE WAITING LIST — `adWaitlist`/`joinWaitlist` were
     built and simply unreachable from the screens people browse. */
  ok('4.3 …and it offers the waiting list', !!r.barText && /انتظار|waiting/.test(r.barText),
     String(r.barText));

/* ============ 5 — above the fold, which is the whole point ============ */
  /* ⚠️ THE ITEM THAT PROTECTS THE REASON FOR THE BATCH. The permanent
     upsell block already exists at y=1,529 — 1.8 screens down — and a
     strip that needs scrolling is that block in new clothes. */
  ok('5.1 the strip is above the fold at 390x844', r.barTop !== null && r.barTop < 844,
     'top ' + r.barTop);
}

/* ============ 6 — with room, it names how many are left ============ */
{
  const r = await look(Array.from({ length: 4 }, (_, i) => order('slider', i)), '#/home');
  /* ⚠️ THE NUMBER IS READ FROM `adSlotsLeft`, NOT WRITTEN. Four of six sold
     leaves two, and the strip has to say two — a written number is a red
     scheduled for the day capacity changes. */
  ok('6.1 the strip names the remaining count, read not written',
     !!r.barText && /\b2\b/.test(r.barText) && /\b6\b/.test(r.barText), String(r.barText));
  ok('6.2 …and offers the slot rather than the waiting list',
     !!r.barText && !/انتظار|waiting/.test(r.barText), String(r.barText));
}

/* ============ 7 — the marketplace and events gain a way in ============ */
/* ⚠️ MEASURED BEFORE THIS BATCH AND IT WAS ZERO IN BOTH once a single slot
   sold: the magazine has a permanent button, the marketplace's upsell goes
   to `#/subscribe` (which is not advertising), and events had nothing. */
for (const [route, label] of [['#/marketplace', 'the marketplace'], ['#/events', 'events']]) {
  const some = await look([order(route === '#/events' ? 'events' : 'market', 1)], route);
  const full = await look(Array.from({ length: 4 }, (_, i) =>
    order(route === '#/events' ? 'events' : 'market', i)), route);
  ok('7.' + (route === '#/events' ? '2' : '1') + ' ' + label + ' reaches #/advertise with a slot free and with none',
     some.adv > 0 && full.adv > 0, 'free ' + some.adv + ' · full ' + full.adv);
}

/* ============ 8 — the inventory itself is untouched ============ */
/* ⚠️ THE BATCH DECIDES WHEN WHAT IS SHOWN, NEVER HOW MANY THERE ARE. */
{
  const src = readFileSync(ROOT + 'js/data.js', 'utf8');
  const blk = /AD_SLOTS = \{([\s\S]*?)\}/.exec(src)[1].replace(/\s+/g, ' ').trim();
  ok('8.1 AD_SLOTS is unchanged',
     /slider: 6/.test(blk) && /catSlider: 4/.test(blk) && /mini: 4/.test(blk)
     && /market: 4/.test(blk) && /events: 4/.test(blk) && /magazine: 4/.test(blk), blk);
  /* ⚠️ AND THE HOUSE SLIDE IS STILL NOT DEMO DATA — it is filtered out by
     its `kind`. Marking it demo would hide it the day the owner turns the
     invented records off, and it is not invented: it is ours. */
  ok('8.2 the house slide is excluded by kind, never by being demo',
     /kind !== 'house'/.test(readFileSync(ROOT + 'js/store.js', 'utf8')));
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

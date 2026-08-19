/* ======================= ADVERTISE PURCHASE FLOW ======================= */
import { t, icon, $, $$, go, renderHeader, toast, wireRoutes, fmtMoney,
         openSheet, closeSheet, showsPrices, wirePriceGates } from '../ui.js';
import { AD_PRODUCTS, CATEGORIES } from '../data.js';
import * as S from '../store.js';
import { mountPhotoPicker } from './marketplace.js';
import { fmtDate } from './directory.js';

const DURATIONS = [
  { id: 'week1', key: 'week1' },
  { id: 'week2', key: 'week2' },
  { id: 'month1', key: 'month1' },
];

/* Cheapest first, computed from the prices themselves so the order stays
   right if a price ever changes. The first card is also the pre-selected
   one, so the first number a shop owner sees is the smallest, not the
   largest. */
const ORDERED = AD_PRODUCTS.slice().sort((a, b) => a.prices.week1 - b.prices.week1);

/* Which line of the guide sheet points at which product. */
const GUIDE = [
  { key: 'guideMaxReach', id: 'slider' },
  { key: 'guideCategory', id: 'catSlider' },
  { key: 'guideBudget',   id: 'mini' },
  { key: 'guideStory',    id: 'story' },
  { key: 'guideEvent',    id: 'event' },
];

/**
 * A wireframe of the phone with this product's slot lit in gold.
 * Seeing where the ad lands beats three lines of prose, and it costs
 * nothing but a few divs — no images, no libraries.
 */
function placement(productId) {
  const row = (cls, style = '') => `<span class="ph-row ${cls}" style="${style}"></span>`;
  const lit = (style = '') => `<span class="ph-row ph-ad" style="${style}"></span>`;
  const cats = `<span class="ph-row ph-cats">${'<i></i>'.repeat(5)}</span>`;

  const screens = {
    slider: [row('ph-bar'), lit('height:34px'), cats, row('ph-block', 'height:22px'), row('ph-block', 'height:22px')],
    mini:   [row('ph-bar'), row('ph-block', 'height:26px'), cats, lit('height:15px'), row('ph-block', 'height:22px')],
    story:  [row('ph-bar'), row('ph-line'), row('ph-block', 'height:20px'), lit('height:20px'), row('ph-block', 'height:20px')],
    event:  [row('ph-bar'), row('ph-line'), lit('height:24px'), row('ph-block', 'height:20px'), row('ph-block', 'height:20px')],
    // a category page: the chips first, then the strip that was bought
    catSlider: [row('ph-bar'), cats, lit('height:30px'), row('ph-block', 'height:22px'), row('ph-block', 'height:22px')],
  };
  const where = { slider: 'placeSlider', mini: 'placeMini', story: 'placeStory',
                  event: 'placeEvent', catSlider: 'placeCatSlider' };

  return `<div class="ad-preview">
    <div class="ph">${(screens[productId] || screens.slider).join('')}<span class="ph-nav"></span></div>
    <div class="ad-preview-key">
      <span class="ad-here">${t('adHere')}</span>
      <span class="ad-where">${t(where[productId] || 'placeSlider')}</span>
    </div>
  </div>`;
}

/** The bullet list that replaces the single description line. */
function points(productId) {
  const list = t(productId + 'Points');
  if (!Array.isArray(list)) return '';
  return `<ul class="ad-points">${list.map(p => `<li>${icon('check', 14)}<span>${p}</span></li>`).join('')}</ul>`;
}

/**
 * How much of this placement is left, read off the running orders.
 *
 * Saying it out loud does two jobs: it stops us overselling a surface
 * until it is worth nothing to anybody on it, and scarcity that is true
 * is the most honest reason to buy this week rather than next.
 */
function availabilityLine(p) {
  const perCat = !!p.perCat;
  const left = perCat ? null : S.adSlotsLeft(p.id);
  const total = S.adCapacity(p.id);
  if (perCat) {
    return `<div class="ad-avail">${icon('grid', 14)} ${t('slotsPerCat').replace('{n}', total)}</div>`;
  }
  if (left > 0) {
    return `<div class="ad-avail">${icon('checkCircle', 14)}
      ${t('slotsLeft').replace('{left}', left).replace('{total}', total)}</div>`;
  }
  const free = S.adNextFreeAt(p.id);
  return `<div class="ad-avail full">${icon('clock', 14)}
    ${t('slotsFull')}${free ? ' — ' + t('slotsNextFree').replace('{d}', fmtDate(free)) : ''}
    <button class="link-gold" data-wait="${p.id}">${t('joinWaitlist')}</button></div>`;
}

export function AdvertiseScreen(root, params) {
  renderHeader({ simple: true, title: t('advertiseTitle') });

  let step = 1;
  // ORDERED[0] is the cheapest — the default when no product is named.
  let product = AD_PRODUCTS.find(p => p.id === params[0]) || ORDERED[0];
  let duration = DURATIONS[0];
  // only the per-category slider needs one; the rest ignore it
  let adCat = CATEGORIES.filter(c => !c.route)[0].id;
  const content = { bizName: '', tagline: '', ctaText: '', image: '' };

  const shell = document.createElement('div');
  root.appendChild(shell);

  const price = () => product.prices[duration.id];

  function paintSteps() {
    return `<div class="steps">${[1, 2, 3, 4].map(i => `<span class="step-dot ${i <= step ? 'done' : ''}"></span>`).join('')}</div>`;
  }

  function render() {
    // Every later step quotes a number, so a session that ends mid-flow drops
    // back to the catalogue rather than showing prices to a visitor.
    if (step > 1 && step < 5 && !showsPrices()) step = 1;

    if (step === 1) {
      const paid = showsPrices();
      // A visitor sees the whole catalogue — every package, every benefit and
      // the placement diagram — with only the numbers withheld. Hiding the
      // value along with the price would leave no reason to sign up.
      shell.innerHTML = `${paid ? paintSteps() : ''}
        <div class="pad mt-16">
          <div class="section-title">${t('advertiseTitle')}<small>${t('advertiseSub')}</small></div>
          <div class="mt-12" id="prods">
            ${ORDERED.map(p => `
              <div class="ad-card ${p.id === product.id ? 'selected' : ''}" data-group="${p.id}">
                <button class="price-card" data-p="${p.id}" aria-expanded="${p.id === product.id}">
                  <span class="price-radio"></span>
                  <span><span class="price-name">${icon(p.icon, 18)} ${t(p.nameKey)}</span>
                  <span class="price-desc">${t(p.descKey)}</span></span>
                  ${paid ? `<span class="price-amt">${fmtMoney(p.prices.week1)}+</span>` : ''}
                </button>
                ${availabilityLine(p)}
                <div class="ad-more"><div class="ad-more-inner">
                  ${placement(p.id)}
                  ${points(p.id)}
                  ${paid
                    ? `<button class="btn btn-gold btn-block mt-12" data-start="${p.id}">${t('startFrom')}
                         <span class="ltr">${fmtMoney(p.prices.week1)}</span></button>`
                    : `<button class="btn btn-gold btn-block mt-12" data-pricegate="#/advertise/${p.id}">${t('seePriceStart')}</button>
                       <div class="ad-gate-note">${t('seePriceNote')}</div>`}
                </div></div>
              </div>`).join('')}
          </div>

          <button class="ad-guide-link" id="guideBtn">${icon('help', 17)} ${t('whichSuitsMe')}</button>
        </div>`;

      // Tapping a card selects it and opens it in place; the others fold.
      // Selecting never deselects: the button that moves the flow forward lives
      // inside the open package, so an all-folded screen would be a dead end.
      const select = (id) => {
        product = AD_PRODUCTS.find(p => p.id === id) || product;
        $$('#prods .ad-card').forEach(c => {
          const on = c.dataset.group === product.id;
          c.classList.toggle('selected', on);
          c.querySelector('.price-card').setAttribute('aria-expanded', String(on));
        });
      };
      $$('#prods .price-card').forEach(b => b.addEventListener('click', () => select(b.dataset.p)));
      $$('#prods [data-start]').forEach(b => b.addEventListener('click', () => {
        select(b.dataset.start);
        step = 2; render();
      }));

      $('#guideBtn').addEventListener('click', () => openSheet(`
        <div class="sheet-title">${t('guideTitle')}</div>
        <div class="sheet-sub">${t('guideSub')}</div>
        ${GUIDE.map(g => {
          const p = AD_PRODUCTS.find(x => x.id === g.id);
          return `<button class="guide-row" data-g="${g.id}">
            <span class="g-ico">${icon(p.icon, 20)}</span>
            <span class="g-txt"><b>${t(g.key)}</b><span>${t(p.nameKey)}</span></span>
            <span class="chev">${icon(document.documentElement.dir === 'rtl' ? 'chevronL' : 'chevronR', 18)}</span>
          </button>`;
        }).join('')}
        <button class="btn btn-ghost btn-block mt-12" data-close>${t('close')}</button>
      `, (panel) => {
        panel.querySelectorAll('[data-g]').forEach(b => b.addEventListener('click', () => {
          closeSheet();
          select(b.dataset.g);
          $(`#prods .ad-card[data-group="${b.dataset.g}"]`).scrollIntoView({ block: 'center', behavior: 'smooth' });
        }));
        panel.querySelector('[data-close]').addEventListener('click', closeSheet);
      }));

      /* A full placement must not simply turn a buyer away: take the name
         and call them when a slot frees. */
      $$('#prods [data-wait]').forEach(b => b.addEventListener('click', (e) => {
        e.stopPropagation();
        const prod = AD_PRODUCTS.find(x => x.id === b.dataset.wait);
        openSheet(`
          <div class="sheet-title">${t('joinWaitlist')}</div>
          <div class="sheet-sub">${t('waitlistSub').replace('{p}', t(prod.nameKey))}</div>
          <div class="field"><label class="label">${t('adBizName')}</label><input class="input" id="wlName" /></div>
          <div class="field"><label class="label">${t('phoneLabel')}</label><input class="input" id="wlPhone" inputmode="tel" /></div>
          <div class="field"><label class="label">${t('waitlistWhen')}</label><input class="input" id="wlWhen" placeholder="${t('waitlistWhenHint')}" /></div>
          <button class="btn btn-gold btn-block" id="wlGo">${t('joinWaitlist')}</button>
        `, (panel) => {
          panel.querySelector('#wlGo').addEventListener('click', () => {
            const name = panel.querySelector('#wlName').value.trim();
            const phone = panel.querySelector('#wlPhone').value.trim();
            if (!name || !phone) { toast(t('required'), 'err'); return; }
            S.joinAdWaitlist({ product: prod.id, name, phone,
                              preferred: panel.querySelector('#wlWhen').value.trim() });
            closeSheet();
            toast(t('waitlistDone'), 'ok');
          });
        });
      }));

      wirePriceGates(shell);

    } else if (step === 2) {
      shell.innerHTML = `${paintSteps()}
        <div class="pad mt-16">
          <div class="section-title">${t('duration')}<small>${t(product.nameKey)}</small></div>
          ${product.perCat ? `<div class="field mt-12"><label class="label">${t('adWhichCat')}</label>
            <select class="select" id="adCat">${CATEGORIES.filter(c => !c.route).map(c =>
              `<option value="${c.id}" ${c.id === adCat ? 'selected' : ''}>${t(c.key)} — ${S.adSlotsLeft('catSlider', c.id)}/${S.adCapacity('catSlider')}</option>`).join('')}</select>
            <div class="hint">${t('adWhichCatHint')}</div></div>` : ''}
          <div class="mt-12" id="durs">
            ${DURATIONS.map(d => `
              <button class="price-card ${d.id === duration.id ? 'selected' : ''}" data-d="${d.id}">
                <span class="price-radio"></span>
                <span><span class="price-name">${t(d.key)}</span></span>
                <span class="price-amt">${fmtMoney(product.prices[d.id])}</span>
              </button>`).join('')}
          </div>
          <button class="btn btn-gold btn-block mt-12" id="next2">${t('next')}</button>
          <button class="btn btn-ghost btn-block mt-8" id="back2">${t('back')}</button>
        </div>`;
      $$('#durs .price-card').forEach(b => b.addEventListener('click', () => {
        duration = DURATIONS.find(d => d.id === b.dataset.d);
        $$('#durs .price-card').forEach(x => x.classList.toggle('selected', x === b));
      }));
      const catSel = $('#adCat');
      if (catSel) catSel.addEventListener('change', () => { adCat = catSel.value; });
      $('#next2').addEventListener('click', () => {
        if (product.perCat && S.adSlotsLeft('catSlider', adCat) <= 0) { toast(t('slotsFull'), 'err'); return; }
        step = 3; render();
      });
      $('#back2').addEventListener('click', () => { step = 1; render(); });

    } else if (step === 3) {
      shell.innerHTML = `${paintSteps()}
        <div class="pad mt-16">
          <div class="section-title">${t('adContent')}</div>
          <div class="field mt-12"><label class="label">${t('adBizName')}</label><input class="input" id="aName" value="${content.bizName}" /></div>
          <div class="field"><label class="label">${t('adTagline')}</label><input class="input" id="aTag" value="${content.tagline}" /></div>
          <div class="field"><label class="label">${t('adCtaText')}</label><input class="input" id="aCta" placeholder="${t('call')}" value="${content.ctaText}" /></div>
          <div class="field"><label class="label">${t('photosLabel')}</label><div id="adPh"></div></div>
          <button class="btn btn-gold btn-block mt-12" id="next3">${t('reviewOrder')}</button>
          <button class="btn btn-ghost btn-block mt-8" id="back3">${t('back')}</button>
        </div>`;
      const pic = mountPhotoPicker($('#adPh'), content.image ? [content.image] : [], 0, 1);
      $('#back3').addEventListener('click', () => { step = 2; render(); });
      $('#next3').addEventListener('click', () => {
        content.bizName = $('#aName').value.trim();
        content.tagline = $('#aTag').value.trim();
        content.ctaText = $('#aCta').value.trim() || t('call');
        content.image = pic.photos[0] || '';
        if (!content.bizName) { toast(t('required'), 'err'); return; }
        step = 4; render();
      });

    } else if (step === 4) {
      shell.innerHTML = `${paintSteps()}
        <div class="pad mt-16">
          <div class="section-title">${t('reviewOrder')}</div>
          <div class="card mt-12" style="padding:14px">
            <div class="info-row"><span class="i-ico">${icon(product.icon, 21)}</span>
              <div class="i-txt"><b>${t(product.nameKey)}</b><span>${t(product.descKey)}</span></div></div>
            <div class="info-row"><span class="i-ico">${icon('calendar', 21)}</span>
              <div class="i-txt"><b>${t(duration.key)}</b><span>${t('duration')}</span></div></div>
            ${product.perCat ? `<div class="info-row"><span class="i-ico">${icon('grid', 21)}</span>
              <div class="i-txt"><b>${t((CATEGORIES.find(c => c.id === adCat) || {}).key || 'catAll')}</b><span>${t('adWhichCat')}</span></div></div>` : ''}
            <div class="info-row" style="border:none"><span class="i-ico">${icon('megaphone', 21)}</span>
              <div class="i-txt"><b>${content.bizName}</b><span>${content.tagline || '—'}</span></div></div>
          </div>

          <div class="row-between mt-16" style="padding:0 4px">
            <span style="font-weight:700">${t('total')}</span>
            <span style="font-size:22px;font-weight:700;color:var(--gold-bright)">${fmtMoney(price())}</span>
          </div>

          <div class="field mt-16"><label class="label">${t('paymentMethods')}</label>
            <div class="card" style="padding:12px;display:flex;align-items:center;gap:10px">
              ${icon('creditCard', 21)}<span class="fs-13">•••• 4242</span>
              <span class="ad-label" style="margin-inline-start:auto">DEMO</span></div></div>

          <button class="btn btn-gold btn-block mt-12" id="payBtn">${icon('creditCard', 20)} ${t('payNow')} ${fmtMoney(price())}</button>
          <button class="btn btn-ghost btn-block mt-8" id="back4">${t('back')}</button>
        </div>`;
      $('#back4').addEventListener('click', () => { step = 3; render(); });
      $('#payBtn').addEventListener('click', async (e) => {
        if (!S.requireTier(2, '#/advertise/' + product.id, go)) return;
        e.target.innerHTML = `<span class="spinner"></span> ${t('paying')}`;
        await S.chargeCard(price(), 'ARABNA ad placement');
        S.addAdOrder({ product: product.id, duration: duration.id, price: price(),
                       cat: product.perCat ? adCat : '',
                       bizName: content.bizName, tagline: content.tagline,
                       ctaText: content.ctaText, image: content.image });
        step = 5; render();
      });

    } else {
      shell.innerHTML = `
        <div class="pad" style="margin-top:60px">
          <div class="center-col">
            <div class="empty-ico" style="width:84px;height:84px;color:#7FC3A1;border-color:rgba(78,139,107,.4);background:rgba(78,139,107,.1)">${icon('checkCircle', 42)}</div>
            <b style="font-size:19px">${t('adSubmitted')}</b>
            <span class="muted fs-13" style="max-width:280px;margin-top:6px">${t('adSubmittedSub')}</span>
            <button class="btn btn-gold mt-20" data-route="#/home">${t('backHome')}</button>
            <button class="btn btn-ghost mt-8" data-route="#/my-ads">${t('myAds')}</button>
          </div>
        </div>`;
      wireRoutes(shell);
    }
  }

  render();
}

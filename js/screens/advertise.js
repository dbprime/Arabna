/* ======================= ADVERTISE PURCHASE FLOW ======================= */
import { t, icon, $, $$, go, renderHeader, toast, wireRoutes, fmtMoney } from '../ui.js';
import { AD_PRODUCTS } from '../data.js';
import * as S from '../store.js';
import { mountPhotoPicker } from './marketplace.js';

const DURATIONS = [
  { id: 'week1', key: 'week1' },
  { id: 'week2', key: 'week2' },
  { id: 'month1', key: 'month1' },
];

export function AdvertiseScreen(root, params) {
  renderHeader({ simple: true, title: t('advertiseTitle') });

  let step = 1;
  let product = AD_PRODUCTS.find(p => p.id === (params[0] || 'slider')) || AD_PRODUCTS[0];
  let duration = DURATIONS[0];
  const content = { bizName: '', tagline: '', ctaText: '', image: '' };

  const shell = document.createElement('div');
  root.appendChild(shell);

  const price = () => product.prices[duration.id];

  function paintSteps() {
    return `<div class="steps">${[1, 2, 3, 4].map(i => `<span class="step-dot ${i <= step ? 'done' : ''}"></span>`).join('')}</div>`;
  }

  function render() {
    if (step === 1) {
      shell.innerHTML = `${paintSteps()}
        <div class="pad mt-16">
          <div class="section-title">${t('advertiseTitle')}<small>${t('advertiseSub')}</small></div>
          <div class="mt-12" id="prods">
            ${AD_PRODUCTS.map(p => `
              <button class="price-card ${p.id === product.id ? 'selected' : ''}" data-p="${p.id}">
                <span class="price-radio"></span>
                <span><span class="price-name">${icon(p.icon, 18)} ${t(p.nameKey)}</span>
                <span class="price-desc">${t(p.descKey)}</span></span>
                <span class="price-amt">${fmtMoney(p.prices.week1)}+</span>
              </button>`).join('')}
          </div>
          <button class="btn btn-gold btn-block mt-12" id="next1">${t('next')}</button>
        </div>`;
      $$('#prods .price-card').forEach(b => b.addEventListener('click', () => {
        product = AD_PRODUCTS.find(p => p.id === b.dataset.p);
        $$('#prods .price-card').forEach(x => x.classList.toggle('selected', x === b));
      }));
      $('#next1').addEventListener('click', () => { step = 2; render(); });

    } else if (step === 2) {
      shell.innerHTML = `${paintSteps()}
        <div class="pad mt-16">
          <div class="section-title">${t('duration')}<small>${t(product.nameKey)}</small></div>
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
      $('#next2').addEventListener('click', () => { step = 3; render(); });
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

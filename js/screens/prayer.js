/* ============================================================
   ARABNA — شاشة مواقيت الصلاة
   ------------------------------------------------------------
   Everything on this screen is computed on the device (js/prayer.js)
   and nothing is fetched, so it works with no signal at all — which
   is the state somebody is in when they step outside at sunset and
   want to know whether maghrib has come in.

   The times work ANYWHERE IN THE UNITED STATES: the calculation
   needs a point and a date and nothing else. The DIRECTORY does not
   — it covers Houston and its suburbs — so outside the region the
   "mosques near you" list is hidden and one honest line says what
   is and is not covered. Hidden, never empty.
   ============================================================ */

import { t, arCount, icon, $, $$, go, renderHeader, openSheet, closeSheet, toast, onMinute, fmtTime,
         wireRoutes } from '../ui.js';
import * as S from '../store.js';
import { askForLocation } from './home.js';
import { feastsBlockHtml, suggestWorshipHtml, mountSuggestWorship } from './mass.js';
import { prayerTimes, nextPrayer, minutesNow, fmtPrayer,
         PRAYER_KEYS, IS_PRAYER, METHODS, GROUPED } from '../prayer.js';

const METHOD_KEYS = ['isna', 'mwl', 'makkah', 'jafari'];
const methodLabel = (k) => t('prMethod' + k[0].toUpperCase() + k.slice(1));
const prLabel = (k) => k === 'sunrise' ? t('prSunrise') : t('pr' + k[0].toUpperCase() + k.slice(1));

/** the times for right here, right now, with the reader's own settings */
export function todaysTimes(date = new Date()) {
  const p = S.prayerPoint();
  if (!p) return null;
  return prayerTimes({
    lat: p.lat, lng: p.lng, date,
    method: S.prayerMethod(), asrShadow: S.asrShadow(),
  });
}

/**
 * «ساعتان ودقيقتان» / «2 hours 2 minutes» — never a bare count of minutes.
 *
 * This is the line that made the counted-noun rule worth fixing: it is
 * redrawn every minute on the first screen anybody opens, and it knew only
 * singular-or-plural, so two hours read «2 ساعات» and twelve read
 * «12 ساعات». arCount() carries all four Arabic cases and both English
 * ones, so there is no `if (lang)` left here either.
 *
 * A zero part is still never printed: «باقي 5 ساعات», not «5 ساعات و0 دقيقة».
 */
export function fmtLeft(mins) {
  const m = Math.max(0, Math.round(mins));
  const h = Math.floor(m / 60), r = m % 60;
  const ar = S.state.lang !== 'en';
  const sep = ar ? ' ' + t('and') : ' ';
  if (!h) return arCount(r, t('plMinute'));
  if (!r) return arCount(h, t('plHour'));
  return arCount(h, t('plHour')) + sep + arCount(r, t('plMinute'));
}

/**
 * The one line under the header on Home. It is the whole hook: the next
 * prayer and how long is left, and one tap onto the full screen.
 *
 * It rides the app's existing minute ticker — there is exactly one timer
 * in this app and this does not add a second.
 */
/** true between «سماح» and the point landing — see `locating` in home.js */
export function prayerLocating() { return S.geoPending(); }

/**
 * Asked once, on the first Home. Whatever the answer it is never asked
 * again, and `#/prayer` stays in the drawer for whoever wants it — this
 * card is about the strip on Home and nothing else.
 */
export function prayerAskHtml() {
  return `<div class="pr-ask" id="prAsk">
    <div class="pr-ask-txt">${icon('moon', 19)}<span>${t('prAskHome')}</span></div>
    <div class="pr-ask-btns">
      <button class="btn btn-gold btn-sm" id="prAskYes">${t('yes')}</button>
      <button class="btn btn-ghost btn-sm" id="prAskNo">${t('prAskNo')}</button>
    </div>
  </div>`;
}
export function mountPrayerAsk(root) {
  const box = root.querySelector('#prAsk');
  if (!box) return;
  const answer = (on) => { S.setPrayerBarPref(on); window.dispatchEvent(new HashChangeEvent('hashchange')); };
  box.querySelector('#prAskYes').addEventListener('click', () => answer(true));
  box.querySelector('#prAskNo').addEventListener('click', () => answer(false));
}

export function prayerBarHtml() {
  /* Not asked yet → the question. Answered «no» → nothing at all, and
     never asked again. */
  if (!S.prayerBarAsked()) return prayerAskHtml();
  if (S.prayerBarPref() === false) return '';
  const times = todaysTimes();
  if (!times) {
    /* THE THIRD STATE. There were two — times, or «حدّد موقعك» — and
       nothing in between, so somebody who pressed «سماح» went on looking
       at the very screen they had just pressed, and concluded their tap
       had not registered. A still screen was half the fault. Same row,
       same height, so nothing jumps when it resolves. */
    if (prayerLocating()) {
      return `<span class="pr-bar unset" aria-live="polite">
        <span class="spinner sm"></span><span>${t('prLocating')}</span></span>`;
    }
    return `<button class="pr-bar unset" data-route="#/prayer">
      ${icon('moon', 17)}<span>${t('prNoLocation')}</span></button>`;
  }
  return `<button class="pr-bar" id="prBar" data-route="#/prayer">${prayerBarInner(times)}</button>`;
}

function prayerBarInner(times) {
  const nx = nextPrayer(times, minutesNow());
  if (!nx) return `${icon('moon', 17)}<span>${t('prayerTitle')}</span>`;
  return `${icon('moon', 17)}
    <span class="pr-bar-name">${prLabel(nx.key)}</span>
    <span class="pr-bar-at ltr">${fmtPrayer(nx.at, S.state.lang)}</span>
    <span class="pr-bar-left">${t('prIn')} ${fmtLeft(nx.in)}</span>`;
}

/** keep the bar honest without a second timer and without a re-render */
export function mountPrayerBar() {
  const bar = $('#prBar');
  if (!bar) return;
  onMinute(bar, () => {
    const times = todaysTimes();
    if (times) bar.innerHTML = prayerBarInner(times);
  });
}

/* ------------------------------------------------------------
   RAMADAN — the same maghrib, wearing the name people use for it

   Iftar IS maghrib. The engine already computes it to the minute
   with the reader's own method, so this costs no arithmetic, no
   second timer and no new setting — it re-labels one number and
   counts down to it. The two buttons are what somebody actually
   wants at that moment: somewhere open for suhoor, and a mosque
   holding a communal iftar.

   It appears only while the owner has switched the season on
   (admin → settings), and it goes away with it.
   ------------------------------------------------------------ */
export function ramadanOn() { return S.seasonOn('ramadan') && !!S.state.seasons.ramadan; }

export function ramadanBarHtml() {
  if (!ramadanOn()) return '';
  const times = todaysTimes();
  if (!times) return '';
  return `<div class="rm-bar" id="rmBar">${ramadanBarInner(times)}</div>`;
}

function ramadanBarInner(times) {
  const m = times.maghrib;
  const now = minutesNow();
  /* After sunset the countdown is over for today, and a bar reading
     «باقي -20 دقيقة» is worse than one that simply says the time. */
  const left = m == null ? null : Math.round(m - now);
  return `<div class="rm-line">
      ${icon('moon', 17)}
      <span class="rm-name">${t('rmIftar')}</span>
      <span class="rm-at ltr">${m == null ? '—' : fmtPrayer(m, S.state.lang)}</span>
      ${left != null && left > 0
        ? `<span class="rm-left">${t('rmLeft')} ${fmtLeft(left)}</span>`
        : `<span class="rm-left">${t('rmDone')}</span>`}
    </div>
    ${rmButtons()}`;
}

/**
 * The two doorways — and the attribute is the question, not the category.
 * Pinning suhoor to «مطاعم» measured ZERO: the one listing that carries it
 * is a bakery, which is exactly who is open at 3am, and the category
 * filter was hiding the only right answer.
 *
 * A button whose filter returns nothing is not drawn at all. That is the
 * standing rule — a filter is never offered with nothing behind it — and
 * here it doubles as the honest state before Rai fills the season in.
 */
function rmButtons() {
  const n = (a) => S.allBusinesses().filter(b => (b.attributes || []).includes(a)).length;
  const btn = (a, ico, key) => n(a)
    ? `<button class="mini-btn" data-route="#/directory?attrs=${a}">${icon(ico, 15)} ${t(key)}</button>` : '';
  const both = btn('suhoor', 'sunrise', 'rmSuhoor') + btn('iftar', 'users', 'rmCommunal');
  return both ? `<div class="rm-btns">${both}</div>` : '';
}

/** the same minute ticker as the prayer bar — still one timer in the app */
export function mountRamadanBar(root) {
  const bar = $('#rmBar');
  if (!bar) return;
  onMinute(bar, () => {
    const times = todaysTimes();
    if (times) {
      bar.innerHTML = ramadanBarInner(times);
      wireRoutes(bar);
    }
  });
}

export function PrayerScreen(root) {
  renderHeader({ simple: true, title: t('prayerTitle') });
  draw(root);
}

function draw(root) {
  const times = todaysTimes();
  const point = S.prayerPoint();
  const covered = S.inCoverage();
  const mosques = S.nearbyMosques(5);
  const grouped = GROUPED[S.prayerMethod()] || [];
  const inGroup = (k) => grouped.find(g => g.includes(k));

  if (!point) {
    // …and the same third state here, in the place the times will occupy
    if (prayerLocating()) {
      root.innerHTML = `
        <div class="pad mt-16">
          <div class="empty" aria-live="polite">
            <div class="empty-ico"><span class="spinner"></span></div>
            <div class="empty-title">${t('prLocating')}</div>
          </div>
        </div>`;
      return;
    }
    root.innerHTML = `
      <div class="pad mt-16">
        <div class="empty">
          <div class="empty-ico">${icon('moon', 40)}</div>
          <div class="empty-title">${t('prNoLocation')}</div>
          <button class="btn btn-gold mt-12" id="prLoc">${icon('navigation', 18)} ${t('useMyLocation')}</button>
          <!-- The second door. The calculation method needs no location at
               all — it is a table of angles — so a reader who will not share
               where they are could still not reach the one setting that was
               already theirs to change. One screen, one button, one dead end. -->
          <button class="btn btn-ghost mt-8" id="prSet0">${icon('settings', 18)} ${t('prSettings')}</button>
        </div>
        ${/* the third door, and the reason it is here as well as below the
             nearby list: knowing a masjid that is missing has nothing to do
             with knowing where you are standing. Somebody who will not share
             their location can still be the person who adds the mosque. */''}
        ${suggestWorshipHtml('mosque')}
      </div>`;
    // …and the prompt says why THIS screen is asking, not why the directory does
    $('#prLoc').addEventListener('click', () => askForLocation(() => go('#/prayer'), 'geoAskPrayer'));
    $('#prSet0').addEventListener('click', () => openPrayerSettings(() => draw(root)));
    mountSuggestWorship(root, 'mosque');
    return;
  }

  const nx = nextPrayer(times, minutesNow());
  root.innerHTML = `
    <div class="pad mt-16">
      <div class="pr-next" id="prNext">${nextCardHtml(nx)}</div>

      <div class="pr-list">
        ${PRAYER_KEYS.map(k => {
          const g = inGroup(k);
          return `<div class="pr-row ${IS_PRAYER[k] ? '' : 'sun'} ${nx && nx.key === k && !nx.tomorrow ? 'next' : ''}">
            <span class="pr-row-name">${prLabel(k)}${
              g && g[0] === k ? `<span class="pr-group">${t('prGrouped')}</span>` : ''}</span>
            <span class="pr-row-at ltr">${fmtPrayer(times[k], S.state.lang)}</span>
          </div>`;
        }).join('')}
      </div>
      ${PRAYER_KEYS.some(k => times[k] === null)
        ? `<div class="hint mt-8">${icon('info', 15)} ${t('prUndefined')}</div>` : ''}

      <div class="hint mt-12">${icon('info', 15)} ${t('prCalcNote')}</div>
      <button class="btn btn-ghost btn-block mt-12" id="prSet">${icon('settings', 18)} ${t('prSettings')}</button>

      ${covered ? `
        <div class="section-title mt-20">${t('prNearbyMosques')}</div>
        <div class="list">
          ${mosques.map(m => `
            <button class="list-row" data-route="#/directory/${m.id}">
              <span class="row-ico">${icon('moon', 20)}</span>
              <span class="row-main">
                <span class="row-title">${S.state.lang === 'en' ? (m.name.en || m.name.ar) : (m.name.ar || m.name.en)}</span>
                <span class="row-sub">${jumuahLine(m)}</span>
              </span>
            </button>`).join('')}
        </div>`
        : `<div class="hint mt-16">${icon('info', 15)} ${t('prOutside')}</div>`}

      ${/* the same door as #/mass, and the same rule: a stranger adds the
           place, never its times */''}
      ${suggestWorshipHtml('mosque')}

      ${/* the same block as #/mass, imported rather than copied: the
           calendar belongs to both screens and is hidden from neither */''}
      ${feastsBlockHtml('islam')}
    </div>`;

  $('#prSet').addEventListener('click', () => openPrayerSettings(() => draw(root)));
  mountSuggestWorship(root, 'mosque');
  // one ticker, the app's own: the card counts down without a second timer
  const card = $('#prNext');
  onMinute(card, () => {
    const now = todaysTimes();
    card.innerHTML = nextCardHtml(nextPrayer(now, minutesNow()));
  });
}

function nextCardHtml(nx) {
  if (!nx) return `<div class="pr-next-name">${t('prayerTitle')}</div>`;
  return `<div class="pr-next-label">${t('prNext')}${nx.tomorrow ? ' · ' + t('prTomorrow') : ''}</div>
    <div class="pr-next-name">${prLabel(nx.key)}</div>
    <div class="pr-next-at ltr">${fmtPrayer(nx.at, S.state.lang)}</div>
    <div class="pr-next-left">${t('prIn')} ${fmtLeft(nx.in)}</div>`;
}

/** the mosque's own Friday time, or the truth that we do not have it */
export function jumuahLine(b) {
  const w = b.worship;
  const list = w && w.jumuah && w.jumuah.length ? w.jumuah : null;
  return list
    ? `${t('jumuahTime')}: <span class="ltr">${list.map(fmtTime).join(' · ')}</span>`
    : t('prNoJumuah');
}

/**
 * The method is a setting because the community is not one community.
 * The labels are METHOD names — ISNA, Umm al-Qura, Jafari — never the
 * name of a school or a sect: that is what every prayer app does, whoever
 * wants the Jafari method finds it in one tap, and the app never takes a
 * side it has no business taking.
 */
export function openPrayerSettings(after) {
  const m = S.prayerMethod(), a = S.asrShadow();
  openSheet(`
    <div class="sheet-title">${t('prSettings')}</div>
    <div class="label mt-12">${t('prMethod')}</div>
    <div class="attr-pick" id="prM">
      ${METHOD_KEYS.map(k => `<button class="chip ${m === k ? 'active' : ''}" data-m="${k}">${methodLabel(k)}</button>`).join('')}
    </div>
    <div class="label mt-16">${t('prAsrSchool')}</div>
    <div class="attr-pick" id="prA">
      <button class="chip ${a === 1 ? 'active' : ''}" data-a="1">${t('prAsrStandard')}</button>
      <button class="chip ${a === 2 ? 'active' : ''}" data-a="2">${t('prAsrHanafi')}</button>
    </div>

    <div class="label mt-16">${t('prOnHome')}</div>
    <div class="setting-row" style="border:none;padding-inline:0">
      <span class="s-txt"><b>${t('prOnHomeLbl')}</b><span>${t('prOnHomeSub')}</span></span>
      <button class="switch ${S.prayerBarPref() ? 'on' : ''}" id="prHomeSw" role="switch"
              aria-checked="${!!S.prayerBarPref()}"><span class="knob"></span></button>
    </div>
    <!-- The alert switch exists; the delivery does not, and the line under
         it says so. A notification outside the app needs a server, on iOS
         it needs the app added to the home screen, and a CHOSEN TONE
         cannot work on the web at all — the system sound is played. So no
         tone picker: a field promising something we do not have is worse
         than its absence, which is the rule the receipts batch applied to
         «email me a copy». -->
    <div class="setting-row" style="border:none;padding-inline:0">
      <span class="s-txt"><b>${t('prAlertLbl')}</b><span class="gold">${t('prAlertSoon')}</span></span>
      <button class="switch ${S.prayerAlert() ? 'on' : ''}" id="prAlertSw" role="switch"
              aria-checked="${S.prayerAlert()}"><span class="knob"></span></button>
    </div>
    <div class="hint mt-16">${icon('info', 15)} ${t('prCalcNote')}</div>
    <div class="sheet-foot">
      <button class="btn btn-gold btn-block" id="prDone">${t('apply')}</button>
    </div>
  `, (panel) => {
    panel.querySelectorAll('#prM .chip').forEach(b => b.addEventListener('click', () => {
      S.setPrayerMethod(b.dataset.m);
      panel.querySelectorAll('#prM .chip').forEach(x => x.classList.toggle('active', x === b));
    }));
    panel.querySelectorAll('#prA .chip').forEach(b => b.addEventListener('click', () => {
      S.setAsrShadow(+b.dataset.a);
      panel.querySelectorAll('#prA .chip').forEach(x => x.classList.toggle('active', x === b));
    }));

    const hs = panel.querySelector('#prHomeSw');
    hs.addEventListener('click', () => {
      const on = !S.prayerBarPref();
      S.setPrayerBarPref(on);
      hs.classList.toggle('on', on);
      hs.setAttribute('aria-checked', String(on));
    });
    const as = panel.querySelector('#prAlertSw');
    as.addEventListener('click', () => {
      const on = !S.prayerAlert();
      S.setPrayerAlert(on);
      as.classList.toggle('on', on);
      as.setAttribute('aria-checked', String(on));
    });
    panel.querySelector('#prDone').addEventListener('click', () => {
      closeSheet();
      if (after) after();
    });
  });
}

/**
 * «الوقت غير صحيح؟ صحّحه» — one field, straight into the admin queue and
 * never straight onto the listing. Every mosque has hundreds of people who
 * go every Friday, and one of them fixes this in half a minute.
 */
export function openTimeFix(bizId) {
  openSheet(`
    <div class="sheet-title">${t('prWrongTimeTitle')}</div>
    <div class="sheet-sub">${t('prWrongTimeBody')}</div>
    <div class="field mt-12">
      <input class="input" id="wfIn" placeholder="${t('jumuahTime')}: 1:30 PM" />
    </div>
    <div class="sheet-foot">
      <button class="btn btn-gold btn-block" id="wfGo">${t('send')}</button>
    </div>
  `, (panel) => {
    panel.querySelector('#wfGo').addEventListener('click', () => {
      const v = panel.querySelector('#wfIn').value.trim();
      if (!v) { panel.querySelector('#wfIn').classList.add('input-err'); return; }
      S.reportWorshipTime(bizId, v);
      closeSheet();
      toast(t('prWrongTimeSent'), 'ok');
    });
  });
}

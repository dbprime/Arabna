/* ======================= MASS TIMES =======================
   Rai asked for a churches section in the drawer — «so a Christian feels
   there is something here for him». The row is named «مواعيد القداس», not
   «الكنائس»: a church is a building, and «مواقيت الصلاة» beside it names a
   service. The PARALLEL IN THE WORDING is what carries the message; the
   row merely existing does not.

   Two rules govern this screen and neither bends:

   1. WE NEVER ASSIGN A DENOMINATION. «قبطية», «أنطاكية», «ملكية» appear
      only where they are already in the registered name, or where the
      owner declared them after claiming the page. There is no
      denomination field in any form we show. That is the mosque rule
      word for word — one mistake here costs the trust of a whole
      community.
   2. ORDERED BY DISTANCE AND NOTHING ELSE, and no advertising space is
      ever sold on it.
   ========================================================= */
import { t, L, icon, $, $$, go, renderHeader, wireRoutes, distLabelHtml, distText, esc,
         openSheet, closeSheet, toast } from '../ui.js';
import * as S from '../store.js';
import { upcomingFeasts } from '../feasts.js';
import { askForLocation } from './home.js';

const dtFmt = () => (S.state.lang === 'en' ? 'en-US' : 'ar-EG-u-nu-latn');

/** «25 ديسمبر 2026» — Latin digits in both languages, as everywhere else */
function feastDate(d) {
  return d.toLocaleDateString(dtFmt(), {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

/** «الفصح (غربي)» — the tradition only where it distinguishes two dates */
function feastLabel(f) {
  const name = t('feast' + f.id[0].toUpperCase() + f.id.slice(1));
  if (f.tradition === 'west' && f.id === 'christmas') return name;
  if (f.tradition === 'islam' || !f.tradition) return name;
  const trad = { west: 'tradWest', east: 'tradEast', copt: 'tradCopt' }[f.tradition];
  return `${name} (${t(trad)})`;
}

/**
 * THE ONE calendar, shown on `#/mass` and on `#/prayer` alike — it belongs
 * to both and is built once.
 *
 * ORDERED BY DATE, NOT BY RELIGION. One list everybody reads; two lists
 * side by side would separate people on the screen, which is the opposite
 * of what this section is for.
 */
export function feastsBlockHtml(n = 6) {
  /* the two dates Rai announces, if he has: the calendar itself reads
     nothing and is handed them, which is what keeps it dependency-free */
  const list = upcomingFeasts(n, Date.now(), true, S.ramadanDates());
  if (!list.length) return '';
  const anyEstimated = list.some(f => f.estimated);
  return `
    <div class="section-title mt-20">${t('feastsTitle')}</div>
    <div class="list feast-list">
      ${list.map(f => `
        <div class="list-row feast-row">
          <span class="row-ico">${icon(f.tradition === 'islam' ? 'moon' : 'church', 19)}</span>
          <span class="row-main">
            <span class="row-title">${esc(feastLabel(f))}</span>
          </span>
          <span class="feast-at">
            <span class="ltr">${esc(feastDate(f.at))}</span>
            ${f.estimated ? `<span class="feast-est">${t('feastEstimated')}</span>` : ''}
          </span>
        </div>`).join('')}
    </div>
    ${anyEstimated ? `<div class="hint mt-8">${icon('info', 15)} ${t('feastHijriNote')}</div>` : ''}`;
}

/** what a church has published, or the truth that it has not */
export function massLine(b) {
  const sv = S.servicesFor(b);
  if (!sv) return t('massNone');
  const parts = [];
  if (sv.sunday.length) parts.push(`${t('massSunday')}: <span class="ltr">${sv.sunday.map(esc).join(' · ')}</span>`);
  if (sv.weekday.length) parts.push(`${t('massWeekday')}: <span class="ltr">${sv.weekday.map(esc).join(' · ')}</span>`);
  const note = L(sv.note || '');
  if (note) parts.push(esc(note));
  return parts.join('<br>') || t('massNone');
}

export function MassScreen(root) {
  renderHeader({ simple: true, title: t('massTitle') });
  const covered = S.inCoverage();
  const churches = S.nearbyChurches(5);

  root.innerHTML = `
    <div class="pad mt-16">
      <div class="section-title">${t('massTitle')}<small>${t('massSub')}</small></div>

      ${!S.prayerPoint() ? `
        <div class="empty mt-12">
          <div class="empty-ico">${icon('mapPin', 34)}</div>
          <div class="empty-title">${t('massNoLocation')}</div>
          <button class="btn btn-gold mt-12" id="msLoc">${icon('navigation', 18)} ${t('useMyLocation')}</button>
        </div>`
      /* Outside Greater Houston the block is HIDDEN rather than empty —
         the same rule «مساجد قريبة» follows in Dallas, from V.03.1. The
         calendar below is arithmetic and works anywhere. */
      : covered && churches.length ? `
        <div class="section-title mt-16">${t('massNearby')}</div>
        <div class="list">
          ${churches.map(c => `
            <button class="list-row" data-route="#/directory/${esc(c.id)}">
              <span class="row-ico">${icon('church', 20)}</span>
              <span class="row-main">
                <span class="row-title">${esc(L(c.name))}</span>
                <span class="row-sub">${massLine(c)}</span>
              </span>
              ${distLabelHtml(c) ? `<span class="feast-at"><span class="ltr">${distLabelHtml(c)}</span></span>` : ''}
            </button>`).join('')}
        </div>
        <div class="hint mt-12">${icon('info', 15)} ${t('massCalcNote')}</div>`
      : `<div class="hint mt-16">${icon('info', 15)} ${t('massOutside')}</div>`}

      ${suggestWorshipHtml('church')}

      ${feastsBlockHtml()}
    </div>
    <div style="height:20px"></div>`;

  const loc = $('#msLoc');
  if (loc) loc.addEventListener('click', () => askForLocation(() => go('#/mass'), 'geoAskMass'));
  mountSuggestWorship(root, 'church');
  wireRoutes(root);
}

/* ------------------------------------------------------------
   «Do you know a mosque that is not here?»

   Rai wanted anybody to be able to add one, reviewed before it goes live,
   «so everybody works for the app without feeling it». The machinery
   already exists — `#/add-business`, the admin queue, `findDuplicates()`
   on phone, name and address, and a merge button in the panel — so what
   was missing is a DOOR, not a system.

   The door is here and NOT in the bottom «+» button: that one is for
   commercial listings and advertisements, and mixing the two dirties
   both.

   AND THE LINE THAT MATTERS MOST IN THIS WHOLE ITEM: a stranger adds the
   PLACE, never its TIMES.

     a stranger may add   name · address · phone · category
     only its own people  adhan · iqama · jumuah · mass

   A wrong time makes people arrive late to their prayer, and the harm
   lands on us rather than on whoever typed it. So the form has three
   fields, twenty seconds, and no time field at all — «without feeling
   it» is only true when the ask is that short.
   ------------------------------------------------------------ */
export function suggestWorshipHtml(kind) {
  return `<div class="suggest-box mt-16">
    <span class="suggest-txt">${t(kind === 'church' ? 'sgChurchAsk' : 'sgMosqueAsk')}</span>
    <button class="btn btn-ghost btn-sm" data-sg="${kind}">${icon('plus', 16)} ${t(kind === 'church' ? 'sgChurchBtn' : 'sgMosqueBtn')}</button>
  </div>`;
}

export function mountSuggestWorship(root, kind) {
  const btn = root.querySelector(`[data-sg="${kind}"]`);
  if (!btn) return;
  btn.addEventListener('click', () => openSuggestSheet(kind));
}

function openSuggestSheet(kind) {
  openSheet(`
    <div class="sheet-title">${t(kind === 'church' ? 'sgChurchBtn' : 'sgMosqueBtn')}</div>
    <div class="sheet-sub">${t('sgSub')}</div>
    <div class="field mt-12"><label class="label">${t('sgName')}</label>
      <input class="input" id="sgName" /></div>
    <div class="field"><label class="label">${t('sgAddr')}</label>
      <input class="input" id="sgAddr" /></div>
    <div class="field"><label class="label">${t('sgPhone')} <span class="muted">(${t('optional')})</span></label>
      <input class="input ltr" id="sgPhone" inputmode="tel" /></div>
    <div id="sgErr"></div>
    <!-- No denomination field. Not «optional» — ABSENT. Deciding somebody
         else's identity is the one mistake that costs a whole community's
         trust, and it is the same rule that governs the mosques. -->
    <button class="btn btn-gold btn-block mt-12" id="sgSend">${icon('send', 18)} ${t('send')}</button>
  `, (panel) => {
    panel.querySelector('#sgSend').addEventListener('click', () => {
      const name = panel.querySelector('#sgName').value.trim();
      const addr = panel.querySelector('#sgAddr').value.trim();
      const phone = panel.querySelector('#sgPhone').value.trim();
      if (!name || !addr) {
        panel.querySelector('#sgErr').innerHTML =
          `<div class="err-msg">${icon('alert', 15)} ${t('required')}</div>`;
        (!name ? panel.querySelector('#sgName') : panel.querySelector('#sgAddr')).classList.add('input-err');
        return;
      }
      /* The category is set from the door the reader came through, so the
         sender never picks it and never gets it wrong — and `worship`
         makes it non-commercial by the rule in `isNonCommercial`. */
      S.suggestWorship({ name, address: addr, phone, kind });
      closeSheet();
      toast(t('sgThanks'), 'ok');
    });
  });
}

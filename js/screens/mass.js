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
import { t, L, icon, $, $$, go, renderHeader, wireRoutes, distLabel, esc } from '../ui.js';
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
  const list = upcomingFeasts(n);
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
          <div class="empty-title">${t('prNoLocation')}</div>
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
              ${distLabel(c) ? `<span class="feast-at"><span class="ltr">${distLabel(c)}</span></span>` : ''}
            </button>`).join('')}
        </div>
        <div class="hint mt-12">${icon('info', 15)} ${t('massCalcNote')}</div>`
      : `<div class="hint mt-16">${icon('info', 15)} ${t('massOutside')}</div>`}

      ${feastsBlockHtml()}
    </div>
    <div style="height:20px"></div>`;

  const loc = $('#msLoc');
  if (loc) loc.addEventListener('click', () => askForLocation(() => go('#/mass'), 'geoAskMass'));
  wireRoutes(root);
}

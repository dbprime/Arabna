/* ======================= EVENTS ======================= */
import { t, L, icon, $, $$, go, back, renderHeader, toast, wireRoutes,
         emptyState, query, sectionNote } from '../ui.js';
import { getLang } from '../i18n.js';
import { EVENT_TYPES, nextOccurrence } from '../data.js';
import * as S from '../store.js';
import { mountPhotoPicker } from './marketplace.js';

/* ---------- date helpers (Arabic + English, no dependencies) ---------- */

/** "Fri 24 Oct 2026 · 5:00 PM" / "الجمعة ٢٤ أكتوبر ٢٠٢٦ · ٥:٠٠ م" */
export function fmtEventDate(iso, withTime = true) {
  const d = new Date(iso);
  if (isNaN(d)) return iso || '';
  const locale = getLang() === 'ar' ? 'ar-EG' : 'en-US';
  const date = d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
  if (!withTime) return date;
  const time = d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
  return `${date} · ${time}`;
}

/** Today / Tomorrow shortcut for the card, otherwise the short date. */
function whenLabel(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const today = new Date();
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  const tomorrow = new Date(today.getTime() + 86400000);
  const locale = getLang() === 'ar' ? 'ar-EG' : 'en-US';
  const time = d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
  if (sameDay(d, today)) return `${t('eventToday')} · ${time}`;
  if (sameDay(d, tomorrow)) return `${t('eventTomorrow')} · ${time}`;
  return d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' }) + ` · ${time}`;
}

/* ----------------------------- LIST ----------------------------- */
export function EventsScreen(root) {
  renderHeader({});
  const q = query();
  let type = q.type || 'all';
  const all = S.upcomingEvents();

  // only the types that actually have something coming up — the same rule the
  // directory uses, so nobody meets a filter that returns nothing
  const live = EVENT_TYPES.filter(x => all.some(e => (e.type || 'community') === x.id));

  root.innerHTML = `
    <div class="section-head" style="margin-top:14px">
      <div class="section-title">${t('eventsTitle')}<small>${t('eventsSub')}</small></div>
      <button class="link-gold" data-route="#/events/propose">${icon('plus', 17)} ${t('proposeEvent')}</button>
    </div>
    <div class="hscroll" id="evChips">
      <button class="chip ${type === 'all' ? 'active' : ''}" data-type="all">${t('catAll')}</button>
      ${live.map(x => `<button class="chip ${type === x.id ? 'active' : ''}" data-type="${x.id}">
        ${icon(x.icon, 15)} ${t(x.key)}</button>`).join('')}
    </div>
    <div id="evNote"></div>
    <div class="pad mt-12" id="evList"></div>
    <div style="height:18px"></div>`;

  const paint = () => {
    const list = all.filter(e => type === 'all' || (e.type || 'community') === type);
    const sec = EVENT_TYPES.find(x => x.id === type);
    $('#evNote').innerHTML = sectionNote(sec ? t(sec.key) : '', list.length);
    const el = $('#evList');
    el.innerHTML = list.length
      ? list.map(cardHtml).join('')
      : emptyState('calendar', t('emptyEventsTitle'), t('emptyEventsSub'), t('proposeEvent'), '#/events/propose');
    wireRoutes(el);
  };
  paint();

  const active = $('#evChips .chip.active');
  if (active && type !== 'all') active.scrollIntoView({ inline: 'center', block: 'nearest' });

  $$('#evChips .chip').forEach(c => c.addEventListener('click', () => {
    type = c.dataset.type;
    $$('#evChips .chip').forEach(x => x.classList.toggle('active', x === c));
    paint();
  }));
  wireRoutes(root);
}

function cardHtml(e) {
  return `<div class="card ev-card ${e.featured ? 'featured' : ''}" data-route="#/events/${e.id}">
    <div class="ev-cover">
      ${e.photo ? `<img src="${e.photo}" alt="${L(e.title)}" loading="lazy" />` : icon(e.icon || 'calendar', 30)}
      ${e.featured ? `<span class="badge badge-boost" style="position:absolute;inset-block-start:8px;inset-inline-start:8px">${icon('bolt', 12)}${t('featuredEvent')}</span>` : ''}
    </div>
    <div class="ev-body">
      <div class="ev-when">${icon('clock', 13)} ${whenLabel(e.startsAt)}</div>
      <div class="ev-title">${L(e.title)}</div>
      <div class="ev-meta">${icon('mapPin', 13)} ${L(e.venue)} · <span class="ltr">${e.city}</span></div>
      ${typeBadge(e)}
    </div>
  </div>`;
}

/** the extra lines a concert needs, and nothing else has */
function concertBlock(e) {
  const c = e.concert;
  if ((e.type || '') !== 'concert' || !c) return '';
  const rows = [];
  if (c.artist) rows.push([ 'star', c.artist, t('evArtist') ]);
  if (c.doorsAt) rows.push([ 'clock', c.doorsAt, t('evDoors') ]);
  if (c.priceFrom) rows.push([ 'creditCard', '$' + c.priceFrom, t('evPriceFrom') ]);
  if (c.ageLimit) rows.push([ 'user', c.ageLimit, t('evAgeLimit') ]);
  if (c.familySeating) rows.push([ 'users', t('yes'), t('evFamilySeating') ]);
  if (!rows.length) return '';
  return rows.map(([ico, val, label]) => `
    <div class="info-row"><span class="i-ico">${icon(ico, 21)}</span>
      <div class="i-txt"><b class="${/^[$\d]/.test(val) ? 'ltr' : ''}">${val}</b><span>${label}</span></div></div>`).join('');
}

function typeBadge(e) {
  const ty = EVENT_TYPES.find(x => x.id === (e.type || 'community'));
  if (!ty) return '';
  return `<span class="badge badge-cat mt-8">${icon(ty.icon, 12)} ${t(ty.key)}</span>`;
}

/* ---------------------------- DETAIL ---------------------------- */
export function EventScreen(root, params) {
  const e = S.eventById(params[0]);
  if (!e) { go('#/events'); return; }
  renderHeader({ simple: true, title: t('eventsTitle') });

  const past = S.eventIsPast(e);

  root.innerHTML = `
    <div class="ev-hero">
      ${e.photo ? `<img src="${e.photo}" alt="${L(e.title)}" />` : icon(e.icon || 'calendar', 56)}
      ${e.featured ? `<span class="badge badge-boost" style="position:absolute;inset-block-end:12px;inset-inline-start:14px">${icon('bolt', 13)}${t('featuredEvent')}</span>` : ''}
      ${past ? `<span class="badge badge-free" style="position:absolute;inset-block-end:12px;inset-inline-end:14px">${t('eventPast')}</span>` : ''}
    </div>
    <div class="detail-body">
      <div class="detail-title">${L(e.title)}</div>
      ${e.status === 'pending' ? `<div class="list-note" style="margin-inline:0">${icon('clock', 18)}<span>${t('pendingNote')}</span></div>` : ''}

      <div class="info-row"><span class="i-ico">${icon('calendar', 21)}</span>
        <div class="i-txt"><b>${fmtEventDate(e.startsAt)}</b>
          <span>${e.endsAt ? `${t('eventEnds')}: ${fmtEventDate(e.endsAt)}` : t('eventWhen')}</span></div></div>

      <div class="info-row"><span class="i-ico">${icon('mapPin', 21)}</span>
        <div class="i-txt"><b>${L(e.venue)}</b><span class="ltr">${e.city}</span></div></div>

      <div class="info-row"><span class="i-ico">${icon('users', 21)}</span>
        <div class="i-txt"><b>${L(e.organizer)}</b><span>${t('eventOrganizer')}</span></div></div>

      ${concertBlock(e)}

      <p class="fs-13 muted mt-12" style="white-space:pre-wrap">${L(e.desc || '')}</p>

      ${e.ticketUrl
        ? `<a class="btn btn-gold btn-block mt-16" href="${e.ticketUrl}" target="_blank" rel="noopener">
             ${icon('send', 19)} ${t('eventGetTickets')}</a>
           <div class="hint" style="text-align:center;margin-top:8px">${t('evTicketExternal')}</div>`
        : `<div class="list-note" style="margin-inline:0">${icon('info', 18)}<span>${t('eventFree')}</span></div>`}

      <div class="action-grid mt-12">
        <button class="btn btn-ghost btn-sm" id="mapBtn">${icon('navigation', 18)} ${t('directions')}</button>
        <button class="btn btn-ghost btn-sm" id="shareBtn">${icon('share', 18)} ${t('share')}</button>
      </div>
    </div>`;

  $('#mapBtn').addEventListener('click', () =>
    import('../ui.js').then(m => m.openMaps(`${L(e.venue)} ${e.city}`)));
  $('#shareBtn').addEventListener('click', () =>
    import('../ui.js').then(m => m.shareItem(L(e.title), location.href)));
  wireRoutes(root);
}

/* ------------------- PROPOSE / EDIT (shared form) ------------------- */

/**
 * The event form. Organizers reach it at #/events/propose (their event goes
 * to the admin queue); the admin reaches the same form from the panel and
 * publishes directly.
 */
export function EventFormScreen(root, params) {
  const editId = params && params[0] ? params[0] : (query().edit || '');
  const editing = editId ? S.eventById(editId) : null;
  const isAdmin = !!query().admin;

  renderHeader({ simple: true, title: editing ? t('editEvent') : (isAdmin ? t('addEvent') : t('proposeEvent')) });

  if (!isAdmin && !S.requireTier(1, '#/events/propose', go)) return;

  const e = editing || S.blankEvent();

  root.innerHTML = `
    <div class="pad mt-16">
      ${!isAdmin ? `<div class="list-note" style="margin:0 0 14px">${icon('info', 18)}<span>${t('eventProposed')}</span></div>` : ''}

      <div class="field"><label class="label">${t('eventTitleLabel')}</label>
        <input class="input" id="evTitle" value="${attr(L(e.title))}" /></div>

      <div class="field"><label class="label">${t('eventType')}</label>
        <select class="select" id="evType">
          ${EVENT_TYPES.map(x => `<option value="${x.id}" ${(e.type || 'community') === x.id ? 'selected' : ''}>${t(x.key)}</option>`).join('')}
        </select></div>

      <!-- concert-only, revealed by the type above -->
      <div id="evConcert" hidden>
        <div class="field"><label class="label">${t('evArtist')}</label>
          <input class="input" id="cnArtist" value="${attr((e.concert || {}).artist || '')}" /></div>
        <div class="field"><label class="label">${t('evDoors')} <span class="muted">(${t('optional')})</span></label>
          <input class="input" id="cnDoors" type="time" value="${attr((e.concert || {}).doorsAt || '')}" /></div>
        <div class="field"><label class="label">${t('evPriceFrom')} <span class="muted">(${t('optional')})</span></label>
          <input class="input ltr" id="cnPrice" inputmode="decimal" placeholder="35" value="${attr((e.concert || {}).priceFrom || '')}" /></div>
        <div class="field"><label class="label">${t('evAgeLimit')} <span class="muted">(${t('optional')})</span></label>
          <input class="input" id="cnAge" placeholder="${t('evAgeHint')}" value="${attr((e.concert || {}).ageLimit || '')}" /></div>
        <label class="setting-row" style="padding:8px 0;border:none">
          <input type="checkbox" id="cnFamily" ${(e.concert || {}).familySeating ? 'checked' : ''} style="width:18px;height:18px;accent-color:#C6A15B" />
          <span class="s-txt"><b style="font-weight:500;font-size:12.5px">${t('evFamilySeating')}</b></span></label>
        <div class="list-note" style="margin-inline:0">${icon('info', 18)}<span>${t('evTicketNote')}</span></div>
      </div>

      <div class="field"><label class="label">${t('eventStarts')}</label>
        <input class="input" id="evStart" type="datetime-local" value="${attr(e.startsAt)}" /></div>
      <div class="field"><label class="label">${t('eventEnds')} <span class="muted">(${t('optional')})</span></label>
        <input class="input" id="evEnd" type="datetime-local" value="${attr(e.endsAt)}" /></div>

      <div class="field"><label class="label">${t('eventVenue')}</label>
        <input class="input" id="evVenue" value="${attr(L(e.venue))}" /></div>
      <div class="field"><label class="label">${t('cityLabel')}</label>
        <input class="input" id="evCity" value="${attr(e.city || (S.state.location.city + ', ' + S.state.location.state))}" /></div>

      <div class="field"><label class="label">${t('eventOrganizerName')}</label>
        <input class="input" id="evOrg" value="${attr(L(e.organizer))}" /></div>

      <div class="field"><label class="label">${t('eventTicketUrl')} <span class="muted">(${t('optional')})</span></label>
        <input class="input" id="evUrl" inputmode="url" placeholder="https://" value="${attr(e.ticketUrl)}" /></div>

      <div class="field"><label class="label">${t('eventDescLabel')}</label>
        <textarea class="textarea" id="evDesc">${esc(L(e.desc || ''))}</textarea></div>

      <div class="field"><label class="label">${t('eventPhoto')} <span class="muted">(${t('optional')})</span></label>
        <div id="evPh"></div></div>

      ${isAdmin ? `
        <label class="setting-row" style="padding:8px 0;border:none">
          <input type="checkbox" id="evFeat" ${e.featured ? 'checked' : ''} style="width:18px;height:18px;accent-color:#C6A15B" />
          <span class="s-txt"><b style="font-weight:500;font-size:12.5px">${t('featuredEvent')}</b></span></label>

        <div class="field mt-12"><label class="label">${t('evRepeat')}</label>
          <select class="select" id="evRepeat">
            <option value="" ${!e.repeat ? 'selected' : ''}>${t('evRepeatNone')}</option>
            <option value="gregorian" ${e.repeat && e.repeat.kind === 'gregorian' ? 'selected' : ''}>${t('evRepeatGreg')}</option>
            <option value="hijri" ${e.repeat && e.repeat.kind === 'hijri' ? 'selected' : ''}>${t('evRepeatHijri')}</option>
          </select>
          <div class="hint" id="evRepeatHint"></div></div>
        <div class="hint">${t('eventImportNote')}</div>` : ''}

      <button class="btn btn-gold btn-block mt-16" id="evSave">
        ${icon('send', 19)} ${editing ? t('saveChanges') : (isAdmin ? t('addEvent') : t('proposeEvent'))}</button>
    </div>`;

  const pic = mountPhotoPicker($('#evPh'), e.photo ? [e.photo] : [], 0, 1);

  // the artist block belongs to concerts and nothing else
  const typeSel = $('#evType'), concertBox = $('#evConcert');
  const syncType = () => { concertBox.hidden = typeSel.value !== 'concert'; };
  typeSel.addEventListener('change', syncType);
  syncType();

  // show the admin the date the next edition would land on
  const rep = $('#evRepeat');
  const syncRepeat = () => {
    const hint = $('#evRepeatHint');
    if (!rep || !hint) return;
    const start = $('#evStart').value;
    hint.textContent = rep.value && start
      ? t('evNextEdition') + ' ' + fmtEventDate(nextOccurrence(start, rep.value), false)
      : '';
  };
  if (rep) {
    rep.addEventListener('change', syncRepeat);
    $('#evStart').addEventListener('change', syncRepeat);
    syncRepeat();
  }

  $('#evSave').addEventListener('click', () => {
    const title = $('#evTitle').value.trim();
    const start = $('#evStart').value;
    const venue = $('#evVenue').value.trim();
    if (!title || !start || !venue) { toast(t('required'), 'err'); return; }

    const kind = typeSel.value;
    const payload = {
      title: { ar: title, en: title },
      type: kind,
      concert: kind === 'concert' ? {
        artist: $('#cnArtist').value.trim(),
        doorsAt: $('#cnDoors').value,
        priceFrom: $('#cnPrice').value.trim(),
        ageLimit: $('#cnAge').value.trim(),
        familySeating: $('#cnFamily').checked,
      } : null,
      repeat: rep && rep.value ? { kind: rep.value, spawned: (e.repeat && e.repeat.spawned) || [] } : null,
      startsAt: start,
      endsAt: $('#evEnd').value,
      venue: { ar: venue, en: venue },
      city: $('#evCity').value.trim(),
      organizer: { ar: $('#evOrg').value.trim(), en: $('#evOrg').value.trim() },
      ticketUrl: $('#evUrl').value.trim(),
      desc: { ar: $('#evDesc').value.trim(), en: $('#evDesc').value.trim() },
      photo: pic.photos[0] || '',
      featured: isAdmin ? $('#evFeat').checked : false,
      icon: e.icon || 'calendar',
    };

    if (editing) {
      S.updateEvent(editing.id, payload);
      toast(t('eventSaved'), 'ok');
      go(isAdmin ? '#/admin' : '#/events/' + editing.id);
      return;
    }

    const rec = S.addEvent(payload, isAdmin ? 'live' : 'pending');
    if (!rec) { toast(t('storageFull'), 'err'); return; }
    toast(isAdmin ? t('eventSaved') : t('eventProposed'), 'ok');
    go(isAdmin ? '#/admin' : '#/events');
  });
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}
function attr(s) { return esc(s).replace(/"/g, '&quot;'); }

/* ======================= EVENTS ======================= */
import { t, L, icon, $, $$, go, back, renderHeader, toast, wireRoutes, replaceHash,
         emptyState, query, sectionNote, pickerBtn, setPickerValue, openDropdown, ltr,
         sectionSlider, sponsoredRows, historyKey, esc } from '../ui.js';
import { getLang } from '../i18n.js';
import { EVENT_TYPES, nextOccurrence, AD_SLOTS } from '../data.js';
import { startSlider } from './home.js';
import * as S from '../store.js';
import { mountPhotoPicker } from './marketplace.js';

/* ---------- date helpers (Arabic + English, no dependencies) ---------- */

/** "Fri 24 Oct 2026 · 5:00 PM" / "الجمعة 24 أكتوبر 2026 · 5:00 م" */
export function fmtEventDate(iso, withTime = true) {
  const d = new Date(iso);
  if (isNaN(d)) return iso || '';
  const locale = getLang() === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US';
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
  const locale = getLang() === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US';
  const time = d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
  if (sameDay(d, today)) return `${t('eventToday')} · ${time}`;
  if (sameDay(d, tomorrow)) return `${t('eventTomorrow')} · ${time}`;
  /* The year is printed whenever it is not this one. «السبت، 20 فبراير»
     for an event in 2027, read in August 2026, says «that has been and
     gone» — and the detail page had the year all along, so the list was
     the only place saying something untrue. Dropped again for this year,
     where it is noise. */
  const opts = { weekday: 'short', day: 'numeric', month: 'short' };
  if (d.getFullYear() !== today.getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString(locale, opts) + ` · ${time}`;
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
    <!-- eleven types, of which a sideways row showed three -->
    <div class="ctl-row">
      ${pickerBtn({ id: 'ctlType', label: t('lblType'), value: typeLabel(type) })}
    </div>
    <div id="ddHost"></div>

    <!-- slider · two sponsored · the list, the same shape as every section -->
    <div id="secAds"></div>
    <div id="sponRows"></div>

    <div id="evNote"></div>
    <div class="pad mt-12" id="evList"></div>
    <div style="height:18px"></div>`;

  /* The featured pin stays where it is — it is a different product. These
     are the other featured events, labelled, above the list. */
  const paintAds = (sec, list) => {
    const key = historyKey();
    const ads = S.rotate(S.sectionAds('events'), AD_SLOTS.events, key);
    $('#secAds').innerHTML = sectionSlider(ads, {
      product: 'events',
      sectionName: sec ? t(sec.key) : t('eventsTitle'),
    });
    /* ⚠️ THE SAME LIST THE TRACK DREW. `slidesFor` decides once whether
       the house slide is in the rotation, and the rotator is driven by
       the array it is handed — two decisions would draw a slide that is
       never shown. */
    const slides = S.slidesFor('events', ads);
    if (slides.length) startSlider(slides, '#secAds .slider', '#secTrack', '#secDots');
    wireRoutes($('#secAds'));

    const shown = ads.map(a => a.id);
    // the one already pinned at the top of the list is not repeated here
    const pinned = list.find(e => e.featured);
    const pool = list.filter(e => e.featured && (!pinned || e.id !== pinned.id));
    const rows = S.rotate(pool, 2, key, shown).map(e => ({
      id: e.id,
      route: '#/events/' + e.id,
      img: e.photo || '',
      icon: e.icon || 'calendar',
      title: L(e.title),
      sub: fmtEventDate(e.date, false),
    }));
    $('#sponRows').innerHTML = sponsoredRows(rows);
    wireRoutes($('#sponRows'));
  };

  const paint = () => {
    const list = all.filter(e => type === 'all' || (e.type || 'community') === type);
    const sec = EVENT_TYPES.find(x => x.id === type);
    paintAds(sec, list);
    $('#evNote').innerHTML = sectionNote(sec ? t(sec.key) : '', list.length);
    const el = $('#evList');
    el.innerHTML = list.length
      ? list.map(cardHtml).join('')
      : emptyState('calendar', t('emptyEventsTitle'), t('emptyEventsSub'), t('proposeEvent'), '#/events/propose');
    wireRoutes(el);
  };
  paint();

  /* The chosen type lives in the URL, replaced rather than pushed — the
     same rule as the directory, so back leaves the screen. */
  const typeOptions = () => [{ id: 'all', label: t('catAll'), icon: 'calendar', count: all.length }]
    .concat(live.map(x => ({
      id: x.id, label: t(x.key), icon: x.icon,
      count: all.filter(e => (e.type || 'community') === x.id).length,
    })).sort((a, b) => b.count - a.count));

  $('#ctlType').addEventListener('click', () => openDropdown({
    host: $('#ddHost'), anchor: $('#ctlType'), title: t('pickType'), unit: 'ddType',
    options: typeOptions(), value: type,
    onPick: (v) => {
      type = v;
      setPickerValue('ctlType', typeLabel(type));
      replaceHash('#/events' + (type === 'all' ? '' : '?type=' + type));
      paint();
    },
  }));
  wireRoutes(root);
}

/** what the type picker prints */
function typeLabel(id) {
  if (!id || id === 'all') return t('catAll');
  const x = EVENT_TYPES.find(v => v.id === id);
  return x ? t(x.key) : t('catAll');
}

function cardHtml(e) {
  return `<div class="card ev-card ${e.featured ? 'featured' : ''}" data-route="#/events/${e.id}">
    <div class="ev-cover">
      ${e.photo ? `<img src="${esc(e.photo)}" alt="${esc(L(e.title))}" loading="lazy" />` : icon(e.icon || 'calendar', 30)}
      ${e.featured ? `<span class="badge badge-boost" style="position:absolute;inset-block-start:8px;inset-inline-start:8px">${icon('bolt', 12)}${t('featuredEvent')}</span>` : ''}
    </div>
    <div class="ev-body">
      <div class="ev-when">${icon('clock', 13)} ${whenLabel(e.startsAt)}</div>
      <div class="ev-title">${esc(L(e.title))}</div>
      <div class="ev-meta">${icon('mapPin', 13)} ${esc(L(e.venue))} · <span class="ltr">${esc(e.city)}</span></div>
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
  if (c.priceFrom) rows.push([ 'creditCard', ltr('$' + c.priceFrom), t('evPriceFrom') ]);
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
  if (!e) { toast(t('gone'), 'err'); go('#/events'); return; }
  renderHeader({ simple: true, title: t('eventsTitle') });

  const past = S.eventIsPast(e);

  root.innerHTML = `
    <div class="ev-hero">
      ${e.photo ? `<img src="${esc(e.photo)}" alt="${esc(L(e.title))}" />` : icon(e.icon || 'calendar', 56)}
      ${e.featured ? `<span class="badge badge-boost" style="position:absolute;inset-block-end:12px;inset-inline-start:14px">${icon('bolt', 13)}${t('featuredEvent')}</span>` : ''}
      ${past ? `<span class="badge badge-free" style="position:absolute;inset-block-end:12px;inset-inline-end:14px">${t('eventPast')}</span>` : ''}
    </div>
    <div class="detail-body">
      <div class="detail-title">${esc(L(e.title))}</div>
      ${e.status === 'pending' ? `<div class="list-note" style="margin-inline:0">${icon('clock', 18)}<span>${t('pendingNote')}</span></div>` : ''}

      <div class="info-row"><span class="i-ico">${icon('calendar', 21)}</span>
        <div class="i-txt"><b>${fmtEventDate(e.startsAt)}</b>
          <span>${e.endsAt ? `${t('eventEnds')}: ${fmtEventDate(e.endsAt)}` : t('eventWhen')}</span></div></div>

      <div class="info-row"><span class="i-ico">${icon('mapPin', 21)}</span>
        <div class="i-txt"><b>${esc(L(e.venue))}</b><span class="ltr">${esc(e.city)}</span></div></div>

      <div class="info-row"><span class="i-ico">${icon('users', 21)}</span>
        <div class="i-txt"><b>${esc(L(e.organizer))}</b><span>${t('eventOrganizer')}</span></div></div>

      ${concertBlock(e)}

      <p class="fs-13 muted mt-12" style="white-space:pre-wrap">${esc(L(e.desc || ''))}</p>

      ${e.ticketUrl
        ? `<a class="btn btn-gold btn-block mt-16" href="${e.ticketUrl}" target="_blank" rel="noopener">
             ${icon('send', 19)} ${t('eventGetTickets')}</a>
           <div class="hint" style="text-align:center;margin-top:8px">${t('evTicketExternal')}</div>`
        : `<div class="list-note" style="margin-inline:0">${icon('info', 18)}<span>${t('eventFree')}</span></div>`}

      ${!past ? `<button class="btn ${S.isEventSaved(e.id) ? 'btn-outline-gold' : 'btn-ghost'} btn-block mt-12" id="evRemind">
        ${icon('bell', 18)} ${S.isEventSaved(e.id) ? t('eventReminderOn') : t('saveEvent')}</button>` : ''}
      <div class="action-grid mt-12">
        <button class="btn btn-ghost btn-sm" id="mapBtn">${icon('navigation', 18)} ${t('directions')}</button>
        <button class="btn btn-ghost btn-sm" id="shareBtn">${icon('share', 18)} ${t('share')}</button>
      </div>
    </div>`;

  /* Saving an event is what makes the "it is tomorrow" notification real
     rather than a message with nothing behind it. */
  const rem = $('#evRemind');
  if (rem) rem.addEventListener('click', () => {
    const on = S.toggleSavedEvent(e.id);
    toast(on ? t('eventReminderOn') : t('eventReminderOff'), 'ok');
    rem.className = `btn ${on ? 'btn-outline-gold' : 'btn-ghost'} btn-block mt-12`;
    rem.innerHTML = `${icon('bell', 18)} ${on ? t('eventReminderOn') : t('saveEvent')}`;
  });

  $('#mapBtn').addEventListener('click', () =>
    import('../ui.js').then(m => m.openMaps(`${esc(L(e.venue))} ${esc(e.city)}`)));
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
  /* NOT `query().admin`. Reading it off the URL let anybody — signed in or
     not — open the admin form, publish an event LIVE to everyone and tick
     `featured`, which is the $99/week pin. A flag in the address bar is a
     request, never a permission; `adminUnlocked()` is the session, and it
     is memory-only so a reload asks for the password again. */
  const isAdmin = S.adminUnlocked() && !!query().admin;

  renderHeader({ simple: true, title: editing ? t('editEvent') : (isAdmin ? t('addEvent') : t('proposeEvent')) });

  if (!isAdmin && !S.requireTier(1, '#/events/propose', go)) return;
  /* An event somebody else proposed is not yours to rewrite. The admin
     edits through this same form on purpose — one form, one shape of data
     — so an unlocked panel passes, and nothing else does. */
  if (editing && !isAdmin && !S.ownsEvent(editing.id)) { go('#/events/' + editing.id); return; }

  const e = editing || S.blankEvent();

  root.innerHTML = `
    <div class="pad mt-16">
      ${!isAdmin ? `<div class="list-note" style="margin:0 0 14px">${icon('info', 18)}<span>${t('eventProposed')}</span></div>` : ''}

      <div class="field"><label class="label">${t('eventTitleLabel')}</label>
        <input class="input" id="evTitle" value="${esc(L(e.title))}" /></div>

      <div class="field"><label class="label">${t('eventType')}</label>
        <select class="select" id="evType">
          ${EVENT_TYPES.map(x => `<option value="${x.id}" ${(e.type || 'community') === x.id ? 'selected' : ''}>${t(x.key)}</option>`).join('')}
        </select></div>

      <!-- concert-only, revealed by the type above -->
      <div id="evConcert" hidden>
        <div class="field"><label class="label">${t('evArtist')}</label>
          <input class="input" id="cnArtist" value="${esc((e.concert || {}).artist || '')}" /></div>
        <div class="field"><label class="label">${t('evDoors')} <span class="muted">(${t('optional')})</span></label>
          <input class="input" id="cnDoors" type="time" value="${esc((e.concert || {}).doorsAt || '')}" /></div>
        <div class="field"><label class="label">${t('evPriceFrom')} <span class="muted">(${t('optional')})</span></label>
          <input class="input ltr" id="cnPrice" inputmode="decimal" placeholder="35" value="${esc((e.concert || {}).priceFrom || '')}" /></div>
        <div class="field"><label class="label">${t('evAgeLimit')} <span class="muted">(${t('optional')})</span></label>
          <input class="input" id="cnAge" placeholder="${t('evAgeHint')}" value="${esc((e.concert || {}).ageLimit || '')}" /></div>
        <label class="setting-row" style="padding:8px 0;border:none">
          <input type="checkbox" id="cnFamily" ${(e.concert || {}).familySeating ? 'checked' : ''} class="check-gold" />
          <span class="s-txt"><b style="font-weight:500;font-size:.78125rem">${t('evFamilySeating')}</b></span></label>
        <div class="list-note" style="margin-inline:0">${icon('info', 18)}<span>${t('evTicketNote')}</span></div>
      </div>

      <div class="field"><label class="label">${t('eventStarts')}</label>
        <input class="input" id="evStart" type="datetime-local" value="${esc(e.startsAt)}" /></div>
      <div class="field"><label class="label">${t('eventEnds')} <span class="muted">(${t('optional')})</span></label>
        <input class="input" id="evEnd" type="datetime-local" value="${esc(e.endsAt)}" /></div>

      <div class="field"><label class="label">${t('eventVenue')}</label>
        <input class="input" id="evVenue" value="${esc(L(e.venue))}" /></div>
      <div class="field"><label class="label">${t('cityLabel')}</label>
        <input class="input" id="evCity" value="${esc(e.city || (S.userCity() ? S.userCity() + ', ' + S.state.location.state : ''))}" /></div>

      <div class="field"><label class="label">${t('eventOrganizerName')}</label>
        <input class="input" id="evOrg" value="${esc(L(e.organizer))}" /></div>

      <div class="field"><label class="label">${t('eventTicketUrl')} <span class="muted">(${t('optional')})</span></label>
        <input class="input" id="evUrl" inputmode="url" placeholder="https://" value="${esc(e.ticketUrl)}" /></div>

      <div class="field"><label class="label">${t('eventDescLabel')}</label>
        <textarea class="textarea" id="evDesc">${esc(L(e.desc || ''))}</textarea></div>

      <div class="field"><label class="label">${t('eventPhoto')} <span class="muted">(${t('optional')})</span></label>
        <div id="evPh"></div></div>

      ${isAdmin ? `
        <label class="setting-row" style="padding:8px 0;border:none">
          <input type="checkbox" id="evFeat" ${e.featured ? 'checked' : ''} class="check-gold" />
          <span class="s-txt"><b style="font-weight:500;font-size:.78125rem">${t('featuredEvent')}</b></span></label>

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

    /* A start in 2020 and an end in 2019 both went into the review queue
       with no warning at all — an event nobody can attend, in a list sorted
       soonest-first, taking a moderator's time to throw away. The admin is
       exempt from the past rule alone: correcting last month's record is a
       real thing to do, and «النهاية بعد البداية» is arithmetic either way. */
    const err = (sel, key) => {
      const el = $(sel);
      if (el) { el.classList.add('input-err'); el.focus(); }
      toast(t(key), 'err');
    };
    const startMs = new Date(start).getTime();
    const endRaw = $('#evEnd').value;
    const endMs = endRaw ? new Date(endRaw).getTime() : null;
    if (!isAdmin && isFinite(startMs) && startMs < S.now() - 60 * 60 * 1000) {
      return err('#evStart', 'evStartPast');
    }
    if (endMs != null && isFinite(endMs) && isFinite(startMs) && endMs < startMs) {
      return err('#evEnd', 'evEndBeforeStart');
    }
    $('#evStart').classList.remove('input-err');
    if ($('#evEnd')) $('#evEnd').classList.remove('input-err');

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
      S.updateEvent(editing.id, payload, isAdmin);
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


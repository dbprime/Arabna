/* ======================= ADMIN BACK OFFICE (v1, internal) =======================
   Reachable only by typing #/admin — it is intentionally absent from the drawer
   and the profile screen. Credentials live in store.js (V.02: a real staff
   account behind Supabase row-level security). */
import { t, arCount, L, icon, $, $$, go, renderHeader, toast, wireRoutes, emptyState, fmtMoney, priceLabel,
         confirmSheet, openSheet, closeSheet, esc } from '../ui.js';
import { MAG_CATS, ARTICLES, CATEGORIES, AD_PRODUCTS, MARKET_CATS } from '../data.js';
import * as S from '../store.js';
import { passwordField, passwordChecklist, wirePasswordField,
         wirePasswordToggles } from './profile.js';
import { fmtEventDate } from './events.js';
import { fmtDate } from './directory.js';

let unlocked = false;

export function AdminScreen(root) {
  renderHeader({ simple: true, title: t('adminPanel') });
  if (!unlocked) { lockView(root); return; }
  panelView(root);
}

/**
 * First run on this device: there is no staff password because none is
 * shipped any more. The owner sets one here — and this screen, not a
 * constant in a downloadable file, is where it comes from.
 */
function setupView(root) {
  const canSet = S.adminCanSet();
  root.innerHTML = `
    <div class="pad mt-20 center-col">
      <div class="empty-ico">${icon('lock', 33)}</div>
      <b style="font-size:1.0625rem">${t('adminSetupTitle')}</b>
      <span class="muted fs-13">${t('adminSetupSub')}</span>
    </div>
    <div class="pad mt-16">
      ${canSet ? `
      <div class="field"><label class="label">${t('adminUser')}</label>
        <input class="input" id="aUser" autocomplete="off" autocapitalize="none"
               autocorrect="off" spellcheck="false" inputmode="email" /></div>
      ${passwordField('aNew', t('password'))}
      ${passwordChecklist('aNew')}
      <div id="e_aNew"></div>
      <div id="aErr"></div>
      <div class="hint mt-8">${t('adminSetupNote')}</div>
      <button class="btn btn-gold btn-block mt-12" id="aSet">${t('adminSetupGo')}</button>`
      : `<div class="err-msg">${icon('alert', 15)} ${t('adminNoCrypto')}</div>`}
    </div>`;
  if (!canSet) return;
  wirePasswordToggles(root);
  // the same rule as every other password in the app, stated before typing
  const checkPw = wirePasswordField('aNew', 'e_aNew');
  $('#aSet').addEventListener('click', async () => {
    const user = $('#aUser').value.trim();
    if (!user) { $('#aUser').classList.add('input-err'); return; }
    if (checkPw()) return;                     // named under the field
    if (!await S.setAdminPass($('#aNew').value, user)) {
      $('#aErr').innerHTML = `<div class="err-msg">${icon('alert', 15)} ${t('adminNoCrypto')}</div>`;
      return;
    }
    unlocked = true;
    S.setAdminUnlocked(true);
    toast(t('adminSetupDone'), 'ok');
    go('#/admin');
  });
}

function lockView(root) {
  if (!S.adminIsSet()) return setupView(root);
  root.innerHTML = `
    <div class="pad mt-20 center-col">
      <div class="empty-ico">${icon('lock', 33)}</div>
      <b style="font-size:1.0625rem">${t('adminPanel')}</b>
      <span class="muted fs-13">${S.state.lang === 'en' ? 'Internal staff access only — separate from consumer accounts.' : 'دخول داخلي لفريق عربنا فقط — منفصل عن حسابات المستخدمين.'}</span>
    </div>
    <div class="pad mt-16">
      <div class="field"><label class="label">${t('adminUser')}</label>
        <input class="input" id="aUser" autocomplete="off" autocapitalize="none"
               autocorrect="off" spellcheck="false" inputmode="email" /></div>
      ${passwordField('aPass', t('password'))}
      <div id="aErr"></div>
      <button class="btn btn-gold btn-block mt-8" id="aGo">${t('signIn')}</button>
    </div>`;

  // async, because comparing a hash is
  const submit = async () => {
    if (!await S.checkAdmin($('#aUser').value.trim(), $('#aPass').value)) {
      $('#aErr').innerHTML = `<div class="err-msg">${icon('alert', 15)} ${t('adminLoginFail')}</div>`;
      $('#aPass').classList.add('input-err');
      return;
    }
    unlocked = true;
    S.setAdminUnlocked(true);
    go('#/admin');
  };
  wirePasswordToggles(root);
  $('#aGo').addEventListener('click', submit);
  $('#aPass').addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
}

function panelView(root) {
  let tab = 'queue';

  const paintTabs = () => {
    const n = S.pendingCount();
    /* The one thing that must not slip past launch day: invented shops
       and invented reviews sitting in a live directory. */
    const warn = S.showDemo()
      ? `<div class="demo-warn">${icon('alert', 17)} <span>${t('demoWarnBar')}</span></div>` : '';
    return warn + `
      <div class="tabs" id="aTabs">
        <button class="tab ${tab === 'queue' ? 'active' : ''}" data-t="queue">${S.state.lang === 'en' ? 'Moderation' : 'المراجعة'}${n ? ` (${n})` : ''}</button>
        <button class="tab ${tab === 'mag' ? 'active' : ''}" data-t="mag">${t('magazineTitle')}</button>
        <button class="tab ${tab === 'ads' ? 'active' : ''}" data-t="ads">${t('advertiseWithUs')}</button>
        <button class="tab ${tab === 'events' ? 'active' : ''}" data-t="events">${t('eventsTitle')}</button>
        <button class="tab ${tab === 'dir' ? 'active' : ''}" data-t="dir">${t('directoryTitle')}</button>
        <button class="tab ${tab === 'mkt' ? 'active' : ''}" data-t="mkt">${t('adminMarket')}${
          S.adminListings().filter(c => c.reports).length ? ` (${S.adminListings().filter(c => c.reports).length})` : ''}</button>
        <button class="tab ${tab === 'stats' ? 'active' : ''}" data-t="stats">${t('adminStats')}</button>
        <button class="tab ${tab === 'set' ? 'active' : ''}" data-t="set">${t('settings')}</button>
      </div>`;
  };

  const paint = () => {
    root.innerHTML = paintTabs() + '<div id="aBody"></div>';
    const body = $('#aBody');
    if (tab === 'queue') body.innerHTML = claimsHtml() + verifyHtml() + bizPhotoHtml()
      + offersHtml() + queueHtml();
    else if (tab === 'mag') body.innerHTML = magHtml();
    else if (tab === 'ads') body.innerHTML = adsHtml();
    else if (tab === 'events') body.innerHTML = repeatsHtml() + eventsHtml();
    else if (tab === 'mkt') body.innerHTML = mktHtml();
    else if (tab === 'stats') body.innerHTML = statsHtml();
    else if (tab === 'set') body.innerHTML = setHtml();
    else body.innerHTML = dirHtml();

    wireRoutes(body);

    // --- listings waiting for a decision ---
    $$('#aBody [data-approve]').forEach(b => b.addEventListener('click', () => {
      S.approveClassified(b.dataset.approve);
      toast(t('itemApproved'), 'ok');
      paint();
    }));
    $$('#aBody [data-reject]').forEach(b => b.addEventListener('click', () => {
      const box = $('#why-' + b.dataset.reject);
      S.rejectClassified(b.dataset.reject, box ? box.value : '');
      toast(t('itemRejected'), 'ok');
      paint();
    }));
    // --- a cash order, issued from here and nowhere else ---
    const csh = $('#cshGo');
    if (csh) csh.addEventListener('click', () => {
      const err = $('#cshErr');
      const kind = $('#cshKind').value;
      const bizId = $('#cshBiz').value;
      const who = $('#cshWho').value.trim();
      err.textContent = '';
      if (!bizId) { err.textContent = t('cashNeedBiz'); return; }
      // no cash without a record of WHO TOOK IT — that is the whole point
      if (!who) { err.textContent = t('cashNeedWho'); return; }
      const b = S.businessById(bizId);
      const r = S.addCashOrder({
        kind, bizId, days: Number($('#cshDays').value) || 30,
        amount: Number($('#cshAmt').value) || 0,
        method: $('#cshMethod').value,
        receivedBy: who, reference: $('#cshRef').value.trim(),
        note: $('#cshNote').value.trim(),
        bizName: b ? L(b.name) : '',
      });
      if (!r) { toast(t('somethingWrong'), 'err'); return; }
      toast(t('cashDone').replace('{id}', r.receipt.id), 'ok');
      paint();
    });

    // --- offers awaiting approval ---
    $$('#aBody [data-ofok]').forEach(b => b.addEventListener('click', () => {
      S.approveOffer(b.dataset.biz, b.dataset.ofok);
      toast(t('itemApproved'), 'ok'); paint();
    }));
    $$('#aBody [data-ofno]').forEach(b => b.addEventListener('click', () => {
      const box = $('#why-' + b.dataset.ofno);
      S.rejectOffer(b.dataset.biz, b.dataset.ofno, box ? box.value : '');
      toast(t('itemRejected'), 'ok'); paint();
    }));
    // --- events awaiting approval ---
    $$('#aBody [data-evok]').forEach(b => b.addEventListener('click', () => {
      S.approveEvent(b.dataset.evok); toast(t('eventApproved'), 'ok'); paint();
    }));
    $$('#aBody [data-evno]').forEach(b => b.addEventListener('click', () => {
      const box = $('#why-' + b.dataset.evno);
      S.rejectEvent(b.dataset.evno, box ? box.value : '');
      toast(t('eventRejected'), 'ok'); paint();
    }));
    $$('#aBody [data-evdel]').forEach(b => b.addEventListener('click', () => {
      S.deleteEvent(b.dataset.evdel); toast(t('eventDeleted'), 'ok'); paint();
    }));
    $$('#aBody [data-evfeat]').forEach(b => b.addEventListener('click', () => {
      const ev = S.eventById(b.dataset.evfeat);
      S.featureEvent(b.dataset.evfeat, !(ev && ev.featured));
      toast(t('eventSaved'), 'ok'); paint();
    }));
    // --- profile photos + verification badges ---
    $$('#aBody [data-avok]').forEach(b => b.addEventListener('click', () => {
      S.approveAvatar(); toast(t('done'), 'ok'); paint();
    }));
    $$('#aBody [data-avno]').forEach(b => b.addEventListener('click', () => {
      S.rejectAvatar(); toast(t('itemRejected'), 'ok'); paint();
    }));
    $$('#aBody [data-bgok]').forEach(b => b.addEventListener('click', () => {
      S.approveBadge(); toast(t('done'), 'ok'); paint();
    }));
    $$('#aBody [data-bgno]').forEach(b => b.addEventListener('click', () => {
      S.rejectBadge(); toast(t('itemRejected'), 'ok'); paint();
    }));
    // --- ad orders and the waiting list ---
    $$('#aBody [data-adno]').forEach(b => b.addEventListener('click', () => {
      S.rejectAd(b.dataset.adno, ''); toast(t('itemRejected'), 'ok'); paint();
    }));
    $$('#aBody [data-wlrm]').forEach(b => b.addEventListener('click', () => {
      S.removeFromWaitlist(b.dataset.wlrm); toast(t('done'), 'ok'); paint();
    }));

    // --- the invented prototype data ---
    const dsw = $('#demoSw');
    if (dsw) dsw.addEventListener('click', () => {
      S.setShowDemo(!S.showDemo());
      toast(S.showDemo() ? t('demoShownToast') : t('demoHiddenToast'), 'ok');
      paint();
    });
    const wipe = $('#demoWipe');
    if (wipe) wipe.addEventListener('click', () => {
      /* Typing the word is the confirmation: this cannot be undone from
         the switch, and it takes the seed reviews with it. */
      openSheet(`
        <div class="sheet-title">${t('demoWipe')}</div>
        <div class="sheet-sub">${t('demoWipeConfirm')}</div>
        <div class="field"><input class="input" id="wipeWord" placeholder="${t('demoWipeWord')}" /></div>
        <button class="btn btn-danger btn-block" id="wipeGo" disabled>${t('demoWipe')}</button>
        <button class="btn btn-plain btn-block mt-8" id="wipeNo">${t('cancel')}</button>
      `, (panel) => {
        const inp = panel.querySelector('#wipeWord');
        const btn = panel.querySelector('#wipeGo');
        inp.addEventListener('input', () => {
          btn.disabled = inp.value.trim() !== t('demoWipeWord');
        });
        btn.addEventListener('click', () => {
          S.purgeDemoData();
          closeSheet();
          toast(t('demoPurged'), 'ok');
          paint();
        });
        panel.querySelector('#wipeNo').addEventListener('click', () => closeSheet());
      });
    });

    // --- the fake clock, so the trial and the renewal can be watched ---
    $$('#aBody [data-clock]').forEach(b => b.addEventListener('click', () => {
      S.advanceClock(+b.dataset.clock);
      toast(t('done'), 'ok');
      paint();
    }));
    const cr = $('#clockReset');
    if (cr) cr.addEventListener('click', () => { S.resetClock(); toast(t('done'), 'ok'); paint(); });

    // --- admin password ---
    // --- ownership claims ---
    $$('#aBody [data-clok]').forEach(b => b.addEventListener('click', () => {
      S.approveClaim(b.dataset.clok); toast(t('claimApproved'), 'ok'); paint();
    }));
    $$('#aBody [data-clno]').forEach(b => b.addEventListener('click', () => {
      const box = $('#why-' + b.dataset.clno);
      S.rejectClaim(b.dataset.clno, box ? box.value : '');
      toast(t('claimRejected'), 'ok'); paint();
    }));
    // --- business photos ---
    $$('#aBody [data-bpok]').forEach(b => b.addEventListener('click', () => {
      const [id, url] = b.dataset.bpok.split('|');
      S.approveBizPhoto(id, url); toast(t('done'), 'ok'); paint();
    }));
    $$('#aBody [data-bpno]').forEach(b => b.addEventListener('click', () => {
      const [id, url] = b.dataset.bpno.split('|');
      S.rejectBizPhoto(id, url); toast(t('itemRejected'), 'ok'); paint();
    }));
    // --- business verification ---
    $$('#aBody [data-bvok]').forEach(b => b.addEventListener('click', () => {
      S.approveBizVerify(b.dataset.bvok); toast(t('done'), 'ok'); paint();
    }));
    $$('#aBody [data-bvno]').forEach(b => b.addEventListener('click', () => {
      const box = $('#why-' + b.dataset.bvno);
      S.rejectBizVerify(b.dataset.bvno, box ? box.value : '');
      toast(t('itemRejected'), 'ok'); paint();
    }));

    // --- a yearly event due to come round ---
    $$('#aBody [data-spawn]').forEach(b => b.addEventListener('click', () => {
      const copy = S.spawnRepeat(b.dataset.spawn);
      toast(copy ? t('evDraftMade') : t('required'), copy ? 'ok' : 'err');
      paint();
    }));

    const ram = $('#ramSw');
    if (ram) ram.addEventListener('click', () => {
      // one switch turns the whole Ramadan group on: attributes, chips, filters
      S.setSeason('ramadan', !S.seasonOn('ramadan'));
      ram.classList.toggle('on', S.seasonOn('ramadan'));
      toast(t('done'), 'ok');
    });

    /* ---- bulk import: read, show exactly what is wrong, then emit a file ---- */
    const sampleBtn = $('#csvSample');
    if (sampleBtn) sampleBtn.addEventListener('click', () =>
      download('arabna-businesses-sample.csv', S.sampleCsv(), 'text/csv'));

    const bk = $('#bkExport');
    if (bk) bk.addEventListener('click', () => {
      download('arabna-backup-' + new Date().toISOString().slice(0, 10) + '.json',
               S.exportBackup(), 'application/json');
      toast(t('backupDone'), 'ok');
    });

    const pick = $('#csvPick'), file = $('#csvFile');
    if (pick && file) {
      pick.addEventListener('click', () => file.click());
      file.addEventListener('change', () => {
        const f = file.files && file.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = () => showImport(S.parseBusinessCsv(String(reader.result)), paint);
        reader.readAsText(f, 'utf-8');
      });
    }

    /* What the subscriber actually agreed to, kept word for word. A
       chargeback or a regulator asks for exactly this. */
    const cv = $('#consentView');
    if (cv) cv.addEventListener('click', () => {
      const c = (S.subscription() || {}).consent || {};
      openSheet(`
        <div class="sheet-title">${t('consentRecord')}</div>
        <div class="sheet-sub">${t('consentRecordSub')}</div>
        <div class="consent-box"><pre class="consent-text">${esc(c.text || '—')}</pre></div>
        <div class="info-row"><span class="i-ico">${icon('clock', 21)}</span>
          <div class="i-txt"><b>${c.acceptedAt ? fmtDate(c.acceptedAt) : '—'}</b><span>${t('consentAcceptedAt')}</span></div></div>
        <div class="info-row"><span class="i-ico">${icon('creditCard', 21)}</span>
          <div class="i-txt"><b class="ltr">${c.amount ? fmtMoney(c.amount) : '—'} / ${c.cycle || '—'}</b><span>${t('consentAmount')}</span></div></div>
        <div class="info-row"><span class="i-ico">${icon('smartphone', 21)}</span>
          <div class="i-txt"><b class="ltr fs-12">${(c.device || '—').slice(0, 60)}</b><span>${t('consentDevice')}</span></div></div>
      `);
    });

    // --- listings held over a certain duplicate match ---
    $$('#aBody [data-bizok]').forEach(b => b.addEventListener('click', () => {
      S.approvePendingBusiness(b.dataset.bizok); toast(t('done'), 'ok'); paint();
    }));
    $$('#aBody [data-bizno]').forEach(b => b.addEventListener('click', () => {
      S.rejectPendingBusiness(b.dataset.bizno, ''); toast(t('itemRejected'), 'ok'); paint();
    }));
    $$('#aBody [data-bizmerge]').forEach(b => b.addEventListener('click', () => {
      S.mergeBusinesses(b.dataset.into, b.dataset.bizmerge);
      toast(t('mergeDone'), 'ok'); paint();
    }));

    /* After 486 records arrived from two separate files, "is anything in
       here twice?" is a question with a real answer. */
    const geoEx = $('#geoExport');
    if (geoEx) geoEx.addEventListener('click', () => {
      download('arabna-missing-coordinates.csv', S.geoQueueCsv(), 'text/csv');
      toast(t('geoExported'), 'ok');
    });

    // a correction is opened in the same edit form the mosque itself uses —
    // two forms for one piece of data would be two shapes of it
    $$('[data-wfedit]').forEach(b => b.addEventListener('click', () => {
      S.resolveWorshipFix(b.dataset.wfid);
      go('#/business/edit/' + b.dataset.wfedit);
    }));
    $$('[data-wfdone]').forEach(b => b.addEventListener('click', () => {
      S.resolveWorshipFix(b.dataset.wfdone);
      toast(t('done'), 'ok');
      paint();
    }));

    const scan = $('#dupScan');
    if (scan) scan.addEventListener('click', () => {
      const out = $('#dupScanOut');
      out.innerHTML = `<div class="hint">${t('dupScanRunning')}</div>`;
      // let the label paint before the sweep blocks the thread
      setTimeout(() => {
        const pairs = S.scanDirectoryDuplicates();
        out.innerHTML = pairs.length ? `
          <div class="hint" style="margin:10px 0">${pairs.length} ${pairs.length === 1 ? t('dupScanFound') : t('dupScanPairs')}</div>
          ${pairs.slice(0, 40).map((p, i) => `
            <div class="q-card">
              <div class="q-head"><b>${L(p.a.name)}</b>
                <span class="conf-tag ${p.confidence}">${t(p.confidence === 'certain' ? 'confCertain' : p.confidence === 'likely' ? 'confLikely' : 'confWeak')}</span></div>
              <div class="row-sub"><span class="ltr">${p.a.address || '—'} · ${p.a.phone || '—'}</span></div>
              <div class="q-head" style="margin-top:8px"><b>${L(p.b.name)}</b></div>
              <div class="row-sub"><span class="ltr">${p.b.address || '—'} · ${p.b.phone || '—'}</span></div>
              <div class="action-grid" style="margin:10px 0 0">
                <button class="btn btn-ghost btn-sm" data-pairsee="${p.a.id}">${icon('eye', 16)} ${t('view')}</button>
                <button class="btn btn-danger btn-sm" data-pairmerge="${p.b.id}" data-into="${p.a.id}">${icon('refresh', 16)} ${t('mergeDuplicates')}</button>
              </div>
            </div>`).join('')}` : `<div class="ok-msg">${t('dupScanNone')}</div>`;
        out.querySelectorAll('[data-pairsee]').forEach(x =>
          x.addEventListener('click', () => go('#/directory/' + x.dataset.pairsee)));
        out.querySelectorAll('[data-pairmerge]').forEach(x =>
          x.addEventListener('click', () => {
            S.mergeBusinesses(x.dataset.into, x.dataset.pairmerge);
            toast(t('mergeDone'), 'ok'); paint();
          }));
      }, 30);
    });

    // --- a public place is not a business: flag it either way ---
    const flip = (id, on) => {
      S.setNonCommercial(id, on);
      toast(t('done'), 'ok');
      paint();
    };
    const ncOn = $('#ncOn');
    if (ncOn) ncOn.addEventListener('click', () => flip($('#ncPick').value, true));
    /* --- the statistics tab --- */
    const sr = $('#statRange');
    if (sr) sr.addEventListener('change', () => { statRange = +sr.value; paint(); });
    const sa = $('#statA');
    if (sa) sa.addEventListener('change', () => { statA = sa.value; paint(); });
    const sb = $('#statB');
    if (sb) sb.addEventListener('change', () => { statB = sb.value; paint(); });

    /* --- the marketplace tab --- */
    const mq = $('#mktQ');
    if (mq) mq.addEventListener('input', () => {
      mktQ = mq.value;
      paint();
      const again = $('#mktQ');
      if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
    });
    const ms = $('#mktSt');
    if (ms) ms.addEventListener('change', () => { mktStatus = ms.value; paint(); });

    $$('#aBody [data-mktopen]').forEach(b =>
      b.addEventListener('click', () => go('#/marketplace/' + b.dataset.mktopen)));
    $$('#aBody [data-mktshow]').forEach(b => b.addEventListener('click', () => {
      S.unhideClassified(b.dataset.mktshow); toast(t('listingRepublished'), 'ok'); paint();
    }));
    $$('#aBody [data-mkthide]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.mkthide;
      askReason({
        title: t('adminHide'), sub: t('adminHideAsk'), confirmText: t('adminHide'),
        onGo: (why) => { S.adminHideListing(id, why); toast(t('listingHidden'), 'ok'); paint(); },
      });
    }));
    $$('#aBody [data-mktdel]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.mktdel;
      askReason({
        title: t('adminRemove'), sub: t('adminRemoveAsk'), confirmText: t('delete'), danger: true,
        onGo: (why) => { S.adminDeleteListing(id, why); toast(t('done'), 'ok'); paint(); },
      });
    }));
    $$('#aBody [data-mktnote]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.mktnote;
      askReason({
        title: t('adminNotice'), sub: t('adminNoticeAsk'), confirmText: t('send'),
        onGo: (why) => { S.adminNotify(id, why); toast(t('adminNoticeSent'), 'ok'); },
      });
    }));

    /* --- the directory browser: search, filter, edit, delete --- */
    const dq = $('#dirQ');
    if (dq) {
      dq.addEventListener('input', () => {
        dirQ = dq.value; dirShown = 20;
        paint();
        // repainting the tab replaces the field, so the caret goes back
        const again = $('#dirQ');
        if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
      });
    }
    const dcs = $('#dirCatSel');
    if (dcs) dcs.addEventListener('change', () => { dirCat = dcs.value; dirShown = 20; paint(); });
    const dg = $('#dirGeo');
    if (dg) dg.addEventListener('change', () => { dirGeoOnly = dg.checked; dirShown = 20; paint(); });
    const dm = $('#dirMore');
    if (dm) dm.addEventListener('click', () => { dirShown += 20; paint(); });

    $$('#aBody [data-bizopen]').forEach(b =>
      b.addEventListener('click', () => go('#/directory/' + b.dataset.bizopen)));
    // the same form the owner edits with — two forms mean two shapes of data
    $$('#aBody [data-bizedit]').forEach(b =>
      b.addEventListener('click', () => go('#/business/edit/' + b.dataset.bizedit)));
    $$('#aBody [data-bizdel]').forEach(b => b.addEventListener('click', () => {
      const biz = S.businessById(b.dataset.bizdel);
      confirmSheet({
        title: t('adminDelBiz'),
        sub: t('adminDelBizAsk').replace('{name}', biz ? L(biz.name) : b.dataset.bizdel),
        confirmText: t('delete'), danger: true,
        onConfirm: () => { S.deleteBusiness(b.dataset.bizdel); toast(t('adminDeleted'), 'ok'); paint(); },
      });
    }));

    const ncOff = $('#ncOff');
    if (ncOff) ncOff.addEventListener('click', () => flip($('#ncPick').value, false));
    $$('#aBody [data-ncoff]').forEach(b =>
      b.addEventListener('click', () => flip(b.dataset.ncoff, false)));

    const mg = $('#mgGo');
    if (mg) mg.addEventListener('click', () => {
      const keep = $('#mgKeep').value, drop = $('#mgDrop').value;
      if (keep === drop) { toast(t('mergeNeedTwo'), 'err'); return; }
      confirmSheet({
        title: t('mergeDuplicates'),
        sub: `${esc(L(S.businessById(drop).name))} → ${esc(L(S.businessById(keep).name))}`,
        confirmText: t('mergeDrop'), danger: true,
        onConfirm: () => { S.mergeBusinesses(keep, drop); toast(t('mergeDone'), 'ok'); paint(); },
      });
    });

    const apw = $('#apSave');
    const checkAdminPw = $('#apNew') ? wirePasswordField('apNew', 'e_apNew') : () => '';
    if (apw) apw.addEventListener('click', async () => {
      const a = $('#apNew').value, b2 = $('#apConf').value;
      if (checkAdminPw()) return;                 // named under the field
      if (a !== b2) { toast(t('passwordsDontMatch'), 'err'); return; }
      await S.setAdminPass(a);
      toast(t('adminPassChanged'), 'ok');
      paint();
    });
    wirePasswordToggles(body);
    // --- flags raised by the app (reports, free-section edits, scanned DMs) ---
    $$('#aBody [data-flagok]').forEach(b => b.addEventListener('click', () => {
      S.resolveFlag(b.dataset.flagok);
      toast(t('done'), 'ok');
      paint();
    }));
    $$('#aBody [data-flagdel]').forEach(b => b.addEventListener('click', () => {
      const f = S.state.flags.find(x => x.id === b.dataset.flagdel);
      if (f && f.kind !== 'message' && S.classifiedById(f.refId)) S.rejectClassified(f.refId);
      S.resolveFlag(b.dataset.flagdel);
      toast(t('itemRejected'), 'ok');
      paint();
    }));
    // --- paid ad orders ---
    $$('#aBody [data-adok]').forEach(b => b.addEventListener('click', () => {
      S.approveAd(b.dataset.adok); toast(t('done'), 'ok'); paint();
    }));

    const pub = $('#pubArt');
    if (pub) pub.addEventListener('click', () => {
      const title = $('#artTitle').value.trim();
      if (!title) { toast(t('required'), 'err'); return; }
      S.addArticle({
        cat: $('#artCat').value,
        sponsored: $('#artSpon').checked,
        advertiser: { ar: $('#artAdv').value, en: $('#artAdv').value },
        media: $('#artMedia').value,
        title: { ar: title, en: title },
        excerpt: { ar: $('#artEx').value, en: $('#artEx').value },
        date: { ar: 'اليوم', en: 'Today' },
        author: { ar: 'فريق عربنا', en: 'ARABNA Team' },
        body: { ar: [$('#artBody').value], en: [$('#artBody').value] },
      });
      toast(t('done'), 'ok');
      go('#/magazine');
    });

    $$('#aTabs .tab').forEach(b => b.addEventListener('click', () => {
      tab = b.dataset.t;
      paint();
    }));
  };
  paint();
}

/* ------------------------------ QUEUE ------------------------------ */
function rejectBox(id) {
  return `<div class="reject-box"><input class="input" id="why-${id}" placeholder="${t('rejectReasonPlaceholder')}" /></div>`;
}

function queueHtml() {
  const pending = S.pendingListings();
  const events = S.pendingEvents();
  const flags = S.state.flags;
  const avatar = S.pendingAvatar();
  const badge = S.pendingBadge();
  const total = pending.length + events.length + flags.length + (avatar ? 1 : 0) + (badge ? 1 : 0);

  if (!total) {
    return `<div class="pad mt-16">${emptyState('checkCircle', t('noPending'), t('noPendingSub'))}</div>`;
  }

  return `<div class="pad mt-16">
    <div class="list-note" style="margin:0 0 12px">${icon('shield', 18)}
      <span>${S.state.lang === 'en'
        ? 'Everything here is real user content waiting on a human decision — the automated scan scores risk, it never auto-rejects.'
        : 'كل ما هنا محتوى حقيقي من المستخدمين بانتظار قرار بشري — الفحص الآلي يعطي درجة خطورة فقط ولا يرفض تلقائياً.'}</span></div>

    <div class="stat-row" style="padding:0 0 12px">
      <div class="stat"><b>${pending.length}</b><span>${t('queueListings')}</span></div>
      <div class="stat"><b>${events.length}</b><span>${t('queueEvents')}</span></div>
      <div class="stat"><b>${flags.length}</b><span>${t('queueReports')}</span></div>
    </div>

    ${pending.length ? `<div class="dr-group-label">${t('queueListings')}</div>` : ''}
    ${pending.map(c => `
      <div class="list-row">
        <span class="row-ico" style="overflow:hidden;padding:0">${c.photos && c.photos.length
          ? `<img src="${c.photos[c.mainPhoto || 0] || c.photos[0]}" style="width:100%;height:100%;object-fit:cover" alt="" />`
          : icon(c.icon || 'image', 24)}</span>
        <div class="row-main">
          <div class="row-title">${esc(L(c.title))}
            <span class="badge badge-pending">${t('statusPending')}</span></div>
          <div class="row-sub gold"><span class="ltr">${esc(priceLabel(c.price))}</span> · ${t(catKeyOf(c.cat))}</div>
          <div class="row-sub">${esc(L(c.desc || ''))}</div>
          <div class="row-sub">${icon('user', 13)} ${esc((S.state.user && S.state.user.name) || t('guest'))} · ${(c.photos || []).length} ${t('photosCount')}</div>
          ${rejectBox(c.id)}
          <div class="row-actions">
            <button class="mini-btn gold" data-approve="${c.id}">${icon('check', 15)} ${t('approve')}</button>
            <button class="mini-btn" data-reject="${c.id}">${icon('x', 15)} ${t('reject')}</button>
            <button class="mini-btn" data-route="#/marketplace/${c.id}">${icon('eye', 15)}</button>
          </div>
        </div>
      </div>`).join('')}

    ${events.length ? `<div class="dr-group-label">${t('queueEvents')}</div>` : ''}
    ${events.map(e => `
      <div class="list-row">
        <span class="row-ico" style="overflow:hidden;padding:0">${e.photo
          ? `<img src="${e.photo}" style="width:100%;height:100%;object-fit:cover" alt="" />`
          : icon('calendar', 24)}</span>
        <div class="row-main">
          <div class="row-title">${esc(L(e.title))}<span class="badge badge-pending">${t('statusPending')}</span></div>
          <div class="row-sub">${icon('clock', 13)} ${fmtEventDate(e.startsAt)}</div>
          <div class="row-sub">${icon('mapPin', 13)} ${esc(L(e.venue))} · <span class="ltr">${esc(e.city)}</span></div>
          <div class="row-sub">${icon('users', 13)} ${esc(L(e.organizer))}</div>
          ${rejectBox(e.id)}
          <div class="row-actions">
            <button class="mini-btn gold" data-evok="${e.id}">${icon('check', 15)} ${t('approve')}</button>
            <button class="mini-btn" data-evno="${e.id}">${icon('x', 15)} ${t('reject')}</button>
          </div>
        </div>
      </div>`).join('')}

    ${avatar ? `<div class="dr-group-label">${t('queueAvatars')}</div>
      <div class="list-row">
        <span class="row-ico" style="overflow:hidden;padding:0"><img src="${avatar.url}" style="width:100%;height:100%;object-fit:cover" alt="" /></span>
        <div class="row-main">
          <div class="row-title">${(S.state.user && S.state.user.name) || ''}
            <span class="badge badge-pending">${t('statusPending')}</span></div>
          <div class="row-sub">${t('profilePhoto')}</div>
          <div class="row-actions">
            <button class="mini-btn gold" data-avok="1">${icon('check', 15)} ${t('approve')}</button>
            <button class="mini-btn" data-avno="1">${icon('x', 15)} ${t('reject')}</button>
          </div>
        </div>
      </div>` : ''}

    ${badge ? `<div class="dr-group-label">${t('queueBadges')}</div>
      <div class="list-row">
        <span class="row-ico">${icon('check', 24)}</span>
        <div class="row-main">
          <div class="row-title">${(S.state.user && S.state.user.name) || ''}
            <span class="badge badge-pending">${t('statusPending')}</span></div>
          <div class="row-sub">${t('verifiedBadge')} · ${S.state.user && S.state.user.email}</div>
          <div class="row-actions">
            <button class="mini-btn gold" data-bgok="1">${icon('check', 15)} ${t('approve')}</button>
            <button class="mini-btn" data-bgno="1">${icon('x', 15)} ${t('reject')}</button>
          </div>
        </div>
      </div>` : ''}

    ${flags.length ? `<div class="dr-group-label">${t('queueReports')}</div>` : ''}
    ${flags.map(f => `
      <div class="list-row">
        <span class="row-ico ${f.risk === 'high' ? 'ink-danger' : 'gold'}">${icon(f.kind === 'message' ? 'message' : 'alert', 24)}</span>
        <div class="row-main">
          <div class="row-title">${f.item ? L(f.item) : t(f.kind === 'contact-attempts' ? 'contactAttemptReport' : 'report')}
            <span class="badge badge-free flag-pill">${f.risk}</span></div>
          <div class="row-sub">${L(f.reason)}</div>
          <div class="row-actions">
            <button class="mini-btn gold" data-flagok="${f.id}">${icon('check', 15)} ${t('approve')}</button>
            <button class="mini-btn" data-flagdel="${f.id}">${icon('x', 15)} ${t('reject')}</button>
          </div>
        </div>
      </div>`).join('')}
  </div>`;
}

/* ------------------------------ EVENTS ------------------------------ */
function eventsHtml() {
  const all = S.allEvents();
  return `<div class="pad mt-16">
    <button class="btn btn-gold btn-block" data-route="#/events/propose?admin=1">${icon('plus', 19)} ${t('addEvent')}</button>
    <div class="hint">${t('eventImportNote')}</div>
    <div class="mt-16">
      ${all.length ? all.map(e => `
        <div class="list-row">
          <span class="row-ico" style="overflow:hidden;padding:0">${e.photo
            ? `<img src="${e.photo}" style="width:100%;height:100%;object-fit:cover" alt="" />`
            : icon(e.icon || 'calendar', 24)}</span>
          <div class="row-main">
            <div class="row-title">${esc(L(e.title))}
              ${e.featured ? `<span class="badge badge-boost">${t('featuredEvent')}</span>` : ''}
              <span class="badge ${e.status === 'live' ? 'badge-verified' : 'badge-pending'}">${e.status === 'live' ? t('statusLive') : t('statusPending')}</span>
              ${S.eventIsPast(e) ? `<span class="badge badge-free">${t('eventPast')}</span>` : ''}</div>
            <div class="row-sub">${icon('clock', 13)} ${fmtEventDate(e.startsAt)}</div>
            <div class="row-sub">${icon('mapPin', 13)} ${esc(L(e.venue))} · <span class="ltr">${esc(e.city)}</span></div>
            <div class="row-actions">
              <button class="mini-btn gold" data-route="#/events/edit/${e.id}?admin=1">${icon('edit', 15)} ${t('edit')}</button>
              <button class="mini-btn" data-evfeat="${e.id}">${icon('bolt', 15)} ${e.featured ? t('cancel') : t('featuredEvent')}</button>
              <button class="mini-btn" data-evdel="${e.id}">${icon('trash', 15)}</button>
              <button class="mini-btn" data-route="#/events/${e.id}">${icon('eye', 15)}</button>
            </div>
          </div>
        </div>`).join('') : emptyState('calendar', t('emptyEventsTitle'), t('emptyEventsSub'))}
    </div>
  </div>`;
}

/**
 * «آخر ما عُدِّل» — what the panel changed, and only the panel.
 *
 * It protects Rai before it protects anybody else: without it, an owner
 * ringing to ask who changed their phone number gets no answer at all.
 */
function adminLogHtml() {
  const rows = S.adminLog(30);
  if (!rows.length) {
    return `<div class="section-title mt-20">${t('adminLogTitle')}</div>
      <div class="hint">${t('adminLogNone')}</div>`;
  }
  const val = (v) => v === '' ? `<i class="muted">${t('adminLogEmptyVal')}</i>` : esc(v);
  return `<div class="section-title mt-20">${t('adminLogTitle')}<small>${t('adminLogSub')}</small></div>
    ${rows.map(r => {
      const b = S.businessById(r.bizId);
      return `<div class="log-row">
        <div class="log-head"><b>${esc(b ? L(b.name) : r.bizId)}</b><span class="ltr">${fmtDate(r.at)}</span></div>
        <div class="log-field">${esc(r.field)}</div>
        <div class="log-diff"><span class="log-from">${t('adminLogFrom')}: ${val(r.from)}</span>
          <span class="log-to">${t('adminLogTo')}: ${val(r.to)}</span></div>
      </div>`;
    }).join('')}`;
}

/* ----------------------------- SETTINGS ----------------------------- */
function setHtml() {
  const dc = S.demoCounts();
  return `<div class="pad mt-16">
    <div class="section-title">${t('attrGrpRamadan')}</div>
    <div class="setting-row" style="padding-inline:0">
      <span class="s-txt"><b>${t('seasonRamadan')}</b><span>${t('seasonRamadanSub')}</span></span>
      <button class="switch ${S.seasonOn('ramadan') ? 'on' : ''}" id="ramSw"></button>
    </div>
    ${/* The switch is not broken — the data is empty. Saying the real
          number turns "nothing happened" into a job somebody can do. */''}
    <div class="hint">${t('seasonCountLine')
      .replace('{c}', arCount(S.seasonCount('ramadan'), t('plBiz'))).replace('{min}', S.CHIP_MIN)}</div>

    <div class="section-title mt-20">${t('demoTitle')}</div>
    <div class="hint" style="margin-bottom:10px">${t('demoWhy')}</div>
    ${S.state.demoPurged
      ? `<div class="ok-msg">${icon('checkCircle', 15)} ${t('demoPurged')}</div>
         <div class="hint" style="margin-top:8px">${t('demoPurgedNote')}</div>`
      : `<div class="stat-row" style="padding:0;grid-template-columns:repeat(4,1fr)">
           <div class="stat"><b>${dc.businesses}</b><span>${t('directoryTitle')}</span></div>
           <div class="stat"><b>${dc.reviews}</b><span>${t('reviews')}</span></div>
           <div class="stat"><b>${dc.ads}</b><span>${t('advertiseWithUs')}</span></div>
           <div class="stat"><b>${dc.listings + dc.events + dc.articles + dc.notifications}</b><span>${t('demoOther')}</span></div>
         </div>
         <div class="setting-row" style="padding-inline:0">
           <span class="s-txt"><b>${t('demoShow')}</b><span>${t('demoShowSub')}</span></span>
           <button class="switch ${S.showDemo() ? 'on' : ''}" id="demoSw"></button>
         </div>
         <button class="btn btn-danger btn-block mt-8" id="demoWipe">${icon('trash', 19)} ${t('demoWipe')}</button>
         <div class="hint" style="text-align:center;margin-top:8px">${t('demoWipeNote')}</div>`}

    ${S.showDemo() ? `
    <div class="section-title mt-20">${t('subTestTitle')}</div>
    <div class="hint" style="margin-bottom:10px">${t('subTestWhy')}</div>
    ${S.clockDaysAhead() ? `<div class="list-note" style="margin-inline:0">${icon('clock', 18)}
      <span>${t('subTestAhead').replace('{c}', arCount(S.clockDaysAhead(), t('plDay')))}</span></div>` : ''}
    ${S.subscription() ? `<div class="hint" style="margin-bottom:8px">
        ${t(({ trialing: 'subStatusTrialing', active: 'subStatusActive',
               canceled: 'subStatusCanceled', past_due: 'subStatusPastDue' })[S.subscription().status])}
        · ${(S.subscription().invoices || []).length} ${t('subInvoices')}</div>`
      : `<div class="hint" style="margin-bottom:8px">${t('subTestNone')}</div>`}
    <div class="action-grid">
      <button class="btn btn-ghost btn-sm" data-clock="1">${t('subTestDay')}</button>
      <button class="btn btn-ghost btn-sm" data-clock="7">${t('subTestWeek')}</button>
    </div>
    <div class="action-grid">
      <button class="btn btn-ghost btn-sm" data-clock="30">${t('subTestMonth')}</button>
      <button class="btn btn-ghost btn-sm" id="clockReset">${t('subTestReset')}</button>
    </div>` : ''}

    <div class="section-title mt-20">${t('changePassword')}</div>
    <div class="hint" style="margin-bottom:10px">${t('adminUser')}: <b class="gold ltr">${esc(S.adminUser())}</b></div>
    ${passwordField('apNew', t('newPassword'))}
    ${/* The panel is the FIRST place this rule belongs, not the last:
         whoever gets in sees everything and can change everything. */''}
    ${passwordChecklist('apNew')}
    <div class="field-err" id="e_apNew"></div>
    ${passwordField('apConf', t('confirmPassword'))}
    <button class="btn btn-gold btn-block" id="apSave">${icon('lock', 19)} ${t('changePassword')}</button>
  </div>`;
}

function catKeyOf(catId) {
  const map = { cars: 'filterCars', furniture: 'filterFurniture', realestate: 'filterRealEstate',
                jobs: 'filterJobs', pets: 'filterPets', handyman: 'filterHandyman',
                free: 'filterFree', other: 'filterOther' };
  return map[catId] || 'filterOther';
}

/* ----------------------------- MAGAZINE ----------------------------- */
function magHtml() {
  const all = S.state.extraArticles.concat(ARTICLES);
  return `<div class="pad mt-16">
    <div class="section-title">${S.state.lang === 'en' ? 'New article' : 'مقال جديد'}</div>
    <div class="field mt-12"><label class="label">${t('titleLabel')}</label><input class="input" id="artTitle" /></div>
    <div class="field"><label class="label">${t('category')}</label>
      <select class="select" id="artCat">${MAG_CATS.map(c => `<option value="${c.id}">${t(c.key)}</option>`).join('')}</select></div>
    <div class="field"><label class="label">${S.state.lang === 'en' ? 'Media' : 'الوسائط'}</label>
      <select class="select" id="artMedia"><option value="image">${t('photos')}</option><option value="video">${t('videos')}</option></select></div>
    <div class="field"><label class="label">${S.state.lang === 'en' ? 'Excerpt' : 'المقتطف'}</label><input class="input" id="artEx" /></div>
    <div class="field"><label class="label">${S.state.lang === 'en' ? 'Body' : 'نص المقال'}</label><textarea class="textarea" id="artBody"></textarea></div>
    <label class="setting-row" style="padding:8px 0;border:none">
      <input type="checkbox" id="artSpon" class="check-gold" />
      <span class="s-txt"><b style="font-weight:500;font-size:.78125rem">${t('sponsoredStory')}</b></span></label>
    <div class="field"><label class="label">${S.state.lang === 'en' ? 'Advertiser' : 'المعلن'} <span class="muted">(${t('optional')})</span></label><input class="input" id="artAdv" /></div>
    <button class="btn btn-gold btn-block" id="pubArt">${icon('send', 19)} ${S.state.lang === 'en' ? 'Publish' : 'نشر'}</button>

    <div class="section-title mt-20">${S.state.lang === 'en' ? 'Published' : 'المنشور'} (${all.length})</div>
    <div class="mt-12">
      ${all.slice(0, 6).map(a => `<div class="list-row" data-route="#/magazine/${a.id}">
        <span class="row-ico">${icon(a.icon || 'newspaper', 24)}</span>
        <div class="row-main"><div class="row-title">${L(a.title)}</div>
          <div class="row-sub">${L(a.date)} ${a.sponsored ? '· ' + t('sponsoredStory') : ''}</div></div></div>`).join('')}
    </div>
  </div>`;
}

/**
 * Cash orders about to run out. A card subscription renews itself and a
 * cash one does not, so without this the panel keeps a subscriber whose
 * month ended weeks ago and whose page still says «subscribed».
 */
function cashDueHtml() {
  const due = S.cashDue();
  if (!due.length) return '';
  return `<div class="section-title">${t('cashDueTitle')}</div>
    ${due.map(d => `<div class="setting-row">
      <span class="s-txt"><b>${esc(d.name)}</b><span class="${d.expired ? 'ink-danger' : ''}">${
        (d.expired ? t('cashDueExpired') : t('cashDueEnds')).replace('{d}', fmtDate(d.endsAt))
      }</span></span>
    </div>`).join('')}`;
}

/** Issued HERE and nowhere else — see addCashOrder() in store.js. */
function cashFormHtml() {
  const opts = S.allBusinesses().slice(0, 600)
    .map(b => `<option value="${b.id}">${esc(L(b.name))}</option>`).join('');
  return `<div class="section-title mt-20">${t('cashOrder')}<small>${t('cashOrderSub')}</small></div>
    <div class="field"><label class="label">${t('cashKind')}</label>
      <select class="select" id="cshKind">
        <option value="subscription">${t('cashKindSub')}</option>
        <option value="ad">${t('cashKindAd')}</option>
      </select></div>
    <div class="field"><label class="label">${t('cashBiz')}</label>
      <select class="select" id="cshBiz"><option value="">—</option>${opts}</select></div>
    <div class="action-grid">
      <div class="field"><label class="label">${t('cashAmount')}</label>
        <input class="input ltr" id="cshAmt" inputmode="decimal" value="29" /></div>
      <div class="field"><label class="label">${t('cashDays')}</label>
        <input class="input ltr" id="cshDays" inputmode="numeric" value="30" /></div>
    </div>
    <div class="action-grid">
      <div class="field"><label class="label">${t('cashMethod')}</label>
        <select class="select" id="cshMethod">
          <option value="cash">${t('receiptCash')}</option>
          <option value="check">${t('receiptCheck')}</option>
          <option value="transfer">${t('receiptTransfer')}</option>
        </select></div>
      <div class="field"><label class="label">${t('cashReceivedBy')}</label>
        <input class="input" id="cshWho" /></div>
    </div>
    <div class="field"><label class="label">${t('cashReference')}</label>
      <input class="input ltr" id="cshRef" /></div>
    <div class="field"><label class="label">${t('cashNote')}</label>
      <input class="input" id="cshNote" /></div>
    <div class="hint">${t('cashNoRenew')}</div>
    <div class="field-err" id="cshErr"></div>
    <button class="btn btn-gold btn-block mt-8" id="cshGo">${icon('banknote', 19)} ${t('cashIssue')}</button>`;
}

function adsHtml() {
  const orders = S.state.myAds;
  const waiting = S.adWaitlist();
  const prodName = (id) => {
    const p = S.adProduct(id);
    return p ? t(p.nameKey) : id;
  };
  return `<div class="pad mt-16">
    ${cashDueHtml()}
    ${cashFormHtml()}
    <div class="section-title mt-20">${t('adInventory')}</div>
    <div class="mt-8">
      ${AD_PRODUCTS.filter(p => !p.perCat).map(p => `
        <div class="setting-row" style="padding-inline:0">
          <span class="s-txt"><b>${t(p.nameKey)}</b><span>${t('slotsLeft')
            .replace('{left}', S.adSlotsLeft(p.id)).replace('{total}', S.adCapacity(p.id))}</span></span>
          <span class="muted fs-12 ltr">${S.adsRunning(p.id).length}/${S.adCapacity(p.id)}</span>
        </div>`).join('')}
    </div>

    <div class="section-title mt-20">${t('advertiseWithUs')}</div>
    ${orders.length ? orders.map(o => `
      <div class="list-row">
        <span class="row-ico">${icon('megaphone', 24)}</span>
        <div class="row-main">
          <div class="row-title">${o.bizName}
            <span class="badge ${o.status === 'live' ? 'badge-verified' : 'badge-pending'}">${o.status === 'live' ? t('statusLive') : t('statusPending')}</span></div>
          <div class="row-sub">${prodName(o.product)}${o.cat ? ' · ' + t(dirCatKey(o.cat)) : ''} · ${esc(fmtMoney(o.price))} · ${o.tagline || ''}</div>
          <div class="row-sub muted">${t('adImpressions')} ${S.adStats(o.id).impressions} · ${t('adClicks')} ${S.adStats(o.id).clicks}</div>
          ${o.status !== 'live' ? `<div class="row-actions">
            <button class="mini-btn gold" data-adok="${o.id}">${icon('check', 15)} ${S.state.lang === 'en' ? 'Approve & go live' : 'اعتماد ونشر'}</button>
            <button class="mini-btn" data-adno="${o.id}">${icon('x', 15)} ${t('dupReject')}</button>
          </div>` : ''}
        </div>
      </div>`).join('') : emptyState('megaphone', t('noPending'), t('adSubmittedSub'))}

    <div class="section-title mt-20">${t('waitlistTitle')}${waiting.length ? ` (${waiting.length})` : ''}</div>
    ${waiting.length ? waiting.map(w => `
      <div class="q-card">
        <div class="q-head"><b>${esc(w.name)}</b><span class="muted fs-12">${prodName(w.product)}</span></div>
        <div class="row-sub"><span class="ltr">${esc(w.phone)}</span></div>
        ${w.preferred ? `<div class="row-sub">${t('waitlistWhen')}: ${w.preferred}</div>` : ''}
        <button class="btn btn-ghost btn-sm btn-block mt-8" data-wlrm="${w.id}">${icon('check', 16)} ${t('waitlistRemove')}</button>
      </div>`).join('') : `<div class="hint">${t('waitlistEmpty')}</div>`}
  </div>`;
}

/* --------- ownership claims, business photos, verification --------- */
function claimsHtml() {
  const list = S.pendingClaims();
  if (!list.length) return '';
  return `<div class="dr-group-label">${t('claimQueue')} (${list.length})</div>
    ${list.map(c => {
      const b = S.businessById(c.bizId);
      return `<div class="card" style="padding:13px;margin:0 14px 10px">
        <div class="row-title">${esc(b ? L(b.name) : c.bizId)}</div>
        <div class="row-sub"><span class="ltr">${esc(b ? b.address : '')}</span></div>
        <div class="info-row" style="border:none;padding:8px 0 0">
          <div class="i-txt"><b>${esc(c.name)} — ${t('role' + c.role[0].toUpperCase() + c.role.slice(1))}</b>
          <span class="ltr">${esc(c.phone)}</span></div></div>
        ${c.proof ? `<p class="fs-13 muted" style="margin:6px 0 0">${c.proof}</p>` : ''}
        <div class="reject-box"><input class="input" id="why-${c.id}" placeholder="${t('rejectReasonPlaceholder')}" /></div>
        <div class="row-actions mt-8">
          <button class="mini-btn gold" data-clok="${c.id}">${icon('check', 15)} ${t('approve')}</button>
          <button class="mini-btn" data-clno="${c.id}">${icon('x', 15)} ${t('reject')}</button>
        </div>
      </div>`;
    }).join('')}`;
}

/** the same escaper three other screens keep locally */

/**
 * Offers waiting on a decision. A price claim published unread is our
 * liability, not the shop's — so this passes review like everything else
 * a user writes, and a rejection carries the reason to its author.
 */
function offersHtml() {
  const list = S.pendingOffers();
  if (!list.length) return '';
  return `<div class="dr-group-label">${t('offerQueue')} (${list.length})</div>
    ${list.map(({ offer, biz }) => `<div class="card" style="padding:13px;margin:0 14px 10px">
      <div class="row-title">${esc(biz ? L(biz.name) : offer.bizId)}</div>
      <div class="offer-text mt-8">${esc(offer.text)}</div>
      ${offer.price ? `<div class="offer-price ltr">${esc(offer.price)}</div>` : ''}
      <div class="offer-meta">${icon('clock', 15)}<span>${t('offerEndsAt')} ${fmtDate(offer.endsAt)}</span></div>
      <div class="reject-box"><input class="input" id="why-${offer.id}" placeholder="${t('rejectReasonPlaceholder')}" /></div>
      <div class="row-actions mt-8">
        <button class="mini-btn gold" data-ofok="${offer.id}" data-biz="${offer.bizId}">${icon('check', 15)} ${t('approve')}</button>
        <button class="mini-btn" data-ofno="${offer.id}" data-biz="${offer.bizId}">${icon('x', 15)} ${t('reject')}</button>
      </div>
    </div>`).join('')}`;
}

function bizPhotoHtml() {
  const list = S.pendingBizPhotos();
  if (!list.length) return '';
  return `<div class="dr-group-label">${t('bizPhotoQueue')} (${list.length})</div>
    <div class="pad">${list.map(p => {
      const b = S.businessById(p.bizId);
      return `<div class="list-row">
        <span class="row-ico" style="overflow:hidden;padding:0"><img src="${esc(p.url)}" style="width:100%;height:100%;object-fit:cover" alt="" /></span>
        <div class="row-main">
          <div class="row-title">${esc(b ? L(b.name) : p.bizId)}</div>
          <div class="row-actions">
            <button class="mini-btn gold" data-bpok="${p.bizId}|${esc(p.url)}">${icon('check', 15)} ${t('approve')}</button>
            <button class="mini-btn" data-bpno="${p.bizId}|${esc(p.url)}">${icon('x', 15)} ${t('reject')}</button>
          </div>
        </div>
      </div>`;
    }).join('')}</div>`;
}

/**
 * Verification review. It shows a status and a note and nothing else —
 * no identity image ever reaches this app, so there is none to display.
 * The screen exists because the appeals will come ("the system rejected me
 * and I am real"), and without it there is no answer to give them.
 */
function verifyHtml() {
  const list = S.pendingBizVerify();
  if (!list.length) return '';
  return `<div class="dr-group-label">${t('verifyQueue')} (${list.length})</div>
    ${list.map(v => {
      const b = S.businessById(v.bizId);
      return `<div class="card" style="padding:13px;margin:0 14px 10px">
        <div class="row-title">${esc(b ? L(b.name) : v.bizId)}</div>
        <div class="row-sub">${t('verifyRef')}: <span class="ltr">${v.ref || '—'}</span></div>
        <div class="list-note" style="margin:8px 0 0">${icon('shield', 18)}<span>${t('verifyNoImages')}</span></div>
        <div class="reject-box"><input class="input" id="why-${v.bizId}" placeholder="${t('rejectReasonPlaceholder')}" /></div>
        <div class="row-actions mt-8">
          <button class="mini-btn gold" data-bvok="${v.bizId}">${icon('check', 15)} ${t('approve')}</button>
          <button class="mini-btn" data-bvno="${v.bizId}">${icon('x', 15)} ${t('reject')}</button>
        </div>
      </div>`;
    }).join('')}`;
}

/**
 * A yearly event coming round. Never republished automatically: the venue,
 * the price and the line-up all change, so the admin gets a draft to fix.
 */
function repeatsHtml() {
  const due = S.dueRepeats();
  if (!due.length) return '';
  return `<div class="dr-group-label">${t('evRepeatDue')} (${due.length})</div>
    <div class="pad">${due.map(({ ev, nextAt }) => `
      <div class="list-row">
        <span class="row-ico">${icon(ev.icon || 'calendar', 20)}</span>
        <div class="row-main">
          <div class="row-title">${L(ev.title)}</div>
          <div class="row-sub">${t('evNextEdition')} ${fmtEventDate(nextAt, false)}
            · ${ev.repeat.kind === 'hijri' ? t('evRepeatHijri') : t('evRepeatGreg')}</div>
          <div class="row-actions">
            <button class="mini-btn gold" data-spawn="${ev.id}">${icon('refresh', 15)} ${t('evMakeDraft')}</button>
          </div>
        </div>
      </div>`).join('')}
      <div class="hint">${t('evRepeatNote')}</div>
    </div>`;
}

/** the i18n key of a directory category — the admin list prints where a
    place sits. Not to be confused with catKeyOf above, which maps the
    marketplace sections. */
function dirCatKey(id) {
  const c = CATEGORIES.find(x => x.id === id);
  return c ? c.key : 'catAll';
}

/** the record a held listing was flagged against, if it is still findable */
function dupPartner(b) {
  const hits = S.findDuplicates({ phone: b.phone, name: b.name, address: b.address, cat: b.cat, id: b.id });
  return hits.length ? hits[0].biz : null;
}

/* The directory browser's own state. 514 records with no search means a
   particular one cannot be reached at all; the list is capped and grows on
   request so the panel does not paint five hundred rows to show three. */
let dirQ = '', dirCat = 'all', dirGeoOnly = false, dirShown = 20;

/** a value safe to put inside an HTML attribute */

function dirBrowseHtml() {
  const all = S.everyBusiness();
  let list = all;
  if (dirCat !== 'all') list = list.filter(b => b.cat === dirCat);
  if (dirGeoOnly) { const need = new Set(S.needsGeoList().map(b => b.id)); list = list.filter(b => need.has(b.id)); }
  list = S.adminSearchBusinesses(list, dirQ);
  const rows = list.slice(0, dirShown);

  return `
    <div class="section-title mt-16">${t('adminDirBrowse')}</div>
    <div class="search-bar" style="margin-bottom:10px">${icon('search', 20)}
      <input id="dirQ" placeholder="${t('adminDirSearch')}" value="${esc(dirQ)}" /></div>
    <div class="field" style="margin-bottom:8px">
      <select class="select" id="dirCatSel">
        <option value="all">${t('catAll')} — ${all.length}</option>
        ${CATEGORIES.filter(c => !c.route).map(c =>
          `<option value="${c.id}" ${dirCat === c.id ? 'selected' : ''}>${t(c.key)} — ${all.filter(b => b.cat === c.id).length}</option>`).join('')}
      </select></div>
    <label class="consent-row" style="margin-bottom:10px">
      <input type="checkbox" id="dirGeo" ${dirGeoOnly ? 'checked' : ''} />
      <span>${t('adminOnlyGeo')} — ${S.needsGeoList().length}</span>
    </label>
    <div class="hint" style="margin-bottom:8px">${t('adminDirCount')
      .replace('{n}', list.length).replace('{total}', all.length)}</div>

    ${rows.length ? rows.map(b => `
      <div class="setting-row">
        <span class="s-txt"><b>${L(b.name)}</b>
          <span class="muted fs-12 ltr">${b.phone || b.address || b.id}</span></span>
        <button class="mini-btn" data-bizopen="${b.id}" aria-label="${t('adminOpen')}">${icon('eye', 15)}</button>
        <button class="mini-btn gold" data-bizedit="${b.id}" aria-label="${t('adminEdit')}">${icon('edit', 15)}</button>
        <button class="mini-btn" data-bizdel="${b.id}" aria-label="${t('adminDelBiz')}">${icon('trash', 15)}</button>
      </div>`).join('')
      : `<div class="hint">${t('adminDirNone')}</div>`}
    ${list.length > rows.length
      ? `<button class="btn btn-ghost btn-sm btn-block mt-8" id="dirMore">${t('adminShowMore')} (${list.length - rows.length})</button>` : ''}
    ${adminLogHtml()}
  `;
}

/* ---------------- the statistics tab ----------------
   Every number is computed from the data, not from a counter that could
   drift. The chart is the `.spark` component the ads tab already uses —
   no library, the project is zero-dependency and will not break that for
   a drawing. What needs other people's devices to report in says so. */
let statRange = 30, statA = 'directory', statB = 'market';

const STAT_SECTIONS = ['directory', 'market', 'events', 'magazine'];
const statSecKey = { directory: 'statDirectory', market: 'statMarketSec',
                     events: 'statEventsSec', magazine: 'statMagazineSec' };

/** the one number that stands for a section, for the comparison */
function statTotalOf(counts, id) {
  if (id === 'directory') return counts.directory.total;
  if (id === 'market') return counts.market.live;
  if (id === 'events') return counts.events.upcoming;
  if (id === 'magazine') return counts.magazine.published;
  const cat = CATEGORIES.find(c => c.id === id);
  return cat ? S.allBusinesses().filter(b => b.cat === id).length : 0;
}
function statLabelOf(id) {
  if (statSecKey[id]) return t(statSecKey[id]);
  const cat = CATEGORIES.find(c => c.id === id);
  return cat ? t(cat.key) : id;
}

function cardRow(titleKey, pairs) {
  return `<div class="section-title mt-20">${t(titleKey)}</div>
    <div class="stat-row" style="padding:0;flex-wrap:wrap">
      ${pairs.map(([n, k]) => `<div class="stat"><b>${n}</b><span>${t(k)}</span></div>`).join('')}
    </div>`;
}

function statsHtml() {
  const c = S.adminCounts();
  const days = S.impressionsByDay(statRange);
  const peak = Math.max(1, ...days.map(d => d.i));
  const anyImpressions = days.some(d => d.i > 0);
  const viewed = S.topViewedBusinesses(10);
  const searches = S.topSearches(10);
  const thin = S.thinnestCategories(5);

  const aN = statTotalOf(c, statA), bN = statTotalOf(c, statB);
  const hi = Math.max(aN, bN) || 1;
  /* 138 against 1 is not "13700% more" — that is a true number nobody can
     read. Past ten times over, it is said as a multiple. */
  const hiN = Math.max(aN, bN), loN = Math.min(aN, bN);
  const ratio = loN > 0 ? hiN / loN : Infinity;
  const winner = statLabelOf(aN > bN ? statA : statB);
  const diff = aN === bN ? t('statDiffSame')
    : ratio >= 10 || loN === 0
      ? t('statDiffTimes').replace('{a}', winner).replace('{c}', arCount(loN ? Math.round(ratio) : hiN, t('plTimes')))
      : t('statDiff').replace('{a}', winner).replace('{n}', Math.round((ratio - 1) * 100));

  const pickOptions = () => STAT_SECTIONS.map(id => ({ id, label: t(statSecKey[id]) }))
    .concat(CATEGORIES.filter(x => !x.route).map(x => ({ id: x.id, label: t(x.key) })));

  const money = S.receiptTotals();
  return `<div class="pad mt-16">
    ${/* The two kept apart on purpose: mixed together, the revenue figure
         never matches the bank statement, and the day the accountant asks
         where the difference came from there is no answer. */''}
    <div class="section-title">${t('receipts')}</div>
    <div class="stat-row" style="padding:0 0 12px">
      <div class="stat"><b class="ltr">${fmtMoney(money.card)}</b><span>${t('statPaidCard')}</span></div>
      <div class="stat"><b class="ltr">${fmtMoney(money.cash)}</b><span>${t('statPaidCash')}</span></div>
      <div class="stat"><b>${money.count}</b><span>${t('receipts')}</span></div>
    </div>
    ${cardRow('statDirectory', [
      [c.directory.total, 'statTotal'], [c.directory.verified, 'statVerified'],
      [c.directory.paid, 'statPaid'], [c.directory.noPhone, 'statNoPhone'],
      [c.directory.needsGeo, 'statNeedsGeo']])}
    ${cardRow('statMarketSec', [
      [c.market.live, 'statLive'], [c.market.pending, 'statPending'],
      [c.market.hidden, 'statHidden'], [c.market.expired, 'statExpired']])}
    ${cardRow('statEventsSec', [
      [c.events.upcoming, 'statUpcoming'], [c.events.pending, 'statPending'], [c.events.past, 'statPast']])}
    ${cardRow('statMagazineSec', [
      [c.magazine.total, 'statTotal'], [c.magazine.published, 'statPublished'], [c.magazine.drafts, 'statDrafts']])}

    <div class="section-title mt-20">${t('statAdsSec')}</div>
    ${c.ads.map(a => `<div class="setting-row">
      <span class="s-txt"><b>${t((AD_PRODUCTS.find(p => p.id === a.id) || {}).nameKey || a.id)}</b>
        <span class="muted fs-12">${t('statSold')} ${a.sold} · ${t('statLeft')} ${a.left} / ${a.capacity}${
          a.waiting ? ` · ${t('statWaiting')} ${a.waiting}` : ''}</span></span>
    </div>`).join('')}

    <div class="section-title mt-20">${t('statImpressions')}</div>
    <div class="field" style="margin-bottom:8px">
      <select class="select" id="statRange">
        ${[[7, 'statRange7'], [30, 'statRange30'], [90, 'statRange90']].map(([n, k]) =>
          `<option value="${n}" ${statRange === n ? 'selected' : ''}>${t(k)}</option>`).join('')}
      </select></div>
    ${anyImpressions ? `
      <div class="spark" aria-hidden="true">
        ${days.map(d => `<span class="spark-bar" style="height:${Math.max(3, Math.round((d.i / peak) * 40))}px"
          title="${d.date}: ${d.i}"></span>`).join('')}
      </div>`
      : `<div class="hint">${t('statNoServer')}</div>`}

    <div class="section-title mt-20">${t('statCompare')}</div>
    <div class="field" style="margin-bottom:8px">
      <select class="select" id="statA">${pickOptions().map(o =>
        `<option value="${esc(o.id)}" ${statA === o.id ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></div>
    <div class="field" style="margin-bottom:10px">
      <select class="select" id="statB">${pickOptions().map(o =>
        `<option value="${esc(o.id)}" ${statB === o.id ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></div>
    <div class="cmp-bars">
      <div class="cmp-col"><span class="cmp-bar a" style="height:${Math.round((aN / hi) * 90) + 4}px"></span><b>${aN}</b><span>${statLabelOf(statA)}</span></div>
      <div class="cmp-col"><span class="cmp-bar b" style="height:${Math.round((bN / hi) * 90) + 4}px"></span><b>${bN}</b><span>${statLabelOf(statB)}</span></div>
    </div>
    <div class="hint" style="text-align:center">${diff}</div>

    <div class="section-title mt-20">${t('statTopViewed')}</div>
    ${viewed.length ? viewed.map(v => `<div class="setting-row">
      <span class="s-txt"><b>${esc(L(v.biz.name))}</b></span>
      <span class="muted fs-12">${v.views}</span></div>`).join('')
      : `<div class="hint">${t('statNoServer')}</div>`}

    <div class="section-title mt-20">${t('statTopSearches')}</div>
    ${searches.length ? searches.map(x => `<div class="setting-row">
      <span class="s-txt"><b>${esc(x.term)}</b></span>
      <span class="muted fs-12">${x.count}</span></div>`).join('')
      : `<div class="hint">${t('statEmpty')}</div>`}

    <div class="section-title mt-20">${t('statThinnest')}</div>
    <div class="hint" style="margin-bottom:8px">${t('statThinnestWhy')}</div>
    ${thin.map(x => `<div class="setting-row">
      <span class="s-txt"><b>${t(x.cat.key)}</b></span>
      <span class="muted fs-12">${x.count}</span></div>`).join('')}
  </div>`;
}

/* ---------------- the marketplace tab ----------------
   Approving a listing used to remove it from the panel for good, so a
   report arriving two days later had nowhere to be opened. This holds
   everything, and the reported ones come first because that is what the
   screen gets opened for. */
let mktQ = '', mktStatus = 'all';

const MKT_STATES = ['all', 'reported', 'pending', 'live', 'hidden', 'rejected'];
const mktStateKey = { all: 'adminStAll', reported: 'adminStReported', pending: 'adminStPending',
                      live: 'adminStLive', hidden: 'adminStHidden', rejected: 'adminStRejected' };

function mktHtml() {
  const all = S.adminListings();
  let list = all.slice();
  if (mktStatus === 'reported') list = list.filter(c => c.reports > 0);
  else if (mktStatus !== 'all') list = list.filter(c => (c.status || 'live') === mktStatus);
  const q = (mktQ || '').trim().toLowerCase();
  if (q) list = list.filter(c => [L(c.title), c.cat, c.price, c.id]
    .filter(Boolean).join(' ').toLowerCase().includes(q));
  // the reported first, then the newest
  list.sort((a, b) => (b.reports - a.reports) || ((b.created || 0) - (a.created || 0)));

  const count = (st) => st === 'all' ? all.length
    : st === 'reported' ? all.filter(c => c.reports > 0).length
    : all.filter(c => (c.status || 'live') === st).length;

  return `<div class="pad mt-16">
    <div class="search-bar" style="margin-bottom:10px">${icon('search', 20)}
      <input id="mktQ" placeholder="${t('adminMktSearch')}" value="${esc(mktQ)}" /></div>
    <div class="field" style="margin-bottom:10px">
      <select class="select" id="mktSt">
        ${MKT_STATES.map(st => `<option value="${st}" ${mktStatus === st ? 'selected' : ''}>${t(mktStateKey[st])} — ${count(st)}</option>`).join('')}
      </select></div>

    ${list.length ? list.map(c => `
      <div class="q-card">
        <div class="q-head">
          <b>${esc(L(c.title))}</b>
          ${c.reports ? `<span class="badge badge-pending">${icon('flag', 12)}${c.reports} ${t('adminReports')}</span>`
                      : `<span class="muted fs-12">${t(mktStateKey[c.status] || 'adminStLive')}</span>`}
        </div>
        <div class="row-sub"><span>${t(mktCatKey(c.cat))} · <span class="ltr">${esc(priceLabel(c.price))}</span>${
          c.created ? ' · ' + fmtDate(c.created) : ''}</span></div>
        <div class="action-grid" style="margin:10px 0 0">
          <button class="btn btn-ghost btn-sm" data-mktopen="${c.id}">${icon('eye', 17)} ${t('adminOpen')}</button>
          <button class="btn btn-ghost btn-sm" data-mktnote="${c.id}">${icon('bell', 17)} ${t('adminNotice')}</button>
        </div>
        <div class="action-grid" style="margin:8px 0 0">
          ${c.status === 'hidden'
            ? `<button class="btn btn-gold btn-sm" data-mktshow="${c.id}">${icon('eye', 17)} ${t('republish')}</button>`
            : `<button class="btn btn-ghost btn-sm" data-mkthide="${c.id}">${icon('eye', 17)} ${t('adminHide')}</button>`}
          <button class="btn btn-danger btn-sm" data-mktdel="${c.id}">${icon('trash', 17)} ${t('adminRemove')}</button>
        </div>
      </div>`).join('') : `<div class="hint">${t('adminMktNone')}</div>`}
  </div>`;
}

function mktCatKey(id) {
  const c = MARKET_CATS.find(x => x.id === id);
  return c ? c.key : 'catAll';
}

/** hide and delete both ask for a reason, and the reason reaches the owner */
function askReason({ title, sub, confirmText, danger, onGo }) {
  openSheet(`
    <div class="sheet-title">${title}</div>
    <div class="sheet-sub">${sub}</div>
    <textarea class="textarea" id="adminWhy" rows="3"></textarea>
    <button class="btn ${danger ? 'btn-danger' : 'btn-gold'} btn-block mt-12" id="adminGo">${confirmText}</button>
    <button class="btn btn-ghost btn-block mt-8" data-close>${t('cancel')}</button>
  `, (panel) => {
    panel.querySelector('[data-close]').addEventListener('click', closeSheet);
    panel.querySelector('#adminGo').addEventListener('click', () => {
      const why = panel.querySelector('#adminWhy').value.trim();
      if (!why) { toast(t('adminReasonNeeded'), 'err'); return; }
      closeSheet();
      onGo(why);
    });
  });
}

function dirHtml() {
  const sub = S.subscription();
  const subBiz = sub ? S.businessById(sub.businessId) : null;
  const all = S.everyBusiness();
  const held = S.pendingBusinesses();
  const marked = all.filter(b => S.isNonCommercial(b));
  const paid = all.filter(b => S.businessPlan(b) === 'paid').length;
  return `<div class="pad mt-16">
    <div class="stat-row" style="padding:0">
      <div class="stat"><b>${all.length}</b><span>${t('directoryTitle')}</span></div>
      <div class="stat"><b>${paid}</b><span>${t('verified')}</span></div>
      <div class="stat"><b>${all.filter(b => !b.claimed).length}</b><span>${t('unclaimedCount')}</span></div>
    </div>
    <div class="section-title mt-16">${t('addBusiness')}</div>
    <div class="hint" style="margin-bottom:10px">${t('adminAddNote')}</div>
    <button class="btn btn-gold btn-block" data-route="#/add-business">${icon('plus', 19)} ${t('addBusiness')}</button>

    ${dirBrowseHtml()}

    <div class="section-title mt-20">${t('importTitle')}</div>
    <div class="hint" style="margin-bottom:10px">${t('importWhy')}</div>
    <div class="hint" style="margin-bottom:10px">${t('importNcNote')}</div>
    <div class="action-grid">
      <button class="btn btn-ghost btn-sm" id="csvSample">${icon('file', 18)} ${t('importSample')}</button>
      <button class="btn btn-ghost btn-sm" id="csvPick">${icon('inbox', 18)} ${t('importPick')}</button>
    </div>
    <input type="file" id="csvFile" accept=".csv,text/csv" hidden />
    <div id="csvOut"></div>

    <div class="section-title mt-20">${t('backupTitle')}</div>
    <div class="hint" style="margin-bottom:10px">${t('backupWhy')}</div>
    <button class="btn btn-ghost btn-block" id="bkExport">${icon('file', 19)} ${t('backupExport')}</button>

    <div class="section-title mt-20">${t('subscribers')}</div>
    ${sub ? `<div class="q-card">
        <div class="q-head"><b>${esc(subBiz ? L(subBiz.name) : sub.businessId)}</b>
          <span class="sub-status ${sub.status}">${t(({ trialing: 'subStatusTrialing', active: 'subStatusActive',
            canceled: 'subStatusCanceled', past_due: 'subStatusPastDue' })[sub.status])}</span></div>
        <div class="row-sub"><span class="ltr">${esc(fmtMoney(sub.price))} / ${t(sub.plan === 'yearly' ? 'planYearly' : 'planMonthly')}</span></div>
        <div class="row-sub"><span>${t('subNextCharge')}: ${fmtDate(sub.currentPeriodEnd)}</span></div>
        <button class="btn btn-ghost btn-sm btn-block mt-8" id="consentView">${icon('file', 17)} ${t('consentRecord')}</button>
      </div>` : `<div class="hint">${t('subTestNone')}</div>`}

    <div class="section-title mt-20">${t('dupQueue')}</div>
    <div class="hint" style="margin-bottom:10px">${t('similarReviewNote')}</div>
    ${held.length ? held.map(b => `
      <div class="q-card">
        <div class="q-head"><b>${esc(L(b.name))}</b><span class="muted fs-12">${t(dirCatKey(b.cat))}</span></div>
        <div class="row-sub"><span class="ltr">${esc(b.address || '—')}</span></div>
        <div class="row-sub"><span class="ltr">${esc(b.phone || '—')}</span></div>
        ${dupPartner(b) ? `<div class="row-sub gold">${t('dupScanFound')}: ${esc(L(dupPartner(b).name))}</div>` : ''}
        <div class="action-grid" style="margin:10px 0 0">
          <button class="btn btn-gold btn-sm" data-bizok="${b.id}">${icon('check', 17)} ${t('dupApprove')}</button>
          <button class="btn btn-ghost btn-sm" data-bizno="${b.id}">${icon('x', 17)} ${t('dupReject')}</button>
        </div>
        ${dupPartner(b) ? `<button class="btn btn-ghost btn-sm btn-block mt-8"
          data-bizmerge="${b.id}" data-into="${dupPartner(b).id}">${icon('refresh', 17)} ${t('dupMergeInto')}</button>` : ''}
      </div>`).join('') : `<div class="hint">${t('dupQueueEmpty')}</div>`}

    <button class="btn btn-ghost btn-block mt-12" id="dupScan">${icon('search', 19)} ${t('dupScan')}</button>
    <div id="dupScanOut"></div>

    <!-- the coordinates queue. Turning 514 addresses into points is a data
         job done outside the app; what the panel owes the owner is the
         count, so the gap is a number somebody can work through rather
         than a silence, and the addresses in a file they can hand over. -->
    <div class="section-title mt-20">${t('geoQueueTitle')}</div>
    <div class="hint" style="margin-bottom:10px">${t('geoQueueSub')}</div>
    <div class="q-card">
      <div class="q-head"><b>${S.needsGeoList().length}</b><span class="muted fs-12">${t('geoQueueTitle')}</span></div>
      <div class="row-sub"><span>${S.allBusinesses().length - S.needsGeoList().length} / ${S.allBusinesses().length}</span></div>
    </div>
    <button class="btn btn-ghost btn-block mt-8" id="geoExport" ${S.needsGeoList().length ? '' : 'disabled'}>
      ${icon('file', 19)} ${t('exportMissingGeo')}</button>

    <!-- the congregation's corrections. A wrong Friday time sends somebody
         late to jumuah, so a regular's line goes to a human here and never
         straight onto the page. -->
    <div class="section-title mt-20">${t('prWrongTimeTitle')}</div>
    ${!S.pendingWorshipFixes().length
      ? `<div class="hint">${t('noPending')}</div>`
      : `<div class="list">${S.pendingWorshipFixes().map(f => {
          const biz = S.businessById(f.bizId);
          return `<div class="list-row">
            <span class="row-main">
              <span class="row-title">${esc(biz ? L(biz.name) : f.bizId)}</span>
              <span class="row-sub">${esc(f.text)}</span>
            </span>
            <button class="btn btn-ghost btn-sm" data-wfedit="${f.bizId}" data-wfid="${f.id}">${t('edit')}</button>
            <button class="btn btn-ghost btn-sm" data-wfdone="${f.id}">${icon('check', 16)}</button>
          </div>`;
        }).join('')}</div>`}

    <div class="section-title mt-20">${t('nonCommercial')}</div>
    <div class="hint" style="margin-bottom:10px">${t('nonCommercialHint')}</div>
    <div class="field"><label class="label">${t('nonCommercialPick')}</label>
      <select class="select" id="ncPick">${all.map(b => `<option value="${esc(b.id)}">${esc(L(b.name))} — ${t(dirCatKey(b.cat))}</option>`).join('')}</select></div>
    <div class="action-grid">
      <button class="btn btn-ghost btn-sm" id="ncOn">${icon('landmark', 18)} ${t('nonCommercialMark')}</button>
      <button class="btn btn-ghost btn-sm" id="ncOff">${icon('briefcase', 18)} ${t('nonCommercialUnmark')}</button>
    </div>
    ${marked.length ? `<div class="mt-12">
      ${marked.map(b => `<div class="setting-row"><span class="s-txt"><b>${L(b.name)}</b>
        <span class="muted fs-12">${t(dirCatKey(b.cat))}</span></span>
        <button class="mini-btn" data-ncoff="${b.id}">${icon('x', 15)}</button></div>`).join('')}
    </div>` : `<div class="hint" style="margin-top:8px">${t('nonCommercialCount')}: 0</div>`}

    <div class="section-title mt-20">${t('mergeDuplicates')}</div>
    <div class="hint" style="margin-bottom:10px">${t('mergePick')}</div>
    <div class="field"><label class="label">${t('mergeKeep')}</label>
      <select class="select" id="mgKeep">${all.map(b => `<option value="${b.id}">${L(b.name)} — ${b.phone || b.address || '—'}</option>`).join('')}</select></div>
    <div class="field"><label class="label">${t('mergeDrop')}</label>
      <select class="select" id="mgDrop">${all.map(b => `<option value="${b.id}">${L(b.name)} — ${b.phone || b.address || '—'}</option>`).join('')}</select></div>
    <button class="btn btn-danger btn-block" id="mgGo">${icon('refresh', 19)} ${t('mergeDuplicates')}</button>

    <div class="mt-16">
      ${CATEGORIES.slice(0, 6).map(c => `<div class="setting-row"><span class="s-txt"><b>${t(c.key)}</b></span>
        <span class="muted fs-12">${all.filter(b => b.cat === c.id).length}</span></div>`).join('')}
    </div>
  </div>`;
}


/** hand the operator a file — the only way out of localStorage today */
function download(name, text, mime) {
  const blob = new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Step two of the import: every row accounted for, line by line, with the
 * reason it was refused. Rows can be dropped before the file is produced.
 */
/** the rows that need a decision first: refusals, then certain matches */
function sortedRows(rows) {
  const rank = (r) => r.errors.length ? 0
    : r.dupOf && r.dupOf.confidence === 'certain' ? 1
    : r.dupOf && r.dupOf.confidence === 'likely' ? 2
    : r.dupOf ? 3
    : r.warnings.length ? 4 : 5;
  return rows.slice().sort((a, b) => rank(a) - rank(b) || a.line - b.line);
}

function showImport(result, repaint) {
  const out = $('#csvOut');
  if (result.fatal === 'empty') {
    out.innerHTML = `<div class="err-msg">${icon('alert', 15)} ${t('importEmpty')}</div>`;
    return;
  }
  if (result.fatal === 'columns') {
    out.innerHTML = `<div class="err-msg">${icon('alert', 15)} ${t('importMissingCols')}: <b class="ltr">${result.missing.join(', ')}</b></div>`;
    return;
  }

  // an error stops the row; a warning is only worth saying out loud
  const problem = (e) => {
    const label = { required: t('importRequired'), unknown: t('importUnknownCat'),
                    badPhone: t('importBadPhone'), badHours: t('importBadHours') }[e.code] || e.code;
    return `${e.field}: ${label}${e.got ? ` (${e.got})` : ''}`;
  };
  const caution = (w) => {
    const label = { noNameAr: t('importWarnNoNameAr'), noHours: t('importWarnNoHours'),
                    noDesc: t('importWarnNoDesc'), unknownAttr: t('importWarnUnknownAttr'),
                    noPhone: t('importWarnNoPhone'), noAddress: t('importWarnNoAddress') }[w.code] || w.code;
    return `${label}${w.got ? `: ${w.got}` : ''}`;
  };

  const render = () => {
    const chosen = result.rows.filter(r => r.include);
    out.innerHTML = `
      <div class="stat-row mt-12" style="padding:0;grid-template-columns:repeat(4,1fr)">
        <div class="stat"><b>${result.counts.ok}</b><span>${t('importOk')}</span></div>
        <div class="stat"><b>${result.counts.warn}</b><span>${t('importWarn')}</span></div>
        <div class="stat"><b>${result.counts.bad}</b><span>${t('importBad')}</span></div>
        <div class="stat"><b>${result.counts.dup}</b><span>${t('importDup')}</span></div>
      </div>
      ${result.counts.noPhone ? `<div class="hint" style="margin:8px 0 0">${icon('phone', 13)}
        ${t('importWarnNoPhone')}: <b>${result.counts.noPhone}</b></div>` : ''}
      <div class="hint" style="margin:8px 0 0">${t('importLegend')}</div>
      <div class="mt-12">
        ${sortedRows(result.rows).map(r => `
          <div class="imp-row ${r.errors.length ? 'bad'
            : r.dupOf && r.dupOf.confidence !== 'weak' ? 'dup'
            : (r.warnings.length || r.dupOf) ? 'warn' : 'ok'}">
            <label class="imp-pick">
              <input type="checkbox" data-inc="${r.line}" ${r.include ? 'checked' : ''}
                     ${r.errors.length ? 'disabled' : ''} />
              <span class="imp-line">#${r.line}</span>
            </label>
            <div class="imp-body">
              <b>${esc(r.biz.name.en || r.biz.name.ar || '—')}</b>
              <span class="ltr muted fs-12">${esc(r.biz.phone || '—')}</span>
              ${r.biz.nonCommercial ? `<span class="imp-tag">${t('importNcTag')}</span>` : ''}
              ${r.biz.entryPrice ? `<span class="ltr muted fs-12">${r.biz.entryPrice}</span>` : ''}
              ${r.errors.length ? `<div class="imp-why err">${icon('alert', 12)} ${r.errors.map(problem).join(' · ')}</div>` : ''}
              ${r.warnings.length ? `<div class="imp-why warn">${icon('info', 12)} ${r.warnings.map(caution).join(' · ')}</div>` : ''}
              ${!r.errors.length && r.dupOf ? `<div class="imp-why dup">
                <span class="conf-tag ${r.dupOf.confidence}">${t(r.dupOf.confidence === 'certain'
                  ? 'confCertain' : r.dupOf.confidence === 'likely' ? 'confLikely' : 'confWeak')}</span>
                ${r.dupOf.kind === 'file'
                  ? `${t('importDupFile')} #${r.dupOf.line}`
                  : `${t('importDupDir')}: ${L(r.dupOf.name)}`}</div>` : ''}
            </div>
          </div>`).join('')}
      </div>
      ${result.rows.some(r => r.errors.some(e => e.code === 'unknown'))
        ? `<div class="list-note" style="margin-inline:0">${icon('info', 18)}
             <span>${t('importValidCats')}<br><b class="ltr">${result.validCats.join(' · ')}</b></span></div>`
        : ''}
      <button class="btn btn-gold btn-block mt-12" id="impExport" ${chosen.length ? '' : 'disabled'}>
        ${icon('file', 19)} ${t('importExport')} (${chosen.length})</button>
      <div class="hint" style="text-align:center;margin-top:8px">${t('importExportNote')}</div>`;

    out.querySelectorAll('[data-inc]').forEach(cb => cb.addEventListener('change', () => {
      const row = result.rows.find(r => String(r.line) === cb.dataset.inc);
      if (row) row.include = cb.checked;
      const n = result.rows.filter(r => r.include).length;
      const btn = out.querySelector('#impExport');
      btn.disabled = !n;
      btn.innerHTML = `${icon('file', 19)} ${t('importExport')} (${n})`;
    }));

    const ex = out.querySelector('#impExport');
    if (ex) ex.addEventListener('click', () => {
      const list = result.rows.filter(r => r.include).map(r => r.biz);
      // ids continue after the ones already in data.js
      download('arabna-businesses.js', S.toDataFile(list, S.allBusinesses().length + 1), 'text/javascript');
      toast(t('importDone'), 'ok');
    });
    out.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };
  render();
}

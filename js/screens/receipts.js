/* ============================================================
   ARABNA — الإيصالات
   ------------------------------------------------------------
   A receipt is the piece of paper that settles «I paid» against
   «no you didn't», and it is what makes a shop owner handing
   over $29 feel they dealt with a company rather than with
   somebody they happen to know.

   THE RECEIPT IN THE APP IS THE ORIGINAL, not a stopgap until
   email works. Email is lost, filed and binned; a receipt its
   owner can open whenever they like is the document, and the
   email will be a copy of it.
   ============================================================ */

import { t, icon, $, $$, go, renderHeader, toast, wireRoutes, emptyState,
         fmtMoney, shareItem, esc } from '../ui.js';
import * as S from '../store.js';
import { fmtDate } from './directory.js';

const KIND_KEY = {
  subscription: 'kindSubscription', ad: 'kindAd',
  boost: 'kindBoost', badge: 'kindBadge', refund: 'kindRefund',
};
const METHOD_KEY = {
  card: 'receiptCard', cash: 'receiptCash',
  check: 'receiptCheck', transfer: 'receiptTransfer',
};


const kindLabel = (r) => t(KIND_KEY[r.kind] || 'receiptTitle');

/** «20 Aug 2026 → 20 Sep 2026», or whatever text a cash order carried */
function coversLabel(c) {
  if (!c) return '';
  if (typeof c === 'string') return c;
  if (c.from && c.to) return `${fmtDate(c.from)} → ${fmtDate(c.to)}`;
  return '';
}

export function ReceiptsScreen(root) {
  renderHeader({ simple: true, title: t('receipts') });
  const list = S.receipts();

  root.innerHTML = !list.length
    ? emptyState('file', t('receiptsEmpty'), t('receiptsEmptySub'), '', '')
    : `<div class="pad mt-16">
        ${list.map(r => `<div class="list-row" data-route="#/receipt/${r.id}">
          <span class="row-ico">${icon(r.refundOf ? 'refresh' : 'file', 20)}</span>
          <div class="row-main">
            <div class="row-title">${esc(kindLabel(r))}</div>
            <div class="row-sub"><span class="ltr">${esc(r.id)}</span> · ${fmtDate(r.at)}</div>
          </div>
          <b class="${r.amount < 0 ? 'muted' : 'gold'} ltr">${fmtMoney(r.amount)}</b>
        </div>`).join('')}
      </div>
      <div style="height:16px"></div>`;
  wireRoutes(root);
}

export function ReceiptScreen(root, params) {
  const r = S.receiptById(params[0]);
  if (!r) { toast(t('gone'), 'err'); go('#/receipts'); return; }
  renderHeader({ simple: true, title: t('receiptTitle') });

  const covers = coversLabel(r.covers);
  const method = t(METHOD_KEY[r.method] || 'receiptCard')
    + (r.method !== 'card' && r.receivedBy ? ` — ${t('receiptReceivedBy')} ${esc(r.receivedBy)}` : '');
  const row = (label, value) => value
    ? `<div class="rc-row"><span>${label}</span><b>${value}</b></div>` : '';

  root.innerHTML = `
    <div class="pad mt-16">
      <div class="rc" id="rc">
        <div class="rc-head">
          <b>${t('appName')} · ${t('receiptTitle')}</b>
          <div class="rc-no ltr">${esc(r.id)}</div>
        </div>
        ${row(t('receiptDate'), fmtDate(r.at))}
        ${row(t('receiptBuyer'), r.buyer && (r.buyer.name || r.buyer.email)
          ? esc([r.buyer.name, r.buyer.email].filter(Boolean).join(' · ')) : '')}
        ${row(t('receiptDesc'), esc(r.description || kindLabel(r)))}
        ${row(t('receiptCovers'), covers)}
        ${row(t('receiptAmount'), `<span class="ltr">${fmtMoney(r.amount)}</span>`)}
        ${/* The tax line is PRESENT at $0.00 rather than absent. Adding it
             later to receipts issued without one is far harder than filling
             a line that is already there — and whether Texas charges sales
             tax on a digital subscription is a question for the owner's
             accountant, not for us to guess. */''}
        ${row(t('receiptTax'), `<span class="ltr">${fmtMoney(r.tax || 0)}</span>`)}
        <div class="rc-row rc-total"><span>${t('receiptTotal')}</span>
          <b class="ltr">${fmtMoney((r.amount || 0) + (r.tax || 0))}</b></div>
        ${row(t('receiptMethod'), method)}
        ${row(t('receiptStatus'), r.refundOf ? t('receiptRefunded') : t('receiptPaid'))}
        ${r.refundOf ? `<div class="rc-note">${t('receiptRefundOf').replace('{id}', esc(r.refundOf))}</div>` : ''}

        ${/* «renews automatically» is what cases are lost over, and a cash
             order does NOT renew — promising it would be a promise nobody
             keeps. So the line is one or the other, never a default. */''}
        ${r.covers && r.covers.to ? `<div class="rc-note">${
          (r.autoRenew ? t('receiptRenews') : t('receiptEnds')).replace('{d}', fmtDate(r.covers.to))
        }</div>` : ''}
        ${r.autoRenew ? `<div class="rc-note">${t('receiptCancelPath')}</div>` : ''}
        <div class="rc-note">${t('receiptSupport').replace('{e}', S.SUPPORT_EMAIL)}</div>
        <div class="rc-note rc-issuer">${t('receiptIssuer')}</div>
      </div>

      <div class="action-grid mt-12">
        <button class="btn btn-ghost" id="rcShare">${icon('share', 18)} ${t('share')}</button>
        <button class="btn btn-ghost" id="rcPrint">${icon('file', 18)} ${t('receiptPrint')}</button>
      </div>
      ${/* The button is here and says plainly that it waits for the server.
           A button that claims to send an email nothing sends is worse
           than no button. */''}
      <button class="btn btn-ghost btn-block mt-8" disabled>${icon('mail', 18)} ${t('receiptEmail')}</button>
      <div class="hint" style="text-align:center">${t('receiptEmailSoon')}</div>
    </div>
    <div style="height:16px"></div>`;

  $('#rcShare').addEventListener('click', () => shareItem(r.id, location.href));
  $('#rcPrint').addEventListener('click', () => window.print());
  wireRoutes(root);
}

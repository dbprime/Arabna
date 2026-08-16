/* ======================= ALL CATEGORIES ======================= */
import { t, icon, renderHeader, wireRoutes } from '../ui.js';
import { CATEGORIES, MARKET_CATS } from '../data.js';
import * as S from '../store.js';

/**
 * Every section of the app in one grid.
 * Directory cells open the directory filtered to that category,
 * marketplace cells open that section's listings directly.
 */
export function CategoriesScreen(root) {
  renderHeader({ simple: true, title: t('allCategories') });

  const businesses = S.allBusinesses();
  const listings = S.allClassifieds();

  const cell = (ico, label, count, route) => `
    <button class="cat-cell" data-route="${route}">
      <span class="cc-ico">${icon(ico, 24)}</span>
      <span class="cc-label">${label}</span>
      <span class="cc-count">${count}</span>
    </button>`;

  root.innerHTML = `
    <div class="section-head" style="margin-top:14px">
      <div class="section-title">${t('marketSections')}<small>${t('categoriesSub')}</small></div>
    </div>
    <div class="cat-grid">
      ${MARKET_CATS.map(c => cell(
        c.icon, t(c.key),
        listings.filter(x => x.cat === c.id).length,
        '#/marketplace?cat=' + c.id
      )).join('')}
    </div>

    <div class="section-head" style="margin-top:26px">
      <div class="section-title">${t('dirSections')}<small>${t('directorySub')}</small></div>
    </div>
    <div class="cat-grid">
      ${CATEGORIES.map(c => cell(
        c.icon, t(c.key),
        businesses.filter(b => b.cat === c.id).length,
        '#/directory?cat=' + c.id
      )).join('')}
    </div>
    <div style="height:22px"></div>`;

  wireRoutes(root);
}

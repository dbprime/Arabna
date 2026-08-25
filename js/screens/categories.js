/* ======================= ALL CATEGORIES ======================= */
import { t, icon, renderHeader, wireRoutes, catTileHtml } from '../ui.js';
import { CATEGORIES, MARKET_CATS, MARKET_HUE } from '../data.js';
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

  /* A directory category carries a hue AND the khatam; a marketplace
     section carries the hue as an outline and no khatam — filled is a
     place, outlined is a listing that passes, so the two may share a hue
     and the shape says which. `--h` is written on the pill itself and
     never on a parent of it (the V.04.7 rule); breaking that gives a pill
     with no colour and no message. */
  const cell = (ico, label, count, route, catId, mktId) => `
    <button class="cat-cell" data-route="${route}">
      ${catId ? catTileHtml(catId, 24, 'cc-ico')
              : `<span class="cc-ico mk" style="--h:${MARKET_HUE[mktId]}">${icon(ico, 24)}</span>`}
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
        '#/marketplace?cat=' + c.id, '', c.id
      )).join('')}
    </div>

    <div class="section-head" style="margin-top:26px">
      <div class="section-title">${t('dirSections')}<small>${t('directorySub')}</small></div>
    </div>
    <div class="cat-grid">
      ${CATEGORIES.map(c => cell(
        c.icon, t(c.key),
        // a category that is really a section of its own (Events) counts and
        // opens that section, not an empty directory filter
        c.route === '#/events' ? S.upcomingEvents().length : businesses.filter(b => b.cat === c.id).length,
        c.route || ('#/directory?cat=' + c.id),
        // `c.route ? '' : c.id` stood here and denied Events its hue.
        // `route` means «this is not a directory filter» and says nothing
        // about colour — no other category in CATEGORIES carries one, so
        // the condition was guarding nothing else.
        c.id
      )).join('')}
    </div>
    <div style="height:22px"></div>`;

  wireRoutes(root);
}

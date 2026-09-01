/* ============================================================
   The invented data, turned on for a suite that needs it
   ------------------------------------------------------------
   ⚠️ `510` MADE THE INVENTED DATA OFF BY DEFAULT, and it had to: the
   switch is saved in the reader's own device store, so while the default
   was `true` there was no way at all to hide the invented listings and
   reviews from a stranger opening `arabna.app`.

   ⚠️ AND THAT IS WHY 38 SUITES WENT RED AT ONCE — not one of them a
   defect in the app. They read the screen and use the invented records as
   their FIXTURE: the events, the marketplace listings, the magazine
   articles, the boost screen. With the data off they see an empty app and
   assert against nothing.

   The file that made the change said what to do about it, and it is what
   this helper does: **the suite that depends on the invented data turns
   the switch on explicitly, in its own preamble.** The default is not
   reverted and no assertion is softened.

   ⚠️ IT MERGES, IT DOES NOT REPLACE. Almost every suite seeds its own
   state by reading the stored object and writing it back, and that
   happens AFTER the page has loaded; this runs BEFORE each load. Writing
   a whole fresh object here would erase what the suite had set up on the
   previous navigation.

   ⚠️ AND `demoDefaultOff` IS THE HALF THAT IS EASY TO MISS. Without it
   the boot migration turns `showDemo` straight back off, and the switch
   looks as though it did nothing at all.
   ============================================================ */
export async function withDemoData(browser) {
  const real = browser.newContext.bind(browser);
  browser.newContext = async (...args) => {
    const ctx = await real(...args);
    await ctx.addInitScript(() => {
      const KEY = 'arabna.v1';
      /* ⚠️ ONLY WHEN NOTHING HAS SAID OTHERWISE. A suite may turn the
         invented data OFF on purpose — `v20 · 6.7` does exactly that to
         reach the «no subscriber» branch of the drawer row — and a helper
         that overrode it would break a test by helping it. So an object
         that already carries `showDemo` is left exactly as it is. */
      const on = (o) => {
        if (o && o.showDemo === undefined) { o.showDemo = true; o.demoDefaultOff = true; }
        return o;
      };
      try {
        const raw = localStorage.getItem(KEY);
        localStorage.setItem(KEY, JSON.stringify(on(raw ? JSON.parse(raw) : {})));
      } catch (e) { /* private mode — the suite fails loudly anyway */ }
      /* ⚠️ AND THE WRITE IS INTERCEPTED, which is the only order-proof
         point there is. `addInitScript` runs in registration order, and
         this one is registered first — so a suite that seeds by REPLACING
         the whole object (`setItem(KEY, JSON.stringify({...}))`, which
         five of them do) would erase the flags a moment later. Measured:
         v38, v39, v40, v43 and v45 all failed that way. Injecting at the
         write catches every seeding shape, whenever it happens. */
      const set = localStorage.setItem.bind(localStorage);
      localStorage.setItem = (k, v) => {
        if (k === KEY) {
          try { v = JSON.stringify(on(JSON.parse(v))); } catch (e) { /* not ours */ }
        }
        return set(k, v);
      };
    });
    return ctx;
  };
  return browser;
}

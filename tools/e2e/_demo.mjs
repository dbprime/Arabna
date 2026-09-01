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
      try {
        const KEY = 'arabna.v1';
        const s = JSON.parse(localStorage.getItem(KEY) || '{}');
        s.showDemo = true;
        s.demoDefaultOff = true;          // …or the migration undoes it
        localStorage.setItem(KEY, JSON.stringify(s));
      } catch (e) { /* private mode — the suite will fail loudly anyway */ }
    });
    return ctx;
  };
  return browser;
}
